import { BabyStyle3D, ClothingCategory, ClothingItem } from './wardrobe3d';

let wardrobeApp: BabyStyle3D | null = null;
let analyzedSubType: string | null = null;
let viewMode: 'photoStudio' | '3d' = 'photoStudio';
let studioPose: 'standing' | 'sitting' = 'standing';
let isGeneratingOutfit = false;

const OUTFIT_CACHE_KEY = 'bichito-outfit-renders-v1';

// Prendas reales de las fotos de tu hijo (cada una con su fotografía individual generada de cuerpo entero)
const DEFAULT_REAL_ITEMS: ClothingItem[] = [
  {
    id: 'real-hoodie-navy',
    category: 'tops',
    name: 'Polerón Azul Doggie Skate',
    color: '#263654',
    subType: 'sweater',
    tryOnUrl: '/tryon-hoodie-navy.jpg',
  },
  {
    id: 'real-tee-sky',
    category: 'tops',
    name: 'Polera Celeste Paseo',
    color: '#6ca0dc',
    subType: 'tshirt',
    tryOnUrl: '/tryon-tee-sky.jpg',
  },
  {
    id: 'real-joggers-grey',
    category: 'bottoms',
    name: 'Buzo Gris Melange',
    color: '#b8bdc4',
    subType: 'pants',
    tryOnUrl: '/tryon-joggers-grey.jpg',
  },
  {
    id: 'real-romper-cream',
    category: 'bottoms',
    name: 'Jardinera Crema Jirafas',
    color: '#ece0cc',
    subType: 'shorts',
    tryOnUrl: '/tryon-romper-cream.jpg',
  },
  {
    id: 'real-socks-grey',
    category: 'shoes',
    name: 'Calcetines Grises Tejidos',
    color: '#9aa0a6',
    subType: 'shoes',
    tryOnUrl: '/tryon-socks-grey.jpg',
  },
  {
    id: 'real-bib-dino',
    category: 'accessories',
    name: 'Babero Bandana Dinosaurios',
    color: '#5a738e',
    subType: 'bib',
    tryOnUrl: '/tryon-bib-dino.jpg',
  },
];

// Mapa completo de los 36 conjuntos posibles con sus prendas reales (todas las permutaciones tienen su foto completa instantánea)
// Clave: `${topId || '-'}|${bottomId || '-'}|${shoesId || '-'}|${accessoryId || '-'}`
const PREBUILT_FULL_OUTFITS: Record<string, string> = {
  // Sin top ni bottom
  '-|-|-|-': '/bichito-studio-standing.jpg',
  '-|-|real-socks-grey|-': '/tryon-socks-grey.jpg',
  '-|-|-|real-bib-dino': '/tryon-bib-dino.jpg',
  '-|-|real-socks-grey|real-bib-dino': '/outfit-socks-bib.jpg',

  // Solo Top (Polerón Azul Doggie Skate) + combinaciones de calcetines/babero
  'real-hoodie-navy|-|-|-': '/tryon-hoodie-navy.jpg',
  'real-hoodie-navy|-|real-socks-grey|-': '/outfit-hoodie-socks.jpg',
  'real-hoodie-navy|-|-|real-bib-dino': '/outfit-hoodie-bib.jpg',
  'real-hoodie-navy|-|real-socks-grey|real-bib-dino': '/outfit-hoodie-socks-bib.jpg',

  // Solo Top (Polera Celeste) + combinaciones de calcetines/babero
  'real-tee-sky|-|-|-': '/tryon-tee-sky.jpg',
  'real-tee-sky|-|real-socks-grey|-': '/outfit-tee-socks.jpg',
  'real-tee-sky|-|-|real-bib-dino': '/outfit-tee-bib.jpg',
  'real-tee-sky|-|real-socks-grey|real-bib-dino': '/outfit-tee-socks-bib.jpg',

  // Solo Bottom (Buzo Gris) + combinaciones de calcetines/babero
  '-|real-joggers-grey|-|-': '/tryon-joggers-grey.jpg',
  '-|real-joggers-grey|real-socks-grey|-': '/outfit-joggers-socks.jpg',
  '-|real-joggers-grey|-|real-bib-dino': '/outfit-joggers-bib.jpg',
  '-|real-joggers-grey|real-socks-grey|real-bib-dino': '/outfit-joggers-socks-bib.jpg',

  // Jardinera Crema Jirafas (con o sin Polera/Polerón seleccionado) + combinaciones de calcetines/babero
  '-|real-romper-cream|-|-': '/tryon-romper-cream.jpg',
  '-|real-romper-cream|real-socks-grey|-': '/outfit-romper-socks.jpg',
  '-|real-romper-cream|-|real-bib-dino': '/outfit-romper-bib.jpg',
  '-|real-romper-cream|real-socks-grey|real-bib-dino': '/outfit-romper-socks-bib.jpg',
  'real-tee-sky|real-romper-cream|-|-': '/tryon-romper-cream.jpg',
  'real-tee-sky|real-romper-cream|real-socks-grey|-': '/outfit-romper-socks.jpg',
  'real-tee-sky|real-romper-cream|-|real-bib-dino': '/outfit-romper-bib.jpg',
  'real-tee-sky|real-romper-cream|real-socks-grey|real-bib-dino': '/outfit-romper-socks-bib.jpg',
  'real-hoodie-navy|real-romper-cream|-|-': '/tryon-romper-cream.jpg',
  'real-hoodie-navy|real-romper-cream|real-socks-grey|-': '/outfit-romper-socks.jpg',
  'real-hoodie-navy|real-romper-cream|-|real-bib-dino': '/outfit-romper-bib.jpg',
  'real-hoodie-navy|real-romper-cream|real-socks-grey|real-bib-dino': '/outfit-romper-socks-bib.jpg',

  // Conjunto Polerón Doggie Skate + Buzo Gris + combinaciones de calcetines/babero
  'real-hoodie-navy|real-joggers-grey|-|-': '/outfit-hoodie-joggers.jpg',
  'real-hoodie-navy|real-joggers-grey|real-socks-grey|-': '/outfit-hoodie-joggers-socks.jpg',
  'real-hoodie-navy|real-joggers-grey|-|real-bib-dino': '/outfit-hoodie-joggers-bib.jpg',
  'real-hoodie-navy|real-joggers-grey|real-socks-grey|real-bib-dino': '/outfit-hoodie-joggers-socks-bib.jpg',

  // Conjunto Polera Celeste + Buzo Gris + combinaciones de calcetines/babero
  'real-tee-sky|real-joggers-grey|-|-': '/outfit-tee-joggers.jpg',
  'real-tee-sky|real-joggers-grey|real-socks-grey|-': '/outfit-tee-joggers-socks.jpg',
  'real-tee-sky|real-joggers-grey|-|real-bib-dino': '/outfit-tee-joggers-bib.jpg',
  'real-tee-sky|real-joggers-grey|real-socks-grey|real-bib-dino': '/outfit-tee-joggers-socks-bib.jpg',
};

function getOutfitKey(outfit: {
  topId: string | null;
  bottomId: string | null;
  shoesId: string | null;
  accessoryId: string | null;
}): string {
  return `${outfit.topId || '-'}|${outfit.bottomId || '-'}|${outfit.shoesId || '-'}|${outfit.accessoryId || '-'}`;
}

function loadOutfitCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OUTFIT_CACHE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveOutfitToCache(key: string, dataUrl: string) {
  try {
    const cache = loadOutfitCache();
    cache[key] = dataUrl;
    localStorage.setItem(OUTFIT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Límite de localStorage al guardar conjunto en caché:', e);
  }
}

// Redimensiona imágenes en el cliente para ahorrar memoria y evitar límites de localStorage
function compressImageBase64(file: File, maxSize = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Obtiene la URL de la fotografía única del conjunto completo (sin unir nunca partes por separado)
function resolveFullOutfitPhotoUrl(
  items: ClothingItem[],
  currentOutfit: {
    topId: string | null;
    bottomId: string | null;
    shoesId: string | null;
    accessoryId: string | null;
  },
  pose: 'standing' | 'sitting'
): { url: string; isExactMatch: boolean } {
  if (pose === 'sitting') {
    return { url: '/bichito-studio-sitting.jpg', isExactMatch: true };
  }

  const key = getOutfitKey(currentOutfit);

  // 1. Verificar conjuntos pregenerados de fábrica
  if (PREBUILT_FULL_OUTFITS[key]) {
    return { url: PREBUILT_FULL_OUTFITS[key], isExactMatch: true };
  }

  // 2. Verificar conjuntos ya generados por IA y guardados en caché local
  const cached = loadOutfitCache()[key];
  if (cached) {
    return { url: cached, isExactMatch: true };
  }

  // 3. Si solo hay 1 prenda seleccionada y tiene su foto completa individual (tryOnUrl)
  const selectedIds = [
    currentOutfit.topId,
    currentOutfit.bottomId,
    currentOutfit.shoesId,
    currentOutfit.accessoryId,
  ].filter(Boolean);

  if (selectedIds.length === 1) {
    const singleItem = items.find((i) => i.id === selectedIds[0]);
    if (singleItem?.tryOnUrl) {
      return { url: singleItem.tryOnUrl, isExactMatch: true };
    }
  }

  // 4. Si es una combinación nueva que aún no ha sido generada como foto única,
  // buscamos la foto completa más cercana mientras se genera la nueva con IA (sin cortar ni unir pedazos jamás)
  const withoutAccKey = `${currentOutfit.topId || '-'}|${currentOutfit.bottomId || '-'}|${currentOutfit.shoesId || '-'}|-`;
  if (PREBUILT_FULL_OUTFITS[withoutAccKey]) {
    return { url: PREBUILT_FULL_OUTFITS[withoutAccKey], isExactMatch: false };
  }
  const withoutShoesKey = `${currentOutfit.topId || '-'}|${currentOutfit.bottomId || '-'}|-|-`;
  if (PREBUILT_FULL_OUTFITS[withoutShoesKey]) {
    return { url: PREBUILT_FULL_OUTFITS[withoutShoesKey], isExactMatch: false };
  }
  const topItem = items.find((i) => i.id === currentOutfit.topId);
  if (topItem?.tryOnUrl) {
    return { url: topItem.tryOnUrl, isExactMatch: false };
  }
  const botItem = items.find((i) => i.id === currentOutfit.bottomId);
  if (botItem?.tryOnUrl) {
    return { url: botItem.tryOnUrl, isExactMatch: false };
  }

  return { url: '/bichito-studio-standing.jpg', isExactMatch: selectedIds.length === 0 };
}

// Genera una fotografía nueva completa del conjunto actual con Gemini siguiendo las reglas estrictas del modelo base
async function generateCurrentOutfitPhotoWithAI() {
  if (!wardrobeApp || isGeneratingOutfit) return;

  const { items, currentOutfit } = wardrobeApp.state;
  const selectedItems = [
    items.find((i) => i.id === currentOutfit.topId),
    items.find((i) => i.id === currentOutfit.bottomId),
    items.find((i) => i.id === currentOutfit.shoesId),
    items.find((i) => i.id === currentOutfit.accessoryId),
  ].filter(Boolean) as ClothingItem[];

  if (selectedItems.length === 0) {
    showWardrobeToast('Selecciona al menos una prenda para generar el conjunto');
    return;
  }

  const key = getOutfitKey(currentOutfit);
  isGeneratingOutfit = true;
  renderWardrobeUI();

  try {
    const res = await fetch('/api/virtual-tryon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: selectedItems.map((it) => ({
          id: it.id,
          category: it.category,
          name: it.name,
          color: it.color,
          subType: it.subType,
          photoUrl: it.photoUrl,
          tryOnUrl: it.tryOnUrl,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.tryOnImage) {
      throw new Error(data.error || 'No se pudo generar la foto del conjunto');
    }

    saveOutfitToCache(key, data.tryOnImage);
    showWardrobeToast('✨ ¡Fotografía completa del conjunto generada!');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al generar el conjunto con IA';
    showWardrobeToast(msg);
  } finally {
    isGeneratingOutfit = false;
    renderWardrobeUI();
  }
}

export function initWardrobe3D() {
  const container = document.getElementById('wardrobe-root');
  if (!container) return;

  if (wardrobeApp) {
    ensureRealTryOnItems();
    renderWardrobeUI();
    return;
  }

  container.innerHTML = `
    <div class="wardrobe-container">
      <!-- Barra Superior -->
      <header class="wardrobe-header">
        <div class="wardrobe-title">
          <span class="wardrobe-icon">👶</span>
          <div>
            <h2>Probador de Bichito</h2>
            <small>Fotografías completas por conjunto sobre el modelo base de tu hijo</small>
          </div>
        </div>
        <div class="wardrobe-top-actions">
          <button id="btn-mode-studio" class="btn-tool active" title="Ver a tu bebé real en estudio fotográfico">📸 Tu Bebé Real</button>
          <button id="btn-pose-toggle" class="btn-tool" title="Cambiar entre De pie y Sentado">🧍 De pie / Sentado</button>
          <button id="btn-mode-3d" class="btn-tool" title="Cambiar a muñeco 3D giratorio 360°">🔄 Vista 3D 360°</button>
          <button id="btn-clear-outfit" class="btn-tool" title="Dejar solo con pañal">🧹 En pañal</button>
        </div>
      </header>

      <!-- Zona Principal: Categorías + Visor Fotorrealista de Imagen Única + Mis Combinaciones -->
      <div class="wardrobe-main-layout">
        <!-- Selector Lateral de Categorías -->
        <aside class="wardrobe-categories">
          <button class="cat-btn active" data-cat="tops">
            <span class="cat-icon">👕</span>
            <span class="cat-label">Tops</span>
          </button>
          <button class="cat-btn" data-cat="bottoms">
            <span class="cat-icon">👖</span>
            <span class="cat-label">Bottoms</span>
          </button>
          <button class="cat-btn" data-cat="shoes">
            <span class="cat-icon">🧦</span>
            <span class="cat-label">Calzado</span>
          </button>
          <button class="cat-btn" data-cat="accessories">
            <span class="cat-icon">🧣</span>
            <span class="cat-label">Accesorios</span>
          </button>
        </aside>

        <!-- Visor Principal: Una sola fotografía generada por conjunto (CERO uniones ni recortes) -->
        <main class="wardrobe-3d-stage" style="position: relative;">
          <div id="photo-studio-stage" class="photo-studio-viewport" style="position:relative; width:100%; height:460px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f8ecde; overflow:hidden;">
            <img id="studio-full-outfit-img" src="/outfit-hoodie-joggers-socks.jpg" alt="Tu bebé con el conjunto puesto" style="max-width:100%; max-height:100%; width:auto; height:100%; object-fit:contain; display:block; transition: opacity 0.2s;" />
            
            <!-- Botón flotante cuando armas una combinación personalizada nueva para generarla de una pieza con IA -->
            <button id="btn-generate-combo-ai" class="hide" style="position:absolute; bottom:46px; left:50%; transform:translateX(-50%); background:var(--o); color:#fff; border:2px solid #fff; border-radius:99px; padding:10px 18px; font-size:0.82rem; font-weight:850; box-shadow:0 8px 24px rgba(38,49,59,0.28); z-index:3;">
              ✨ Generar foto completa de este conjunto con IA
            </button>

            <div class="rotate-hint" id="studio-outfit-caption" style="bottom: 10px;">
              <span>✨ Fotografía completa generada sobre el modelo base de tu hijo</span>
            </div>
          </div>

          <!-- 2. Visor 3D Interactivo 360° -->
          <div id="three-stage-wrapper" class="hide" style="position:relative; width:100%; height:460px;">
            <div id="three-stage" class="three-viewport" style="width:100%; height:460px;"></div>
            <div class="rotate-hint" id="rotate-hint">
              <span class="rotate-arrow">⤹ 360° ⤸</span>
              <span>Arrastra para girar el modelo 3D</span>
            </div>
          </div>
        </main>

        <!-- Panel Lateral: Mis Combinaciones Guardadas -->
        <aside class="wardrobe-looks-panel">
          <div class="looks-header">
            <h3>Mis Combinaciones</h3>
            <button id="btn-save-look-trigger" class="btn-save-look">💾 Guardar Look</button>
          </div>
          <div id="saved-looks-list" class="saved-looks-list"></div>
        </aside>
      </div>

      <!-- Carrusel Inferior de Prendas Reales -->
      <footer class="wardrobe-carousel-tray">
        <div class="carousel-header">
          <span id="carousel-category-title" class="cat-current-name">Tops, Poleras & Polerones</span>
          <button id="btn-upload-clothing" class="btn-upload-badge">📷 ➕ Subir y Generar con IA</button>
        </div>
        <div id="clothing-carousel" class="clothing-carousel"></div>
      </footer>
    </div>

    <!-- Modal para Subir y Generar Imagen Real de Ropa con Gemini AI -->
    <dialog id="modal-upload-clothing" class="wardrobe-modal">
      <div class="sheet">
        <div class="head">
          <h2>Probar Prenda Nueva con IA</h2>
          <button class="x" id="btn-close-upload-modal">×</button>
        </div>
        <p class="note">Sube una foto de la prenda. Gemini AI generará <b>una fotografía completa nueva</b> de tu hijo con el conjunto puesto respetando el modelo base.</p>
        
        <div class="upload-dropzone" id="dropzone">
          <input type="file" id="clothing-file-input" accept="image/*" class="hide" />
          <div id="upload-prompt" class="upload-prompt">
            <span class="upload-big-icon">📷</span>
            <b>Toca aquí para tomar foto o elegir de la galería</b>
            <small>Formatos JPG, PNG o WEBP</small>
          </div>
          <img id="upload-preview-img" class="upload-preview hide" alt="Vista previa" />
        </div>

        <div id="ai-loading-status" class="ai-loading hide">
          <span class="spinner">⏳</span>
          <span id="ai-status-text">Analizando prenda con Gemini AI...</span>
        </div>

        <div id="clothing-form-fields" class="details show">
          <label class="field">Nombre de la prenda
            <input type="text" id="input-clothing-name" placeholder="Ej. Polerón azul Doggie Skate" />
          </label>
          
          <label class="field">Categoría
            <select id="select-clothing-category">
              <option value="tops">Top (Polera, Body, Polerón, Chaqueta)</option>
              <option value="bottoms">Bottom (Buzo, Pantalón, Jardinera, Shorts)</option>
              <option value="shoes">Calzado (Calcetines, Zapatitos)</option>
              <option value="accessories">Accesorio (Babero, Gorro)</option>
            </select>
          </label>

          <label class="field">Color principal
            <div class="color-picker-row">
              <input type="color" id="input-clothing-color" value="#df7446" />
              <span id="color-hex-label" class="color-hex-label">#df7446</span>
            </div>
          </label>

          <button id="btn-confirm-add-clothing" class="primary" style="margin-top: 18px;">✨ Generar Foto en mi Bebé y Guardar</button>
        </div>
      </div>
    </dialog>

    <!-- Modal para Guardar Combinación -->
    <dialog id="modal-save-look" class="wardrobe-modal">
      <div class="sheet">
        <div class="head">
          <h2>Guardar Combinación</h2>
          <button class="x" id="btn-close-save-look">×</button>
        </div>
        <p class="note">Dale un nombre a este conjunto para volver a probárselo al bebé cuando quieras.</p>
        <label class="field">Nombre del conjunto
          <input type="text" id="input-look-name" maxlength="40" placeholder="Ej. Paseo con polerón Doggie Skate" />
        </label>
        <button id="btn-confirm-save-look" class="primary" style="margin-top: 18px;">💾 Guardar Combinación</button>
      </div>
    </dialog>
  `;

  wardrobeApp = new BabyStyle3D('three-stage');
  ensureRealTryOnItems();

  setupEventListeners();
  renderWardrobeUI();
}

function ensureRealTryOnItems() {
  if (!wardrobeApp) return;
  let updated = false;

  DEFAULT_REAL_ITEMS.forEach((defItem) => {
    const existing = wardrobeApp!.state.items.find((i) => i.id === defItem.id);
    if (!existing) {
      wardrobeApp!.state.items.push({ ...defItem });
      updated = true;
    } else if (existing.tryOnUrl !== defItem.tryOnUrl) {
      existing.tryOnUrl = defItem.tryOnUrl;
      existing.name = defItem.name;
      updated = true;
    }
  });

  // Conjunto inicial por defecto: Polerón Doggie Skate + Buzo Gris + Calcetines Grises (imagen única completa)
  const { topId, bottomId, shoesId, accessoryId } = wardrobeApp.state.currentOutfit;
  if (!topId && !bottomId && !shoesId && !accessoryId && !localStorage.getItem('bichito-tryon-init-v3')) {
    wardrobeApp.state.currentOutfit.topId = 'real-hoodie-navy';
    wardrobeApp.state.currentOutfit.bottomId = 'real-joggers-grey';
    wardrobeApp.state.currentOutfit.shoesId = 'real-socks-grey';
    localStorage.setItem('bichito-tryon-init-v3', '1');
    updated = true;
  }

  // Asegurar combinaciones guardadas de ejemplo con las fotos completas de sus conjuntos reales
  if (wardrobeApp.state.savedOutfits.length === 0) {
    wardrobeApp.state.savedOutfits = [
      {
        id: 'look-doggie-skate',
        name: 'Look Doggie Skate Completo',
        topId: 'real-hoodie-navy',
        bottomId: 'real-joggers-grey',
        shoesId: 'real-socks-grey',
        accessoryId: null,
        tryOnUrl: '/outfit-hoodie-joggers-socks.jpg',
        createdAt: 'Conjunto real',
      },
      {
        id: 'look-celeste-joggers',
        name: 'Polera Celeste + Buzo Gris',
        topId: 'real-tee-sky',
        bottomId: 'real-joggers-grey',
        shoesId: 'real-socks-grey',
        accessoryId: null,
        tryOnUrl: '/outfit-tee-joggers-socks.jpg',
        createdAt: 'Conjunto real',
      },
      {
        id: 'look-jardinera-jirafas',
        name: 'Jardinera Jirafas + Polera',
        topId: 'real-tee-sky',
        bottomId: 'real-romper-cream',
        shoesId: 'real-socks-grey',
        accessoryId: null,
        tryOnUrl: '/outfit-romper-socks.jpg',
        createdAt: 'Conjunto real',
      },
    ];
    updated = true;
  }

  if (updated) {
    wardrobeApp.updateOutfitMeshes();
    wardrobeApp.saveState();
  }
}

function setupEventListeners() {
  if (!wardrobeApp) return;

  const btnModeStudio = document.getElementById('btn-mode-studio');
  const btnMode3D = document.getElementById('btn-mode-3d');
  const btnPoseToggle = document.getElementById('btn-pose-toggle');
  const studioStage = document.getElementById('photo-studio-stage');
  const threeWrapper = document.getElementById('three-stage-wrapper');
  const btnGenCombo = document.getElementById('btn-generate-combo-ai');

  const updateViewMode = () => {
    const isStudio = viewMode === 'photoStudio';
    btnModeStudio?.classList.toggle('active', isStudio);
    btnMode3D?.classList.toggle('active', !isStudio);
    btnPoseToggle?.classList.toggle('hide', !isStudio);
    studioStage?.classList.toggle('hide', !isStudio);
    threeWrapper?.classList.toggle('hide', isStudio);
    if (!isStudio) {
      window.dispatchEvent(new Event('resize'));
    }
    renderWardrobeUI();
  };

  btnModeStudio?.addEventListener('click', () => {
    viewMode = 'photoStudio';
    updateViewMode();
  });

  btnMode3D?.addEventListener('click', () => {
    viewMode = '3d';
    updateViewMode();
  });

  btnPoseToggle?.addEventListener('click', () => {
    studioPose = studioPose === 'standing' ? 'sitting' : 'standing';
    renderWardrobeUI();
    showWardrobeToast(studioPose === 'standing' ? 'Pose: De pie' : 'Pose: Sentado en estudio');
  });

  btnGenCombo?.addEventListener('click', () => {
    generateCurrentOutfitPhotoWithAI();
  });

  // Selector de categorías
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = (btn as HTMLElement).dataset.cat as ClothingCategory;
      if (wardrobeApp) {
        wardrobeApp.state.activeCategory = cat;
        renderWardrobeUI();
      }
    });
  });

  // Botón Limpiar/Desvestir
  document.getElementById('btn-clear-outfit')?.addEventListener('click', () => {
    wardrobeApp?.clearOutfit();
    renderWardrobeUI();
    showWardrobeToast('Bebé en pañal (modelo base)');
  });

  // Guardar Look
  const saveLookModal = document.getElementById('modal-save-look') as HTMLDialogElement;
  const lookNameInput = document.getElementById('input-look-name') as HTMLInputElement;

  document.getElementById('btn-save-look-trigger')?.addEventListener('click', () => {
    if (!wardrobeApp) return;
    const { topId, bottomId, shoesId, accessoryId } = wardrobeApp.state.currentOutfit;
    if (!topId && !bottomId && !shoesId && !accessoryId) {
      showWardrobeToast('Primero viste al bebé con al menos una prenda antes de guardar el look.');
      return;
    }
    if (lookNameInput) lookNameInput.value = '';
    saveLookModal?.showModal();
  });

  document.getElementById('btn-close-save-look')?.addEventListener('click', () => {
    saveLookModal?.close();
  });

  document.getElementById('btn-confirm-save-look')?.addEventListener('click', () => {
    if (!wardrobeApp) return;
    const name = lookNameInput?.value.trim();
    if (!name) {
      showWardrobeToast('Escribe un nombre para guardar este conjunto');
      return;
    }
    wardrobeApp.saveCurrentOutfit(name);
    saveLookModal?.close();
    renderWardrobeUI();
    showWardrobeToast('¡Look guardado en Mis Combinaciones!');
  });

  // Modal Subir Ropa y Generar Imagen Real con Gemini AI
  const modal = document.getElementById('modal-upload-clothing') as HTMLDialogElement;
  const fileInput = document.getElementById('clothing-file-input') as HTMLInputElement;
  const dropzone = document.getElementById('dropzone');
  const previewImg = document.getElementById('upload-preview-img') as HTMLImageElement;
  const uploadPrompt = document.getElementById('upload-prompt');
  const aiStatus = document.getElementById('ai-loading-status');
  const aiStatusText = document.getElementById('ai-status-text');
  const colorInput = document.getElementById('input-clothing-color') as HTMLInputElement;
  const colorLabel = document.getElementById('color-hex-label');
  const confirmBtn = document.getElementById('btn-confirm-add-clothing') as HTMLButtonElement;

  const resetUploadModal = () => {
    analyzedSubType = null;
    if (fileInput) fileInput.value = '';
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('hide');
    }
    if (uploadPrompt) uploadPrompt.classList.remove('hide');
    const nameInput = document.getElementById('input-clothing-name') as HTMLInputElement;
    if (nameInput) nameInput.value = '';
    const catSelect = document.getElementById('select-clothing-category') as HTMLSelectElement;
    if (catSelect && wardrobeApp) catSelect.value = wardrobeApp.state.activeCategory;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '✨ Generar Foto en mi Bebé y Guardar';
    }
  };

  document.getElementById('btn-upload-clothing')?.addEventListener('click', () => {
    resetUploadModal();
    modal?.showModal();
  });

  document.getElementById('btn-close-upload-modal')?.addEventListener('click', () => {
    modal?.close();
  });

  dropzone?.addEventListener('click', () => {
    fileInput?.click();
  });

  colorInput?.addEventListener('input', () => {
    if (colorLabel) colorLabel.textContent = colorInput.value;
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const base64 = await compressImageBase64(file, 640);
      if (previewImg && uploadPrompt) {
        previewImg.src = base64;
        previewImg.classList.remove('hide');
        uploadPrompt.classList.add('hide');
      }

      if (aiStatus && aiStatusText) {
        aiStatusText.textContent = 'Analizando prenda con Gemini AI...';
        aiStatus.classList.remove('hide');
      }
      try {
        const res = await fetch('/api/analyze-clothing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });
        const data = await res.json();

        const nameInput = document.getElementById('input-clothing-name') as HTMLInputElement;
        const catSelect = document.getElementById('select-clothing-category') as HTMLSelectElement;

        if (nameInput && data.name) nameInput.value = data.name;
        if (catSelect && data.category) catSelect.value = data.category;
        if (data.subType) analyzedSubType = data.subType;
        if (colorInput && data.dominantColor) {
          colorInput.value = data.dominantColor;
          if (colorLabel) colorLabel.textContent = data.dominantColor;
        }
      } catch (err) {
        console.warn('Error en análisis IA:', err);
      } finally {
        if (aiStatus) aiStatus.classList.add('hide');
      }
    } catch (err) {
      console.warn('Error procesando imagen:', err);
    }
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!wardrobeApp) return;
    const nameInput = document.getElementById('input-clothing-name') as HTMLInputElement;
    const catSelect = document.getElementById('select-clothing-category') as HTMLSelectElement;
    const color = colorInput?.value || '#df7446';
    const name = nameInput?.value.trim();
    const category = (catSelect?.value as ClothingCategory) || 'tops';
    const photoUrl = previewImg?.src || '';

    if (!name) {
      showWardrobeToast('Escribe un nombre para tu prenda antes de guardarla');
      return;
    }

    const defaultSubType =
      category === 'tops'
        ? 'tshirt'
        : category === 'bottoms'
          ? 'pants'
          : category === 'shoes'
            ? 'shoes'
            : 'bib';

    let generatedTryOnUrl: string | undefined;

    if (aiStatus && aiStatusText) {
      aiStatusText.textContent = 'Generando fotografía completa de tu bebé con esta prenda puesta (10-15 s)...';
      aiStatus.classList.remove('hide');
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Generando fotografía completa con IA...';

    try {
      const tryRes = await fetch('/api/virtual-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              category,
              name,
              color,
              subType: analyzedSubType || defaultSubType,
              photoUrl: photoUrl.startsWith('data:') ? photoUrl : undefined,
            },
          ],
        }),
      });
      if (tryRes.ok) {
        const tryData = await tryRes.json();
        if (tryData.tryOnImage) {
          generatedTryOnUrl = tryData.tryOnImage;
        }
      }
    } catch (err) {
      console.warn('No se pudo generar try-on remoto:', err);
    } finally {
      if (aiStatus) aiStatus.classList.add('hide');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '✨ Generar Foto en mi Bebé y Guardar';
    }

    const added = wardrobeApp.addCustomClothing({
      name,
      category,
      color,
      subType: analyzedSubType || defaultSubType,
      photoUrl: photoUrl.startsWith('data:') ? photoUrl : undefined,
      tryOnUrl: generatedTryOnUrl,
    });

    if (generatedTryOnUrl) {
      // Dejar seleccionada únicamente la prenda recién generada o registrar el conjunto en caché
      const singleOutfit = {
        topId: category === 'tops' ? added.id : null,
        bottomId: category === 'bottoms' ? added.id : null,
        shoesId: category === 'shoes' ? added.id : null,
        accessoryId: category === 'accessories' ? added.id : null,
      };
      saveOutfitToCache(getOutfitKey(singleOutfit), generatedTryOnUrl);
    }

    modal?.close();
    renderWardrobeUI();
    showWardrobeToast(
      generatedTryOnUrl
        ? `¡Fotografía de tu bebé con "${name}" lista!`
        : `¡"${name}" guardada en tu armario!`
    );
  });
}

function renderWardrobeUI() {
  if (!wardrobeApp) return;

  const { items, currentOutfit, savedOutfits, activeCategory } = wardrobeApp.state;

  // Mostrar SIEMPRE una única fotografía completa (jamás unir recortes)
  const fullImgEl = document.getElementById('studio-full-outfit-img') as HTMLImageElement | null;
  const genComboBtn = document.getElementById('btn-generate-combo-ai') as HTMLButtonElement | null;
  const captionEl = document.getElementById('studio-outfit-caption');

  if (fullImgEl) {
    const { url, isExactMatch } = resolveFullOutfitPhotoUrl(items, currentOutfit, studioPose);
    if (fullImgEl.getAttribute('src') !== url) {
      fullImgEl.src = url;
    }
    fullImgEl.style.opacity = isGeneratingOutfit ? '0.55' : '1';

    if (genComboBtn) {
      if (isGeneratingOutfit) {
        genComboBtn.classList.remove('hide');
        genComboBtn.disabled = true;
        genComboBtn.textContent = '⏳ Generando foto única del conjunto con IA...';
      } else if (!isExactMatch && studioPose === 'standing') {
        genComboBtn.classList.remove('hide');
        genComboBtn.disabled = false;
        genComboBtn.textContent = '✨ Generar foto completa de este conjunto con IA';
      } else {
        genComboBtn.classList.add('hide');
      }
    }

    if (captionEl) {
      const activeNames = [
        items.find((i) => i.id === currentOutfit.topId)?.name,
        items.find((i) => i.id === currentOutfit.bottomId)?.name,
        items.find((i) => i.id === currentOutfit.shoesId)?.name,
        items.find((i) => i.id === currentOutfit.accessoryId)?.name,
      ].filter(Boolean);
      captionEl.innerHTML = `<span>${
        activeNames.length
          ? `👶 Usando: <b>${escapeHtml(activeNames.join(' + '))}</b>`
          : '👶 Modelo base de estudio (en pañal)'
      }</span>`;
    }
  }

  // 1. Selector de categorías
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    const cat = (btn as HTMLElement).dataset.cat;
    btn.classList.toggle('active', cat === activeCategory);
  });

  const catTitleEl = document.getElementById('carousel-category-title');
  if (catTitleEl) {
    const titles: Record<ClothingCategory, string> = {
      tops: '👕 Tops, Poleras & Polerones',
      bottoms: '👖 Pantalones, Buzos & Jardineras',
      shoes: '🧦 Calcetines & Zapatitos',
      accessories: '🧣 Baberos & Gorritos',
    };
    catTitleEl.textContent = titles[activeCategory];
  }

  // 2. Carrusel de Prendas Reales
  const carousel = document.getElementById('clothing-carousel');
  if (carousel) {
    const filteredItems = items.filter((i) => i.category === activeCategory);

    let html = `
      <button id="btn-add-quick" class="clothing-card add-card">
        <span class="card-add-icon">➕</span>
        <span class="card-name">Nueva Prenda IA</span>
      </button>
    `;

    if (filteredItems.length === 0) {
      html += `
        <div class="empty-category-hint">
          <b>Aún no has subido prendas aquí</b>
          <small>Toca "Nueva Prenda IA" para fotografiar ropa de tu bebé y vérsela puesta.</small>
        </div>
      `;
    } else {
      filteredItems.forEach((item) => {
        const isSelected =
          (item.category === 'tops' && currentOutfit.topId === item.id) ||
          (item.category === 'bottoms' && currentOutfit.bottomId === item.id) ||
          (item.category === 'shoes' && currentOutfit.shoesId === item.id) ||
          (item.category === 'accessories' && currentOutfit.accessoryId === item.id);

        const thumbSrc = item.tryOnUrl || item.photoUrl;

        html += `
          <article class="clothing-card ${isSelected ? 'selected' : ''}" data-item-id="${item.id}">
            <button class="btn-del-item" data-del-item="${item.id}" title="Eliminar prenda">×</button>
            <div class="card-swatch" style="background: ${item.color};">
              ${
                thumbSrc
                  ? `<img src="${thumbSrc}" class="swatch-photo" alt="${escapeHtml(item.name)}" />`
                  : `<span class="swatch-badge">${getCategoryEmoji(item.category)}</span>`
              }
            </div>
            <span class="card-name">${escapeHtml(item.name)}</span>
            <span class="card-status">${isSelected ? '✓ Puesto' : 'Ponerle'}</span>
          </article>
        `;
      });
    }

    carousel.innerHTML = html;

    carousel.querySelectorAll('[data-item-id]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('btn-del-item')) return;
        const itemId = (card as HTMLElement).dataset.itemId;
        const item = items.find((i) => i.id === itemId);
        if (item && wardrobeApp) {
          wardrobeApp.selectClothing(item);
          // Si selecciona la jardinera crema (que ya incluye su polera celeste), ajustamos el top automáticamente para mostrar el conjunto real exacto
          if (item.id === 'real-romper-cream' && wardrobeApp.state.currentOutfit.bottomId === 'real-romper-cream') {
            wardrobeApp.state.currentOutfit.topId = 'real-tee-sky';
          }
          if (studioPose !== 'standing') {
            studioPose = 'standing';
          }
          renderWardrobeUI();
        }
      });
    });

    carousel.querySelectorAll('[data-del-item]').forEach((delBtn) => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = (delBtn as HTMLElement).dataset.delItem;
        if (itemId && confirm('¿Deseas eliminar esta prenda de tu catálogo?')) {
          wardrobeApp?.deleteClothing(itemId);
          renderWardrobeUI();
          showWardrobeToast('Prenda eliminada del catálogo');
        }
      });
    });

    document.getElementById('btn-add-quick')?.addEventListener('click', () => {
      document.getElementById('btn-upload-clothing')?.click();
    });
  }

  // 3. Mis Combinaciones (Looks)
  const looksContainer = document.getElementById('saved-looks-list');
  if (looksContainer) {
    if (savedOutfits.length === 0) {
      looksContainer.innerHTML = `
        <div class="empty-looks">
          <b>Sin combinaciones guardadas</b>
          <small>Combina un Top + Pantalón + Calcetines y toca "Guardar Look".</small>
        </div>
      `;
    } else {
      looksContainer.innerHTML = savedOutfits
        .map((outfit) => {
          const top = items.find((i) => i.id === outfit.topId);
          const bot = items.find((i) => i.id === outfit.bottomId);
          const sho = items.find((i) => i.id === outfit.shoesId);

          return `
          <div class="look-card" data-outfit-id="${outfit.id}">
            <div class="look-swatches">
              <span class="mini-swatch" style="background:${top?.color || '#eee'};" title="${top?.name || 'Top'}">👕</span>
              <span class="mini-swatch" style="background:${bot?.color || '#eee'};" title="${bot?.name || 'Pantalón'}">👖</span>
              <span class="mini-swatch" style="background:${sho?.color || '#eee'};" title="${sho?.name || 'Calzado'}">🧦</span>
            </div>
            <div class="look-info">
              <b>${escapeHtml(outfit.name)}</b>
              <small>${outfit.createdAt}</small>
            </div>
            <button class="btn-wear-look">Poner</button>
          </div>
        `;
        })
        .join('');

      looksContainer.querySelectorAll('[data-outfit-id]').forEach((card) => {
        card.addEventListener('click', () => {
          const outfitId = (card as HTMLElement).dataset.outfitId;
          if (outfitId && wardrobeApp) {
            wardrobeApp.wearSavedOutfit(outfitId);
            if (studioPose !== 'standing') studioPose = 'standing';
            renderWardrobeUI();
            showWardrobeToast('¡Conjunto completo puesto en el bebé!');
          }
        });
      });
    }
  }
}

function getCategoryEmoji(cat: ClothingCategory): string {
  switch (cat) {
    case 'tops':
      return '👕';
    case 'bottoms':
      return '👖';
    case 'shoes':
      return '🧦';
    case 'accessories':
      return '🧣';
  }
}

function escapeHtml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m] || m
  );
}

function showWardrobeToast(msg: string) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }
}

(window as unknown as { initWardrobe3D: () => void }).initWardrobe3D = initWardrobe3D;
