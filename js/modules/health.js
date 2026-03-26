/**
 * MatrixReview Dashboard — Health Module
 * 
 * Health report with findings table, filterable by severity and agent.
 * 
 * Save to: C:\Matrixreview.io\js\modules\health.js
 */

export default {
    async render(container, ctx) {
        const data = await ctx.api.getHealth(ctx.slug);

        const findings = data.findings || [];
        const score = data.health_score ?? 0;
        const grade = getGrade(score);

        // Group by severity
        const bySeverity = {};
        for (const f of findings) {
            const s = f.severity || 'UNKNOWN';
            if (!bySeverity[s]) bySeverity[s] = [];
            bySeverity[s].push(f);
        }

        // Group by agent
        const byAgent = {};
        for (const f of findings) {
            const a = f.agent || 'unknown';
            if (!byAgent[a]) byAgent[a] = [];
            byAgent[a].push(f);
        }

        container.innerHTML = `
            <div class="health-view">
                <div class="health-header">
                    <div class="health-score-large" style="color: ${grade.color}">
                        <span class="grade">${grade.letter}</span>
                        <span class="score">${score}/100</span>
                    </div>
                    <div class="health-summary">
                        <h2>Codebase Health Report</h2>
                        <p>${data.repo || ctx.slug}</p>
                        <p class="scan-meta">${data.findings_count || findings.length} findings · ${data.agents_run || 0} agents · ${((data.scan_time_ms || 0) / 1000).toFixed(1)}s scan</p>
                    </div>
                </div>

                <div class="filter-bar">
                    <button class="filter-btn active" data-filter="all">All (${findings.length})</button>
                    ${Object.entries(bySeverity).map(([s, list]) => 
                        `<button class="filter-btn severity-${s.toLowerCase()}" data-filter="${s}">${s} (${list.length})</button>`
                    ).join('')}
                </div>

                <div class="findings-table" id="findings-table">
                    ${renderFindings(findings)}
                </div>
            </div>
        `;

        // Filter buttons
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.dataset.filter;
                const filtered = filter === 'all' ? findings : findings.filter(f => f.severity === filter);
                document.getElementById('findings-table').innerHTML = renderFindings(filtered);
            });
        });
    },

    destroy() {}
};


function renderFindings(findings) {
    if (!findings.length) return '<div class="empty-state">No findings</div>';

    return findings.slice(0, 100).map(f => `
        <div class="finding-row severity-${(f.severity || '').toLowerCase()}">
            <span class="finding-severity">${severityIcon(f.severity)}</span>
            <span class="finding-file">${shortPath(f.file_path)}</span>
            <span class="finding-category">${f.category || ''}</span>
            <span class="finding-desc">${f.description || ''}</span>
            ${f.line_number ? `<span class="finding-line">L${f.line_number}</span>` : ''}
        </div>
    `).join('') + (findings.length > 100 ? `<div class="more-findings">+${findings.length - 100} more findings</div>` : '');
}

function shortPath(path) {
    if (!path) return '';
    const parts = path.split('/');
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : path;
}

function severityIcon(severity) {
    switch (severity) {
        case 'CRITICAL': return '🔴';
        case 'HIGH': return '🟠';
        case 'MEDIUM': return '🟡';
        case 'LOW': return '🟢';
        default: return '⚪';
    }
}

function getGrade(score) {
    if (score >= 90) return { letter: 'A', color: '#00ff41' };
    if (score >= 80) return { letter: 'B', color: '#88ff00' };
    if (score >= 70) return { letter: 'C', color: '#ffcc00' };
    if (score >= 50) return { letter: 'D', color: '#ff8800' };
    return { letter: 'F', color: '#ff4444' };
}
