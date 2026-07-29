import express from "express";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

import {
  getProfile,
  updateProfile,
  changePassword,
  uploadProfileImage,
  deleteProfileImage,
} from "../controllers/profileController.js";

const router = express.Router();

router.use(protect);

router.get("/", getProfile);

router.put("/", upload.single("profileImage"), updateProfile);

router.patch("/change-password", changePassword);

router.post(
  "/upload-image",
  upload.single("profileImage"),
  uploadProfileImage
);

router.delete("/delete-image", deleteProfileImage);

export default router;