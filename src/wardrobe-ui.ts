import { BabyStyle3D, ClothingCategory, ClothingItem } from './wardrobe3d';
import {
  EYE_PRESETS,
  EyePresetKey,
  HAIR_PRESETS,
  HairPresetKey,
  SKIN_PRESETS,
  SkinPresetKey,
} from './babyAssets';

let wardrobeApp: BabyStyle3D | null = null;
let analyzedSubType: string | null = null;
let viewMode: 'photoStudio' | '3d' = 'photoStudio';
let studioPose: 'standing' | 'sitting' = 'standing';

// Imágenes fotorrealistas pregeneradas con las prendas reales de las fotos de tu hijo
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

// Carga una imagen como HTMLImageElement
const imageCache = new Map<string, HTMLImageElement>();
function loadImg(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Compone fotorrealísticamente la imagen de estudio de tu hijo combinando las fotografías generadas
 * de cada prenda real por zonas anatómicas con transición suave (feathered alpha mask),
 * de modo que NUNCA se vea un dibujo plano encima, sino la ropa real con sus pliegues y sombras.
 */
async function renderPhotorealisticStudioCanvas(
  canvas: HTMLCanvasElement,
  topItem: ClothingItem | undefined,
  botItem: ClothingItem | undefined,
  shoeItem: ClothingItem | undefined,
  accItem: ClothingItem | undefined,
  pose: 'standing' | 'sitting'
) {
  const W = 896;
  const H = 1200;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d')!;

  const baseSrc =
    pose === 'standing'
      ? '/bichito-studio-standing.jpg'
      : '/bichito-studio-sitting.jpg';

  try {
    const baseImg = await loadImg(baseSrc);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(baseImg, 0, 0, W, H);
  } catch {
    return;
  }

  // En pose sentado mostramos el retrato limpio sentado
  if (pose === 'sitting') return;

  // Función auxiliar para fundir una región horizontal (yStart..yEnd) con borde difuminado suave (feather)
  const blendLayerRegion = async (
    imgUrl: string,
    yStart: number,
    yEnd: number,
    featherTop = 28,
    featherBottom = 28
  ) => {
    try {
      const layerImg = await loadImg(imgUrl);
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const oCtx = off.getContext('2d')!;
      oCtx.drawImage(layerImg, 0, 0, W, H);

      oCtx.globalCompositeOperation = 'destination-in';
      const grad = oCtx.createLinearGradient(0, yStart - featherTop, 0, yEnd + featherBottom);
      const totalSpan = yEnd + featherBottom - (yStart - featherTop);
      const stop1 = Math.max(0.01, Math.min(0.45, featherTop / totalSpan));
      const stop2 = Math.max(0.55, Math.min(0.99, 1 - featherBottom / totalSpan));

      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(stop1, 'rgba(0,0,0,1)');
      grad.addColorStop(stop2, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      oCtx.fillStyle = grad;
      oCtx.fillRect(0, Math.max(0, yStart - featherTop), W, totalSpan);

      ctx.drawImage(off, 0, 0);
    } catch (e) {
      console.warn('Error cargando imagen de prenda real:', imgUrl, e);
    }
  };

  // Caso especial: Jardinera crema (es un conjunto entero que ya trae la polera celeste debajo)
  if (botItem?.id === 'real-romper-cream' && botItem.tryOnUrl) {
    await blendLayerRegion(botItem.tryOnUrl, 315, 920, 26, 30);
  } else {
    // 1. Bottom (Buzo / Pantalón): desde la cintura (y=612) hasta los tobillos (y=1030)
    if (botItem?.tryOnUrl) {
      await blendLayerRegion(botItem.tryOnUrl, 615, 1028, 28, 22);
    }

    // 2. Top (Polerón / Polera): desde el cuello/hombros (y=310) hasta la cintura (y=685)
    // Se dibuja después del pantalón para que la caída del polerón o polera cubra naturalmente la pretina del pantalón
    if (topItem?.tryOnUrl) {
      const bottomEdge = botItem?.tryOnUrl ? 672 : 715;
      await blendLayerRegion(topItem.tryOnUrl, 305, bottomEdge, 24, 26);
    }
  }

  // 3. Calzado / Calcetines: desde el tobillo (y=985) hasta la punta de los pies (y=1185)
  if (shoeItem?.tryOnUrl) {
    await blendLayerRegion(shoeItem.tryOnUrl, 988, 1185, 22, 10);
  }

  // 4. Accesorios (Babero bandana o gorrito): si es babero, va sobre el cuello y pecho alto (y=315..520)
  if (accItem?.tryOnUrl) {
    if (accItem.subType === 'bib' && !topItem) {
      await blendLayerRegion(accItem.tryOnUrl, 318, 535, 22, 28);
    } else if (accItem.subType === 'bib' && topItem) {
      // Recorte suave en V solo para el babero sobre la polera
      try {
        const bibImg = await loadImg(accItem.tryOnUrl);
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const oCtx = off.getContext('2d')!;
        oCtx.save();
        oCtx.beginPath();
        oCtx.moveTo(335, 318);
        oCtx.quadraticCurveTo(448, 348, 561, 318);
        oCtx.quadraticCurveTo(585, 455, 448, 520);
        oCtx.quadraticCurveTo(311, 455, 335, 318);
        oCtx.closePath();
        oCtx.clip();
        oCtx.drawImage(bibImg, 0, 0, W, H);
        oCtx.restore();
        ctx.drawImage(off, 0, 0);
      } catch {}
    } else {
      await blendLayerRegion(accItem.tryOnUrl, 30, 260, 15, 25);
    }
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
            <small>Fotos reales de tu bebé con cada prenda puesta</small>
          </div>
        </div>
        <div class="wardrobe-top-actions">
          <button id="btn-mode-studio" class="btn-tool active" title="Ver a tu bebé real en estudio fotográfico">📸 Tu Bebé Real</button>
          <button id="btn-pose-toggle" class="btn-tool" title="Cambiar entre De pie y Sentado">🧍 De pie / Sentado</button>
          <button id="btn-mode-3d" class="btn-tool" title="Cambiar a muñeco 3D giratorio 360°">🔄 Vista 3D 360°</button>
          <button id="btn-clear-outfit" class="btn-tool" title="Dejar solo con pañal">🧹 En pañal</button>
        </div>
      </header>

      <!-- Zona Principal: Categorías + Visor Fotorrealista + Mis Combinaciones -->
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

        <!-- Visor Principal -->
        <main class="wardrobe-3d-stage" style="position: relative;">
          <!-- 1. Vista Estudio Fotorrealista de tu Hijo -->
          <div id="photo-studio-stage" class="photo-studio-viewport" style="position:relative; width:100%; height:450px; display:flex; align-items:center; justify-content:center; background:#f8ecde; overflow:hidden;">
            <canvas id="studio-composite-canvas" width="896" height="1200" style="max-width:100%; max-height:100%; width:auto; height:100%; object-fit:contain; display:block;"></canvas>
            <div class="rotate-hint" style="bottom: 12px;">
              <span>✨ Toca cualquier prenda abajo para vérsela puesta de verdad</span>
            </div>
          </div>

          <!-- 2. Visor 3D Interactivo 360° -->
          <div id="three-stage-wrapper" class="hide" style="position:relative; width:100%; height:450px;">
            <div id="three-stage" class="three-viewport" style="width:100%; height:450px;"></div>
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
        <p class="note">Sube una foto de la prenda. Gemini AI analizará la ropa y <b>generará una foto real de tu hijo teniéndola puesta</b>.</p>
        
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

// Asegura que todas las prendas reales tengan su imagen fotorrealista asociada (incluso si el navegador tenía datos viejos en localStorage)
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

  // Si no hay ningún look puesto al iniciar por primera vez, le ponemos el Polerón Doggie Skate + Buzo Gris para que se vea vestido de verdad enseguida
  const { topId, bottomId, shoesId, accessoryId } = wardrobeApp.state.currentOutfit;
  if (!topId && !bottomId && !shoesId && !accessoryId && !localStorage.getItem('bichito-tryon-init-v2')) {
    wardrobeApp.state.currentOutfit.topId = 'real-hoodie-navy';
    wardrobeApp.state.currentOutfit.bottomId = 'real-joggers-grey';
    wardrobeApp.state.currentOutfit.shoesId = 'real-socks-grey';
    localStorage.setItem('bichito-tryon-init-v2', '1');
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
    showWardrobeToast(studioPose === 'standing' ? 'Pose: De pie (con probador de ropa)' : 'Pose: Sentado en estudio');
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
    showWardrobeToast('Bebé solo con pañal');
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

  // Confirmar añadir prenda y generar imagen fotorrealista con /api/virtual-tryon
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
      aiStatusText.textContent = 'Generando foto real de tu bebé con esta prenda puesta (10-15 s)...';
      aiStatus.classList.remove('hide');
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Vistiendo a tu bebé con IA...';

    try {
      const tryRes = await fetch('/api/virtual-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentImage: photoUrl.startsWith('data:') ? photoUrl : undefined,
          garmentDescription: `${name} (color ${color}, ${analyzedSubType || defaultSubType})`,
          category,
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

    wardrobeApp.addCustomClothing({
      name,
      category,
      color,
      subType: analyzedSubType || defaultSubType,
      photoUrl: photoUrl.startsWith('data:') ? photoUrl : undefined,
      tryOnUrl: generatedTryOnUrl,
    });

    modal?.close();
    renderWardrobeUI();
    showWardrobeToast(
      generatedTryOnUrl
        ? `¡Foto de tu bebé con "${name}" generada!`
        : `¡"${name}" guardada en tu armario!`
    );
  });
}

function renderWardrobeUI() {
  if (!wardrobeApp) return;

  const { items, currentOutfit, savedOutfits, activeCategory } = wardrobeApp.state;

  // Renderizar la composición fotorrealista en el canvas de estudio
  const studioCanvas = document.getElementById('studio-composite-canvas') as HTMLCanvasElement | null;
  if (studioCanvas) {
    const topItem = items.find((i) => i.id === currentOutfit.topId);
    const botItem = items.find((i) => i.id === currentOutfit.bottomId);
    const shoeItem = items.find((i) => i.id === currentOutfit.shoesId);
    const accItem = items.find((i) => i.id === currentOutfit.accessoryId);
    renderPhotorealisticStudioCanvas(
      studioCanvas,
      topItem,
      botItem,
      shoeItem,
      accItem,
      studioPose
    );
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

  // 2. Carrusel de Prendas Reales con miniatura de cómo le queda puesta
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
            renderWardrobeUI();
            showWardrobeToast('¡Conjunto puesto en el bebé!');
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
