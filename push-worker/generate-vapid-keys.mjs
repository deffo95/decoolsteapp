// Maakt eenmalig een VAPID-sleutelpaar aan voor de push-worker.
// Gebruik: node generate-vapid-keys.mjs

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
const jwk = await crypto.subtle.exportKey("jwk", privateKey);
const b64url = bytes => Buffer.from(bytes).toString("base64url");

console.log("VAPID_PUBLIC_KEY (zet in wrangler.toml onder [vars]):");
console.log(b64url(raw));
console.log("\nVAPID_PRIVATE_JWK (geheim! invoeren bij: npx wrangler secret put VAPID_PRIVATE_JWK):");
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }));
