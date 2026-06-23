import { describe, it, expect } from "vitest";
import { sign, verify } from "./hmac";

const SECRET = "test_shared_secret_0123456789abcdef";
const BODY = JSON.stringify({ evento: "lead.created", request_id: "abc" });

describe("hmac.sign", () => {
  it("produce el formato sha256=<hex de 64 chars>", () => {
    const ts = "1700000000000";
    const sig = sign(BODY, ts, SECRET);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("es determinista para los mismos insumos", () => {
    const ts = "1700000000000";
    expect(sign(BODY, ts, SECRET)).toBe(sign(BODY, ts, SECRET));
  });

  it("cambia si cambia el body, el ts o el secret", () => {
    const ts = "1700000000000";
    const base = sign(BODY, ts, SECRET);
    expect(sign(BODY + "x", ts, SECRET)).not.toBe(base);
    expect(sign(BODY, "1700000000001", SECRET)).not.toBe(base);
    expect(sign(BODY, ts, SECRET + "x")).not.toBe(base);
  });
});

describe("hmac.verify", () => {
  const now = 1700000000000;

  it("acepta una firma válida dentro de la ventana", () => {
    const ts = String(now);
    const sig = sign(BODY, ts, SECRET);
    expect(verify(BODY, ts, sig, SECRET, { now })).toBe(true);
  });

  it("rechaza una firma inválida (tamper en body)", () => {
    const ts = String(now);
    const sig = sign(BODY, ts, SECRET);
    expect(verify(BODY + "tamper", ts, sig, SECRET, { now })).toBe(false);
  });

  it("rechaza una firma con secret incorrecto", () => {
    const ts = String(now);
    const sig = sign(BODY, ts, SECRET);
    expect(verify(BODY, ts, sig, "otro_secret", { now })).toBe(false);
  });

  it("rechaza por replay: timestamp más viejo que la ventana (5 min)", () => {
    const oldTs = String(now - 6 * 60_000);
    const sig = sign(BODY, oldTs, SECRET);
    expect(verify(BODY, oldTs, sig, SECRET, { now })).toBe(false);
  });

  it("acepta un timestamp dentro de la ventana (4 min)", () => {
    const ts = String(now - 4 * 60_000);
    const sig = sign(BODY, ts, SECRET);
    expect(verify(BODY, ts, sig, SECRET, { now })).toBe(true);
  });

  it("rechaza timestamps en el futuro fuera de tolerancia", () => {
    const ts = String(now + 6 * 60_000);
    const sig = sign(BODY, ts, SECRET);
    expect(verify(BODY, ts, sig, SECRET, { now })).toBe(false);
  });

  it("rechaza entradas malformadas sin lanzar", () => {
    expect(verify(BODY, "no-numero", "sha256=zz", SECRET, { now })).toBe(false);
    expect(verify(BODY, String(now), "formato-malo", SECRET, { now })).toBe(false);
    expect(verify(BODY, String(now), "", SECRET, { now })).toBe(false);
  });
});
