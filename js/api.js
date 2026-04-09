/**
 * MatrixReview Dashboard — API Client
 * 
 * Single source of truth for all backend API calls.
 * Every module imports this instead of making raw fetch calls.
 * Includes TTL cache for expensive read endpoints.
 * 
 * Save to: C:\Matrixreview.io\js\api.js
 */

const API_BASE = 'https://codereview-ai-production.up.railway.app/api/dash';

// Simple TTL cache: { key: { data, ts } }
const _cache = {};
const CACHE_TTL = 120000; // 2 minutes

function cacheKey(path) { return path; }

function getCached(path) {
    const entry = _cache[cacheKey(path)];
    if (entry && (Date.now() - entry.ts) < CACHE_TTL) return entry.data;
    return null;
}

function setCache(path, data) {
    _cache[cacheKey(path)] = { data, ts: Date.now() };
}

function invalidateCache(prefix) {
    for (const k of Object.keys(_cache)) {
        if (k.includes(prefix)) delete _cache[k];
    }
}

async function request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    try {
        const resp = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(err.detail || `API error: ${resp.status}`);
        }
        return await resp.json();
    } catch (e) {
        console.error(`API request failed: ${path}`, e);
        throw e;
    }
}

async function cachedRequest(path) {
    const hit = getCached(path);
    if (hit) return hit;
    const data = await request(path);
    setCache(path, data);
    return data;
}

export const api = {
    base: API_BASE,

    // Companies
    listCompanies: () => cachedRequest('/companies'),

    // Overview
    getOverview: (slug) => cachedRequest(`/${slug}/overview`),

    // Graph (cached - large payloads, rarely change)
    getGraph: (slug, includeEdges = false) => cachedRequest(`/${slug}/graph?include_edges=${includeEdges}`),
    getGraphFile: (slug, path) => cachedRequest(`/${slug}/graph/file/${path}`),
    getEntryPoints: (slug) => cachedRequest(`/${slug}/graph/entry-points`),
    getSecurityFiles: (slug) => cachedRequest(`/${slug}/graph/security`),
    getHotspots: (slug, limit = 20) => cachedRequest(`/${slug}/graph/hotspots?limit=${limit}`),

    // Health (cached)
    getHealth: (slug) => cachedRequest(`/${slug}/health`),

    // Docs (cached - 291 docs is heavy)
    getDocs: (slug, gate = null) => cachedRequest(`/${slug}/docs${gate ? `?gate=${gate}` : ''}`),
    getDoc: (slug, docId) => cachedRequest(`/${slug}/docs/${docId}`),

    // Docs mutations (invalidate cache after)
    classifyDoc: async (slug, file) => {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${API_BASE}/${slug}/docs/classify`, {
            method: 'POST',
            body: formData,
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(err.detail || `Classify failed: ${resp.status}`);
        }
        return await resp.json();
    },
    updateDoc: async (slug, docId, content) => {
        const result = await request(`/${slug}/docs/${docId}`, {
            method: 'PUT',
            body: JSON.stringify({ content }),
        });
        invalidateCache(`/${slug}/docs`);
        return result;
    },
    uploadDoc: async (slug, file, gate) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('gate', gate);
        const resp = await fetch(`${API_BASE}/${slug}/docs/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(err.detail || `Upload failed: ${resp.status}`);
        }
        invalidateCache(`/${slug}/docs`);
        return await resp.json();
    },
    deleteDocs: async (slug, docIds) => {
        const result = await request(`/${slug}/docs`, {
            method: 'DELETE',
            body: JSON.stringify({ doc_ids: docIds }),
        });
        invalidateCache(`/${slug}/docs`);
        return result;
    },

    // Reviews (cached)
    getReviews: (slug, page = 1, perPage = 20) => cachedRequest(`/${slug}/reviews?page=${page}&per_page=${perPage}`),
    getReviewStats: (slug) => cachedRequest(`/${slug}/reviews/stats`),
    getReviewsByAuthor: (slug, author) => cachedRequest(`/${slug}/reviews/by-author/${author}`),
    getReview: (slug, reviewId) => cachedRequest(`/${slug}/reviews/${reviewId}`),

    // Context packs
    getContext: (slug, type, id) => request(`/${slug}/context/${type}/${id}`),
};
