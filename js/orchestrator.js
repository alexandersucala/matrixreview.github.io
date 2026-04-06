/**
 * MatrixReview Dashboard — Orchestrator
 * 
 * Manages routing, module loading, and layout.
 * Each view is a module that exports render(container, data) and destroy().
 * 
 * Save to: C:\Matrixreview.io\js\orchestrator.js
 */

import { api } from './api.js';

const modules = {};
const moduleLoaders = {
    overview: () => import('./modules/overview.js'),
    health:   () => import('./modules/health.js'),
    docs:     () => import('./modules/docs.js'),
    reviews:  () => import('./modules/reviews.js'),
    graph:    () => import('./modules/graph.js'),
};

let currentModule = null;
let currentSlug = null;
let isNavigating = false;

export async function init() {
    const params = new URLSearchParams(window.location.search);
    currentSlug = params.get('slug');

    if (!currentSlug) {
        await showCompanyPicker();
        return;
    }

    renderNav(currentSlug);

    const hash = window.location.hash.replace('#', '') || 'overview';
    await navigateTo(hash);

    window.addEventListener('hashchange', async () => {
        const view = window.location.hash.replace('#', '') || 'overview';
        await navigateTo(view);
    });
}

async function navigateTo(viewName) {
    // Prevent concurrent navigation (fixes blank page on fast clicks)
    if (isNavigating) return;
    isNavigating = true;

    const [view, subId] = viewName.split(':');

    if (!moduleLoaders[view]) {
        console.error(`Unknown view: ${view}`);
        isNavigating = false;
        return;
    }

    const container = document.getElementById('dash-content');
    if (!container) { isNavigating = false; return; }

    // Destroy current module
    if (currentModule && currentModule.destroy) {
        try { currentModule.destroy(); } catch(e) { console.warn('Module destroy error:', e); }
    }

    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading...</p></div>';

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
    });

    try {
        if (!modules[view]) {
            const mod = await moduleLoaders[view]();
            modules[view] = mod.default || mod;
        }

        currentModule = modules[view];

        // Build context with orchestrator reference
        const ctx = {
            slug: currentSlug,
            api: api,
            subId: subId || null,
            navigateTo: (v) => { window.location.hash = v; },
            orchestrator: {
                loadModule: (name) => {
                    window.location.hash = name;
                },
            },
        };

        await currentModule.render(container, ctx);

    } catch (e) {
        console.error(`Failed to load view: ${view}`, e);
        container.innerHTML = `<div class="error-state"><h3>Failed to load</h3><p>${e.message}</p><button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);border-radius:6px;cursor:pointer;">Reload</button></div>`;
    }

    isNavigating = false;
}

async function showCompanyPicker() {
    const container = document.getElementById('dash-content');
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading companies...</p></div>';

    try {
        const data = await api.listCompanies();
        const companies = data.companies.filter(c => c.setup_complete);

        if (companies.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No repositories set up</h3><p>Install MatrixReview on a GitHub repository to get started.</p></div>';
            return;
        }

        let html = '<div class="company-picker"><h2>Select a repository</h2><div class="company-grid">';
        for (const c of companies) {
            const score = c.health_score !== null ? c.health_score : '\u2014';
            const scoreClass = c.health_score !== null ? (c.health_score >= 80 ? 'score-good' : c.health_score >= 50 ? 'score-warn' : 'score-bad') : '';
            html += `
                <a href="?slug=${c.slug}" class="company-card">
                    <div class="company-name">${c.github_repo || c.name}</div>
                    <div class="company-stats">
                        <span>${c.doc_count} docs</span>
                        <span>${c.review_count} reviews</span>
                        ${c.has_graph ? '<span class="tag">Graph</span>' : ''}
                        ${c.has_health_report ? `<span class="health-badge ${scoreClass}">${score}</span>` : ''}
                    </div>
                </a>`;
        }
        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div class="error-state"><h3>Failed to load</h3><p>${e.message}</p></div>`;
    }
}

function renderNav(slug) {
    const nav = document.getElementById('dash-nav');
    if (!nav) return;

    const views = [
        { id: 'overview', label: 'Overview', icon: '\u25C9' },
        { id: 'health', label: 'Health', icon: '\u2661' },
        { id: 'graph', label: 'Codebase', icon: '\u2B21' },
        { id: 'docs', label: 'Docs', icon: '\u25A4' },
        { id: 'reviews', label: 'Reviews', icon: '\u2394' },
    ];

    nav.innerHTML = views.map(v => `
        <a href="#${v.id}" class="nav-link" data-view="${v.id}">
            <span class="nav-icon">${v.icon}</span>
            <span class="nav-label">${v.label}</span>
        </a>
    `).join('');
}
