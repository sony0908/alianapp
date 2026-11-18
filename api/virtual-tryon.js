// Handler serverless para generar UNA SOLA IMAGEN COMPLETA DEL CONJUNTO (sin unir recortes)
// manteniendo las reglas estrictas del modelo base de tu hijo en el estudio.
// Usa fetch nativo (sin depender de fs ni paquetes ESM externos en Vercel) y soporta
// tanto la API Interactions (gemini-nano-banana-2.1 / gemini-3.1-flash-image) como generateContent.

function extractImageFromInteraction(interaction) {
  if (interaction?.output_image?.data) {
    return {
      data: interaction.output_image.data,
      mimeType: interaction.output_image.mime_type || 'image/jpeg',
    };
  }
  const steps = interaction?.steps || [];
  for (const step of steps) {
    for (const part of step.content || []) {
      if (part.type === 'image' && part.data) {
        return { data: part.data, mimeType: part.mime_type || 'image/jpeg' };
      }
      if (part.inlineData?.data) {
        return {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/jpeg',
        };
      }
    }
  }
  return null;
}

function extractImageFromGenerateContent(result) {
  const parts = result?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/jpeg',
      };
    }
    if (part.inline_data?.data) {
      return {
        data: part.inline_data.data,
        mimeType: part.inline_data.mime_type || 'image/jpeg',
      };
    }
  }
  return null;
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({
      error:
        'Falta configurar la variable GEMINI_API_KEY en tu panel de Vercel (Settings > Environment Variables) para generar fotos nuevas con IA.',
    });
  }

  try {
    const body =
      typeof request.body === 'string'
        ? JSON.parse(request.body || '{}')
        : request.body || {};

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
      return response.status(400).json({
        error: 'Selecciona al menos una prenda para generar el conjunto.',
      });
    }

    // Obtener la imagen base de estudio del bebé (desde el body enviado por el cliente o por HTTP desde el mismo host)
    let baseBabyBase64 = '';
    if (body.baseModelImage && typeof body.baseModelImage === 'string') {
      baseBabyBase64 = body.baseModelImage.replace(/^data:image\/\w+;base64,/, '');
    } else {
      const proto = request.headers['x-forwarded-proto'] || 'https';
      const host = request.headers.host || 'alianapp.vercel.app';
      const baseRes = await fetch(`${proto}://${host}/bichito-studio-standing.jpg`);
      if (!baseRes.ok) {
        return response.status(500).json({
          error: 'No se pudo cargar la foto base de estudio del bebé.',
        });
      }
      const arrBuf = await baseRes.arrayBuffer();
      baseBabyBase64 = Buffer.from(arrBuf).toString('base64');
    }

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

    const promptText = `Edit the first studio photograph of this exact standing 7-month-old baby boy.
STRICT MODEL PRESERVATION RULES:
- Keep his exact adorable face, facial expression, eyes, nose, smile, head tilt, wavy jet-black hair, hand positions, leg stance, body proportions, and warm cream studio background (#fff8f2) 100% identical to the first reference photograph.
- Generate ONE SINGLE COHESIVE FULL-BODY PHOTOGRAPH of him wearing the following complete outfit naturally fitted together (never paste or cut separate regions):
${outfitLines.join('\n')}
- Cohesive fit rules:
  ${hasTop && hasBottom ? '- The hem of the top must naturally overlap the waistband of the pants/bottoms with realistic fabric drape and zero exposed belly gap.' : ''}
  ${!hasBottom ? '- Keep his white quilted baby diaper visible on his lower body.' : ''}
  ${hasBottom && hasShoes ? '- The ankle cuffs of the pants and the socks/shoes must meet seamlessly with zero blur or cutoff.' : ''}
  ${!hasShoes ? '- Keep his bare feet and baby toes clearly visible.' : ''}
- Photorealistic cotton/knit textures, natural studio lighting and soft shadows.`;

    // Recolectar imágenes de referencia de las prendas (en base64 enviadas por el cliente)
    const refImagesBase64 = [];
    for (const it of items) {
      const url = it.photoUrl || '';
      if (url.startsWith('data:image/')) {
        refImagesBase64.push(url.replace(/^data:image\/\w+;base64,/, ''));
      }
    }

    const errors = [];

    // 1. Intentar con la API moderna Interactions (gemini-nano-banana-2.1 y gemini-3.1-flash-image)
    const interactionModels = ['gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];
    for (const modelName of interactionModels) {
      try {
        const inputArr = [
          { type: 'text', text: promptText },
          { type: 'image', mime_type: 'image/jpeg', data: baseBabyBase64 },
          ...refImagesBase64.map((b64) => ({
            type: 'image',
            mime_type: 'image/jpeg',
            data: b64,
          })),
        ];

        const intRes = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/interactions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
              'Api-Revision': '2026-05-20',
            },
            body: JSON.stringify({
              model: modelName,
              store: false,
              input: inputArr,
            }),
          }
        );

        const intJson = await intRes.json().catch(() => ({}));
        if (intRes.ok) {
          const extracted = extractImageFromInteraction(intJson);
          if (extracted) {
            return response.status(200).json({
              tryOnImage: `data:${extracted.mimeType};base64,${extracted.data}`,
            });
          }
          errors.push(`${modelName}(int): no image in steps`);
        } else {
          errors.push(`${modelName}(int ${intRes.status}): ${intJson?.error?.message || 'err'}`);
        }
      } catch (e) {
        errors.push(`${modelName}(int): ${e.message || String(e)}`);
      }
    }

    // 2. Fallback por generateContent REST directo
    const genContentModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image', 'gemini-nano-banana-2.1'];
    for (const modelName of genContentModels) {
      try {
        const parts = [
          { text: promptText },
          { inline_data: { mime_type: 'image/jpeg', data: baseBabyBase64 } },
          ...refImagesBase64.map((b64) => ({
            inline_data: { mime_type: 'image/jpeg', data: b64 },
          })),
        ];

        const gcRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
              },
            }),
          }
        );

        const gcJson = await gcRes.json().catch(() => ({}));
        if (gcRes.ok) {
          const extracted = extractImageFromGenerateContent(gcJson);
          if (extracted) {
            return response.status(200).json({
              tryOnImage: `data:${extracted.mimeType};base64,${extracted.data}`,
            });
          }
          errors.push(`${modelName}(gc): no image in candidates`);
        } else {
          errors.push(`${modelName}(gc ${gcRes.status}): ${gcJson?.error?.message || 'err'}`);
        }
      } catch (e) {
        errors.push(`${modelName}(gc): ${e.message || String(e)}`);
      }
    }

    const rawErr = errors.join(' | ');
    const isFreeTierZeroQuota =
      /Free Tier|limit:\s*0|Quota exceeded/i.test(rawErr);

    return response.status(502).json({
      error: isFreeTierZeroQuota
        ? 'Tu GEMINI_API_KEY en Vercel está en el plan gratuito (Free Tier), donde Google tiene límite 0 para generar imágenes nuevas. Activa Pay-as-you-go en Google AI Studio para generar prendas nuevas con IA.'
        : `No se pudo generar la imagen con Gemini: ${errors[0] || 'Verifica tu GEMINI_API_KEY'}`,
      details: errors,
    });
  } catch (err) {
    console.error('Error en /api/virtual-tryon:', err);
    return response.status(500).json({
      error: `Error interno al generar conjunto: ${err.message || 'desconocido'}`,
    });
  }
};
