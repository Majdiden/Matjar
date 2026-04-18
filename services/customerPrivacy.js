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
    isActive: false,
    anonymizedAt: new Date(),
  };
  // Bump tokenVersion to kill any live sessions for this user.
  if (typeof user.tokenVersion === "number") replacement.tokenVersion = user.tokenVersion + 1;

  Object.assign(user, replacement);
  await user.save({ validateBeforeSave: false });

  // Update denormalized PII on orders — keep totals/line items for
  // accounting but strip the customer-identifying fields.
  if (models.Order) {
    await models.Order.updateMany(
      { userId: user._id },
      {
        $set: {
          "customer.email": replacement.email,
          "customer.name": replacement.name,
          "customer.phone": replacement.phone,
          "shippingAddress.firstName": replacement.name,
          "shippingAddress.lastName": "",
          "shippingAddress.phone": replacement.phone,
          "billingAddress.firstName": replacement.name,
          "billingAddress.lastName": "",
          "billingAddress.phone": replacement.phone,
        },
      }
    );
  }

  return { userId: String(user._id), anonymizedAt: replacement.anonymizedAt };
}

export async function exportCustomer(models, userId) {
  const user = await models.User.findById(userId).lean();
  if (!user) throw new Error("User not found");
  const [orders, reviews, wishlist, carts] = await Promise.all([
    models.Order ? models.Order.find({ userId }).lean() : [],
    models.Review ? models.Review.find({ userId }).lean() : [],
    models.Wishlist ? models.Wishlist.find({ userId }).lean() : [],
    models.Cart ? models.Cart.find({ userId }).lean() : [],
  ]);
  const { password, ...publicUser } = user;
  return {
    exportedAt: new Date(),
    user: publicUser,
    orders,
    reviews,
    wishlist,
    carts,
  };
}
