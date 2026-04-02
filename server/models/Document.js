const mongoose = require("mongoose");

const collaboratorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["editor", "viewer"],
      default: "viewer",
    },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    range: {
      index: Number,
      length: Number,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const versionSchema = new mongoose.Schema(
  {
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reason: {
      type: String,
      default: "autosave",
    },
  },
  { timestamps: true }
);

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        ops: [{ insert: "\n" }],
      },
    },
    version: {
      type: Number,
      default: 0,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collaborators: [collaboratorSchema],
    comments: [commentSchema],
    versions: [versionSchema],
    isPublic: {
      type: Boolean,
      default: false,
    },
    shareToken: {
      type: String,
      default: null,
    },
    inviteRole: {
      type: String,
      enum: ["viewer", "editor"],
      default: "viewer",
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

documentSchema.index({ owner: 1, updatedAt: -1 });
documentSchema.index({ "collaborators.user": 1, updatedAt: -1 });
documentSchema.index({ shareToken: 1 });

module.exports = mongoose.model("Document", documentSchema);
