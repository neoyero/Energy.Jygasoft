import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("permite hasta `max` solicitudes en la ventana y luego bloquea", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000, maxEntries: 100 });
    const ip = "1.2.3.4";
    expect(rl.check(ip, 0).allowed).toBe(true);
    expect(rl.check(ip, 10).allowed).toBe(true);
    expect(rl.check(ip, 20).allowed).toBe(true);
    const fourth = rl.check(ip, 30);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("reinicia el contador al pasar la ventana", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 1000, maxEntries: 100 });
    const ip = "1.2.3.4";
    rl.check(ip, 0);
    rl.check(ip, 100);
    expect(rl.check(ip, 200).allowed).toBe(false);
    // Pasada la ventana se reinicia.
    expect(rl.check(ip, 1200).allowed).toBe(true);
  });

  it("aísla el conteo por clave (IP)", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000, maxEntries: 100 });
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("a", 1).allowed).toBe(false);
    expect(rl.check("b", 1).allowed).toBe(true);
  });

  it("expone remaining y resetAt coherentes", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 1000, maxEntries: 100 });
    const first = rl.check("x", 500);
    expect(first.remaining).toBe(1);
    expect(first.resetAt).toBe(1500);
  });

  it("evicta entradas viejas al exceder maxEntries (LRU)", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 10_000, maxEntries: 2 });
    rl.check("a", 0);
    rl.check("b", 0);
    rl.check("c", 0); // evicta "a"
    // "a" fue evictada → vuelve a permitir como nueva.
    expect(rl.check("a", 1).allowed).toBe(true);
  });
});
