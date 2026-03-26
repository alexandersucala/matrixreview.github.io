/**
 * MatrixReview Dashboard — Graph Module
 * 
 * Graph visualization: hotspots, entry points, security files.
 * File detail view when subId is set.
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

    destroy() {}
};


async function renderGraphOverview(container, ctx) {
    const [graph, hotspots, entryPoints, securityFiles] = await Promise.all([
        ctx.api.getGraph(ctx.slug, false),
        ctx.api.getHotspots(ctx.slug, 15),
        ctx.api.getEntryPoints(ctx.slug),
        ctx.api.getSecurityFiles(ctx.slug),
    ]);

    container.innerHTML = `
        <div class="graph-view">
            <div class="graph-header">
                <h2>Dependency Graph</h2>
                <p>${graph.total_files.toLocaleString()} files · ${graph.total_edges.toLocaleString()} edges · ${graph.entry_point_count} entry points</p>
            </div>

            <!-- Language breakdown -->
            <div class="graph-langs">
                ${Object.entries(graph.languages).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([lang, count]) => `
                    <span class="lang-chip">${lang} <b>${count.toLocaleString()}</b></span>
                `).join('')}
            </div>

            <!-- Tabs -->
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

    // Tab switching
    const tabs = {
        hotspots: () => renderHotspots(hotspots.hotspots),
        entry: () => renderEntryPoints(entryPoints.entry_points),
        security: () => renderSecurityFiles(securityFiles.security_files),
    };

    container.querySelectorAll('.graph-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.graph-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('graph-content').innerHTML = tabs[tab.dataset.tab]();
        });
    });
}


function renderHotspots(files) {
    return files.map(f => `
        <div class="graph-file-row" onclick="location.hash='graph:${f.path}'">
            <div class="graph-file-main">
                <span class="graph-file-name">${f.path.split('/').pop()}</span>
                <span class="graph-file-path">${f.path}</span>
            </div>
            <div class="graph-file-stats">
                <span class="stat-pill fan-in">↓ ${f.fan_in}</span>
                <span class="stat-pill fan-out">↑ ${f.fan_out}</span>
                ${f.is_entry_point ? '<span class="stat-pill entry">EP</span>' : ''}
                ${f.security_tags?.length ? `<span class="stat-pill security">${f.security_tags.length} tags</span>` : ''}
            </div>
        </div>
    `).join('');
}


function renderEntryPoints(files) {
    return files.slice(0, 30).map(f => `
        <div class="graph-file-row" onclick="location.hash='graph:${f.path}'">
            <div class="graph-file-main">
                <span class="graph-file-name">${f.path.split('/').pop()}</span>
                <span class="graph-file-path">${f.path}</span>
            </div>
            <div class="graph-file-stats">
                <span class="stat-pill fan-in">↓ ${f.fan_in}</span>
                <span class="stat-pill">${f.language}</span>
                ${f.security_tags?.length ? `<span class="stat-pill security">${f.security_tags.length} tags</span>` : ''}
            </div>
        </div>
    `).join('') + (files.length > 30 ? `<div class="more-files">+${files.length - 30} more entry points</div>` : '');
}


function renderSecurityFiles(files) {
    return files.slice(0, 30).map(f => `
        <div class="graph-file-row" onclick="location.hash='graph:${f.path}'">
            <div class="graph-file-main">
                <span class="graph-file-name">${f.path.split('/').pop()}</span>
                <span class="graph-file-path">${f.path}</span>
            </div>
            <div class="graph-file-stats">
                <span class="stat-pill risk">Risk: ${f.risk_score}</span>
                <span class="stat-pill fan-in">↓ ${f.fan_in}</span>
                <span class="stat-pill security">${f.security_tags.join(', ')}</span>
            </div>
        </div>
    `).join('') + (files.length > 30 ? `<div class="more-files">+${files.length - 30} more security files</div>` : '');
}


async function renderFileDetail(container, ctx) {
    const file = await ctx.api.getGraphFile(ctx.slug, ctx.subId);

    container.innerHTML = `
        <div class="file-detail">
            <button class="back-btn" onclick="location.hash='graph'">← Back to Graph</button>
            <h2>${file.path.split('/').pop()}</h2>
            <p class="file-path">${file.path}</p>

            <div class="file-stats-grid">
                <div class="file-stat"><span class="value">${file.language}</span><span class="label">Language</span></div>
                <div class="file-stat"><span class="value">${file.lines}</span><span class="label">Lines</span></div>
                <div class="file-stat"><span class="value">${file.fan_in}</span><span class="label">Fan-In</span></div>
                <div class="file-stat"><span class="value">${file.fan_out}</span><span class="label">Fan-Out</span></div>
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
