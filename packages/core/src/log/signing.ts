import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from "node:crypto";

/**
 * Instantie-sleutelpaar (Ed25519) waarmee ontvangstbewijzen en logboeken
 * ondertekend worden.
 *
 * Zonder meegegeven sleutel maakt dit er een per processtart, en dat is precies
 * genoeg voor tests en voor lokaal werken. Voor een instantie die blijft staan
 * is het niet goed genoeg: wie vandaag een logboek downloadt en het morgen wil
 * narekenen, vergelijkt de handtekening met de publieke sleutel die de
 * instantie dan toont. Is die sleutel bij een herstart vervangen, dan faalt de
 * verificatie van een logboek dat gewoon echt is. Daarom laadt een deployment
 * een vaste sleutel (ARCHITECTURE.md §6.3).
 */
export class InstanceKeypair {
  readonly publicKey: KeyObject;
  private readonly privateKey: KeyObject;

  /** @param privateKeyPem PKCS8-PEM van een Ed25519-sleutel; leeg betekent een nieuwe per start. */
  constructor(privateKeyPem?: string) {
    if (privateKeyPem?.trim()) {
      // Toestaan dat de sleutel als één regel met \n in een omgevingsvariabele
      // staat, want dat is hoe secrets in de praktijk doorgegeven worden.
      const pem = privateKeyPem.includes("\\n") ? privateKeyPem.replace(/\\n/g, "\n") : privateKeyPem;
      this.privateKey = createPrivateKey(pem.trim());
      if (this.privateKey.asymmetricKeyType !== "ed25519") {
        throw new Error("de ondertekensleutel van de instantie moet Ed25519 zijn");
      }
      this.publicKey = createPublicKey(this.privateKey);
      return;
    }
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
