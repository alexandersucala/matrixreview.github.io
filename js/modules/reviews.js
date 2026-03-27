/**
 * MatrixReview Dashboard — Reviews Module v3
 * Author filter with checkable pills. Clickable file/doc refs. Status filters.
 * Save to: C:\Matrixreview.io\js\modules\reviews.js
 */
export default {
    async render(container, ctx) {
        if (ctx.subId) { await renderDetail(container, ctx); return; }
        const [rd, stats] = await Promise.all([ctx.api.getReviews(ctx.slug, 1, 200), ctx.api.getReviewStats(ctx.slug)]);
        const reviews = rd.reviews;

        // Extract unique authors
        const authors = [...new Set(reviews.map(r => r.author).filter(Boolean))].sort();
        let selectedAuthors = new Set();
        let currentFilter = 'newest';

        container.innerHTML = `
            <div>
                <div style="margin-bottom:16px;"><h2 style="color:#e8ecf0;margin:0;">PR Reviews</h2><p style="color:#6b7a8d;margin:4px 0 0;">${rd.total} reviews</p></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                    ${miniStat(stats.total_reviews, 'Total')}
                    ${miniStat(stats.total_findings || 0, 'Findings')}
                    ${miniStat(stats.avg_findings_per_review || 0, 'Avg/PR')}
                    ${Object.entries(stats.by_traffic_light || {}).map(([l, c]) => miniStat(light(l) + ' ' + c, l)).join('')}
                </div>

                <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
                    <button class="rv-btn active" data-filter="newest">Newest</button>
                    <button class="rv-btn" data-filter="oldest">Oldest</button>
                    <button class="rv-btn" data-filter="RED">Red Only</button>
                    <button class="rv-btn" data-filter="YELLOW">Yellow Only</button>
                    <button class="rv-btn" data-filter="GREEN">Green Only</button>
                </div>

                ${authors.length > 0 ? `
                <div style="margin-bottom:16px;">
                    <div style="position:relative;display:inline-block;">
                        <input id="author-search" type="text" placeholder="Filter by author..." style="background:#131B26;border:1px solid #1e2a3a;color:#c5cdd8;padding:8px 14px;border-radius:6px;font-size:13px;width:220px;">
                        <div id="author-dropdown" style="display:none;position:absolute;top:100%;left:0;width:260px;background:#131B26;border:1px solid #1e2a3a;border-radius:6px;max-height:200px;overflow-y:auto;z-index:10;margin-top:4px;">
                            ${authors.map(a => `<label style="display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:#c5cdd8;" class="author-option">
                                <input type="checkbox" value="${esc(a)}" class="author-check" style="accent-color:#00ff41;"> ${esc(a)}
                            </label>`).join('')}
                        </div>
                    </div>
                    <span id="author-pills" style="display:inline-flex;gap:4px;margin-left:8px;flex-wrap:wrap;"></span>
                </div>` : ''}

                <div id="review-list">${renderList(reviews)}</div>
            </div>
            <style>
                .rv-btn { background:transparent; border:1px solid #1e2a3a; color:#6b7a8d; padding:6px 14px; border-radius:4px; cursor:pointer; font-size:12px; }
                .rv-btn.active { background:rgba(0,255,65,0.08); border-color:#00ff41; color:#00ff41; }
            </style>`;

        // Status filters
        container.querySelectorAll('.rv-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.rv-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                applyFilters();
            });
        });

        // Author search dropdown
        const authorSearch = container.querySelector('#author-search');
        const dropdown = container.querySelector('#author-dropdown');
        const pillsContainer = container.querySelector('#author-pills');

        if (authorSearch) {
            authorSearch.addEventListener('focus', () => { dropdown.style.display = 'block'; });
            authorSearch.addEventListener('input', () => {
                const q = authorSearch.value.toLowerCase();
                dropdown.querySelectorAll('.author-option').forEach(opt => {
                    opt.style.display = opt.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
                });
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#author-search') && !e.target.closest('#author-dropdown')) dropdown.style.display = 'none';
            });
            dropdown.querySelectorAll('.author-check').forEach(cb => {
                cb.addEventListener('change', () => {
                    if (cb.checked) selectedAuthors.add(cb.value);
                    else selectedAuthors.delete(cb.value);
                    renderPills();
                    applyFilters();
                });
            });
        }

        function renderPills() {
            if (!pillsContainer) return;
            pillsContainer.innerHTML = [...selectedAuthors].map(a =>
                `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,255,65,0.1);border:1px solid #00ff41;color:#00ff41;padding:2px 10px;border-radius:12px;font-size:11px;">${esc(a)} <span class="remove-author" data-author="${esc(a)}" style="cursor:pointer;font-size:14px;line-height:1;">\u00d7</span></span>`
            ).join('');
            pillsContainer.querySelectorAll('.remove-author').forEach(x => {
                x.addEventListener('click', () => {
                    selectedAuthors.delete(x.dataset.author);
                    const cb = dropdown.querySelector(`input[value="${x.dataset.author}"]`);
                    if (cb) cb.checked = false;
                    renderPills();
                    applyFilters();
                });
            });
        }

        function applyFilters() {
            let filtered = [...reviews];
            if (currentFilter === 'oldest') filtered.reverse();
            else if (['RED', 'YELLOW', 'GREEN'].includes(currentFilter)) filtered = filtered.filter(r => r.traffic_light === currentFilter);
            if (selectedAuthors.size > 0) filtered = filtered.filter(r => selectedAuthors.has(r.author));
            document.getElementById('review-list').innerHTML = renderList(filtered);
        }
    },
    destroy() {}
};

async function renderDetail(container, ctx) {
    const r = await ctx.api.getReview(ctx.slug, ctx.subId);
    let repo = '';
    try { const ov = await ctx.api.getOverview(ctx.slug); repo = ov.company?.github_repo || ''; } catch(e) {}

    container.innerHTML = `
        <div style="max-width:900px;">
            <button onclick="location.hash='reviews'" style="background:none;border:1px solid #1e2a3a;color:#c5cdd8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:16px;">\u2190 Back to Reviews</button>
            <h2 style="color:#e8ecf0;margin:8px 0;word-wrap:break-word;">${light(r.traffic_light)} ${r.pr_title || 'Untitled PR'}</h2>
            ${r.pr_url ? `<a href="${r.pr_url}" target="_blank" style="color:#00ff41;font-size:13px;">View on GitHub \u2192</a>` : ''}
            <p style="font-size:13px;color:#6b7a8d;margin:8px 0 24px;">${r.gates.reduce((s,g) => s+g.finding_count, 0)} findings, ${r.gates.length} gates, ${ago(r.created_at)}</p>

            ${r.gates.map(g => `
                <div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:16px;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                        <span style="font-weight:600;color:#e8ecf0;">${g.gate || 'Unknown'}</span>
                        <span style="color:${gateColor(g.status)};">${g.status}</span>
                        <span style="font-size:12px;color:#6b7a8d;">${g.finding_count} findings</span>
                    </div>
                    ${g.summary ? `<p style="font-size:13px;color:#6b7a8d;margin-bottom:12px;word-wrap:break-word;">${g.summary}</p>` : ''}
                    ${g.findings.map(f => {
                        const fileGhUrl = (repo && f.pr_line_ref) ? makeGhLink(repo, f.pr_line_ref) : '';
                        return `
                        <div style="display:flex;gap:12px;padding:10px 0;border-top:1px solid #1e2a3a;">
                            <span style="flex-shrink:0;">${confIcon(f.confidence)}</span>
                            <div style="flex:1;min-width:0;overflow:hidden;">
                                <p style="font-size:13px;color:#c5cdd8;word-wrap:break-word;white-space:pre-wrap;">${f.description}</p>
                                ${f.suggested_fix ? `<p style="font-size:12px;color:#00ff41;margin-top:4px;word-wrap:break-word;white-space:pre-wrap;">Fix: ${f.suggested_fix}</p>` : ''}
                                <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
                                    ${f.pr_line_ref ? (fileGhUrl
                                        ? `<a href="${fileGhUrl}" target="_blank" style="font-size:11px;color:#60a5fa;background:#0a0e14;padding:3px 8px;border-radius:3px;text-decoration:none;">${f.pr_line_ref} \u2192</a>`
                                        : `<span style="font-size:11px;color:#6b7a8d;background:#0a0e14;padding:3px 8px;border-radius:3px;">${f.pr_line_ref}</span>`)
                                    : ''}
                                    ${f.doc_line_ref ? `<span onclick="location.hash='docs'" style="font-size:11px;color:#f59e0b;background:#0a0e14;padding:3px 8px;border-radius:3px;cursor:pointer;">Doc: ${f.doc_line_ref}</span>` : ''}
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            `).join('')}
        </div>`;
}

function makeGhLink(repo, lineRef) {
    // Parse "scripts/auto-grant.sql line 27" into a GitHub URL
    const m = lineRef.match(/^(.+?)\s+lines?\s+(\d+)/i);
    if (m) return `https://github.com/${repo}/blob/main/${m[1]}#L${m[2]}`;
    // Try just "file.ts:27"
    const m2 = lineRef.match(/^(.+?):(\d+)/);
    if (m2) return `https://github.com/${repo}/blob/main/${m2[1]}#L${m2[2]}`;
    return '';
}

function renderList(reviews) {
    if (!reviews.length) return '<div style="padding:40px;text-align:center;color:#6b7a8d;">No reviews match this filter</div>';
    return reviews.map(r => `
        <div onclick="location.hash='reviews:${r.id}'" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #1e2a3a;cursor:pointer;">
            <span style="font-size:16px;">${light(r.traffic_light)}</span>
            <div style="flex:1;min-width:0;">
                <div style="font-size:14px;color:#e8ecf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.pr_title || 'Untitled'}</div>
                <div style="font-size:12px;color:#6b7a8d;">${r.finding_count} findings${r.author ? ' by ' + r.author : ''} \u00b7 ${ago(r.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function miniStat(v, l) {
    return `<div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:10px 14px;text-align:center;min-width:70px;">
        <span style="font-size:18px;font-weight:600;color:#e8ecf0;">${v}</span><br>
        <span style="font-size:10px;color:#6b7a8d;text-transform:uppercase;">${l}</span>
    </div>`;
}

function light(l) { return l === 'RED' ? '\uD83D\uDD34' : l === 'YELLOW' ? '\uD83D\uDFE1' : l === 'GREEN' ? '\uD83D\uDFE2' : '\u26AA'; }
function confIcon(c) { return c === 'HIGH' ? '\u2699\uFE0F' : c === 'MEDIUM' ? '\uD83D\uDD0E' : '\uD83D\uDCAD'; }
function gateColor(s) { return s === 'RED' ? '#ff4444' : s === 'YELLOW' ? '#ffcc00' : s === 'GREEN' ? '#00ff41' : '#6b7a8d'; }
function ago(d) { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return m + 'm ago'; const h = Math.floor(m/60); if (h < 24) return h + 'h ago'; return Math.floor(h/24) + 'd ago'; }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
