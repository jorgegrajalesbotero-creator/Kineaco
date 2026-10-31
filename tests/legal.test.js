import { describe, it, expect } from "vitest";
import { ageFrom, validateConsent, consentRecord, EMPTY_CONSENT, LEGAL_VERSION, MIN_AGE } from "@/lib/legal";

const Y = new Date().getFullYear();
const adultBD = `${Y - 30}-01-01`; // 30 años
const minorBD = `${Y - 15}-01-01`; // 15 años (>= MIN_AGE y < 18)
const childBD = `${Y - 5}-01-01`; //  5 años (< MIN_AGE)

describe("ageFrom", () => {
  it("calcula la edad cumplida", () => {
    expect(ageFrom(adultBD)).toBe(30);
  });
  it("devuelve null para vacío o fecha inválida", () => {
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom("texto")).toBeNull();
  });
});

describe("validateConsent", () => {
  it("exige fecha de nacimiento", () => {
    expect(validateConsent({ ...EMPTY_CONSENT })).toMatch(/fecha de nacimiento/i);
  });
  it(`rechaza menores de ${MIN_AGE} años`, () => {
    expect(validateConsent({ ...EMPTY_CONSENT, birthDate: childBD })).toMatch(/revise su fecha/i);
  });
  it("un adulto debe aceptar los términos", () => {
    expect(validateConsent({ ...EMPTY_CONSENT, birthDate: adultBD, terms: false })).toMatch(/términos/i);
    expect(validateConsent({ ...EMPTY_CONSENT, birthDate: adultBD, terms: true })).toBe("");
  });
  it("un menor necesita datos válidos del acudiente", () => {
    expect(validateConsent({ ...EMPTY_CONSENT, birthDate: minorBD, terms: true })).toMatch(/acudiente/i);
    const minorOk = {
      ...EMPTY_CONSENT,
      birthDate: minorBD,
      guardianName: "María Pérez",
      guardianDocNumber: "12345678",
      guardianEmail: "madre@mail.com",
      guardianAccept: true,
      terms: true,
    };
    expect(validateConsent(minorOk)).toBe("");
  });
});

describe("consentRecord", () => {
  it("adulto: sin datos de acudiente, versión vigente", () => {
    const r = consentRecord({ ...EMPTY_CONSENT, birthDate: adultBD, health: true }, "es");
    expect(r.is_minor).toBe(false);
    expect(r.guardian_name).toBeNull();
    expect(r.health_data_consent).toBe(true);
    expect(r.doc_version).toBe(LEGAL_VERSION);
    expect(r.language).toBe("es");
  });
  it("menor: marca is_minor y guarda al acudiente", () => {
    const r = consentRecord(
      { ...EMPTY_CONSENT, birthDate: minorBD, guardianName: "María Pérez", guardianDocNumber: "12345678", guardianEmail: "madre@mail.com", guardianAccept: true, terms: true },
      "en"
    );
    expect(r.is_minor).toBe(true);
    expect(r.guardian_name).toBe("María Pérez");
    expect(r.language).toBe("en");
  });
});
