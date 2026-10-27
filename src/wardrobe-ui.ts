import { BabyStyle3D, ClothingCategory, ClothingItem } from './wardrobe3d';

let wardrobeApp: BabyStyle3D | null = null;

// Inicializa el probador 3D y su interfaz
export function initWardrobe3D() {
  const container = document.getElementById('wardrobe-root');
  if (!container) return;

  // Si ya está inicializado, solo refrescar vistas
  if (wardrobeApp) {
    renderWardrobeUI();
    return;
  }

  // Estructura HTML del probador 3D inspirada en BabyStyle 3D
  container.innerHTML = `
    <div class="wardrobe-container">
      <!-- Barra Superior -->
      <header class="wardrobe-header">
        <div class="wardrobe-title">
          <span class="wardrobe-icon">👗</span>
          <div>
            <h2>BabyStyle 3D</h2>
            <small>Probador virtual y catálogo inteligente</small>
          </div>
        </div>
        <div class="wardrobe-top-actions">
          <button id="btn-theme-bg" class="btn-tool" title="Cambiar Fondo">🎨 Fondo</button>
          <button id="btn-auto-rotate" class="btn-tool" title="Girar 360°">🔄 Auto 360°</button>
          <button id="btn-clear-outfit" class="btn-tool" title="Desvestir">🧹 Limpiar</button>
        </div>
      </header>

      <!-- Zona Principal: Categorías + Canvas 3D + Mis Combinaciones -->
      <div class="wardrobe-main-layout">
        <!-- Selector Lateral / Superior de Categorías -->
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
          
          <!-- Indicador flotante de rotación -->
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

      <!-- Carrusel Inferior de Prendas -->
      <footer class="wardrobe-carousel-tray">
        <div class="carousel-header">
          <span id="carousel-category-title" class="cat-current-name">Tops & Poleras</span>
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
        <p class="note">Sube o toma una foto de la prenda extendida sobre una mesa. La IA de Bichito detectará el color y la categoría en segundos.</p>
        
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
  `;

  // Inicializar instancia de Three.js
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

  // Botón Cambiar Fondo
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
  });

  // Guardar Look
  document.getElementById('btn-save-look-trigger')?.addEventListener('click', () => {
    if (!wardrobeApp) return;
    const name = prompt('Nombre para este conjunto (ej. Ropa de paseo, Pijama):');
    if (name) {
      wardrobeApp.saveCurrentOutfit(name);
      renderWardrobeUI();
      showWardrobeToast('¡Look guardado en Mis Combinaciones!');
    }
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

  document.getElementById('btn-upload-clothing')?.addEventListener('click', () => {
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

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      if (previewImg && uploadPrompt) {
        previewImg.src = base64;
        previewImg.classList.remove('hide');
        uploadPrompt.classList.add('hide');
      }

      // Analizar con Gemini
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
        if (colorInput && data.dominantColor) {
          colorInput.value = data.dominantColor;
          if (colorLabel) colorLabel.textContent = data.dominantColor;
        }
      } catch (err) {
        console.warn('Error en análisis IA:', err);
      } finally {
        if (aiStatus) aiStatus.classList.add('hide');
      }
    };
    reader.readAsDataURL(file);
  });

  // Confirmar añadir prenda
  document.getElementById('btn-confirm-add-clothing')?.addEventListener('click', () => {
    if (!wardrobeApp) return;
    const nameInput = document.getElementById('input-clothing-name') as HTMLInputElement;
    const catSelect = document.getElementById('select-clothing-category') as HTMLSelectElement;
    const color = colorInput?.value || '#df7446';
    const name = nameInput?.value.trim() || 'Prenda Nueva';
    const category = catSelect?.value as ClothingCategory || 'tops';
    const photoUrl = previewImg?.src || '';

    wardrobeApp.addCustomClothing({
      name,
      category,
      color,
      subType: category === 'tops' ? 'tshirt' : category === 'bottoms' ? 'pants' : 'shoes',
      photoUrl: photoUrl.startsWith('data:') ? photoUrl : undefined
    });

    modal?.close();
    renderWardrobeUI();
    showWardrobeToast(`¡"${name}" añadida y probada en el bebé!`);
  });
}

function renderWardrobeUI() {
  if (!wardrobeApp) return;

  const { items, currentOutfit, savedOutfits, activeCategory } = wardrobeApp.state;

  // 1. Actualizar botones de categoría activa
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    const cat = (btn as HTMLElement).dataset.cat;
    btn.classList.toggle('active', cat === activeCategory);
  });

  // Título de la categoría actual en carrusel
  const catTitleEl = document.getElementById('carousel-category-title');
  if (catTitleEl) {
    const titles: Record<ClothingCategory, string> = {
      tops: '👕 Tops, Poleras & Bodys',
      bottoms: '👖 Pantalones, Shorts & Faldas',
      shoes: '👟 Zapatitos & Calzado',
      accessories: '🧢 Gorritos & Accesorios'
    };
    catTitleEl.textContent = titles[activeCategory];
  }

  // 2. Renderizar carrusel de prendas
  const carousel = document.getElementById('clothing-carousel');
  if (carousel) {
    const filteredItems = items.filter(i => i.category === activeCategory);
    
    let html = `
      <button id="btn-add-quick" class="clothing-card add-card">
        <span class="card-add-icon">➕</span>
        <span class="card-name">Subir Foto</span>
      </button>
    `;

    filteredItems.forEach((item) => {
      const isSelected =
        (item.category === 'tops' && currentOutfit.topId === item.id) ||
        (item.category === 'bottoms' && currentOutfit.bottomId === item.id) ||
        (item.category === 'shoes' && currentOutfit.shoesId === item.id) ||
        (item.category === 'accessories' && currentOutfit.accessoryId === item.id);

      html += `
        <article class="clothing-card ${isSelected ? 'selected' : ''}" data-item-id="${item.id}">
          <div class="card-swatch" style="background: ${item.color}; border: 1px solid rgba(0,0,0,0.08);">
            ${item.photoUrl ? `<img src="${item.photoUrl}" class="swatch-photo" alt="" />` : `<span class="swatch-badge">${getCategoryEmoji(item.category)}</span>`}
          </div>
          <span class="card-name">${escapeHtml(item.name)}</span>
          <span class="card-status">${isSelected ? '✓ Puesto' : 'Probar'}</span>
        </article>
      `;
    });

    carousel.innerHTML = html;

    // Listeners en tarjetas del carrusel
    carousel.querySelectorAll('[data-item-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const itemId = (card as HTMLElement).dataset.itemId;
        const item = items.find(i => i.id === itemId);
        if (item && wardrobeApp) {
          wardrobeApp.selectClothing(item);
          renderWardrobeUI();
        }
      });
    });

    document.getElementById('btn-add-quick')?.addEventListener('click', () => {
      (document.getElementById('modal-upload-clothing') as HTMLDialogElement)?.showModal();
    });
  }

  // 3. Renderizar Mis Combinaciones (Looks)
  const looksContainer = document.getElementById('saved-looks-list');
  if (looksContainer) {
    if (savedOutfits.length === 0) {
      looksContainer.innerHTML = '<div class="empty-looks">Aún no tienes looks guardados. Arma una combinación y toca "Guardar Look".</div>';
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
            showWardrobeToast('¡Conjunto aplicado al bebé!');
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

// Exponer en window para que app.js lo invoque al entrar a la vista
(window as unknown as { initWardrobe3D: () => void }).initWardrobe3D = initWardrobe3D;
