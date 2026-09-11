const META_KEY = "bichito-vault-v2";
const SYNCED_KEYS = ["bichito-v2", "bichito-family-v1", "bichito-ai-guidance-v1"];
const VAULT_API = "/api/family-vault";

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
let statusText = pairing ? "Nube privada conectada." : "Crea o escanea el QR de su familia para activar la nube.";
const cloudButton = document.getElementById("cloud");
const dialog = document.createElement("dialog");
dialog.id = "cloudDialog";
document.body.append(dialog);

function isPairing(value) {
  return value && value.vaultId === "bichito-family" && /^[A-Za-z0-9_-]{40,}$/.test(value.token || "");
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
  if (!response.ok) throw new Error(result.error || "No se pudo conectar con la nube privada.");
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

async function pushRemote(showFeedback = true) {
  if (!isPairing(pairing) || applyingRemote) return;
  try {
    if (showFeedback) setStatus("Cifrando y guardando en la nube…");
    const encrypted = await encryptPayload(payload());
    const saved = await api("", { method: "POST", body: JSON.stringify({ action: "write", ...encrypted }) });
    writeMeta({ ...pairing, syncedAt: saved.updatedAt || new Date().toISOString() });
    setStatus("Datos familiares cifrados y sincronizados.");
  } catch (error) {
    setStatus(error.message || "No se pudo guardar. Revisa la conexión e inténtalo nuevamente.");
  }
}

function schedulePush() {
  if (!isPairing(pairing) || applyingRemote) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => pushRemote(false), 1400);
}

async function downloadRemote(reloadAfter = true) {
  try {
    setStatus("Descargando datos cifrados…");
    const remote = await api();
    if (!remote.ciphertext) {
      setStatus("La nube está lista; aún no tiene registros guardados.");
      return false;
    }
    const remotePayload = await decryptPayload(remote.ciphertext, remote.iv);
    applyingRemote = true;
    localStorage.setItem("bichito-v2", JSON.stringify(remotePayload.routines || {}));
    localStorage.setItem("bichito-family-v1", JSON.stringify(remotePayload.family || {}));
    localStorage.setItem("bichito-ai-guidance-v1", remotePayload.guidance || "");
    writeMeta({ ...pairing, syncedAt: remote.updatedAt || new Date().toISOString() });
    setStatus("Datos familiares descargados. Actualizando Bichito…");
    if (reloadAfter) setTimeout(() => location.reload(), 400);
    return true;
  } catch (error) {
    setStatus(error.message === "UNPAIRED" ? "Este teléfono aún no está emparejado." : "No se pudieron abrir los datos cifrados.");
    return false;
  } finally {
    applyingRemote = false;
  }
}

async function createVault() {
  try {
    setStatus("Creando la bóveda privada de Bichito…");
    const created = await api("", { method: "POST", body: JSON.stringify({ action: "create" }) });
    pairing = { vaultId: created.vaultId, token: created.token };
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
    pairing = { vaultId: claimed.vaultId, token: claimed.token };
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
    pairing = { vaultId: session.vaultId, token: session.token };
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

function renderDialog() {
  const close = '<button class="x" id="closeCloud" aria-label="Cerrar">×</button>';
  if (!isPairing(pairing)) {
    dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2>Nube familiar</h2>${close}</div><p class="note">No usa correo ni contraseña. Bichito cifra los datos antes de guardarlos; el QR es la llave privada de su familia.</p><button class="primary" type="button" id="createVault">Crear QR de familia</button><p class="note">Hazlo una sola vez desde tu teléfono. Luego escanéalo con el de la mamá.</p><p class="note" id="cloudStatus"></p></form>`;
  } else {
    dialog.innerHTML = `<form method="dialog" class="sheet"><div class="head"><h2>Nube privada</h2>${close}</div><p class="note">Este teléfono está emparejado. Los cambios se cifran aquí antes de salir del dispositivo.</p><button class="secondary" type="button" id="pullCloud">Actualizar desde la nube</button><button class="primary" type="button" id="pushCloud">Guardar ahora en la nube</button><button class="secondary" type="button" id="showQr">Mostrar QR para el otro teléfono</button><button class="link" type="button" id="shareQr">Compartir vínculo del QR</button><div class="qr" id="familyQr" hidden></div><p class="note" id="cloudStatus"></p></form>`;
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
  originalSetItem.call(this, key, value);
  if (this === localStorage && SYNCED_KEYS.includes(key)) schedulePush();
};

await claimPairingFromUrl();
await restorePairingFromCookie();
setStatus(isPairing(pairing) ? "Nube privada conectada." : statusText);
