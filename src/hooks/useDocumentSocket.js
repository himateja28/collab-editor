import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../services/api";

/**
 * Manages the WebSocket connection for real-time collaboration.
 * Separated from EditorPage to avoid the stale-closure bug with `version`
 * and to keep render logic clean.
 */
const useDocumentSocket = (docId, quillRef) => {
  const socketRef = useRef(null);
  const versionRef = useRef(0);

  const [status, setStatus] = useState("Connecting…");
  const [role, setRole] = useState("viewer");
  const [presence, setPresence] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [comments, setComments] = useState([]);
  const [typists, setTypists] = useState({});
  const [socketError, setSocketError] = useState("");

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected");
      socket.emit("document:join", { docId, token });
    });

    socket.on("document:load", (payload) => {
      const quill = quillRef.current;
      if (quill) {
        quill.setContents(payload.content || { ops: [{ insert: "\n" }] });
      }
      versionRef.current = payload.version || 0;
      setRole(payload.role || "viewer");
      setStatus("Live sync active");
    });

    socket.on("document:remote-delta", ({ delta, version: nextVersion }) => {
      const quill = quillRef.current;
      if (!quill) return;

      quill.updateContents(delta, "api");
      versionRef.current = nextVersion;
    });

    socket.on("presence:update", (users) => {
      setPresence(users);
    });

    socket.on("cursor:remote", ({ user: remoteUser, range }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [remoteUser.id]: { remoteUser, range },
      }));
    });

    socket.on("document:new-comment", (comment) => {
      setComments((prev) => [...prev, comment]);
    });

    socket.on("document:remote-typing", ({ userId, name, isTyping }) => {
      setTypists((prev) => {
        const next = { ...prev };
        if (isTyping) {
          next[userId] = name;
        } else {
          delete next[userId];
        }
        return next;
      });
    });

    socket.on("document:error", (payload) => {
      setSocketError(payload?.message || "Socket error.");
    });

    socket.on("disconnect", () => {
      setStatus("Reconnecting…");
    });

    socket.on("reconnect", () => {
      setStatus("Reconnected");
      socket.emit("document:join", { docId, token });
    });

    return () => {
      socket.disconnect();
    };
  }, [docId, quillRef]);

  const emitDelta = useCallback((delta) => {
    socketRef.current?.emit("document:delta", {
      delta,
      baseVersion: versionRef.current,
    });
  }, []);

  const emitCursor = useCallback((range) => {
    socketRef.current?.emit("cursor:update", { range });
  }, []);

  const emitComment = useCallback((text, range) => {
    socketRef.current?.emit("document:comment", { text, range });
  }, []);

  const emitTyping = useCallback((isTyping) => {
    socketRef.current?.emit("document:typing", { isTyping });
  }, []);

  const setCommentsExternal = setComments;

  return {
    socketRef,
    versionRef,
    status,
    role,
    presence,
    remoteCursors,
    comments,
    setComments: setCommentsExternal,
    typists,
    socketError,
    emitDelta,
    emitCursor,
    emitComment,
    emitTyping,
  };
};

export default useDocumentSocket;
