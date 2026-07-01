"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, FolderKanban, TrendingUp, Percent, X, Download } from "lucide-react";

import { formatMXN, formatInt, toneToHex } from "@/lib/admin/format";
import type { MetricasData, VendedorOption } from "@/lib/admin/queries";
import { StatCard } from "@/components/admin/ui/stat-card";
import { ChartCard } from "@/components/admin/ui/chart-card";
import {
  LineChartMini,
  BarChartMini,
  DonutChart,
  type DonutDatum,
  type ChartDatum,
} from "@/components/admin/ui/charts";
import { labelFor, toneFor } from "@/components/admin/ui/status-badge";
import { cn } from "@/lib/utils";

/** Estado local de la barra de filtros (cadenas controladas por inputs). */
interface FiltrosUI {
  desde: string;
  hasta: string;
  vendedor: string;
}

export interface MetricasViewProps {
  data: MetricasData;
  vendedores: ReadonlyArray<VendedorOption>;
  /** Roles acotados (vendedor/preventa): se oculta el filtro de vendedor. */
  rolScoped: boolean;
  /** Valores iniciales tomados de los searchParams del servidor. */
  initial: { desde: string; hasta: string; vendedor: string };
}

const INPUT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground dark:placeholder:text-muted-foreground";

const SELECT_CLASS =
  "h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-700 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border dark:bg-input dark:text-foreground";

const LABEL_CLASS =
  "text-xs font-medium text-stone-500 dark:text-muted-foreground";

/** Construye el querystring a partir de los filtros no vacíos. */
function buildQueryString(filtros: FiltrosUI): string {
  const params = new URLSearchParams();
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.vendedor) params.set("vendedor", filtros.vendedor);
  return params.toString();
}

/**
 * Vista de Métricas (cliente). La barra de filtros navega vía router.push,
 * de modo que el RSC vuelve a consultar getMetricasData con los searchParams.
 * No usa server actions ni importa @/lib/admin/queries por valor.
 */
export function MetricasView({
  data,
  vendedores,
  rolScoped,
  initial,
}: MetricasViewProps) {
  const router = useRouter();
  const [filtros, setFiltros] = useState<FiltrosUI>({
    desde: initial.desde,
    hasta: initial.hasta,
    vendedor: initial.vendedor,
  });

  function patch(next: Partial<FiltrosUI>): void {
    setFiltros((prev) => ({ ...prev, ...next }));
  }

  function aplicar(): void {
    const qs = buildQueryString(filtros);
    router.push(qs ? `/je-admin/metricas?${qs}` : "/je-admin/metricas");
  }

  function limpiar(): void {
    setFiltros({ desde: "", hasta: "", vendedor: "" });
    router.push("/je-admin/metricas");
  }

  const { resumen, ventasMensuales, conversionPipeline, proyectosPorFase, cobranza } =
    data;

  /** Exporta los reportes visibles a un CSV (una sección por reporte). */
  function exportarCSV(): void {
    const esc = (v: string | number): string => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas: string[] = [];
    lineas.push("Resumen");
    lineas.push("Métrica,Valor");
    lineas.push(`Ingresos del periodo,${resumen.ingresosPeriodo}`);
    lineas.push(`Proyectos nuevos,${resumen.proyectosNuevos}`);
    lineas.push(`Tasa de conversión (%),${resumen.tasaConversion ?? ""}`);
    lineas.push(`Cobranza pendiente,${resumen.cobranzaPendiente}`);
    lineas.push("");
    lineas.push("Ingresos mensuales");
    lineas.push("Mes,Ingresos");
    ventasMensuales.forEach((r) => lineas.push(`${esc(r.mes)},${r.ingresos}`));
    lineas.push("");
    lineas.push("Conversión por etapa");
    lineas.push("Etapa,Oportunidades");
    conversionPipeline.forEach((r) => lineas.push(`${esc(labelFor(r.etapa))},${r.conteo}`));
    lineas.push("");
    lineas.push("Proyectos por fase");
    lineas.push("Fase,Proyectos");
    proyectosPorFase.forEach((r) => lineas.push(`${esc(labelFor(r.fase))},${r.conteo}`));
    lineas.push("");
    lineas.push("Cobranza");
    lineas.push("Estado,Monto");
    cobranza.forEach((r) => lineas.push(`${esc(labelFor(r.estado))},${r.monto}`));

    const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const sufijo = [filtros.desde, filtros.hasta].filter(Boolean).join("_");
    a.download = `metricas${sufijo ? "_" + sufijo : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Series para las gráficas (etiquetas crudas mapeadas con labelFor) ──
  const ventasData: ChartDatum[] = ventasMensuales.map((row) => ({
    mes: row.mes,
    ingresos: row.ingresos,
  }));

  const conversionData: ChartDatum[] = conversionPipeline.map((row) => ({
    etapa: labelFor(row.etapa),
    conteo: row.conteo,
  }));

  const faseData: ChartDatum[] = proyectosPorFase.map((row) => ({
    fase: labelFor(row.fase),
    conteo: row.conteo,
  }));

  const cobranzaDonut: DonutDatum[] = cobranza.map((row) => ({
    name: labelFor(row.estado),
    value: row.monto,
    color: toneToHex(toneFor(row.estado)),
  }));
  const cobranzaTotal = cobranza.reduce((acc, row) => acc + row.monto, 0);

  return (
    <div className="space-y-8">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Desde</span>
          <input
            type="date"
            value={filtros.desde}
            onChange={(event) => patch({ desde: event.target.value })}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Hasta</span>
          <input
            type="date"
            value={filtros.hasta}
            onChange={(event) => patch({ hasta: event.target.value })}
            className={INPUT_CLASS}
          />
        </label>

        {rolScoped ? null : (
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Vendedor</span>
            <select
              value={filtros.vendedor}
              onChange={(event) => patch({ vendedor: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Todos</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={aplicar}
          className={cn(
            "inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors",
            "hover:bg-brand/90 dark:bg-brand-green dark:hover:bg-brand-green/90",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          Aplicar
        </button>

        <button
          type="button"
          onClick={limpiar}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-sm font-medium text-stone-600 transition-colors",
            "hover:bg-stone-50 hover:text-stone-800 dark:border-border dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          <X className="size-3.5" aria-hidden />
          Limpiar
        </button>

        <button
          type="button"
          onClick={exportarCSV}
          className={cn(
            "ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-sm font-medium text-stone-600 transition-colors",
            "hover:bg-stone-50 hover:text-stone-800 dark:border-border dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          <Download className="size-3.5" aria-hidden />
          Exportar CSV
        </button>
      </div>

      {/* Fila de KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ingresos del periodo"
          value={formatMXN(resumen.ingresosPeriodo)}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Proyectos nuevos"
          value={formatInt(resumen.proyectosNuevos)}
          icon={FolderKanban}
          accent="mint"
        />
        <StatCard
          label="Tasa de conversión"
          value={`${resumen.tasaConversion ?? "—"}%`}
          icon={Percent}
          accent="gold"
        />
        <StatCard
          label="Cobranza pendiente"
          value={formatMXN(resumen.cobranzaPendiente)}
          icon={Wallet}
          accent="neutral"
        />
      </section>

      {/* Grid de gráficas */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Ingresos mensuales"
          description="Ingresos por mes (pagos cobrados)"
          height={280}
          isEmpty={ventasData.length === 0}
        >
          <LineChartMini
            data={ventasData}
            xKey="mes"
            lines={[{ key: "ingresos", name: "Ingresos", area: true }]}
            valueFormat="mxn"
          />
        </ChartCard>

        <ChartCard
          title="Conversión por etapa"
          description="Oportunidades por etapa del pipeline"
          height={280}
          isEmpty={conversionData.length === 0}
        >
          <BarChartMini
            data={conversionData}
            xKey="etapa"
            bars={[{ key: "conteo", name: "Oportunidades" }]}
            valueFormat="int"
          />
        </ChartCard>

        <ChartCard
          title="Proyectos por fase"
          description="Distribución de proyectos por fase"
          height={280}
          isEmpty={faseData.length === 0}
        >
          <BarChartMini
            data={faseData}
            xKey="fase"
            bars={[{ key: "conteo", name: "Proyectos" }]}
            valueFormat="int"
          />
        </ChartCard>

        <ChartCard
          title="Cobranza"
          description="Monto por estado de pago"
          height={280}
          isEmpty={cobranzaDonut.length === 0}
        >
          <DonutChart
            data={cobranzaDonut}
            centerLabel={formatMXN(cobranzaTotal)}
            centerSub="cobranza"
            valueFormat="mxn"
            showLegend
          />
        </ChartCard>
      </section>
    </div>
  );
}
