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

// Redimensiona imágenes en el cliente para ahorrar memoria y evitar límites de localStorage
function compressImageBase64(file: File, maxSize = 512): Promise<string> {
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

// Renderiza una prenda realista a medida sobre el retrato de estudio de tu hijo
function renderStudioGarmentSVG(
  topItem: ClothingItem | undefined,
  botItem: ClothingItem | undefined,
  shoeItem: ClothingItem | undefined,
  accItem: ClothingItem | undefined,
  showPacifier: boolean,
  pose: 'standing' | 'sitting'
): string {
  const defs: string[] = [];
  const layers: string[] = [];

  // Coordenadas calibradas sobre bichito-studio-standing.jpg (896x1200) y sitting (896x1200)
  const isSitting = pose === 'sitting';

  if (botItem) {
    const c = botItem.color || '#5e9dcc';
    const patId = `pat-bot-${botItem.id}`;
    if (botItem.photoUrl) {
      defs.push(`
        <pattern id="${patId}" patternUnits="userSpaceOnUse" width="420" height="420" x="238" y="610">
          <image href="${botItem.photoUrl}" x="0" y="0" width="420" height="420" preserveAspectRatio="xMidYMid slice" />
        </pattern>
      `);
    }
    const fill = botItem.photoUrl ? `url(#${patId})` : c;
    const isShorts = botItem.subType === 'shorts';

    if (!isSitting) {
      // Pose de pie: cintura (y=635) hasta rodillas (shorts y=825) o tobillos (pants y=1030)
      const legBottomY = isShorts ? 835 : 1032;
      layers.push(`
        <g filter="url(#garment-shadow)">
          <path d="
            M 332 636
            Q 448 656 566 636
            L 592 738
            L ${isShorts ? 596 : 586} ${legBottomY}
            Q 540 ${legBottomY + 18} 492 ${legBottomY}
            L 462 795
            Q 448 782 434 795
            L 404 ${legBottomY}
            Q 356 ${legBottomY + 18} 310 ${legBottomY}
            L 304 738
            Z
          " fill="${fill}" stroke="rgba(0,0,0,0.14)" stroke-width="3" />
          <!-- Pretina elástica realista -->
          <path d="M 330 634 Q 448 654 568 634 L 572 664 Q 448 682 326 664 Z" fill="${c}" filter="brightness(0.92)" opacity="0.92" />
          <!-- Costura central y pliegues suaves -->
          <path d="M 448 664 L 448 776" stroke="rgba(0,0,0,0.16)" stroke-width="2.5" fill="none" />
        </g>
      `);
    } else {
      // Pose sentado: cubre pañal y muslos abiertos
      const legY = isShorts ? 825 : 940;
      layers.push(`
        <g filter="url(#garment-shadow)">
          <path d="
            M 308 618
            Q 448 648 590 618
            Q 680 680 695 ${legY}
            Q 625 ${legY + 32} 555 ${legY - 10}
            L 485 775
            Q 448 790 410 775
            L 340 ${legY - 10}
            Q 270 ${legY + 32} 200 ${legY}
            Q 215 680 308 618
            Z
          " fill="${fill}" stroke="rgba(0,0,0,0.14)" stroke-width="3" />
        </g>
      `);
    }
  }

  if (topItem) {
    const c = topItem.color || '#df7446';
    const patId = `pat-top-${topItem.id}`;
    if (topItem.photoUrl) {
      defs.push(`
        <pattern id="${patId}" patternUnits="userSpaceOnUse" width="460" height="390" x="218" y="340">
          <image href="${topItem.photoUrl}" x="0" y="0" width="460" height="390" preserveAspectRatio="xMidYMid slice" />
        </pattern>
      `);
    }
    const fill = topItem.photoUrl ? `url(#${patId})` : c;
    const isLong = topItem.subType === 'sweater' || topItem.subType === 'jacket';
    const isBodysuit = topItem.subType === 'bodysuit' && !botItem;

    if (!isSitting) {
      // Mangas cortas vs mangas largas siguiendo los bracitos reales
      const leftArmOutX = isLong ? 198 : 238;
      const leftArmOutY = isLong ? 625 : 510;
      const leftArmInX = isLong ? 256 : 298;
      const leftArmInY = isLong ? 642 : 538;

      const rightArmOutX = isLong ? 698 : 658;
      const rightArmOutY = isLong ? 625 : 510;
      const rightArmInX = isLong ? 640 : 598;
      const rightArmInY = isLong ? 642 : 538;

      const bottomY = isBodysuit ? 765 : 658;

      layers.push(`
        <g filter="url(#garment-shadow)">
          <path d="
            M 366 364
            Q 448 404 530 364
            Q 596 376 626 422
            L ${rightArmOutX} ${rightArmOutY}
            Q ${(rightArmOutX + rightArmInX) / 2} ${rightArmOutY + 24} ${rightArmInX} ${rightArmInY}
            L 578 482
            L 574 ${bottomY}
            Q 448 ${bottomY + (isBodysuit ? 45 : 22)} 322 ${bottomY}
            L 318 482
            L ${leftArmInX} ${leftArmInY}
            Q ${(leftArmOutX + leftArmInX) / 2} ${leftArmOutY + 24} ${leftArmOutX} ${leftArmOutY}
            L 270 422
            Q 300 376 366 364
            Z
          " fill="${fill}" stroke="rgba(0,0,0,0.14)" stroke-width="3" />
          <!-- Cuello redondo acanalado -->
          <path d="M 362 364 Q 448 408 534 364 Q 448 424 362 364 Z" fill="${c}" filter="brightness(0.9)" stroke="rgba(0,0,0,0.15)" stroke-width="2" />
        </g>
      `);
    } else {
      const bottomY = 648;
      layers.push(`
        <g filter="url(#garment-shadow)">
          <path d="
            M 352 372
            Q 448 416 544 372
            Q 618 390 648 448
            L 682 548
            Q 642 568 606 552
            L 585 488
            L 588 ${bottomY}
            Q 448 ${bottomY + 28} 308 ${bottomY}
            L 311 488
            L 290 552
            Q 254 568 214 548
            L 248 448
            Q 278 390 352 372
            Z
          " fill="${fill}" stroke="rgba(0,0,0,0.14)" stroke-width="3" />
        </g>
      `);
    }
  }

  if (shoeItem) {
    const c = shoeItem.color || '#e0d6cc';
    if (!isSitting) {
      layers.push(`
        <g filter="url(#garment-shadow)">
          <!-- Zapatito izquierdo -->
          <ellipse cx="348" cy="1098" rx="68" ry="44" transform="rotate(-12 348 1098)" fill="${c}" stroke="rgba(0,0,0,0.18)" stroke-width="3" />
          <ellipse cx="344" cy="1114" rx="68" ry="22" transform="rotate(-12 344 1114)" fill="#fffdfb" opacity="0.92" />
          <!-- Zapatito derecho -->
          <ellipse cx="568" cy="1098" rx="68" ry="44" transform="rotate(12 568 1098)" fill="${c}" stroke="rgba(0,0,0,0.18)" stroke-width="3" />
          <ellipse cx="572" cy="1114" rx="68" ry="22" transform="rotate(12 572 1114)" fill="#fffdfb" opacity="0.92" />
        </g>
      `);
    } else {
      layers.push(`
        <g filter="url(#garment-shadow)">
          <ellipse cx="355" cy="995" rx="82" ry="52" transform="rotate(-8 355 995)" fill="${c}" stroke="rgba(0,0,0,0.18)" stroke-width="3" />
          <ellipse cx="575" cy="995" rx="82" ry="52" transform="rotate(8 575 995)" fill="${c}" stroke="rgba(0,0,0,0.18)" stroke-width="3" />
        </g>
      `);
    }
  }

  if (accItem) {
    const c = accItem.color || '#5e9dcc';
    if (accItem.subType === 'bib') {
      // Babero bandana como el que usa en las fotos reales
      layers.push(`
        <g filter="url(#garment-shadow)">
          <path d="
            M 348 356
            Q 448 396 548 356
            Q 572 445 454 512
            Q 448 516 442 512
            Q 324 445 348 356
            Z
          " fill="${c}" stroke="rgba(0,0,0,0.15)" stroke-width="3" />
        </g>
      `);
    } else {
      // Gorrito tejido suave sobre la cabecita
      layers.push(`
        <g filter="url(#garment-shadow)">
          <path d="
            M 304 205
            Q 315 72 448 72
            Q 581 72 592 205
            Q 448 175 304 205
            Z
          " fill="${c}" stroke="rgba(0,0,0,0.15)" stroke-width="3" />
          <path d="M 296 202 Q 448 168 600 202 L 596 232 Q 448 198 300 232 Z" fill="${c}" filter="brightness(0.92)" />
          <circle cx="448" cy="64" r="26" fill="${c}" filter="brightness(0.95)" />
        </g>
      `);
    }
  }

  if (showPacifier) {
    const py = isSitting ? 336 : 318;
    layers.push(`
      <g filter="url(#garment-shadow)">
        <rect x="412" y="${py - 18}" width="72" height="38" rx="19" fill="#5da9e9" stroke="#ffffff" stroke-width="2.5" />
        <circle cx="448" cy="${py}" r="12" fill="#f0c888" />
        <circle cx="448" cy="${py + 12}" r="14" fill="none" stroke="#ffffff" stroke-width="3.5" />
      </g>
    `);
  }

  return `
    <svg viewBox="0 0 896 1200" class="studio-garment-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="garment-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#2b1b10" flood-opacity="0.22" />
        </filter>
        ${defs.join('\n')}
      </defs>
      ${layers.join('\n')}
    </svg>
  `;
}

export function initWardrobe3D() {
  const container = document.getElementById('wardrobe-root');
  if (!container) return;

  if (wardrobeApp) {
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
            <small>Tu hijo real en estudio + giro 3D interactivo</small>
          </div>
        </div>
        <div class="wardrobe-top-actions">
          <button id="btn-mode-studio" class="btn-tool active" title="Ver a tu bebé real en estudio fotográfico">📸 Tu Bebé Real</button>
          <button id="btn-pose-toggle" class="btn-tool" title="Cambiar entre De pie y Sentado">🧍 De pie / Sentado</button>
          <button id="btn-mode-3d" class="btn-tool" title="Cambiar a muñeco 3D giratorio 360°">🔄 Vista 3D 360°</button>
          <button id="btn-pacifier" class="btn-tool" title="Poner o quitar chupete">🍼 Chupete</button>
          <button id="btn-baby-face" class="btn-tool" title="Personalizar rasgos o subir otra foto">⚙ Rasgos</button>
          <button id="btn-clear-outfit" class="btn-tool" title="Dejar solo con pañal">🧹 En pañal</button>
        </div>
      </header>

      <!-- Zona Principal: Categorías + Visor Híbrido (Estudio Real + 3D) + Mis Combinaciones -->
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
            <span class="cat-icon">👟</span>
            <span class="cat-label">Calzado</span>
          </button>
          <button class="cat-btn" data-cat="accessories">
            <span class="cat-icon">🧢</span>
            <span class="cat-label">Accesorios</span>
          </button>
        </aside>

        <!-- Visor Principal -->
        <main class="wardrobe-3d-stage" style="position: relative;">
          <!-- 1. Vista Estudio Fotorrealista de tu Hijo -->
          <div id="photo-studio-stage" class="photo-studio-viewport" style="position:relative; width:100%; height:430px; display:flex; align-items:center; justify-content:center; background:#faeedf; overflow:hidden;">
            <div style="position:relative; height:100%; aspect-ratio: 896 / 1200; max-width:100%; display:flex; align-items:center; justify-content:center;">
              <img id="studio-base-img" src="/bichito-studio-standing.jpg" alt="Tu bebé en estudio" style="width:100%; height:100%; object-fit:contain; display:block; user-select:none;" />
              <div id="studio-garment-overlay" style="position:absolute; inset:0; pointer-events:none;"></div>
            </div>
            <div class="rotate-hint" style="bottom: 12px;">
              <span>✨ Retrato de estudio generado con las fotos reales de tu hijo</span>
            </div>
          </div>

          <!-- 2. Visor 3D Interactivo 360° -->
          <div id="three-stage-wrapper" class="hide" style="position:relative; width:100%; height:430px;">
            <div id="three-stage" class="three-viewport" style="width:100%; height:430px;"></div>
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
          <span id="carousel-category-title" class="cat-current-name">Tops, Poleras & Bodys</span>
          <button id="btn-upload-clothing" class="btn-upload-badge">📷 ➕ Subir Foto de Ropa</button>
        </div>
        <div id="clothing-carousel" class="clothing-carousel"></div>
      </footer>
    </div>

    <!-- Modal para Subir y Analizar Ropa con Gemini AI -->
    <dialog id="modal-upload-clothing" class="wardrobe-modal">
      <div class="sheet">
        <div class="head">
          <h2>Añadir Ropa al Armario</h2>
          <button class="x" id="btn-close-upload-modal">×</button>
        </div>
        <p class="note">Toma una foto de la prenda extendida. La IA detectará el nombre, color y tipo para vestir a tu bebé.</p>
        
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
              <option value="bottoms">Bottom (Buzo, Pantalón, Shorts)</option>
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

          <button id="btn-confirm-add-clothing" class="primary" style="margin-top: 18px;">✨ Guardar y probar en mi bebé</button>
        </div>
      </div>
    </dialog>

    <!-- Modal para Personalizar Apariencia 3D del Bebé -->
    <dialog id="modal-baby-face" class="wardrobe-modal">
      <div class="sheet">
        <div class="head">
          <h2>Apariencia del Modelo 3D</h2>
          <button class="x" id="btn-close-face-modal">×</button>
        </div>
        <p class="note">Ajusta los rasgos de la vista 3D o proyecta una foto real.</p>

        <div class="appearance-section">
          <span class="appearance-label">Modo de rostro en vista 3D</span>
          <div class="chip-row">
            <button type="button" class="chip-btn" data-face-mode="photo">📷 Rostro Real de Estudio (Recomendado)</button>
            <button type="button" class="chip-btn" data-face-mode="sculpted3d">✨ 3D Esculpido</button>
          </div>
        </div>

        <div id="sculpted-controls">
          <div class="appearance-section">
            <span class="appearance-label">Tono de piel</span>
            <div class="chip-row">
              ${(Object.keys(SKIN_PRESETS) as SkinPresetKey[]).map(
                (k) => `<button type="button" class="chip-btn" data-skin="${k}"><i class="dot-swatch" style="background:${SKIN_PRESETS[k].base}"></i>${SKIN_PRESETS[k].label}</button>`
              ).join('')}
            </div>
          </div>

          <div class="appearance-section">
            <span class="appearance-label">Color de ojos</span>
            <div class="chip-row">
              ${(Object.keys(EYE_PRESETS) as EyePresetKey[]).map(
                (k) => `<button type="button" class="chip-btn" data-eye="${k}"><i class="dot-swatch" style="background:${EYE_PRESETS[k].mid}"></i>${EYE_PRESETS[k].label}</button>`
              ).join('')}
            </div>
          </div>

          <div class="appearance-section">
            <span class="appearance-label">Cabello 3D</span>
            <div class="chip-row">
              ${(Object.keys(HAIR_PRESETS) as HairPresetKey[]).map(
                (k) => `<button type="button" class="chip-btn" data-hair="${k}"><i class="dot-swatch" style="background:${HAIR_PRESETS[k].base}"></i>${HAIR_PRESETS[k].label}</button>`
              ).join('')}
            </div>
          </div>
        </div>

        <div class="upload-dropzone" id="face-dropzone" style="margin-top: 14px;">
          <input type="file" id="baby-face-input" accept="image/*" class="hide" />
          <div class="upload-prompt">
            <span class="upload-big-icon">👶</span>
            <b>Subir otra foto frontal de tu bebé</b>
            <small>Se aplicará al rostro 3D</small>
          </div>
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
          <input type="text" id="input-look-name" maxlength="40" placeholder="Ej. Ropa de paseo, Pijama de noche" />
        </label>
        <button id="btn-confirm-save-look" class="primary" style="margin-top: 18px;">💾 Guardar Combinación</button>
      </div>
    </dialog>
  `;

  wardrobeApp = new BabyStyle3D('three-stage');

  // Si aún no tiene prendas cargadas, agregamos las prendas reales que se ven en las fotos que enviaste para que puedas probarlas de inmediato
  if (wardrobeApp.state.items.length === 0) {
    wardrobeApp.state.items = [
      {
        id: 'real-hoodie-navy',
        category: 'tops',
        name: 'Polerón Azul Doggie Skate',
        color: '#263654',
        subType: 'sweater',
      },
      {
        id: 'real-tee-sky',
        category: 'tops',
        name: 'Polera Celeste Paseo',
        color: '#4e8bc4',
        subType: 'tshirt',
      },
      {
        id: 'real-joggers-grey',
        category: 'bottoms',
        name: 'Buzo Gris Melange',
        color: '#b8bdc4',
        subType: 'pants',
      },
      {
        id: 'real-romper-cream',
        category: 'bottoms',
        name: 'Jardinera Crema Animalitos',
        color: '#ece0cc',
        subType: 'shorts',
      },
      {
        id: 'real-socks-grey',
        category: 'shoes',
        name: 'Calcetines Grises Suaves',
        color: '#9aa0a6',
        subType: 'shoes',
      },
      {
        id: 'real-bib-dino',
        category: 'accessories',
        name: 'Babero Bandana Azul',
        color: '#46639e',
        subType: 'bib',
      },
    ];
    wardrobeApp.saveState();
  }

  setupEventListeners();
  renderWardrobeUI();
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
    const baseImg = document.getElementById('studio-base-img') as HTMLImageElement;
    if (baseImg) {
      baseImg.src =
        studioPose === 'standing'
          ? '/bichito-studio-standing.jpg'
          : '/bichito-studio-sitting.jpg';
    }
    renderWardrobeUI();
    showWardrobeToast(studioPose === 'standing' ? 'Pose: De pie' : 'Pose: Sentado');
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

  // Botón Apariencia del Bebé 3D & Chupete
  const faceModal = document.getElementById('modal-baby-face') as HTMLDialogElement;
  const faceInput = document.getElementById('baby-face-input') as HTMLInputElement;
  const pacifierBtn = document.getElementById('btn-pacifier');
  if (pacifierBtn && wardrobeApp) {
    pacifierBtn.classList.toggle('active', wardrobeApp.state.showPacifier);
  }

  pacifierBtn?.addEventListener('click', () => {
    if (!wardrobeApp) return;
    const next = !wardrobeApp.state.showPacifier;
    wardrobeApp.setSculptedAppearance({ showPacifier: next });
    pacifierBtn.classList.toggle('active', next);
    renderWardrobeUI();
    showWardrobeToast(next ? 'Chupete puesto' : 'Chupete quitado');
  });

  document.getElementById('btn-baby-face')?.addEventListener('click', () => {
    updateFacePresetSelection();
    faceModal?.showModal();
  });

  document.getElementById('btn-close-face-modal')?.addEventListener('click', () => {
    faceModal?.close();
  });

  document.querySelectorAll('[data-face-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.faceMode as 'sculpted3d' | 'photo';
      if (wardrobeApp && mode) {
        wardrobeApp.setSculptedAppearance({ faceMode: mode });
        updateFacePresetSelection();
      }
    });
  });

  document.querySelectorAll('[data-skin]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skinPreset = (btn as HTMLElement).dataset.skin as SkinPresetKey;
      if (wardrobeApp && skinPreset) {
        wardrobeApp.setSculptedAppearance({ skinPreset });
        updateFacePresetSelection();
      }
    });
  });

  document.querySelectorAll('[data-eye]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eyePreset = (btn as HTMLElement).dataset.eye as EyePresetKey;
      if (wardrobeApp && eyePreset) {
        wardrobeApp.setSculptedAppearance({ eyePreset });
        updateFacePresetSelection();
      }
    });
  });

  document.querySelectorAll('[data-hair]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hairPreset = (btn as HTMLElement).dataset.hair as HairPresetKey;
      if (wardrobeApp && hairPreset) {
        wardrobeApp.setSculptedAppearance({ hairPreset });
        updateFacePresetSelection();
      }
    });
  });

  document.getElementById('face-dropzone')?.addEventListener('click', () => {
    faceInput?.click();
  });

  faceInput?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !wardrobeApp) return;
    try {
      const compressed = await compressImageBase64(file, 512);
      wardrobeApp.loadBabyFacePhoto(compressed);
      updateFacePresetSelection();
      faceModal?.close();
      showWardrobeToast('Nueva foto del rostro aplicada al bebé 3D');
    } catch (err) {
      console.warn('Error cargando foto del bebé:', err);
    }
  });

  // Botón Limpiar/Desvestir
  document.getElementById('btn-clear-outfit')?.addEventListener('click', () => {
    wardrobeApp?.clearOutfit();
    renderWardrobeUI();
    showWardrobeToast('Bebé en pañal');
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

  // Modal Subir Ropa
  const modal = document.getElementById('modal-upload-clothing') as HTMLDialogElement;
  const fileInput = document.getElementById('clothing-file-input') as HTMLInputElement;
  const dropzone = document.getElementById('dropzone');
  const previewImg = document.getElementById('upload-preview-img') as HTMLImageElement;
  const uploadPrompt = document.getElementById('upload-prompt');
  const aiStatus = document.getElementById('ai-loading-status');
  const colorInput = document.getElementById('input-clothing-color') as HTMLInputElement;
  const colorLabel = document.getElementById('color-hex-label');

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
      const base64 = await compressImageBase64(file, 512);
      if (previewImg && uploadPrompt) {
        previewImg.src = base64;
        previewImg.classList.remove('hide');
        uploadPrompt.classList.add('hide');
      }

      if (aiStatus) aiStatus.classList.remove('hide');
      try {
        const res = await fetch('/api/analyze-clothing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
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

  // Confirmar añadir prenda
  document.getElementById('btn-confirm-add-clothing')?.addEventListener('click', () => {
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
      category === 'tops' ? 'tshirt' :
      category === 'bottoms' ? 'pants' :
      category === 'shoes' ? 'shoes' : 'bib';

    wardrobeApp.addCustomClothing({
      name,
      category,
      color,
      subType: analyzedSubType || defaultSubType,
      photoUrl: photoUrl.startsWith('data:') ? photoUrl : undefined
    });

    modal?.close();
    renderWardrobeUI();
    showWardrobeToast(`¡"${name}" guardada y puesta en tu bebé!`);
  });
}

function updateFacePresetSelection() {
  if (!wardrobeApp) return;
  const { faceMode, skinPreset, eyePreset, hairPreset } = wardrobeApp.state;

  document.querySelectorAll('[data-face-mode]').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.faceMode === faceMode);
  });
  document.querySelectorAll('[data-skin]').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.skin === skinPreset);
  });
  document.querySelectorAll('[data-eye]').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.eye === eyePreset);
  });
  document.querySelectorAll('[data-hair]').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.hair === hairPreset);
  });
}

function renderWardrobeUI() {
  if (!wardrobeApp) return;

  const { items, currentOutfit, savedOutfits, activeCategory, showPacifier } = wardrobeApp.state;

  // Actualizar las prendas sobre el retrato de estudio real del bebé
  const studioOverlay = document.getElementById('studio-garment-overlay');
  if (studioOverlay) {
    const topItem = items.find((i) => i.id === currentOutfit.topId);
    const botItem = items.find((i) => i.id === currentOutfit.bottomId);
    const shoeItem = items.find((i) => i.id === currentOutfit.shoesId);
    const accItem = items.find((i) => i.id === currentOutfit.accessoryId);
    studioOverlay.innerHTML = renderStudioGarmentSVG(
      topItem,
      botItem,
      shoeItem,
      accItem,
      showPacifier,
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
      shoes: '👟 Calcetines & Zapatitos',
      accessories: '🧢 Baberos & Gorritos'
    };
    catTitleEl.textContent = titles[activeCategory];
  }

  // 2. Carrusel de Prendas Reales
  const carousel = document.getElementById('clothing-carousel');
  if (carousel) {
    const filteredItems = items.filter(i => i.category === activeCategory);

    let html = `
      <button id="btn-add-quick" class="clothing-card add-card">
        <span class="card-add-icon">➕</span>
        <span class="card-name">Subir Foto</span>
      </button>
    `;

    if (filteredItems.length === 0) {
      html += `
        <div class="empty-category-hint">
          <b>Aún no has subido prendas aquí</b>
          <small>Toca "Subir Foto" para fotografiar ropa real de tu bebé y clasificarla con IA.</small>
        </div>
      `;
    } else {
      filteredItems.forEach((item) => {
        const isSelected =
          (item.category === 'tops' && currentOutfit.topId === item.id) ||
          (item.category === 'bottoms' && currentOutfit.bottomId === item.id) ||
          (item.category === 'shoes' && currentOutfit.shoesId === item.id) ||
          (item.category === 'accessories' && currentOutfit.accessoryId === item.id);

        html += `
          <article class="clothing-card ${isSelected ? 'selected' : ''}" data-item-id="${item.id}">
            <button class="btn-del-item" data-del-item="${item.id}" title="Eliminar prenda">×</button>
            <div class="card-swatch" style="background: ${item.color};">
              ${item.photoUrl ? `<img src="${item.photoUrl}" class="swatch-photo" alt="" />` : `<span class="swatch-badge">${getCategoryEmoji(item.category)}</span>`}
            </div>
            <span class="card-name">${escapeHtml(item.name)}</span>
            <span class="card-status">${isSelected ? '✓ Puesto' : 'Probar'}</span>
          </article>
        `;
      });
    }

    carousel.innerHTML = html;

    carousel.querySelectorAll('[data-item-id]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('btn-del-item')) return;
        const itemId = (card as HTMLElement).dataset.itemId;
        const item = items.find(i => i.id === itemId);
        if (item && wardrobeApp) {
          wardrobeApp.selectClothing(item);
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
          <small>Viste al bebé con tus prendas y toca "Guardar Look".</small>
        </div>
      `;
    } else {
      looksContainer.innerHTML = savedOutfits.map((outfit) => {
        const top = items.find(i => i.id === outfit.topId);
        const bot = items.find(i => i.id === outfit.bottomId);
        const sho = items.find(i => i.id === outfit.shoesId);

        return `
          <div class="look-card" data-outfit-id="${outfit.id}">
            <div class="look-swatches">
              <span class="mini-swatch" style="background:${top?.color || '#eee'};" title="${top?.name || 'Top'}">👕</span>
              <span class="mini-swatch" style="background:${bot?.color || '#eee'};" title="${bot?.name || 'Pantalón'}">👖</span>
              <span class="mini-swatch" style="background:${sho?.color || '#eee'};" title="${sho?.name || 'Calzado'}">👟</span>
            </div>
            <div class="look-info">
              <b>${escapeHtml(outfit.name)}</b>
              <small>${outfit.createdAt}</small>
            </div>
            <button class="btn-wear-look">Poner</button>
          </div>
        `;
      }).join('');

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
    case 'tops': return '👕';
    case 'bottoms': return '👖';
    case 'shoes': return '👟';
    case 'accessories': return '🧢';
  }
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m] || m);
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
