/**
 * MatrixReview Dashboard — Codebase Module
 * 
 * Codebase visualization: hotspots, entry points, security files.
 * File detail view with summary when subId is set.
 * 
 * Save to: C:\Matrixreview.io\js\modules\graph.js
 */

export default {
    async render(container, ctx) {
        if (ctx.subId) {
            await renderFileDetail(container, ctx);
        } else {
            await renderGraphOverview(container, ctx);
        }
    },
    destroy() {
        delete window.filterByLang;
        delete window._graphActiveLang;
        const s = document.getElementById('graph-extra-css');
        if (s) s.remove();
    }
};

async function renderGraphOverview(container, ctx) {
    const [graph, hotspots, entryPoints, securityFiles] = await Promise.all([
        ctx.api.getGraph(ctx.slug, false),
        ctx.api.getHotspots(ctx.slug, 15),
        ctx.api.getEntryPoints(ctx.slug),
        ctx.api.getSecurityFiles(ctx.slug),
    ]);

    const langEntries = Object.entries(graph.languages).sort((a,b) => b[1]-a[1]);
    const topLangs = langEntries.slice(0, 3).map(([l]) => l).join(', ');
    const summary = `This codebase contains ${graph.total_files.toLocaleString()} files connected by ${graph.total_edges.toLocaleString()} import relationships, with ${graph.entry_point_count} API entry points. Primarily written in ${topLangs}.`;

    window._graphActiveLang = null;

    container.innerHTML = `
        <div class="graph-view">
            <div class="graph-header">
                <h2>Codebase</h2>
                <p style="color:#c5cdd8;font-size:14px;line-height:1.6;margin-top:8px;">${summary}</p>
            </div>
            <div class="graph-langs" id="graph-langs">
                <span class="lang-chip lang-clickable active" data-lang="all" onclick="filterByLang('all',this)">All <b>${graph.total_files.toLocaleString()}</b></span>
                ${langEntries.slice(0, 8).map(([lang, count]) => `
                    <span class="lang-chip lang-clickable" data-lang="${lang}" onclick="filterByLang('${lang}',this)">${lang} <b>${count.toLocaleString()}</b></span>
                `).join('')}
            </div>
            <div class="graph-tabs">
                <button class="graph-tab active" data-tab="hotspots">Hotspots (${hotspots.hotspots.length})</button>
                <button class="graph-tab" data-tab="entry">Entry Points (${entryPoints.count})</button>
                <button class="graph-tab" data-tab="security">Security (${securityFiles.count})</button>
            </div>
            <div class="graph-content" id="graph-content">
                ${renderHotspots(hotspots.hotspots)}
            </div>
        </div>
    `;

    if (!document.getElementById('graph-extra-css')) {
        const s = document.createElement('style');
        s.id = 'graph-extra-css';
        s.textContent = `
            .lang-clickable { cursor:pointer; transition:all 0.15s; }
            .lang-clickable:hover { border-color:var(--accent); }
            .lang-clickable.active { border-color:var(--accent); background:var(--accent-dim); }
            .github-link { display:inline-block; color:#00ff41; font-family:'JetBrains Mono',monospace; font-size:13px; text-decoration:none; margin-top:8px; padding:6px 12px; border:1px solid rgba(0,255,65,0.3); border-radius:6px; transition:background 0.2s; }
            .github-link:hover { background:rgba(0,255,65,0.1); }
            .file-summary { background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:16px; margin:16px 0; font-size:13px; color:var(--text); line-height:1.6; }
        `;
        document.head.appendChild(s);
    }

    let activeTab = 'hotspots';
    const allData = {
        hotspots: hotspots.hotspots,
        entry: entryPoints.entry_points,
        security: securityFiles.security_files,
    };
    const renderers = { hotspots: renderHotspots, entry: renderEntryPoints, security: renderSecurityFiles };

    container.querySelectorAll('.graph-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.graph-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            const lang = window._graphActiveLang;
            let files = allData[activeTab];
            if (lang) files = files.filter(f => f.language === lang);
            document.getElementById('graph-content').innerHTML = renderers[activeTab](files);
        });
    });

    window.filterByLang = function(lang, el) {
        window._graphActiveLang = lang === 'all' ? null : lang;
        document.querySelectorAll('.lang-clickable').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
        let files = allData[activeTab];
        if (lang && lang !== 'all') files = files.filter(f => f.language === lang);
        document.getElementById('graph-content').innerHTML = renderers[activeTab](files);
    };
}

function renderHotspots(files) {
    if (!files.length) return '<div class="more-files">No files match this filter.</div>';
    return files.map(f => `
        <div class="graph-file-row" onclick="location.hash='graph:${f.path}'">
            <div class="graph-file-main">
                <span class="graph-file-name">${f.path.split('/').pop()}</span>
                <span class="graph-file-path">${f.path}</span>
            </div>
            <div class="graph-file-stats">
                <span class="stat-pill fan-in" title="Imported by ${f.fan_in} files">\u2193 ${f.fan_in} dependents</span>
                <span class="stat-pill fan-out" title="Imports ${f.fan_out} files">\u2191 ${f.fan_out} imports</span>
                ${f.is_entry_point ? '<span class="stat-pill entry">entry point</span>' : ''}
                ${f.security_tags?.length ? `<span class="stat-pill security">${f.security_tags.length} security</span>` : ''}
            </div>
        </div>
    `).join('');
}

function renderEntryPoints(files) {
    if (!files.length) return '<div class="more-files">No files match this filter.</div>';
    return files.slice(0, 30).map(f => `
        <div class="graph-file-row" onclick="location.hash='graph:${f.path}'">
            <div class="graph-file-main">
                <span class="graph-file-name">${f.path.split('/').pop()}</span>
                <span class="graph-file-path">${f.path}</span>
            </div>
            <div class="graph-file-stats">
                <span class="stat-pill fan-in" title="Imported by ${f.fan_in} files">\u2193 ${f.fan_in} dependents</span>
                <span class="stat-pill">${f.language}</span>
                ${f.security_tags?.length ? `<span class="stat-pill security">${f.security_tags.length} security</span>` : ''}
            </div>
        </div>
    `).join('') + (files.length > 30 ? `<div class="more-files">+${files.length - 30} more entry points</div>` : '');
}

function renderSecurityFiles(files) {
    if (!files.length) return '<div class="more-files">No files match this filter.</div>';
    return files.slice(0, 30).map(f => `
        <div class="graph-file-row" onclick="location.hash='graph:${f.path}'">
            <div class="graph-file-main">
                <span class="graph-file-name">${f.path.split('/').pop()}</span>
                <span class="graph-file-path">${f.path}</span>
            </div>
            <div class="graph-file-stats">
                <span class="stat-pill risk">risk ${f.risk_score}</span>
                <span class="stat-pill fan-in" title="Imported by ${f.fan_in} files">\u2193 ${f.fan_in} dependents</span>
                <span class="stat-pill security">${f.security_tags.join(', ')}</span>
            </div>
        </div>
    `).join('') + (files.length > 30 ? `<div class="more-files">+${files.length - 30} more security files</div>` : '');
}

async function renderFileDetail(container, ctx) {
    const file = await ctx.api.getGraphFile(ctx.slug, ctx.subId);

    const githubUrl = file.github_repo
        ? `https://github.com/${file.github_repo}/blob/${file.branch || 'main'}/${file.path}`
        : '';

    const fileName = file.path.split('/').pop();
    const dirPath = file.path.split('/').slice(0, -1).join('/');
    let sp = [];
    sp.push(`${fileName} is a ${file.lines}-line ${file.language} file located in ${dirPath || 'the project root'}.`);
    if (file.fan_in > 0) sp.push(`It is imported by ${file.fan_in} other file${file.fan_in !== 1 ? 's' : ''}, making it ${file.fan_in > 50 ? 'a critical dependency' : file.fan_in > 10 ? 'a widely-used module' : 'a shared module'} in this codebase.`);
    else sp.push('It is not imported by any other files.');
    if (file.fan_out > 0) sp.push(`It depends on ${file.fan_out} other file${file.fan_out !== 1 ? 's' : ''}.`);
    if (file.is_entry_point) sp.push('This file is an API entry point (route handler, webhook, or CLI command).');
    if (file.security_tags.length) sp.push(`Tagged for security review: ${file.security_tags.join(', ')}.`);
    if (file.fan_in > 50) sp.push('Changes to this file have a high blast radius and should be reviewed carefully.');

    container.innerHTML = `
        <div class="file-detail">
            <button class="back-btn" onclick="location.hash='graph'">\u2190 Back to Codebase</button>
            <h2>${fileName}</h2>
            <p class="file-path">${file.path}</p>
            ${githubUrl ? `<a href="${githubUrl}" target="_blank" rel="noopener" class="github-link">\u2197 View on GitHub</a>` : ''}

            <div class="file-summary">${sp.join(' ')}</div>

            <div class="file-stats-grid">
                <div class="file-stat"><span class="value">${file.language}</span><span class="label">Language</span></div>
                <div class="file-stat"><span class="value">${file.lines}</span><span class="label">Lines</span></div>
                <div class="file-stat"><span class="value">${file.fan_in}</span><span class="label">Dependents</span></div>
                <div class="file-stat"><span class="value">${file.fan_out}</span><span class="label">Imports</span></div>
                <div class="file-stat"><span class="value">${file.is_entry_point ? 'Yes' : 'No'}</span><span class="label">Entry Point</span></div>
                <div class="file-stat"><span class="value">${file.security_tags.length || 0}</span><span class="label">Security Tags</span></div>
            </div>

            ${file.security_tags.length ? `
                <div class="file-section">
                    <h3>Security Tags</h3>
                    <div class="tag-list">${file.security_tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
                </div>
            ` : ''}

            <div class="file-section">
                <h3>Imports (${file.imports.length})</h3>
                <div class="dep-list">
                    ${file.imports.slice(0, 20).map(p => `
                        <div class="dep-row" onclick="location.hash='graph:${p}'">${p}</div>
                    `).join('')}
                    ${file.imports.length > 20 ? `<div class="more-files">+${file.imports.length - 20} more</div>` : ''}
                </div>
            </div>

            <div class="file-section">
                <h3>Imported By (${file.imported_by.length})</h3>
                <div class="dep-list">
                    ${file.imported_by.slice(0, 20).map(p => `
                        <div class="dep-row" onclick="location.hash='graph:${p}'">${p}</div>
                    `).join('')}
                    ${file.imported_by.length > 20 ? `<div class="more-files">+${file.imported_by.length - 20} more</div>` : ''}
                </div>
            </div>
        </div>
    `;
}
