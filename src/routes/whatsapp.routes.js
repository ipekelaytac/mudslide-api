import express from "express";
import { loginTenant, logoutTenant, sendMessage, sendFile, loginStatus, cancelLogin } from "../controllers/whatsapp.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/whatsapp/login:
 *   post:
 *     summary: WhatsApp login işlemini başlatır ve QR kod döner
 *     tags: [WhatsApp]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login process başlatıldı, QR kod hazır
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Hatalı istek veya login hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.post("/login", loginTenant);

/**
 * @swagger
 * /api/whatsapp/login/status:
 *   post:
 *     summary: Login process durumunu kontrol eder
 *     tags: [WhatsApp]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginStatusRequest'
 *     responses:
 *       200:
 *         description: Login durumu bilgisi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginStatusResponse'
 *       400:
 *         description: Hatalı istek
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.post("/login/status", loginStatus);

/**
 * @swagger
 * /api/whatsapp/login/cancel:
 *   post:
 *     summary: Devam eden login process'ini iptal eder
 *     tags: [WhatsApp]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelLoginRequest'
 *     responses:
 *       200:
 *         description: Login iptal edildi veya aktif process yok
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CancelLoginResponse'
 *       400:
 *         description: Hatalı istek
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.post("/login/cancel", cancelLogin);

/**
 * @swagger
 * /api/whatsapp/logout:
 *   post:
 *     summary: WhatsApp bağlantısını keser ve creds.json dosyasını siler
 *     tags: [WhatsApp]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutRequest'
 *     responses:
 *       200:
 *         description: Logout başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogoutResponse'
 *       400:
 *         description: Hatalı istek
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.post("/logout", logoutTenant);

/**
 * @swagger
 * /api/whatsapp/send:
 *   post:
 *     summary: WhatsApp üzerinden mesaj gönderir
 *     tags: [WhatsApp]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       200:
 *         description: Mesaj başarıyla gönderildi (veya gönderim durumu belirsiz)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SendMessageResponse'
 *       400:
 *         description: Hatalı istek veya bağlantı kurulmamış
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Mesaj gönderim hatası veya conflict hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SendMessageResponse'
 */
router.post("/send", sendMessage);

/**
 * @swagger
 * /api/whatsapp/send-file:
 *   post:
 *     summary: WhatsApp üzerinden dosya gönderir
 *     tags: [WhatsApp]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendFileRequest'
 *     responses:
 *       200:
 *         description: Dosya başarıyla gönderildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SendFileResponse'
 *       400:
 *         description: Hatalı istek, dosya bulunamadı veya bağlantı kurulmamış
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Dosya gönderim hatası
 */
router.post("/send-file", sendFile);

export default router;
