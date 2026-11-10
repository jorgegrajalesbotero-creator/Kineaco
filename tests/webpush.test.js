import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { b64u, encryptPayload, generateVapidKeys, vapidAuthorization } from "../lib/webpush.js";

// Descifra como lo haría el celular (RFC 8291), para comprobar que el cifrado es correcto
function decrypt(body, uaEcdh, authSecret) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const data = body.subarray(21 + idlen);
  const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
  const shared = uaEcdh.computeSecret(asPublic);
  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaEcdh.getPublicKey(), asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])])).subarray(0, 32);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(data.subarray(data.length - 16));
  const out = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
  expect(out[out.length - 1]).toBe(2); // delimitador del último registro
  return out.subarray(0, out.length - 1).toString();
}

describe("webpush", () => {
  it("cifra un aviso que el navegador puede descifrar", () => {
    const ua = crypto.createECDH("prime256v1");
    ua.generateKeys();
    const authSecret = crypto.randomBytes(16);
    const sub = { p256dh: b64u.encode(ua.getPublicKey()), auth: b64u.encode(authSecret) };
    const payload = { title: "Hola", body: "Mensaje de su coach ñ ✓" };
    const body = encryptPayload(payload, sub);
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(JSON.parse(decrypt(body, ua, authSecret))).toEqual(payload);
  });

  it("coincide byte a byte con el ejemplo del RFC 8291 (apéndice A)", () => {
    const body = encryptPayload(
      "When I grow up, I want to be a watermelon",
      {
        p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
      { salt: "DGv6ra1nlYgDCS1FRnbzlw", serverPrivateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw" },
    );
    expect(b64u.encode(body)).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("firma el VAPID con una firma ES256 válida", () => {
    const keys = generateVapidKeys();
    const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", { ...keys, subject: "mailto:test@example.com" });
    const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(k).toBe(keys.publicKey);
    const [h, c, s] = token.split(".");
    expect(JSON.parse(b64u.decode(c).toString()).aud).toBe("https://fcm.googleapis.com");
    const pub = b64u.decode(keys.publicKey);
    const publicKey = crypto.createPublicKey({
      key: { kty: "EC", crv: "P-256", x: b64u.encode(pub.subarray(1, 33)), y: b64u.encode(pub.subarray(33)) },
      format: "jwk",
    });
    const ok = crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, b64u.decode(s));
    expect(ok).toBe(true);
  });
});
