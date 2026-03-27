/**
 * MatrixReview Dashboard — Health Module v4
 * Health score derived from PR review history.
 * No more agent-based scanning. Score reflects how PRs are trending.
 * Save to: C:\Matrixreview.io\js\modules\health.js
 */
export default {
    async render(container, ctx) {
        // Load PR review stats
        let stats = {};
        let reviews = [];
        try {
            stats = await ctx.api.getReviewStats(ctx.slug);
            const rd = await ctx.api.getReviews(ctx.slug, 1, 50);
            reviews = rd.reviews || [];
        } catch (e) {}

        // Calculate health from PR data
        const total = reviews.length;
        const greens = reviews.filter(r => r.traffic_light === 'GREEN').length;
        const yellows = reviews.filter(r => r.traffic_light === 'YELLOW').length;
        const reds = reviews.filter(r => r.traffic_light === 'RED').length;

        let score = 0;
        let grade = { letter: '?', color: '#556677' };
        let hasData = total > 0;

        if (hasData) {
            // Score: weighted percentage. GREEN=100, YELLOW=50, RED=0
            score = Math.round(((greens * 100) + (yellows * 50)) / total);
            grade = getGrade(score);
        }

        // Trend: compare first half vs second half of reviews
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

        // Gate breakdown from stats
        const byGate = stats.by_gate || {};
        const byLight = stats.by_traffic_light || {};
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
                        ${reviews.slice(0, 50).reverse().map(r => {
                            const color = r.traffic_light === 'GREEN' ? '#00ff41' : r.traffic_light === 'YELLOW' ? '#ffcc00' : '#ff4444';
                            const height = Math.max(8, Math.min(60, (r.finding_count || 0) * 4 + 8));
                            return `<div title="${r.pr_title || 'PR'}: ${r.traffic_light}, ${r.finding_count} findings" style="flex:1;min-width:4px;max-width:16px;height:${height}px;background:${color};border-radius:2px 2px 0 0;cursor:pointer;opacity:0.8;" onclick="location.hash='reviews:${r.id}'"></div>`;
                        }).join('')}
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                        <span style="font-size:10px;color:#556677;">Oldest</span>
                        <span style="font-size:10px;color:#556677;">Newest</span>
                    </div>
                </div>

                ${Object.keys(byGate).length > 0 ? `
                <div style="margin-bottom:24px;">
                    <h3 style="color:#e8ecf0;font-size:14px;margin-bottom:12px;">Findings by Gate</h3>
                    ${Object.entries(byGate).map(([gate, count]) => {
                        const gateColors = { SECURITY: '#ff4444', ARCHITECTURE: '#6366f1', STYLE: '#f59e0b', ONBOARDING: '#22c55e', LEGAL: '#8b5cf6' };
                        const color = gateColors[gate] || '#6b7a8d';
                        const maxCount = Math.max(...Object.values(byGate));
                        const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                            <span style="width:120px;font-size:12px;color:#6b7a8d;">${gate}</span>
                            <div style="flex:1;height:20px;background:#0a0e14;border-radius:4px;overflow:hidden;">
                                <div style="width:${width}%;height:100%;background:${color};border-radius:4px;transition:width 0.5s;"></div>
                            </div>
                            <span style="width:40px;text-align:right;font-size:13px;color:#e8ecf0;">${count}</span>
                        </div>`;
                    }).join('')}
                </div>
                ` : ''}

                ${stats.by_author && Object.keys(stats.by_author).length > 0 ? `
                <div>
                    <h3 style="color:#e8ecf0;font-size:14px;margin-bottom:12px;">By Author</h3>
                    ${Object.entries(stats.by_author).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([author, count]) =>
                        `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1e2a3a;cursor:pointer;" onclick="location.hash='reviews'">
                            <span style="font-size:13px;color:#e8ecf0;">${author}</span>
                            <span style="font-size:13px;color:#6b7a8d;">${count} PRs</span>
                        </div>`
                    ).join('')}
                </div>
                ` : ''}

                ` : `
                <div style="text-align:center;padding:60px 20px;background:#131B26;border:1px solid #1e2a3a;border-radius:8px;">
                    <div style="font-size:40px;margin-bottom:12px;">📊</div>
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
