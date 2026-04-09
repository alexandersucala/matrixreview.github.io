/**
 * MatrixReview Dashboard — API Client
 * 
 * Single source of truth for all backend API calls.
 * Includes TTL cache and auth token management.
 * 
 * Save to: C:\Matrixreview.io\js\api.js
 */

const API_BASE = 'https://codereview-ai-production.up.railway.app/api/dash';

// ---------------------------------------------------------------
// Auth token management
// ---------------------------------------------------------------

function getToken() {
    return sessionStorage.getItem('mrx_token') || null;
}

function setToken(token) {
    sessionStorage.setItem('mrx_token', token);
}

function clearToken() {
    sessionStorage.removeItem('mrx_token');
}

function isAuthenticated() {
    const token = getToken();
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        return payload.exp > (Date.now() / 1000);
    } catch(e) {
        return false;
    }
}

function getUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        return {
            github_login: payload.github_login,
            avatar_url: payload.avatar_url,
            slugs: payload.slugs || [],
            repos: payload.repos || [],
        };
    } catch(e) {
        return null;
    }
}

// ---------------------------------------------------------------
// TTL cache
// ---------------------------------------------------------------

const _cache = {};
const CACHE_TTL = 120000;

function getCached(path) {
    const entry = _cache[path];
    if (entry && (Date.now() - entry.ts) < CACHE_TTL) return entry.data;
    return null;
}

function setCache(path, data) {
    _cache[path] = { data, ts: Date.now() };
}

function invalidateCache(prefix) {
    for (const k of Object.keys(_cache)) {
        if (k.includes(prefix)) delete _cache[k];
    }
}

// ---------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------

async function request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const resp = await fetch(url, { ...options, headers });

        if (resp.status === 401) {
            clearToken();
            window.location.href = '/login.html#error=Session+expired.+Please+sign+in+again.';
            throw new Error('Not authenticated');
        }
        if (resp.status === 403) {
            throw new Error('Access denied to this repository');
        }

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

// ---------------------------------------------------------------
// Exports
// ---------------------------------------------------------------

export const api = {
    base: API_BASE,

    // Auth
    isAuthenticated,
    getUser,
    getToken,
    setToken,
    clearToken,

    // Companies
    listCompanies: () => cachedRequest('/companies'),

    // Overview
    getOverview: (slug) => cachedRequest(`/${slug}/overview`),

    // Graph
    getGraph: (slug, includeEdges = false) => cachedRequest(`/${slug}/graph?include_edges=${includeEdges}`),
    getGraphFile: (slug, path) => cachedRequest(`/${slug}/graph/file/${path}`),
    getEntryPoints: (slug) => cachedRequest(`/${slug}/graph/entry-points`),
    getSecurityFiles: (slug) => cachedRequest(`/${slug}/graph/security`),
    getHotspots: (slug, limit = 20) => cachedRequest(`/${slug}/graph/hotspots?limit=${limit}`),

    // Health
    getHealth: (slug) => cachedRequest(`/${slug}/health`),

    // Docs
    getDocs: (slug, gate = null) => cachedRequest(`/${slug}/docs${gate ? `?gate=${gate}` : ''}`),
    getDoc: (slug, docId) => cachedRequest(`/${slug}/docs/${docId}`),
    classifyDoc: async (slug, file) => {
        const formData = new FormData();
        formData.append('file', file);
        const headers = {};
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const resp = await fetch(`${API_BASE}/${slug}/docs/classify`, {
            method: 'POST',
            body: formData,
            headers,
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
        const headers = {};
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const resp = await fetch(`${API_BASE}/${slug}/docs/upload`, {
            method: 'POST',
            body: formData,
            headers,
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

    // Reviews
    getReviews: (slug, page = 1, perPage = 20) => cachedRequest(`/${slug}/reviews?page=${page}&per_page=${perPage}`),
    getReviewStats: (slug) => cachedRequest(`/${slug}/reviews/stats`),
    getReviewsByAuthor: (slug, author) => cachedRequest(`/${slug}/reviews/by-author/${author}`),
    getReview: (slug, reviewId) => cachedRequest(`/${slug}/reviews/${reviewId}`),

    // Context packs
    getContext: (slug, type, id) => request(`/${slug}/context/${type}/${id}`),
};
