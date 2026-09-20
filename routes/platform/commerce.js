import { Router } from "express";
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  listOrdersSchema,
  listProductsSchema,
  listCustomersSchema,
  listInventorySchema,
} from "../../validators/commerce.validator.js";
import {
  listOrders,
  getOrder,
  listProducts,
  getProduct,
  listTenantCustomers,
  listInventoryRows,
} from "../../controllers/platform/commerce.js";

// Cross-store commerce inspection. Mounted at /api/platform/commerce behind
// platformAuthenticate. Read-only: no mutation routes exist here by design
// (archive doc §11: "inspect without editing").
const router = Router({ mergeParams: true });
router.use(requireScope(PLATFORM_SCOPES.SUPPORT_READ));

router.get("/orders", validate(listOrdersSchema), listOrders);
router.get("/orders/:tenantId/:orderId", validateObjectId("tenantId", "orderId"), getOrder);
router.get("/products", validate(listProductsSchema), listProducts);
router.get("/products/:tenantId/:productId", validateObjectId("tenantId", "productId"), getProduct);
// Customers are tenant-scoped only (tenantId is mandatory in the schema).
router.get("/customers", validate(listCustomersSchema), listTenantCustomers);
router.get("/inventory", validate(listInventorySchema), listInventoryRows);

export default router;
