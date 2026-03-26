/**
 * MatrixReview Dashboard — Docs Module
 * 
 * Document inventory grouped by gate. Click to expand content.
 * 
 * Save to: C:\Matrixreview.io\js\modules\docs.js
 */

export default {
    async render(container, ctx) {
        const data = await ctx.api.getDocs(ctx.slug);

        const gateColors = {
            ARCHITECTURE: '#6366f1',
            SECURITY: '#ef4444',
            ONBOARDING: '#22c55e',
            STYLE: '#f59e0b',
            LEGAL: '#8b5cf6',
        };

        container.innerHTML = `
            <div class="docs-view">
                <div class="docs-header">
                    <h2>Document Inventory</h2>
                    <p>${data.total} documents across ${data.gates.length} gates</p>
                </div>

                <div class="gate-tabs">
                    <button class="gate-tab active" data-gate="all">All (${data.total})</button>
                    ${data.gates.map(g => {
                        const count = data.by_gate[g]?.length || 0;
                        return `<button class="gate-tab" data-gate="${g}" style="--gate-color: ${gateColors[g] || '#888'}">${g} (${count})</button>`;
                    }).join('')}
                </div>

                <div class="doc-list" id="doc-list">
                    ${renderDocs(data.by_gate, gateColors)}
                </div>
            </div>
        `;

        // Gate filter tabs
        container.querySelectorAll('.gate-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.gate-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const gate = tab.dataset.gate;
                const filtered = gate === 'all' ? data.by_gate : { [gate]: data.by_gate[gate] || [] };
                document.getElementById('doc-list').innerHTML = renderDocs(filtered, gateColors);
            });
        });
    },

    destroy() {}
};


function renderDocs(byGate, colors) {
    let html = '';
    for (const [gate, docs] of Object.entries(byGate)) {
        if (!docs || !docs.length) continue;
        const color = colors[gate] || '#888';
        html += `<div class="gate-section">
            <h3 class="gate-heading" style="border-left: 3px solid ${color}; padding-left: 12px;">${gate} (${docs.length})</h3>
            <div class="gate-docs">
                ${docs.map(d => `
                    <div class="doc-row">
                        <span class="doc-name">${d.filename}</span>
                        <span class="doc-meta">${d.chunk_count} chunks · v${d.version} · ${formatSize(d.content_length)}</span>
                        ${d.confidence ? `<span class="doc-confidence">${d.confidence}%</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }
    return html || '<div class="empty-state">No documents found</div>';
}

function formatSize(bytes) {
    if (!bytes) return '0B';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
