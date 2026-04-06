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
                        <select id="upload-gate" style="background:#131B26;border:1px solid #1e2a3a;color:#e8ecf0;padding:6px 12px;border-radius:4px;font-size:12px;">
                            <option value="SECURITY">Security</option>
                            <option value="ARCHITECTURE">Architecture</option>
                            <option value="STYLE">Style</option>
                            <option value="ONBOARDING">Onboarding</option>
                            <option value="LEGAL">Legal</option>
                        </select>
                        <label style="display:inline-block;background:rgba(0,255,65,0.1);color:#00ff41;border:1px solid #00ff41;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px;">
                            Upload File
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

        // Upload handler
        document.getElementById('doc-upload-input')?.addEventListener('change', async function() {
            const gate = document.getElementById('upload-gate').value;
            let uploaded = 0;
            let failed = 0;
            for (const file of this.files) {
                try {
                    const result = await ctx.api.uploadDoc(ctx.slug, file, gate);
                    uploaded++;
                } catch (e) {
                    failed++;
                    console.error('Upload failed:', file.name, e);
                }
            }
            if (uploaded > 0) {
                alert(`Uploaded ${uploaded} file(s)${failed > 0 ? `, ${failed} failed` : ''}. Documents chunked and ready for PR reviews.`);
                // Reload docs module
                if (ctx.orchestrator?.loadModule) ctx.orchestrator.loadModule('docs');
                else location.reload();
            } else if (failed > 0) {
                alert(`All uploads failed. Check file format.`);
            }
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
