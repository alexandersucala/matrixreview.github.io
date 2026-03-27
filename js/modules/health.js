/**
 * MatrixReview Dashboard — Health Module v3
 * Clickable findings expand to show file path, line, detection detail, GitHub link.
 * Parses score and findings from markdown body when structured data is missing.
 * Save to: C:\Matrixreview.io\js\modules\health.js
 */
export default {
    async render(container, ctx) {
        const data = await ctx.api.getHealth(ctx.slug);

        // Get the repo name for GitHub links
        let repo = data.repo || '';
        if (!repo) {
            try { const ov = await ctx.api.getOverview(ctx.slug); repo = ov.company?.github_repo || ''; } catch(e) {}
        }

        // Parse structured findings from the markdown body
        let parsedFindings = [];
        let score = data.health_score;
        let findingsCount = data.findings_count || 0;

        if (data.body) {
            parsedFindings = parseMarkdownFindings(data.body);
            findingsCount = parsedFindings.length || findingsCount;

            if (!score && score !== 0) {
                const sm = data.body.match(/Health Score:\*\*\s*(\d+)\/100/);
                if (sm) score = parseInt(sm[1]);
            }
        }

        // Use structured findings if available, otherwise parsed
        let findings = (data.findings && data.findings.length) ? data.findings : parsedFindings;
        if (!score && score !== 0) score = 0;
        const grade = getGrade(score);

        // Count by severity
        const bySev = {};
        for (const f of findings) { const s = f.severity || 'UNKNOWN'; bySev[s] = (bySev[s] || 0) + 1; }

        // Count by agent
        const byAgent = {};
        for (const f of findings) { const a = f.agent || 'unknown'; byAgent[a] = (byAgent[a] || 0) + 1; }

        container.innerHTML = `
            <div style="max-width:960px;">
                <div style="display:flex;align-items:center;gap:24px;margin-bottom:24px;">
                    <div style="text-align:center;">
                        <div style="font-size:56px;font-weight:700;color:${grade.color};">${grade.letter}</div>
                        <div style="font-size:14px;color:#6b7a8d;">${score}/100</div>
                    </div>
                    <div>
                        <h2 style="color:#e8ecf0;margin:0;">Codebase Health Report</h2>
                        <p style="color:#6b7a8d;margin:4px 0 0;">${repo || ctx.slug}</p>
                        <p style="font-size:13px;color:#6b7a8d;margin-top:4px;">
                            ${findingsCount} findings across ${Object.keys(byAgent).length} agents
                        </p>
                    </div>
                </div>

                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                    ${Object.entries(bySev).sort((a,b) => sevOrder(a[0]) - sevOrder(b[0])).map(([s, c]) =>
                        `<div style="background:${sevBg(s)};border:1px solid ${sevColor(s)};border-radius:6px;padding:6px 14px;text-align:center;">
                            <div style="font-size:18px;font-weight:600;color:${sevColor(s)};">${c}</div>
                            <div style="font-size:10px;color:${sevColor(s)};text-transform:uppercase;letter-spacing:0.5px;">${s}</div>
                        </div>`
                    ).join('')}
                </div>

                <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
                    <button class="hf-btn active" data-filter="all">All (${findings.length})</button>
                    ${Object.entries(bySev).sort((a,b) => sevOrder(a[0]) - sevOrder(b[0])).map(([s, c]) =>
                        `<button class="hf-btn" data-filter="${s}" style="--hfc:${sevColor(s)};">${s} (${c})</button>`
                    ).join('')}
                </div>

                <div id="health-findings-list">${renderFindings(findings, repo)}</div>
            </div>

            <style>
                .hf-btn { background: transparent; border: 1px solid #1e2a3a; color: #6b7a8d; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; }
                .hf-btn:hover { border-color: #3a4a5a; color: #c5cdd8; }
                .hf-btn.active { background: rgba(0,255,65,0.08); border-color: #00ff41; color: #00ff41; }
                .hf-row { border-bottom: 1px solid #1e2a3a; cursor: pointer; transition: background 0.15s; }
                .hf-row:hover { background: rgba(255,255,255,0.02); }
                .hf-row-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
                .hf-detail { display: none; padding: 0 12px 14px 38px; }
                .hf-row.expanded .hf-detail { display: block; }
                .hf-sev { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
                .hf-file { font-size: 13px; color: #c5cdd8; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .hf-type { font-size: 11px; color: #6b7a8d; background: #131B26; padding: 2px 8px; border-radius: 3px; flex-shrink: 0; }
                .hf-detail-grid { display: grid; grid-template-columns: 100px 1fr; gap: 4px 12px; font-size: 12px; }
                .hf-detail-label { color: #556677; }
                .hf-detail-value { color: #c5cdd8; word-break: break-all; }
                .hf-github-link { display: inline-block; margin-top: 8px; font-size: 12px; color: #00ff41; text-decoration: none; }
                .hf-github-link:hover { text-decoration: underline; }
            </style>`;

        // Filter buttons
        container.querySelectorAll('.hf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.hf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const f = btn.dataset.filter;
                const filtered = f === 'all' ? findings : findings.filter(fi => fi.severity === f);
                document.getElementById('health-findings-list').innerHTML = renderFindings(filtered, repo);
                bindFindingClicks();
            });
        });

        bindFindingClicks();

        function bindFindingClicks() {
            container.querySelectorAll('.hf-row').forEach(row => {
                row.addEventListener('click', () => row.classList.toggle('expanded'));
            });
        }
    },
    destroy() {}
};


function renderFindings(findings, repo) {
    if (!findings.length) return '<div style="padding:40px;text-align:center;color:#6b7a8d;">No findings</div>';

    return findings.map((f, i) => {
        const filePath = f.file_path || f.file || '';
        const fileName = filePath.split('/').pop() || 'unknown';
        const shortPath = filePath.length > 60 ? '.../' + filePath.split('/').slice(-3).join('/') : filePath;
        const line = f.line || f.line_number || '';
        const detector = f.detector || f.type || f.finding_type || '';
        const desc = f.description || f.evidence || f.detail || '';
        const agent = f.agent || '';
        const severity = f.severity || 'UNKNOWN';

        const ghUrl = repo && filePath
            ? `https://github.com/${repo}/blob/main/${filePath}${line ? '#L' + line : ''}`
            : '';

        return `<div class="hf-row" data-idx="${i}">
            <div class="hf-row-header">
                <div class="hf-sev" style="background:${sevColor(severity)};"></div>
                <span class="hf-file" title="${esc(filePath)}">${esc(shortPath)}${line ? ':' + line : ''}</span>
                <span class="hf-type">${esc(detector)}</span>
            </div>
            <div class="hf-detail">
                <div class="hf-detail-grid">
                    <span class="hf-detail-label">File</span>
                    <span class="hf-detail-value">${esc(filePath)}</span>

                    ${line ? `<span class="hf-detail-label">Line</span><span class="hf-detail-value">${line}</span>` : ''}

                    <span class="hf-detail-label">Severity</span>
                    <span class="hf-detail-value" style="color:${sevColor(severity)};">${severity}</span>

                    <span class="hf-detail-label">Detection</span>
                    <span class="hf-detail-value">${esc(detector)}</span>

                    ${agent ? `<span class="hf-detail-label">Agent</span><span class="hf-detail-value">${esc(agent)}</span>` : ''}

                    ${desc ? `<span class="hf-detail-label">Detail</span><span class="hf-detail-value">${esc(desc)}</span>` : ''}

                    ${f.evidence ? `<span class="hf-detail-label">Code</span><span class="hf-detail-value"><code style="display:block;background:#0a0e14;padding:8px 12px;border-radius:4px;border:1px solid #1e2a3a;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all;color:#e8ecf0;">${esc(f.evidence)}</code></span>` : ''}
                </div>
                ${ghUrl ? `<a class="hf-github-link" href="${ghUrl}" target="_blank" onclick="event.stopPropagation();">View on GitHub &#8594;</a>` : ''}
            </div>
        </div>`;
    }).join('');
}


function parseMarkdownFindings(body) {
    const findings = [];
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match: ● **DETECTOR** in `file` (line N): description
        // Also: - **DETECTOR** in `file` (line N): description
        const m1 = line.match(/^[●\-\*]\s*\*?\*?(\w+)\*?\*?\s*in\s*`([^`]+)`\s*(?:\(line\s*(\d+)\))?\s*:?\s*(.*)/);
        if (m1) {
            const detector = m1[1];
            const filePath = m1[2];
            const lineNum = m1[3] ? parseInt(m1[3]) : null;
            const desc = m1[4] || '';

            // Check next line for evidence (starts with > `)
            let evidence = '';
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                const evMatch = nextLine.match(/^>\s*`(.+)`\s*$/);
                if (evMatch) {
                    evidence = evMatch[1];
                    i++; // skip the evidence line
                }
            }

            let severity = 'MEDIUM';
            if (/HARDCODED_SECRET|API_KEY|PRIVATE_KEY|SQL_INJECTION|COMMAND_INJECTION/.test(detector)) severity = 'CRITICAL';
            else if (/INSECURE_CRYPTO|PATH_TRAVERSAL|MISSING_AUTH|CIRCULAR_DEP/.test(detector)) severity = 'HIGH';
            else if (/HIGH_FAN_IN|DEAD_CODE|MISSING_DOCSTRING|INCONSISTENT_NAMING/.test(detector)) severity = 'MEDIUM';
            else if (/LONG_FUNCTION|MISSING_LICENSE/.test(detector)) severity = 'LOW';

            let agent = 'unknown';
            if (/SECRET|API_KEY|PRIVATE_KEY|PASSWORD|TOKEN/.test(detector)) agent = 'secret_scanner';
            else if (/FAN_IN|CIRCULAR|DEAD_CODE|ORPHAN|ENTRY_POINT/.test(detector)) agent = 'dependency_risk';
            else if (/DOCSTRING|MISSING_DOC/.test(detector)) agent = 'doc_coverage';
            else if (/SQL_INJECTION|COMMAND|PATH_TRAVERSAL|CRYPTO|AUTH/.test(detector)) agent = 'security_patterns';

            findings.push({ file_path: filePath, line: lineNum, detector, description: desc, severity, agent, evidence });
            continue;
        }

        // Match simpler patterns: - DETECTOR_NAME in filepath: description
        const m2 = line.match(/^-\s*(\w+)\s+in\s+(\S+)\s*:?\s*(.*)/);
        if (m2 && m2[1] === m2[1].toUpperCase() && m2[1].length > 3) {
            findings.push({ file_path: m2[2], detector: m2[1], description: m2[3], severity: 'MEDIUM', agent: 'unknown' });
        }
    }

    return findings;
}


function getGrade(s) {
    if (s >= 90) return { letter: 'A', color: '#00ff41' };
    if (s >= 80) return { letter: 'B', color: '#88ff00' };
    if (s >= 70) return { letter: 'C', color: '#ffcc00' };
    if (s >= 50) return { letter: 'D', color: '#ff8800' };
    return { letter: 'F', color: '#ff4444' };
}

function sevColor(s) {
    return s === 'CRITICAL' ? '#ff4444' : s === 'HIGH' ? '#ff8800' : s === 'MEDIUM' ? '#ffcc00' : s === 'LOW' ? '#3fb950' : '#6b7a8d';
}

function sevBg(s) {
    return s === 'CRITICAL' ? 'rgba(255,68,68,0.1)' : s === 'HIGH' ? 'rgba(255,136,0,0.1)' : s === 'MEDIUM' ? 'rgba(255,204,0,0.1)' : s === 'LOW' ? 'rgba(63,185,80,0.1)' : 'rgba(100,100,100,0.1)';
}

function sevOrder(s) {
    return s === 'CRITICAL' ? 0 : s === 'HIGH' ? 1 : s === 'MEDIUM' ? 2 : s === 'LOW' ? 3 : 4;
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
