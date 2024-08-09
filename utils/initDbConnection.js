import mongoose from "mongoose";
import tenantSchema from "../schemas/tenant.js";
import tenantUserSchema from "../schemas/tenantUser.js";
import userSchema from "../schemas/store/user.js";
import productSchema from "../schemas/store/product.js";
import categorySchema from "../schemas/store/category.js";
import orderSchema from "../schemas/store/order.js";
import inventorySchema from "../schemas/store/inventory.js";
import cartSchema from "../schemas/store/cart.js";
import currencySchema from "../schemas/store/currency.js";
import wishlistSchema from "../schemas/store/wishlist.js";
import productI18nSchema from "../schemas/store/productI18n.js";
import reviewSchema from "../schemas/store/review.js";
import supportTicketSchema from "../schemas/store/supportTicket.js";
import promotionSchema from "../schemas/store/promotion.js";
import analyticsSchema from "../schemas/store/analytics.js";
import subscriptionSchema from "../schemas/subscription.js";

const clientOptions = {
  socketTimeoutMS: 30000,
  useNewUrlParser: true,
  useUnifiedTopology: true,
};
mongoose.set("debug", true);
const initAdminDbConnection = async (DB_URL) => {
  try {
    const db = mongoose.createConnection(DB_URL, clientOptions);
    db.on("error", (error) => {
      console.log("Admin db error: ", error);
    });
    db.once("open", () => {
      console.log("Admin DB connected successfully");
    });
    await db.model("Tenant", tenantSchema);
    await db.model("TenantUser", tenantUserSchema);
    await db.model("Subscription", subscriptionSchema);
    return db;
  } catch (error) {
    console.error(error);
    return error;
  }
};

const initTenantDbConnection = async (DB_URL, dbName) => {
  try {
    const db = mongoose.createConnection(DB_URL, clientOptions);
    db.on("error", (error) => {
      console.log(`Tenant ${dbName} db error: `, error);
    });
    db.once("open", () => {
      console.log(`Tenant connection for ${dbName} MongoDB Connection ok!`);
    });

    await db.model("User", userSchema);
    await db.model("Product", productSchema);
    await db.model("Category", categorySchema);
    await db.model("Order", orderSchema);
    await db.model("Inventory", inventorySchema);
    await db.model("Cart", cartSchema);
    await db.model("Currency", currencySchema);
    await db.model("Wishlist", wishlistSchema);
    await db.model("ProductI18n", productI18nSchema);
    await db.model("Review", reviewSchema);
    await db.model("SupportTicket", supportTicketSchema);
    await db.model("Promotion", promotionSchema);
    await db.model("Analytics", analyticsSchema);
    return db;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export { initAdminDbConnection, initTenantDbConnection };
