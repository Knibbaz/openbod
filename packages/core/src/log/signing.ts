import { createPublicKey, generateKeyPairSync, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";

/**
 * Instantie-sleutelpaar (Ed25519) waarmee ontvangstbewijzen en logboeken
 * ondertekend worden. Voor de MVP een in-memory sleutel per processtart;
 * een echte deployment laadt een persistente sleutel en laat de publieke
 * sleutel certificeren (ARCHITECTURE.md §6.3).
 */
export class InstanceKeypair {
  readonly publicKey: KeyObject;
  private readonly privateKey: KeyObject;

  constructor() {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  sign(data: string): string {
    return edSign(null, Buffer.from(data, "utf8"), this.privateKey).toString("base64");
  }

  verify(data: string, signatureB64: string): boolean {
    return edVerify(null, Buffer.from(data, "utf8"), this.publicKey, Buffer.from(signatureB64, "base64"));
  }

  publicKeyPem(): string {
    return this.publicKey.export({ type: "spki", format: "pem" }).toString();
  }
}

/**
 * Verifieert een handtekening met alleen een PEM-publieke sleutel, zonder een
 * InstanceKeypair. Dit is wat de losse `verifier` gebruikt: hij heeft nooit
 * toegang tot een privésleutel, alleen tot wat de instantie publiceert (E8-S1).
 */
export function verifyWithPublicKeyPem(data: string, signatureB64: string, publicKeyPem: string): boolean {
  try {
    const publicKey = createPublicKey(publicKeyPem);
    return edVerify(null, Buffer.from(data, "utf8"), publicKey, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}
