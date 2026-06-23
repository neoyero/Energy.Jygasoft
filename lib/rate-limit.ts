/**
 * Rate-limit por clave (IP) con ventana fija, en memoria.
 *
 * v1: LRU acotada en proceso (suficiente para una sola instancia). Si se escala
 * a múltiples procesos, migrar el store a Postgres/Redis manteniendo esta interfaz.
 */

interface RateLimiterConfig {
  /** Máximo de solicitudes permitidas por ventana. */
  max: number;
  /** Duración de la ventana en ms. */
  windowMs: number;
  /** Tope de claves en memoria (evicción LRU al excederse). */
  maxEntries?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Instante (ms) en que se reinicia la ventana actual. */
  resetAt: number;
}

interface Bucket {
  count: number;
  windowStart: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const { max, windowMs } = config;
  const maxEntries = config.maxEntries ?? 10_000;
  // Map mantiene orden de inserción → reinsertamos al tocar para emular LRU.
  const buckets = new Map<string, Bucket>();

  function touch(key: string, bucket: Bucket): void {
    buckets.delete(key);
    buckets.set(key, bucket);
    while (buckets.size > maxEntries) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      const existing = buckets.get(key);
      const expired = !existing || now - existing.windowStart >= windowMs;

      const bucket: Bucket = expired
        ? { count: 0, windowStart: now }
        : existing;

      bucket.count += 1;
      touch(key, bucket);

      const resetAt = bucket.windowStart + windowMs;
      const allowed = bucket.count <= max;
      const remaining = Math.max(0, max - bucket.count);
      return { allowed, remaining, resetAt };
    },
  };
}
