/**
 * Instelbaar logniveau, met een grens die niet instelbaar is.
 *
 * `LOG_LEVEL` bepaalt hoeveel er in het serverlog komt. Wat er níet in komt,
 * bepaalt niemand: gevoelige velden worden op elk niveau weggelaten, ook op het
 * laagste. Dat is hier geen nette gewoonte maar noodzaak. Sinds een concept
 * serverzijdig bewaard wordt, staat in een request body het bedrag in leesbare
 * vorm, plus naam, contact en motivatie. Een debug-stand die bodies wegschrijft,
 * zou de hele belofte via het logbestand omzeilen.
 *
 * Vandaar dat deze logger geen object slikt dat je zomaar uit een request haalt:
 * de context is een platte verzameling waarden die je bewust kiest, en sleutels
 * die naar gevoelige inhoud rieken worden alsnog vervangen. Een verbodslijst is
 * zwakker dan een toelatingslijst, dus er staat een test op (`logging.test.ts` in de core)
 * die vastlegt wat er nooit doorheen mag.
 *
 * Dit is het serverlog voor de beheerder, niet het biedlogboek.
 *
 * De core heeft een eigen kopie van dit bestand (`core/src/logging/logger.ts`).
 * Bewust: deze backend hoort niet van de biedcore af te hangen
 * (ARCHITECTURE.md §5), en vijftig regels niveaufiltering zijn dat koppelstuk
 * niet waard. Houd de verbodslijst in beide gelijk.
 */

export const NIVEAUS = ["silly", "trace", "debug", "info", "warn", "error", "fatal"] as const;
export type Niveau = (typeof NIVEAUS)[number];

/**
 * Sleutels waarvan de waarde nooit in het log komt, op geen enkel niveau.
 * Vergelijking gebeurt op kleine letters en op deelstring, zodat `bidAmount` en
 * `draftJson` ook geraakt worden.
 */
const VERBODEN = [
  "amount",
  "bedrag",
  "motivation",
  "motivatie",
  "biddername",
  "biddercontact",
  "naam",
  "contact",
  "email",
  "mail",
  "token",
  "secret",
  "geheim",
  "pepper",
  "key",
  "sleutel",
  "jwk",
  "pem",
  "commitment",
  "ciphertext",
  "envelope",
  "envelop",
  "salt",
  "body",
  "payload",
  "json",
  "draft",
  "concept",
  "password",
  "wachtwoord",
  "authorization",
  "cookie",
];

/** Eén logregel mag niet ontsporen in lengte; een afgekapte waarde is genoeg om te zoeken. */
const MAX_LENGTE = 200;

export type Context = Record<string, string | number | boolean | undefined>;

export interface Logger {
  silly(bericht: string, context?: Context): void;
  trace(bericht: string, context?: Context): void;
  debug(bericht: string, context?: Context): void;
  info(bericht: string, context?: Context): void;
  warn(bericht: string, context?: Context): void;
  error(bericht: string, context?: Context): void;
  fatal(bericht: string, context?: Context): void;
  /** Het actieve niveau, zodat een aanroeper duur werk kan overslaan. */
  readonly niveau: Niveau;
}

/**
 * Leest `LOG_LEVEL`. Een getal 0 tot en met 6 werkt, en de naam ook, want
 * `LOG_LEVEL=debug` is leesbaarder in een .env dan `LOG_LEVEL=2`. Onzin erin
 * betekent terugvallen op de standaard en dat één keer zeggen, in plaats van
 * stil op een ander niveau draaien dan de beheerder denkt.
 */
export function leesNiveau(waarde = process.env.LOG_LEVEL, productie = process.env.NODE_ENV === "production"): Niveau {
  const standaard: Niveau = productie ? "info" : "debug";
  const ruw = waarde?.trim().toLowerCase();
  if (!ruw) return standaard;

  const index = Number(ruw);
  if (Number.isInteger(index) && index >= 0 && index < NIVEAUS.length) return NIVEAUS[index];
  if ((NIVEAUS as readonly string[]).includes(ruw)) return ruw as Niveau;

  console.warn(
    `[log] LOG_LEVEL="${waarde}" is geen geldig niveau. Gebruik 0 tot en met 6 of ` +
      `${NIVEAUS.join(", ")}. Er wordt gelogd op "${standaard}".`,
  );
  return standaard;
}

export function schoon(context: Context): Context {
  const uit: Context = {};
  for (const [sleutel, waarde] of Object.entries(context)) {
    if (waarde === undefined) continue;
    const klein = sleutel.toLowerCase();
    if (VERBODEN.some((v) => klein.includes(v))) {
      uit[sleutel] = "[weggelaten]";
      continue;
    }
    uit[sleutel] =
      typeof waarde === "string" && waarde.length > MAX_LENGTE ? `${waarde.slice(0, MAX_LENGTE)}…` : waarde;
  }
  return uit;
}

function formatteer(context?: Context): string {
  if (!context) return "";
  const schoongemaakt = schoon(context);
  const paren = Object.entries(schoongemaakt).map(([k, v]) => `${k}=${v}`);
  return paren.length ? ` ${paren.join(" ")}` : "";
}

/**
 * @param naam komt vooraan elke regel, zodat core en identity in één
 * containerlog uit elkaar te houden zijn.
 */
export function maakLogger(naam: string, niveau: Niveau = leesNiveau()): Logger {
  const drempel = NIVEAUS.indexOf(niveau);

  function schrijf(eigen: Niveau, bericht: string, context?: Context) {
    if (NIVEAUS.indexOf(eigen) < drempel) return;
    const regel = `[${naam}] ${eigen.toUpperCase()} ${bericht}${formatteer(context)}`;
    if (eigen === "error" || eigen === "fatal") console.error(regel);
    else if (eigen === "warn") console.warn(regel);
    else console.log(regel);
  }

  return {
    niveau,
    silly: (b, c) => schrijf("silly", b, c),
    trace: (b, c) => schrijf("trace", b, c),
    debug: (b, c) => schrijf("debug", b, c),
    info: (b, c) => schrijf("info", b, c),
    warn: (b, c) => schrijf("warn", b, c),
    error: (b, c) => schrijf("error", b, c),
    fatal: (b, c) => schrijf("fatal", b, c),
  };
}
