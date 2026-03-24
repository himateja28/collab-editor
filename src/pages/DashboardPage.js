import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../services/api";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/documents");
      setDocuments(response.data);
    } catch (_error) {
      setError("Failed to load your documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const response = await api.post("/documents", { title: "Untitled document" });
      navigate(`/documents/${response.data.id}`);
    } catch (_error) {
      setError("Failed to create a new document.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document permanently?")) {
      return;
    }

    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (_error) {
      setError("Failed to delete document. You may not be the owner.");
    }
  };

  return (
    <div className="page-shell">
      <Navbar />

      <main className="dashboard-grid">
        <section className="dashboard-header">
          <div>
            <h1>Documents</h1>
            <p>Build, review, and collaborate in live sessions.</p>
          </div>
          <button className="primary-btn" onClick={handleCreate} type="button">
            {creating ? "Creating..." : "New document"}
          </button>
        </section>

        {error ? <p className="error-text">{error}</p> : null}

        {loading ? <p>Loading documents...</p> : null}

        {!loading && documents.length === 0 ? (
          <article className="empty-card">
            <h2>No documents yet</h2>
            <p>Create your first collaborative document to get started.</p>
          </article>
        ) : null}

        <section className="doc-list">
          {documents.map((doc) => (
            <article key={doc.id} className="doc-card">
              <Link to={`/documents/${doc.id}`}>
                <h3>{doc.title}</h3>
              </Link>
              <p className="meta-row">Role: {doc.role}</p>
              <p className="meta-row">
                Updated: {new Date(doc.updatedAt).toLocaleString()}
              </p>
              <div className="actions-row">
                <Link className="ghost-btn" to={`/documents/${doc.id}`}>
                  Open
                </Link>
                <button
                  className="danger-btn"
                  onClick={() => handleDelete(doc.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
