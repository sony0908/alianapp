import { BabyStyle3D, ClothingCategory } from './wardrobe3d';

let wardrobeApp: BabyStyle3D | null = null;
let analyzedSubType: string | null = null;

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
          <span class="wardrobe-icon">👗</span>
          <div>
            <h2>Armario 3D de Bichito</h2>
            <small>Probador con tu bebé real y tu ropa</small>
          </div>
        </div>
        <div class="wardrobe-top-actions">
          <button id="btn-baby-face" class="btn-tool" title="Cambiar foto del rostro del bebé">👶 Rostro</button>
          <button id="btn-theme-bg" class="btn-tool" title="Cambiar Fondo de Estudio">🎨 Fondo</button>
          <button id="btn-auto-rotate" class="btn-tool" title="Giro 360°">🔄 360°</button>
          <button id="btn-clear-outfit" class="btn-tool" title="Dejar solo con pañal">🧹 Desvestir</button>
        </div>
      </header>

      <!-- Zona Principal: Categorías + Visor 3D + Mis Combinaciones -->
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

        <!-- Visor 3D Interactivo -->
        <main class="wardrobe-3d-stage">
          <div id="three-stage" class="three-viewport"></div>
          
          <div class="rotate-hint" id="rotate-hint">
            <span class="rotate-arrow">⤹ 360° ⤸</span>
            <span>Arrastra para girar al bebé</span>
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
          <h2>Añadir Ropa al Armario 3D</h2>
          <button class="x" id="btn-close-upload-modal">×</button>
        </div>
        <p class="note">Toma una foto de la prenda extendida. La IA detectará el nombre, color y tipo para vestir al bebé.</p>
        
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
            <input type="text" id="input-clothing-name" placeholder="Ej. Body blanco de algodón" />
          </label>
          
          <label class="field">Categoría
            <select id="select-clothing-category">
              <option value="tops">Top (Polera, Body, Suéter, Chaqueta)</option>
              <option value="bottoms">Bottom (Pantalón, Shorts, Falda)</option>
              <option value="shoes">Calzado (Zapatos, Zapatillas, Botitas)</option>
              <option value="accessories">Accesorio (Gorro, Babero)</option>
            </select>
          </label>

          <label class="field">Color principal
            <div class="color-picker-row">
              <input type="color" id="input-clothing-color" value="#df7446" />
              <span id="color-hex-label" class="color-hex-label">#df7446</span>
            </div>
          </label>

          <button id="btn-confirm-add-clothing" class="primary" style="margin-top: 18px;">✨ Guardar en mi Armario 3D</button>
        </div>
      </div>
    </dialog>

    <!-- Modal para Cambiar o Ajustar el Rostro del Bebé -->
    <dialog id="modal-baby-face" class="wardrobe-modal">
      <div class="sheet">
        <div class="head">
          <h2>Rostro del Bebé</h2>
          <button class="x" id="btn-close-face-modal">×</button>
        </div>
        <p class="note">Elige entre las fotos de tu bebé o sube una nueva foto frontal de su carita para actualizar el modelo 3D.</p>
        
        <div class="face-presets-grid">
          <button type="button" class="face-preset-btn" data-face-url="/baby-face.jpg">
            <img src="/baby-face.jpg" alt="Rostro tierno" />
            <span>Mirada al frente</span>
          </button>
          <button type="button" class="face-preset-btn" data-face-url="/baby-face-smile.jpg">
            <img src="/baby-face-smile.jpg" alt="Sonriendo" />
            <span>Sonriendo</span>
          </button>
        </div>

        <div class="upload-dropzone" id="face-dropzone" style="margin-top: 16px;">
          <input type="file" id="baby-face-input" accept="image/*" class="hide" />
          <div class="upload-prompt">
            <span class="upload-big-icon">👶</span>
            <b>Subir otra foto del rostro de tu bebé</b>
            <small>Recomendado: foto de frente y bien iluminada</small>
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

  setupEventListeners();
  renderWardrobeUI();
}

function setupEventListeners() {
  if (!wardrobeApp) return;

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

  // Botón Rostro del Bebé
  const faceModal = document.getElementById('modal-baby-face') as HTMLDialogElement;
  const faceInput = document.getElementById('baby-face-input') as HTMLInputElement;

  document.getElementById('btn-baby-face')?.addEventListener('click', () => {
    updateFacePresetSelection();
    faceModal?.showModal();
  });

  document.getElementById('btn-close-face-modal')?.addEventListener('click', () => {
    faceModal?.close();
  });

  document.querySelectorAll('[data-face-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = (btn as HTMLElement).dataset.faceUrl;
      if (url && wardrobeApp) {
        wardrobeApp.loadBabyFacePhoto(url);
        updateFacePresetSelection();
        faceModal?.close();
        showWardrobeToast('Rostro del bebé actualizado en el modelo 3D');
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

  // Botón Fondo
  document.getElementById('btn-theme-bg')?.addEventListener('click', () => {
    if (!wardrobeApp) return;
    const current = wardrobeApp.state.backgroundTheme;
    const next = current === 'studio' ? 'nursery' : current === 'nursery' ? 'minimal' : 'studio';
    wardrobeApp.applyTheme(next);
  });

  // Botón Auto 360°
  document.getElementById('btn-auto-rotate')?.addEventListener('click', (e) => {
    if (!wardrobeApp) return;
    const isRotating = wardrobeApp.toggleAutoRotate();
    const btn = e.currentTarget as HTMLElement;
    btn.classList.toggle('active', isRotating);
  });

  // Botón Limpiar/Desvestir
  document.getElementById('btn-clear-outfit')?.addEventListener('click', () => {
    wardrobeApp?.clearOutfit();
    renderWardrobeUI();
    showWardrobeToast('Bebé en pañal');
  });

  // Guardar Look (usando diálogo nativo en vez de window.prompt para compatibilidad con iFrame y WebView)
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
      category === 'shoes' ? 'shoes' : 'hat';

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
  const activeUrl = wardrobeApp.state.babyFaceUrl;
  document.querySelectorAll('[data-face-url]').forEach((btn) => {
    const url = (btn as HTMLElement).dataset.faceUrl;
    btn.classList.toggle('active', url === activeUrl);
  });
}

function renderWardrobeUI() {
  if (!wardrobeApp) return;

  const { items, currentOutfit, savedOutfits, activeCategory } = wardrobeApp.state;

  // 1. Selector de categorías
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    const cat = (btn as HTMLElement).dataset.cat;
    btn.classList.toggle('active', cat === activeCategory);
  });

  const catTitleEl = document.getElementById('carousel-category-title');
  if (catTitleEl) {
    const titles: Record<ClothingCategory, string> = {
      tops: '👕 Tops, Poleras & Bodys',
      bottoms: '👖 Pantalones, Shorts & Faldas',
      shoes: '👟 Zapatitos & Calzado',
      accessories: '🧢 Gorritos & Baberos'
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
          <small>Viste al bebé con tus prendas subidas y toca "Guardar Look".</small>
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
