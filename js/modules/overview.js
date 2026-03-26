/**
 * MatrixReview Dashboard — Overview Module
 * 
 * Landing page: health score donut, stat cards, recent PRs, graph summary.
 * 
 * Save to: C:\Matrixreview.io\js\modules\overview.js
 */

export default {
    async render(container, ctx) {
        const data = await ctx.api.getOverview(ctx.slug);

        const healthScore = data.health?.health_score ?? null;
        const scoreGrade = healthScore !== null ? getGrade(healthScore) : { letter: '?', color: '#555' };

        container.innerHTML = `
            <div class="overview-grid">
                <div class="overview-header">
                    <h2>${data.company.github_repo || data.company.name}</h2>
                    <p class="subtitle">Dashboard overview</p>
                </div>

                <!-- Health Score Card -->
                <div class="stat-card health-card" onclick="location.hash='health'">
                    <div class="health-donut" style="--score: ${healthScore ?? 0}; --color: ${scoreGrade.color}">
                        <div class="health-score-inner">
                            <span class="health-letter">${scoreGrade.letter}</span>
                            <span class="health-number">${healthScore ?? '—'}/100</span>
                        </div>
                    </div>
                    <div class="health-meta">
                        <span>Health Score</span>
                        ${data.health ? `<span class="detail">${data.health.findings_count} findings</span>` : '<span class="detail">No scan yet</span>'}
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="stat-card" onclick="location.hash='docs'">
                    <div class="stat-number">${data.docs.total}</div>
                    <div class="stat-label">Documents</div>
                    <div class="stat-breakdown">${Object.entries(data.docs.by_gate).map(([g, c]) => `${g}: ${c}`).join(' · ')}</div>
                </div>

                <div class="stat-card" onclick="location.hash='reviews'">
                    <div class="stat-number">${data.reviews.total}</div>
                    <div class="stat-label">PR Reviews</div>
                    <div class="stat-breakdown">${data.reviews.recent.length > 0 ? `Latest: ${data.reviews.recent[0].traffic_light}` : 'No reviews yet'}</div>
                </div>

                <div class="stat-card" onclick="location.hash='graph'">
                    <div class="stat-number">${data.graph ? data.graph.total_files.toLocaleString() : '—'}</div>
                    <div class="stat-label">Source Files</div>
                    <div class="stat-breakdown">${data.graph ? `${data.graph.total_edges.toLocaleString()} deps · ${data.graph.entry_points} entry points` : 'No graph'}</div>
                </div>

                <!-- Health Breakdown -->
                ${data.health ? `
                <div class="stat-card wide">
                    <h3>Health Breakdown</h3>
                    <div class="severity-bars">
                        ${severityBar('Critical', data.health.critical_count, '#ff4444')}
                        ${severityBar('High', data.health.high_count, '#ff8800')}
                        ${severityBar('Medium', data.health.medium_count, '#ffcc00')}
                    </div>
                </div>` : ''}

                <!-- Languages -->
                ${data.graph && data.graph.languages ? `
                <div class="stat-card">
                    <h3>Languages</h3>
                    <div class="lang-list">
                        ${Object.entries(data.graph.languages).sort((a,b) => b[1]-a[1]).slice(0,5).map(([l, c]) => `
                            <div class="lang-row">
                                <span class="lang-name">${l}</span>
                                <span class="lang-count">${c.toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <!-- Top Fan-In (Hotspots) -->
                ${data.graph && data.graph.top_fan_in ? `
                <div class="stat-card">
                    <h3>Hotspot Files</h3>
                    <div class="hotspot-list">
                        ${data.graph.top_fan_in.slice(0, 5).map(f => `
                            <div class="hotspot-row" onclick="location.hash='graph:${f.path}'">
                                <span class="hotspot-path">${f.path.split('/').pop()}</span>
                                <span class="hotspot-count">${f.importers} importers</span>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <!-- Recent Reviews -->
                ${data.reviews.recent.length > 0 ? `
                <div class="stat-card wide">
                    <h3>Recent Reviews</h3>
                    <div class="review-list">
                        ${data.reviews.recent.slice(0, 5).map(r => `
                            <div class="review-row" onclick="location.hash='reviews:${r.id}'">
                                <span class="review-light light-${r.traffic_light.toLowerCase()}">${lightIcon(r.traffic_light)}</span>
                                <span class="review-title">${r.pr_title || 'Untitled PR'}</span>
                                <span class="review-date">${timeAgo(r.created_at)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
            </div>
        `;
    },

    destroy() {}
};


function getGrade(score) {
    if (score >= 90) return { letter: 'A', color: '#00ff41' };
    if (score >= 80) return { letter: 'B', color: '#88ff00' };
    if (score >= 70) return { letter: 'C', color: '#ffcc00' };
    if (score >= 50) return { letter: 'D', color: '#ff8800' };
    return { letter: 'F', color: '#ff4444' };
}

function severityBar(label, count, color) {
    return `
        <div class="severity-row">
            <span class="severity-label">${label}</span>
            <span class="severity-count" style="color:${color}">${count}</span>
        </div>`;
}

function lightIcon(light) {
    if (light === 'RED') return '🔴';
    if (light === 'YELLOW') return '🟡';
    if (light === 'GREEN') return '🟢';
    return '⚪';
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
