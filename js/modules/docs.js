/**
 * MatrixReview Dashboard — Docs Module v2
 * Clickable documents, content viewer, editable, upload button.
 * Save to: C:\Matrixreview.io\js\modules\docs.js
 */
export default {
    async render(container, ctx) {
        const data = await ctx.api.getDocs(ctx.slug);
        const gc = { ARCHITECTURE: '#6366f1', SECURITY: '#ef4444', ONBOARDING: '#22c55e', STYLE: '#f59e0b', LEGAL: '#8b5cf6' };

        container.innerHTML = `
            <div class="docs-view">
                <div class="docs-header"><h2>Document Inventory</h2><p>${data.total} documents across ${data.gates.length} gates</p></div>
                <div class="gate-tabs">
                    <button class="gate-tab active" data-gate="all">All (${data.total})</button>
                    ${data.gates.map(g => `<button class="gate-tab" data-gate="${g}" style="--gate-color: ${gc[g] || '#888'}">${g} (${(data.by_gate[g] || []).length})</button>`).join('')}
                </div>
                <div id="doc-list">${renderGates(data.by_gate, gc)}</div>
                <div style="margin-top:24px;padding:20px;border:1px dashed var(--border);border-radius:8px;text-align:center;">
                    <p style="color:#6b7a8d;font-size:13px;margin-bottom:12px;">Upload additional documentation</p>
                    <label style="display:inline-block;background:rgba(0,255,65,0.1);color:#00ff41;border:1px solid #00ff41;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;">
                        Upload Document
                        <input type="file" accept=".md,.txt,.html,.pdf" multiple style="display:none;" id="doc-upload-input">
                    </label>
                    <p style="color:#556677;font-size:11px;margin-top:8px;">.md, .txt, .html, .pdf supported</p>
                </div>
            </div>`;

        container.querySelectorAll('.gate-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.gate-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const g = tab.dataset.gate;
                document.getElementById('doc-list').innerHTML = renderGates(g === 'all' ? data.by_gate : { [g]: data.by_gate[g] || [] }, gc);
                bindDocClicks(ctx);
            });
        });

        bindDocClicks(ctx);

        const uploadInput = container.querySelector('#doc-upload-input');
        if (uploadInput) uploadInput.addEventListener('change', () => {
            const names = Array.from(uploadInput.files).map(f => f.name).join(', ');
            alert('Upload queued: ' + names + '. Upload endpoint coming in next update.');
        });
    },
    destroy() {}
};

function bindDocClicks(ctx) {
    document.querySelectorAll('.doc-row-click').forEach(row => {
        row.addEventListener('click', async function() {
            const id = this.dataset.docId;
            const content = document.getElementById('doc-content-' + id);
            if (!content) return;
            if (content.style.display === 'block') { content.style.display = 'none'; return; }

            content.innerHTML = '<div style="padding:16px;color:#6b7a8d;">Loading...</div>';
            content.style.display = 'block';
            try {
                const doc = await ctx.api.getDoc(ctx.slug, id);
                content.innerHTML = `<div style="padding:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:11px;color:#6b7a8d;">${doc.gate} | v${doc.version} | ${doc.chunks?.length || 0} chunks${doc.source_path ? ' | ' + doc.source_path : ''}</span>
                        <button class="doc-edit-btn" data-doc-id="${id}" style="background:none;border:1px solid #1e2a3a;color:#6b7a8d;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;">Edit</button>
                    </div>
                    <div id="doc-display-${id}">
                        <pre style="white-space:pre-wrap;word-wrap:break-word;font-size:12px;line-height:1.6;color:#c5cdd8;background:#0a0e14;padding:16px;border-radius:6px;border:1px solid #1e2a3a;max-height:500px;overflow-y:auto;">${esc(doc.content || 'No content')}</pre>
                    </div>
                    <div id="doc-edit-${id}" style="display:none;">
                        <textarea id="doc-ta-${id}" style="width:100%;min-height:300px;font-size:12px;line-height:1.6;color:#c5cdd8;background:#0a0e14;padding:16px;border-radius:6px;border:1px solid #1e2a3a;resize:vertical;">${esc(doc.content || '')}</textarea>
                        <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
                            <button class="doc-cancel-btn" data-doc-id="${id}" style="background:none;border:1px solid #1e2a3a;color:#6b7a8d;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>
                            <button style="background:rgba(0,255,65,0.1);border:1px solid #00ff41;color:#00ff41;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">Save</button>
                        </div>
                    </div>
                </div>`;
                content.querySelector('.doc-edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleEdit(id); });
                content.querySelector('.doc-cancel-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleEdit(id); });
            } catch (e) { content.innerHTML = `<div style="padding:16px;color:#ff4444;">Failed: ${e.message}</div>`; }
        });
    });
}

function toggleEdit(id) {
    const d = document.getElementById('doc-display-' + id);
    const e = document.getElementById('doc-edit-' + id);
    if (!d || !e) return;
    if (e.style.display === 'none') { e.style.display = 'block'; d.style.display = 'none'; }
    else { e.style.display = 'none'; d.style.display = 'block'; }
}

function renderGates(byGate, colors) {
    let h = '';
    for (const [gate, docs] of Object.entries(byGate)) {
        if (!docs?.length) continue;
        h += `<div><h3 style="font-size:14px;color:#e8ecf0;margin:20px 0 8px;border-left:3px solid ${colors[gate] || '#888'};padding-left:12px;">${gate} (${docs.length})</h3>
        ${docs.map(d => `<div class="doc-row-click" data-doc-id="${d.id}" style="cursor:pointer;border-bottom:1px solid #1e2a3a;">
            <div style="display:flex;justify-content:space-between;padding:8px 12px;align-items:center;">
                <span style="font-size:13px;color:#e8ecf0;">${d.filename}</span>
                <span style="font-size:11px;color:#6b7a8d;">${d.chunk_count} chunks · v${d.version} · ${fmtSize(d.content_length)}</span>
            </div>
            <div id="doc-content-${d.id}" style="display:none;border-top:1px solid #1e2a3a;"></div>
        </div>`).join('')}</div>`;
    }
    return h || '<div style="padding:40px;text-align:center;color:#6b7a8d;">No documents found</div>';
}

function fmtSize(b) { if (!b) return '0B'; if (b < 1024) return b + 'B'; if (b < 1048576) return (b/1024).toFixed(1) + 'KB'; return (b/1048576).toFixed(1) + 'MB'; }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
