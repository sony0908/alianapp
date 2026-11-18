const { config } = require('./_vault');

const BUCKET_ID = 'bichito-wardrobe-inbox';
const QUEUE_FILE = 'pending-queue.json';

async function ensureBucket() {
  const { url, key } = config();
  // Crear el bucket privado si aún no existe
  await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: BUCKET_ID,
      name: BUCKET_ID,
      public: false,
    }),
  }).catch(() => {});
}

async function readQueueFromStorage() {
  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET_ID}/${QUEUE_FILE}`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeQueueToStorage(queue) {
  const { url, key } = config();
  await ensureBucket();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET_ID}/${QUEUE_FILE}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: JSON.stringify(queue, null, 2),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Storage respondió ${res.status}: ${errText}`);
  }
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  try {
    config();
  } catch {
    return response.status(503).json({
      error: 'La base de datos Supabase no está configurada en Vercel.',
    });
  }

  try {
    if (request.method === 'GET') {
      const queue = await readQueueFromStorage();
      return response.status(200).json({
        queue,
        count: queue.length,
      });
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return response.status(405).json({ error: 'Método no permitido' });
    }

    const body =
      typeof request.body === 'string'
        ? JSON.parse(request.body || '{}')
        : request.body || {};

    const action = body.action || 'enqueue';
    let queue = await readQueueFromStorage();

    if (action === 'enqueue') {
      const item = body.item;
      if (!item || !item.name) {
        return response.status(400).json({ error: 'Faltan datos de la prenda o conjunto.' });
      }
      const entry = {
        id: item.id || `q-${Date.now()}`,
        kind: item.kind || 'garment', // 'garment' | 'outfit'
        name: String(item.name).slice(0, 120),
        category: item.category || 'tops',
        color: item.color || '#df7446',
        subType: item.subType || 'tshirt',
        photoUrl: item.photoUrl || '',
        outfitItems: Array.isArray(item.outfitItems) ? item.outfitItems : undefined,
        outfitKey: item.outfitKey || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      queue = queue.filter(
        (q) => q.id !== entry.id && (!entry.outfitKey || q.outfitKey !== entry.outfitKey)
      );
      queue.push(entry);
      if (queue.length > 30) queue = queue.slice(-30);
    } else if (action === 'complete') {
      const completedId = body.id;
      queue = queue.filter((q) => q.id !== completedId && q.outfitKey !== completedId);
    } else if (action === 'clear') {
      queue = [];
    }

    await writeQueueToStorage(queue);

    return response.status(200).json({
      ok: true,
      count: queue.length,
      queue: queue.map((q) => ({
        id: q.id,
        kind: q.kind,
        name: q.name,
        category: q.category,
        color: q.color,
        subType: q.subType,
        outfitKey: q.outfitKey,
        status: q.status,
        createdAt: q.createdAt,
      })),
    });
  } catch (err) {
    console.error('Wardrobe queue error:', err);
    return response.status(500).json({
      error: err.message || 'No se pudo guardar en la bandeja de Antigravity.',
    });
  }
};
