// Script para revisar y descargar prendas y conjuntos nuevos subidos desde el celular a la bandeja de Antigravity
import fs from 'fs';
import path from 'path';

const APP_URL = process.env.BICHITO_APP_URL || 'https://alianapp.vercel.app';
const INBOX_DIR = path.resolve(process.cwd(), 'antigravity-inbox');

async function main() {
  console.log(`Consultando bandeja de ropa en ${APP_URL}/api/wardrobe-queue ...`);
  const res = await fetch(`${APP_URL}/api/wardrobe-queue`);
  if (!res.ok) {
    console.error('Error al consultar la bandeja:', res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const queue = Array.isArray(data.queue) ? data.queue : [];

  if (queue.length === 0) {
    console.log('✅ La bandeja está al día: no hay prendas ni conjuntos pendientes por generar.');
    return;
  }

  fs.mkdirSync(INBOX_DIR, { recursive: true });
  const manifest = [];

  for (const item of queue) {
    const safeId = String(item.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
    let savedPhotoPath = null;

    if (item.photoUrl && String(item.photoUrl).startsWith('data:image/')) {
      const b64 = String(item.photoUrl).replace(/^data:image\/\w+;base64,/, '');
      savedPhotoPath = path.join(INBOX_DIR, `${safeId}.jpg`);
      fs.writeFileSync(savedPhotoPath, Buffer.from(b64, 'base64'));
    }

    if (Array.isArray(item.outfitItems)) {
      item.outfitItems.forEach((sub, idx) => {
        if (sub.photoUrl && String(sub.photoUrl).startsWith('data:image/')) {
          const b64 = String(sub.photoUrl).replace(/^data:image\/\w+;base64,/, '');
          const subPath = path.join(INBOX_DIR, `${safeId}_part${idx + 1}.jpg`);
          fs.writeFileSync(subPath, Buffer.from(b64, 'base64'));
          sub.localPhotoPath = subPath;
        }
        delete sub.photoUrl;
      });
    }

    manifest.push({
      id: item.id,
      kind: item.kind,
      name: item.name,
      category: item.category,
      color: item.color,
      subType: item.subType,
      outfitKey: item.outfitKey,
      outfitItems: item.outfitItems,
      localPhotoPath: savedPhotoPath,
      createdAt: item.createdAt,
    });
  }

  const manifestPath = path.join(INBOX_DIR, 'pending-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`📥 Se descargaron ${queue.length} elemento(s) pendiente(s) en ${INBOX_DIR}`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error('Error en fetch-wardrobe-inbox:', err);
  process.exit(1);
});
