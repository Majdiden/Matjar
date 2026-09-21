/**
 * Customer-privacy operations (right-to-erasure / GDPR Article 17).
 *
 * `anonymizeCustomer` replaces PII on the User row and denormalized
 * copies in Orders with deterministic placeholder values. We do not
 * delete orders because financial records are typically subject to
 * tax-retention laws (5–10 years depending on jurisdiction).
 *
 * `exportCustomer` returns a plain-JSON dump of everything we store
 * about a customer (Article 15 / access request). Callers wrap this
 * in a signed-URL download or email it.
 */

const REDACTED_EMAIL = (id) => `redacted+${String(id).slice(-8)}@anonymous.invalid`;
const REDACTED_NAME = "Redacted Customer";
const REDACTED_PHONE = "REDACTED";
const EXPORTED_USER_FIELDS = [
  "_id", "name", "firstName", "lastName", "email", "phone", "phoneCountry",
  "addresses", "language", "acceptsMarketing", "tags", "isActive",
  "createdAt", "updatedAt", "lastLoginAt", "anonymizedAt",
];

export async function anonymizeCustomer(models, userId) {
  const user = await models.User.findById(userId);
  if (!user) throw new Error("User not found");

  const replacement = {
    name: REDACTED_NAME,
    firstName: REDACTED_NAME,
    lastName: "",
    email: REDACTED_EMAIL(user._id),
    phone: REDACTED_PHONE,
    addresses: [],
    password: null,
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    isActive: false,
    anonymizedAt: new Date(),
  };
  // Bump tokenVersion to kill any live sessions for this user.
  if (typeof user.tokenVersion === "number") replacement.tokenVersion = user.tokenVersion + 1;

  Object.assign(user, replacement);
  await user.save({ validateBeforeSave: false });

  // Update denormalized PII on orders — keep totals/line items/city/country
  // for accounting and stats but strip the customer-identifying fields.
  // Orders/reviews/carts/wishlists reference the customer as `user`.
  if (models.Order) {
    const nameSet = (prefix) => ({
      [`${prefix}.firstName`]: replacement.name,
      [`${prefix}.lastName`]: "",
      [`${prefix}.phone`]: replacement.phone,
    });
    const addressSet = (prefix) => ({
      ...nameSet(prefix),
      [`${prefix}.addressLine1`]: REDACTED_NAME,
      [`${prefix}.addressLine2`]: "",
      [`${prefix}.deliveryInstructions`]: "",
    });
    await models.Order.updateMany(
      { user: user._id },
      {
        $set: {
          ...nameSet("customerSnapshot"),
          "customerSnapshot.email": replacement.email,
          ...nameSet("guestCustomer"),
          "guestCustomer.email": replacement.email,
          ...addressSet("shippingAddress"),
          ...addressSet("billingAddress"),
          // Customer-typed checkout note and manual-transfer details (sender
          // name/phone/reference) are free text the customer wrote.
          notes: "",
          paymentDetails: {},
        },
      }
    );
  }
  // Reviews carry free text the customer wrote; keep the rating, drop the words.
  if (models.Review) {
    await models.Review.updateMany({ user: user._id }, { $set: { title: "", comment: "" } });
  }
  if (models.Cart) await models.Cart.deleteMany({ user: user._id });
  if (models.Wishlist) await models.Wishlist.deleteMany({ user: user._id });
  // Device bindings: push endpoints and passkeys identify the person's devices.
  if (models.PushSubscription) await models.PushSubscription.deleteMany({ user: user._id });
  if (models.WebauthnCredential) await models.WebauthnCredential.deleteMany({ user: user._id });

  return { userId: String(user._id), anonymizedAt: replacement.anonymizedAt };
}

export async function exportCustomer(models, userId) {
  const user = await models.User.findById(userId).lean();
  if (!user) throw new Error("User not found");
  const [orders, reviews, wishlist, carts] = await Promise.all([
    // Merchant-internal notes and staff names are not the customer's data.
    models.Order
      ? models.Order.find({ user: userId })
          .select("-internalNotes -history -fulfillments.history -fulfillments.notes -returns.notes -returns.history")
          .lean()
      : [],
    models.Review ? models.Review.find({ user: userId }).lean() : [],
    models.Wishlist ? models.Wishlist.find({ user: userId }).lean() : [],
    models.Cart ? models.Cart.find({ user: userId }).lean() : [],
  ]);
  // Explicit allow-list: the data subject gets their profile, never
  // credentials, token hashes, session counters or role assignments.
  const publicUser = Object.fromEntries(
    EXPORTED_USER_FIELDS.filter((k) => user[k] !== undefined).map((k) => [k, user[k]])
  );
  return {
    exportedAt: new Date(),
    user: publicUser,
    orders,
    reviews,
    wishlist,
    carts,
  };
}
