const { createHash, randomBytes, timingSafeEqual } = require("crypto");

const VAULT_ID = "bichito-family";
const COOKIE_NAME = "__Host-bichito-vault";

function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || "");
  if (!url || !key) throw new Error("CLOUD_NOT_CONFIGURED");
  return { url, key };
}

function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

function sameHash(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(String(left || "")) || !/^[a-f0-9]{64}$/i.test(String(right || ""))) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function decodeCookieValue(value) {
  try {
    const parsed = JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
    if (parsed?.id !== VAULT_ID || typeof parsed?.token !== "string" || !/^[A-Za-z0-9_-]{40,}$/.test(parsed.token)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cookieValue(pairing) {
  return Buffer.from(JSON.stringify({ id: pairing.id, token: pairing.token })).toString("base64url");
}

function readCookie(request, name) {
  const parts = String(request.headers.cookie || "").split(/;\s*/);
  const found = parts.find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

function setPairingCookie(response, pairing) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(cookieValue(pairing))}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`,
  );
}

async function rest(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || `Supabase respondió ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getVault() {
  const rows = await rest(`bichito_vaults?id=eq.${VAULT_ID}&select=id,token_hash,ciphertext,iv,version,updated_at`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function verifyPairing(pairing) {
  if (!pairing || pairing.id !== VAULT_ID || !pairing.token) return null;
  const vault = await getVault();
  if (!vault || !sameHash(tokenHash(pairing.token), vault.token_hash)) return null;
  return { id: VAULT_ID, token: pairing.token, vault };
}

async function validatePairing(request) {
  return verifyPairing(decodeCookieValue(readCookie(request, COOKIE_NAME)));
}

module.exports = {
  VAULT_ID,
  config,
  getVault,
  newToken,
  rest,
  setPairingCookie,
  tokenHash,
  validatePairing,
  verifyPairing,
};
