(() => {
  const KEY = 'bichito-family-v1';
  const $ = (id) => document.getElementById(id);
  const empty = { health: [], milestones: [], stock: [] };
  let data;
  try { data = { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { data = structuredClone(empty); }
  const save = () => localStorage.setItem(KEY, JSON.stringify(data));
  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const esc = (text = '') => { const node = document.createElement('i'); node.textContent = text; return node.innerHTML; };
  const dateLabel = (value) => value ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Sin fecha';
  const babyProfile = () => { try { return JSON.parse(localStorage.getItem('bichito-v2') || '{}').profile || {}; } catch { return {}; } };
  const ageMonths = () => { const birth = babyProfile().birthDate; if (!birth) return null; return Math.max(0, Math.floor((Date.now() - new Date(`${birth}T12:00:00`)) / 2629800000)); };

  const style = document.createElement('style');
  style.textContent = `
    #family{margin-top:28px}.family-tabs{display:flex;gap:7px;overflow:auto;margin:18px 0 14px}.family-tabs button{white-space:nowrap;border:1px solid var(--l);background:var(--s);color:var(--i);padding:9px 12px;border-radius:14px;font-weight:750}.family-tabs button.active{border-color:var(--o);background:var(--os);color:var(--o)}.family-card{padding:16px;border:1px solid var(--l);border-radius:20px;background:var(--s);margin-top:10px}.family-card h2{font-size:1rem}.family-card p{color:var(--m);font-size:.85rem;line-height:1.45}.family-list{display:grid;gap:8px;margin-top:12px}.family-item{display:flex;align-items:center;gap:10px;padding:11px;border-radius:15px;background:#fff8f3}.family-item b,.family-item small{display:block}.family-item small{color:var(--m);margin-top:2px}.family-item .remove{margin-left:auto;border:0;background:transparent;color:var(--m);font-size:1.1rem}.family-add{margin-top:12px}.family-form-note{margin:12px 0;color:var(--m);font-size:.82rem;line-height:1.4}.family-photo{width:42px;height:42px;border-radius:12px;object-fit:cover}.family-flag{padding:10px;border-radius:14px;background:var(--bs);color:#386d92;font-size:.84rem;line-height:1.4;margin-top:9px}.family-warning{background:var(--os);color:#9a4b2d}.family-empty{padding:17px;border:1px dashed #d9cbbf;border-radius:15px;color:var(--m);font-size:.86rem;text-align:center}.family-fieldset{display:none}.family-fieldset.show{display:block}.family-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.family-grid .field{min-width:0}.bottom-nav{grid-template-columns:repeat(4,1fr)}
  `;
  document.head.append(style);

  const family = document.createElement('section');
  family.id = 'family'; family.className = 'hide';
  family.innerHTML = `<p class="date">Todo en un solo lugar</p><h1>Familia</h1><div class="family-tabs"><button data-family="health" class="active">Salud</button><button data-family="milestones">Avances</button><button data-family="stock">Stock</button><button data-family="plan">Planificar</button></div><div id="familyContent"></div>`;
  document.querySelector('main.app').append(family);
  const nav = document.querySelector('.nav');
  const navButton = document.createElement('button'); navButton.id = 'familyNav'; navButton.innerHTML = '☼<br>Familia'; nav.append(navButton);

  const dialog = document.createElement('dialog'); dialog.id = 'familyDialog';
  dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2 id="familyDialogTitle">Añadir</h2><button class="x" value="cancel">×</button></div><div id="familyForm"></div><button class="primary" id="familySave" value="default">Guardar</button></form>`;
  document.body.append(dialog);
  let mode = 'health';

  function items(list, emptyText, render) {
    return list.length ? `<div class="family-list">${list.map(render).join('')}</div>` : `<div class="family-empty">${emptyText}</div>`;
  }
  function remove(kind, id) { data[kind] = data[kind].filter((item) => item.id !== id); save(); render(); }
  function healthView() {
    return `<article class="family-card"><h2>Salud y controles</h2><p>Registra información indicada por tu equipo de salud. Bichito la organiza, no la interpreta clínicamente.</p><button class="primary family-add" data-add="health">Añadir registro de salud</button>${items(data.health.slice().sort((a,b) => b.date.localeCompare(a.date)), 'Aún no hay controles, vacunas ni registros de salud.', (item) => `<div class="family-item"><span>${item.icon}</span><div><b>${esc(item.title)}</b><small>${dateLabel(item.date)}${item.detail ? ` · ${esc(item.detail)}` : ''}</small></div><button class="remove" data-remove="health:${item.id}">×</button></div>`)}</article>`;
  }
  function milestoneView() {
    return `<article class="family-card"><h2>Avances de ${esc(babyProfile().name || 'Bichito')}</h2><p>Registros observados por la familia; no son una evaluación del desarrollo.</p><button class="primary family-add" data-add="milestones">Registrar avance</button>${items(data.milestones.slice().sort((a,b) => b.date.localeCompare(a.date)), 'Aún no hay avances registrados.', (item) => `<div class="family-item">${item.photo ? `<img class="family-photo" src="${item.photo}" alt="Foto del avance">` : '<span>✦</span>'}<div><b>${esc(item.title)}</b><small>${dateLabel(item.date)}${item.note ? ` · ${esc(item.note)}` : ''}</small></div><button class="remove" data-remove="milestones:${item.id}">×</button></div>`)}</article>`;
  }
  function stockView() {
    const low = data.stock.filter((item) => Number(item.quantity) <= Number(item.minimum));
    return `<article class="family-card"><h2>Stock del bebé</h2><p>Registra unidades, talla, mínimos y vencimientos. La lista de compras se actualiza sola.</p><button class="primary family-add" data-add="stock">Añadir producto</button>${low.length ? `<div class="family-flag family-warning">Hay ${low.length} producto${low.length === 1 ? '' : 's'} en o bajo su mínimo.</div>` : ''}${items(data.stock, 'Aún no hay productos en el inventario.', (item) => `<div class="family-item"><span>${item.category === 'Ropa' ? '◒' : item.category === 'Pañales' ? '◌' : item.category === 'Toallitas' ? '▤' : '◍'}</span><div><b>${esc(item.name)}${item.size ? ` · ${esc(item.size)}` : ''}</b><small>${item.quantity} ${esc(item.unit || 'unid.')} · mínimo ${item.minimum}${item.expiry ? ` · vence ${dateLabel(item.expiry)}` : ''}</small></div><button class="remove" data-remove="stock:${item.id}">×</button></div>`)}</article>`;
  }
  function planView() {
    const months = ageMonths();
    const low = data.stock.filter((item) => Number(item.quantity) <= Number(item.minimum));
    const expiring = data.stock.filter((item) => item.expiry && new Date(`${item.expiry}T23:59:59`) - Date.now() < 2592000000 && new Date(`${item.expiry}T23:59:59`) > Date.now());
    const stage = months === null ? 'Añade la fecha de nacimiento en Ajustes para activar la planificación por etapa.' : months < 4 ? 'En los próximos dos meses: revisa la siguiente talla de ropa, pañales y un espacio seguro para el movimiento.' : months < 10 ? 'En los próximos dos meses: revisa la siguiente talla, alimentación indicada por su pediatra y seguridad del espacio de exploración.' : 'En los próximos dos meses: revisa tallas, comida, movilidad segura y los productos que más consume.';
    return `<article class="family-card"><h2>Planificar con anticipación</h2><div class="family-flag">${stage}</div>${low.length ? `<div class="family-flag family-warning"><b>Compra o revisa pronto:</b><br>${low.map((item) => esc(item.name)).join(', ')}.</div>` : '<div class="family-flag">Aún no hay alertas de stock. Define cantidades mínimas para recibir avisos.</div>'}${expiring.length ? `<div class="family-flag family-warning"><b>Vencimiento próximo:</b><br>${expiring.map((item) => esc(item.name)).join(', ')}.</div>` : ''}<p class="family-form-note">Los avisos son para organizar presupuesto y compras; tú decides qué necesita realmente tu familia.</p></article><article class="family-card"><h2>IA y lecturas</h2><p>Cuando conectemos Gemini de forma protegida, podrá resumir tus propios registros y ayudarte a preparar preguntas para controles. No entregará diagnósticos ni reemplazará indicaciones médicas.</p></article>`;
  }
  function render() {
    const content = $('familyContent'); if (!content) return;
    content.innerHTML = mode === 'health' ? healthView() : mode === 'milestones' ? milestoneView() : mode === 'stock' ? stockView() : planView();
    document.querySelectorAll('[data-family]').forEach((button) => { button.classList.toggle('active', button.dataset.family === mode); button.onclick = () => { mode = button.dataset.family; render(); }; });
    document.querySelectorAll('[data-add]').forEach((button) => button.onclick = () => openForm(button.dataset.add));
    document.querySelectorAll('[data-remove]').forEach((button) => { button.onclick = () => { const [kind, id] = button.dataset.remove.split(':'); if (confirm('¿Eliminar este registro?')) remove(kind, id); }; });
  }
  function field(label, id, type = 'text', extra = '') { return `<label class="field">${label}<input id="f_${id}" type="${type}" ${extra}></label>`; }
  function openForm(kind) {
    mode = kind; $('familyDialogTitle').textContent = kind === 'health' ? 'Registro de salud' : kind === 'milestones' ? 'Registrar avance' : 'Añadir producto';
    let body = '';
    if (kind === 'health') body = `<label class="field">Tipo<select id="f_type"><option value="Control">Control</option><option value="Peso y talla">Peso y talla</option><option value="Alimentación">Alimentación</option><option value="Vacuna">Vacuna</option><option value="Retiro de leche">Retiro de leche</option><option value="Cuidado por edad">Cuidado por edad</option></select></label>${field('Fecha','date','date')}<div class="family-grid">${field('Centro o lugar','place')}${field('Profesional o dosis','person')}</div>${field('Detalle o indicación','note')}<p class="family-form-note">Ejemplos: peso/talla, pauta indicada, cantidad retirada o fecha del próximo control.</p>`;
    if (kind === 'milestones') body = `<label class="field">Avance<select id="f_type"><option>Darse vuelta</option><option>Movilidad</option><option>Dientes</option><option>Gateo</option><option>Motricidad con las manos</option><option>Lenguaje / habla</option><option>Otro avance</option></select></label>${field('Fecha','date','date')}${field('Nota','note')}<label class="field">Foto opcional<input id="f_photo" type="file" accept="image/*"></label><p class="family-form-note">La foto queda guardada solo en este dispositivo.</p>`;
    if (kind === 'stock') body = `<label class="field">Categoría<select id="f_category"><option>Ropa</option><option>Pañales</option><option>Toallitas</option><option>Leche y comida</option></select></label>${field('Producto','name')}<div class="family-grid">${field('Talla o formato','size')}${field('Unidad','unit','text','placeholder="unid., paquetes, ml"')}</div><div class="family-grid">${field('Cantidad actual','quantity','number','min="0"')}${field('Mínimo deseado','minimum','number','min="0"')}</div>${field('Vencimiento opcional','expiry','date')}`;
    $('familyForm').innerHTML = body; $('f_date') && ($('f_date').value = new Date().toISOString().slice(0,10)); dialog.showModal();
    $('familySave').onclick = async (event) => { event.preventDefault(); await saveForm(kind); };
  }
  async function saveForm(kind) {
    const get = (id) => $("f_" + id)?.value?.trim() || '';
    if (kind === 'health') { const type = get('type'); data.health.push({ id: uid(), type, date: get('date'), title: type, detail: [get('place'), get('person'), get('note')].filter(Boolean).join(' · '), icon: type === 'Vacuna' ? '✚' : type === 'Peso y talla' ? '↗' : type === 'Retiro de leche' ? '◌' : '◷' }); }
    if (kind === 'stock') { if (!get('name')) return; data.stock.push({ id: uid(), category: get('category'), name: get('name'), size: get('size'), unit: get('unit'), quantity: get('quantity') || '0', minimum: get('minimum') || '0', expiry: get('expiry') }); }
    if (kind === 'milestones') { const file = $('f_photo').files[0]; const photo = file ? await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }) : ''; data.milestones.push({ id: uid(), title: get('type'), date: get('date'), note: get('note'), photo }); }
    save(); dialog.close(); render();
  }
  function showFamily() { $('today').classList.add('hide'); $('history').classList.add('hide'); family.classList.remove('hide'); document.querySelectorAll('[data-view]').forEach((button) => button.classList.remove('active')); navButton.classList.add('active'); render(); }
  navButton.onclick = showFamily;
  document.querySelectorAll('[data-view]').forEach((button) => { const original = button.onclick; button.onclick = (event) => { family.classList.add('hide'); navButton.classList.remove('active'); original?.call(button, event); }; });
  render();
})();
