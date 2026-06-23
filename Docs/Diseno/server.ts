import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Memory store for form submissions (leads)
const leadsDb: any[] = [];

// Lazy initializer for GoogleGenAI to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required for AI Solar Consultant.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Jygasoft Energy Service is live." });
});

// 2. Solar Savings Calculator
app.post("/api/calculate-savings", (req, res) => {
  const { monthlyBill, state = "Ciudad de México" } = req.body;
  if (!monthlyBill || isNaN(Number(monthlyBill)) || Number(monthlyBill) <= 0) {
    return res.status(400).json({ error: "Por favor, introduce un monto válido para tu recibo bimestral/mensual." });
  }

  const bill = Number(monthlyBill);
  
  // High efficiency solar estimates adjusted for Mexican region
  // Typical cost per kWh from CFE in DAC (high consumption) is around $6.00 MXN.
  // Standard residential tariff has subsidies but grows fast.
  // Standard solar panel is 550W. Average solar generation is 4.5 hours of peak sun/day.
  const annualEnergyCostMxN = bill * 6; // Assuming standard bi-monthly bill multiplied by 6 periods/year
  
  // Calculate average kWh consumption per year
  // Let's assume an average CFE rate of $4.5 MXN per kWh average for residential with high usage or DAC
  const estimatedAnnualKwh = annualEnergyCostMxN / 4.5;
  const estimatedMonthlyKwh = estimatedAnnualKwh / 12;

  // Let's calculate recommended panels to cover ~90% of usage
  // Each 550W panel generates approx 75 kWh per month in Mexico (average 4.5 Peak Sun Hours/day, 550W * 4.5 * 30 * 0.8 / 1000)
  const monthlyGenerationPerPanel = 75; 
  let recommendedPanels = Math.ceil((estimatedMonthlyKwh * 0.9) / monthlyGenerationPerPanel);
  if (recommendedPanels < 2) recommendedPanels = 2; // minimum system size usually 2 panels

  const systemSizekW = Number(((recommendedPanels * 550) / 1000).toFixed(2));
  
  // Industry average solar system cost in Mexico is approx $22,000 to $26,000 MXN per kW/panel installed
  const estimatedCost = recommendedPanels * 14500; // competitive pricing model
  
  // 90% savings off annual cost
  const annualSavings = Math.round(annualEnergyCostMxN * 0.9);
  
  // Payback period (usually 2.5 to 4 years in Mexican high residential tariffs)
  const paybackYears = Number((estimatedCost / annualSavings).toFixed(1));
  
  // Environmental footprint - 1 kWh in Mexico grid generates ~0.45 kg of CO2.
  // Solar offsetting 90% of kWh
  const environmentalImpactCo2 = Number(((estimatedAnnualKwh * 0.9 * 0.45) / 1000).toFixed(2));

  res.json({
    monthlyBill: bill,
    recommendedPanels,
    systemSizekW,
    estimatedCost,
    annualSavings,
    paybackYears,
    environmentalImpactCo2,
    msg: `Cálculo realizado con éxito para el estado de ${state}`
  });
});

// 3. Lead Capture Form
app.post("/api/lead", (req, res) => {
  const { name, email, phone, state, monthlyBill, contactMethod } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Faltan campos obligatorios para agendar tu cotización." });
  }

  const newLead = {
    id: `lead_${Date.now()}`,
    name,
    email,
    phone,
    state: state || "No especificado",
    monthlyBill: Number(monthlyBill) || 0,
    contactMethod: contactMethod || "whatsapp",
    createdAt: new Date()
  };

  leadsDb.push(newLead);
  console.log("Nuevo lead registrado con éxito:", newLead);

  res.json({ 
    success: true, 
    message: "¡Excelente! Hemos recibido tus datos. Uno de nuestros ingenieros solares se pondrá en contacto contigo a la brevedad.",
    leadId: newLead.id
  });
});

// 4. Gemini AI Solar Consultant Chat
app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) {
    return res.status(400).json({ error: "El mensaje no puede estar vacío." });
  }

  try {
    const ai = getGeminiClient();

    // Construct high quality system instructions for a top-tier solar advisory in Mexico.
    const systemPrompt = `Eres el Consultor Solar Especializado de "Jygasoft Energy" en México, una compañía líder de servicio solar premium residencial y comercial.
Tu tono es elegante, experto, servicial y altamente profesional. Tu misión es educar y convencer cordialmente a los usuarios sobre las ventajas de los sistemas solares interconectados con la Comisión Federal de Electricidad (CFE).
Responde con información específica para el contexto mexicano, como:
- Tarifas de CFE como la DAC (Doméstica de Alto Consumo), la cual no tiene subsidio y es idónea para paneles solares porque cuesta hasta más de $6 pesos por kWh, y las tarifas comerciales (PDBT, GDMTO).
- El contrato de interconexión (Net Metering) de CFE donde los excedentes generados de día se inyectan a la red y se restan del consumo nocturno.
- Certificaciones importantes: Certificación CONOCER, cumplimiento estricto con la NOM-001-SEDE-2022 (instalaciones eléctricas seguras).
- La alta radiación solar de México (especialmente en estados del norte, centro y occidente).
- Garantía de 25 años en paneles Jygasoft, retornos de inversión súper rápidos de 3 a 5 años, y plusvalía inmediata para el inmueble.

Mantén tus respuestas breves, estructuradas con viñetas elegantes donde sea oportuno e inspiradoras. Evita explicaciones excesivamente técnicas sobre la física de semiconductores, enfócate en el beneficio económico, el trámite CFE incluido y el impacto ecológico positivo. Recuerda responder siempre en español de México de manera respetuosa y amena. Usa negritas para destacar cifras o ventajas clave.`;

    // Map conversation history to Gemini structure
    const contents = history.map((chat: any) => ({
      role: chat.sender === "user" ? "user" : "model",
      parts: [{ text: chat.text }]
    }));

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    const aiResponseText = response.text || "Lo siento, ha ocurrido un error al procesar el análisis de energía. ¿Podrías intentar formular de nuevo tu pregunta?";
    res.json({ text: aiResponseText });

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    // Provide a friendly, comprehensive fallback response if the API key is not configured or fails
    const fallbackText = `¡Gracias por tu consulta! Actualmente estamos actualizando nuestro canal inteligente de asesoría. Te puedo decir con total confianza que un sistema Jygasoft Energy te permite **eliminar tu tarifa DAC**, reduciendo tu recibo bimestral de CFE de miles de pesos a tan solo el cargo mínimo de conexión (aproximadamente **$100 MXN**).

Nuestros sistemas tienen una **garantía de rendimiento de 25 años** y el **trámite de interconexión con CFE está 100% incluido**. ¿Te gustaría que estimemos tu ahorro exacto? Puedes usar nuestra calculadora interactiva en la pantalla principal o enviarnos tus datos en la sección de contacto para agendar una consultoría gratuita en tu domicilio.`;

    res.json({ text: fallbackText, isFallback: true });
  }
});

// -------------------------------------------------------------
// Dev & Build Static File Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Jygasoft Energy] Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer();
