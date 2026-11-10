// Envío de notificaciones push (Web Push) sin librerías externas: solo el módulo crypto de Node.
// - Firma VAPID (RFC 8292): el servidor demuestra que es Kineaco ante Google/Apple/Mozilla.
// - Cifrado aes128gcm (RFC 8291): el contenido del aviso viaja cifrado; solo el celular lo lee.
// SOLO se usa en el servidor (rutas de app/api). Nunca importarlo desde un componente.
import crypto from "node:crypto";

export const b64u = {
  encode: (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  decode: (str) => Buffer.from(String(str).replace(/-/g, "+").replace(/_/g, "/"), "base64"),
};

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

// Claves VAPID: pública = punto P-256 sin comprimir (65 bytes); privada = 32 bytes. Ambas en base64url.
export function generateVapidKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64u.encode(ecdh.getPublicKey()), privateKey: b64u.encode(ecdh.getPrivateKey()) };
}

function vapidPrivateKeyObject(publicKey, privateKey) {
  const pub = b64u.decode(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID: clave pública inválida");
  return crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64u.encode(b64u.decode(privateKey)),
      x: b64u.encode(pub.subarray(1, 33)),
      y: b64u.encode(pub.subarray(33, 65)),
    },
    format: "jwk",
  });
}

// Encabezado Authorization para un endpoint (el "aud" es el origen del servicio de push)
export function vapidAuthorization(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const header = b64u.encode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign("sha256", Buffer.from(unsigned), {
    key: vapidPrivateKeyObject(publicKey, privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${unsigned}.${b64u.encode(signature)}, k=${publicKey}`;
}

// Cifra el contenido para una suscripción (p256dh y auth vienen del navegador del alumno).
// _fixed (solo pruebas): { salt, serverPrivateKey } para comparar con el ejemplo del RFC 8291.
export function encryptPayload(payload, { p256dh, auth }, _fixed) {
  const uaPublic = b64u.decode(p256dh);
  const authSecret = b64u.decode(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("Suscripción inválida");

  const salt = _fixed ? b64u.decode(_fixed.salt) : crypto.randomBytes(16);
  const ecdh = crypto.createECDH("prime256v1");
  if (_fixed) ecdh.setPrivateKey(b64u.decode(_fixed.serverPrivateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])])).subarray(0, 32);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);

  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const plaintext = Buffer.concat([Buffer.from(text), Buffer.from([2])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, encrypted]);
}

// Envía un aviso a una suscripción. gone = la suscripción ya no existe en ese celular (hay que borrarla).
export async function sendWebPush(subscription, payload, vapid, { ttl = 86400, urgency = "normal", topic } = {}) {
  const body = encryptPayload(payload, subscription);
  const headers = {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    TTL: String(ttl),
    Urgency: urgency,
    Authorization: vapidAuthorization(subscription.endpoint, vapid),
  };
  // Topic: si llega otro aviso con el mismo tema antes de entregarse, reemplaza al anterior
  if (topic) headers.Topic = b64u.encode(crypto.createHash("sha256").update(topic).digest()).slice(0, 32);
  const res = await fetch(subscription.endpoint, { method: "POST", headers, body });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
