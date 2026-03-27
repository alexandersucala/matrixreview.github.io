/**
 * MatrixReview Dashboard — Docs Module v3
 * Fixed edit click bubbling. Added search bar. Upload button.
 * Save to: C:\Matrixreview.io\js\modules\docs.js
 */
export default {
    async render(container, ctx) {
        const data = await ctx.api.getDocs(ctx.slug);
        const gc = { ARCHITECTURE:'#6366f1', SECURITY:'#ef4444', ONBOARDING:'#22c55e', STYLE:'#f59e0b', LEGAL:'#8b5cf6' };
        let allDocs = data.by_gate;

        container.innerHTML = `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
                    <div><h2 style="color:#e8ecf0;margin:0;">Documents</h2><p style="color:#6b7a8d;margin:4px 0 0;">${data.total} documents across ${data.gates.length} gates</p></div>
                    <input id="doc-search" type="text" placeholder="Search documents..." style="background:#131B26;border:1px solid #1e2a3a;color:#c5cdd8;padding:8px 14px;border-radius:6px;font-size:13px;width:220px;">
                </div>
                <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
                    <button class="doc-gate-btn active" data-gate="all">All (${data.total})</button>
                    ${data.gates.map(g => `<button class="doc-gate-btn" data-gate="${g}">${g} (${(data.by_gate[g]||[]).length})</button>`).join('')}
                </div>
                <div id="doc-list">${renderGates(allDocs, gc)}</div>
                <div style="margin-top:24px;padding:20px;border:1px dashed #1e2a3a;border-radius:8px;text-align:center;">
                    <p style="color:#6b7a8d;font-size:13px;margin-bottom:12px;">Upload additional documentation</p>
                    <label style="display:inline-block;background:rgba(0,255,65,0.1);color:#00ff41;border:1px solid #00ff41;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;">
                        Upload Document <input type="file" accept=".md,.txt,.html,.pdf" multiple style="display:none;" id="doc-upload-input">
                    </label>
                </div>
            </div>
            <style>
                .doc-gate-btn { background:transparent; border:1px solid #1e2a3a; color:#6b7a8d; padding:6px 14px; border-radius:4px; cursor:pointer; font-size:12px; }
                .doc-gate-btn.active { background:rgba(0,255,65,0.08); border-color:#00ff41; color:#00ff41; }
                .doc-item { border-bottom:1px solid #1e2a3a; }
                .doc-item-header { display:flex; justify-content:space-between; padding:8px 12px; cursor:pointer; align-items:center; }
                .doc-item-header:hover { background:rgba(255,255,255,0.02); }
                .doc-item-content { display:none; border-top:1px solid #1e2a3a; padding:16px; }
            </style>`;

        let currentGate = 'all';

        // Gate filters
        container.querySelectorAll('.doc-gate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.doc-gate-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentGate = btn.dataset.gate;
                rerender();
            });
        });

        // Search
        const searchInput = container.querySelector('#doc-search');
        searchInput.addEventListener('input', () => rerender());

        function rerender() {
            const q = searchInput.value.toLowerCase();
            let filtered = currentGate === 'all' ? allDocs : { [currentGate]: allDocs[currentGate] || [] };
            if (q) {
                const result = {};
                for (const [gate, docs] of Object.entries(filtered)) {
                    const matched = docs.filter(d => d.filename.toLowerCase().includes(q));
                    if (matched.length) result[gate] = matched;
                }
                filtered = result;
            }
            document.getElementById('doc-list').innerHTML = renderGates(filtered, gc);
            bindDocClicks();
        }

        bindDocClicks();

        function bindDocClicks() {
            container.querySelectorAll('.doc-item-header').forEach(header => {
                header.addEventListener('click', async (e) => {
                    const id = header.dataset.docId;
                    const content = document.getElementById('doc-content-' + id);
                    if (!content) return;
                    if (content.style.display === 'block') { content.style.display = 'none'; return; }
                    content.innerHTML = '<div style="padding:8px;color:#6b7a8d;">Loading...</div>';
                    content.style.display = 'block';
                    try {
                        const doc = await ctx.api.getDoc(ctx.slug, id);
                        content.innerHTML = buildDocContent(doc, id, ctx.slug);
                        bindContentButtons(content, id, doc);
                    } catch(err) { content.innerHTML = `<div style="color:#ff4444;">Failed: ${err.message}</div>`; }
                });
            });
        }

        const uploadInput = container.querySelector('#doc-upload-input');
        if (uploadInput) uploadInput.addEventListener('change', () => {
            alert('Upload queued: ' + Array.from(uploadInput.files).map(f => f.name).join(', ') + '. Endpoint coming in next update.');
        });
    },
    destroy() {}
};

function buildDocContent(doc, id, slug) {
    return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:11px;color:#6b7a8d;">${doc.gate} | v${doc.version} | ${doc.chunks?.length || 0} chunks${doc.source_path ? ' | ' + doc.source_path : ''}</span>
            <button class="doc-edit-toggle" style="background:none;border:1px solid #1e2a3a;color:#6b7a8d;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;">Edit</button>
        </div>
        <div class="doc-display">
            <pre style="white-space:pre-wrap;word-wrap:break-word;font-size:12px;line-height:1.6;color:#c5cdd8;background:#0a0e14;padding:16px;border-radius:6px;border:1px solid #1e2a3a;max-height:500px;overflow-y:auto;">${esc(doc.content || 'No content')}</pre>
        </div>
        <div class="doc-edit" style="display:none;">
            <textarea style="width:100%;min-height:300px;font-size:12px;line-height:1.6;color:#c5cdd8;background:#0a0e14;padding:16px;border-radius:6px;border:1px solid #1e2a3a;resize:vertical;">${esc(doc.content || '')}</textarea>
            <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
                <button class="doc-cancel" style="background:none;border:1px solid #1e2a3a;color:#6b7a8d;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>
                <button style="background:rgba(0,255,65,0.1);border:1px solid #00ff41;color:#00ff41;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">Save</button>
            </div>
        </div>`;
}

function bindContentButtons(content, id, doc) {
    const editBtn = content.querySelector('.doc-edit-toggle');
    const cancelBtn = content.querySelector('.doc-cancel');
    const display = content.querySelector('.doc-display');
    const edit = content.querySelector('.doc-edit');

    // CRITICAL: stopPropagation so clicking edit/cancel doesn't collapse the doc
    if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); display.style.display = 'none'; edit.style.display = 'block'; });
    if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); edit.style.display = 'none'; display.style.display = 'block'; });

    // Stop all clicks inside content from bubbling to the header
    content.addEventListener('click', (e) => e.stopPropagation());
}

function renderGates(byGate, colors) {
    let h = '';
    for (const [gate, docs] of Object.entries(byGate)) {
        if (!docs?.length) continue;
        h += `<div><h3 style="font-size:14px;color:#e8ecf0;margin:20px 0 8px;border-left:3px solid ${colors[gate] || '#888'};padding-left:12px;">${gate} (${docs.length})</h3>
        ${docs.map(d => `<div class="doc-item">
            <div class="doc-item-header" data-doc-id="${d.id}">
                <span style="font-size:13px;color:#e8ecf0;">${d.filename}</span>
                <span style="font-size:11px;color:#6b7a8d;">${d.chunk_count} chunks, v${d.version}, ${fmtSize(d.content_length)}</span>
            </div>
            <div class="doc-item-content" id="doc-content-${d.id}"></div>
        </div>`).join('')}</div>`;
    }
    return h || '<div style="padding:40px;text-align:center;color:#6b7a8d;">No documents found</div>';
}

function fmtSize(b) { if (!b) return '0B'; if (b < 1024) return b + 'B'; if (b < 1048576) return (b/1024).toFixed(1) + 'KB'; return (b/1048576).toFixed(1) + 'MB'; }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
