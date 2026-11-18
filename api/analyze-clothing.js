// Handler serverless para analizar ropa con Gemini usando fetch nativo (sin dependencias externas en Vercel)
module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const body =
      typeof request.body === 'string'
        ? JSON.parse(request.body || '{}')
        : request.body || {};
    const { image } = body;

    if (!image) {
      return response.status(400).json({ error: 'Se requiere una imagen en formato base64' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return response.status(200).json({
        category: 'tops',
        name: 'Prenda de Bebé',
        dominantColor: '#df7446',
        secondaryColor: '#ffffff',
        subType: 'bodysuit',
        pattern: 'solid',
        season: 'all',
      });
    }

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

    const gcRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const gcJson = await gcRes.json().catch(() => ({}));
    const rawText = gcJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText.trim());

    return response.status(200).json(parsed);
  } catch (err) {
    console.error('Error analizando prenda con Gemini:', err);
    return response.status(200).json({
      category: 'tops',
      name: 'Prenda Bebé',
      dominantColor: '#df7446',
      secondaryColor: '#ffffff',
      subType: 'bodysuit',
      pattern: 'solid',
      season: 'all',
    });
  }
};
