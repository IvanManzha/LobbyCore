// src/backend/auth/steam/authCodeStore.js
const TTL_SEC = parseInt(process.env.AUTH_CODE_TTL_SEC || '120', 10);
const store = new Map(); // code -> { payload, exp }

function put(code, payload) {
  const exp = Date.now() + TTL_SEC * 1000;
  store.set(code, { payload, exp });
}

function take(code) {
  const item = store.get(code);
  if (!item) return null;
  store.delete(code);
  if (Date.now() > item.exp) return null;
  return item.payload;
}

// cleanup (optional)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.exp) store.delete(k);
  }
}, 30_000).unref?.();

module.exports = { put, take };
