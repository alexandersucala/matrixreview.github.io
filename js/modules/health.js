/**
 * MatrixReview Dashboard — Health Module v2
 * Parses score from markdown body when structured data isn't available.
 * Save to: C:\Matrixreview.io\js\modules\health.js
 */
export default {
    async render(container, ctx) {
        const data = await ctx.api.getHealth(ctx.slug);

        // Extract data from structured fields OR parse from markdown body
        let findings = data.findings || [];
        let score = data.health_score;
        let findingsCount = data.findings_count || findings.length;

        // If score is null/0 but we have a body, parse it from the markdown
        if ((score === null || score === undefined || score === 0) && data.body) {
            const scoreMatch = data.body.match(/Health Score:\*\*\s*(\d+)\/100/);
            if (scoreMatch) score = parseInt(scoreMatch[1]);

            const findingsMatch = data.body.match(/(\d+)\s*source files/);
            const critMatch = data.body.match(/Critical\s*\((\d+)\)/);
            const highMatch = data.body.match(/High\s*\((\d+)\)/);
            const medMatch = data.body.match(/Medium\s*\((\d+)\)/);
            const lowMatch = data.body.match(/Low\s*\((\d+)\)/);

            if (critMatch || highMatch || medMatch || lowMatch) {
                const crit = critMatch ? parseInt(critMatch[1]) : 0;
                const high = highMatch ? parseInt(highMatch[1]) : 0;
                const med = medMatch ? parseInt(medMatch[1]) : 0;
                const low = lowMatch ? parseInt(lowMatch[1]) : 0;
                findingsCount = crit + high + med + low;

                // Recalculate score if not found in body
                if (score === null || score === undefined || score === 0) {
                    score = Math.max(0, 100 - (crit * 10) - (high * 5) - (med * 2) - (low * 1));
                }

                // If no structured findings, create summary from counts
                if (!findings.length) {
                    if (crit) findings.push({ severity: 'CRITICAL', description: `${crit} critical findings detected`, agent: 'summary' });
                    if (high) findings.push({ severity: 'HIGH', description: `${high} high severity findings detected`, agent: 'summary' });
                    if (med) findings.push({ severity: 'MEDIUM', description: `${med} medium severity findings detected`, agent: 'summary' });
                    if (low) findings.push({ severity: 'LOW', description: `${low} low severity findings detected`, agent: 'summary' });
                }
            }
        }

        if (score === null || score === undefined) score = 0;
        const grade = getGrade(score);

        // Count by severity
        const bySev = {};
        for (const f of findings) { const s = f.severity || 'UNKNOWN'; bySev[s] = (bySev[s] || 0) + 1; }

        container.innerHTML = `
            <div style="max-width:900px;">
                <div style="display:flex;align-items:center;gap:24px;margin-bottom:24px;">
                    <div style="text-align:center;">
                        <div style="font-size:56px;font-weight:700;color:${grade.color};">${grade.letter}</div>
                        <div style="font-size:14px;color:#6b7a8d;">${score}/100</div>
                    </div>
                    <div>
                        <h2 style="color:#e8ecf0;">Codebase Health Report</h2>
                        <p style="color:#6b7a8d;">${data.repo || ctx.slug}</p>
                        <p style="font-size:13px;color:#6b7a8d;margin-top:4px;">
                            ${findingsCount} findings · ${data.agents_run || 4} agents · ${((data.scan_time_ms || 0) / 1000).toFixed(1)}s scan
                        </p>
                    </div>
                </div>

                <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
                    <button class="filter-btn active" data-filter="all">All (${findingsCount})</button>
                    ${Object.entries(bySev).map(([s, c]) => `<button class="filter-btn" data-filter="${s}">${s} (${c})</button>`).join('')}
                </div>

                <div id="findings-list">
                    ${data.body ? renderMarkdownFindings(data.body) : renderFindings(findings)}
                </div>
            </div>`;

        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const f = btn.dataset.filter;
                if (f === 'all') {
                    document.getElementById('findings-list').innerHTML = data.body ? renderMarkdownFindings(data.body) : renderFindings(findings);
                } else {
                    const filtered = findings.filter(fi => fi.severity === f);
                    document.getElementById('findings-list').innerHTML = renderFindings(filtered);
                }
            });
        });
    },
    destroy() {}
};

function renderMarkdownFindings(body) {
    // Render the markdown body as styled HTML
    const lines = body.split('\n');
    let html = '<div style="font-size:13px;line-height:1.6;color:#c5cdd8;">';
    for (const line of lines) {
        if (line.startsWith('## ')) html += `<h2 style="color:#e8ecf0;font-size:18px;margin:16px 0 8px;">${line.slice(3)}</h2>`;
        else if (line.startsWith('### ')) html += `<h3 style="color:#e8ecf0;font-size:14px;margin:12px 0 6px;">${line.slice(4)}</h3>`;
        else if (line.startsWith('- **')) {
            const sev = line.includes('CRITICAL') || line.includes('HARDCODED_SECRET') || line.includes('API_KEY') ? '#ff4444' :
                         line.includes('HIGH') ? '#ff8800' :
                         line.includes('MEDIUM') || line.includes('HIGH_FAN_IN') ? '#ffcc00' : '#6b7a8d';
            html += `<div style="padding:4px 0;border-bottom:1px solid #1e2a3a;font-size:12px;"><span style="color:${sev};">&#9679;</span> ${escLine(line.slice(2))}</div>`;
        }
        else if (line.startsWith('**')) html += `<p style="margin:8px 0;"><strong style="color:#e8ecf0;">${escLine(line)}</strong></p>`;
        else if (line.startsWith('<details>')) html += '';
        else if (line.startsWith('</details>')) html += '';
        else if (line.startsWith('<summary>')) html += `<div style="cursor:pointer;color:#00ff41;margin:8px 0;font-size:13px;">${escLine(line.replace(/<\/?summary>/g, ''))}</div>`;
        else if (line.startsWith('---')) html += '<hr style="border:none;border-top:1px solid #1e2a3a;margin:16px 0;">';
        else if (line.startsWith('*Generated')) html += `<p style="font-size:11px;color:#556677;margin-top:16px;">${escLine(line)}</p>`;
        else if (line.trim()) html += `<p style="margin:4px 0;">${escLine(line)}</p>`;
    }
    html += '</div>';
    return html;
}

function renderFindings(findings) {
    if (!findings.length) return '<div style="padding:40px;text-align:center;color:#6b7a8d;">No findings</div>';
    return findings.slice(0, 100).map(f => `
        <div style="display:grid;grid-template-columns:28px 180px 1fr;align-items:start;gap:8px;padding:8px 12px;border-bottom:1px solid #1e2a3a;font-size:13px;">
            <span>${sevIcon(f.severity)}</span>
            <span style="font-size:12px;color:#6b7a8d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${shortPath(f.file_path)}</span>
            <span style="word-wrap:break-word;overflow-wrap:break-word;">${f.description || ''}</span>
        </div>
    `).join('') + (findings.length > 100 ? `<div style="text-align:center;padding:12px;color:#6b7a8d;">+${findings.length - 100} more</div>` : '');
}

function sevIcon(s) { return s === 'CRITICAL' ? '\uD83D\uDD34' : s === 'HIGH' ? '\uD83D\uDFE0' : s === 'MEDIUM' ? '\uD83D\uDFE1' : '\uD83D\uDFE2'; }
function shortPath(p) { if (!p) return ''; const parts = p.split('/'); return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : p; }
function getGrade(s) {
    if (s >= 90) return { letter: 'A', color: '#00ff41' };
    if (s >= 80) return { letter: 'B', color: '#88ff00' };
    if (s >= 70) return { letter: 'C', color: '#ffcc00' };
    if (s >= 50) return { letter: 'D', color: '#ff8800' };
    return { letter: 'F', color: '#ff4444' };
}
function escLine(s) { return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
