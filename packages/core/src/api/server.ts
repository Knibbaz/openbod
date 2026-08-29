import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import {
  OpenBodStore,
  ListingNotFoundError,
  InvalidTransitionError,
  RuleViolationError,
} from "../store.js";
import { ConsoleLogbookDelivery, HttpLogbookDelivery, type LogbookDelivery } from "../logbook/delivery.js";
import { verifyIdentityToken } from "./identity.js";
import { demoStatus, startDemo } from "../demo/scenario.js";
import { AdresBronError, haalAdresKenmerken, zoekAdressen } from "../adres/pdok.js";
import {
  abortBody,
  awardBody,
  awardResponse,
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
      console.warn(
        "[core] WAARSCHUWING: CORE_DELIVERY_ENDPOINT of DELIVERY_SHARED_SECRET ontbreekt. " +
          "Biedlogboeken worden NIET automatisch verstrekt (E4-S3).",
      );
    }
    return new ConsoleLogbookDelivery();
  }
  return new HttpLogbookDelivery(endpoint, secret);
}

export const store = new OpenBodStore(buildDeliveryChannel());

const app = Fastify({
  logger: false,
  bodyLimit: 256 * 1024, // ruim boven een biedpakket, ver onder een DoS-poging
  trustProxy: process.env.TRUST_PROXY === "true",
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PATCH", "DELETE"],
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
  console.error(err);
  return reply.status(500).send({ error: "interne fout" });
}

app.setErrorHandler((err: FastifyError, _req, reply) => {
  // Vangt ook fouten buiten de route-handlers om (bodyLimit, rate-limit
  // interne fouten, JSON-parsefouten), altijd zonder details te lekken.
  if (err.statusCode && err.statusCode < 500) {
    return reply.status(err.statusCode).send({ error: err.message });
  }
  console.error(err);
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
        console.log(`[core] listing ${listing.id} automatisch onthuld`);
      } catch (err) {
        console.error(`[core] onthulling van ${listing.id} mislukt, probeer opnieuw`, err);
      }
    }
    const isEindstatus = listing.status === "onherroepelijk" || listing.status === "buiten_procedure";
    if (isEindstatus && !store.logbookDelivery(listing.id)) {
      try {
        const delivery = await store.deliverLogbook(listing.id);
        console.log(
          `[core] biedlogboek van ${listing.id} verstuurd naar ${delivery.recipientRefs.length} betrokkene(n)`,
        );
      } catch (err) {
        console.error(`[core] versturen van logboek ${listing.id} mislukt, probeer opnieuw`, err);
      }
    }
  }
}

if (DEMO_MODE) {
  console.log("[core] DEMO-modus: de instantie vult zichzelf en wist zichzelf elk half uur.");
  startDemo(store);
}

if (IS_PRODUCTION && ALLOWED_ORIGINS.includes("http://localhost:5173") && ALLOWED_ORIGINS.length === 1) {
  console.warn("[core] WAARSCHUWING: NODE_ENV=production maar CORE_ALLOWED_ORIGINS is niet gezet, gebruikt dev-default.");
}

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[core] luistert op ${address}`);
});
