import crypto from "crypto";

interface CacheEntry {
  hash: string;
  result: string; // JSON stringified response
  createdAt: number;
}

// In-memory cache (persists across requests within the same serverless instance)
const memoryCache = new Map<string, CacheEntry>();

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hash the exact LLM request parameters.
 * This includes model, system prompt, and messages — so any change
 * to the prompt text, document content, or model triggers a cache miss.
 */
export function hashRequest(params: {
  model: string;
  system?: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  max_tokens: number;
}): string {
  const payload = JSON.stringify({
    model: params.model,
    system: params.system || "",
    messages: params.messages,
    max_tokens: params.max_tokens,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Look up a cached response by request hash.
 * Returns the cached result string or null on miss.
 */
export function getCached(hash: string): string | null {
  const entry = memoryCache.get(hash);
  if (!entry) {
    console.log(`[LLM-CACHE] MISS (not found) hash=${hash.slice(0, 12)}...`);
    return null;
  }

  // Check TTL
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    memoryCache.delete(hash);
    console.log(`[LLM-CACHE] MISS (expired) hash=${hash.slice(0, 12)}...`);
    return null;
  }

  console.log(`[LLM-CACHE] HIT hash=${hash.slice(0, 12)}... age=${Math.round((Date.now() - entry.createdAt) / 1000)}s`);
  return entry.result;
}

/**
 * Store a response in the cache.
 */
export function setCached(hash: string, result: string): void {
  // Evict oldest entries if cache gets too large (>200 entries)
  if (memoryCache.size >= 200) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of memoryCache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) memoryCache.delete(oldestKey);
  }

  memoryCache.set(hash, {
    hash,
    result,
    createdAt: Date.now(),
  });
  console.log(`[LLM-CACHE] STORE hash=${hash.slice(0, 12)}... size=${memoryCache.size}`);
}

/**
 * Get cache stats for logging.
 */
export function getCacheStats(): { size: number; entries: number } {
  return { size: memoryCache.size, entries: memoryCache.size };
}
