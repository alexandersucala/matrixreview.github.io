/**
 * MatrixReview Dashboard — Docs Module v4
 * Save, upload, delete all wired to backend API.
 * Save to: C:\Matrixreview.io\js\modules\docs.js
 */
export default {
    async render(container, ctx) {
        const data = await ctx.api.getDocs(ctx.slug);
        const gc = { ARCHITECTURE: '#6366f1', SECURITY: '#ef4444', ONBOARDING: '#22c55e', STYLE: '#f59e0b', LEGAL: '#8b5cf6' };
        let selectedForDelete = new Set();

        container.innerHTML = `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div><h2 style="color:#e8ecf0;margin:0;">Document Inventory</h2><p style="color:#6b7a8d;margin:4px 0 0;">${data.total} documents across ${data.gates.length} gates</p></div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button id="delete-selected-btn" style="display:none;background:rgba(255,68,68,0.1);border:1px solid #ff4444;color:#ff4444;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">Delete Selected (0)</button>
                        <label style="display:inline-block;background:rgba(0,255,65,0.1);color:#00ff41;border:1px solid #00ff41;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">
                            Upload Document
                            <input type="file" accept=".md,.txt,.html" multiple style="display:none;" id="doc-upload-input">
                        </label>
                    </div>
                </div>
                <div class="gate-tabs" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
                    <button class="gate-tab active" data-gate="all" style="background:rgba(0,255,65,0.08);border:1px solid #00ff41;color:#00ff41;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">All (${data.total})</button>
                    ${data.gates.map(g => `<button class="gate-tab" data-gate="${g}" style="background:transparent;border:1px solid #1e2a3a;color:#6b7a8d;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">${g} (${(data.by_gate[g] || []).length})</button>`).join('')}
                </div>
                <div id="doc-list">${renderGates(data.by_gate, gc)}</div>
            </div>`;

        // Gate filter tabs
        container.querySelectorAll('.gate-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.gate-tab').forEach(t => { t.style.background = 'transparent'; t.style.borderColor = '#1e2a3a'; t.style.color = '#6b7a8d'; t.classList.remove('active'); });
                tab.style.background = 'rgba(0,255,65,0.08)'; tab.style.borderColor = '#00ff41'; tab.style.color = '#00ff41'; tab.classList.add('active');
                const g = tab.dataset.gate;
                document.getElementById('doc-list').innerHTML = renderGates(g === 'all' ? data.by_gate : { [g]: data.by_gate[g] || [] }, gc);
                bindAll();
            });
        });

        // Upload handler - classify first, then confirm
        document.getElementById('doc-upload-input')?.addEventListener('change', async function() {
            if (!this.files.length) return;

            // Show classification panel
            const panel = document.createElement('div');
            panel.id = 'upload-review-panel';
            panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;';
            panel.innerHTML = '<div style="background:#0d1117;border:1px solid #30363d;border-radius:12px;padding:32px;max-width:700px;width:95%;max-height:85vh;overflow-y:auto;">' +
                '<h3 style="color:#f0f6fc;font-size:18px;margin-bottom:16px;">Classifying documents...</h3>' +
                '<div id="upload-classify-results" style="color:#8b949e;font-size:13px;">Analyzing files...</div>' +
                '</div>';
            document.body.appendChild(panel);
            panel.addEventListener('click', (e) => { if (e.target === panel) panel.remove(); });

            const resultsEl = document.getElementById('upload-classify-results');
            const pendingDocs = [];

            for (const file of this.files) {
                try {
                    resultsEl.innerHTML += `<div style="color:#58a6ff;margin:8px 0;">Classifying ${esc(file.name)}...</div>`;
                    const cls = await ctx.api.classifyDoc(ctx.slug, file);
                    const allGates = ['SECURITY','ARCHITECTURE','STYLE','ONBOARDING','LEGAL'];
                    const badgeColor = cls.confidence >= 90 ? '#3fb950' : cls.confidence >= 70 ? '#d29922' : '#f85149';

                    pendingDocs.push({ file, classification: cls });

                    let sectionsHtml = '';
                    if (cls.decomposed_sections?.length) {
                        sectionsHtml = '<div style="margin-top:8px;border-left:3px solid #58a6ff;padding-left:12px;">' +
                            '<div style="font-size:11px;color:#58a6ff;text-transform:uppercase;margin-bottom:4px;">Extracted sections</div>' +
                            cls.decomposed_sections.map((s, si) => `
                                <div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:10px;margin-bottom:6px;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;">
                                        <span style="color:#f0f6fc;font-size:13px;">${esc(s.title)}</span>
                                        <div style="display:flex;gap:6px;align-items:center;">
                                            <select class="section-gate-select" data-file-idx="${pendingDocs.length-1}" data-section-idx="${si}" style="background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:3px 6px;border-radius:4px;font-size:11px;">
                                                ${allGates.map(g => `<option value="${g}" ${g===s.gate?'selected':''}>${g}</option>`).join('')}
                                            </select>
                                            <span style="font-size:11px;color:${s.confidence >= 85 ? '#3fb950' : '#d29922'};">${s.confidence}%</span>
                                        </div>
                                    </div>
                                    <div style="font-size:11px;color:#8b949e;margin-top:4px;">Lines ${s.start_line}-${s.end_line}</div>
                                </div>
                            `).join('') + '</div>';
                    }

                    resultsEl.innerHTML = `
                        ${resultsEl.innerHTML.replace(/Classifying.*?\.\.\.<\/div>$/s, '')}
                        <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:12px;" id="upload-card-${pendingDocs.length-1}">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <span style="color:#f0f6fc;font-size:14px;font-weight:600;">${esc(cls.filename)}</span>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <select class="file-gate-select" data-file-idx="${pendingDocs.length-1}" style="background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:4px 8px;border-radius:4px;font-size:12px;">
                                        ${allGates.map(g => `<option value="${g}" ${g===cls.gate?'selected':''}>${g}</option>`).join('')}
                                    </select>
                                    <span style="font-size:12px;padding:3px 8px;border-radius:12px;border:1px solid ${badgeColor}33;color:${badgeColor};background:${badgeColor}1a;">${cls.confidence}%</span>
                                </div>
                            </div>
                            <div style="font-size:12px;color:#8b949e;margin-bottom:8px;">${esc(cls.reason)}</div>
                            <div style="font-size:11px;color:#6b7a8d;">${(cls.content_length/1024).toFixed(1)}KB</div>
                            ${sectionsHtml}
                        </div>
                    `;
                } catch (e) {
                    resultsEl.innerHTML += `<div style="color:#f85149;margin:8px 0;">Failed to classify ${esc(file.name)}: ${esc(e.message)}</div>`;
                }
            }

            if (pendingDocs.length > 0) {
                resultsEl.innerHTML += `
                    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
                        <button id="upload-cancel-btn" style="background:#21262d;border:1px solid #363b42;color:#c9d1d9;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px;">Cancel</button>
                        <button id="upload-confirm-btn" style="background:#238636;border:1px solid #238636;color:#fff;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">Confirm & Ingest ${pendingDocs.length} Document(s)</button>
                    </div>
                `;

                document.getElementById('upload-cancel-btn').addEventListener('click', () => panel.remove());
                document.getElementById('upload-confirm-btn').addEventListener('click', async () => {
                    const btn = document.getElementById('upload-confirm-btn');
                    btn.textContent = 'Ingesting...'; btn.disabled = true;
                    let ingested = 0;
                    let failed = 0;
                    for (let i = 0; i < pendingDocs.length; i++) {
                        const pd = pendingDocs[i];
                        const gateSelect = panel.querySelector(`.file-gate-select[data-file-idx="${i}"]`);
                        const gate = gateSelect ? gateSelect.value : pd.classification.gate;
                        try {
                            await ctx.api.uploadDoc(ctx.slug, pd.file, gate);
                            ingested++;
                        } catch (e) {
                            failed++;
                        }
                    }
                    panel.remove();
                    alert(`Ingested ${ingested} document(s)${failed > 0 ? `, ${failed} failed` : ''}. Chunked, embedded, ready for PR reviews.`);
                    if (ctx.orchestrator?.loadModule) ctx.orchestrator.loadModule('docs');
                    else location.reload();
                });
            }

            // Reset file input
            this.value = '';
        });

        // Delete selected handler
        document.getElementById('delete-selected-btn')?.addEventListener('click', async () => {
            if (selectedForDelete.size === 0) return;
            if (!confirm(`Delete ${selectedForDelete.size} document(s)? This removes them from review gates. Cannot be undone.`)) return;
            try {
                const result = await ctx.api.deleteDocs(ctx.slug, [...selectedForDelete]);
                alert(`Deleted ${result.count} document(s)`);
                if (ctx.orchestrator?.loadModule) ctx.orchestrator.loadModule('docs');
                else location.reload();
            } catch (e) {
                alert(`Delete failed: ${e.message}`);
            }
        });

        function updateDeleteBtn() {
            const btn = document.getElementById('delete-selected-btn');
            if (!btn) return;
            if (selectedForDelete.size > 0) {
                btn.style.display = 'inline-block';
                btn.textContent = `Delete Selected (${selectedForDelete.size})`;
            } else {
                btn.style.display = 'none';
            }
        }

        function bindAll() {
            // Single delete buttons
            container.querySelectorAll('.doc-delete-single').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const docId = btn.dataset.docId;
                    const docName = btn.dataset.docName;
                    if (!confirm(`Delete "${docName}"? This removes it from review gates.`)) return;
                    btn.textContent = '...'; btn.disabled = true;
                    try {
                        await ctx.api.deleteDocs(ctx.slug, [docId]);
                        // Remove row from DOM
                        const row = btn.closest('.doc-row-click');
                        if (row) row.remove();
                    } catch (err) {
                        alert('Delete failed: ' + err.message);
                        btn.textContent = 'x'; btn.disabled = false;
                    }
                });
            });

            // Checkbox handlers
            container.querySelectorAll('.doc-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (cb.checked) selectedForDelete.add(cb.dataset.docId);
                    else selectedForDelete.delete(cb.dataset.docId);
                    updateDeleteBtn();
                });
            });

            // Click to expand
            container.querySelectorAll('.doc-row-click').forEach(row => {
                row.addEventListener('click', async function(e) {
                    if (e.target.type === 'checkbox') return;
                    const id = this.dataset.docId;
                    const content = document.getElementById('doc-content-' + id);
                    if (!content) return;

                    // If click is inside the expanded content area, don't toggle
                    if (content.contains(e.target)) return;

                    if (content.style.display === 'block') { content.style.display = 'none'; return; }

                    content.innerHTML = '<div style="padding:16px;color:#6b7a8d;">Loading...</div>';
                    content.style.display = 'block';
                    try {
                        const doc = await ctx.api.getDoc(ctx.slug, id);
                        content.innerHTML = `<div style="padding:16px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <span style="font-size:11px;color:#6b7a8d;">${doc.gate} | v${doc.version} | ${doc.chunks?.length || 0} chunks</span>
                                <div style="display:flex;gap:8px;">
                                    <button class="doc-edit-btn" style="background:none;border:1px solid #1e2a3a;color:#6b7a8d;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;">Edit</button>
                                </div>
                            </div>
                            <div id="doc-display-${id}">
                                <pre style="white-space:pre-wrap;word-wrap:break-word;font-size:12px;line-height:1.6;color:#c5cdd8;background:#0a0e14;padding:16px;border-radius:6px;border:1px solid #1e2a3a;max-height:500px;overflow-y:auto;">${esc(doc.content || 'No content')}</pre>
                            </div>
                            <div id="doc-edit-${id}" style="display:none;">
                                <textarea id="doc-ta-${id}" style="width:100%;min-height:300px;font-size:12px;line-height:1.6;color:#c5cdd8;background:#0a0e14;padding:16px;border-radius:6px;border:1px solid #1e2a3a;resize:vertical;font-family:monospace;">${esc(doc.content || '')}</textarea>
                                <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
                                    <button class="doc-cancel-btn" style="background:none;border:1px solid #1e2a3a;color:#6b7a8d;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>
                                    <button class="doc-save-btn" style="background:rgba(0,255,65,0.1);border:1px solid #00ff41;color:#00ff41;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">Save Changes</button>
                                </div>
                            </div>
                        </div>`;

                        content.querySelector('.doc-edit-btn')?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            document.getElementById('doc-display-' + id).style.display = 'none';
                            document.getElementById('doc-edit-' + id).style.display = 'block';
                        });
                        content.querySelector('.doc-cancel-btn')?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            document.getElementById('doc-display-' + id).style.display = 'block';
                            document.getElementById('doc-edit-' + id).style.display = 'none';
                        });
                        content.querySelector('.doc-save-btn')?.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const ta = document.getElementById('doc-ta-' + id);
                            if (!ta) return;
                            const btn = e.target;
                            btn.textContent = 'Saving...'; btn.disabled = true;
                            try {
                                const result = await ctx.api.updateDoc(ctx.slug, id, ta.value);
                                btn.textContent = 'Saved!'; btn.style.borderColor = '#00ff41'; btn.style.color = '#00ff41';
                                // Refresh display
                                const d = document.getElementById('doc-display-' + id);
                                const ed = document.getElementById('doc-edit-' + id);
                                d.innerHTML = `<pre style="white-space:pre-wrap;word-wrap:break-word;font-size:12px;line-height:1.6;color:#c5cdd8;background:#0a0e14;padding:16px;border-radius:6px;border:1px solid #1e2a3a;max-height:500px;overflow-y:auto;">${esc(ta.value)}</pre>`;
                                d.style.display = 'block'; ed.style.display = 'none';
                                setTimeout(() => { btn.textContent = 'Save Changes'; btn.disabled = false; }, 2000);
                            } catch (err) {
                                btn.textContent = 'Save Failed'; btn.style.borderColor = '#ff4444'; btn.style.color = '#ff4444';
                                setTimeout(() => { btn.textContent = 'Save Changes'; btn.disabled = false; btn.style.borderColor = '#00ff41'; btn.style.color = '#00ff41'; }, 3000);
                            }
                        });
                    } catch (e) {
                        content.innerHTML = `<div style="padding:16px;color:#ff4444;">Failed: ${e.message}</div>`;
                    }
                });
            });
        }

        bindAll();
    },
    destroy() {}
};


function renderGates(byGate, colors) {
    let h = '';
    for (const [gate, docs] of Object.entries(byGate)) {
        if (!docs?.length) continue;
        h += `<div><h3 style="font-size:14px;color:#e8ecf0;margin:20px 0 8px;border-left:3px solid ${colors[gate] || '#888'};padding-left:12px;">${gate} (${docs.length})</h3>
        ${docs.map(d => `<div class="doc-row-click" data-doc-id="${d.id}" style="cursor:pointer;border-bottom:1px solid #1e2a3a;">
            <div style="display:flex;justify-content:space-between;padding:10px 12px;align-items:center;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <input type="checkbox" class="doc-checkbox" data-doc-id="${d.id}" style="cursor:pointer;" onclick="event.stopPropagation();">
                    <span style="font-size:13px;color:#e8ecf0;">${d.filename}</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:11px;color:#6b7a8d;">${d.chunk_count} chunks . v${d.version} . ${fmtSize(d.content_length)}</span>
                    <button class="doc-delete-single" data-doc-id="${d.id}" data-doc-name="${esc(d.filename)}" onclick="event.stopPropagation();" style="background:none;border:1px solid #1e2a3a;color:#6b7a8d;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;transition:all 0.15s;" onmouseenter="this.style.borderColor='#ff4444';this.style.color='#ff4444';" onmouseleave="this.style.borderColor='#1e2a3a';this.style.color='#6b7a8d';">x</button>
                </div>
            </div>
            <div id="doc-content-${d.id}" style="display:none;border-top:1px solid #1e2a3a;"></div>
        </div>`).join('')}</div>`;
    }
    return h || '<div style="padding:40px;text-align:center;color:#6b7a8d;">No documents found</div>';
}

function fmtSize(b) { if (!b) return '0B'; if (b < 1024) return b + 'B'; if (b < 1048576) return (b/1024).toFixed(1) + 'KB'; return (b/1048576).toFixed(1) + 'MB'; }
function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
