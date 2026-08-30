import { sha256Hex } from "../commit/hash.js";
import type { LogEntry, LogEntryType } from "../model/types.js";

export const GENESIS_HASH = "0".repeat(64);

function computeEntryHash(entry: Omit<LogEntry, "entryHash">): string {
  return sha256Hex(
    [entry.index, entry.timestamp, entry.type, entry.payloadHash, entry.prevHash].join("|"),
  );
}

/** Append-only hashketen (ARCHITECTURE.md §4, invariant I3). */
export class HashChain {
  private entries: LogEntry[] = [];

  constructor(entries: LogEntry[] = []) {
    this.entries = entries;
  }

  /**
   * De volgende regel uitrekenen zonder hem toe te voegen.
   *
   * Bestaat zodat een instantie die haar keten bewaart de regel eerst naar disk
   * kan schrijven en hem pas daarna in het geheugen bijzet (`commit`). De
   * omgekeerde volgorde levert het ene geval op dat je hier nooit wilt hebben:
   * een bieder met een ondertekend ontvangstbewijs voor een regel die na een
   * stroomstoring nergens meer staat.
   */
  draft(type: LogEntryType, payloadHash: string, timestamp = new Date().toISOString()): LogEntry {
    const index = this.entries.length;
    const prevHash = index === 0 ? GENESIS_HASH : this.entries[index - 1].entryHash;
    const entry = { index, timestamp, type, payloadHash, prevHash };
    return { ...entry, entryHash: computeEntryHash(entry) };
  }

  /**
   * Meerdere regels achter elkaar uitrekenen zonder ze toe te voegen, elk
   * hangend aan de vorige. Nodig waar één gebeurtenis meerdere regels oplevert
   * (een onthulling, een gunning) en die samen op disk moeten staan of geen van
   * alle.
   */
  draftAll(items: { type: LogEntryType; payloadHash: string }[], timestamp = new Date().toISOString()): LogEntry[] {
    const drafted: LogEntry[] = [];
    let index = this.entries.length;
    let prevHash = this.root;
    for (const item of items) {
      const entry = { index, timestamp, type: item.type, payloadHash: item.payloadHash, prevHash };
      const full: LogEntry = { ...entry, entryHash: computeEntryHash(entry) };
      drafted.push(full);
      index += 1;
      prevHash = full.entryHash;
    }
    return drafted;
  }

  commitAll(entries: LogEntry[]): void {
    for (const entry of entries) this.commit(entry);
  }

  /** Een eerder opgestelde regel definitief toevoegen. */
  commit(entry: LogEntry): void {
    if (entry.index !== this.entries.length) {
      throw new Error(
        `logregel ${entry.index} past niet op een keten van ${this.entries.length} regels`,
      );
    }
    this.entries.push(entry);
  }

  append(type: LogEntryType, payloadHash: string, timestamp = new Date().toISOString()): LogEntry {
    const entry = this.draft(type, payloadHash, timestamp);
    this.commit(entry);
    return entry;
  }

  get last(): LogEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  get root(): string {
    return this.last?.entryHash ?? GENESIS_HASH;
  }

  all(): LogEntry[] {
    return [...this.entries];
  }

  static verify(entries: LogEntry[]): { valid: boolean; firstBrokenIndex?: number } {
    let prevHash = GENESIS_HASH;
    for (const entry of entries) {
      const expectedEntryHash = computeEntryHash({
        index: entry.index,
        timestamp: entry.timestamp,
        type: entry.type,
        payloadHash: entry.payloadHash,
        prevHash: entry.prevHash,
      });
      if (entry.prevHash !== prevHash || entry.entryHash !== expectedEntryHash) {
        return { valid: false, firstBrokenIndex: entry.index };
      }
      prevHash = entry.entryHash;
    }
    return { valid: true };
  }
}
