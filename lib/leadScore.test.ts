import { describe, it, expect } from "vitest";
import { scoreLead, UMBRAL_CALIENTE } from "./leadScore";

describe("scoreLead", () => {
  it("lead vacío puntúa bajo pero suma rangoNoRechazado", () => {
    const r = scoreLead({});
    expect(r.score).toBe(10); // rango no rechazado por defecto
    expect(r.caliente).toBe(false);
  });

  it("lead completo con intención es caliente", () => {
    const r = scoreLead({
      segmento: "residencial",
      uso: "residencial",
      cp: "20120",
      consumoKwhMes: 350,
      reciboUrl: "https://x/recibo.jpg",
      esTitular: true,
      esPropietario: true,
      intencionAgenda: true,
    });
    expect(r.score).toBeGreaterThanOrEqual(UMBRAL_CALIENTE);
    expect(r.caliente).toBe(true);
  });

  it("la foto del recibo suma puntos extra sobre solo consumo", () => {
    const base = { segmento: "negocio", consumoKwhMes: 500 };
    const sinFoto = scoreLead(base);
    const conFoto = scoreLead({ ...base, reciboUrl: "https://x/r.jpg" });
    expect(conFoto.score).toBeGreaterThan(sinFoto.score);
  });

  it("CP inválido no suma", () => {
    const conCp = scoreLead({ cp: "20120" });
    const cpMalo = scoreLead({ cp: "ABC" });
    expect(conCp.score).toBeGreaterThan(cpMalo.score);
  });

  it("rango rechazado resta la bonificación de rango", () => {
    const ok = scoreLead({ segmento: "residencial" });
    const rechazado = scoreLead({ segmento: "residencial", rangoRechazado: true });
    expect(rechazado.score).toBeLessThan(ok.score);
  });
});
