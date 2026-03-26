/**
 * MatrixReview Dashboard — Orchestrator
 * 
 * Manages routing, module loading, and layout.
 * Each view is a module that exports render(container, data) and destroy().
 * Swapping a module means replacing one file.
 * 
 * Save to: C:\Matrixreview.io\js\orchestrator.js
 */

import { api } from './api.js';

// Module registry — lazy loaded on first navigation
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

/**
 * Initialize the dashboard. Called once on page load.
 */
export async function init() {
    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    currentSlug = params.get('slug');

    if (!currentSlug) {
        // No slug — show company picker
        await showCompanyPicker();
        return;
    }

    // Build nav
    renderNav(currentSlug);

    // Determine initial view from hash or default to overview
    const hash = window.location.hash.replace('#', '') || 'overview';
    await navigateTo(hash);

    // Listen for hash changes
    window.addEventListener('hashchange', async () => {
        const view = window.location.hash.replace('#', '') || 'overview';
        await navigateTo(view);
    });
}

/**
 * Navigate to a view by name. Loads the module if needed.
 */
async function navigateTo(viewName) {
    // Parse view:subview (e.g. "reviews:abc123" for review detail)
    const [view, subId] = viewName.split(':');

    if (!moduleLoaders[view]) {
        console.error(`Unknown view: ${view}`);
        return;
    }

    const container = document.getElementById('dash-content');
    if (!container) return;

    // Destroy current module
    if (currentModule && currentModule.destroy) {
        currentModule.destroy();
    }

    // Show loading
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading...</p></div>';

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
    });

    try {
        // Load module
        if (!modules[view]) {
            const mod = await moduleLoaders[view]();
            modules[view] = mod.default || mod;
        }

        currentModule = modules[view];

        // Fetch data and render
        await currentModule.render(container, {
            slug: currentSlug,
            api: api,
            subId: subId || null,
            navigateTo: (v) => { window.location.hash = v; },
        });

    } catch (e) {
        console.error(`Failed to load view: ${view}`, e);
        container.innerHTML = `<div class="error-state"><h3>Failed to load</h3><p>${e.message}</p></div>`;
    }
}

/**
 * Show company picker when no slug is provided.
 */
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
            const score = c.health_score !== null ? c.health_score : '—';
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

/**
 * Render the navigation bar.
 */
function renderNav(slug) {
    const nav = document.getElementById('dash-nav');
    if (!nav) return;

    const views = [
        { id: 'overview', label: 'Overview', icon: '◉' },
        { id: 'health', label: 'Health', icon: '♡' },
        { id: 'graph', label: 'Graph', icon: '⬡' },
        { id: 'docs', label: 'Docs', icon: '▤' },
        { id: 'reviews', label: 'Reviews', icon: '⎔' },
    ];

    nav.innerHTML = views.map(v => `
        <a href="#${v.id}" class="nav-link" data-view="${v.id}">
            <span class="nav-icon">${v.icon}</span>
            <span class="nav-label">${v.label}</span>
        </a>
    `).join('');
}
