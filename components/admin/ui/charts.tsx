"use client"

// Wrappers de recharts v3 con API simple y colores de marca.
// Encapsulan la verbosidad de recharts (ejes, grid, tooltip, ResponsiveContainer)
// para que las paginas solo pasen {data} y los campos clave.
// recharts v3 es client-only, de ahi el "use client" obligatorio.

import type { CSSProperties, ReactNode } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

import { cn } from "@/lib/utils"
import { formatMXN, formatInt } from "@/lib/admin/format"

/** Formato de valor serializable (no se pueden pasar funciones server->client). */
export type ChartValueFormat = "mxn" | "int" | "number"

/** Resuelve el formateador en el cliente a partir del formato declarado. */
function resolveValueFormatter(
  fmt?: ChartValueFormat,
): ((value: number) => string) | undefined {
  if (fmt === "mxn") return formatMXN
  if (fmt === "int") return formatInt
  if (fmt === "number") return (n) => String(n)
  return undefined
}

/** Paleta de marca exportada para usar en series/leyendas. */
export interface BrandChartPalette {
  brand: string        // #002612
  green: string        // #206c3b
  gold: string         // #f5b301
  goldDark: string     // #e0a300
  mint: string         // #a2d2af
  greenDark: string    // #164a28
  grid: string         // stone-200
  axis: string         // stone-400/muted-foreground
}

/** Constante de paleta de marca (oklch hex equivalentes). */
export const BRAND_CHART_PALETTE: BrandChartPalette = {
  brand: "#002612",
  green: "#206c3b",
  gold: "#f5b301",
  goldDark: "#e0a300",
  mint: "#a2d2af",
  greenDark: "#164a28",
  grid: "#e7e5e4",
  axis: "#a8a29e",
}

/** Orden por defecto de colores de serie cuando no se especifica color. */
const SERIES_COLORS: ReadonlyArray<string> = [
  BRAND_CHART_PALETTE.green,
  BRAND_CHART_PALETTE.gold,
  BRAND_CHART_PALETTE.brand,
  BRAND_CHART_PALETTE.mint,
  BRAND_CHART_PALETTE.greenDark,
]

/** Devuelve el color de serie por indice (con wrap-around). */
function seriesColor(index: number, override?: string): string {
  if (override) return override
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

export type ChartDatum = Record<string, string | number | null | undefined>

// Estilo del tooltip de recharts. recharts v3 NO expone className en Tooltip,
// asi que el look de marca (borde stone-200, fondo blanco, sombra) va inline.
// Imita "rounded-lg border border-stone-200 bg-white text-xs shadow-md".
const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  borderRadius: 8,
  border: `1px solid ${BRAND_CHART_PALETTE.grid}`,
  backgroundColor: "#ffffff",
  fontSize: 12,
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
}

const AXIS_TICK = { fontSize: 11, fill: BRAND_CHART_PALETTE.axis } as const

// Formateador comun del tooltip: aplica valueFormatter al valor numerico.
// recharts v3 puede pasar `ValueType | undefined` (number|string|array|undefined),
// por eso el parametro acepta undefined y se normaliza a number.
function tooltipFormatter(valueFormatter?: (value: number) => string) {
  if (!valueFormatter) return undefined
  return (
    value: number | string | ReadonlyArray<number | string> | undefined,
  ): string => {
    const raw = Array.isArray(value) ? value[0] : value
    const n = Number(raw)
    return Number.isFinite(n) ? valueFormatter(n) : ""
  }
}

/* ------------------------------------------------------------------ */
/* BarChartMini                                                        */
/* ------------------------------------------------------------------ */

export interface BarChartMiniProps {
  data: ReadonlyArray<ChartDatum>
  /** Campo del eje X (categoria). */
  xKey: string
  /** Una o varias series (barras). */
  bars: ReadonlyArray<{ key: string; name?: string; color?: string; stackId?: string }>
  /** Mostrar ejes y grid. Default true. */
  showAxes?: boolean
  /** Tooltip on/off. Default true. */
  showTooltip?: boolean
  /** Formateador de valores (tooltip/eje Y), ej. moneda. */
  valueFormat?: ChartValueFormat
  /** Radio de barra. Default 6. */
  radius?: number
  /** Alto si se usa SIN ChartCard (modo standalone). */
  height?: number
  className?: string
}

/** Barras (leads por dia, proyectos por fase). */
export function BarChartMini({
  data,
  xKey,
  bars,
  showAxes = true,
  showTooltip = true,
  valueFormat,
  radius = 6,
  height,
  className,
}: BarChartMiniProps) {
  const valueFormatter = resolveValueFormatter(valueFormat)
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height ?? "100%"}>
        <BarChart data={data as ChartDatum[]} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          {showAxes ? (
            <CartesianGrid vertical={false} stroke={BRAND_CHART_PALETTE.grid} />
          ) : null}
          {showAxes ? (
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              stroke={BRAND_CHART_PALETTE.axis}
            />
          ) : null}
          {showAxes ? (
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              stroke={BRAND_CHART_PALETTE.axis}
              tickFormatter={valueFormatter}
              width={valueFormatter ? 48 : 32}
            />
          ) : null}
          {showTooltip ? (
            <Tooltip
              cursor={{ fill: BRAND_CHART_PALETTE.grid, opacity: 0.35 }}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              formatter={tooltipFormatter(valueFormatter)}
            />
          ) : null}
          {bars.map((bar, index) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name ?? bar.key}
              stackId={bar.stackId}
              fill={seriesColor(index, bar.color)}
              radius={[radius, radius, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* LineChartMini                                                       */
/* ------------------------------------------------------------------ */

export interface LineChartMiniProps {
  data: ReadonlyArray<ChartDatum>
  xKey: string
  lines: ReadonlyArray<{ key: string; name?: string; color?: string; area?: boolean; dashed?: boolean }>
  showAxes?: boolean
  showTooltip?: boolean
  valueFormat?: ChartValueFormat
  /** Suaviza la curva (type="monotone"). Default true. */
  smooth?: boolean
  height?: number
  className?: string
}

/** Linea/area (ingresos/forecast, leads en el tiempo). */
export function LineChartMini({
  data,
  xKey,
  lines,
  showAxes = true,
  showTooltip = true,
  valueFormat,
  smooth = true,
  height,
  className,
}: LineChartMiniProps) {
  const valueFormatter = resolveValueFormatter(valueFormat)
  const curveType = smooth ? "monotone" : "linear"
  // Si alguna serie es area, montamos AreaChart (soporta Area + Line indistintamente).
  const hasArea = lines.some((line) => line.area)

  const axes = (
    <>
      {showAxes ? (
        <CartesianGrid vertical={false} stroke={BRAND_CHART_PALETTE.grid} />
      ) : null}
      {showAxes ? (
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          stroke={BRAND_CHART_PALETTE.axis}
        />
      ) : null}
      {showAxes ? (
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          stroke={BRAND_CHART_PALETTE.axis}
          tickFormatter={valueFormatter}
          width={valueFormatter ? 48 : 32}
        />
      ) : null}
      {showTooltip ? (
        <Tooltip
          contentStyle={TOOLTIP_CONTENT_STYLE}
          formatter={tooltipFormatter(valueFormatter)}
        />
      ) : null}
    </>
  )

  const margin = { top: 4, right: 4, bottom: 0, left: 0 }

  // AreaChart: dibuja Area para series con area=true y Line para el resto.
  if (hasArea) {
    return (
      <div className={cn("w-full", className)}>
        <ResponsiveContainer width="100%" height={height ?? "100%"}>
          <AreaChart data={data as ChartDatum[]} margin={margin}>
            {axes}
            {lines.map((line, index) => {
              const color = seriesColor(index, line.color)
              const dash = line.dashed ? "4 4" : undefined
              return line.area ? (
                <Area
                  key={line.key}
                  dataKey={line.key}
                  name={line.name ?? line.key}
                  type={curveType}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={dash}
                  fill={color}
                  fillOpacity={0.12}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ) : (
                <Line
                  key={line.key}
                  dataKey={line.key}
                  name={line.name ?? line.key}
                  type={curveType}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={dash}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // LineChart puro (sin areas).
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height ?? "100%"}>
        <LineChart data={data as ChartDatum[]} margin={margin}>
          {axes}
          {lines.map((line, index) => {
            const color = seriesColor(index, line.color)
            return (
              <Line
                key={line.key}
                dataKey={line.key}
                name={line.name ?? line.key}
                type={curveType}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={line.dashed ? "4 4" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* DonutChart                                                          */
/* ------------------------------------------------------------------ */

export interface DonutDatum {
  name: string
  value: number
  /** Color del segmento; si falta, se toma de la paleta de marca por indice. */
  color?: string
}

export interface DonutChartProps {
  data: ReadonlyArray<DonutDatum>
  /** Texto central opcional (total). */
  centerLabel?: ReactNode
  /** Sub-texto central opcional. */
  centerSub?: ReactNode
  /** Grosor del anillo en px (outer-inner). Default 28. */
  thickness?: number
  showTooltip?: boolean
  showLegend?: boolean
  valueFormat?: ChartValueFormat
  height?: number
  className?: string
}

/** Dona (pipeline por etapa, distribucion de estados). */
export function DonutChart({
  data,
  centerLabel,
  centerSub,
  thickness = 28,
  showTooltip = true,
  showLegend = false,
  valueFormat,
  height,
  className,
}: DonutChartProps) {
  const valueFormatter = resolveValueFormatter(valueFormat)
  // recharts solo parsea porcentajes simples ("80%") o numeros: calc() no sirve.
  // outerRadius en porcentaje del contenedor; innerRadius con un porcentaje
  // estimado a partir del grosor relativo a una altura de referencia (240px).
  // Asi el anillo mantiene un grosor visual coherente sin medir el DOM.
  const outerRadius = "80%"
  const referenceHeight = height ?? 240
  // Mitad de la altura util (~80% del radio) = radio exterior aprox. en px.
  const approxOuterPx = (referenceHeight * 0.8) / 2
  const innerPct = Math.max(0, Math.round(((approxOuterPx - thickness) / approxOuterPx) * 80))
  const innerRadius = `${innerPct}%`

  return (
    <div className={cn("relative h-full w-full", className)}>
      <ResponsiveContainer width="100%" height={height ?? "100%"}>
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          {showTooltip ? (
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              formatter={tooltipFormatter(valueFormatter)}
            />
          ) : null}
          {showLegend ? (
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: BRAND_CHART_PALETTE.axis }}
            />
          ) : null}
          <Pie
            data={data as DonutDatum[]}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((segment, index) => (
              <Cell
                key={`${segment.name}-${index}`}
                fill={seriesColor(index, segment.color)}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Etiqueta central como overlay absoluto (no usamos label de recharts). */}
      {centerLabel || centerSub ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="flex flex-col items-center leading-tight">
            {centerLabel ? (
              <span className="text-xl font-semibold text-brand dark:text-foreground">
                {centerLabel}
              </span>
            ) : null}
            {centerSub ? (
              <span className="text-xs text-muted-foreground">{centerSub}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export interface SparklineProps {
  /** Serie de numeros simple. */
  data: ReadonlyArray<number>
  /** Color de linea. Default brand-green. */
  color?: string
  /** Rellena bajo la linea (area). Default true. */
  area?: boolean
  /** Alto en px. Default 40. */
  height?: number
  className?: string
}

/** Micro-linea sin ejes para KPIs (dentro de StatCard). */
export function Sparkline({
  data,
  color = BRAND_CHART_PALETTE.green,
  area = true,
  height = 40,
  className,
}: SparklineProps) {
  // Normaliza la serie de numeros al shape que espera recharts.
  const chartData = data.map((value, index) => ({ index, value }))

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={area ? 0.15 : 0}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
