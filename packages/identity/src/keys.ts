import { generateKeyPair, exportJWK, type KeyLike } from "jose";
import { randomUUID } from "node:crypto";

export interface InstanceKeys {
  privateKey: KeyLike;
  publicJwk: Record<string, unknown>;
  kid: string;
}

export async function loadKeys(): Promise<InstanceKeys> {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const kid = randomUUID();
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };
  return { privateKey, publicJwk, kid };
}
