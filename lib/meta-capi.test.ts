import { describe, it, expect } from "vitest";
import { buildUserData, sendCapiEvent } from "./meta-capi";

describe("buildUserData", () => {
  it("hashea email normalizado (lowercase/trim) a SHA-256 hex", () => {
    const a = buildUserData({ email: "  Test@Example.com " });
    const b = buildUserData({ email: "test@example.com" });
    expect(a.em).toEqual(b.em);
    expect((a.em as string[])[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normaliza teléfono a 10 dígitos con lada MX (52) y hashea", () => {
    const r = buildUserData({ phone: "449 123 4567" });
    const expectedSame = buildUserData({ phone: "4491234567" });
    expect(r.ph).toEqual(expectedSame.ph);
    expect((r.ph as string[])[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("incluye ip y user agent sin hashear", () => {
    const r = buildUserData({ clientIp: "1.2.3.4", userAgent: "UA" });
    expect(r.client_ip_address).toBe("1.2.3.4");
    expect(r.client_user_agent).toBe("UA");
  });
});

describe("sendCapiEvent", () => {
  it("se omite (skipped) si no hay pixel/token configurados", async () => {
    const r = await sendCapiEvent({ eventName: "Lead", eventId: "abc" });
    expect(r.skipped).toBe(true);
    expect(r.ok).toBe(false);
  });
});
