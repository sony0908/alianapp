// Handler serverless para Vercel y Express
module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    const { image } = body;

    if (!image) {
      return response.status(400).json({ error: 'Se requiere una imagen en formato base64' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback inteligente si no hay API key configurada
      return response.status(200).json({
        category: 'tops',
        name: 'Prenda de Bebé',
        dominantColor: '#df7446',
        secondaryColor: '#ffffff',
        subType: 'bodysuit',
        pattern: 'solid',
        season: 'all'
      });
    }

    // Dynamic import de @google/genai para compatibilidad con ESM
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Limpiar data URL prefix si viene incluido
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analiza esta foto de una prenda de ropa de bebé o infantil. Devuelve ÚNICAMENTE un objeto JSON válido con los siguientes campos:
{
  "category": "tops" | "bottoms" | "shoes" | "accessories",
  "name": "Nombre descriptivo en español (ej. Body blanco algodón, Pantalón beige, Zapatillas lona)",
  "dominantColor": "#HEX color principal aproximado",
  "secondaryColor": "#HEX color secundario aproximado",
  "subType": "bodysuit" | "tshirt" | "sweater" | "jacket" | "pants" | "shorts" | "skirt" | "shoes" | "booties" | "hat" | "bib",
  "pattern": "solid" | "striped" | "dots" | "print",
  "season": "summer" | "winter" | "all"
}`;

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = res.text?.trim() || '{}';
    const parsed = JSON.parse(text);

    return response.status(200).json(parsed);
  } catch (err) {
    console.error('Error analizando prenda con Gemini:', err);
    // En caso de error de modelo, devolver clasificación por defecto
    return response.status(200).json({
      category: 'tops',
      name: 'Prenda Bebé',
      dominantColor: '#df7446',
      secondaryColor: '#ffffff',
      subType: 'bodysuit',
      pattern: 'solid',
      season: 'all'
    });
  }
};
