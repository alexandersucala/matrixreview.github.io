/**
 * MatrixReview Dashboard — Health Module v5
 * 
 * Health score derived from PR review history.
 * PR list with findings breakdown per PR.
 * Clickable timeline bars highlight corresponding PR in list.
 * 
 * Save to: C:\Matrixreview.io\js\modules\health.js
 */
export default {
    async render(container, ctx) {
        let stats = {};
        let reviews = [];
        try {
            stats = await ctx.api.getReviewStats(ctx.slug);
            const rd = await ctx.api.getReviews(ctx.slug, 1, 50);
            reviews = rd.reviews || [];
        } catch (e) {}

        const total = reviews.length;
        const greens = reviews.filter(r => r.traffic_light === 'GREEN').length;
        const yellows = reviews.filter(r => r.traffic_light === 'YELLOW').length;
        const reds = reviews.filter(r => r.traffic_light === 'RED').length;

        let score = 0;
        let grade = { letter: '?', color: '#556677' };
        let hasData = total > 0;

        if (hasData) {
            score = Math.round(((greens * 100) + (yellows * 50)) / total);
            grade = getGrade(score);
        }

        let trend = 'stable';
        let trendIcon = '\u2194';
        if (total >= 6) {
            const half = Math.floor(total / 2);
            const olderGreens = reviews.slice(half).filter(r => r.traffic_light === 'GREEN').length;
            const newerGreens = reviews.slice(0, half).filter(r => r.traffic_light === 'GREEN').length;
            const olderRate = olderGreens / (total - half);
            const newerRate = newerGreens / half;
            if (newerRate > olderRate + 0.1) { trend = 'improving'; trendIcon = '\u2197'; }
            else if (newerRate < olderRate - 0.1) { trend = 'declining'; trendIcon = '\u2198'; }
        }

        const avgFindings = stats.avg_findings_per_review || 0;

        container.innerHTML = `
            <div style="max-width:960px;">
                <div style="display:flex;align-items:center;gap:24px;margin-bottom:32px;">
                    <div style="text-align:center;">
                        <div style="font-size:56px;font-weight:700;color:${grade.color};">${hasData ? grade.letter : '?'}</div>
                        <div style="font-size:14px;color:#6b7a8d;">${hasData ? score + '/100' : 'No PRs yet'}</div>
                    </div>
                    <div>
                        <h2 style="color:#e8ecf0;margin:0;">PR Health</h2>
                        <p style="color:#6b7a8d;margin:4px 0 0;">Based on ${total} reviewed pull requests</p>
                        ${hasData ? `<p style="font-size:13px;color:${trend === 'improving' ? '#00ff41' : trend === 'declining' ? '#ff4444' : '#6b7a8d'};margin-top:4px;">${trendIcon} Trend: ${trend}</p>` : ''}
                    </div>
                </div>

                ${hasData ? `
                <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
                    <div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:16px 24px;text-align:center;flex:1;min-width:100px;">
                        <div style="font-size:28px;font-weight:600;color:#00ff41;">${greens}</div>
                        <div style="font-size:11px;color:#6b7a8d;text-transform:uppercase;margin-top:4px;">Green</div>
                    </div>
                    <div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:16px 24px;text-align:center;flex:1;min-width:100px;">
                        <div style="font-size:28px;font-weight:600;color:#ffcc00;">${yellows}</div>
                        <div style="font-size:11px;color:#6b7a8d;text-transform:uppercase;margin-top:4px;">Yellow</div>
                    </div>
                    <div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:16px 24px;text-align:center;flex:1;min-width:100px;">
                        <div style="font-size:28px;font-weight:600;color:#ff4444;">${reds}</div>
                        <div style="font-size:11px;color:#6b7a8d;text-transform:uppercase;margin-top:4px;">Red</div>
                    </div>
                    <div style="background:#131B26;border:1px solid #1e2a3a;border-radius:8px;padding:16px 24px;text-align:center;flex:1;min-width:100px;">
                        <div style="font-size:28px;font-weight:600;color:#e8ecf0;">${avgFindings.toFixed ? avgFindings.toFixed(1) : avgFindings}</div>
                        <div style="font-size:11px;color:#6b7a8d;text-transform:uppercase;margin-top:4px;">Avg Findings/PR</div>
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:#e8ecf0;font-size:14px;margin-bottom:12px;">PR Timeline</h3>
                    <div style="display:flex;gap:3px;align-items:end;height:60px;">
                        ${reviews.slice(0, 50).reverse().map((r, i) => {
                            const color = r.traffic_light === 'GREEN' ? '#00ff41' : r.traffic_light === 'YELLOW' ? '#ffcc00' : '#ff4444';
                            const height = Math.max(8, Math.min(60, (r.finding_count || 0) * 4 + 8));
                            return `<div title="${r.pr_title || 'PR'}: ${r.traffic_light}, ${r.finding_count} findings" data-bar-idx="${i}" style="flex:1;min-width:4px;max-width:16px;height:${height}px;background:${color};border-radius:2px 2px 0 0;cursor:pointer;opacity:0.8;transition:opacity 0.15s;" onclick="highlightPR(${reviews.length - 1 - i})"></div>`;
                        }).join('')}
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                        <span style="font-size:10px;color:#556677;">Oldest</span>
                        <span style="font-size:10px;color:#556677;">Newest</span>
                    </div>
                </div>

                <!-- PR LIST -->
                <div style="margin-bottom:24px;">
                    <h3 style="color:#e8ecf0;font-size:14px;margin-bottom:12px;">Pull Requests (${total})</h3>
                    <div style="display:flex;gap:8px;margin-bottom:12px;">
                        <button class="health-filter active" data-filter="all" onclick="filterPRs('all',this)">All (${total})</button>
                        ${reds > 0 ? `<button class="health-filter" data-filter="RED" onclick="filterPRs('RED',this)">Red (${reds})</button>` : ''}
                        ${yellows > 0 ? `<button class="health-filter" data-filter="YELLOW" onclick="filterPRs('YELLOW',this)">Yellow (${yellows})</button>` : ''}
                        ${greens > 0 ? `<button class="health-filter" data-filter="GREEN" onclick="filterPRs('GREEN',this)">Green (${greens})</button>` : ''}
                    </div>
                    <div id="pr-list" style="max-height:500px;overflow-y:auto;">
                        ${renderPRList(reviews)}
                    </div>
                </div>

                ` : `
                <div style="text-align:center;padding:60px 20px;background:#131B26;border:1px solid #1e2a3a;border-radius:8px;">
                    <div style="font-size:40px;margin-bottom:12px;">\uD83D\uDCCA</div>
                    <h3 style="color:#e8ecf0;margin-bottom:8px;">No PR data yet</h3>
                    <p style="color:#6b7a8d;font-size:13px;">Health score will populate as MatrixReview reviews pull requests on this repo. Open a PR to get started.</p>
                </div>
                `}

                <div style="margin-top:24px;padding:16px;background:#131B26;border:1px solid #1e2a3a;border-radius:8px;">
                    <h4 style="color:#6b7a8d;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">How this score works</h4>
                    <p style="color:#556677;font-size:12px;line-height:1.6;">
                        Health score is derived from your PR review history. GREEN PRs score 100, YELLOW scores 50, RED scores 0.
                        The score is the weighted average across your last ${total || 50} reviews.
                        Trend compares your recent PRs against older ones to show if code quality is improving or declining.
                    </p>
                </div>
            </div>`;

        // Store reviews on window for filter/highlight
        window._healthReviews = reviews;

        // Inject filter/highlight styles
        if (!document.getElementById('health-extra-css')) {
            const style = document.createElement('style');
            style.id = 'health-extra-css';
            style.textContent = `
                .health-filter { background:#131B26; border:1px solid #1e2a3a; color:#6b7a8d; padding:6px 14px; border-radius:6px; font-size:12px; cursor:pointer; font-family:inherit; transition:all 0.15s; }
                .health-filter:hover { border-color:#00ff41; color:#e8ecf0; }
                .health-filter.active { background:rgba(0,255,65,0.1); border-color:#00ff41; color:#00ff41; }
                .pr-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid #1e2a3a; cursor:pointer; transition:background 0.15s; }
                .pr-row:hover { background:rgba(0,255,65,0.04); }
                .pr-row.highlighted { background:rgba(0,255,65,0.08); border-left:3px solid #00ff41; }
                .pr-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
                .pr-title { font-size:13px; color:#e8ecf0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .pr-meta { font-size:11px; color:#556677; white-space:nowrap; }
                .pr-findings { display:flex; gap:4px; flex-shrink:0; }
                .pr-gate-pill { font-size:10px; padding:2px 6px; border-radius:3px; font-family:monospace; }
                .pr-expanded { padding:8px 14px 14px 36px; border-bottom:1px solid #1e2a3a; background:#0a0e14; }
                .pr-expanded .gate-row { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:12px; }
                .pr-expanded .gate-name { width:110px; color:#6b7a8d; text-transform:uppercase; font-size:11px; font-family:monospace; }
                .pr-expanded .gate-status { font-weight:600; }
                .pr-expanded .gate-count { color:#556677; font-size:11px; }
            `;
            document.head.appendChild(style);
        }
    },
    destroy() {
        delete window._healthReviews;
        delete window.highlightPR;
        delete window.filterPRs;
        delete window.togglePRDetail;
        const s = document.getElementById('health-extra-css');
        if (s) s.remove();
    }
};

function renderPRList(reviews, filter) {
    const filtered = filter && filter !== 'all' ? reviews.filter(r => r.traffic_light === filter) : reviews;
    if (!filtered.length) {
        return '<div style="padding:20px;text-align:center;color:#556677;font-size:13px;">No PRs match this filter.</div>';
    }
    return filtered.map((r, i) => {
        const dotColor = r.traffic_light === 'GREEN' ? '#00ff41' : r.traffic_light === 'YELLOW' ? '#ffcc00' : '#ff4444';
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const gates = r.gates || {};
        const gateKeys = Object.keys(gates);

        const gatePills = gateKeys.map(g => {
            const gs = gates[g];
            if (!gs || gs.status === 'SKIPPED') return '';
            const gc = gs.status === 'RED' ? 'background:rgba(255,68,68,0.15);color:#ff4444;' :
                       gs.status === 'YELLOW' ? 'background:rgba(255,204,0,0.15);color:#ffcc00;' :
                       'background:rgba(0,255,65,0.1);color:#00ff41;';
            return `<span class="pr-gate-pill" style="${gc}">${g.slice(0,3)} ${gs.findings || 0}</span>`;
        }).filter(Boolean).join('');

        return `<div class="pr-row" id="pr-row-${i}" onclick="togglePRDetail('${r.id}', this)">
            <div class="pr-dot" style="background:${dotColor};"></div>
            <span class="pr-title" title="${esc(r.pr_title || 'PR')}">${esc(r.pr_title || 'Untitled PR')}</span>
            <div class="pr-findings">${gatePills}</div>
            <span class="pr-meta">${r.finding_count || 0} findings</span>
            <span class="pr-meta">${date}</span>
        </div>
        <div class="pr-expanded" id="pr-detail-${r.id}" style="display:none;">
            ${gateKeys.map(g => {
                const gs = gates[g];
                if (!gs) return '';
                const sc = gs.status === 'RED' ? '#ff4444' : gs.status === 'YELLOW' ? '#ffcc00' : gs.status === 'GREEN' ? '#00ff41' : '#556677';
                return `<div class="gate-row">
                    <span class="gate-name">${g}</span>
                    <span class="gate-status" style="color:${sc};">${gs.status || 'SKIPPED'}</span>
                    <span class="gate-count">${gs.findings || 0} findings</span>
                </div>`;
            }).join('')}
            ${r.pr_url ? `<a href="${r.pr_url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:11px;color:#00ff41;text-decoration:none;">\u2197 View PR on GitHub</a>` : ''}
            <span style="display:inline-block;margin-top:8px;margin-left:12px;font-size:11px;color:#6b7a8d;cursor:pointer;text-decoration:underline;" onclick="event.stopPropagation();location.hash='reviews:${r.id}';">View full review</span>
        </div>`;
    }).join('');
}

function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getGrade(s) {
    if (s >= 90) return { letter: 'A', color: '#00ff41' };
    if (s >= 80) return { letter: 'B', color: '#88ff00' };
    if (s >= 70) return { letter: 'C', color: '#ffcc00' };
    if (s >= 50) return { letter: 'D', color: '#ff8800' };
    return { letter: 'F', color: '#ff4444' };
}

// Global functions for onclick handlers
window.filterPRs = function(filter, btn) {
    const reviews = window._healthReviews || [];
    document.querySelectorAll('.health-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('pr-list').innerHTML = renderPRList(reviews, filter);
};

window.highlightPR = function(idx) {
    document.querySelectorAll('.pr-row').forEach(r => r.classList.remove('highlighted'));
    const row = document.getElementById('pr-row-' + idx);
    if (row) {
        row.classList.add('highlighted');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

window.togglePRDetail = function(id, row) {
    const detail = document.getElementById('pr-detail-' + id);
    if (!detail) return;
    if (detail.style.display === 'none') {
        document.querySelectorAll('.pr-expanded').forEach(d => d.style.display = 'none');
        detail.style.display = 'block';
    } else {
        detail.style.display = 'none';
    }
};
