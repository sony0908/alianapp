const SUPABASE_URL = "https://rpzvrqmdfyrkuvzrnndt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-dDAZOUN8dsZF6qR9jt1sQ_ZrB8hYu3";
const FAMILY_TABLE = "bichito_families";
const DATA_TABLE = "bichito_family_data";
const META_KEY = "bichito-cloud-v1";
const SYNCED_KEYS = ["bichito-v2", "bichito-family-v1", "bichito-ai-guidance-v1"];

const escapeHtml = (value = "") => {
  const node = document.createElement("i");
  node.textContent = value;
  return node.innerHTML;
};
const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
};
const readMeta = () => readJson(META_KEY, {});
const writeMeta = (value) => localStorage.setItem(META_KEY, JSON.stringify(value));
const payload = () => ({
  routines: readJson("bichito-v2", {}),
  family: readJson("bichito-family-v1", {}),
  guidance: localStorage.getItem("bichito-ai-guidance-v1") || "",
});

const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let session = null;
let family = null;
let applyingRemote = false;
let syncTimer = null;
let statusText = "Inicia sesión para activar la nube familiar.";
const cloudButton = document.getElementById("cloud");
const dialog = document.createElement("dialog");
dialog.id = "cloudDialog";
document.body.append(dialog);

function setStatus(text) {
  statusText = text;
  cloudButton.classList.toggle("cloud-ready", Boolean(family));
  cloudButton.title = family ? "Nube familiar conectada" : "Nube familiar";
  if (dialog.open) renderDialog();
}

async function findFamily() {
  const { data, error } = await supabase
    .from(FAMILY_TABLE)
    .select("id, member_emails, owner_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    setStatus("La nube aún no está preparada. Ejecuta el archivo SQL de Bichito en Supabase.");
    return null;
  }
  return data;
}

async function readRemote() {
  if (!family) return null;
  const { data, error } = await supabase
    .from(DATA_TABLE)
    .select("payload, updated_at")
    .eq("family_id", family.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function pushRemote(showFeedback = true) {
  if (!family || !session || applyingRemote) return;
  if (showFeedback) setStatus("Guardando en la nube…");
  const { error } = await supabase.from(DATA_TABLE).upsert(
    {
      family_id: family.id,
      payload: payload(),
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    },
    { onConflict: "family_id" },
  );
  if (error) {
    setStatus("No se pudo guardar. Revisa la conexión e inténtalo nuevamente.");
    return;
  }
  writeMeta({ familyId: family.id, syncedAt: new Date().toISOString() });
  setStatus("Datos familiares sincronizados.");
}

function schedulePush() {
  if (!family || applyingRemote) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => pushRemote(false), 1300);
}

async function downloadRemote() {
  try {
    setStatus("Descargando datos de la nube…");
    const remote = await readRemote();
    if (!remote?.payload) {
      setStatus("Todavía no hay datos guardados en la nube.");
      return;
    }
    applyingRemote = true;
    localStorage.setItem("bichito-v2", JSON.stringify(remote.payload.routines || {}));
    localStorage.setItem("bichito-family-v1", JSON.stringify(remote.payload.family || {}));
    localStorage.setItem("bichito-ai-guidance-v1", remote.payload.guidance || "");
    writeMeta({ familyId: family.id, syncedAt: remote.updated_at || new Date().toISOString() });
    setStatus("Datos descargados. Actualizando Bichito…");
    setTimeout(() => location.reload(), 450);
  } catch {
    setStatus("No se pudieron descargar los datos. Intenta nuevamente.");
  } finally {
    applyingRemote = false;
  }
}

async function createFamily() {
  const input = document.getElementById("cloudPartner");
  const partnerEmail = input?.value.trim().toLowerCase();
  const ownEmail = session?.user?.email?.trim().toLowerCase();
  if (!partnerEmail || !partnerEmail.includes("@")) {
    setStatus("Escribe el correo de la otra persona que usará Bichito.");
    return;
  }
  setStatus("Creando su nube familiar…");
  const memberEmails = [...new Set([ownEmail, partnerEmail])];
  const { data, error } = await supabase
    .from(FAMILY_TABLE)
    .insert({ owner_id: session.user.id, member_emails: memberEmails })
    .select("id, member_emails, owner_id")
    .single();
  if (error) {
    setStatus("No se pudo crear la familia. Revisa que el SQL de Supabase esté ejecutado.");
    return;
  }
  family = data;
  await pushRemote(true);
}

async function sendMagicLink() {
  const input = document.getElementById("cloudEmail");
  const email = input?.value.trim();
  if (!email || !email.includes("@")) {
    setStatus("Escribe un correo válido.");
    return;
  }
  setStatus("Enviando enlace de acceso…");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/` },
  });
  setStatus(error ? "No se pudo enviar el enlace. Revisa el correo autorizado en Supabase." : "Revisa tu correo y abre el enlace en este dispositivo.");
}

async function signOut() {
  await supabase.auth.signOut();
  session = null;
  family = null;
  setStatus("Sesión cerrada. Los datos locales se mantienen en este dispositivo.");
}

function renderDialog() {
  const close = '<button class="x" id="closeCloud" aria-label="Cerrar">×</button>';
  if (!session) {
    dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2>Nube familiar</h2>${close}</div><p class="note">Entra con un enlace enviado a tu correo. Solo tú y la otra persona invitada podrán acceder a los datos.</p><label class="field">Correo<input id="cloudEmail" type="email" inputmode="email" autocomplete="email" placeholder="tu@correo.com"></label><button class="primary" type="button" id="sendMagic">Enviar enlace de acceso</button><p class="note" id="cloudStatus"></p></form>`;
  } else if (!family) {
    dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2>Crear nube familiar</h2>${close}</div><p class="note">Conectado como ${escapeHtml(session.user.email || "")}. Al crearla, se subirán los registros que ya existen en este dispositivo.</p><label class="field">Correo de la otra persona<input id="cloudPartner" type="email" inputmode="email" autocomplete="email" placeholder="mama@correo.com"></label><button class="primary" type="button" id="createCloud">Crear y sincronizar</button><p class="note" id="cloudStatus"></p></form>`;
  } else {
    const isNewDevice = readMeta().familyId !== family.id;
    dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2>Nube familiar</h2>${close}</div><p class="note">Conectado como ${escapeHtml(session.user.email || "")}. ${isNewDevice ? "Encontramos los datos de su familia en la nube." : "Los cambios nuevos se guardan automáticamente."}</p><button class="secondary" type="button" id="pullCloud">${isNewDevice ? "Usar datos de la nube en este dispositivo" : "Actualizar desde la nube"}</button><button class="primary" type="button" id="pushCloud">Guardar ahora en la nube</button><button class="link" type="button" id="signOutCloud">Cerrar sesión</button><p class="note" id="cloudStatus"></p></form>`;
  }
  document.getElementById("cloudStatus").textContent = statusText;
  document.getElementById("closeCloud").onclick = () => dialog.close();
  document.getElementById("sendMagic")?.addEventListener("click", sendMagicLink);
  document.getElementById("createCloud")?.addEventListener("click", createFamily);
  document.getElementById("pullCloud")?.addEventListener("click", downloadRemote);
  document.getElementById("pushCloud")?.addEventListener("click", () => pushRemote(true));
  document.getElementById("signOutCloud")?.addEventListener("click", signOut);
}

cloudButton.onclick = () => {
  renderDialog();
  dialog.showModal();
};

const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function setItem(key, value) {
  originalSetItem.call(this, key, value);
  if (this === localStorage && SYNCED_KEYS.includes(key)) schedulePush();
};

supabase.auth.onAuthStateChange((_event, nextSession) => {
  session = nextSession;
  if (session) {
    findFamily().then((found) => {
      family = found;
      setStatus(found ? "Nube familiar conectada." : statusText);
    });
  } else {
    family = null;
    setStatus("Inicia sesión para activar la nube familiar.");
  }
});

const initial = await supabase.auth.getSession();
session = initial.data.session;
if (session) {
  family = await findFamily();
  setStatus(family ? "Nube familiar conectada." : statusText);
}
