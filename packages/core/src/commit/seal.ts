import { computeCommitment, randomSalt } from "./hash.js";
import { canonicalize } from "./canonical.js";
import { encryptToDeadline } from "../timelock/timelock.js";
import type { BidPayload } from "../model/types.js";

/**
 * Verzegelt een bod: draait bij de bieder (browser), niet in de core
 * (ARCHITECTURE.md §3). Geëxporteerd vanuit @openbod/core zodat web-demo en
 * de conformance-tests dezelfde, geauditeerde implementatie gebruiken:
 * maar deze functie wordt nooit server-side aangeroepen door de core zelf.
 */
export async function sealBid(payload: BidPayload, deadlineIso: string) {
  const salt = randomSalt();
  const commitment = computeCommitment(payload, salt);
  const envelope = canonicalize({ payload, salt });
  const ciphertext = await encryptToDeadline(Buffer.from(envelope, "utf8"), deadlineIso);
  return { commitment, ciphertext, salt };
}
