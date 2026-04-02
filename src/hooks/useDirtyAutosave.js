import { useEffect, useRef } from "react";
import api from "../services/api";

/**
 * Autosave that only fires when the document content has actually changed.
 * Uses a dirty flag set by Quill's text-change event instead of
 * unconditionally saving every N seconds.
 */
const useDirtyAutosave = (docId, title, quillRef, canEdit, setStatus) => {
  const dirtyRef = useRef(false);

  // Mark dirty on any user edit
  const markDirty = () => {
    dirtyRef.current = true;
  };

  useEffect(() => {
    if (!canEdit) return;

    const interval = setInterval(async () => {
      if (!dirtyRef.current) return;

      const quill = quillRef.current;
      if (!quill) return;

      try {
        await api.put(`/documents/${docId}`, {
          title,
          content: quill.getContents(),
          reason: "autosave",
        });
        dirtyRef.current = false;
        setStatus(`Saved at ${new Date().toLocaleTimeString()}`);
      } catch (_error) {
        setStatus("Autosave failed");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [canEdit, docId, title, quillRef, setStatus]);

  return { markDirty };
};

export default useDirtyAutosave;
