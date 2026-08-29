import type { Logbook } from "./logbook.js";

/**
 * Automatische verstrekking van het biedlogboek (E4-S3).
 *
 * Waarom dit een aparte naad is en geen mailer in de core: de core kent geen
 * e-mailadressen en hoort ze ook niet te kennen. Zij kent alleen pseudonieme
 * subjects (`sub`) uit het identiteitstoken. Alleen de identity-backend kan een
 * sub weer aan een adres koppelen. De core stuurt dus een bezorgopdracht ("dit
 * logboek naar deze subjects") en leert zelf nooit naar wie het ging. Dat
 * houdt de scheiding uit ARCHITECTURE.md §5 intact terwijl het logboek toch
 * vanzelf aankomt in plaats van opgevraagd te moeten worden.
 */
export interface DeliveryRequest {
  listingId: string;
  /** Pseudonieme subjects van de betrokkenen (bieders plus, indien bekend, de verkoper). */
  recipients: string[];
  logbook: Logbook;
}

export interface LogbookDelivery {
  deliver(request: DeliveryRequest): Promise<void>;
}

/**
 * Bezorging via de identity-backend, die als enige sub naar adres kan
 * terugvertalen. Het gedeelde geheim is nodig omdat dit endpoint anders een
 * gratis "van wie is deze sub"-orakel zou zijn voor iedereen die het kan
 * bereiken.
 */
export class HttpLogbookDelivery implements LogbookDelivery {
  constructor(
    private readonly endpoint: string,
    private readonly sharedSecret: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async deliver(request: DeliveryRequest): Promise<void> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-delivery-secret": this.sharedSecret,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`bezorging mislukt: identity-backend antwoordde ${res.status}`);
    }
  }
}

/**
 * Fallback voor lokaal draaien en tests: schrijft naar de console in plaats van
 * te versturen. Bewust luid, want een instantie die dit in productie gebruikt
 * verstrekt het logboek feitelijk niet en voldoet dus niet aan E4-S3.
 */
export class ConsoleLogbookDelivery implements LogbookDelivery {
  async deliver(request: DeliveryRequest): Promise<void> {
    console.warn(
      `[core] GEEN bezorgkanaal geconfigureerd: logboek van listing ${request.listingId} ` +
        `(root ${request.logbook.rootHash.slice(0, 12)}...) zou naar ${request.recipients.length} ` +
        `betrokkene(n) gaan. Zet CORE_DELIVERY_ENDPOINT om het echt te versturen.`,
    );
  }
}
