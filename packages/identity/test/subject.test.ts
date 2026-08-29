import { describe, it, expect } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import {
  WeakPepperError,
  deriveSubject,
  loadSubjectPepper,
  normalizeEmail,
  subjectsEqual,
} from "../src/subject.js";

const PEPPER = randomBytes(32);
const EMAIL = "alice@example.nl";

describe("Pseudoniem subject (protocol.md §7, I11)", () => {
  it("is deterministisch, zodat dezelfde bieder zijn biedingen houdt", () => {
    expect(deriveSubject(EMAIL, PEPPER)).toBe(deriveSubject(EMAIL, PEPPER));
  });

  it("normaliseert het adres, zodat één persoon niet twee identiteiten krijgt", () => {
    expect(normalizeEmail("  Alice@Example.NL ")).toBe(EMAIL);
    expect(deriveSubject("  Alice@Example.NL ", PEPPER)).toBe(deriveSubject(EMAIL, PEPPER));
  });

  it("geeft verschillende adressen verschillende subjects", () => {
    expect(deriveSubject(EMAIL, PEPPER)).not.toBe(deriveSubject("bob@example.nl", PEPPER));
  });

  /**
   * De kern. Dit is de test die de claim "de core kent geen e-mailadressen"
   * draagt. Zonder pepper was `sub` gelijk aan `sha256(adres)`, en dan kan een
   * operator met een lijst kandidaat-adressen simpelweg naraden wie er achter
   * elke sub zit. Hier faalt precies die aanval.
   */
  it("(beveiliging) is niet te raden uit het adres zonder de pepper", () => {
    const sub = deriveSubject(EMAIL, PEPPER);

    // De naïeve gok: gewoon het adres hashen.
    expect(sub).not.toBe(createHash("sha256").update(EMAIL).digest("hex"));

    // Een woordenlijstaanval met de gebruikelijke varianten levert niets op.
    const kandidaten = [
      EMAIL,
      "Alice@example.nl",
      "alice.jansen@example.nl",
      "a.jansen@example.nl",
      "alice@gmail.com",
    ];
    for (const kandidaat of kandidaten) {
      expect(createHash("sha256").update(kandidaat).digest("hex")).not.toBe(sub);
      expect(createHash("sha256").update(normalizeEmail(kandidaat)).digest("hex")).not.toBe(sub);
    }

    // Zelfs met het juiste adres én de juiste constructie faalt het met een
    // verkeerde pepper. Alleen het geheim van deze backend opent de koppeling.
    expect(deriveSubject(EMAIL, randomBytes(32))).not.toBe(sub);
  });

  it("(beveiliging) weigert een ontbrekende pepper in productie", () => {
    expect(() => loadSubjectPepper({ NODE_ENV: "production" })).toThrow(WeakPepperError);
  });

  it("(beveiliging) weigert een te korte pepper", () => {
    expect(() => loadSubjectPepper({ IDENTITY_SUBJECT_PEPPER: "kort" })).toThrow(WeakPepperError);
  });

  it("valt buiten productie terug op een vluchtige pepper in plaats van op niets", () => {
    const eerste = loadSubjectPepper({});
    const tweede = loadSubjectPepper({});
    expect(eerste).toHaveLength(32);
    // Vluchtig betekent ook: per start anders. Dat staat zo in de README.
    expect(eerste.equals(tweede)).toBe(false);
  });

  it("vergelijkt subjects zonder via de looptijd te lekken", () => {
    const sub = deriveSubject(EMAIL, PEPPER);
    expect(subjectsEqual(sub, sub)).toBe(true);
    expect(subjectsEqual(sub, deriveSubject("bob@example.nl", PEPPER))).toBe(false);
    expect(subjectsEqual(sub, "korter")).toBe(false);
  });
});
