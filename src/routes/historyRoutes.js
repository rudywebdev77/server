import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getProjectHistory,
  getRequestHistory,
} from "../controllers/historyController.js";

const router = express.Router();

router.use(protect);

// Get all activity logs for a project
router.get("/project/:projectId", getProjectHistory);

// Get all activity logs for a request
router.get("/request/:requestId", getRequestHistory);

export default router;