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

  append(type: LogEntryType, payloadHash: string, timestamp = new Date().toISOString()): LogEntry {
    const index = this.entries.length;
    const prevHash = index === 0 ? GENESIS_HASH : this.entries[index - 1].entryHash;
    const draft = { index, timestamp, type, payloadHash, prevHash };
    const entryHash = computeEntryHash(draft);
    const entry: LogEntry = { ...draft, entryHash };
    this.entries.push(entry);
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
