/**
 * MatrixReview Dashboard — API Client
 * 
 * Single source of truth for all backend API calls.
 * Every module imports this instead of making raw fetch calls.
 * 
 * Save to: C:\Matrixreview.io\js\api.js
 */

const API_BASE = 'https://codereview-ai-production.up.railway.app/api/dash';

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

export const api = {
    // Expose base URL for modules that need raw fetch (file upload)
    base: API_BASE,

    // Companies
    listCompanies: () => request('/companies'),

    // Overview
    getOverview: (slug) => request(`/${slug}/overview`),

    // Graph
    getGraph: (slug, includeEdges = false) => request(`/${slug}/graph?include_edges=${includeEdges}`),
    getGraphFile: (slug, path) => request(`/${slug}/graph/file/${path}`),
    getEntryPoints: (slug) => request(`/${slug}/graph/entry-points`),
    getSecurityFiles: (slug) => request(`/${slug}/graph/security`),
    getHotspots: (slug, limit = 20) => request(`/${slug}/graph/hotspots?limit=${limit}`),

    // Health
    getHealth: (slug) => request(`/${slug}/health`),

    // Docs
    getDocs: (slug, gate = null) => request(`/${slug}/docs${gate ? `?gate=${gate}` : ''}`),
    getDoc: (slug, docId) => request(`/${slug}/docs/${docId}`),
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
    updateDoc: (slug, docId, content) => request(`/${slug}/docs/${docId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
    }),
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
        return await resp.json();
    },
    deleteDocs: (slug, docIds) => request(`/${slug}/docs`, {
        method: 'DELETE',
        body: JSON.stringify({ doc_ids: docIds }),
    }),

    // Reviews
    getReviews: (slug, page = 1, perPage = 20) => request(`/${slug}/reviews?page=${page}&per_page=${perPage}`),
    getReviewStats: (slug) => request(`/${slug}/reviews/stats`),
    getReviewsByAuthor: (slug, author) => request(`/${slug}/reviews/by-author/${author}`),
    getReview: (slug, reviewId) => request(`/${slug}/reviews/${reviewId}`),

    // Context packs (for chat)
    getContext: (slug, type, id) => request(`/${slug}/context/${type}/${id}`),
};
