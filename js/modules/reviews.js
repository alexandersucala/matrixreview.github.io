/**
 * MatrixReview Dashboard — Reviews Module v2
 * Filterable by status (newest, oldest, red, green, yellow).
 * Detail view with proper text wrapping.
 * Save to: C:\Matrixreview.io\js\modules\reviews.js
 */
export default {
    async render(container, ctx) {
        if (ctx.subId) { await renderDetail(container, ctx); return; }
        const [rd, stats] = await Promise.all([ctx.api.getReviews(ctx.slug, 1, 100), ctx.api.getReviewStats(ctx.slug)]);
        let reviews = rd.reviews;

        container.innerHTML = `
            <div class="reviews-view">
                <div class="reviews-header"><h2>PR Reviews</h2><p>${rd.total} reviews total</p></div>
                <div class="review-stats-row">
                    ${miniStat(stats.total_reviews, 'Total')}
                    ${miniStat(stats.total_findings || 0, 'Findings')}
                    ${miniStat(stats.avg_findings_per_review || 0, 'Avg/PR')}
                    ${Object.entries(stats.by_traffic_light || {}).map(([l, c]) => miniStat(light(l) + ' ' + c, l)).join('')}
                </div>
                <div class="filter-bar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
                    <button class="filter-btn active" data-filter="newest">Newest</button>
                    <button class="filter-btn" data-filter="oldest">Oldest</button>
                    <button class="filter-btn" data-filter="RED" style="--fc:#ff4444;">Red Only</button>
                    <button class="filter-btn" data-filter="YELLOW" style="--fc:#ffcc00;">Yellow Only</button>
                    <button class="filter-btn" data-filter="GREEN" style="--fc:#00ff41;">Green Only</button>
                </div>
                <div id="review-list">${renderList(reviews)}</div>
            </div>`;

        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const f = btn.dataset.filter;
                let filtered = rd.reviews;
                if (f === 'oldest') filtered = [...rd.reviews].reverse();
                else if (f === 'RED' || f === 'YELLOW' || f === 'GREEN') filtered = rd.reviews.filter(r => r.traffic_light === f);
                document.getElementById('review-list').innerHTML = renderList(filtered);
            });
        });
    },
    destroy() {}
};

function renderList(reviews) {
    if (!reviews.length) return '<div style="padding:40px;text-align:center;color:#6b7a8d;">No reviews match this filter</div>';
    return reviews.map(r => `
        <div class="review-table-row" onclick="location.hash='reviews:${r.id}'" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #1e2a3a;cursor:pointer;">
            <span style="font-size:16px;">${light(r.traffic_light)}</span>
            <div style="flex:1;min-width:0;">
                <div style="font-size:14px;color:#e8ecf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.pr_title || 'Untitled'}</div>
                <div style="font-size:12px;color:#6b7a8d;">${r.finding_count} findings · ${ago(r.created_at)}</div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
                ${Object.entries(r.gates || {}).map(([g, i]) => `<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:${gateBg(i.status)};color:${gateColor(i.status)};">${g.slice(0,3)}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

async function renderDetail(container, ctx) {
    const r = await ctx.api.getReview(ctx.slug, ctx.subId);
    const total = r.gates.reduce((s, g) => s + g.finding_count, 0);

    container.innerHTML = `
        <div style="max-width:900px;">
            <button onclick="location.hash='reviews'" style="background:none;border:1px solid #1e2a3a;color:#c5cdd8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:16px;">Back to Reviews</button>
            <h2 style="color:#e8ecf0;margin:8px 0;word-wrap:break-word;overflow-wrap:break-word;">${light(r.traffic_light)} ${r.pr_title || 'Untitled PR'}</h2>
            ${r.pr_url ? `<a href="${r.pr_url}" target="_blank" style="color:#00ff41;font-size:13px;">View on GitHub</a>` : ''}
            <p style="font-size:13px;color:#6b7a8d;margin:8px 0 24px;">${total} findings · ${r.gates.length} gates · ${ago(r.created_at)}</p>

            ${r.gates.map(g => `
                <div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:16px;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                        <span style="font-weight:600;color:#e8ecf0;">${g.gate || 'Unknown'}</span>
                        <span style="color:${gateColor(g.status)};">${g.status}</span>
                        <span style="font-size:12px;color:#6b7a8d;">${g.finding_count} findings</span>
                    </div>
                    ${g.summary ? `<p style="font-size:13px;color:#6b7a8d;margin-bottom:12px;word-wrap:break-word;overflow-wrap:break-word;">${g.summary}</p>` : ''}
                    ${g.findings.map(f => `
                        <div style="display:flex;gap:12px;padding:10px 0;border-top:1px solid #1e2a3a;">
                            <span style="flex-shrink:0;">${confIcon(f.confidence)}</span>
                            <div style="flex:1;min-width:0;overflow:hidden;">
                                <p style="font-size:13px;color:#c5cdd8;word-wrap:break-word;overflow-wrap:break-word;white-space:pre-wrap;">${f.description}</p>
                                ${f.suggested_fix ? `<p style="font-size:12px;color:#00ff41;margin-top:4px;word-wrap:break-word;overflow-wrap:break-word;white-space:pre-wrap;">Fix: ${f.suggested_fix}</p>` : ''}
                                <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
                                    ${f.pr_line_ref ? `<span style="font-size:11px;color:#6b7a8d;background:#0a0e14;padding:2px 6px;border-radius:3px;">${f.pr_line_ref}</span>` : ''}
                                    ${f.doc_line_ref ? `<span style="font-size:11px;color:#6b7a8d;background:#0a0e14;padding:2px 6px;border-radius:3px;">Doc: ${f.doc_line_ref}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>`;
}

function miniStat(v, l) {
    return `<div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:12px 16px;display:flex;flex-direction:column;align-items:center;min-width:80px;">
        <span style="font-size:20px;font-weight:600;color:#e8ecf0;">${v}</span>
        <span style="font-size:11px;color:#6b7a8d;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">${l}</span>
    </div>`;
}

function light(l) { return l === 'RED' ? '\uD83D\uDD34' : l === 'YELLOW' ? '\uD83D\uDFE1' : l === 'GREEN' ? '\uD83D\uDFE2' : '\u26AA'; }
function confIcon(c) { return c === 'HIGH' ? '\u2699\uFE0F' : c === 'MEDIUM' ? '\uD83D\uDD0E' : '\uD83D\uDCAD'; }
function gateBg(s) { return s === 'RED' ? 'rgba(255,68,68,0.2)' : s === 'YELLOW' ? 'rgba(255,204,0,0.2)' : s === 'GREEN' ? 'rgba(0,255,65,0.2)' : 'rgba(100,100,100,0.2)'; }
function gateColor(s) { return s === 'RED' ? '#ff4444' : s === 'YELLOW' ? '#ffcc00' : s === 'GREEN' ? '#00ff41' : '#6b7a8d'; }
function ago(d) { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago'; }
