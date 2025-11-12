import express from "express";
import { loginTenant, logoutTenant, sendMessage, sendFile, loginStatus, cancelLogin } from "../controllers/whatsapp.controller.js";

const router = express.Router();

router.post("/login", loginTenant);
router.post("/login/status", loginStatus);
router.post("/login/cancel", cancelLogin);
router.post("/logout", logoutTenant);
router.post("/send", sendMessage);
router.post("/send-file", sendFile);

export default router;
