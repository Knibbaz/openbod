import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { SignJWT } from "jose";
import { randomUUID, createHash } from "node:crypto";
import { loadKeys } from "./keys.js";

/**
 * Identity-backend: authenticatie via magic link, geeft een OIDC-stijl JWT
 * uit met alleen sub, aud, iss, assurance_level (ARCHITECTURE.md §5,
 * protocol.md §7). Bevat geen biedlogica. Later kan hier iDIN naast of in
 * plaats van magic link komen zonder dat de core-API verandert (I10).
 */

interface PendingLink {
  email: string;
  expiresAt: number;
  used: boolean;
}

const PORT = Number(process.env.IDENTITY_PORT ?? 4001);
const ISSUER = process.env.IDENTITY_ISSUER ?? `http://localhost:${PORT}`;
const AUDIENCE = "openbod-core";
const LINK_TTL_MS = 15 * 60 * 1000;
const TOKEN_TTL = "1h";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// Alleen buiten productie de magic-link-token rechtstreeks teruggeven i.p.v.
// mailen: er is in de demo geen mailserver aangesloten. In productie MOET
// dit uitstaan, anders kan iedereen inloggen als elk e-mailadres zonder er
// toegang toe te hebben — dat ondermijnt de hele identiteitscontrole.
const EXPOSE_DEV_LINK = !IS_PRODUCTION;

const ALLOWED_ORIGINS = (process.env.IDENTITY_ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const pendingLinks = new Map<string, PendingLink>();
const keys = await loadKeys();

const app = Fastify({
  logger: false,
  bodyLimit: 16 * 1024,
  trustProxy: process.env.TRUST_PROXY === "true",
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

if (IS_PRODUCTION) {
  console.log("[identity] productiemodus: magic links worden niet in de response getoond, alleen gemaild.");
} else {
  console.warn("[identity] dev-modus: magic-link-token staat in de API-response (EXPOSE_DEV_LINK). Nooit zo in productie draaien.");
}

app.get("/.well-known/jwks.json", async () => ({ keys: [keys.publicJwk] }));

app.post(
  "/magic-link",
  { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
  async (req, reply) => {
    const body = z.object({ email: z.string().trim().toLowerCase().email().max(320) }).safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "ongeldig e-mailadres" });
    }
    const token = randomUUID();
    pendingLinks.set(token, { email: body.data.email, expiresAt: Date.now() + LINK_TTL_MS, used: false });

    const link = `http://localhost:5173/login/consume?token=${token}`;
    // Demo-vereenvoudiging: er is geen echte mailserver aangesloten. In
    // productie gaat dit uitsluitend per e-mail, nooit via de response of
    // de serverlog (die zou dan een credential-log zijn).
    if (EXPOSE_DEV_LINK) {
      console.log(`[identity] magic link voor ${body.data.email}: ${link}`);
      return { message: "magic link verstuurd (zie serverlog in deze demo)", devLink: link, devToken: token };
    }
    return { message: "als dit e-mailadres bekend is, is er een magic link verstuurd" };
  },
);

app.post(
  "/consume",
  { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const body = z.object({ token: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "ongeldig token" });
    }
    const pending = pendingLinks.get(body.data.token);
    if (!pending || pending.used || pending.expiresAt < Date.now()) {
      return reply.status(401).send({ error: "verlopen of ongeldig magic link-token" });
    }
    pending.used = true;

    const sub = createHash("sha256").update(pending.email).digest("hex");
    const jwt = await new SignJWT({ assurance_level: "email" })
      .setProtectedHeader({ alg: "ES256", kid: keys.kid })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime(TOKEN_TTL)
      .sign(keys.privateKey);

    return { accessToken: jwt };
  },
);

setInterval(() => {
  const now = Date.now();
  for (const [token, pending] of pendingLinks) {
    if (pending.used || pending.expiresAt < now) pendingLinks.delete(token);
  }
}, 60_000);

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[identity] luistert op ${address}`);
});
