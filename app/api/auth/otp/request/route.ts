import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { createLoginCode, countRecentCodes, sendOtpEmail } from "@/lib/otp";

/**
 * Emite un código OTP al correo para el login de je-admin.
 * Defensas: Turnstile + rate-limit por IP + tope por correo + anti-enumeración
 * (siempre responde igual, exista o no el usuario).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ max: 5, windowMs: 60_000, maxEntries: 5000 });

const bodySchema = z.object({
  email: z.string().email().max(254),
  turnstileToken: z.string().max(2048).optional(),
});

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

// Respuesta uniforme (no revela si el correo existe). Función: cada request
// devuelve una respuesta nueva (NextResponse no es reutilizable).
function generic() {
  return NextResponse.json({
    ok: true,
    message: "Si el correo está registrado, te enviamos un código.",
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!limiter.check(ip).allowed) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un momento." },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  const { email, turnstileToken } = parsed.data;

  const captcha = await verifyTurnstile(turnstileToken, ip);
  if (!captcha.success) {
    return NextResponse.json(
      { ok: false, error: "Verificación anti-robot fallida." },
      { status: 403 },
    );
  }

  const normalized = email.toLowerCase();
  const [user] = await db
    .select({ id: schema.usuarios.id, activo: schema.usuarios.activo })
    .from(schema.usuarios)
    .where(sql`lower(${schema.usuarios.email}) = ${normalized}`)
    .limit(1);

  // Solo enviamos si el usuario existe, está activo y no excede el tope por correo.
  if (user && user.activo) {
    const recent = await countRecentCodes(normalized);
    if (recent < serverEnv.OTP_REQUESTS_PER_EMAIL) {
      const code = await createLoginCode(normalized, ip);
      await sendOtpEmail(normalized, code);
    }
  }

  return generic();
}
