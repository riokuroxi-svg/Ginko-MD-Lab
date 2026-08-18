// Wrapper de fetch con timeout, reintentos y caché
// El fetch NATIVO de Node.js 18+ (undici) ya usa keep-alive por defecto
// por lo que reutiliza conexiones automáticamente.

// Usar fetch global (disponible en Node 18+)
const fetch = globalThis.fetch;

// Cache simple en memoria con TTL
class FastCache {
  constructor(defaultTTL = 10 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    setInterval(() => this.cleanup(), 60 * 1000).unref();
  }

  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, { value, expires: Date.now() + ttl });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) { this.cache.delete(key); return undefined; }
    return entry.value;
  }

  cleanup() {
    const now = Date.now();
    for (const [k, v] of this.cache) if (now > v.expires) this.cache.delete(k);
  }
}

export const globalFetchCache = new FastCache(10 * 60 * 1000);

// Fast fetch con agente reutilizado, timeout más corto, y cache opcional
export async function fastFetch(url, options = {}) {
  const { cache = false, cacheKey, cacheTTL, timeout = 15000, headers = {}, ...rest } = options;
  const key = cacheKey || (cache ? (typeof url === 'string' ? url : url?.href || url?.url) : null);
  if (key) {
    const cached = globalFetchCache.get(key);
    if (cached) return cached;
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...headers },
      signal: ctrl.signal,
    });
    if (key && res.ok) {
      // Clonar para permitir que el caller consuma el body
      const clone = res.clone();
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          globalFetchCache.set(key, { ok: true, status: res.status, headers: Object.fromEntries(res.headers), json: async () => json, clone: () => ({ json: async () => json }) }, cacheTTL);
          return new Response(JSON.stringify(json), { status: res.status, headers });
        } else {
          const buf = Buffer.from(await res.arrayBuffer());
          globalFetchCache.set(key, { ok: true, status: res.status, headers: Object.fromEntries(res.headers), arrayBuffer: async () => buf, buffer: async () => buf }, cacheTTL);
          return new Response(buf, { status: res.status, headers });
        }
      } catch { /* no cachear si falla */ }
      return clone;
    }
    return res;
  } finally {
    clearTimeout(to);
  }
}

// Ejecuta promesas en paralelo y devuelve la primera que cumpla con el predicado, cancela las demás
export async function promiseRaceSuccess(promises, predicate = (r) => r != null, timeoutMs = 10000) {
  const result = await new Promise((resolve, reject) => {
    let pending = promises.length;
    let lastError = null;
    const timers = [];
    const wrappers = promises.map((p, i) => {
      return Promise.resolve()
        .then(() => p)
        .then((val) => {
          if (predicate(val)) {
            // Cancelar las demás
            timers.forEach(clearTimeout);
            resolve(val);
          } else {
            lastError = new Error('Resultado inválido');
            pending--;
            if (pending === 0) reject(lastError);
          }
        })
        .catch((e) => {
          lastError = e;
          pending--;
          if (pending === 0) reject(lastError);
        });
    });
    // Timeout global
    const t = setTimeout(() => reject(new Error('Tiempo agotado en carrera')), timeoutMs);
    timers.push(t);
  });
  return result;
}

export default fastFetch;
