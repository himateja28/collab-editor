const crypto = require("crypto");
const Document = require("../models/Document");
const { canEdit, canRead, getRole, isOwner } = require("../utils/permissions");

const roleRank = {
  viewer: 1,
  editor: 2,
};

const listDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { search } = req.query;

    const filter = {
      $or: [{ owner: userId }, { "collaborators.user": userId }],
    };

    if (search && search.trim()) {
      filter.title = { $regex: search.trim(), $options: "i" };
    }

    const docs = await Document.find(filter)
      .sort({ updatedAt: -1 })
      .select("title owner collaborators updatedAt createdAt starredBy");

    const mapped = docs.map((doc) => ({
      id: doc._id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
      role: getRole(doc, userId),
      owner: doc.owner,
      collaborators: doc.collaborators,
      starred: doc.starredBy?.some(id => String(id) === String(userId)) || false,
    }));

    return res.json(mapped);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch documents." });
  }
};

const createDocument = async (req, res) => {
  try {
    const { title, content } = req.body;

    const initialContent = content || { ops: [{ insert: "\n" }] };

    const doc = await Document.create({
      title: title?.trim() || "Untitled document",
      owner: req.user._id,
      collaborators: [{ user: req.user._id, role: "editor" }],
      content: initialContent,
      versions: [
        {
          content: initialContent,
          version: 0,
          savedBy: req.user._id,
          reason: "initial",
        },
      ],
    });

    return res.status(201).json({ id: doc._id, title: doc.title });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create document." });
  }
};

const getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id)
      .populate("comments.author", "name email avatarColor")
      .populate("owner", "name email avatarColor");

    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!canRead(doc, req.user._id)) {
      return res.status(403).json({ message: "No access to this document." });
    }

    return res.json({
      id: doc._id,
      title: doc.title,
      content: doc.content,
      version: doc.version,
      role: getRole(doc, req.user._id),
      owner: doc.owner,
      collaborators: doc.collaborators,
      comments: doc.comments,
      isPublic: doc.isPublic,
      shareToken: doc.shareToken,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch document." });
  }
};

const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, reason = "manual-save" } = req.body;

    const doc = await Document.findById(id).select("-versions");
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!canEdit(doc, req.user._id)) {
      return res.status(403).json({ message: "You can view but not edit this document." });
    }

    const updates = {};

    if (typeof title === "string" && title.trim()) {
      updates.title = title.trim();
    }

    if (content) {
      const nextVersion = (doc.version || 0) + 1;
      updates.content = content;
      updates.version = nextVersion;
      updates.lastEditedBy = req.user._id;

      // Atomic push with slice — never loads the full versions array
      await Document.findByIdAndUpdate(id, {
        $set: { content, version: nextVersion, lastEditedBy: req.user._id },
        $push: {
          versions: {
            $each: [{ content, version: nextVersion, savedBy: req.user._id, reason }],
            $slice: -50,
          },
        },
      });

      // Also update title if changed
      if (updates.title) {
        await Document.findByIdAndUpdate(id, { $set: { title: updates.title } });
      }

      return res.json({ message: "Document updated.", version: nextVersion });
    }

    // Title-only update (no content change)
    if (updates.title) {
      doc.title = updates.title;
      await doc.save();
    }

    return res.json({ message: "Document updated.", version: doc.version });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update document." });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!isOwner(doc, req.user._id)) {
      return res.status(403).json({ message: "Only owner can delete this document." });
    }

    await Document.findByIdAndDelete(req.params.id);
    return res.json({ message: "Document deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete document." });
  }
};

const updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!isOwner(doc, req.user._id)) {
      return res.status(403).json({ message: "Only owner can manage permissions." });
    }

    if (!["editor", "viewer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const existing = doc.collaborators.find(
      (entry) => String(entry.user) === String(userId)
    );

    if (existing) {
      existing.role = role;
    } else {
      doc.collaborators.push({ user: userId, role });
    }

    await doc.save();
    return res.json({ message: "Permissions updated." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update permissions." });
  }
};

const createShareLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic = false, role = "viewer" } = req.body;

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!isOwner(doc, req.user._id)) {
      return res.status(403).json({ message: "Only owner can share this document." });
    }

    if (!["viewer", "editor"].includes(role)) {
      return res.status(400).json({ message: "Invalid invite role." });
    }

    doc.isPublic = Boolean(isPublic);
    doc.inviteRole = role;
    doc.shareToken = doc.shareToken || crypto.randomBytes(16).toString("hex");
    await doc.save();

    return res.json({
      shareToken: doc.shareToken,
      isPublic: doc.isPublic,
      inviteRole: doc.inviteRole,
      shareLink: `${process.env.CLIENT_ORIGIN || "http://localhost:3000"}/invite/${doc.shareToken}`,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create share link." });
  }
};

const getInviteDetails = async (req, res) => {
  try {
    const { token } = req.params;

    const doc = await Document.findOne({ shareToken: token }).populate(
      "owner",
      "name email"
    );

    if (!doc) {
      return res.status(404).json({ message: "Invite link is invalid or expired." });
    }

    return res.json({
      documentId: doc._id,
      title: doc.title,
      owner: doc.owner,
      inviteRole: doc.inviteRole || "viewer",
      isPublic: doc.isPublic,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch invite details." });
  }
};

const acceptInviteLink = async (req, res) => {
  try {
    const { token } = req.params;

    const doc = await Document.findOne({ shareToken: token });
    if (!doc) {
      return res.status(404).json({ message: "Invite link is invalid or expired." });
    }

    const userId = req.user._id;

    if (!isOwner(doc, userId)) {
      const targetRole = doc.inviteRole || "viewer";
      const existing = doc.collaborators.find(
        (entry) => String(entry.user) === String(userId)
      );

      if (!existing) {
        doc.collaborators.push({ user: userId, role: targetRole });
      } else if (roleRank[targetRole] > roleRank[existing.role]) {
        existing.role = targetRole;
      }
    }

    await doc.save();

    return res.json({
      id: doc._id,
      title: doc.title,
      role: getRole(doc, userId),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to accept invite link." });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, range } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ message: "Comment text is required." });
    }

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!canRead(doc, req.user._id)) {
      return res.status(403).json({ message: "No access to this document." });
    }

    doc.comments.push({
      text: text.trim(),
      range,
      author: req.user._id,
    });

    await doc.save();
    await doc.populate("comments.author", "name email avatarColor");

    return res.status(201).json(doc.comments[doc.comments.length - 1]);
  } catch (error) {
    return res.status(500).json({ message: "Failed to add comment." });
  }
};

const resolveComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!canEdit(doc, req.user._id)) {
      return res.status(403).json({ message: "No permission to resolve comment." });
    }

    const comment = doc.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found." });
    }

    comment.resolved = true;
    await doc.save();

    return res.json({ message: "Comment resolved." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to resolve comment." });
  }
};

const getHistory = async (req, res) => {
  try {
    // Exclude the heavy 'content' field from each version entry
    const doc = await Document.findById(req.params.id)
      .select("versions._id versions.version versions.reason versions.createdAt versions.savedBy owner collaborators isPublic")
      .populate("versions.savedBy", "name email");

    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    if (!canRead(doc, req.user._id)) {
      return res.status(403).json({ message: "No access to history." });
    }

    return res.json(
      doc.versions
        .slice()
        .reverse()
        .map((entry) => ({
          id: entry._id,
          version: entry.version,
          reason: entry.reason,
          savedAt: entry.createdAt,
          savedBy: entry.savedBy,
        }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch history." });
  }
};

const toggleStar = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const doc = await Document.findById(id).select("starredBy owner collaborators");
    if (!doc) return res.status(404).json({ message: "Document not found." });
    if (!canRead(doc, userId)) return res.status(403).json({ message: "No access." });

    const isStarred = doc.starredBy?.includes(userId);
    if (isStarred) {
      await Document.findByIdAndUpdate(id, { $pull: { starredBy: userId } });
    } else {
      await Document.findByIdAndUpdate(id, { $addToSet: { starredBy: userId } });
    }

    return res.json({ starred: !isStarred });
  } catch (error) {
    return res.status(500).json({ message: "Failed to toggle star." });
  }
};

const restoreVersion = async (req, res) => {
  try {
    const { id, versionId } = req.params;

    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found." });
    if (!canEdit(doc, req.user._id)) return res.status(403).json({ message: "No edit access." });

    const vEntry = doc.versions.id(versionId);
    if (!vEntry) return res.status(404).json({ message: "Version not found." });

    const nextVersion = (doc.version || 0) + 1;
    doc.content = vEntry.content;
    doc.version = nextVersion;
    doc.lastEditedBy = req.user._id;
    doc.versions.push({
      content: vEntry.content,
      version: nextVersion,
      savedBy: req.user._id,
      reason: `restored v${vEntry.version}`,
    });

    if (doc.versions.length > 50) doc.versions = doc.versions.slice(-50);
    await doc.save();

    return res.json({ message: "Version restored.", version: nextVersion, content: doc.content });
  } catch (error) {
    return res.status(500).json({ message: "Failed to restore version." });
  }
};

module.exports = {
  listDocuments,
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  updatePermissions,
  createShareLink,
  getInviteDetails,
  acceptInviteLink,
  addComment,
  resolveComment,
  getHistory,
  toggleStar,
  restoreVersion,
};
