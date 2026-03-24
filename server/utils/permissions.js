const isOwner = (document, userId) => String(document.owner) === String(userId);

const getRole = (document, userId) => {
  if (isOwner(document, userId)) return "owner";

  const collaborator = document.collaborators.find(
    (entry) => String(entry.user) === String(userId)
  );

  return collaborator?.role || null;
};

const canRead = (document, userId) => {
  if (document.isPublic) return true;
  return Boolean(getRole(document, userId));
};

const canEdit = (document, userId) => {
  const role = getRole(document, userId);
  return role === "owner" || role === "editor";
};

module.exports = {
  canEdit,
  canRead,
  getRole,
  isOwner,
};
