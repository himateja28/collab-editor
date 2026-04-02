import { useEffect, useRef } from "react";

/**
 * Renders real-time remote cursor carets + name labels inside the Quill editor.
 * Each collaborator gets a colored caret line and a floating name tag that
 * follows their cursor position without disturbing the document content.
 */
const useRemoteCursorOverlays = (quillRef, remoteCursors, currentUserId) => {
  const overlayContainerRef = useRef(null);
  const cursorElementsRef = useRef({});

  // Create the overlay container once
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const editorEl = quill.root;
    const parentEl = editorEl.parentElement;

    // Only create if not already present
    if (!overlayContainerRef.current) {
      const container = document.createElement("div");
      container.className = "remote-cursors-overlay";
      container.style.cssText =
        "position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:hidden;z-index:5;";
      parentEl.style.position = "relative";
      parentEl.appendChild(container);
      overlayContainerRef.current = container;
    }

    return () => {
      if (overlayContainerRef.current && overlayContainerRef.current.parentElement) {
        overlayContainerRef.current.parentElement.removeChild(overlayContainerRef.current);
      }
      overlayContainerRef.current = null;
      cursorElementsRef.current = {};
    };
  }, [quillRef]);

  // Update cursor positions whenever remoteCursors change
  useEffect(() => {
    const quill = quillRef.current;
    const container = overlayContainerRef.current;
    if (!quill || !container) return;


    const existingIds = new Set();

    Object.entries(remoteCursors).forEach(([userId, { remoteUser, range }]) => {
      // Skip current user's own cursor
      if (String(userId) === String(currentUserId)) return;
      if (!range || range.index == null) return;

      existingIds.add(userId);

      let cursorEl = cursorElementsRef.current[userId];

      // Create cursor element if it doesn't exist
      if (!cursorEl) {
        cursorEl = document.createElement("div");
        cursorEl.className = "remote-cursor";
        cursorEl.innerHTML = `
          <div class="remote-cursor-caret"></div>
          <div class="remote-cursor-label"></div>
        `;
        container.appendChild(cursorEl);
        cursorElementsRef.current[userId] = cursorEl;
      }

      // Update color and name
      const color = remoteUser.avatarColor || "#2563eb";
      const caret = cursorEl.querySelector(".remote-cursor-caret");
      const label = cursorEl.querySelector(".remote-cursor-label");

      caret.style.backgroundColor = color;
      label.style.backgroundColor = color;
      label.textContent = remoteUser.name || "User";

      // Calculate position from Quill bounds
      try {
        const bounds = quill.getBounds(range.index, range.length || 0);
        const top = bounds.top;
        const left = bounds.left;

        cursorEl.style.transform = `translate(${left}px, ${top}px)`;
        cursorEl.style.opacity = "1";

        // If there's a selection range, show highlight
        if (range.length > 0) {
          let selEl = cursorEl.querySelector(".remote-cursor-selection");
          if (!selEl) {
            selEl = document.createElement("div");
            selEl.className = "remote-cursor-selection";
            cursorEl.appendChild(selEl);
          }
          selEl.style.backgroundColor = color;
          selEl.style.width = `${bounds.width}px`;
          selEl.style.height = `${bounds.height}px`;
        } else {
          const selEl = cursorEl.querySelector(".remote-cursor-selection");
          if (selEl) selEl.remove();
        }

        // Set caret height to match line height
        caret.style.height = `${bounds.height || 20}px`;
      } catch (_err) {
        cursorEl.style.opacity = "0";
      }
    });

    // Remove cursors for users who left
    Object.keys(cursorElementsRef.current).forEach((userId) => {
      if (!existingIds.has(userId)) {
        const el = cursorElementsRef.current[userId];
        if (el && el.parentElement) {
          el.parentElement.removeChild(el);
        }
        delete cursorElementsRef.current[userId];
      }
    });
  }, [remoteCursors, quillRef, currentUserId]);

  // Re-position cursors on scroll/resize
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const reposition = () => {
      // Trigger re-render by accessing the current cursors
      const container = overlayContainerRef.current;
      if (!container) return;

      Object.entries(cursorElementsRef.current).forEach(([userId, cursorEl]) => {
        const data = remoteCursors[userId];
        if (!data || !data.range || data.range.index == null) return;

        try {
          const bounds = quill.getBounds(data.range.index, data.range.length || 0);
          const caret = cursorEl.querySelector(".remote-cursor-caret");
          cursorEl.style.transform = `translate(${bounds.left}px, ${bounds.top}px)`;
          if (caret) caret.style.height = `${bounds.height || 20}px`;
        } catch (_err) {
          cursorEl.style.opacity = "0";
        }
      });
    };

    const editorEl = quill.root;
    editorEl.addEventListener("scroll", reposition);
    window.addEventListener("resize", reposition);

    return () => {
      editorEl.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    };
  }, [quillRef, remoteCursors]);
};

export default useRemoteCursorOverlays;
