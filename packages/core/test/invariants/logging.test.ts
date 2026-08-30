import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NIVEAUS, leesNiveau, maakLogger, schoon } from "../../src/logging/logger.js";

/**
 * Het serverlog mag geen achterdeur worden.
 *
 * Het niveau is instelbaar, de grens niet. Sinds een concept serverzijdig
 * bewaard wordt, staat in een request body het bedrag in leesbare vorm, plus
 * naam, contact en motivatie. Een debug-stand die dat wegschrijft zou de hele
 * belofte omzeilen via een bestand waar niemand naar kijkt tot het te laat is.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function vang(fn: () => void): string {
  const regels: string[] = [];
  const opvangen = (...args: unknown[]) => {
    regels.push(args.join(" "));
  };
  vi.spyOn(console, "log").mockImplementation(opvangen);
  vi.spyOn(console, "warn").mockImplementation(opvangen);
  vi.spyOn(console, "error").mockImplementation(opvangen);
  fn();
  return regels.join("\n");
}

describe("Serverlog: niveau instelbaar, de grens niet", () => {
  it("logt vanaf het ingestelde niveau en hoger, en daaronder niets", () => {
    const uit = vang(() => {
      const log = maakLogger("test", "info");
      log.silly("s");
      log.trace("t");
      log.debug("d");
      log.info("i");
      log.warn("w");
      log.error("e");
      log.fatal("f");
    });

    expect(uit).not.toMatch(/SILLY|TRACE|DEBUG/);
    expect(uit).toMatch(/INFO/);
    expect(uit).toMatch(/WARN/);
    expect(uit).toMatch(/ERROR/);
    expect(uit).toMatch(/FATAL/);
  });

  it("accepteert een cijfer en een naam, en valt bij onzin terug op de standaard", () => {
    expect(leesNiveau("2", true)).toBe("debug");
    expect(leesNiveau("3", true)).toBe("info");
    expect(leesNiveau("debug", true)).toBe("debug");
    expect(leesNiveau("  WARN ", true)).toBe("warn");
    expect(leesNiveau(undefined, true)).toBe("info");
    expect(leesNiveau(undefined, false)).toBe("debug");

    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(leesNiveau("99", true)).toBe("info");
    expect(leesNiveau("onzin", true)).toBe("info");
  });

  it("laat gevoelige velden weg, op elk niveau, ook het laagste", () => {
    const gevoelig = {
      amount: 512345.67,
      bidAmount: 1,
      motivation: "Wij willen hier graag oud worden",
      bidderName: "A. de Vries",
      bidderContact: "06-12345678",
      email: "koper@example.nl",
      token: "3f9a-c21",
      commitment: "fdd5f9",
      ciphertext: "age-encryption",
      identityEnvelope: "abc",
      draftJson: '{"amount":512345.67}',
      subjectPepper: "geheim",
      authorization: "Bearer x",
    };

    for (const niveau of NIVEAUS) {
      const uit = vang(() => maakLogger("test", niveau).fatal("poging", gevoelig));
      for (const waarde of ["512345", "oud worden", "de Vries", "06-12345678", "koper@example.nl", "3f9a", "fdd5f9", "age-encryption", "Bearer"]) {
        expect(uit, `niveau ${niveau} lekte "${waarde}"`).not.toContain(waarde);
      }
      expect(uit).toContain("[weggelaten]");
    }
  });

  it("laat onschuldige velden wel door, anders is het log nutteloos", () => {
    const uit = vang(() =>
      maakLogger("test", "silly").info("woning onthuld", { listingId: "586460f6", ontvangers: 3, geslaagd: true }),
    );
    expect(uit).toContain("listingId=586460f6");
    expect(uit).toContain("ontvangers=3");
    expect(uit).toContain("geslaagd=true");
  });

  it("kapt lange waarden af, zodat een logregel niet ontspoort", () => {
    const lang = "x".repeat(5_000);
    expect(schoon({ adres: lang }).adres).toHaveLength(201);
  });

  /**
   * De verbodslijst staat twee keer in de repo, in de core en in identity, want
   * identity hoort niet van de biedcore af te hangen (ARCHITECTURE.md §5). Dan
   * moet wel bewaakt worden dat ze niet uit elkaar lopen.
   */
  it("houdt de verbodslijst van core en identity gelijk", () => {
    const lijst = (pad: string) =>
      /const VERBODEN = \[([\s\S]*?)\];/.exec(readFileSync(pad, "utf8"))?.[1].replace(/\s/g, "");
    const hier = dirname(fileURLToPath(import.meta.url));
    const core = lijst(join(hier, "../../src/logging/logger.ts"));
    const identity = lijst(join(hier, "../../../identity/src/logger.ts"));
    expect(core).toBeTruthy();
    expect(identity).toBe(core);
  });
});
