import { runMudslideCommand, getLoginProcessStatus, cancelLoginProcess } from "../services/mudslide.service.js";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

export const loginStatus = async (req, res) => {
    try {
        const { tenant, branchId } = req.body;
        if (!tenant) return res.status(400).json({ error: "Missing tenant" });
        if (!branchId) return res.status(400).json({ error: "Missing branchId" });

        const status = await getLoginProcessStatus(tenant, branchId);
        
        if (!status) {
            return res.json({
                success: false,
                message: `Login process bulunamadı ve bağlantı kurulmamış, ${tenant}/${branchId} için.`,
                status: "not_connected",
                tenant: tenant,
                branchId: branchId,
                note: "Login process başlatmak için /login endpoint'ini kullanın."
            });
        }

        let qrAsciiArtBase64 = null;
        if (status.qrAsciiArt) {
            qrAsciiArtBase64 = Buffer.from(status.qrAsciiArt).toString('base64');
        }

        return res.json({
            success: true,
            message: `Login process durumu: ${status.status}`,
            status: status.status, 
            qrCode: status.qrCode,
            qrAsciiArt: status.qrAsciiArt,
            qrAsciiArtBase64: qrAsciiArtBase64,
            isRunning: status.isRunning,
            startTime: status.startTime,
            output: status.output,
            isFromCache: status.isFromCache || false, 
            tenant: tenant,
            branchId: branchId
        });
    } catch (err) {
        console.error("Login status error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const cancelLogin = async (req, res) => {
    try {
        const { tenant, branchId } = req.body;
        if (!tenant) return res.status(400).json({ error: "Missing tenant" });
        if (!branchId) return res.status(400).json({ error: "Missing branchId" });

        const cancelled = cancelLoginProcess(tenant, branchId);
        
        if (cancelled) {
            return res.json({
                success: true,
                message: `Login process iptal edildi, ${tenant}/${branchId} için.`,
                tenant: tenant,
                branchId: branchId
            });
        } else {
            return res.json({
                success: false,
                message: `Aktif login process bulunamadı, ${tenant}/${branchId} için.`,
                tenant: tenant,
                branchId: branchId
            });
        }
    } catch (err) {
        console.error("Cancel login error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const loginTenant = async (req, res) => {
    try {
        const { tenant, branchId } = req.body;
        if (!tenant) return res.status(400).json({ error: "Missing tenant" });
        if (!branchId) return res.status(400).json({ error: "Missing branchId" });


        const loginResult = await runMudslideCommand(tenant, branchId, ["login"]);

        const { output, qrCode, qrAsciiArt, status, isExisting } = loginResult;

        let qrAsciiArtBase64 = null;
        if (qrAsciiArt) {
            qrAsciiArtBase64 = Buffer.from(qrAsciiArt).toString('base64');
        }

        if (status === "error") {
            const outputLower = (output || "").toLowerCase();
            const isDisconnected = outputLower.includes('disconnected') || 
                                  outputLower.includes('device was disconnected') ||
                                  outputLower.includes('use "logout" command') ||
                                  outputLower.includes('logout command first');
            
            return res.status(400).json({
                success: false,
                message: isDisconnected 
                    ? `Cihaz bağlantısı kesilmiş, ${tenant}/${branchId} için. Önce logout yapmanız gerekiyor.`
                    : `Login işlemi başarısız, ${tenant}/${branchId} için.`,
                status: status,
                error: "login_failed",
                output: output ? output.substring(0, 1000) : "No output",
                tenant: tenant,
                branchId: branchId,
                solution: isDisconnected ? {
                    step1: "Call POST /api/whatsapp/logout with tenant and branchId",
                    step2: "Wait for logout to complete",
                    step3: "Then call POST /api/whatsapp/login again"
                } : {
                    step1: "Check the output for error details",
                    step2: "Ensure credentials are valid",
                    step3: "Try logging in again"
                }
            });
        }

        if (qrCode) {
            return res.json({
                success: true,
                message: `QR oluşturuldu, ${tenant}/${branchId} için login başlatıldı. Process arka planda çalışmaya devam ediyor.`,
                qrCode: qrCode,
                qrAsciiArt: qrAsciiArt,
                qrAsciiArtBase64: qrAsciiArtBase64,
                status: status, 
                tenant: tenant,
                branchId: branchId,
                isExisting: isExisting, 
                note: "QR kodunu okutun. Process arka planda çalışmaya devam edecek ve bağlantı kurulduğunda otomatik olarak tamamlanacak."
            });
        }

        if (status === "qr_ready" && qrAsciiArt) {
            
            return res.json({
                success: true,
                message: `QR kod hazır, ${tenant}/${branchId} için login başlatıldı. ASCII art QR kod aşağıda. Process arka planda çalışmaya devam ediyor.`,
                qrCode: qrCode,
                qrAsciiArt: qrAsciiArt,
                qrAsciiArtBase64: qrAsciiArtBase64, 
                status: status,
                tenant: tenant,
                branchId: branchId,
                isExisting: isExisting,
                note: "ASCII art QR kodunu terminal'de görüntüleyin veya bir QR code reader ile okutun. Process arka planda çalışmaya devam edecek ve bağlantı kurulduğunda otomatik olarak tamamlanacak."
            });
        }

        if (status === "waiting") {
            return res.json({
                success: true,
                message: `Login process başlatıldı, ${tenant}/${branchId} için. QR kodu bekleniyor...`,
                status: status,
                qrCode: qrCode,
                qrAsciiArt: qrAsciiArt,
                qrAsciiArtBase64: qrAsciiArtBase64,
                tenant: tenant,
                branchId: branchId,
                isExisting: isExisting,
                note: "QR kodu henüz hazır değil. Lütfen /status endpoint'ini kullanarak durumu kontrol edin."
            });
        }

        if (status === "qr_ready") {
            
            let asciiQR = qrAsciiArt;

            if (!asciiQR && output) {
                asciiQR = extractASCIIQRFromOutput(output);
            }

            if (asciiQR) {
                const qrAsciiArtBase64FromExtract = Buffer.from(asciiQR).toString('base64');
                
                return res.json({
                    success: true,
                    message: `QR kod hazır, ${tenant}/${branchId} için login başlatıldı. ASCII art QR kod aşağıda. Process arka planda çalışmaya devam ediyor.`,
                    qrCode: qrCode,
                    qrAsciiArt: asciiQR, 
                    qrAsciiArtBase64: qrAsciiArtBase64FromExtract, 
                    status: status,
                    tenant: tenant,
                    branchId: branchId,
                    isExisting: isExisting,
                    note: "ASCII art QR kodunu terminal'de görüntüleyin veya bir QR code reader ile okutun. Process arka planda çalışmaya devam edecek ve bağlantı kurulduğunda otomatik olarak tamamlanacak."
                });
            }
        }

        console.warn(`QR code not found in output for ${tenant}/${branchId}, status: ${status}`);

        
        res.json({ 
            success: false, 
            message: `QR kodu bulunamadı, ${tenant}/${branchId} için. Status: ${status}`, 
            status: status,
            log: output ? output.substring(0, 2000) : "No output",
            qrCode: qrCode,
            qrAsciiArt: qrAsciiArt,
            qrAsciiArtBase64: qrAsciiArtBase64,
            tenant: tenant,
            branchId: branchId,
            note: "Output'u kontrol edin veya /status endpoint'ini kullanarak durumu kontrol edin.",
            debug: {
                outputLength: output ? output.length : 0,
                hasQRChars: output ? (output.includes('▄') || output.includes('█')) : false,
                qrAsciiArtLines: qrAsciiArt ? qrAsciiArt.split('\n').length : 0
            }
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
};

export const logoutTenant = async (req, res) => {
    try {
        const { tenant, branchId } = req.body;
        if (!tenant) return res.status(400).json({ error: "Missing tenant" });
        if (!branchId) return res.status(400).json({ error: "Missing branchId" });

        const output = await runMudslideCommand(tenant, branchId, ["logout"]);
        res.json({ 
            success: true, 
            message: `Logout done for ${tenant}/${branchId}`, 
            log: output 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const sendMessage = async (req, res) => {
    
    const { tenant, branchId, phone, message } = req.body || {};
    
    try {
        if (!tenant) return res.status(400).json({ error: "Missing tenant" });
        if (!branchId) return res.status(400).json({ error: "Missing branchId" });
        if (!phone) return res.status(400).json({ error: "Missing phone" });
        if (!message) return res.status(400).json({ error: "Missing message" });

   

        const output = await runMudslideCommand(tenant, branchId, ["send", phone, message]);
        

        const outputStr = output || "";
        const outputLower = outputStr.toLowerCase();

        const messageSendDetected = outputStr.includes("Sending message:") || 
                                     outputStr.includes("awaiting  Sending message");

        const hasConflict = outputLower.includes("conflict") || outputLower.includes("replaced");

        const hasExplicitSuccess = outputStr.includes("✔  success") || 
                                   outputStr.includes("✔ success") ||
                                   outputStr.includes("success   Done") ||
                                   (outputStr.includes("success") && outputStr.includes("Done"));

        const hasStreamError = outputStr.includes("stream errored out") || 
                              outputStr.includes("stream errored") ||
                              outputStr.includes("connection errored");

        const hasCriticalError = (outputLower.includes("not connected") ||
                                  outputLower.includes("not authenticated") ||
                                  outputLower.includes("unauthorized") ||
                                  outputLower.includes("failed to send") ||
                                  outputLower.includes("could not send") ||
                                  outputLower.includes("not logged in") ||
                                  (hasConflict && messageSendDetected && hasStreamError) || 
                                  (outputLower.includes("error") && 
                                   !messageSendDetected && 
                                   !hasStreamError)); 

        const streamErrorAfterMessage = messageSendDetected && hasStreamError;
        const conflictDetected = hasConflict && streamErrorAfterMessage;

        if (conflictDetected) {


            if (hasExplicitSuccess) {
                return res.json({ 
                    success: true, 
                    message: `Message sent to ${phone} (despite conflict)`, 
                    log: output,
                    tenant: tenant,
                    branchId: branchId,
                    note: "Message send detected with conflict error, but explicit success message found. Message was likely sent."
                });
            } else {
                return res.status(500).json({ 
                    success: false,
                    error: "Message send failed due to conflict",
                    message: `Failed to send message to ${phone} - another device is connected to the same WhatsApp account`,
                    log: output,
                    tenant: tenant,
                    branchId: branchId,
                    conflict: true,
                    solution: {
                        step1: "Disconnect other devices from WhatsApp (Settings > Connected Devices)",
                        step2: "Wait a few seconds",
                        step3: "Try sending the message again"
                    },
                    note: "A conflict error occurred, which means another device is connected to the same WhatsApp account. The message was likely not sent. Please disconnect other devices and try again."
                });
            }
        }

        if (messageSendDetected && hasExplicitSuccess) {
            return res.json({ 
                success: true, 
                message: `Message sent to ${phone}`, 
                log: output,
                tenant: tenant,
                branchId: branchId,
                note: streamErrorAfterMessage 
                    ? "Message send detected with explicit success. Stream error occurred after message was sent, but message delivery was successful." 
                    : "Message send detected with explicit success message."
            });
        }

        if (messageSendDetected && !hasExplicitSuccess) {
            if (streamErrorAfterMessage && !hasConflict) {
                return res.json({ 
                    success: true, 
                    message: `Message sent to ${phone}`, 
                    log: output,
                    tenant: tenant,
                    branchId: branchId,
                    note: "Message send detected. Stream error occurred after message was sent (no conflict detected), but message delivery was likely successful."
                });
            } else {
                return res.json({ 
                    success: false, 
                    message: `Message send attempted to ${phone} but delivery status uncertain`, 
                    log: output,
                    tenant: tenant,
                    branchId: branchId,
                    note: "Message send was detected but no explicit success message was found. The message may or may not have been sent. Please check the recipient's WhatsApp."
                });
            }
        }

        if (hasExplicitSuccess) {
            return res.json({ 
                success: true, 
                message: `Message sent to ${phone}`, 
                log: output,
                tenant: tenant,
                branchId: branchId,
                note: streamErrorAfterMessage 
                    ? "Explicit success message found. Stream error occurred after message was sent, but message delivery was successful." 
                    : "Explicit success message found."
            });
        }

        if (hasCriticalError) {
            return res.status(500).json({ 
                success: false,
                error: "Message send failed",
                message: `Failed to send message to ${phone}`,
                log: output,
                tenant: tenant,
                branchId: branchId
            });
        }

        res.json({ 
            success: true, 
            message: `Message sent to ${phone}`, 
            log: output,
            tenant: tenant,
            branchId: branchId,
            note: "No explicit success indicator found, but service layer returned successfully (message may have been sent)"
        });
    } catch (err) {
        console.error("❌ Send message error:", err);

        const errorMessage = err.message || "";
        const isConnectionError = errorMessage.includes("not established") || 
                                 errorMessage.includes("login first") ||
                                 errorMessage.includes("credentials") ||
                                 errorMessage.includes("not logged in");
        
            if (isConnectionError) {
                
                let credsStatus = "unknown";
                try {
                    const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../whatsapp", tenant || "unknown", String(branchId || "unknown"));
                    const credsPath = path.join(cacheDir, "creds.json");
                    try {
                        await fs.access(credsPath);
                        const credsContent = await fs.readFile(credsPath, 'utf-8');
                        if (credsContent && credsContent.trim().length > 0) {
                            credsStatus = "valid";
                        } else {
                            credsStatus = "empty";
                        }
                    } catch (accessError) {
                        credsStatus = "missing";
                    }
                } catch (checkError) {
                    
                }
                
                const isAfterLogout = errorMessage.includes("after logout") || 
                                     errorMessage.includes("This may happen after logout");
                
                let detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. Please login first using the /login endpoint.`;
                let note = undefined;
                
                if (credsStatus === "empty") {
                    if (isAfterLogout) {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. You have logged out, so the creds.json file is empty. Please login again using the /login endpoint and scan the QR code.`;
                        note = "You have logged out, so you need to login again before sending messages. The creds.json file was deleted during logout.";
                    } else {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. The creds.json file is empty, which means the session is invalid. Please login again using the /login endpoint and scan the QR code.`;
                        note = "The creds.json file exists but is empty. This usually means the login process did not complete successfully or you have logged out. Please try logging in again.";
                    }
                } else if (credsStatus === "missing") {
                    if (isAfterLogout) {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. You have logged out, so the creds.json file does not exist. Please login again using the /login endpoint and scan the QR code.`;
                        note = "You have logged out, so you need to login again before sending messages. The creds.json file was deleted during logout.";
                    } else {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. The creds.json file is missing. Please login first using the /login endpoint and scan the QR code.`;
                        note = "The creds.json file does not exist. Please login first using the /login endpoint.";
                    }
                }
                
                return res.status(400).json({ 
                    success: false,
                    error: "Connection not established",
                    message: detailedMessage,
                    tenant: tenant || null,
                    branchId: branchId || null,
                    credsStatus: credsStatus,
                    isAfterLogout: isAfterLogout,
                    solution: {
                        step1: "Call POST /api/whatsapp/login with tenant and branchId",
                        step2: "Scan the QR code with WhatsApp",
                        step3: "Wait for connection to be established (creds.json file should be populated)",
                        step4: "Check status with POST /api/whatsapp/login/status",
                        step5: "Then try sending messages again"
                    },
                    note: note
                });
            }
        
        res.status(500).json({ 
            success: false,
            error: err.message, 
            stack: err.stack,
            message: `Failed to send message: ${err.message}`,
            tenant: tenant || null,
            branchId: branchId || null
        });
    }
};

export const sendFile = async (req, res) => {
    
    const { tenant, branchId, phone, filePath, caption } = req.body || {};
    
    try {
        if (!tenant) return res.status(400).json({ error: "Missing tenant" });
        if (!branchId) return res.status(400).json({ error: "Missing branchId" });
        if (!phone) return res.status(400).json({ error: "Missing phone" });
        if (!filePath) return res.status(400).json({ error: "Missing filePath" });

        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const projectRoot = path.resolve(__dirname, "../..");
        
        let absoluteFilePath;
        if (path.isAbsolute(filePath)) {
            absoluteFilePath = filePath;
        } else {
            absoluteFilePath = path.resolve(projectRoot, filePath);
        }
        
        
        try {
            await fs.access(absoluteFilePath);
        } catch (accessError) {
            return res.status(400).json({ 
                success: false,
                error: "File not found",
                message: `Dosya bulunamadı: ${absoluteFilePath}`,
                filePath: absoluteFilePath,
                originalPath: filePath,
                note: "Dosya yolunu mutlak yol veya project root'a göre relative yol olarak verin."
            });
        }
        
        const fileStats = await fs.stat(absoluteFilePath);
        if (!fileStats.isFile()) {
            console.error(`❌ Not a file: ${absoluteFilePath}`);
            return res.status(400).json({ 
                success: false,
                error: "Not a file",
                message: `Belirtilen yol bir dosya değil: ${absoluteFilePath}`,
                filePath: absoluteFilePath
            });
        }
        

        const args = ["send-file", phone, absoluteFilePath];
        if (caption) {
            args.push("--caption", caption);
        }

        
        const output = await runMudslideCommand(tenant, branchId, args);
        
        
        res.json({ 
            success: true, 
            message: `File sent to ${phone}`, 
            log: output,
            filePath: absoluteFilePath,
            fileSize: fileStats.size,
            tenant: tenant,
            branchId: branchId
        });
    } catch (err) {
        console.error("❌ Send file error:", err);

            const errorMessage = err.message || "";
            const isConnectionError = errorMessage.includes("not established") || 
                                     errorMessage.includes("login first") ||
                                     errorMessage.includes("credentials") ||
                                     errorMessage.includes("not logged in");
            
            if (isConnectionError) {
                
                let credsStatus = "unknown";
                try {
                    const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../whatsapp", tenant || "unknown", String(branchId || "unknown"));
                    const credsPath = path.join(cacheDir, "creds.json");
                    try {
                        await fs.access(credsPath);
                        const credsContent = await fs.readFile(credsPath, 'utf-8');
                        if (credsContent && credsContent.trim().length > 0) {
                            credsStatus = "valid";
                        } else {
                            credsStatus = "empty";
                        }
                    } catch (accessError) {
                        credsStatus = "missing";
                    }
                } catch (checkError) {
                    
                }
                
                const isAfterLogout = errorMessage.includes("after logout") || 
                                     errorMessage.includes("This may happen after logout");
                
                let detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. Please login first using the /login endpoint.`;
                let note = undefined;
                
                if (credsStatus === "empty") {
                    if (isAfterLogout) {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. You have logged out, so the creds.json file is empty. Please login again using the /login endpoint and scan the QR code.`;
                        note = "You have logged out, so you need to login again before sending files. The creds.json file was deleted during logout.";
                    } else {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. The creds.json file is empty, which means the session is invalid. Please login again using the /login endpoint and scan the QR code.`;
                        note = "The creds.json file exists but is empty. This usually means the login process did not complete successfully or you have logged out. Please try logging in again.";
                    }
                } else if (credsStatus === "missing") {
                    if (isAfterLogout) {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. You have logged out, so the creds.json file does not exist. Please login again using the /login endpoint and scan the QR code.`;
                        note = "You have logged out, so you need to login again before sending files. The creds.json file was deleted during logout.";
                    } else {
                        detailedMessage = `WhatsApp connection is not established${tenant && branchId ? ` for ${tenant}/${branchId}` : ''}. The creds.json file is missing. Please login first using the /login endpoint and scan the QR code.`;
                        note = "The creds.json file does not exist. Please login first using the /login endpoint.";
                    }
                }
                
                return res.status(400).json({ 
                    success: false,
                    error: "Connection not established",
                    message: detailedMessage,
                    tenant: tenant || null,
                    branchId: branchId || null,
                    credsStatus: credsStatus,
                    isAfterLogout: isAfterLogout,
                    solution: {
                        step1: "Call POST /api/whatsapp/login with tenant and branchId",
                        step2: "Scan the QR code with WhatsApp",
                        step3: "Wait for connection to be established (creds.json file should be populated)",
                        step4: "Check status with POST /api/whatsapp/login/status",
                        step5: "Then try sending files again"
                    },
                    note: note
                });
            }
        
        res.status(500).json({ 
            success: false,
            error: err.message, 
            stack: err.stack,
            message: `Failed to send file: ${err.message}`,
            tenant: tenant || null,
            branchId: branchId || null
        });
    }
};

