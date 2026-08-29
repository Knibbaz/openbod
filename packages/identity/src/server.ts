import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { SignJWT } from "jose";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
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
// Waar de magic link naartoe wijst: de frontend van deze instantie.
const APP_BASE_URL = (process.env.APP_BASE_URL ?? "http://localhost:5173").replace(/\/+$/, "");
// Alleen buiten productie de magic-link-token rechtstreeks teruggeven i.p.v.
// mailen: er is in de demo geen mailserver aangesloten. In productie MOET
// dit uitstaan, anders kan iedereen inloggen als elk e-mailadres zonder er
// toegang toe te hebben, en dat ondermijnt de hele identiteitscontrole.
//
// IDENTITY_DEMO_MODE zet dit bewust weer aan voor de publieke demo-instantie.
// Die heeft geen mailserver, dus zonder deze schakelaar kan niemand inloggen.
// Ze bevat uitsluitend verzonnen woningen en is geen productiesysteem: zet dit
// nooit aan op een instantie waar echte biedingen op binnenkomen.
const DEMO_MODE = process.env.IDENTITY_DEMO_MODE === "true";
const EXPOSE_DEV_LINK = !IS_PRODUCTION || DEMO_MODE;

const ALLOWED_ORIGINS = (process.env.IDENTITY_ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Sub naar e-mailadres. De core kent alleen pseudonieme subjects en hoort geen
 * adressen te kennen (ARCHITECTURE.md §5); deze backend is de enige plek waar
 * de koppeling bestaat. Nodig om het biedlogboek automatisch te kunnen
 * verstrekken (E4-S3) zonder de scheiding op te geven.
 *
 * In-memory, net als de rest van de MVP: een herstart maakt bezorging aan
 * eerdere deelnemers onmogelijk tot zij opnieuw inloggen. Een productie-
 * instantie zet hier een persistente store neer.
 */
const knownSubjects = new Map<string, string>();

// Gedeeld geheim tussen core en identity. Zonder dit zou /notify/logbook een
// orakel zijn waarmee iedereen kan uitvragen of een sub bekend is.
const DELIVERY_SHARED_SECRET = process.env.DELIVERY_SHARED_SECRET ?? "";

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

if (IS_PRODUCTION && DEMO_MODE) {
  console.warn("[identity] DEMO-instantie: magic-link-token staat in de API-response. Iedereen kan inloggen als elk e-mailadres. Alleen voor de publieke demo.");
} else if (IS_PRODUCTION) {
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

    const link = `${APP_BASE_URL}/login/consume?token=${token}`;
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
    knownSubjects.set(sub, pending.email);
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

/**
 * E4-S3: bezorgopdracht vanuit de core. De core stuurt pseudonieme subjects en
 * het ondertekende logboek; deze backend vertaalt de subjects naar adressen en
 * verstuurt. De core leert daarbij nooit naar welke adressen het ging, en deze
 * backend leert niets over de biedingen wat niet al in het openbare logboek staat.
 *
 * Dit is de kern van de klacht die dit oplost: sinds 2023 is het biedlogboek
 * verplicht, maar in de praktijk moesten kopers erom vragen en kreeg ongeveer
 * een derde het. Hier is verstrekken geen handeling van de makelaar meer.
 */
app.post(
  "/notify/logbook",
  {
    // Een volledig biedlogboek is fors groter dan een loginverzoek: het bevat de
    // hele hashketen. De globale 16 KB-limiet van deze backend zou het weigeren.
    bodyLimit: 2 * 1024 * 1024,
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  },
  async (req, reply) => {
    if (!DELIVERY_SHARED_SECRET) {
      return reply.status(503).send({ error: "bezorging is op deze instantie niet geconfigureerd" });
    }
    const provided = req.headers["x-delivery-secret"];
    if (typeof provided !== "string" || !secretMatches(provided)) {
      return reply.status(401).send({ error: "ongeldig bezorggeheim" });
    }
    const body = z
      .object({
        listingId: z.string().uuid(),
        recipients: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(1000),
        logbook: z.record(z.unknown()),
      })
      .safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "ongeldige bezorgopdracht" });
    }

    let delivered = 0;
    let unknown = 0;
    for (const sub of body.data.recipients) {
      const email = knownSubjects.get(sub);
      if (!email) {
        unknown += 1;
        continue;
      }
      sendLogbookMail(email, body.data.listingId, body.data.logbook);
      delivered += 1;
    }
    // Bewust géén lijst van welke subs onbekend waren: dat zou het endpoint
    // alsnog tot een uitvraagorakel maken voor wie het geheim ooit te pakken krijgt.
    return { delivered, unknown };
  },
);

function secretMatches(provided: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(DELIVERY_SHARED_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Demo-vereenvoudiging, net als bij de magic link: er is geen mailserver
 * aangesloten, dus dit schrijft naar de console. Een productie-instantie hangt
 * hier een echte mailer aan; het logboek gaat als bijlage mee, want de
 * ontvanger moet het onafhankelijk kunnen narekenen met de verifier.
 */
function sendLogbookMail(email: string, listingId: string, logbook: Record<string, unknown>) {
  const rootHash = typeof logbook.rootHash === "string" ? logbook.rootHash : "onbekend";
  console.log(
    `[identity] biedlogboek van listing ${listingId} (root ${rootHash.slice(0, 12)}...) ` +
      `naar ${email}. DEMO: niet echt gemaild, geen mailserver geconfigureerd.`,
  );
}

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
