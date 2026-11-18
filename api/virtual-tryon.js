const fs = require('fs');
const path = require('path');

// Handler serverless para generar UNA SOLA IMAGEN COMPLETA DEL CONJUNTO (sin unir recortes)
// manteniendo las reglas estrictas del modelo base de tu hijo en el estudio.
module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({
      error: 'Configura GEMINI_API_KEY en Vercel para generar conjuntos nuevos con IA.',
    });
  }

  try {
    const body =
      typeof request.body === 'string'
        ? JSON.parse(request.body || '{}')
        : request.body || {};

    // Soporta tanto conjunto completo (items: [{ category, name, color, subType, photoUrl }]) como una prenda individual
    const items = Array.isArray(body.items)
      ? body.items
      : body.garmentDescription
        ? [
            {
              category: body.category || 'tops',
              name: body.garmentDescription,
              photoUrl: body.garmentImage,
            },
          ]
        : [];

    if (items.length === 0) {
      return response.status(400).json({ error: 'Selecciona al menos una prenda para generar el conjunto.' });
    }

    // Leer el retrato base estricto de estudio del bebé
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

    const outfitLines = items.map((it, idx) => {
      const catLabel =
        it.category === 'tops'
          ? 'UPPER BODY (Top/Shirt/Sweater)'
          : it.category === 'bottoms'
            ? 'LOWER BODY (Pants/Joggers/Romper/Shorts)'
            : it.category === 'shoes'
              ? 'FEET (Socks/Shoes)'
              : 'ACCESSORY (Bib/Hat)';
      return `${idx + 1}. ${catLabel}: ${it.name} (color: ${it.color || 'as shown'}, type: ${it.subType || it.category})`;
    });

    const hasTop = items.some((i) => i.category === 'tops');
    const hasBottom = items.some((i) => i.category === 'bottoms');
    const hasShoes = items.some((i) => i.category === 'shoes');

    const parts = [
      {
        text: `Edit the first studio photograph of this exact standing 7-month-old baby boy.
STRICT MODEL PRESERVATION RULES:
- Keep his exact adorable face, facial expression, eyes, nose, smile, head tilt, wavy jet-black hair, hand positions, leg stance, body proportions, and warm cream studio background (#fff8f2) 100% identical to the first reference photograph.
- Generate ONE SINGLE COHESIVE FULL-BODY PHOTOGRAPH of him wearing the following complete outfit naturally fitted together (never paste or cut separate regions):
${outfitLines.join('\n')}
- Cohesive fit rules:
  ${hasTop && hasBottom ? '- The hem of the top must naturally overlap the waistband of the pants/bottoms with realistic fabric drape and zero exposed belly gap.' : ''}
  ${!hasBottom ? '- Keep his white quilted baby diaper visible on his lower body.' : ''}
  ${hasBottom && hasShoes ? '- The ankle cuffs of the pants and the socks/shoes must meet seamlessly with zero blur or cutoff.' : ''}
  ${!hasShoes ? '- Keep his bare feet and baby toes clearly visible.' : ''}
- Photorealistic cotton/knit textures, natural studio lighting and soft shadows.`,
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: baseBabyBase64,
        },
      },
    ];

    // Adjuntar fotos de referencia de las prendas si están disponibles
    for (const it of items) {
      const url = it.photoUrl || it.tryOnUrl || '';
      if (url.startsWith('data:image/')) {
        const cleanData = url.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanData,
          },
        });
      } else if (url.startsWith('/')) {
        const localFile = [
          path.resolve(process.cwd(), 'public', url.slice(1)),
          path.resolve(process.cwd(), 'dist', url.slice(1)),
        ].find((p) => fs.existsSync(p));
        if (localFile) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: fs.readFileSync(localFile).toString('base64'),
            },
          });
        }
      }
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
      error: 'No se pudo generar la imagen completa del conjunto con IA en este momento.',
    });
  }
};
