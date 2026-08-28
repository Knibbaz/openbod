import { createHash, randomBytes } from "node:crypto";
import { canonicalize } from "./canonical.js";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomSalt(): string {
  return randomBytes(32).toString("hex");
}

/** commitment = H(bod || salt), zie protocol.md §5. */
export function computeCommitment(payload: unknown, salt: string): string {
  return sha256Hex(canonicalize(payload) + "|" + salt);
}
