const {
  VAULT_ID,
  config,
  getVault,
  newToken,
  rest,
  setPairingCookie,
  tokenHash,
  validatePairing,
  verifyPairing,
} = require("./_vault");

const MAX_CIPHERTEXT_LENGTH = 3_500_000;

function sendError(response, status, error) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json({ error });
}

function allowedOrigin(request) {
  const origin = String(request.headers.origin || "");
  return !origin || /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/i.test(origin) || /^http:\/\/localhost(?::\d+)?$/i.test(origin);
}

function parseBody(request) {
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body || {};
}

module.exports = async function handler(request, response) {
  if (!allowedOrigin(request)) return sendError(response, 403, "Origen no autorizado.");
  try {
    config();
  } catch {
    return sendError(response, 503, "La nube privada aún no está configurada en Vercel.");
  }

  try {
    if (request.method === "GET") {
      const pairing = await validatePairing(request);
      if (!pairing) return sendError(response, 401, "Este teléfono aún no está emparejado.");
      response.setHeader("Cache-Control", "no-store");
      if (request.query?.action === "session") return response.status(200).json({ vaultId: pairing.id, token: pairing.token });
      return response.status(200).json({
        ciphertext: pairing.vault.ciphertext || "",
        iv: pairing.vault.iv || "",
        version: pairing.vault.version || 0,
        updatedAt: pairing.vault.updated_at || null,
      });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return sendError(response, 405, "Método no permitido.");
    }

    let body;
    try { body = parseBody(request); } catch { return sendError(response, 400, "Datos inválidos."); }

    if (body.action === "create") {
      const existing = await getVault();
      if (existing) return sendError(response, 409, "La nube familiar ya fue creada. Usa su código QR para emparejar otro teléfono.");
      const pairing = { id: VAULT_ID, token: newToken() };
      try {
        await rest("bichito_vaults", {
          method: "POST",
          body: [{ id: VAULT_ID, token_hash: tokenHash(pairing.token) }],
        });
      } catch (error) {
        if (error.status === 409) return sendError(response, 409, "La nube familiar ya fue creada. Usa su código QR para emparejar otro teléfono.");
        throw error;
      }
      setPairingCookie(response, pairing);
      response.setHeader("Cache-Control", "no-store");
      return response.status(201).json({ vaultId: pairing.id, token: pairing.token });
    }

    if (body.action === "pair") {
      const pairing = await verifyPairing({ id: String(body.vaultId || ""), token: String(body.token || "") });
      if (!pairing) return sendError(response, 401, "El código QR no es válido o fue reemplazado.");
      setPairingCookie(response, pairing);
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({ vaultId: pairing.id, token: pairing.token });
    }

    const pairing = await validatePairing(request);
    if (!pairing) return sendError(response, 401, "Este teléfono aún no está emparejado.");

    if (body.action === "write") {
      const ciphertext = String(body.ciphertext || "");
      const iv = String(body.iv || "");
      if (!ciphertext || ciphertext.length > MAX_CIPHERTEXT_LENGTH || !/^[A-Za-z0-9_-]+$/.test(ciphertext) || !/^[A-Za-z0-9_-]{12,40}$/.test(iv)) {
        return sendError(response, 400, "El contenido cifrado no tiene un formato válido o es demasiado grande.");
      }
      const rows = await rest(`bichito_vaults?id=eq.${VAULT_ID}&token_hash=eq.${pairing.vault.token_hash}`, {
        method: "PATCH",
        body: {
          ciphertext,
          iv,
          version: Number(pairing.vault.version || 0) + 1,
          updated_at: new Date().toISOString(),
        },
      });
      const saved = Array.isArray(rows) ? rows[0] : null;
      if (!saved) return sendError(response, 409, "No se pudo guardar porque cambió el acceso familiar.");
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({ updatedAt: saved.updated_at, version: saved.version });
    }

    return sendError(response, 400, "Acción no reconocida.");
  } catch (error) {
    console.error("Family vault error", error);
    return sendError(response, 502, "No se pudo conectar con la nube privada. Intenta nuevamente.");
  }
};
