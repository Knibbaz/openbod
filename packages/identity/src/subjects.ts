import { DatabaseSync, type StatementSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { maakLogger } from "./logger.js";

const log = maakLogger("identity");

/**
 * De koppeling van een pseudonieme sub naar een e-mailadres. Dit is de enige
 * plek in het systeem waar die koppeling bestaat (ARCHITECTURE.md §5); de core
 * kent alleen subs.
 *
 * Waarom dit bewaard moet blijven: zonder deze tabel kan het biedlogboek na een
 * herstart niet bezorgd worden aan wie sindsdien niet opnieuw inlogde (E4-S3).
 * Dat is precies de klacht die dit systeem oplost, dus die mag niet terugkomen
 * via een reboot.
 */
export interface SubjectStore {
  remember(sub: string, email: string): void;
  emailFor(sub: string): string | undefined;
  close(): void;
}

/** Zonder bestand: vergeet alles bij een herstart. Voor tests en de demo. */
export class MemorySubjectStore implements SubjectStore {
  private readonly subjects = new Map<string, string>();
  remember(sub: string, email: string): void {
    this.subjects.set(sub, email);
  }
  emailFor(sub: string): string | undefined {
    return this.subjects.get(sub);
  }
  close(): void {}
}

export class SqliteSubjectStore implements SubjectStore {
  private readonly db: DatabaseSync;
  private readonly insert: StatementSync;
  private readonly select: StatementSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = FULL");
    this.db.exec("CREATE TABLE IF NOT EXISTS subjects (sub TEXT PRIMARY KEY, email TEXT NOT NULL)");
    this.insert = this.db.prepare(
      "INSERT INTO subjects (sub, email) VALUES (?, ?) ON CONFLICT(sub) DO UPDATE SET email = excluded.email",
    );
    this.select = this.db.prepare("SELECT email FROM subjects WHERE sub = ?");
  }

  remember(sub: string, email: string): void {
    this.insert.run(sub, email);
  }

  emailFor(sub: string): string | undefined {
    const row = this.select.get(sub) as { email: string } | undefined;
    return row?.email;
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Bewaren waar `IDENTITY_DB_PATH` wijst, tenzij dit een demo-instantie is: die
 * heeft niets te bewaren en hoort geen adressen achter te laten.
 */
export function buildSubjectStore(demoMode: boolean): SubjectStore {
  if (demoMode) {
    log.info("DEMO-modus: e-mailadressen worden niet bewaard");
    return new MemorySubjectStore();
  }
  const path = process.env.IDENTITY_DB_PATH?.trim() || "./data/identity.db";
  if (path === ":memory:") {
    log.warn(
      "IDENTITY_DB_PATH=:memory:, dus na een herstart kan het biedlogboek niet bezorgd worden aan wie " +
        "niet opnieuw inlogt.",
    );
    return new MemorySubjectStore();
  }
  log.info("bekende subjects worden bewaard", { pad: path });
  return new SqliteSubjectStore(path);
}
