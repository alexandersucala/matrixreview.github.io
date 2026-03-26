/**
 * MatrixReview Dashboard — Overview Module v2
 * Handles missing structured health data by parsing from API response.
 * Save to: C:\Matrixreview.io\js\modules\overview.js
 */
export default {
    async render(container, ctx) {
        const data = await ctx.api.getOverview(ctx.slug);

        // Try to get health score, fall back to loading health report directly
        let healthScore = data.health?.health_score ?? null;
        let findingsCount = data.health?.findings_count ?? 0;

        if ((healthScore === null || healthScore === 0) && data.health) {
            // Health data exists but score is 0/null. Try loading full report.
            try {
                const fullHealth = await ctx.api.getHealth(ctx.slug);
                if (fullHealth.body) {
                    const sm = fullHealth.body.match(/Health Score:\*\*\s*(\d+)\/100/);
                    if (sm) healthScore = parseInt(sm[1]);
                    const cm = fullHealth.body.match(/Critical\s*\((\d+)\)/);
                    const hm = fullHealth.body.match(/High\s*\((\d+)\)/);
                    const mm = fullHealth.body.match(/Medium\s*\((\d+)\)/);
                    const lm = fullHealth.body.match(/Low\s*\((\d+)\)/);
                    findingsCount = (cm ? parseInt(cm[1]) : 0) + (hm ? parseInt(hm[1]) : 0) + (mm ? parseInt(mm[1]) : 0) + (lm ? parseInt(lm[1]) : 0);
                    if (healthScore === null || healthScore === 0) {
                        healthScore = Math.max(0, 100 - ((cm ? parseInt(cm[1]) : 0) * 10) - ((hm ? parseInt(hm[1]) : 0) * 5) - ((mm ? parseInt(mm[1]) : 0) * 2) - ((lm ? parseInt(lm[1]) : 0) * 1));
                    }
                }
            } catch (e) { /* Health report not available */ }
        }

        const sg = healthScore !== null ? getGrade(healthScore) : { letter: '?', color: '#555' };

        container.innerHTML = `
            <div class="overview-grid">
                <div class="overview-header">
                    <h2>${data.company.github_repo || data.company.name}</h2>
                    <p class="subtitle">Dashboard overview</p>
                </div>

                <div class="stat-card health-card" onclick="location.hash='health'" style="display:flex;align-items:center;gap:20px;">
                    <div style="width:80px;height:80px;border-radius:50%;background:conic-gradient(${sg.color} ${(healthScore || 0) * 3.6}deg, #1e2a3a 0);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <div style="width:60px;height:60px;background:var(--bg-card);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                            <span style="font-size:24px;font-weight:700;color:${sg.color};">${sg.letter}</span>
                            <span style="font-size:10px;color:#6b7a8d;">${healthScore ?? '?'}/100</span>
                        </div>
                    </div>
                    <div>
                        <span style="font-size:14px;">Health Score</span><br>
                        <span style="font-size:12px;color:#6b7a8d;">${findingsCount} findings</span>
                    </div>
                </div>

                <div class="stat-card" onclick="location.hash='docs'">
                    <div class="stat-number">${data.docs.total}</div>
                    <div class="stat-label">Documents</div>
                    <div class="stat-breakdown">${Object.entries(data.docs.by_gate).map(([g, c]) => g + ': ' + c).join(' · ')}</div>
                </div>

                <div class="stat-card" onclick="location.hash='reviews'">
                    <div class="stat-number">${data.reviews.total}</div>
                    <div class="stat-label">PR Reviews</div>
                    <div class="stat-breakdown">${data.reviews.recent.length > 0 ? 'Latest: ' + data.reviews.recent[0].traffic_light : 'No reviews yet'}</div>
                </div>

                <div class="stat-card" onclick="location.hash='graph'">
                    <div class="stat-number">${data.graph ? data.graph.total_files.toLocaleString() : '\u2014'}</div>
                    <div class="stat-label">Source Files</div>
                    <div class="stat-breakdown">${data.graph ? data.graph.total_edges.toLocaleString() + ' deps · ' + data.graph.entry_points + ' entry points' : 'No graph'}</div>
                </div>

                ${data.graph && data.graph.languages ? `
                <div class="stat-card">
                    <h3>Languages</h3>
                    <div>${Object.entries(data.graph.languages).sort((a,b) => b[1]-a[1]).slice(0,5).map(([l, c]) =>
                        `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="font-size:13px;">${l}</span><span style="font-size:13px;color:#6b7a8d;">${c.toLocaleString()}</span></div>`
                    ).join('')}</div>
                </div>` : ''}

                ${data.graph && data.graph.top_fan_in ? `
                <div class="stat-card">
                    <h3>Hotspot Files</h3>
                    <div>${data.graph.top_fan_in.slice(0, 5).map(f =>
                        `<div onclick="location.hash='graph:${f.path}'" style="display:flex;justify-content:space-between;padding:6px 0;cursor:pointer;border-bottom:1px solid #1e2a3a;">
                            <span style="font-size:13px;">${f.path.split('/').pop()}</span>
                            <span style="font-size:12px;color:#6b7a8d;">${f.importers} importers</span>
                        </div>`
                    ).join('')}</div>
                </div>` : ''}

                ${data.reviews.recent.length > 0 ? `
                <div class="stat-card wide">
                    <h3>Recent Reviews</h3>
                    <div>${data.reviews.recent.slice(0, 5).map(r =>
                        `<div onclick="location.hash='reviews:${r.id}'" style="display:flex;align-items:center;gap:12px;padding:8px 0;cursor:pointer;border-bottom:1px solid #1e2a3a;">
                            <span>${light(r.traffic_light)}</span>
                            <span style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.pr_title || 'Untitled'}</span>
                            <span style="font-size:11px;color:#6b7a8d;">${ago(r.created_at)}</span>
                        </div>`
                    ).join('')}</div>
                </div>` : ''}
            </div>`;
    },
    destroy() {}
};

function getGrade(s) {
    if (s >= 90) return { letter: 'A', color: '#00ff41' };
    if (s >= 80) return { letter: 'B', color: '#88ff00' };
    if (s >= 70) return { letter: 'C', color: '#ffcc00' };
    if (s >= 50) return { letter: 'D', color: '#ff8800' };
    return { letter: 'F', color: '#ff4444' };
}
function light(l) { return l === 'RED' ? '\uD83D\uDD34' : l === 'YELLOW' ? '\uD83D\uDFE1' : l === 'GREEN' ? '\uD83D\uDFE2' : '\u26AA'; }
function ago(d) { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago'; }
