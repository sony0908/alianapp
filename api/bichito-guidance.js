const recentRequests = new Map();
const { validatePairing } = require("./_vault");

function cleanList(value, limit, length) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .map((item) => String(item || "").replace(/[<>]/g, "").trim().slice(0, length))
    .filter(Boolean);
}

function outputText(interaction) {
  return (interaction.steps || [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return response.status(503).json({ error: "La IA aún no está conectada. Agrega GEMINI_API_KEY en las variables de entorno de Vercel." });
  }
  const origin = request.headers.origin || "";
  if (origin && !/^https:\/\/([a-z0-9-]+\.)?vercel\.app$/i.test(origin)) {
    return response.status(403).json({ error: "Origen no autorizado." });
  }
  try {
    const pairing = await validatePairing(request);
    if (!pairing) return response.status(401).json({ error: "Empareja este teléfono con el QR familiar antes de usar la IA." });
  } catch {
    return response.status(503).json({ error: "La nube privada debe configurarse antes de usar la IA." });
  }
  const address = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  if (now - (recentRequests.get(address) || 0) < 45000) {
    return response.status(429).json({ error: "Espera un momento antes de pedir otra recomendación." });
  }
  recentRequests.set(address, now);

  let body = {};
  try {
    body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  } catch {
    return response.status(400).json({ error: "Datos inválidos." });
  }
  const ageMonths = Number.isFinite(Number(body.ageMonths)) ? Math.max(0, Math.min(36, Math.floor(Number(body.ageMonths)))) : null;
  const milestones = cleanList(body.milestones, 8, 80);
  const stock = Array.isArray(body.stock)
    ? body.stock.slice(0, 12).map((item) => ({
      category: String(item?.category || "").replace(/[<>]/g, "").slice(0, 40),
      name: String(item?.name || "").replace(/[<>]/g, "").slice(0, 60),
      quantity: Math.max(0, Math.min(10000, Number(item?.quantity) || 0)),
      minimum: Math.max(0, Math.min(10000, Number(item?.minimum) || 0)),
    }))
    : [];
  const context = JSON.stringify({ ageMonths, milestones, stock });
  const prompt = `Eres el asistente educativo de una familia chilena con un bebé. Crea recomendaciones generales y prudentes en español, usando solo este contexto anónimo: ${context}.

Devuelve texto corto y accionable con estos cuatro títulos: "Para esta etapa", "Aprender y jugar", "Planificar compras" y "Cuando llora". En "Para esta etapa" menciona lecturas o temas para conversar/leer, no enlaces inventados. En "Planificar compras" sugiere solo elementos generales que podrían planificarse en los próximos dos meses, sin decir que son obligatorios. En "Cuando llora" recuerda revisar sueño, hambre, pañal, movimiento/aburrimiento, incomodidad y encías, sin decidir la causa.

No diagnostiques, no des medicamentos, dosis, pautas de alimentación, indicaciones de vacunas ni instrucciones médicas. No afirmes edades exactas como reglas universales. Añade al final una sola frase indicando que ante síntomas preocupantes o dudas de salud deben consultar a su equipo de salud. No inventes datos que no estén en el contexto.`;

  try {
    const gemini = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({ model: "gemini-flash-lite-latest", store: false, input: prompt }),
    });
    const interaction = await gemini.json();
    if (!gemini.ok) {
      console.error("Gemini request failed", gemini.status, interaction?.error?.message);
      return response.status(502).json({ error: "Gemini no pudo preparar recomendaciones ahora. Intenta de nuevo más tarde." });
    }
    const text = outputText(interaction);
    if (!text) return response.status(502).json({ error: "Gemini no devolvió una recomendación útil. Intenta de nuevo." });
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ text: text.slice(0, 6000) });
  } catch (error) {
    console.error("Gemini connection failed", error);
    return response.status(502).json({ error: "No se pudo conectar con Gemini. Intenta de nuevo más tarde." });
  }
}
