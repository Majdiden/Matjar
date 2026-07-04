/**
 * Repository for WebAuthn passkey credentials. All operations go through the
 * tenant-scoped `models` object (createScopedModels), so tenantId injection
 * is automatic — controllers never touch Mongoose directly.
 */

export const listCredentialsByUserRepo = (models, userId) =>
  models.WebauthnCredential.find({ user: userId }).lean();

export const findCredentialByIdRepo = (models, credentialID) =>
  models.WebauthnCredential.findOne({ credentialID }).lean();

export const findUserCredentialRepo = (models, userId, credentialID) =>
  models.WebauthnCredential.findOne({ user: userId, credentialID }).lean();

export const createCredentialRepo = (models, data) =>
  models.WebauthnCredential.create(data);

export const updateCredentialCounterRepo = (models, credentialID, counter) =>
  models.WebauthnCredential.updateOne(
    { credentialID },
    { $set: { counter, lastUsedAt: new Date() } }
  );

export const deleteCredentialRepo = (models, userId, credentialID) =>
  models.WebauthnCredential.deleteOne({ user: userId, credentialID });

// Delete by the credential's Mongo _id (used by the dashboard Security page,
// which lists passkeys by _id and never exposes the raw base64url credentialID
// in a URL). Scoped to `userId` so a user can only remove their OWN passkeys.
export const deleteCredentialByIdRepo = (models, userId, id) =>
  models.WebauthnCredential.deleteOne({ user: userId, _id: id });

export const countCredentialsByUserRepo = (models, userId) =>
  models.WebauthnCredential.countDocuments({ user: userId });
