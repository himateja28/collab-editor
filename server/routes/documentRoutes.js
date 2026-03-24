const express = require("express");
const auth = require("../middleware/auth");
const {
  addComment,
  createDocument,
  createShareLink,
  deleteDocument,
  acceptInviteLink,
  getDocument,
  getHistory,
  getInviteDetails,
  listDocuments,
  resolveComment,
  updateDocument,
  updatePermissions,
} = require("../controllers/documentController");

const router = express.Router();

router.use(auth);

router.get("/", listDocuments);
router.post("/", createDocument);
router.get("/:id", getDocument);
router.put("/:id", updateDocument);
router.delete("/:id", deleteDocument);
router.patch("/:id/permissions", updatePermissions);
router.post("/:id/share-link", createShareLink);
router.get("/invite/:token", getInviteDetails);
router.post("/invite/:token/accept", acceptInviteLink);
router.get("/:id/history", getHistory);
router.post("/:id/comments", addComment);
router.patch("/:id/comments/:commentId/resolve", resolveComment);

module.exports = router;
