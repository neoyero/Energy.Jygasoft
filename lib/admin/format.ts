import type { StatTrend } from "@/components/admin/ui/stat-card";
import type { StatusTone } from "@/components/admin/ui/status-badge";

/**
 * Helpers de formato PUROS (sin imports de servidor ni de db). Seguros de usar
 * en cliente y servidor. Localizados a es-MX. Centralizan moneda, enteros,
 * tendencias de KPI, fechas relativas y el color hex por tono de estado.
 */

// Formatters reutilizados (crear el Intl.NumberFormat es costoso, se memoizan
// a nivel de modulo para no reinstanciarlos en cada llamada).
const MXN_FORMAT = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const INT_FORMAT = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 0,
});

const FECHA_FORMAT = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Pesos mexicanos, 0 decimales. Trata NaN/Infinity como 0. */
export function formatMXN(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return MXN_FORMAT.format(safe);
}

/** Entero localizado es-MX (separadores de miles). Trata NaN/Infinity como 0. */
export function formatInt(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return INT_FORMAT.format(safe);
}

/**
 * Construye la tendencia para <StatCard />. Calcula el delta porcentual entre
 * `actual` y `previo`:
 *  - `previo === 0` (sin base de comparacion) -> undefined (no se muestra pill).
 *  - direccion: up/down/flat segun el signo del delta.
 *  - label: "+X.X%" / "−X.X%" (signo menos tipografico U+2212), 1 decimal.
 * `opts.goodWhenDown` se reenvia a StatTrend para invertir la semantica de
 * color (ej. cuentas vencidas: bajar es bueno).
 */
export function buildTrend(
  actual: number,
  previo: number,
  opts?: { goodWhenDown?: boolean },
): StatTrend | undefined {
  if (previo === 0) return undefined;

  const deltaPct = ((actual - previo) / previo) * 100;
  const rounded = Math.round(deltaPct * 10) / 10;

  const direction: StatTrend["direction"] =
    rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";

  // Signo menos tipografico (U+2212) para el caso negativo; el "+" explicito
  // para el positivo. El valor se muestra siempre en magnitud absoluta.
  const abs = Math.abs(rounded).toFixed(1);
  const value =
    direction === "down" ? `−${abs}%` : direction === "up" ? `+${abs}%` : `${abs}%`;

  return {
    value,
    direction,
    goodWhenDown: opts?.goodWhenDown,
  };
}

const MS_MIN = 60_000;
const MS_HORA = 60 * MS_MIN;
const MS_DIA = 24 * MS_HORA;

/**
 * Fecha relativa amigable en es-MX a partir de un ISO timestamp:
 *  - null -> "—".
 *  - < 1 min -> "hace un momento".
 *  - < 1 h   -> "hace N min".
 *  - < 24 h  -> "hace N h".
 *  - 1 dia   -> "ayer".
 *  - resto   -> fecha absoluta es-MX ("23 jun 2026").
 * ISO invalido -> "—".
 */
export function fmtFechaRel(iso: string | null): string {
  if (iso === null) return "—";

  const date = new Date(iso);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return "—";

  const diff = Date.now() - ms;

  // Fechas futuras o "ahora mismo": evitar negativos raros.
  if (diff < MS_MIN) return "hace un momento";
  if (diff < MS_HORA) {
    const mins = Math.floor(diff / MS_MIN);
    return `hace ${mins} min`;
  }
  if (diff < MS_DIA) {
    const horas = Math.floor(diff / MS_HORA);
    return `hace ${horas} h`;
  }
  if (diff < 2 * MS_DIA) return "ayer";

  return FECHA_FORMAT.format(date);
}

/**
 * Color hex por tono de estado, coherente con la paleta del StatusBadge
 * (emerald/amber/red/sky/stone). Util para graficas (recharts) donde se
 * necesita un color literal en vez de una clase Tailwind.
 */
const TONE_HEX: Record<StatusTone, string> = {
  success: "#10b981", // emerald-500
  warning: "#f59e0b", // amber-500
  danger: "#ef4444", // red-500
  info: "#0ea5e9", // sky-500
  neutral: "#78716c", // stone-500
};

/** Devuelve el hex del tono; fallback a neutral ante un tono desconocido. */
export function toneToHex(tone: StatusTone): string {
  return TONE_HEX[tone] ?? TONE_HEX.neutral;
}
