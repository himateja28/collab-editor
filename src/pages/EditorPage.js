import "quill/dist/quill.snow.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Quill from "quill";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import api, { API_BASE_URL } from "../services/api";
import { editorFormats, editorModules } from "../utils/quillModules";

const EditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const quillContainerRef = useRef(null);
  const quillInstanceRef = useRef(null);
  const socketRef = useRef(null);

  const [title, setTitle] = useState("Untitled document");
  const [initialContent, setInitialContent] = useState({ ops: [{ insert: "\n" }] });
  const [version, setVersion] = useState(0);
  const [role, setRole] = useState("viewer");
  const [presence, setPresence] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Connecting...");
  const [darkMode, setDarkMode] = useState(false);
  const [suggestMode, setSuggestMode] = useState(false);
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  const canEdit = role === "editor" || role === "owner";

  useEffect(() => {
    if (!quillContainerRef.current || quillInstanceRef.current) return;

    const quill = new Quill(quillContainerRef.current, {
      theme: "snow",
      modules: editorModules,
      formats: editorFormats,
      placeholder: "Start collaborating...",
    });

    quill.setContents({ ops: [{ insert: "\n" }] });
    quillInstanceRef.current = quill;
  }, []);

  useEffect(() => {
    if (!quillInstanceRef.current || !initialContent) return;
    quillInstanceRef.current.setContents(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (!quillInstanceRef.current) return;
    quillInstanceRef.current.enable(canEdit);
  }, [canEdit]);

  const loadDocument = useCallback(async () => {
    try {
      const response = await api.get(`/documents/${id}`);
      setTitle(response.data.title);
      setInitialContent(response.data.content || { ops: [{ insert: "\n" }] });
      setVersion(response.data.version || 0);
      setRole(response.data.role || "viewer");
      setComments(response.data.comments || []);
    } catch (_error) {
      setError("Unable to load this document.");
      setTimeout(() => navigate("/dashboard"), 1200);
    }
  }, [id, navigate]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get(`/documents/${id}/history`);
      setHistory(response.data.slice(0, 8));
    } catch (_error) {
      setHistory([]);
    }
  }, [id]);

  useEffect(() => {
    loadDocument();
    loadHistory();
  }, [loadDocument, loadHistory]);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    return () => document.body.classList.remove("dark-mode");
  }, [darkMode]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected");
      socket.emit("document:join", { docId: id, token });
    });

    socket.on("document:load", (payload) => {
      setInitialContent(payload.content || { ops: [{ insert: "\n" }] });
      setVersion(payload.version || 0);
      setRole(payload.role || "viewer");
      setStatus("Live sync active");
    });

    socket.on("document:remote-delta", ({ delta, version: nextVersion }) => {
      const quill = quillInstanceRef.current;
      if (!quill) return;

      quill.updateContents(delta, "api");
      setVersion(nextVersion);
    });

    socket.on("presence:update", (users) => {
      setPresence(users);
    });

    socket.on("cursor:remote", ({ user: remoteUser, range }) => {
      setRemoteCursors((prev) => ({ ...prev, [remoteUser.id]: { remoteUser, range } }));
    });

    socket.on("document:new-comment", (comment) => {
      setComments((prev) => [...prev, comment]);
    });

    socket.on("document:error", (payload) => {
      setError(payload?.message || "Socket error.");
    });

    socket.on("disconnect", () => {
      setStatus("Disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    const quill = quillInstanceRef.current;
    if (!quill) return;

    const onTextChange = (delta, _oldDelta, source) => {
      if (source !== "user") return;
      if (!canEdit) return;

      if (suggestMode) {
        socketRef.current?.emit("document:comment", {
          text: "[Suggestion] Proposed edit in this section.",
          range: quill.getSelection(),
        });
      }

      socketRef.current?.emit("document:delta", {
        delta,
        baseVersion: version,
      });
    };

    const onSelectionChange = (range) => {
      socketRef.current?.emit("cursor:update", { range });
    };

    quill.on("text-change", onTextChange);
    quill.on("selection-change", onSelectionChange);

    return () => {
      quill.off("text-change", onTextChange);
      quill.off("selection-change", onSelectionChange);
    };
  }, [canEdit, suggestMode, version]);

  useEffect(() => {
    const autosaveInterval = setInterval(async () => {
      if (!canEdit) return;

      const quill = quillInstanceRef.current;
      if (!quill) return;

      try {
        await api.put(`/documents/${id}`, {
          title,
          content: quill.getContents(),
          reason: "autosave",
        });
        setStatus(`Saved at ${new Date().toLocaleTimeString()}`);
      } catch (_error) {
        setStatus("Autosave failed");
      }
    }, 5000);

    return () => clearInterval(autosaveInterval);
  }, [canEdit, id, title]);

  const handleTitleBlur = async () => {
    if (!canEdit) return;

    try {
      await api.put(`/documents/${id}`, { title, reason: "title-update" });
    } catch (_error) {
      setError("Failed to update title.");
    }
  };

  const addComment = async () => {
    const quill = quillInstanceRef.current;
    if (!quill) return;

    const range = quill.getSelection();
    const text = window.prompt("Comment text");
    if (!text) return;

    try {
      const response = await api.post(`/documents/${id}/comments`, { text, range });
      setComments((prev) => [...prev, response.data]);
      socketRef.current?.emit("document:comment", { text, range });
    } catch (_error) {
      setError("Failed to add comment.");
    }
  };

  const exportDoc = (type) => {
    const quill = quillInstanceRef.current;
    if (!quill) return;

    const plainText = quill.getText();
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const fileName = `${title || "document"}.${type === "word" ? "doc" : "pdf"}`;

    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const generateInviteLink = async () => {
    try {
      const response = await api.post(`/documents/${id}/share-link`, {
        role: inviteRole,
        isPublic: false,
      });

      const link = response.data.shareLink;
      setInviteLink(link);
      await navigator.clipboard.writeText(link);
      setStatus("Invite link copied");
    } catch (_error) {
      setError("Failed to generate invite link.");
    }
  };

  const cursorCards = useMemo(
    () =>
      Object.values(remoteCursors).map((entry) => (
        <li key={entry.remoteUser.id}>
          {entry.remoteUser.name}: index {entry.range?.index ?? 0}
        </li>
      )),
    [remoteCursors]
  );

  return (
    <div className="page-shell">
      <Navbar />
      <main className="editor-layout">
        <section className="editor-main">
          <div className="editor-toolbar">
            <input
              className="title-input"
              disabled={!canEdit}
              onBlur={handleTitleBlur}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />

            <div className="toolbar-actions">
              <span className="status-pill">{status}</span>
              <button
                className="ghost-btn"
                onClick={() => setDarkMode((prev) => !prev)}
                type="button"
              >
                {darkMode ? "Light" : "Dark"} mode
              </button>
              <button className="ghost-btn" onClick={addComment} type="button">
                Comment
              </button>
              <button
                className={suggestMode ? "primary-btn" : "ghost-btn"}
                onClick={() => setSuggestMode((prev) => !prev)}
                type="button"
              >
                Suggest mode
              </button>
              <select
                className="invite-select"
                onChange={(event) => setInviteRole(event.target.value)}
                value={inviteRole}
              >
                <option value="viewer">Invite as viewer</option>
                <option value="editor">Invite as editor</option>
              </select>
              <button className="ghost-btn" onClick={generateInviteLink} type="button">
                Copy invite link
              </button>
              <button className="ghost-btn" onClick={() => exportDoc("pdf")} type="button">
                Export PDF
              </button>
              <button className="ghost-btn" onClick={() => exportDoc("word")} type="button">
                Export Word
              </button>
            </div>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {inviteLink ? <p className="meta-row">Invite link: {inviteLink}</p> : null}

          <div className="quill-editor-host" ref={quillContainerRef} />
        </section>

        <aside className="editor-sidebar">
          <section className="sidebar-card">
            <h3>Presence</h3>
            <ul>
              {presence.map((member) => (
                <li key={member.id}>
                  <span
                    className="avatar-dot"
                    style={{ backgroundColor: member.avatarColor || "#0f766e" }}
                  />
                  {member.name}
                  {String(member.id) === String(user?.id) ? " (you)" : ""}
                </li>
              ))}
            </ul>
          </section>

          <section className="sidebar-card">
            <h3>Remote Cursors</h3>
            <ul>{cursorCards.length ? cursorCards : <li>No cursor movement yet.</li>}</ul>
          </section>

          <section className="sidebar-card">
            <h3>Comments</h3>
            <ul>
              {comments.map((comment) => (
                <li key={comment._id || `${comment.text}-${comment.createdAt}`}>
                  <strong>{comment.author?.name || "Collaborator"}</strong>
                  <p>{comment.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="sidebar-card">
            <h3>Version History</h3>
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  v{entry.version} ({entry.reason})
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
};

export default EditorPage;
