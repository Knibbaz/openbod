import { DatabaseSync, type StatementSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { canonicalize } from "../commit/canonical.js";
import type {
  LogEntry,
  Listing,
  RevealedBid,
  SealedBid,
} from "../model/types.js";
import type { Logbook } from "../logbook/logbook.js";
import type { DeliveryResult } from "../store.js";
import type { Persistence, PersistedListing } from "./port.js";

const SCHEMA_VERSION = "1";

/**
 * De logregels zijn de bron van waarheid; de rest is de toestand die eruit
 * volgt en die we bewaren zodat zij bij het opstarten teruggelezen kan worden
 * in plaats van herberekend.
 *
 * `PRIMARY KEY (listing_id, idx)` is hier het belangrijkste. Tot nu toe was
 * "geen gat en geen duplicaat in de keten" alleen een eigenschap van
 * `HashChain` in het geheugen. Vanaf nu bewaakt de database het ook, en wordt
 * een dubbele regel een schrijffout in plaats van een logboek dat klopt qua
 * hashes maar liegt over wat er gebeurd is.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS listings (
  id   TEXT PRIMARY KEY,
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_entries (
  listing_id   TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  timestamp    TEXT NOT NULL,
  type         TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  prev_hash    TEXT NOT NULL,
  entry_hash   TEXT NOT NULL,
  PRIMARY KEY (listing_id, idx)
);

CREATE TABLE IF NOT EXISTS sealed_bids (
  bid_id     TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  json       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revealed_bids (
  bid_id     TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  -- Afgeleid van amount in de JSON, puur om mee te kunnen rekenen. Zie
  -- saveRevealed voor waarom het bedrag zelf in de JSON blijft staan.
  amount_cents INTEGER NOT NULL,
  json       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logbooks (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  json       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  json       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS sealed_bids_listing ON sealed_bids(listing_id);
CREATE INDEX IF NOT EXISTS revealed_bids_listing ON revealed_bids(listing_id);
`;

export class SchemaVersionError extends Error {}

export class SqlitePersistence implements Persistence {
  private readonly db: DatabaseSync;
  private readonly stmt: {
    saveListing: StatementSync;
    appendEntry: StatementSync;
    saveSealed: StatementSync;
    saveRevealed: StatementSync;
    deleteRevealed: StatementSync;
    saveLogbook: StatementSync;
    saveDelivery: StatementSync;
  };
  private depth = 0;

  /** @param path pad naar het databasebestand, of `:memory:`. */
  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    // WAL plus synchronous=FULL: elke commit gaat met een fsync naar disk. Dat
    // kost een schijfomwenteling per bod en dat is precies wat we ervoor over
    // hebben, want dit is het moment waarop de bieder zijn bewijs krijgt.
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = FULL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(SCHEMA);
    this.checkSchemaVersion();

    this.stmt = {
      saveListing: this.db.prepare("INSERT INTO listings (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json"),
      appendEntry: this.db.prepare(
        "INSERT INTO log_entries (listing_id, idx, timestamp, type, payload_hash, prev_hash, entry_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ),
      saveSealed: this.db.prepare(
        "INSERT INTO sealed_bids (bid_id, listing_id, json) VALUES (?, ?, ?) ON CONFLICT(bid_id) DO UPDATE SET json = excluded.json",
      ),
      saveRevealed: this.db.prepare(
        "INSERT INTO revealed_bids (bid_id, listing_id, amount_cents, json) VALUES (?, ?, ?, ?) ON CONFLICT(bid_id) DO UPDATE SET amount_cents = excluded.amount_cents, json = excluded.json",
      ),
      deleteRevealed: this.db.prepare("DELETE FROM revealed_bids WHERE listing_id = ?"),
      saveLogbook: this.db.prepare(
        "INSERT INTO logbooks (listing_id, json) VALUES (?, ?) ON CONFLICT(listing_id) DO UPDATE SET json = excluded.json",
      ),
      saveDelivery: this.db.prepare(
        "INSERT INTO deliveries (listing_id, json) VALUES (?, ?) ON CONFLICT(listing_id) DO UPDATE SET json = excluded.json",
      ),
    };
  }

  /**
   * Een bestand van een nieuwere versie openen is geen upgrade maar een
   * ongeluk: dan schrijft een oude core in een schema dat zij niet kent.
   */
  private checkSchemaVersion(): void {
    const row = this.db.prepare("SELECT v FROM meta WHERE k = 'schema_version'").get() as
      | { v: string }
      | undefined;
    if (!row) {
      this.db.prepare("INSERT INTO meta (k, v) VALUES ('schema_version', ?)").run(SCHEMA_VERSION);
      return;
    }
    if (row.v !== SCHEMA_VERSION) {
      throw new SchemaVersionError(
        `database heeft schemaversie ${row.v}, deze core verwacht ${SCHEMA_VERSION}`,
      );
    }
  }

  load(): PersistedListing[] {
    const listings = this.db.prepare("SELECT id, json FROM listings").all() as {
      id: string;
      json: string;
    }[];
    const byId = new Map<string, PersistedListing>();
    for (const row of listings) {
      byId.set(row.id, {
        listing: JSON.parse(row.json) as Listing,
        entries: [],
        sealedBids: [],
      });
    }

    const entries = this.db
      .prepare("SELECT listing_id, idx, timestamp, type, payload_hash, prev_hash, entry_hash FROM log_entries ORDER BY listing_id, idx")
      .all() as {
      listing_id: string;
      idx: number;
      timestamp: string;
      type: string;
      payload_hash: string;
      prev_hash: string;
      entry_hash: string;
    }[];
    for (const row of entries) {
      byId.get(row.listing_id)?.entries.push({
        index: row.idx,
        timestamp: row.timestamp,
        type: row.type as LogEntry["type"],
        payloadHash: row.payload_hash,
        prevHash: row.prev_hash,
        entryHash: row.entry_hash,
      });
    }

    for (const row of this.db.prepare("SELECT listing_id, json FROM sealed_bids").all() as {
      listing_id: string;
      json: string;
    }[]) {
      byId.get(row.listing_id)?.sealedBids.push(JSON.parse(row.json) as SealedBid);
    }

    for (const row of this.db.prepare("SELECT listing_id, json FROM revealed_bids").all() as {
      listing_id: string;
      json: string;
    }[]) {
      const rec = byId.get(row.listing_id);
      if (!rec) continue;
      (rec.revealed ??= []).push(JSON.parse(row.json) as RevealedBid);
    }

    for (const row of this.db.prepare("SELECT listing_id, json FROM logbooks").all() as {
      listing_id: string;
      json: string;
    }[]) {
      const rec = byId.get(row.listing_id);
      if (rec) rec.logbook = JSON.parse(row.json) as Logbook;
    }

    for (const row of this.db.prepare("SELECT listing_id, json FROM deliveries").all() as {
      listing_id: string;
      json: string;
    }[]) {
      const rec = byId.get(row.listing_id);
      if (rec) rec.delivery = JSON.parse(row.json) as DeliveryResult;
    }

    return [...byId.values()];
  }

  transaction(fn: () => void): void {
    if (this.depth > 0) {
      // Geneste aanroep: de buitenste transactie beslist over commit.
      fn();
      return;
    }
    this.db.exec("BEGIN IMMEDIATE");
    this.depth = 1;
    try {
      fn();
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    } finally {
      this.depth = 0;
    }
  }

  saveListing(listing: Listing): void {
    this.stmt.saveListing.run(listing.id, canonicalize(listing));
  }

  appendLogEntry(listingId: string, entry: LogEntry): void {
    this.stmt.appendEntry.run(
      listingId,
      entry.index,
      entry.timestamp,
      entry.type,
      entry.payloadHash,
      entry.prevHash,
      entry.entryHash,
    );
  }

  saveSealedBid(bid: SealedBid): void {
    this.stmt.saveSealed.run(bid.bidId, bid.listingId, canonicalize(bid));
  }

  /**
   * Het bedrag blijft in de JSON staan zoals het verzegeld werd: dat is waar de
   * commitment overheen is berekend en waar het logboek mee verifieert.
   * `amount_cents` staat ernaast om mee te kunnen rekenen en sorteren, want een
   * bedrag in euro's is een float en floats zijn geen geld. Afgeleid, dus geen
   * enkele hash verandert eraan.
   */
  saveRevealed(listingId: string, revealed: RevealedBid[]): void {
    this.stmt.deleteRevealed.run(listingId);
    for (const bid of revealed) {
      this.stmt.saveRevealed.run(bid.bidId, listingId, Math.round(bid.amount * 100), canonicalize(bid));
    }
  }

  saveLogbook(listingId: string, logbook: Logbook): void {
    this.stmt.saveLogbook.run(listingId, canonicalize(logbook));
  }

  saveDelivery(delivery: DeliveryResult): void {
    this.stmt.saveDelivery.run(delivery.listingId, canonicalize(delivery));
  }

  clear(): void {
    this.transaction(() => {
      // listings als laatste: de rest hangt er met een foreign key aan.
      for (const table of ["log_entries", "sealed_bids", "revealed_bids", "logbooks", "deliveries", "listings"]) {
        this.db.exec(`DELETE FROM ${table}`);
      }
    });
  }

  close(): void {
    this.db.close();
  }
}
