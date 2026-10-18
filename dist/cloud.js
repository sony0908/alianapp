const META_KEY = "bichito-vault-v2";
const SYNCED_KEYS = ["bichito-v2", "bichito-family-v1", "bichito-ai-guidance-v1"];
const VAULT_API = "/api/family-vault";
const POLL_INTERVAL_MS = 25000;

const escapeHtml = (value = "") => {
  const node = document.createElement("i");
  node.textContent = value;
  return node.innerHTML;
};
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; }
};
const readMeta = () => readJson(META_KEY, null);
const writeMeta = (value) => localStorage.setItem(META_KEY, JSON.stringify(value));
const payload = () => ({
  routines: readJson("bichito-v2", {}),
  family: readJson("bichito-family-v1", {}),
  guidance: localStorage.getItem("bichito-ai-guidance-v1") || "",
});

let pairing = readMeta();
let applyingRemote = false;
let syncTimer = null;
let syncInFlight = null;
let changesSinceLastSync = 0;
let statusText = pairing ? "Nube privada conectada." : "Crea o escanea el QR de su familia para activar la nube.";
const cloudButton = document.getElementById("cloud");
const dialog = document.createElement("dialog");
dialog.id = "cloudDialog";
document.body.append(dialog);

function isPairing(value) {
  return value && value.vaultId === "bichito-family" && /^[A-Za-z0-9_-]{40,}$/.test(value.token || "");
}

function syncVersion() {
  return Number.isSafeInteger(Number(pairing?.syncVersion)) ? Number(pairing.syncVersion) : 0;
}

function savePairing(patch = {}) {
  pairing = { ...pairing, ...patch };
  writeMeta(pairing);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const source = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(source + "=".repeat((4 - (source.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function vaultKey() {
  if (!isPairing(pairing)) throw new Error("UNPAIRED");
  return crypto.subtle.importKey("raw", base64UrlToBytes(pairing.token), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptPayload(value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await vaultKey(), new TextEncoder().encode(JSON.stringify(value)));
  return { ciphertext: bytesToBase64Url(new Uint8Array(encrypted)), iv: bytesToBase64Url(iv) };
}

async function decryptPayload(ciphertext, iv) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(iv) },
    await vaultKey(),
    base64UrlToBytes(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function api(path = "", options = {}) {
  const response = await fetch(`${VAULT_API}${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "No se pudo conectar con la nube privada.");
    error.status = response.status;
    error.data = result;
    throw error;
  }
  return result;
}

function setStatus(text) {
  statusText = text;
  cloudButton.classList.toggle("cloud-ready", isPairing(pairing));
  cloudButton.title = isPairing(pairing) ? "Nube privada conectada" : "Nube familiar";
  if (dialog.open) renderDialog();
}

function pairingUrl() {
  return `${location.origin}/?bichito-vault=${encodeURIComponent(pairing.vaultId)}#bichito-token=${encodeURIComponent(pairing.token)}`;
}

function mergeById(remoteList, localList) {
  const merged = new Map();
  (Array.isArray(remoteList) ? remoteList : []).forEach((item) => item?.id && merged.set(item.id, item));
  (Array.isArray(localList) ? localList : []).forEach((item) => item?.id && merged.set(item.id, item));
  return [...merged.values()];
}

function mergePayload(remote, local) {
  const remoteRoutines = remote?.routines || {};
  const localRoutines = local?.routines || {};
  const remoteFamily = remote?.family || {};
  const localFamily = local?.family || {};
  const mergedChecks = { ...remoteRoutines.cryChecks };
  Object.entries(localRoutines.cryChecks || {}).forEach(([date, checks]) => {
    mergedChecks[date] = { ...(mergedChecks[date] || {}), ...checks };
  });
  return {
    routines: {
      ...remoteRoutines,
      ...localRoutines,
      events: mergeById(remoteRoutines.events, localRoutines.events),
      cryChecks: mergedChecks,
      profile: { ...(remoteRoutines.profile || {}), ...(localRoutines.profile || {}) },
    },
    family: {
      ...remoteFamily,
      ...localFamily,
      health: mergeById(remoteFamily.health, localFamily.health),
      milestones: mergeById(remoteFamily.milestones, localFamily.milestones),
      stock: mergeById(remoteFamily.stock, localFamily.stock),
    },
    guidance: local?.guidance || remote?.guidance || "",
  };
}

function applyPayload(value) {
  applyingRemote = true;
  try {
    localStorage.setItem("bichito-v2", JSON.stringify(value.routines || {}));
    localStorage.setItem("bichito-family-v1", JSON.stringify(value.family || {}));
    localStorage.setItem("bichito-ai-guidance-v1", value.guidance || "");
  } finally {
    applyingRemote = false;
  }
}

function reloadWithRemoteStatus(text) {
  setStatus(text);
  setTimeout(() => location.reload(), 450);
}

async function renderQr() {
  const target = document.getElementById("familyQr");
  if (!target || !isPairing(pairing)) return;
  target.textContent = "Preparando el QR…";
  try {
    const { toDataURL } = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm");
    const dataUrl = await toDataURL(pairingUrl(), { width: 280, margin: 2, color: { dark: "#26313b", light: "#fffdfb" } });
    target.innerHTML = `<img src="${dataUrl}" alt="Código QR para emparejar Bichito"><p class="note">Escanéalo con el otro teléfono. Desde la página que se abre, agrega Bichito a la pantalla de inicio.</p>`;
  } catch {
    target.innerHTML = `<p class="note">No pudimos dibujar el QR. Abre este vínculo solo en el otro teléfono:</p><p class="note break">${escapeHtml(pairingUrl())}</p>`;
  }
}

async function saveEncryptedSnapshot(snapshot, expectedVersion) {
  const encrypted = await encryptPayload(snapshot);
  return api("", { method: "POST", body: JSON.stringify({ action: "write", expectedVersion, ...encrypted }) });
}

async function pushRemote(showFeedback = true) {
  if (!isPairing(pairing) || applyingRemote) return null;
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const capturedChanges = changesSinceLastSync;
    const localSnapshot = payload();
    try {
      if (showFeedback) setStatus("Cifrando y guardando en la nube…");
      let saved;
      try {
        saved = await saveEncryptedSnapshot(localSnapshot, syncVersion());
      } catch (error) {
        if (error.status !== 409 || !error.data?.ciphertext) throw error;
        const remoteSnapshot = await decryptPayload(error.data.ciphertext, error.data.iv);
        const merged = mergePayload(remoteSnapshot, localSnapshot);
        applyPayload(merged);
        saved = await saveEncryptedSnapshot(merged, Number(error.data.version || 0));
        savePairing({ syncVersion: saved.version, syncedAt: saved.updatedAt || new Date().toISOString(), dirty: false });
        reloadWithRemoteStatus("Unimos los registros nuevos de ambos equipos.");
        return saved;
      }
      savePairing({ syncVersion: saved.version, syncedAt: saved.updatedAt || new Date().toISOString(), dirty: changesSinceLastSync !== capturedChanges });
      if (changesSinceLastSync !== capturedChanges) schedulePush();
      if (showFeedback) setStatus("Datos familiares cifrados y sincronizados.");
      return saved;
    } catch (error) {
      savePairing({ dirty: true, pendingAt: new Date().toISOString() });
      if (showFeedback) setStatus(error.message || "No se pudo guardar. Quedó una copia pendiente para reintentar.");
      return null;
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

function schedulePush() {
  if (!isPairing(pairing) || applyingRemote) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => pushRemote(false), 1200);
}

async function downloadRemote(reloadAfter = true) {
  try {
    setStatus("Descargando datos cifrados…");
    const remote = await api();
    if (!remote.ciphertext) {
      savePairing({ syncVersion: Number(remote.version || 0), dirty: false });
      setStatus("La nube está lista; aún no tiene registros guardados.");
      return false;
    }
    const localSnapshot = payload();
    const remotePayload = await decryptPayload(remote.ciphertext, remote.iv);
    const hasPendingChanges = Boolean(pairing?.dirty);
    applyPayload(hasPendingChanges ? mergePayload(remotePayload, localSnapshot) : remotePayload);
    savePairing({ syncVersion: Number(remote.version || 0), syncedAt: remote.updatedAt || new Date().toISOString(), dirty: hasPendingChanges });
    if (hasPendingChanges) {
      const saved = await pushRemote(false);
      if (saved) reloadWithRemoteStatus("Unimos y guardamos los cambios de ambos equipos.");
      return true;
    }
    if (reloadAfter) reloadWithRemoteStatus("Datos familiares descargados. Actualizando Bichito…");
    else setStatus("Datos familiares actualizados.");
    return true;
  } catch (error) {
    setStatus(error.message === "UNPAIRED" ? "Este teléfono aún no está emparejado." : "No se pudieron abrir los datos cifrados.");
    return false;
  }
}

async function checkForRemoteChanges() {
  if (!isPairing(pairing) || applyingRemote || syncInFlight || document.hidden || !navigator.onLine) return;
  try {
    const remote = await api();
    const remoteVersion = Number(remote.version || 0);
    if (remoteVersion <= syncVersion()) {
      if (pairing?.dirty) await pushRemote(false);
      return;
    }
    if (pairing?.dirty) {
      await pushRemote(false);
      return;
    }
    if (document.querySelector("dialog[open]")) {
      setStatus("Hay cambios de otro equipo listos para actualizar.");
      return;
    }
    if (remote.ciphertext) {
      const remotePayload = await decryptPayload(remote.ciphertext, remote.iv);
      applyPayload(remotePayload);
    }
    savePairing({ syncVersion: remoteVersion, syncedAt: remote.updatedAt || new Date().toISOString(), dirty: false });
    reloadWithRemoteStatus("Llegaron registros nuevos de otro equipo.");
  } catch {
    // Sin conexión o servidor temporalmente indisponible: la copia local queda intacta.
  }
}

async function createVault() {
  try {
    setStatus("Creando la bóveda privada de Bichito…");
    const created = await api("", { method: "POST", body: JSON.stringify({ action: "create" }) });
    pairing = { vaultId: created.vaultId, token: created.token, syncVersion: 0, dirty: true };
    writeMeta(pairing);
    await pushRemote(false);
    setStatus("Nube privada lista. Guarda este QR para emparejar el otro teléfono.");
    renderDialog();
    await renderQr();
  } catch (error) {
    setStatus(error.message || "No se pudo crear la nube privada.");
  }
}

async function claimPairingFromUrl() {
  const url = new URL(location.href);
  const vaultId = url.searchParams.get("bichito-vault");
  const token = new URLSearchParams(url.hash.slice(1)).get("bichito-token");
  if (!vaultId || !token) return false;
  try {
    setStatus("Emparejando este teléfono…");
    const claimed = await api("", { method: "POST", body: JSON.stringify({ action: "pair", vaultId, token }) });
    pairing = { vaultId: claimed.vaultId, token: claimed.token, syncVersion: 0, dirty: false };
    writeMeta(pairing);
    history.replaceState({}, document.title, location.pathname);
    await downloadRemote(true);
    return true;
  } catch (error) {
    history.replaceState({}, document.title, location.pathname);
    setStatus(error.message || "No se pudo usar este QR.");
    return false;
  }
}

async function restorePairingFromCookie() {
  if (isPairing(pairing)) return true;
  try {
    const session = await api("?action=session");
    pairing = { vaultId: session.vaultId, token: session.token, syncVersion: 0, dirty: false };
    writeMeta(pairing);
    setStatus("Este teléfono quedó emparejado con la nube familiar.");
    await downloadRemote(true);
    return true;
  } catch {
    return false;
  }
}

async function sharePairing() {
  if (!navigator.share || !isPairing(pairing)) return;
  try { await navigator.share({ title: "Bichito", text: "Empareja Bichito en este teléfono.", url: pairingUrl() }); } catch { /* el usuario canceló */ }
}

function lastSyncLabel() {
  if (!pairing?.syncedAt) return "Aún estamos preparando la primera copia.";
  return `Última sincronización: ${new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date(pairing.syncedAt))}.`;
}

function renderDialog() {
  const close = '<button class="x" id="closeCloud" aria-label="Cerrar">×</button>';
  if (!isPairing(pairing)) {
    dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2>Nube familiar</h2>${close}</div><p class="note">No usa correo ni contraseña. Bichito cifra los datos antes de guardarlos; el QR es la llave privada de su familia.</p><button class="primary" type="button" id="createVault">Crear QR de familia</button><p class="note">Hazlo una sola vez desde tu teléfono. Luego escanéalo con el de la mamá.</p><p class="note" id="cloudStatus"></p></form>`;
  } else {
    dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2>Nube privada</h2>${close}</div><p class="note">Este teléfono busca cambios al volver a abrir Bichito y cada pocos segundos mientras está en uso. ${lastSyncLabel()}</p><button class="secondary" type="button" id="pullCloud">Actualizar desde la nube</button><button class="primary" type="button" id="pushCloud">Guardar ahora en la nube</button><button class="secondary" type="button" id="showQr">Mostrar QR para el otro teléfono</button><button class="link" type="button" id="shareQr">Compartir vínculo del QR</button><div class="qr" id="familyQr" hidden></div><p class="note" id="cloudStatus"></p></form>`;
  }
  document.getElementById("cloudStatus").textContent = statusText;
  document.getElementById("closeCloud").onclick = () => dialog.close();
  document.getElementById("createVault")?.addEventListener("click", createVault);
  document.getElementById("pullCloud")?.addEventListener("click", () => downloadRemote());
  document.getElementById("pushCloud")?.addEventListener("click", () => pushRemote(true));
  document.getElementById("showQr")?.addEventListener("click", async () => {
    const qr = document.getElementById("familyQr");
    qr.hidden = false;
    await renderQr();
  });
  document.getElementById("shareQr")?.addEventListener("click", sharePairing);
}

cloudButton.onclick = () => {
  renderDialog();
  dialog.showModal();
};

const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function setItem(key, value) {
  const previous = this === localStorage ? this.getItem(key) : null;
  originalSetItem.call(this, key, value);
  if (this === localStorage && SYNCED_KEYS.includes(key) && !applyingRemote && previous !== value) {
    changesSinceLastSync += 1;
    savePairing({ dirty: true, pendingAt: new Date().toISOString() });
    schedulePush();
  }
};

window.addEventListener("online", () => {
  if (pairing?.dirty) pushRemote(false);
  else checkForRemoteChanges();
});
window.addEventListener("focus", () => checkForRemoteChanges());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForRemoteChanges();
  if (document.visibilityState === "hidden" && pairing?.dirty) pushRemote(false);
});

await claimPairingFromUrl();
await restorePairingFromCookie();
await checkForRemoteChanges();
setStatus(isPairing(pairing) ? "Nube privada conectada." : statusText);
setInterval(checkForRemoteChanges, POLL_INTERVAL_MS);
