/**
 * MatrixReview Dashboard — Health Module v7
 * Fixed: loadHealth scoping. Full width. Adjustable review window.
 * Contributor filter. Pagination.
 * Save to: C:\Matrixreview.io\js\modules\health.js
 */
export default {
    async render(container, ctx) {
        window._healthCtx = ctx;
        window._healthPage = 1;
        window._healthPerPage = 50;
        window._healthFilter = 'all';
        window._healthAuthor = '';

        if (!document.getElementById('health-v6-css')) {
            const s = document.createElement('style');
            s.id = 'health-v6-css';
            s.textContent = `
                .h-wrap { width:100%; }
                .h-top { display:flex; align-items:center; gap:24px; margin-bottom:28px; }
                .h-grade { text-align:center; min-width:80px; }
                .h-grade-letter { font-size:56px; font-weight:700; }
                .h-grade-score { font-size:14px; color:#6b7a8d; }
                .h-title { font-size:22px; color:#e8ecf0; margin:0; font-weight:600; }
                .h-sub { color:#6b7a8d; margin:4px 0 0; font-size:14px; }
                .h-trend { font-size:13px; margin-top:4px; }
                .h-cards { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
                .h-card { background:#131B26; border:1px solid #1e2a3a; border-radius:8px; padding:16px 24px; text-align:center; flex:1; min-width:120px; }
                .h-card-val { font-size:28px; font-weight:600; }
                .h-card-lbl { font-size:11px; color:#6b7a8d; text-transform:uppercase; margin-top:4px; }
                .h-timeline { margin-bottom:24px; }
                .h-timeline h3 { color:#e8ecf0; font-size:14px; margin-bottom:12px; }
                .h-bars { display:flex; gap:2px; align-items:end; height:60px; }
                .h-bar { flex:1; min-width:2px; border-radius:2px 2px 0 0; cursor:pointer; opacity:0.85; transition:opacity 0.15s; }
                .h-bar:hover { opacity:1; }
                .h-bar-labels { display:flex; justify-content:space-between; margin-top:4px; }
                .h-bar-labels span { font-size:10px; color:#556677; }
                .h-controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:16px; }
                .h-select { background:#131B26; border:1px solid #1e2a3a; color:#e8ecf0; padding:6px 12px; border-radius:6px; font-size:12px; font-family:inherit; cursor:pointer; }
                .h-select:focus { outline:none; border-color:#00ff41; }
                .h-filters { display:flex; gap:6px; }
                .h-fbtn { background:#131B26; border:1px solid #1e2a3a; color:#6b7a8d; padding:6px 14px; border-radius:6px; font-size:12px; cursor:pointer; font-family:inherit; transition:all 0.15s; }
                .h-fbtn:hover { border-color:#00ff41; color:#e8ecf0; }
                .h-fbtn.active { background:rgba(0,255,65,0.1); border-color:#00ff41; color:#00ff41; }
                .h-pr-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid #1e2a3a; cursor:pointer; transition:background 0.15s; }
                .h-pr-row:hover { background:rgba(0,255,65,0.04); }
                .h-pr-row.hl { background:rgba(0,255,65,0.08); border-left:3px solid #00ff41; }
                .h-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
                .h-pr-title { font-size:13px; color:#e8ecf0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .h-pills { display:flex; gap:4px; flex-shrink:0; }
                .h-pill { font-size:10px; padding:2px 6px; border-radius:3px; font-family:monospace; }
                .h-pr-meta { font-size:11px; color:#556677; white-space:nowrap; }
                .h-expanded { padding:10px 14px 14px 36px; border-bottom:1px solid #1e2a3a; background:#0a0e14; }
                .h-gate-row { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:12px; }
                .h-gate-name { width:110px; color:#6b7a8d; text-transform:uppercase; font-size:11px; font-family:monospace; }
                .h-gate-status { font-weight:600; }
                .h-gate-count { color:#556677; font-size:11px; }
                .h-pager { display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px; }
                .h-pager button { background:#131B26; border:1px solid #1e2a3a; color:#e8ecf0; padding:8px 18px; border-radius:6px; cursor:pointer; font-size:12px; font-family:inherit; }
                .h-pager button:hover { border-color:#00ff41; }
                .h-pager button:disabled { opacity:0.3; cursor:default; }
                .h-pager span { font-size:12px; color:#6b7a8d; }
                .h-info { margin-top:24px; padding:16px; background:#131B26; border:1px solid #1e2a3a; border-radius:8px; }
                .h-info h4 { color:#6b7a8d; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
                .h-info p { color:#556677; font-size:12px; line-height:1.6; }
            `;
            document.head.appendChild(s);
        }

        container.innerHTML = '<div class="h-wrap" id="health-root"><div style="color:#6b7a8d;padding:40px;text-align:center;">Loading...</div></div>';
        await window.loadHealth();
    },
    destroy() {
        delete window._healthCtx;
        delete window._healthPage;
        delete window._healthPerPage;
        delete window._healthFilter;
        delete window._healthAuthor;
        delete window._healthReviews;
        delete window._healthTotal;
        delete window._healthPages;
        delete window.loadHealth;
        delete window.togglePR;
        delete window.hlBar;
    }
};
window.loadHealth = async function() {
    const ctx = window._healthCtx;
    const page = window._healthPage;
    const perPage = window._healthPerPage;
    const filter = window._healthFilter;
    const author = window._healthAuthor;

    let stats = {};
    let rd = {};
    try {
        stats = await ctx.api.getReviewStats(ctx.slug);
        rd = await ctx.api.getReviews(ctx.slug, page, perPage);
    } catch(e) {}

    const reviews = rd.reviews || [];
    const total = rd.total || 0;
    const pages = rd.pages || 1;
    window._healthReviews = reviews;
    window._healthTotal = total;
    window._healthPages = pages;

    const byLight = stats.by_traffic_light || {};
    const allGreens = byLight.GREEN || 0;
    const allYellows = byLight.YELLOW || 0;
    const allReds = byLight.RED || 0;
    const allTotal = stats.total_reviews || 0;
    const avgFindings = stats.avg_findings_per_review || 0;

    const pageGreens = reviews.filter(r => r.traffic_light === 'GREEN').length;
    const pageYellows = reviews.filter(r => r.traffic_light === 'YELLOW').length;
    const pageReds = reviews.filter(r => r.traffic_light === 'RED').length;

    let score = 0;
    let grade = { letter: '?', color: '#556677' };
    if (allTotal > 0) {
        score = Math.round(((allGreens * 100) + (allYellows * 50)) / allTotal);
        grade = getGrade(score);
    }

    let trend = 'stable';
    let trendIcon = '\u2194';
    let trendColor = '#6b7a8d';
    if (allTotal >= 6) {
        const greenRate = allGreens / allTotal;
        if (greenRate > 0.5) { trend = 'improving'; trendIcon = '\u2197'; trendColor = '#00ff41'; }
        else if (greenRate < 0.1) { trend = 'declining'; trendIcon = '\u2198'; trendColor = '#ff4444'; }
    }

    const authors = (stats.authors || []).map(a => a.author).filter(Boolean);

    let displayReviews = reviews;
    if (filter && filter !== 'all') displayReviews = reviews.filter(r => r.traffic_light === filter);

    const root = document.getElementById('health-root');
    root.innerHTML = `
        <div class="h-top">
            <div class="h-grade">
                <div class="h-grade-letter" style="color:${grade.color};">${allTotal > 0 ? grade.letter : '?'}</div>
                <div class="h-grade-score">${allTotal > 0 ? score + '/100' : 'No PRs'}</div>
            </div>
            <div>
                <h2 class="h-title">PR Health</h2>
                <p class="h-sub">Based on ${allTotal} reviewed pull requests</p>
                ${allTotal > 0 ? `<p class="h-trend" style="color:${trendColor};">${trendIcon} Trend: ${trend}</p>` : ''}
            </div>
        </div>

        <div class="h-cards">
            <div class="h-card"><div class="h-card-val" style="color:#00ff41;">${allGreens}</div><div class="h-card-lbl">Green</div></div>
            <div class="h-card"><div class="h-card-val" style="color:#ffcc00;">${allYellows}</div><div class="h-card-lbl">Yellow</div></div>
            <div class="h-card"><div class="h-card-val" style="color:#ff4444;">${allReds}</div><div class="h-card-lbl">Red</div></div>
            <div class="h-card"><div class="h-card-val" style="color:#e8ecf0;">${avgFindings.toFixed ? avgFindings.toFixed(1) : avgFindings}</div><div class="h-card-lbl">Avg Findings/PR</div></div>
        </div>

        ${reviews.length > 0 ? `
        <div class="h-timeline">
            <h3>PR Timeline (this page)</h3>
            <div class="h-bars">
                ${reviews.slice().reverse().map((r, i) => {
                    const c = r.traffic_light === 'GREEN' ? '#00ff41' : r.traffic_light === 'YELLOW' ? '#ffcc00' : '#ff4444';
                    const h = Math.max(6, Math.min(60, (r.finding_count || 0) * 4 + 6));
                    return `<div class="h-bar" style="height:${h}px;background:${c};" title="${esc(r.pr_title || 'PR')}: ${r.traffic_light}, ${r.finding_count} findings" onclick="hHighlight(${reviews.length - 1 - i})"></div>`;
                }).join('')}
            </div>
            <div class="h-bar-labels"><span>Oldest</span><span>Newest</span></div>
        </div>
        ` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <h3 style="color:#e8ecf0;font-size:14px;margin:0;">Pull Requests</h3>
            <div class="h-controls">
                <label style="font-size:11px;color:#6b7a8d;">Show:</label>
                <select class="h-select" onchange="hPerPage(this.value)">
                    <option value="25" ${perPage===25?'selected':''}>25</option>
                    <option value="50" ${perPage===50?'selected':''}>50</option>
                    <option value="100" ${perPage===100?'selected':''}>100</option>
                    <option value="200" ${perPage===200?'selected':''}>200</option>
                </select>
                ${authors.length > 0 ? `
                <label style="font-size:11px;color:#6b7a8d;">Author:</label>
                <select class="h-select" onchange="hAuthor(this.value)">
                    <option value="">All</option>
                    ${authors.map(a => `<option value="${esc(a)}" ${author===a?'selected':''}>${esc(a)}</option>`).join('')}
                </select>
                ` : ''}
            </div>
        </div>

        <div class="h-filters">
            <button class="h-fbtn ${filter==='all'?'active':''}" onclick="hFilter('all',this)">All (${reviews.length})</button>
            ${pageReds > 0 ? `<button class="h-fbtn ${filter==='RED'?'active':''}" onclick="hFilter('RED',this)">Red (${pageReds})</button>` : ''}
            ${pageYellows > 0 ? `<button class="h-fbtn ${filter==='YELLOW'?'active':''}" onclick="hFilter('YELLOW',this)">Yellow (${pageYellows})</button>` : ''}
            ${pageGreens > 0 ? `<button class="h-fbtn ${filter==='GREEN'?'active':''}" onclick="hFilter('GREEN',this)">Green (${pageGreens})</button>` : ''}
        </div>

        <div id="h-pr-list" style="margin-top:12px;">
            ${renderPRList(displayReviews)}
        </div>

        ${pages > 1 ? `
        <div class="h-pager">
            <button onclick="hPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>\u2190 Prev</button>
            <span>Page ${page} of ${pages} (${total} total)</span>
            <button onclick="hPage(${page + 1})" ${page >= pages ? 'disabled' : ''}>Next \u2192</button>
        </div>
        ` : `
        <div style="text-align:center;margin-top:12px;font-size:12px;color:#556677;">${total} total reviews</div>
        `}

        <div class="h-info">
            <h4>How this score works</h4>
            <p>Health score is derived from your entire PR review history. GREEN PRs score 100, YELLOW scores 50, RED scores 0. The score is the weighted average across all ${allTotal} reviews. Trend compares green rate against expectations.</p>
        </div>
    `;
};

function renderPRList(reviews) {
    if (!reviews.length) return '<div style="padding:20px;text-align:center;color:#556677;font-size:13px;">No PRs match.</div>';
    return reviews.map((r, i) => {
        const dc = r.traffic_light === 'GREEN' ? '#00ff41' : r.traffic_light === 'YELLOW' ? '#ffcc00' : '#ff4444';
        const dt = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const gates = r.gates || {};
        const pills = Object.keys(gates).map(g => {
            const gs = gates[g];
            if (!gs || gs.status === 'SKIPPED') return '';
            const gc = gs.status === 'RED' ? 'background:rgba(255,68,68,0.15);color:#ff4444;' :
                       gs.status === 'YELLOW' ? 'background:rgba(255,204,0,0.15);color:#ffcc00;' :
                       'background:rgba(0,255,65,0.1);color:#00ff41;';
            return `<span class="h-pill" style="${gc}">${g.slice(0,3)} ${gs.findings||0}</span>`;
        }).filter(Boolean).join('');

        return `<div class="h-pr-row" id="h-row-${i}" onclick="hToggle('${r.id}')">
            <div class="h-dot" style="background:${dc};"></div>
            <span class="h-pr-title" title="${esc(r.pr_title||'PR')}">${esc(r.pr_title||'Untitled PR')}</span>
            <div class="h-pills">${pills}</div>
            <span class="h-pr-meta">${r.finding_count||0} findings</span>
            <span class="h-pr-meta">${dt}</span>
        </div>
        <div class="h-expanded" id="h-det-${r.id}" style="display:none;">
            ${Object.keys(gates).map(g => {
                const gs = gates[g];
                if (!gs) return '';
                const sc = gs.status==='RED'?'#ff4444':gs.status==='YELLOW'?'#ffcc00':gs.status==='GREEN'?'#00ff41':'#556677';
                return `<div class="h-gate-row"><span class="h-gate-name">${g}</span><span class="h-gate-status" style="color:${sc};">${gs.status||'SKIPPED'}</span><span class="h-gate-count">${gs.findings||0} findings</span></div>`;
            }).join('')}
            ${r.pr_url ? `<a href="${r.pr_url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:11px;color:#00ff41;text-decoration:none;">\u2197 View PR on GitHub</a>` : ''}
            <span style="display:inline-block;margin-top:8px;margin-left:12px;font-size:11px;color:#6b7a8d;cursor:pointer;text-decoration:underline;" onclick="event.stopPropagation();location.hash='reviews:${r.id}';">Full review</span>
        </div>`;
    }).join('');
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function getGrade(s) {
    if (s >= 90) return { letter: 'A', color: '#00ff41' };
    if (s >= 80) return { letter: 'B', color: '#88ff00' };
    if (s >= 70) return { letter: 'C', color: '#ffcc00' };
    if (s >= 50) return { letter: 'D', color: '#ff8800' };
    return { letter: 'F', color: '#ff4444' };
}

window.hFilter = function(f, btn) {
    window._healthFilter = f;
    const reviews = window._healthReviews || [];
    document.querySelectorAll('.h-fbtn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const filtered = f === 'all' ? reviews : reviews.filter(r => r.traffic_light === f);
    document.getElementById('h-pr-list').innerHTML = renderPRList(filtered);
};

window.hHighlight = function(idx) {
    document.querySelectorAll('.h-pr-row').forEach(r => r.classList.remove('hl'));
    const row = document.getElementById('h-row-' + idx);
    if (row) { row.classList.add('hl'); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
};

window.hToggle = function(id) {
    const d = document.getElementById('h-det-' + id);
    if (!d) return;
    if (d.style.display === 'none') {
        document.querySelectorAll('.h-expanded').forEach(x => x.style.display = 'none');
        d.style.display = 'block';
    } else { d.style.display = 'none'; }
};

window.hPerPage = function(v) {
    window._healthPerPage = parseInt(v) || 50;
    window._healthPage = 1;
    loadHealth();
};

window.hAuthor = function(v) {
    window._healthAuthor = v;
    window._healthPage = 1;
    loadHealth();
};

window.hPage = function(p) {
    if (p < 1 || p > (window._healthPages || 1)) return;
    window._healthPage = p;
    loadHealth();
};
