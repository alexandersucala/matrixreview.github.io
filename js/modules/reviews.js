/**
 * MatrixReview Dashboard — Reviews Module
 * 
 * PR review history list and detail view.
 * If ctx.subId is set, shows single review detail.
 * 
 * Save to: C:\Matrixreview.io\js\modules\reviews.js
 */

export default {
    async render(container, ctx) {
        if (ctx.subId) {
            await renderDetail(container, ctx);
        } else {
            await renderList(container, ctx);
        }
    },

    destroy() {}
};


async function renderList(container, ctx) {
    const [reviewData, statsData] = await Promise.all([
        ctx.api.getReviews(ctx.slug, 1, 50),
        ctx.api.getReviewStats(ctx.slug),
    ]);

    container.innerHTML = `
        <div class="reviews-view">
            <div class="reviews-header">
                <h2>PR Reviews</h2>
                <p>${reviewData.total} reviews total</p>
            </div>

            <!-- Stats -->
            <div class="review-stats-row">
                <div class="mini-stat">
                    <span class="mini-value">${statsData.total_reviews}</span>
                    <span class="mini-label">Total</span>
                </div>
                <div class="mini-stat">
                    <span class="mini-value">${statsData.total_findings || 0}</span>
                    <span class="mini-label">Findings</span>
                </div>
                <div class="mini-stat">
                    <span class="mini-value">${statsData.avg_findings_per_review || 0}</span>
                    <span class="mini-label">Avg/PR</span>
                </div>
                ${Object.entries(statsData.by_traffic_light || {}).map(([light, count]) => `
                    <div class="mini-stat">
                        <span class="mini-value">${lightIcon(light)} ${count}</span>
                        <span class="mini-label">${light}</span>
                    </div>
                `).join('')}
            </div>

            <!-- Review List -->
            <div class="review-table">
                ${reviewData.reviews.map(r => `
                    <div class="review-table-row" onclick="location.hash='reviews:${r.id}'">
                        <span class="review-light">${lightIcon(r.traffic_light)}</span>
                        <div class="review-info">
                            <span class="review-title">${r.pr_title || 'Untitled'}</span>
                            <span class="review-meta">${r.finding_count} findings · ${timeAgo(r.created_at)}</span>
                        </div>
                        <div class="review-gates">
                            ${Object.entries(r.gates || {}).map(([g, info]) => 
                                `<span class="gate-badge gate-${info.status?.toLowerCase()}">${g.slice(0, 3)}</span>`
                            ).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${reviewData.pages > 1 ? `<div class="pagination">Page ${reviewData.page} of ${reviewData.pages}</div>` : ''}
        </div>
    `;
}


async function renderDetail(container, ctx) {
    const review = await ctx.api.getReview(ctx.slug, ctx.subId);

    const totalFindings = review.gates.reduce((sum, g) => sum + g.finding_count, 0);

    container.innerHTML = `
        <div class="review-detail">
            <div class="review-detail-header">
                <button class="back-btn" onclick="location.hash='reviews'">← Back to Reviews</button>
                <h2>${lightIcon(review.traffic_light)} ${review.pr_title || 'Untitled PR'}</h2>
                ${review.pr_url ? `<a href="${review.pr_url}" target="_blank" class="pr-link">View on GitHub →</a>` : ''}
                <p class="review-detail-meta">${totalFindings} findings · ${review.gates.length} gates · ${timeAgo(review.created_at)}</p>
            </div>

            <div class="gate-results">
                ${review.gates.map(g => `
                    <div class="gate-result-card">
                        <div class="gate-result-header">
                            <span class="gate-result-name">${g.gate || 'Unknown'}</span>
                            <span class="gate-status status-${g.status?.toLowerCase()}">${g.status}</span>
                            <span class="gate-findings-count">${g.finding_count} findings</span>
                        </div>
                        ${g.summary ? `<p class="gate-summary">${g.summary}</p>` : ''}
                        ${g.findings.length > 0 ? `
                            <div class="gate-findings">
                                ${g.findings.map(f => `
                                    <div class="finding-detail">
                                        <span class="finding-confidence conf-${f.confidence?.toLowerCase()}">${confidenceIcon(f.confidence)}</span>
                                        <div class="finding-body">
                                            <p class="finding-desc">${f.description}</p>
                                            ${f.suggested_fix ? `<p class="finding-fix">Fix: ${f.suggested_fix}</p>` : ''}
                                            ${f.pr_line_ref ? `<span class="finding-ref">${f.pr_line_ref}</span>` : ''}
                                            ${f.doc_line_ref ? `<span class="finding-ref">Doc: ${f.doc_line_ref}</span>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}


function lightIcon(light) {
    if (light === 'RED') return '🔴';
    if (light === 'YELLOW') return '🟡';
    if (light === 'GREEN') return '🟢';
    return '⚪';
}

function confidenceIcon(conf) {
    if (conf === 'HIGH') return '⚙️';
    if (conf === 'MEDIUM') return '🔎';
    return '💭';
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
