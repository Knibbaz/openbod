import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { InstanceKeypair } from "../log/signing.js";
import {
  OpenBodStore,
  ListingNotFoundError,
  InvalidTransitionError,
  RuleViolationError,
} from "../store.js";
import { NoPersistence, type Persistence } from "../persistence/port.js";
import { SqlitePersistence } from "../persistence/sqlite.js";
import { maakLogger } from "../logging/logger.js";
import { ConsoleLogbookDelivery, HttpLogbookDelivery, type LogbookDelivery } from "../logbook/delivery.js";
import { verifyIdentityToken } from "./identity.js";
import { demoStatus, startDemo } from "../demo/scenario.js";
import { AdresBronError, haalAdresKenmerken, zoekAdressen } from "../adres/pdok.js";
import {
  abortBody,
  awardBody,
  awardResponse,
  bidDraftBody,
  bidDraftResponse,
  bidParams,
  createListingBody,
  deliveryResponse,
  instanceKeyResponse,
  listingIdParams,
  listingListResponse,
  listingPublicResponse,
  logbookResponse,
  myBidResponse,
  proofResponse,
  receiptResponse,
  sealedBidBody,
  adresKenmerkenResponse,
  adresIdParams,
  adresSuggestieResponse,
  adresZoekQuery,
} from "./schemas.js";

const PORT = Number(process.env.CORE_PORT ?? 4000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
/**
 * Demo-instantie: zet zichzelf elk half uur terug en vult zichzelf met een
 * scenario. Staat standaard uit, want een instantie die echte biedingen draagt
 * mag zichzelf nooit wissen en haar core hoort nooit zelf te verzegelen.
 */
const DEMO_MODE = process.env.CORE_DEMO === "true";

/** Serverlog voor de beheerder. Zie `logging/logger.ts` voor wat er nooit in komt. */
const log = maakLogger("core");

// Standaard alleen de lokale demo-frontend. In productie moet dit expliciet
// naar het echte domein van de deployment wijzen: geen wildcard-CORS voor
// een API die met een bearer-token authenticeert.
const ALLOWED_ORIGINS = (process.env.CORE_ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Bezorgkanaal voor het biedlogboek (E4-S3). De core kent geen e-mailadressen;
 * alleen de identity-backend kan een pseudonieme sub terugvertalen naar een
 * adres. Zonder configuratie valt dit terug op een luide no-op, zodat een
 * instantie die het logboek feitelijk niet verstrekt dat ook laat merken.
 */
function buildDeliveryChannel(): LogbookDelivery {
  const endpoint = process.env.CORE_DELIVERY_ENDPOINT;
  const secret = process.env.DELIVERY_SHARED_SECRET;
  if (!endpoint || !secret) {
    if (IS_PRODUCTION) {
      log.warn(
        "CORE_DELIVERY_ENDPOINT of DELIVERY_SHARED_SECRET ontbreekt, biedlogboeken worden NIET automatisch verstrekt (E4-S3)",
      );
    }
    return new ConsoleLogbookDelivery();
  }
  return new HttpLogbookDelivery(endpoint, secret);
}

/**
 * De ondertekensleutel van deze instantie. Zonder `CORE_SIGNING_KEY` maakt de
 * core er een per start, en dan is een logboek dat gisteren gedownload is
 * vandaag niet meer te verifieren: de handtekening hoort dan bij een sleutel
 * die niet meer bestaat. Voor een instantie die blijft staan is dat geen
 * detail maar het verschil tussen bewijs en een bewering.
 *
 * Maak er een met:
 *   openssl genpkey -algorithm ed25519
 */
function buildKeypair(): InstanceKeypair {
  const pem = process.env.CORE_SIGNING_KEY;
  if (!pem?.trim()) {
    if (IS_PRODUCTION) {
      log.warn(
        "CORE_SIGNING_KEY ontbreekt, er is een tijdelijke sleutel gemaakt. Eerder verstrekte logboeken en " +
          "ontvangstbewijzen zijn na deze herstart niet meer te verifieren.",
      );
    }
    return new InstanceKeypair();
  }
  return new InstanceKeypair(pem);
}

/**
 * Waar de instantie haar biedingen bewaart. Zonder dit wist elke herstart de
 * woningen, de biedingen en de logboeken, en dan houdt een bieder een
 * ondertekend ontvangstbewijs vast voor iets wat niet meer bestaat.
 *
 * De demo-instantie is de uitzondering: die zet zichzelf elk half uur terug en
 * heeft niets te bewaren.
 */
function buildPersistence(): Persistence {
  if (DEMO_MODE) {
    log.info("DEMO-modus: niets wordt bewaard, de instantie begint elke ronde leeg");
    return new NoPersistence();
  }
  const path = process.env.CORE_DB_PATH?.trim() || "./data/openbod.db";
  if (path === ":memory:") {
    log.warn("CORE_DB_PATH=:memory:, dus deze instantie wist alle biedingen bij een herstart");
    return new NoPersistence();
  }
  log.info("biedingen worden bewaard", { pad: path });
  return new SqlitePersistence(path);
}

const persistence = buildPersistence();
export const store = new OpenBodStore(buildDeliveryChannel(), buildKeypair(), persistence);

/**
 * Netjes afsluiten bij een `docker compose down` of een reboot. Alles wat
 * bevestigd is, staat al op disk; dit zorgt er alleen voor dat de database
 * gesloten en opgeruimd achterblijft in plaats van dat de volgende start hem
 * uit het write-ahead log moet terughalen.
 */
for (const signaal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signaal, () => {
    persistence.close();
    process.exit(0);
  });
}

const app = Fastify({
  logger: false,
  bodyLimit: 256 * 1024, // ruim boven een biedpakket, ver onder een DoS-poging
  trustProxy: process.env.TRUST_PROXY === "true",
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});
await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
  // IP-gebaseerd: goed genoeg tegen een enkele misbruikende client voor de
  // MVP. Distributed abuse vraagt om een edge/WAF-laag, buiten deze scope.
});

/**
 * Elke response gaat door zijn zod-schema vóórdat hij verstuurd wordt.
 * `.parse` strip onbekende velden en gooit als een verplicht veld ontbreekt
 * of het verkeerde type heeft, dus een programmeerfout die per ongeluk een
 * intern veld (zoals `bidderSub`) zou lekken, faalt hard in plaats van
 * stilletjes de deur uit te gaan.
 */
function sendValidated<T>(reply: FastifyReply, schema: z.ZodType<T>, data: unknown, status = 200) {
  const validated = schema.parse(data);
  return reply.status(status).send(validated);
}

async function requireIdentity(req: FastifyRequest): Promise<string> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw Object.assign(new Error("ontbrekend identiteitstoken"), { statusCode: 401 });
  }
  try {
    const identity = await verifyIdentityToken(header.slice("Bearer ".length));
    return identity.sub;
  } catch {
    throw Object.assign(new Error("ongeldig of verlopen identiteitstoken"), { statusCode: 401 });
  }
}

function parseParamsOr400<T>(schema: z.ZodType<T>, params: unknown, reply: FastifyReply): T | undefined {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    reply.status(400).send({ error: "ongeldige URL-parameters" });
    return undefined;
  }
  return parsed.data;
}

app.post(
  "/listings",
  { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const parsed = createListingBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      const listing = store.createListing(parsed.data);
      return sendValidated(reply, listingPublicResponse, listing, 201);
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

app.get("/listings", async (_req, reply) => {
  // Een woning die nog niet gepubliceerd is, hoort niet in de publieke lijst:
  // de makelaar is hem aan het voorbereiden en er valt nog niet op te bieden.
  const listings = store
    .allListings()
    .filter((listing) => listing.status !== "aangemaakt")
    .map((listing) => publicListingView(listing.id));
  return sendValidated(reply, listingListResponse, listings);
});

/**
 * Draait deze instantie als demo? De frontend gebruikt dit om te tonen dat de
 * gegevens verzonnen zijn en wanneer alles wordt teruggezet. Een echte instantie
 * antwoordt hier `actief: false`, en dan verdwijnt die hele mededeling.
 */
app.get("/demo", async () => (DEMO_MODE ? demoStatus() : { actief: false }));

/**
 * Adressen zoeken in open overheidsbronnen (E1-S4), zodat een makelaar de
 * kenmerken niet overtypt uit de brochure van een ander. Strenger begrensd dan
 * de rest: hierachter zit een gratis publieke voorziening van PDOK, en die
 * hoort niet leeg te lopen door één instantie.
 */
app.get(
  "/adressen",
  { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const parsed = adresZoekQuery.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      return sendValidated(reply, adresSuggestieResponse, await zoekAdressen(parsed.data.q));
    } catch (err) {
      return handleAdresError(err, reply);
    }
  },
);

app.get(
  "/adressen/:adresId",
  { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const parsed = adresIdParams.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      return sendValidated(reply, adresKenmerkenResponse, await haalAdresKenmerken(parsed.data.adresId));
    } catch (err) {
      return handleAdresError(err, reply);
    }
  },
);

/**
 * Een bron die hapert mag het aanmaken van een woning niet blokkeren: de
 * frontend valt terug op handmatig invullen. Daarom 502 en geen 500, met een
 * boodschap die zegt wie er niet antwoordde.
 */
function handleAdresError(err: unknown, reply: FastifyReply) {
  if (err instanceof AdresBronError || (err instanceof Error && err.name === "TimeoutError")) {
    return reply.status(502).send({ error: "de adresbron is nu niet bereikbaar; vul de gegevens zelf in" });
  }
  return handleDomainError(err, reply);
}

app.get("/listings/:id", async (req, reply) => {
  const params = parseParamsOr400(listingIdParams, req.params, reply);
  if (!params) return;
  try {
    return sendValidated(reply, listingPublicResponse, publicListingView(params.id));
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

app.post(
  "/listings/:id/bids",
  { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(listingIdParams, req.params, reply);
    if (!params) return;
    const parsed = sealedBidBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      const sub = await requireIdentity(req);
      const receipt = store.placeBid(
        params.id,
        sub,
        parsed.data.commitment,
        parsed.data.ciphertext,
        parsed.data.identityEnvelope,
      );
      // Het concept heeft zijn werk gedaan en is nu het enige leesbare spoor van
      // een bod dat verder verzegeld is. Meteen weg.
      persistence.deleteDraft(params.id, sub);
      return sendValidated(reply, receiptResponse, receipt, 201);
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

app.patch(
  "/listings/:id/bids/:bidId",
  { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(bidParams, req.params, reply);
    if (!params) return;
    const parsed = sealedBidBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      const sub = await requireIdentity(req);
      const receipt = store.adjustBid(
        params.id,
        params.bidId,
        sub,
        parsed.data.commitment,
        parsed.data.ciphertext,
        parsed.data.identityEnvelope,
      );
      return sendValidated(reply, receiptResponse, receipt);
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

app.delete(
  "/listings/:id/bids/:bidId",
  { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(bidParams, req.params, reply);
    if (!params) return;
    try {
      const sub = await requireIdentity(req);
      store.withdrawBid(params.id, params.bidId, sub);
      return reply.status(204).send();
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

app.post(
  "/listings/:id/close",
  { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(listingIdParams, req.params, reply);
    if (!params) return;
    try {
      const listing = store.closeListing(params.id);
      return sendValidated(reply, listingPublicResponse, listing);
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

/**
 * Gunning. Geeft alleen de identiteitsenvelop van het gekozen bod terug: een
 * blob die deze server niet kan openen, want de sleutel ligt bij de verkoper.
 *
 * Bekende beperking van de MVP: er is nog geen verkopersrol, dus dit endpoint
 * controleert alleen dát je ingelogd bent, niet dát je de verkoper bent. Dat is
 * hier minder erg dan het lijkt, want wie geen sleutel heeft krijgt een envelop
 * die hij niet kan lezen, en de gunning zelf staat onuitwisbaar in het logboek.
 * Een echte instantie hoort hier bezit van de private sleutel te laten bewijzen.
 */
app.post(
  "/listings/:id/award",
  { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(listingIdParams, req.params, reply);
    if (!params) return;
    const parsed = awardBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      await requireIdentity(req);
      return sendValidated(reply, awardResponse, store.awardListing(params.id, parsed.data.bidId));
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

/**
 * Een voorbereide woning openstellen voor biedingen. Vanaf hier begint de keten
 * en liggen de spelregels vast.
 *
 * Zelfde MVP-beperking als bij `/award`: dit endpoint controleert dát je
 * ingelogd bent, niet dát je de verkoper of diens makelaar bent.
 */
app.post(
  "/listings/:id/publish",
  { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(listingIdParams, req.params, reply);
    if (!params) return;
    try {
      await requireIdentity(req);
      return sendValidated(reply, listingPublicResponse, store.publishListing(params.id));
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

/**
 * E7-S2: de procedure is buiten dit systeem om afgehandeld (ingetrokken,
 * onderhands verkocht, teruggetrokken van de markt). Dit dwingt een eindstatus
 * met opgegeven reden af en zet de automatische verstrekking van het logboek in
 * gang, zodat bieders van een afgebroken inschrijving niet in het ongewisse
 * blijven, een van de klachten uit het VEH-meldpunt.
 *
 * Zelfde MVP-beperking als bij `/award`: dit endpoint controleert dát je
 * ingelogd bent, niet dát je de verkoper of diens makelaar bent.
 */
app.post(
  "/listings/:id/abort",
  { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(listingIdParams, req.params, reply);
    if (!params) return;
    const parsed = abortBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      await requireIdentity(req);
      return sendValidated(reply, logbookResponse, store.abortListing(params.id, parsed.data.reason));
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

/**
 * Bewijs dat het logboek daadwerkelijk automatisch is verstuurd, met alleen
 * pseudonieme refs. Publiek opvraagbaar: juist een bieder die beweert niets te
 * hebben gekregen moet kunnen laten zien wat de instantie hierover claimt, en
 * de bijbehorende `logboek_verstuurd`-regel staat in de keten (I14).
 */
app.get("/listings/:id/delivery", async (req, reply) => {
  const params = parseParamsOr400(listingIdParams, req.params, reply);
  if (!params) return;
  try {
    const delivery = store.logbookDelivery(params.id);
    if (!delivery) return reply.status(404).send({ error: "logboek is nog niet verstuurd" });
    return sendValidated(reply, deliveryResponse, delivery);
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

/**
 * Het eigen concept ophalen, bewaren en weggooien.
 *
 * Uitsluitend het eigen concept: de sub komt uit het token en nooit uit de URL,
 * dus er is geen manier om dat van een ander op te vragen. Er is met opzet ook
 * geen endpoint dat telt hoeveel concepten er voor een woning klaarstaan. Dat
 * getal zou een makelaar precies vertellen hoeveel belangstelling er is voordat
 * de inschrijving sluit, en dat is de informatievoorsprong die dit project
 * afschaft.
 */
app.get("/listings/:id/draft", async (req, reply) => {
  const params = parseParamsOr400(listingIdParams, req.params, reply);
  if (!params) return;
  try {
    const sub = await requireIdentity(req);
    const stored = persistence.loadDraft(params.id, sub);
    if (!stored) return reply.status(404).send({ error: "geen concept van deze bieder" });
    return sendValidated(reply, bidDraftResponse, {
      ...(JSON.parse(stored.json) as unknown as Record<string, unknown>),
      savedAt: stored.savedAt,
    });
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

app.put(
  "/listings/:id/draft",
  { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const params = parseParamsOr400(listingIdParams, req.params, reply);
    if (!params) return;
    const parsed = bidDraftBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    try {
      const sub = await requireIdentity(req);
      // De woning moet bestaan; een concept voor niets bewaren maakt van dit
      // endpoint een gratis opslagplek.
      store.getListing(params.id);
      persistence.saveDraft(params.id, sub, JSON.stringify(parsed.data));
      return reply.status(204).send();
    } catch (err) {
      return handleDomainError(err, reply);
    }
  },
);

app.delete("/listings/:id/draft", async (req, reply) => {
  const params = parseParamsOr400(listingIdParams, req.params, reply);
  if (!params) return;
  try {
    const sub = await requireIdentity(req);
    persistence.deleteDraft(params.id, sub);
    return reply.status(204).send();
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

app.get("/listings/:id/my-bid", async (req, reply) => {
  const params = parseParamsOr400(listingIdParams, req.params, reply);
  if (!params) return;
  try {
    const sub = await requireIdentity(req);
    const receipt = store.receiptForBidder(params.id, sub);
    if (!receipt) return reply.status(404).send({ error: "geen lopend bod van deze bieder" });
    const sealed = store.activeBidFor(params.id, sub)!;
    return sendValidated(reply, myBidResponse, {
      ...receipt,
      version: sealed.version,
      createdAt: sealed.createdAt,
      updatedAt: sealed.updatedAt,
    });
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

app.get("/listings/:id/logbook", async (req, reply) => {
  const params = parseParamsOr400(listingIdParams, req.params, reply);
  if (!params) return;
  try {
    return sendValidated(reply, logbookResponse, store.getLogbook(params.id));
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

app.get("/listings/:id/proof/:bidId", async (req, reply) => {
  const params = parseParamsOr400(bidParams, req.params, reply);
  if (!params) return;
  try {
    return sendValidated(reply, proofResponse, store.getProof(params.id, params.bidId));
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

app.get("/listings/:id/instance-key", async (req, reply) => {
  const params = parseParamsOr400(listingIdParams, req.params, reply);
  if (!params) return;
  try {
    store.getListing(params.id);
    return sendValidated(reply, instanceKeyResponse, { publicKeyPem: store.keypair.publicKeyPem() });
  } catch (err) {
    return handleDomainError(err, reply);
  }
});

function publicListingView(id: string) {
  const listing = store.getListing(id);
  return {
    ...listing,
    askingPrice: listing.prijsVorm === "vraagprijs" ? listing.askingPrice : undefined,
    bidCount: listing.rules.aantalBiedingenZichtbaar ? store.bidCount(id) : undefined,
  };
}

function handleDomainError(err: unknown, reply: FastifyReply) {
  if (err instanceof ListingNotFoundError) return reply.status(404).send({ error: err.message });
  if (err instanceof InvalidTransitionError) return reply.status(409).send({ error: err.message });
  if (err instanceof RuleViolationError) return reply.status(422).send({ error: err.message });
  if (err instanceof Error && "statusCode" in err) {
    return reply.status((err as Error & { statusCode: number }).statusCode).send({ error: err.message });
  }
  // Nooit de ruwe fout (met stack trace of interne details) naar de client.
  app.log.error(err);
  log.error("interne fout", { fout: String(err) });
  return reply.status(500).send({ error: "interne fout" });
}

app.setErrorHandler((err: FastifyError, _req, reply) => {
  // Vangt ook fouten buiten de route-handlers om (bodyLimit, rate-limit
  // interne fouten, JSON-parsefouten), altijd zonder details te lekken.
  if (err.statusCode && err.statusCode < 500) {
    return reply.status(err.statusCode).send({ error: err.message });
  }
  log.error("interne fout", { fout: String(err) });
  return reply.status(500).send({ error: "interne fout" });
});

/**
 * E3-S1 en E4-S3: automatische onthulling op de deadline en automatische
 * verstrekking van het logboek zodra de procedure een eindstatus bereikt,
 * beide zonder dat een bieder ergens om hoeft te vragen. Een productie-instantie
 * doet dit met een betrouwbare scheduler/queue; voor de MVP-demo volstaat een
 * korte polling-lus. Beide store-methodes zijn idempotent, dus herhaald
 * aanroepen levert geen dubbele logregels op.
 */
setInterval(() => {
  void tick();
}, 2000);

async function tick() {
  for (const listing of store.allListings()) {
    // De lus houdt een momentopname vast en doet er met await's tijd over. In
    // demo-modus kan de instantie zichzelf ondertussen terugzetten, en dan
    // bestaat deze woning niet meer. Dat is geen fout maar een race, en zeker
    // geen reden om de hele instantie te laten crashen.
    try {
      store.getListing(listing.id);
    } catch {
      continue;
    }
    if (listing.status === "biedfase" && new Date(listing.deadline).getTime() <= Date.now()) {
      store.closeListing(listing.id);
    }
    if (listing.status === "gesloten") {
      try {
        await store.revealListing(listing.id);
        log.info("woning automatisch onthuld", { listingId: listing.id });
      } catch (err) {
        log.warn("onthulling mislukt, wordt opnieuw geprobeerd", { listingId: listing.id, fout: String(err) });
      }
    }
    const isEindstatus = listing.status === "onherroepelijk" || listing.status === "buiten_procedure";
    if (isEindstatus && !store.logbookDelivery(listing.id)) {
      try {
        const delivery = await store.deliverLogbook(listing.id);
        log.info("biedlogboek verstuurd", { listingId: listing.id, ontvangers: delivery.recipientRefs.length });
      } catch (err) {
        log.warn("versturen van logboek mislukt, wordt opnieuw geprobeerd", { listingId: listing.id, fout: String(err) });
      }
    }
  }
}

if (DEMO_MODE) {
  log.info("DEMO-modus: de instantie vult zichzelf en wist zichzelf elk half uur");
  startDemo(store);
}

if (IS_PRODUCTION && ALLOWED_ORIGINS.includes("http://localhost:5173") && ALLOWED_ORIGINS.length === 1) {
  log.warn("NODE_ENV=production maar CORE_ALLOWED_ORIGINS is niet gezet, dev-default wordt gebruikt");
}

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    log.fatal("kan niet starten", { fout: String(err) });
    process.exit(1);
  }
  log.info("luistert", { adres: address, logniveau: log.niveau });
});
