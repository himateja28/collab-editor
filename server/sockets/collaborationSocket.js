const jwt = require("jsonwebtoken");
const Delta = require("quill-delta");
const Document = require("../models/Document");
const User = require("../models/User");
const { canEdit, canRead } = require("../utils/permissions");

const activeRooms = new Map();
const saveTimers = new Map();

const getRoomState = (docId) => {
  if (!activeRooms.has(docId)) {
    activeRooms.set(docId, {
      delta: new Delta([{ insert: "\n" }]),
      version: 0,
      loaded: false,
      users: new Map(),
    });
  }
  return activeRooms.get(docId);
};

/**
 * Debounced save — waits 3s after the last edit before persisting.
 * Uses $push with $slice to cap version history server-side.
 */
const scheduleSave = (docId, userId) => {
  const existingTimer = saveTimers.get(docId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    const roomState = activeRooms.get(docId);
    if (!roomState) return;

    try {
      await Document.findByIdAndUpdate(docId, {
        content: roomState.delta,
        version: roomState.version,
        lastEditedBy: userId,
        $push: {
          versions: {
            $each: [
              {
                content: roomState.delta,
                version: roomState.version,
                savedBy: userId,
                reason: "autosave",
              },
            ],
            $slice: -50, // Keep only the last 50 versions
          },
        },
      });
    } catch (error) {
      console.error(`[Socket] Failed to autosave doc ${docId}:`, error.message);
    }

    saveTimers.delete(docId);
  }, 3000);

  saveTimers.set(docId, timer);
};

/**
 * Clean up a room if no users remain. Prevents memory leaks
 * from abandoned document rooms.
 */
const cleanupRoom = (docId) => {
  const roomState = activeRooms.get(docId);
  if (!roomState || roomState.users.size > 0) return;

  // Clear any pending save timer
  const timer = saveTimers.get(docId);
  if (timer) {
    clearTimeout(timer);
    saveTimers.delete(docId);
  }

  activeRooms.delete(docId);
};

const authenticateSocket = async (token) => {
  if (!token) throw new Error("Missing socket token");

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  const decoded = jwt.verify(token, secret);
  const user = await User.findById(decoded.userId).select(
    "name email avatarColor"
  );
  if (!user) throw new Error("Invalid socket token");
  return user;
};

const initializeCollaborationSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("document:join", async ({ docId, token }) => {
      try {
        const user = await authenticateSocket(token);
        const document = await Document.findById(docId);

        if (!document || !canRead(document, user._id)) {
          socket.emit("document:error", {
            message: "Document access denied.",
          });
          return;
        }

        const roomState = getRoomState(docId);
        if (!roomState.loaded) {
          roomState.delta = new Delta(
            document.content?.ops || [{ insert: "\n" }]
          );
          roomState.version = document.version || 0;
          roomState.loaded = true;
        }

        socket.data.user = user;
        socket.data.docId = docId;
        socket.data.canEdit = canEdit(document, user._id);

        socket.join(docId);
        roomState.users.set(socket.id, {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatarColor: user.avatarColor,
        });

        socket.emit("document:load", {
          content: roomState.delta,
          version: roomState.version,
          role: socket.data.canEdit ? "editor" : "viewer",
        });

        io.to(docId).emit(
          "presence:update",
          Array.from(roomState.users.values())
        );
      } catch (error) {
        socket.emit("document:error", {
          message: "Unable to join document.",
        });
      }
    });

    socket.on("document:delta", async ({ delta }) => {
      try {
        const { user, docId, canEdit: userCanEdit } = socket.data;
        if (!user || !docId || !userCanEdit || !delta) return;

        const roomState = getRoomState(docId);
        const incomingDelta = new Delta(delta.ops || []);
        roomState.delta = roomState.delta.compose(incomingDelta);
        roomState.version += 1;

        socket.to(docId).emit("document:remote-delta", {
          delta: incomingDelta,
          version: roomState.version,
          user: {
            id: user._id,
            name: user.name,
            avatarColor: user.avatarColor,
          },
        });

        scheduleSave(docId, user._id);
      } catch (error) {
        socket.emit("document:error", {
          message: "Failed to apply change.",
        });
      }
    });

    socket.on("cursor:update", ({ range }) => {
      const { user, docId } = socket.data;
      if (!user || !docId) return;

      socket.to(docId).emit("cursor:remote", {
        user: {
          id: user._id,
          name: user.name,
          avatarColor: user.avatarColor,
        },
        range,
      });
    });

    socket.on("document:typing", ({ isTyping }) => {
      const { user, docId } = socket.data;
      if (!user || !docId) return;

      socket.to(docId).emit("document:remote-typing", {
        userId: user._id,
        name: user.name,
        isTyping,
      });
    });

    socket.on("document:comment", async ({ text, range }) => {
      const { user, docId } = socket.data;
      if (!user || !docId || !text?.trim()) return;

      try {
        const document = await Document.findById(docId);
        if (!document || !canRead(document, user._id)) return;

        document.comments.push({
          text: text.trim(),
          range,
          author: user._id,
        });
        await document.save();
        await document.populate("comments.author", "name email avatarColor");

        const comment = document.comments[document.comments.length - 1];
        io.to(docId).emit("document:new-comment", comment);
      } catch (error) {
        console.error(`[Socket] Failed to add comment in doc ${docId}:`, error.message);
      }
    });

    socket.on("disconnect", () => {
      const { docId } = socket.data;
      if (!docId || !activeRooms.has(docId)) return;

      const roomState = activeRooms.get(docId);
      roomState.users.delete(socket.id);

      io.to(docId).emit(
        "presence:update",
        Array.from(roomState.users.values())
      );

      // Clean up empty rooms to prevent memory leaks
      cleanupRoom(docId);
    });
  });
};

module.exports = initializeCollaborationSocket;
