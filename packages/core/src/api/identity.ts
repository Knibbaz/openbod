import { createRemoteJWKSet, jwtVerify } from "jose";

const AUDIENCE = "openbod-core";
const ISSUER = process.env.IDENTITY_ISSUER ?? "http://localhost:4001";
const JWKS_URL = process.env.IDENTITY_JWKS_URL ?? "http://localhost:4001/.well-known/jwks.json";
const MAX_TOKEN_LENGTH = 8 * 1024;

// `cooldownDuration` beperkt hoe vaak een falende lookup opnieuw naar de
// JWKS-endpoint gaat (voorkomt dat een aanvaller met kapotte tokens de
// identity-backend laat platbombarderen via de core).
const jwks = createRemoteJWKSet(new URL(JWKS_URL), { cooldownDuration: 30_000 });

export interface Identity {
  sub: string;
  assuranceLevel: string;
}

/**
 * Verifieert het OIDC-stijl token van de identity-backend en geeft alleen
 * `sub` door aan de biedlogica (protocol.md §7, invariant I10). De core kent
 * geen wachtwoorden of e-mailadressen.
 *
 * Algoritme en issuer worden expliciet vastgepind: alleen ES256-tokens van
 * de geconfigureerde identity-issuer worden geaccepteerd. Zonder die
 * restrictie zou een JWT met `alg: none` of een token van een andere,
 * onbedoelde issuer met een geldige (maar verkeerde) sleutel kunnen
 * misleiden: klassieke JWT-algoritme-verwarring (OWASP).
 */
export async function verifyIdentityToken(token: string): Promise<Identity> {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw new Error("ongeldig tokenformaat");
  }
  const { payload } = await jwtVerify(token, jwks, {
    audience: AUDIENCE,
    issuer: ISSUER,
    algorithms: ["ES256"],
    clockTolerance: 5,
  });
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("token mist sub");
  }
  return { sub: payload.sub, assuranceLevel: String(payload.assurance_level ?? "onbekend") };
}
