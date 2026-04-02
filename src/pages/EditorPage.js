import "quill/dist/quill.snow.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Quill from "quill";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import useDocumentSocket from "../hooks/useDocumentSocket";
import useDirtyAutosave from "../hooks/useDirtyAutosave";
import useRemoteCursorOverlays from "../hooks/useRemoteCursorOverlays";
import api from "../services/api";
import { editorFormats, editorModules } from "../utils/quillModules";

/* ═══ Share Modal ═══ */
const ShareModal = ({ docId, onClose }) => {
  const [role, setRole] = useState("viewer");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const generate = async () => {
    setLoading(true); setErr("");
    try {
      const r = await api.post(`/documents/${docId}/share-link`, { role, isPublic: false });
      setLink(r.data.shareLink);
    } catch (_) { setErr("Failed to generate link."); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} id="share-modal">
        <div className="modal-header">
          <h2>Share Document</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="modal-desc">Generate a link to invite collaborators.</p>
        <div className="share-form">
          <div className="input-group">
            <label>Permission level</label>
            <select className="input-field" value={role} onChange={(e) => { setRole(e.target.value); setLink(""); setCopied(false); }}>
              <option value="viewer">🔍 Can view</option>
              <option value="editor">✏️ Can edit</option>
            </select>
          </div>
          <div className="share-role-info">
            {role === "viewer" ? "They can read and comment on the document." : "They can edit, format, and collaborate in real time."}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={generate} disabled={loading}>
            {loading ? <><span className="spinner" /> Generating…</> : "🔗 Generate Link"}
          </button>
        </div>
        {link && (
          <div className="share-link-row">
            <input className="input-field" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className={`btn ${copied ? "btn-primary" : "btn-secondary"}`} onClick={copy}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        )}
        {err && <div className="error-box" style={{ marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
};

/* ═══ Export Modal ═══ */
const ExportModal = ({ title, quillRef, onClose }) => {
  const exportPDF = () => {
    const q = quillRef.current; if (!q) return;
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
      body{font-family:'Inter',sans-serif;max-width:750px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.8}
      h1{font-size:1.8rem;border-bottom:2px solid #6366f1;padding-bottom:8px}
      .meta{color:#888;font-size:0.85rem;margin-bottom:20px}
      img{max-width:100%}blockquote{border-left:3px solid #6366f1;padding-left:16px;color:#555}</style>
      </head><body><h1>${title}</h1><div class="meta">Exported ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>${q.root.innerHTML}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const exportWord = () => {
    const q = quillRef.current; if (!q) return;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Calibri,sans-serif;font-size:12pt;line-height:1.6;color:#1a1a1a}h1{font-size:22pt;color:#4f46e5}h2{font-size:16pt;color:#4f46e5}</style></head>
      <body><h1>${title}</h1><p style="color:#888;font-size:10pt">Exported ${new Date().toLocaleDateString()}</p><hr>${q.root.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${title}.doc`; a.click(); URL.revokeObjectURL(a.href);
  };

  const exportHTML = () => {
    const q = quillRef.current; if (!q) return;
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7}</style></head><body>${q.root.innerHTML}</body></html>`], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${title}.html`; a.click(); URL.revokeObjectURL(a.href);
  };

  const exportText = () => {
    const q = quillRef.current; if (!q) return;
    const blob = new Blob([q.getText()], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${title}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} id="export-modal">
        <div className="modal-header">
          <h2>Export Document</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="modal-desc">Choose a format to download.</p>
        <div className="export-grid">
          <button className="export-card" onClick={exportPDF}><span className="icon">📄</span><span className="name">PDF</span><span className="desc">Print via browser dialog</span></button>
          <button className="export-card" onClick={exportWord}><span className="icon">📝</span><span className="name">Word</span><span className="desc">MS Word & Google Docs</span></button>
          <button className="export-card" onClick={exportHTML}><span className="icon">🌐</span><span className="name">HTML</span><span className="desc">Web-ready file</span></button>
          <button className="export-card" onClick={exportText}><span className="icon">📃</span><span className="name">Plain Text</span><span className="desc">No formatting</span></button>
        </div>
      </div>
    </div>
  );
};

/* ═══ Main Editor ═══ */
const EditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillContainerRef = useRef(null);
  const quillInstanceRef = useRef(null);

  const [title, setTitle] = useState("Untitled document");
  const [history, setHistory] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [suggestMode, setSuggestMode] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [isStarred, setIsStarred] = useState(false);
  
  // Local typing tracking
  const typingTimeoutRef = useRef(null);

  // Quill init
  useEffect(() => {
    if (!quillContainerRef.current || quillInstanceRef.current) return;
    const q = new Quill(quillContainerRef.current, { theme: "snow", modules: editorModules, formats: editorFormats, placeholder: "Start writing…" });
    q.setContents({ ops: [{ insert: "\n" }] });
    quillInstanceRef.current = q;
  }, []);

  // Socket
  const { status: socketStatus, role, presence, remoteCursors, comments, setComments, typists, socketError, emitDelta, emitCursor, emitComment, emitTyping } = useDocumentSocket(id, quillInstanceRef);
  const canEdit = role === "editor" || role === "owner";
  const displayError = error || socketError;

  const [saveStatus, setSaveStatus] = useState("");
  const status = saveStatus || socketStatus;
  const { markDirty } = useDirtyAutosave(id, title, quillInstanceRef, canEdit, setSaveStatus);

  // Remote cursors
  useRemoteCursorOverlays(quillInstanceRef, remoteCursors, user?.id);

  // Comment highlights
  useEffect(() => {
    const q = quillInstanceRef.current;
    if (!q || !comments.length) return;
    const len = q.getLength();
    if (len > 1) q.formatText(0, len, "background", false, "silent");
    comments.forEach((c) => {
      if (c.resolved || !c.range?.index == null || !c.range?.length) return;
      try { q.formatText(c.range.index, c.range.length, "background", "rgba(245,158,11,0.18)", "silent"); } catch (_) {}
    });
  }, [comments]);

  useEffect(() => { if (quillInstanceRef.current) quillInstanceRef.current.enable(canEdit); }, [canEdit]);

  const loadDoc = useCallback(async () => {
    try { 
      const r = await api.get(`/documents/${id}`); 
      setTitle(r.data.title); 
      setComments(r.data.comments || []);
      setIsStarred(r.data.starredBy?.includes(user?.id) || false);
      if (quillInstanceRef.current) {
        setWordCount(quillInstanceRef.current.getText().trim().split(/\s+/).filter(Boolean).length);
      }
    }
    catch (_) { setError("Unable to load document."); setTimeout(() => navigate("/dashboard"), 1200); }
  }, [id, navigate, setComments, user]);

  const loadHistory = useCallback(async () => {
    try { const r = await api.get(`/documents/${id}/history`); setHistory(r.data.slice(0, 8)); } catch (_) { setHistory([]); }
  }, [id]);

  useEffect(() => { loadDoc(); loadHistory(); }, [loadDoc, loadHistory]);
  useEffect(() => { document.body.classList.toggle("dark-mode", darkMode); return () => document.body.classList.remove("dark-mode"); }, [darkMode]);

  // Quill and Keyboard listeners
  useEffect(() => {
    const q = quillInstanceRef.current; if (!q) return;
    const onText = (d, _o, s) => { 
      setWordCount(q.getText().trim().split(/\s+/).filter(Boolean).length);
      if (s !== "user" || !canEdit) return; 
      markDirty(); 
      if (suggestMode) emitComment("[Suggestion] Edit proposed.", q.getSelection()); 
      emitDelta(d); 
      
      // Update local typing
      if (!typingTimeoutRef.current) emitTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(false);
        typingTimeoutRef.current = null;
      }, 1500);
    };
    const onSel = (r) => emitCursor(r);
    q.on("text-change", onText); q.on("selection-change", onSel);

    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (canEdit) markDirty();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => { 
      q.off("text-change", onText); q.off("selection-change", onSel); 
      document.removeEventListener("keydown", onKeyDown);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [canEdit, suggestMode, emitDelta, emitCursor, emitComment, markDirty, emitTyping]);

  const saveTitleBlur = async () => { if (canEdit) try { await api.put(`/documents/${id}`, { title, reason: "title-update" }); } catch (_) { setError("Failed to save title."); } };

  const addComment = async () => {
    const q = quillInstanceRef.current; if (!q) return;
    const range = q.getSelection();
    if (!range) { setError("Select text first to comment."); return; }
    const text = window.prompt("Enter your comment:");
    if (!text) return;
    try { const r = await api.post(`/documents/${id}/comments`, { text, range }); setComments((p) => [...p, r.data]); emitComment(text, range); }
    catch (_) { setError("Failed to add comment."); }
  };

  const toggleStar = async () => {
    try {
      const r = await api.patch(`/documents/${id}/star`);
      setIsStarred(r.data.starred);
    } catch (_) { setError("Failed to star document."); }
  };

  const resolveComment = async (e, commentId) => {
    e.stopPropagation();
    if (!canEdit) return;
    try {
      await api.patch(`/documents/${id}/comments/${commentId}/resolve`);
      setComments(p => p.map(c => c._id === commentId ? { ...c, resolved: true } : c));
    } catch (_) { setError("Failed to resolve."); }
  };

  const restoreVersion = async (versionId) => {
    if (!canEdit) return;
    if (!window.confirm("Restore this version? Unsaved changes will be lost.")) return;
    try {
      const r = await api.post(`/documents/${id}/versions/${versionId}/restore`);
      if (quillInstanceRef.current && r.data.content) {
        quillInstanceRef.current.setContents(r.data.content);
        // Important: we just overrode the whole document locally,
        // we should emit the delta so others see the restored content.
        // Easiest way in Quill to get the full delta is getContents().
        emitDelta(quillInstanceRef.current.getContents());
      }
      loadHistory();
    } catch (_) { setError("Failed to restore version."); }
  };

  const scrollToRange = (range) => {
    const q = quillInstanceRef.current; if (!q || !range?.index == null) return;
    q.setSelection(range.index, range.length || 0, "user");
    try { const b = q.getBounds(range.index); if (b) q.root.scrollTop = b.top - 60; } catch (_) {}
  };

  const timeAgo = (d) => { if (!d) return ""; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "Now"; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

  const statusClass = `status-badge${socketStatus === "Live sync active" ? " status-badge--live" : ""}`;

  return (
    <div id="editor-page">
      <Navbar />
      {showShare && <ShareModal docId={id} onClose={() => setShowShare(false)} />}
      {showExport && <ExportModal title={title} quillRef={quillInstanceRef} onClose={() => setShowExport(false)} />}

      <div className="editor-shell">
        <div className="editor-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button className="btn btn-icon" style={{ background: "none", fontSize: "1.2rem", color: isStarred ? "var(--warning)" : "var(--text-tertiary)" }} onClick={toggleStar} title="Star document">
              {isStarred ? "★" : "☆"}
            </button>
            <div>
              <input className="editor-title" disabled={!canEdit} onBlur={saveTitleBlur} onChange={(e) => setTitle(e.target.value)} value={title} placeholder="Untitled" id="doc-title" />
              {Object.keys(typists).length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--accent)", position: "absolute" }}>
                  {Object.values(typists).join(", ")} {Object.keys(typists).length === 1 ? "is" : "are"} typing…
                </div>
              )}
            </div>
          </div>
          <div className="editor-actions">
            <span className="status-badge" style={{ background: "transparent", color: "var(--text-secondary)" }}>{wordCount} words</span>
            <span className={statusClass}>{status}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setDarkMode((p) => !p)}>{darkMode ? "☀️" : "🌙"}</button>
            <button className="btn btn-secondary btn-sm" onClick={addComment}>💬</button>
            <button className={`btn btn-sm ${suggestMode ? "btn-primary" : "btn-secondary"}`} onClick={() => setSuggestMode((p) => !p)}>
              {suggestMode ? "✏ Suggesting" : "✏ Suggest"}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowShare(true)} id="share-btn">👥 Share</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(true)} id="export-btn">⬇ Export</button>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSidebarOpen((p) => !p)} title="Toggle sidebar">
              {sidebarOpen ? "◀" : "▶"}
            </button>
          </div>
        </div>

        {displayError && <div className="error-box" style={{ margin: "0 20px", marginTop: 8 }}>{displayError}</div>}

        <div className="editor-body">
          <div className="editor-center">
            <div className="editor-paper">
              <div ref={quillContainerRef} id="quill-editor" />
            </div>
          </div>

          {/* Mobile sidebar backdrop */}
          <div className={`sidebar-backdrop${sidebarOpen ? "" : " hidden"}`} onClick={() => setSidebarOpen(false)} />

          <aside className={`editor-sidebar${sidebarOpen ? "" : " hidden"}`} id="editor-sidebar">
            <div className="sidebar-section" id="presence-section">
              <div className="sidebar-heading">Online · {presence.length}</div>
              <ul className="sidebar-list">
                {presence.length === 0 ? <li className="sidebar-empty">No one here yet</li> : presence.map((m) => (
                  <li key={m.id}>
                    <span className="presence-dot" style={{ backgroundColor: m.avatarColor || "#6366f1", color: m.avatarColor || "#6366f1" }} />
                    {m.name}{String(m.id) === String(user?.id) ? " (you)" : ""}
                  </li>
                ))}
              </ul>
            </div>

            <div className="sidebar-section" id="comments-section">
              <div className="sidebar-heading">Comments · {comments.filter((c) => !c.resolved).length}</div>
              <div className="comments-list">
                {comments.length === 0 ? <p className="sidebar-empty">Select text and click 💬 to comment.</p> : comments.map((c) => (
                  <div key={c._id || c.text + c.createdAt} className={`comment-card${c.resolved ? " comment-card--resolved" : ""}`} onClick={() => scrollToRange(c.range)} role="button" tabIndex={0}>
                    <div className="comment-header">
                      <span className="comment-author">
                        <span className="presence-dot" style={{ backgroundColor: c.author?.avatarColor || "#6366f1", color: c.author?.avatarColor || "#6366f1" }} />
                        {c.author?.name || "User"}
                      </span>
                      <span className="comment-time">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="comment-text">{c.text}</p>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "5px" }}>
                      {c.range?.length > 0 && <span className="comment-badge comment-badge--range" style={{ marginTop: 0 }}>📍 Linked</span>}
                      {c.resolved ? <span className="comment-badge comment-badge--resolved" style={{ marginTop: 0 }}>✓ Resolved</span> : (
                        canEdit && <button onClick={(e) => resolveComment(e, c._id)} className="btn btn-sm" style={{ background: "transparent", border: "1px solid var(--success)", color: "var(--success)", padding: "1px 8px", fontSize: "0.65rem", marginTop: 0 }}>Resolve</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-section" id="history-section">
              <div className="sidebar-heading">History</div>
              <ul className="sidebar-list">
                {history.length === 0 ? <li className="sidebar-empty">No history yet</li> : history.map((e) => (
                  <li key={e.id} style={{ fontSize: "0.82rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>v{e.version} — {e.reason}</span>
                    {canEdit && <button onClick={() => restoreVersion(e.id)} className="btn btn-sm" style={{ padding: "2px 6px", fontSize: "0.65rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-tertiary)" }} title="Restore version">↺</button>}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
