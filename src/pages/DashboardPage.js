import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../services/api";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/documents");
      setDocuments(res.data);
    } catch (_e) {
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.post("/documents", { title: "Untitled document" });
      navigate(`/documents/${res.data.id}`);
    } catch (_e) {
      setError("Failed to create document.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateTemplate = async (templateName) => {
    setCreating(true);
    try {
      let content = { ops: [{ insert: "\n" }] };
      if (templateName === "Project Brief") {
        content = { ops: [{ insert: "Project Brief\n", attributes: { header: 1 } }, { insert: "\nOverview\n", attributes: { header: 2 } }, { insert: "Write project overview here.\n" }] };
      } else if (templateName === "Meeting Notes") {
        content = { ops: [{ insert: "Meeting Notes\n", attributes: { header: 1 } }, { insert: "Date: \nAttendees: \n\nAgenda:\n", attributes: { bold: true } }] };
      }
      const res = await api.post("/documents", { title: templateName, content });
      navigate(`/documents/${res.data.id}`);
    } catch (_e) {
      setError("Failed to create document.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document permanently?")) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((p) => p.filter((d) => d.id !== id));
    } catch (_e) {
      setError("Failed to delete. You may not be the owner.");
    }
  };

  const timeAgo = (d) => {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const filteredDocs = documents.filter(doc => {
    const matchSearch = String(doc.title || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchStar = filterMode === "all" || doc.starred;
    return matchSearch && matchStar;
  });

  return (
    <div id="dashboard-page">
      <Navbar />
      <main className="dashboard">
        <section className="dashboard-head">
          <div>
            <h1>Your Documents</h1>
            <p>Create, collaborate, and manage your work.</p>
          </div>
          <button className="btn btn-primary" disabled={creating} onClick={handleCreate} id="create-doc-btn">
            {creating ? <><span className="spinner" /> Creating…</> : "+ New Document"}
          </button>
        </section>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        <section className="templates-section">
          <h2>Start a new document</h2>
          <div className="templates-grid">
            <div className="template-card" onClick={() => handleCreateTemplate("Blank Document")}>
              <span className="icon">📄</span>
              <span className="name">Blank Document</span>
            </div>
            <div className="template-card" onClick={() => handleCreateTemplate("Project Brief")}>
              <span className="icon">📋</span>
              <span className="name">Project Brief</span>
            </div>
            <div className="template-card" onClick={() => handleCreateTemplate("Meeting Notes")}>
              <span className="icon">🤝</span>
              <span className="name">Meeting Notes</span>
            </div>
          </div>
        </section>

        <div className="dashboard-controls">
          <input
            className="dashboard-search"
            type="text"
            placeholder="Search documents by title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="dashboard-tabs">
            <button className={`dashboard-tab${filterMode === "all" ? " active" : ""}`} onClick={() => setFilterMode("all")}>All Documents</button>
            <button className={`dashboard-tab${filterMode === "starred" ? " active" : ""}`} onClick={() => setFilterMode("starred")}>⭐️ Starred</button>
          </div>
        </div>

        {loading ? (
          <div className="loading-block"><span className="spinner spinner--lg" />Loading documents…</div>
        ) : (
          <div className="doc-grid" id="doc-grid">
            {filteredDocs.length === 0 && (
              <div className="empty-state" id="empty-docs">
                <div className="empty-state-icon">📄</div>
                <h2>No documents yet</h2>
                <p>Create your first document to get started.</p>
              </div>
            )}
            {filteredDocs.map((doc) => (
              <article key={doc.id} className="doc-card" id={`doc-${doc.id}`}>
                <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Link to={`/documents/${doc.id}`}>{doc.title}</Link>
                  {doc.starred && <span style={{ color: "var(--warning)", fontSize: "1.2rem" }}>★</span>}
                </h3>
                <div className="doc-meta">
                  <strong>{doc.role}</strong> · {timeAgo(doc.updatedAt)}
                </div>
                <div className="doc-actions">
                  <Link className="btn btn-secondary btn-sm" to={`/documents/${doc.id}`}>Open</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)} type="button">Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
