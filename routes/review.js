import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import {
  getReviewsController,
  approveReviewController,
  rejectReviewController,
  deleteReviewController,
} from "../controllers/review.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("reviews.read", "reviews.moderate"), getReviewsController);
router.patch("/:id/approve", requirePermission("reviews.moderate"), approveReviewController);
router.patch("/:id/reject", requirePermission("reviews.moderate"), rejectReviewController);
router.delete("/:id", requirePermission("reviews.moderate"), deleteReviewController);

export default router;
