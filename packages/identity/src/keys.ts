import { generateKeyPair, exportJWK, importJWK, type JWK, type KeyLike } from "jose";
import { randomUUID } from "node:crypto";

export interface InstanceKeys {
  privateKey: KeyLike;
  publicJwk: Record<string, unknown>;
  kid: string;
}

/**
 * De sleutel waarmee inlogtokens ondertekend worden.
 *
 * Zonder `IDENTITY_SIGNING_JWK` komt er bij elke start een nieuwe, en dan is
 * iedereen na een herstart uitgelogd: de core controleert tokens tegen de JWKS,
 * en die bevat dan een andere sleutel. Voor een instantie die je regelmatig
 * bijwerkt is dat onnodig vervelend, dus geef er een mee. Maak er een met:
 *
 *   node -e "const {generateKeyPair,exportJWK}=require('jose');generateKeyPair('ES256',{extractable:true}).then(async k=>console.log(JSON.stringify({...await exportJWK(k.privateKey),alg:'ES256',kid:require('crypto').randomUUID()})))"
 */
export async function loadKeys(): Promise<InstanceKeys> {
  const uitOmgeving = process.env.IDENTITY_SIGNING_JWK;
  if (uitOmgeving?.trim()) {
    const jwk = JSON.parse(uitOmgeving) as JWK;
    if (!jwk.kty) throw new Error("IDENTITY_SIGNING_JWK is geen geldige JWK: 'kty' ontbreekt");
    const kid = typeof jwk.kid === "string" ? jwk.kid : randomUUID();
    const privateKey = (await importJWK(jwk, "ES256")) as KeyLike;
    // De publieke helft is de private JWK zonder de geheime componenten. Die
    // eruit halen is geen nettigheid maar noodzaak: dit gaat naar /jwks.json.
    const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, ...publiek } = jwk;
    return { privateKey, publicJwk: { ...publiek, kid, alg: "ES256", use: "sig" }, kid };
  }

  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const kid = randomUUID();
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };
  return { privateKey, publicJwk, kid };
}
