import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import {
  getCustomersController,
  getCustomerController,
  updateCustomerController,
} from "../controllers/customer.js";

const router = Router();

// Every route here operates on the customer (shopper) domain. Gate on
// named permissions so access is derived from ROLE_PERMISSIONS and
// can't drift if roles change. Note: the controller independently
// filters out staff users — these permissions authorize calling the
// endpoint; the controller guarantees the endpoint can't reach a
// staff account even if a role is accidentally granted.
router.use(authenticate);

router.get("/", requirePermission("customers.read"), getCustomersController);
router.get("/:id", requirePermission("customers.read"), getCustomerController);
router.patch("/:id", requirePermission("customers.write"), updateCustomerController);

export default router;
