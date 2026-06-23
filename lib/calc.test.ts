import { describe, it, expect } from "vitest";
import { calcular, HSP_FALLBACK, type CalcConstants } from "./calc";

// Constantes reales sembradas (config_parametros).
const K: CalcConstants = {
  pr: 0.77,
  wpPanel: 600,
  costoKwpMin: 14000,
  costoKwpMax: 17500,
};
const PRECIO_RESIDENCIAL = 4.004; // excedente Tarifa 1

describe("calcular", () => {
  it("dimensiona a partir de consumo (residencial, HSP 5.9)", () => {
    const r = calcular(
      { consumoKwhMes: 300, hsp: 5.9, precioKwh: PRECIO_RESIDENCIAL },
      K,
    );
    expect(r.consumoKwhMes).toBe(300);
    expect(r.kwp).toBeCloseTo(2.2, 1);
    expect(r.paneles).toBe(4); // ceil(2201/600)
    expect(r.produccionAnualKwh).toBeGreaterThan(3000);
    expect(r.inversionMin).toBeLessThan(r.inversionMax);
    expect(r.inversionProm).toBeCloseTo((r.inversionMin + r.inversionMax) / 2, 0);
    expect(r.paybackAnios).toBeGreaterThan(0);
    expect(r.paybackAnios).toBeLessThan(10);
  });

  it("deriva el consumo desde el recibo cuando no se da consumo", () => {
    const soloRecibo = calcular(
      { reciboMxn: 300 * PRECIO_RESIDENCIAL, hsp: 5.9, precioKwh: PRECIO_RESIDENCIAL },
      K,
    );
    expect(soloRecibo.consumoKwhMes).toBeCloseTo(300, 0);
  });

  it("usa HSP fallback (5.9) cuando no se provee HSP", () => {
    const sinHsp = calcular(
      { consumoKwhMes: 300, precioKwh: PRECIO_RESIDENCIAL },
      K,
    );
    expect(sinHsp.hsp).toBe(HSP_FALLBACK);
  });

  it("ahorro conservador: no excede el consumo anual", () => {
    // Consumo bajo → producción podría superar consumo; el ahorro se topa.
    const r = calcular(
      { consumoKwhMes: 100, hsp: 6.5, precioKwh: PRECIO_RESIDENCIAL },
      K,
    );
    const ahorroMaxTeorico = 100 * 12 * PRECIO_RESIDENCIAL;
    expect(r.ahorroAnualMxn).toBeLessThanOrEqual(ahorroMaxTeorico + 0.01);
  });

  it("tarifa comercial (PDBT, menor precio) → mayor payback que residencial", () => {
    const base = { consumoKwhMes: 500, hsp: 5.9 };
    const resid = calcular({ ...base, precioKwh: 4.004 }, K);
    const pdbt = calcular({ ...base, precioKwh: 3.771 }, K);
    expect(pdbt.paybackAnios).toBeGreaterThan(resid.paybackAnios);
  });

  it("lanza si no hay consumo ni recibo", () => {
    expect(() =>
      calcular({ hsp: 5.9, precioKwh: PRECIO_RESIDENCIAL }, K),
    ).toThrow();
  });

  it("lanza con precioKwh inválido", () => {
    expect(() => calcular({ consumoKwhMes: 300, precioKwh: 0 }, K)).toThrow();
  });
});
