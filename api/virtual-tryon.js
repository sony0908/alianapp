const fs = require('fs');
const path = require('path');

// Handler serverless para generar una imagen real del bebé vistiendo una prenda nueva o combinación con Gemini Image Generation
module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({
      error: 'Configura GEMINI_API_KEY en Vercel para generar pruebas de ropa nuevas con IA.',
    });
  }

  try {
    const body =
      typeof request.body === 'string'
        ? JSON.parse(request.body || '{}')
        : request.body || {};

    const { garmentImage, garmentDescription, category } = body;

    // Leer el retrato base de estudio del bebé en pañal
    const studioPathCandidates = [
      path.resolve(process.cwd(), 'public', 'bichito-studio-standing.jpg'),
      path.resolve(process.cwd(), 'dist', 'bichito-studio-standing.jpg'),
    ];
    const studioPath = studioPathCandidates.find((p) => fs.existsSync(p));
    if (!studioPath) {
      return response.status(500).json({ error: 'No se encontró la imagen base de estudio.' });
    }
    const baseBabyBase64 = fs.readFileSync(studioPath).toString('base64');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const zoneInstruction =
      category === 'tops'
        ? 'dress his upper body (chest, shoulders and arms) in this exact garment, keeping his legs, white diaper, barefoot toes, exact face, hair, pose and cream studio background (#fff8f2) identical.'
        : category === 'bottoms'
          ? 'dress his lower body (waist and legs) in this exact garment, keeping his bare chest, arms, barefoot toes, exact face, hair, pose and cream studio background (#fff8f2) identical.'
          : category === 'shoes'
            ? 'put these exact socks/shoes on both of his feet, keeping his face, hair, bare chest, diaper, legs, pose and cream studio background (#fff8f2) identical.'
            : 'put this exact baby accessory (bib around his neck or hat on his head) on him, keeping his exact face, pose, body and cream studio background (#fff8f2) identical.';

    const parts = [
      {
        text: `Edit the first studio photo of this standing baby boy. Keep his exact adorable face, head position, hair, pose, proportions, and warm cream studio background (#fff8f2) 100% pixel-aligned and identical, except ${zoneInstruction} Garment description: ${garmentDescription || 'baby clothing'}. Realistic cotton fabric folds, natural fit and soft studio shadows.`,
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: baseBabyBase64,
        },
      },
    ];

    if (garmentImage && typeof garmentImage === 'string') {
      const cleanGarment = garmentImage.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanGarment,
        },
      });
    }

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const candidateParts = res.candidates?.[0]?.content?.parts || [];
    const imagePart = candidateParts.find((p) => p.inlineData && p.inlineData.data);

    if (!imagePart) {
      return response.status(502).json({
        error: 'Gemini no devolvió una imagen generada.',
      });
    }

    const mime = imagePart.inlineData.mimeType || 'image/jpeg';
    return response.status(200).json({
      tryOnImage: `data:${mime};base64,${imagePart.inlineData.data}`,
    });
  } catch (err) {
    console.error('Error en /api/virtual-tryon:', err);
    return response.status(500).json({
      error: 'No se pudo generar la imagen con IA en este momento.',
    });
  }
};
