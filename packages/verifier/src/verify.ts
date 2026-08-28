import {
  HashChain,
  canonicalize,
  sha256Hex,
  verifyWithPublicKeyPem,
  type BidReceipt,
  type LogEntry,
  type Logbook,
} from "@openbod/core";

export interface VerifyLogbookResult {
  hashchainValid: boolean;
  firstBrokenIndex?: number;
  rootMatches: boolean;
  signatureValid: boolean;
  overallValid: boolean;
}

/**
 * Onafhankelijke verificatie van een biedlogboek: draait zonder toegang tot de
 * instantie, alleen op basis van wat de instantie publiceerde (ARCHITECTURE.md §6.1).
 * Controleert I3 (hashketen), I8 (root komt overeen), en dat het logboek
 * daadwerkelijk door de geclaimde instantiesleutel is ondertekend.
 */
export function verifyLogbook(logbook: Logbook): VerifyLogbookResult {
  const chainResult = HashChain.verify(logbook.log);
  const lastEntry = logbook.log[logbook.log.length - 1];
  const rootMatches = lastEntry !== undefined && lastEntry.entryHash === logbook.rootHash;

  const { signature, signerPublicKey, ...unsigned } = logbook;
  const signatureValid = verifyWithPublicKeyPem(canonicalize(unsigned), signature, signerPublicKey);

  return {
    hashchainValid: chainResult.valid,
    firstBrokenIndex: chainResult.firstBrokenIndex,
    rootMatches,
    signatureValid,
    overallValid: chainResult.valid && rootMatches && signatureValid,
  };
}

export interface VerifyReceiptResult {
  presentInLog: boolean;
  entryIntact: boolean;
  signatureValid: boolean;
  overallValid: boolean;
}

/**
 * Verifieert dat een eigen ontvangstbewijs echt en ongewijzigd in het volledige
 * logboek staat (I7), zonder de instantie op haar woord te geloven.
 */
export function verifyReceipt(
  receipt: BidReceipt,
  fullLog: LogEntry[],
  instancePublicKeyPem: string,
): VerifyReceiptResult {
  const entry = fullLog[receipt.logIndex];
  const expectedPayloadHash = sha256Hex(receipt.commitment);
  const entryIntact =
    entry !== undefined &&
    entry.entryHash === receipt.entryHash &&
    entry.prevHash === receipt.prevHash &&
    entry.timestamp === receipt.timestamp &&
    entry.payloadHash === expectedPayloadHash;

  const presentInLog = fullLog.some(
    (e) => (e.type === "bid_placed" || e.type === "bid_adjusted") && e.payloadHash === expectedPayloadHash,
  );

  const { instanceSignature, ...unsigned } = receipt;
  const signatureValid = verifyWithPublicKeyPem(canonicalize(unsigned), instanceSignature, instancePublicKeyPem);

  return {
    presentInLog,
    entryIntact,
    signatureValid,
    overallValid: presentInLog && entryIntact && signatureValid,
  };
}
