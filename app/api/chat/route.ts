import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ max: 20, windowMs: 60_000, maxEntries: 5000 });

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        sender: z.enum(["user", "assistant"]),
        text: z.string().max(4000),
      }),
    )
    .max(20)
    .default([]),
  turnstileToken: z.string().max(2048).optional(),
});

const SYSTEM_PROMPT = `Eres el "Asesor Solar" de Jygasoft Energy, una empresa de energía solar en Aguascalientes, México. Respondes en español (es-MX), con tono cordial, claro y profesional. Sé breve (2-5 frases) salvo que pidan detalle.

QUÉ HACE JYGASOFT ENERGY:
- Instala sistemas solares fotovoltaicos para casa (residencial) y negocio (comercial/industrial).
- Gestiona el trámite de interconexión ante CFE de principio a fin (solicitud, estudio si aplica, oficio, contratos, medidor bidireccional, operación).
- Instalación con cuadrillas propias y servicio postventa.
- Cobertura principal: Aguascalientes y la región.

DATOS DE REFERENCIA (son aproximados, NO los presentes como precios cerrados):
- Inversión aproximada: $14,000 a $17,500 MXN por kWp instalado.
- Ahorro típico: entre 70% y 95% de la facturación, según tarifa y consumo.
- Tarifa DAC (alto consumo doméstico): es cara y sin subsidio; quienes están en DAC son los que más ahorran.
- Tarifa residencial: el kWh excedente ronda $4.00 MXN; PDBT comercial ~$3.77; DAC ~$6.75.
- HSP en Aguascalientes: ~5.9 horas solares pico.
- Paneles con garantía de hasta 25 años (del fabricante).
- Los excedentes inyectados a la red se liquidan a PML (precio marginal local), menor a la tarifa de consumo; por eso conviene dimensionar para autoconsumo.

REGLAS IMPORTANTES:
- NUNCA inventes precios exactos, plazos garantizados ni prometas resultados específicos. Da SIEMPRE rangos.
- Para una cifra exacta de ahorro/sistema, recomienda usar la Calculadora del sitio (/calculadora).
- Para una cotización formal o contrato, indica que un asesor humano debe revisar el caso.
- No des asesoría legal ni fiscal definitiva.
- Los tiempos del trámite CFE los determina la propia CFE; no los garantices.
- Si la pregunta no tiene que ver con energía solar/Jygasoft, redirige amablemente al tema.
- Cuando detectes intención de compra/cotización (o lo pidan), invita a dejar sus datos (/contacto) o a hablar por WhatsApp con un asesor.
- No solicites datos sensibles. Si comparten teléfono/correo, agradece y sugiere que un asesor los contactará.`;

const FALLBACK =
  "Por ahora no puedo responder en automático. Escríbenos por WhatsApp o déjanos tus datos en /contacto y un asesor te ayudará enseguida. También puedes estimar tu ahorro en /calculadora.";

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: NextRequest) {
  if (!limiter.check(clientIp(req)).allowed) {
    return NextResponse.json(
      { text: "Has enviado muchos mensajes muy rápido. Espera un momento, por favor." },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const { message, history, turnstileToken } = parsed.data;

  // Anti-bot: exige CAPTCHA al iniciar la conversación (primer turno del usuario).
  // Protege el presupuesto de IA contra abuso automatizado. En desarrollo (sin
  // TURNSTILE_SECRET) verifyTurnstile permite el paso.
  const isFirstTurn = !history.some((m) => m.sender === "user");
  if (isFirstTurn) {
    const v = await verifyTurnstile(turnstileToken, clientIp(req));
    if (!v.success) {
      return NextResponse.json(
        { text: "Verifica que no eres un robot para iniciar el chat." },
        { status: 403 },
      );
    }
  }

  const apiKey = serverEnv.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ text: FALLBACK, fallback: true });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const contents = [
      ...history.map((m) => ({
        role: m.sender === "assistant" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const result = await ai.models.generateContent({
      model: serverEnv.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
        maxOutputTokens: 700,
      },
    });

    const text = result.text?.trim() || FALLBACK;
    return NextResponse.json({ text });
  } catch (error) {
    console.error("chat error", error);
    return NextResponse.json({ text: FALLBACK, fallback: true }, { status: 200 });
  }
}
