import { spawn, exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const execAsync = promisify(exec);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const whatsappBaseDir = path.join(__dirname, "../../whatsapp");

const activeLoginProcesses = new Map();

const extractASCIIQR = (output) => {
    if (!output) return null;
    
    const lines = output.split('\n');
    const qrLines = [];
    let inQRBlock = false;
    let qrStartIndex = -1;
    let emptyLineCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        const hasQRChar = line.includes('▄') || 
                         line.includes('█') || 
                         line.includes('▀') ||
                         line.includes('▌') ||
                         line.includes('▐') ||
                         line.includes('▬');
        
        const isQRLike = hasQRChar && (line.trim().length > 25 || line.match(/^[▄█▀▌▐▬\s]+$/));
        
        if (isQRLike) {
            if (!inQRBlock) {
                inQRBlock = true;
                qrStartIndex = i;
                emptyLineCount = 0;
            }
            qrLines.push(line);
        } else if (inQRBlock) {
            if (line.trim().length === 0) {
                emptyLineCount++;
                if (emptyLineCount > 3 && qrLines.length >= 20) {
                    break;
                }
            } else if (line.trim().length < 25 && !hasQRChar) {
                if (qrLines.length >= 25) {
                    break;
                } else if (qrLines.length >= 20) {
                    break;
                }
            } else {
                emptyLineCount = 0;
                if (hasQRChar && line.trim().length > 25) {
                    qrLines.push(line);
                }
            }
        }
    }
    
    if (qrLines.length >= 20) {
        return qrLines.join('\n');
    }
    
    if (qrLines.length >= 15 && qrStartIndex !== -1) {
        return qrLines.join('\n');
    }
    
    if (qrLines.length >= 10 && qrStartIndex !== -1) {
        return qrLines.join('\n');
    }
    
    return null;
};

export const ensureTenantBranchDir = async (tenant, branchId) => {
    const tenantDir = path.join(whatsappBaseDir, tenant);
    const branchDir = path.join(tenantDir, branchId.toString());

    try {
        await fs.mkdir(branchDir, { recursive: true });
        return branchDir;
    } catch (error) {
        throw new Error(`Klasör oluşturulamadı: ${error.message}`);
    }
};

export const runMudslideLogin = async (tenant, branchId, qrWaitTimeout = 300000) => {
    return new Promise(async (resolve, reject) => {
        try {
            const processKey = `${tenant}-${branchId}`;
            
            if (activeLoginProcesses.has(processKey)) {
                const existingProcess = activeLoginProcesses.get(processKey);
                if (existingProcess.process && !existingProcess.process.killed) {
                    return resolve({
                        output: existingProcess.output,
                        qrCode: existingProcess.qrCode || null,
                        qrAsciiArt: existingProcess.qrAsciiArt || null,
                        status: existingProcess.status,
                        isExisting: true
                    });
                } else {
                    activeLoginProcesses.delete(processKey);
                }
            }

            const cacheDir = await ensureTenantBranchDir(tenant, branchId);
            const absoluteCacheDir = path.resolve(cacheDir);

            let output = "";
            let qrDetected = false;
            let qrCode = null;
            let qrAsciiArt = null;
            let status = "waiting";
            let qrResolve = null;
            let qrTimeoutId = null;

            const args = ["-c", absoluteCacheDir, "login"];
            const childProcess = spawn("npx", ["mudslide", ...args], {
                cwd: path.join(__dirname, "../.."),
                env: {
                    ...process.env,
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,
            });
            
            

            activeLoginProcesses.set(processKey, {
                process: childProcess,
                output: output,
                status: status,
                qrCode: null,
                qrAsciiArt: null,
                startTime: Date.now()
            });

            const checkForQR = (data) => {
                const text = data.toString();
                output += text;
                
                const processInfo = activeLoginProcesses.get(processKey);
                if (processInfo) {
                    processInfo.output = output;
                }
                
                if (!qrDetected && (text.includes('█') || text.includes('https://') || text.match(/[▀▄█▌▐▬]/) || text.includes('▄'))) {
                    qrDetected = true;
                    status = "qr_ready";
                    
                    const urlMatch = output.match(/https?:\/\/[^\s]+/);
                    if (urlMatch && urlMatch.length > 0) {
                        qrCode = urlMatch[0];
                    } else {
                        qrAsciiArt = extractASCIIQR(output);
              
                    }
                    
                    if (processInfo) {
                        processInfo.status = status;
                        processInfo.qrCode = qrCode;
                        processInfo.qrAsciiArt = qrAsciiArt;
                    }
                    
                    setTimeout(() => {
                        if (qrResolve) {
                            if (!qrCode && !qrAsciiArt && output) {
                                qrAsciiArt = extractASCIIQR(output);
                                if (qrAsciiArt && processInfo) {
                                    processInfo.qrAsciiArt = qrAsciiArt;
                                }
                            }
                            
                            clearTimeout(qrTimeoutId);
                            
                      
                            
                            qrResolve({
                                output: output,
                                qrCode: qrCode,
                                qrAsciiArt: qrAsciiArt,
                                status: status,
                                isExisting: false
                            });
                            qrResolve = null;
                            
                        }
                    }, 5000);
                }
                
                const textLower = text.toLowerCase();
                const outputLower = output.toLowerCase();
                
                if (textLower.includes('disconnected') || 
                    textLower.includes('device was disconnected') ||
                    textLower.includes('use "logout" command') ||
                    textLower.includes('logout command first') ||
                    (textLower.includes('error') && (textLower.includes('disconnected') || textLower.includes('logout')))) {
                    
                    status = "error";
                    if (processInfo) {
                        processInfo.status = status;
                    }
           
                    
                    setTimeout(() => {
                        if (activeLoginProcesses.has(processKey)) {
                            const processInfo = activeLoginProcesses.get(processKey);
                            processInfo.process = null;
                            processInfo.status = "error";
                        }
                    }, 1000);
                    return;
                }
                
                if (outputLower.includes('✔  success') && outputLower.includes('logged in') ||
                    outputLower.includes('✔ success') && outputLower.includes('logged in') ||
                    outputLower.includes('success   logged in') ||
                    (outputLower.includes('✔') && outputLower.includes('success') && outputLower.includes('logged')) ||
                    (textLower.includes('logged in') && !textLower.includes('device') && !textLower.includes('settings'))) {
                    
                    status = "connected";
                    if (processInfo) {
                        processInfo.status = status;
                    }

                    
                    setTimeout(() => {
                        if (activeLoginProcesses.has(processKey)) {
                            const processInfo = activeLoginProcesses.get(processKey);
                            processInfo.process = null;
                            processInfo.status = "connected";
                        }
                    }, 5000);
                }
            };

            childProcess.stdout.on('data', checkForQR);
            childProcess.stderr.on('data', checkForQR);

            childProcess.on('error', (error) => {
                status = "error";
                if (activeLoginProcesses.has(processKey)) {
                    activeLoginProcesses.get(processKey).status = status;
                }
                activeLoginProcesses.delete(processKey);
                reject(error);
            });

            childProcess.on('close', (code) => {
                
                const outputLower = output.toLowerCase();
                const hasError = outputLower.includes('disconnected') || 
                                outputLower.includes('device was disconnected') ||
                                outputLower.includes('use "logout" command') ||
                                outputLower.includes('logout command first') ||
                                outputLower.includes('✖  error');
                const hasSuccess = outputLower.includes('✔  success') && outputLower.includes('logged in') ||
                                  outputLower.includes('✔ success') && outputLower.includes('logged in') ||
                                  outputLower.includes('success   logged in');
                
                if (hasError) {
                    status = "error";
                } else if (code === 0 && hasSuccess) {
                    status = "connected";
                } else if (code === 0 && !hasError) {
                    if (status === "qr_ready") {
                    } else {
                        status = "error";
                    }
                } else if (code === null) {
                    if (!hasError) {
                        status = hasSuccess ? "connected" : status;
                    } else {
                        status = "error";
                    }
                } else {
                    status = "error";
                }
                
                if (activeLoginProcesses.has(processKey)) {
                    const processInfo = activeLoginProcesses.get(processKey);
                    processInfo.status = status;
                    processInfo.process = null;
                }
                
            });


            new Promise((qrResolveFn) => {
                qrResolve = qrResolveFn;
                
                qrTimeoutId = setTimeout(() => {
                    if (qrResolve) {
                        let finalAsciiArt = qrAsciiArt;
                        if (!qrCode && !finalAsciiArt && output) {
                            finalAsciiArt = extractASCIIQR(output);
                            if (finalAsciiArt && processInfo) {
                                processInfo.qrAsciiArt = finalAsciiArt;
                            }
                        }
                        
                        
                        qrResolve({
                            output: output,
                            qrCode: qrCode,
                            qrAsciiArt: finalAsciiArt,
                            status: (qrDetected || finalAsciiArt) ? "qr_ready" : "waiting",
                            isExisting: false
                        });
                        qrResolve = null;
                        
                    }
                }, qrWaitTimeout);
            }).then((result) => {

                resolve(result);
            }).catch((error) => {
                reject(error);
            });
        } catch (error) {
            reject(error);
        }
    });
};

export const getLoginProcessStatus = async (tenant, branchId) => {
    const processKey = `${tenant}-${branchId}`;
    const processInfo = activeLoginProcesses.get(processKey);
    
    if (processInfo) {
        let finalStatus = processInfo.status;
        if (processInfo.output) {
            const outputLower = processInfo.output.toLowerCase();
            if ((outputLower.includes('logged in') || 
                 outputLower.includes('✔  success') ||
                 outputLower.includes('✔ success') ||
                 outputLower.includes('success   logged in') ||
                 (outputLower.includes('success') && outputLower.includes('logged in'))) &&
                processInfo.status === "qr_ready") {
                finalStatus = "connected";
                processInfo.status = "connected";
    ;
            }
        }
        
        return {
            status: finalStatus,
            qrCode: processInfo.qrCode,
            qrAsciiArt: processInfo.qrAsciiArt,
            output: processInfo.output ? processInfo.output.substring(Math.max(0, processInfo.output.length - 500)) : "",
            isRunning: processInfo.process && !processInfo.process.killed,
            startTime: processInfo.startTime,
            isFromCache: false
        };
    }
    
    try {
        const cacheDir = await ensureTenantBranchDir(tenant, branchId);
        const absoluteCacheDir = path.resolve(cacheDir);
        
        try {
            await fs.access(absoluteCacheDir);
        } catch (accessError) {
            return null;
        }
        
        const credsPath = path.join(absoluteCacheDir, "creds.json");
        
        let hasValidCreds = false;
        let credsContent = null;
        try {
            
            try {
                credsContent = await fs.readFile(credsPath, 'utf-8');
                
                if (credsContent && typeof credsContent === 'string') {
                    const trimmedContent = credsContent.trim();
                    
                    if (trimmedContent.length > 0) {
                        try {
                            const parsedCreds = JSON.parse(credsContent);
                            hasValidCreds = true;
                        } catch (parseError) {
                            hasValidCreds = true;
                        }
                    } else {
                        hasValidCreds = false;
                    }
                } else {
                    hasValidCreds = false;
                }
            } catch (readError) {
                hasValidCreds = false;
            }
            
        } catch (error) {
            hasValidCreds = false;
        }
        
        let hasAppStateFiles = false;
        let appStateFilesCount = 0;
        let allFiles = [];
        
        try {
            allFiles = await fs.readdir(absoluteCacheDir);
            
            if (allFiles.length === 0) {
            } else {
                const sampleFiles = allFiles.slice(0, 10);
                
                const appStateFiles = allFiles.filter(file => 
                    file.startsWith('app-state-sync-key-') && file.endsWith('.json')
                );
                
                appStateFilesCount = appStateFiles.length;
                hasAppStateFiles = appStateFilesCount > 0;
                
                
                if (hasAppStateFiles) {
                    const sampleAppStateFiles = appStateFiles.slice(0, 5);
                } else {
                    const filesWithAppState = allFiles.filter(f => f.includes('app-state'));
                    if (filesWithAppState.length > 0) {
                        hasAppStateFiles = filesWithAppState.length > 0;
                        appStateFilesCount = filesWithAppState.length;
                    }
                }
            }
        } catch (readError) {
            
            try {
                const knownFiles = [
                    'app-state-sync-key-AA4AAKk2.json',
                    'app-state-sync-key-AA8AAKkt.json',
                    'app-state-sync-key-AAAAAKk0.json'
                ];
                
                for (const testFile of knownFiles) {
                    try {
                        const testPath = path.join(absoluteCacheDir, testFile);
                        await fs.access(testPath);
                        hasAppStateFiles = true;
                        appStateFilesCount = 1;
                        break;
                    } catch (e) {
                    }
                }
                
                if (!hasAppStateFiles) {
                    try {
                        const testGlob = path.join(absoluteCacheDir, 'app-state-sync-key-*.json');
                        const testFiles = await fs.readdir(absoluteCacheDir);
                        const appStateTest = testFiles.filter(f => f.includes('app-state') && f.endsWith('.json'));
                        if (appStateTest.length > 0) {
                            hasAppStateFiles = true;
                            appStateFilesCount = appStateTest.length;
                        }
                    } catch (globError) {
                    }
                }
            } catch (altError) {
            }
        }
        
        if (!hasAppStateFiles && !hasValidCreds && allFiles.length === 0) {
            try {
                const testFile = path.join(absoluteCacheDir, 'app-state-sync-key-AA4AAKk2.json');
                try {
                    await fs.access(testFile);
                    hasAppStateFiles = true;
                    appStateFilesCount = 1;
                } catch (testError) {
                    try {
                        const retryFiles = await fs.readdir(absoluteCacheDir);
                        if (retryFiles.length > 0) {
                            const retryAppState = retryFiles.filter(f => f.includes('app-state') && f.endsWith('.json'));
                            if (retryAppState.length > 0) {
                                hasAppStateFiles = true;
                                appStateFilesCount = retryAppState.length;
                                allFiles = retryFiles;
                            }
                        }
                    } catch (retryError) {
                    }
                }
            } catch (directError) {
            }
        }
        

        
        if (hasValidCreds === true) {
            const reason = hasAppStateFiles 
                ? `credentials file found with content and app-state-sync-key files found (${appStateFilesCount} files)`
                : "credentials file found with content";
            const result = {
                status: "connected",
                qrCode: null,
                qrAsciiArt: null,
                output: `Connection established (${reason})`,
                isRunning: false,
                startTime: null,
                isFromCache: true
            };
            return result;
        } else {
        
            return null;
        }
    } catch (error) {
        return null;
    }
};

export const cancelLoginProcess = (tenant, branchId) => {
    const processKey = `${tenant}-${branchId}`;
    const processInfo = activeLoginProcesses.get(processKey);
    
    if (processInfo && processInfo.process && !processInfo.process.killed) {
        processInfo.process.kill('SIGTERM');
        activeLoginProcesses.delete(processKey);
        return true;
    }
    
    return false;
};

export const runMudslideCommand = async (tenant, branchId, args = []) => {
    if (args[0] === "login") {
        return runMudslideLogin(tenant, branchId);
    }

    return new Promise(async (resolve, reject) => {
        try {
            const cacheDir = await ensureTenantBranchDir(tenant, branchId);
            const absoluteCacheDir = path.resolve(cacheDir);
            
            if (args[0] !== "logout") {
                
                let connectionStatus = null;
                try {
                    connectionStatus = await getLoginProcessStatus(tenant, branchId);
                } catch (statusError) {
                    const errorMessage = `WhatsApp connection is not established for ${tenant}/${branchId}. Error checking status: ${statusError.message}`;
                    return reject(new Error(errorMessage));
                }
                
                if (!connectionStatus) {
                    try {
                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                        await fs.access(credsPath);
                        const credsContent = await fs.readFile(credsPath, 'utf-8');
                        if (credsContent && credsContent.trim().length > 0) {
                            console.log(`⚠️  [runMudslideCommand] getLoginProcessStatus returned null but creds.json exists and is valid - proceeding anyway`);
                            console.log(`📄 [runMudslideCommand] creds.json size: ${credsContent.length} bytes`);
                        } else {
                            const errorMessage = `WhatsApp connection is not established for ${tenant}/${branchId}. The creds.json file is empty, which means you need to login again. This may happen after logout. Please login first using the /login endpoint and scan the QR code.`;
                            console.error(`❌ [runMudslideCommand] ${errorMessage}`);
                            console.error(`❌ [runMudslideCommand] Cache directory: ${absoluteCacheDir}`);
                            return reject(new Error(errorMessage));
                        }
                    } catch (credsError) {
                        if (credsError.code === 'ENOENT') {
                            const errorMessage = `WhatsApp connection is not established for ${tenant}/${branchId}. The creds.json file does not exist, which means you need to login. This may happen after logout. Please login first using the /login endpoint and scan the QR code.`;
                            console.error(`❌ [runMudslideCommand] ${errorMessage}`);
                            console.error(`❌ [runMudslideCommand] Cache directory: ${absoluteCacheDir}`);
                            return reject(new Error(errorMessage));
                        } else {
                            const errorMessage = `WhatsApp connection is not established for ${tenant}/${branchId}. Error checking creds.json: ${credsError.message}. Please login first using the /login endpoint.`;
                            console.error(`❌ [runMudslideCommand] ${errorMessage}`);
                            return reject(new Error(errorMessage));
                        }
                    }
                } else {
                    if (connectionStatus.status !== "connected") {
                        if (connectionStatus.status === "qr_ready" && connectionStatus.output) {
                            const outputLower = connectionStatus.output.toLowerCase();
                            if (outputLower.includes('logged in') || 
                                outputLower.includes('✔  success') ||
                                outputLower.includes('✔ success') ||
                                outputLower.includes('success   logged in') ||
                                (outputLower.includes('success') && outputLower.includes('logged in'))) {
                                connectionStatus.status = "connected";
                                
                                const processKey = `${tenant}-${branchId}`;
                                const processInfo = activeLoginProcesses.get(processKey);
                                if (processInfo) {
                                    processInfo.status = "connected";
                                }
                            } else {
                                try {
                                    const credsPath = path.join(absoluteCacheDir, "creds.json");
                                    await fs.access(credsPath);
                                    const credsContent = await fs.readFile(credsPath, 'utf-8');
                                    if (credsContent && credsContent.trim().length > 0) {
                                    } else {
                                        const errorMessage = `WhatsApp connection is not established for ${tenant}/${branchId}. Status: ${connectionStatus.status}. Please login first using the /login endpoint.`;
           
                                        return reject(new Error(errorMessage));
                                    }
                                } catch (credsError) {
                                    const errorMessage = `WhatsApp connection is not established for ${tenant}/${branchId}. Status: ${connectionStatus.status}. Please login first using the /login endpoint.`;
             
                                    return reject(new Error(errorMessage));
                                }
                            }
                        } else {
                            const errorMessage = `WhatsApp connection is not established for ${tenant}/${branchId}. Status: ${connectionStatus.status}. Please login first using the /login endpoint.`;
                       
                            return reject(new Error(errorMessage));
                        }
                    }
                }
                
            } 

            const mudslideArgs = ["-v", "-c", absoluteCacheDir, ...args];
            
            
            let output = "";
            let errorOutput = "";
            let hasError = false;
            let processFinished = false;
            let outputReceived = false;
            let lastOutputTime = Date.now();
            let messageSentDetected = false;
            let messageSentTime = null;
            let streamErrorAfterMessage = false;
            let successTimeoutId = null;
            let outputTimeout = null;
            const isLogoutCommand = args[0] === "logout";
            let credsBackup = null;
            let backupCreated = false;
            let credsMonitorInterval = null;
            
            if (!isLogoutCommand) {
                try {
                    const credsPath = path.join(absoluteCacheDir, "creds.json");
                    await fs.access(credsPath);
                    credsBackup = await fs.readFile(credsPath, 'utf-8');
                    backupCreated = true;
                    
                    credsMonitorInterval = setInterval(() => {
                        fs.access(path.join(absoluteCacheDir, "creds.json"))
                            .then(() => fs.readFile(path.join(absoluteCacheDir, "creds.json"), 'utf-8'))
                            .then((credsContent) => {
                                if (!credsContent || credsContent.trim().length === 0 || 
                                    (credsBackup && credsBackup.length > 0 && credsContent.length < credsBackup.length * 0.5)) {
                                    if (credsBackup && credsBackup.trim().length > 0) {
                                        return fs.writeFile(path.join(absoluteCacheDir, "creds.json"), credsBackup, 'utf-8')
                                            .then(() => {
                                            })
                                            .catch((restoreError) => {
                                            });
                                    }
                                }
                            })
                            .catch((monitorError) => {
                                if (monitorError.code === 'ENOENT') {
                                    if (credsBackup && credsBackup.trim().length > 0) {
                                        fs.writeFile(path.join(absoluteCacheDir, "creds.json"), credsBackup, 'utf-8')
                                            .then(() => {
                                            })
                                            .catch((restoreError) => {
                                            });
                                    }
                                }
                            });
                    }, 500);
                } catch (backupError) {
         
                }
            } 

            const childProcess = spawn("npx", ["mudslide", ...mudslideArgs], {
                cwd: path.join(__dirname, "../.."),
                env: {
                    ...process.env,
                    CI: 'true',
                    FORCE_COLOR: '0',
                    NODE_ENV: process.env.NODE_ENV || 'production',
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });

            
            const timeout = setTimeout(async () => {
                if (!processFinished) {
                    const fullOutput = output + errorOutput;
                    const timeSinceLastOutput = Date.now() - lastOutputTime;
                    const timeSinceMessageSent = messageSentTime ? Date.now() - messageSentTime : null;
                    
                    if (messageSentDetected && (streamErrorAfterMessage || fullOutput.toLowerCase().includes("stream errored"))) {

                        
                        
                        let credsBackupBeforeKill = null;
                        try {
                            const credsPath = path.join(absoluteCacheDir, "creds.json");
                            await fs.access(credsPath);
                            credsBackupBeforeKill = await fs.readFile(credsPath, 'utf-8');
                        } catch (backupError) {
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        
                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                        try {
                            await fs.access(credsPath);
                            const credsContent = await fs.readFile(credsPath, 'utf-8');
                            if (credsContent && credsContent.trim().length > 0) {
                            } else {
                                if (credsBackupBeforeKill && credsBackupBeforeKill.trim().length > 0) {
                                    try {
                                        await fs.writeFile(credsPath, credsBackupBeforeKill, 'utf-8');
                                    } catch (restoreError) {
                                    }
                                }
                            }
                        } catch (credsError) {
                            if (credsError.code === 'ENOENT') {
                                if (credsBackupBeforeKill && credsBackupBeforeKill.trim().length > 0) {
                                    try {
                                        await fs.writeFile(credsPath, credsBackupBeforeKill, 'utf-8');
                                    } catch (restoreError) {
                                    }
                                }
                            }
                        }
                        
                        processFinished = true;
                        
                        try {
                            if (childProcess && !childProcess.killed) {
                                childProcess.kill('SIGTERM');
                                
                                setTimeout(async () => {
                                    try {
                                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                                        await fs.access(credsPath);
                                        const credsContent = await fs.readFile(credsPath, 'utf-8');
                                        if (!credsContent || credsContent.trim().length === 0) {
                                            if (credsBackupBeforeKill && credsBackupBeforeKill.trim().length > 0) {
                                                await fs.writeFile(credsPath, credsBackupBeforeKill, 'utf-8');
                                            }
                                        }
                                    } catch (checkError) {
                                        if (checkError.code === 'ENOENT' && credsBackupBeforeKill && credsBackupBeforeKill.trim().length > 0) {
                                            const credsPath = path.join(absoluteCacheDir, "creds.json");
                                            await fs.writeFile(credsPath, credsBackupBeforeKill, 'utf-8');
                                        }
                                    }
                                    
                                    if (childProcess && !childProcess.killed) {
                                        childProcess.kill('SIGKILL');
                                    }
                                }, 10000);
                            }
                        } catch (killError) {
                        }
                        
                        resolve(fullOutput || "");
                        return;
                    }
                    
                    processFinished = true;

                    
                    try {
                        if (childProcess && !childProcess.killed) {
                            childProcess.kill('SIGTERM');
                            
                            setTimeout(() => {
                                if (!childProcess.killed) {
                                    childProcess.kill('SIGKILL');
                                }
                            }, 3000);
                        }
                    } catch (killError) {
                    }
                    
                    reject(new Error(`Command timeout after 60 seconds. Output: ${fullOutput || "No output"}`));
                }
            }, 60000);

   

            const checkAndResolveSuccess = async () => {
                if (processFinished) return;
                if (!messageSentDetected || !streamErrorAfterMessage) return;
                
                const fullOutput = output + errorOutput;
                const fullOutputLower = fullOutput.toLowerCase();
                
                if (fullOutputLower.includes("sending message:") || fullOutputLower.includes("awaiting  sending message")) {
                    const hasConflict = fullOutputLower.includes("conflict") || fullOutputLower.includes("replaced");
                    
                    
                    if (hasConflict) {
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    } else {
                        
                        if (!backupCreated && credsBackup) {
                            try {
                                const credsPath = path.join(absoluteCacheDir, "creds.json");
                                await fs.access(credsPath);
                                credsBackup = await fs.readFile(credsPath, 'utf-8');
                                backupCreated = true;
                            } catch (backupError) {
                            }
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 10000));
                    }
                    
                    let credsStillExists = false;
                    let credsStillValid = false;
                    try {
                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                        await fs.access(credsPath);
                        credsStillExists = true;
                        const credsContent = await fs.readFile(credsPath, 'utf-8');
                        if (credsContent && credsContent.trim().length > 0) {
                            credsStillValid = true;
                        } else {
                            if (credsBackup && credsBackup.trim().length > 0) {
                                try {
                                    await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                    credsStillValid = true;
                                } catch (restoreError) {
                                }
                            }
                        }
                    } catch (credsError) {
                        if (credsError.code === 'ENOENT') {
                            if (credsBackup && credsBackup.trim().length > 0) {
                                try {
                                    const credsPath = path.join(absoluteCacheDir, "creds.json");
                                    await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                    credsStillValid = true;
                                } catch (restoreError) {
                                }
                            }
                        } 
                    }
                    
                    const finalRestorePromise = (async () => {
                        try {
                            const credsPath = path.join(absoluteCacheDir, "creds.json");
                            await fs.access(credsPath);
                            const credsContent = await fs.readFile(credsPath, 'utf-8');
                            if (!credsContent || credsContent.trim().length === 0) {
                                if (credsBackup && credsBackup.trim().length > 0) {
                                    await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                }
                            } else if (backupCreated && credsBackup && credsBackup.length > 0 && credsContent.length < credsBackup.length * 0.5) {
                                await fs.writeFile(credsPath, credsBackup, 'utf-8');
                            } 
                        } catch (beforeResolveError) {
                            if (beforeResolveError.code === 'ENOENT') {
                                if (backupCreated && credsBackup && credsBackup.trim().length > 0) {
                                    try {
                                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                                        await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                    } catch (restoreError) {
                                    }
                                }
                            } 
                        }
                    })();
                    
                    await finalRestorePromise;
                    
                    processFinished = true;
                    clearTimeout(timeout);
                    if (successTimeoutId) {
                        clearTimeout(successTimeoutId);
                        successTimeoutId = null;
                    }
                    
                    try {
                        if (childProcess && !childProcess.killed) {
                            childProcess.kill('SIGTERM');
                            
                            setTimeout(async () => {
                                try {
                                    const credsPath = path.join(absoluteCacheDir, "creds.json");
                                    await fs.access(credsPath);
                                    const credsContent = await fs.readFile(credsPath, 'utf-8');
                                    if (!credsContent || credsContent.trim().length === 0) {
                                        if (credsBackup && credsBackup.trim().length > 0) {
                                            await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                        }
                                    } 
                                } catch (checkError) {
                                    if (checkError.code === 'ENOENT' && credsBackup && credsBackup.trim().length > 0) {
                                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                                        await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                    }
                                }
                                
                                if (credsMonitorInterval) {
                                    clearInterval(credsMonitorInterval);
                                    credsMonitorInterval = null;
                                }
                                
                                if (childProcess && !childProcess.killed) {
                                    childProcess.kill('SIGKILL');
                                    
                                    setTimeout(async () => {
                                        try {
                                            const credsPath = path.join(absoluteCacheDir, "creds.json");
                                            await fs.access(credsPath);
                                            const credsContent = await fs.readFile(credsPath, 'utf-8');
                                            if (!credsContent || credsContent.trim().length === 0) {
                                                if (credsBackup && credsBackup.trim().length > 0) {
                                                    await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                                }
                                            }
                                        } catch (finalError) {
                                            if (finalError.code === 'ENOENT' && credsBackup && credsBackup.trim().length > 0) {
                                                const credsPath = path.join(absoluteCacheDir, "creds.json");
                                                await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                            }
                                        }
                                    }, 1000);
                                }
                            }, 15000);
                        }
                    } catch (killError) {
                    }
                    
                    resolve(fullOutput);
                }
            };

            const checkMessageSent = async (text) => {
                const textLower = text.toLowerCase();
                
                if (!messageSentDetected && (textLower.includes("sending message:") || textLower.includes("awaiting  sending message"))) {
                    messageSentDetected = true;
                    messageSentTime = Date.now();
                    
                    if (!backupCreated) {
                        fs.access(path.join(absoluteCacheDir, "creds.json"))
                            .then(() => fs.readFile(path.join(absoluteCacheDir, "creds.json"), 'utf-8'))
                            .then((content) => {
                                credsBackup = content;
                                backupCreated = true;
                            })
                            .catch((backupError) => {
                            });
                    }
                }
                
                if (messageSentDetected && (textLower.includes("stream errored out") || textLower.includes("stream errored") || textLower.includes("connection errored"))) {
                    if (!streamErrorAfterMessage) {
                        streamErrorAfterMessage = true;
                        
                        const hasConflict = textLower.includes("conflict") || textLower.includes("replaced") || 
                                           output.toLowerCase().includes("conflict") || output.toLowerCase().includes("replaced");
 
                        
                        (async () => {
                            try {
                                const credsPath = path.join(absoluteCacheDir, "creds.json");
                                await fs.access(credsPath);
                                const credsContent = await fs.readFile(credsPath, 'utf-8');
                                
                                if (!credsContent || credsContent.trim().length === 0 || 
                                    (credsBackup && credsBackup.length > 0 && credsContent.length < credsBackup.length * 0.5)) {
                                    if (credsBackup && credsBackup.trim().length > 0) {
                                        await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                    }
                                }
                            } catch (streamError) {
                                if (streamError.code === 'ENOENT') {
                                    if (credsBackup && credsBackup.trim().length > 0) {
                                        try {
                                            const credsPath = path.join(absoluteCacheDir, "creds.json");
                                            await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                        } catch (restoreError) {
                                        }
                                    }
                                }
                            }
                        })();
                        
                        const waitTime = hasConflict ? 15000 : 10000;
                        
                        if (!successTimeoutId && !processFinished) {
                            successTimeoutId = setTimeout(() => {
                                checkAndResolveSuccess();
                            }, waitTime);
                        }
                    }
                }
            };

            childProcess.stdout.on('data', (data) => {
                outputReceived = true;
                lastOutputTime = Date.now();
                if (outputTimeout) {
                    clearTimeout(outputTimeout);
                    outputTimeout = null;
                }
                const text = data.toString();
                output += text;
                console.log(`📤 stdout: ${text.trim()}`);
                checkMessageSent(text);
            });

            childProcess.stderr.on('data', (data) => {
                outputReceived = true;
                lastOutputTime = Date.now();
                if (outputTimeout) {
                    clearTimeout(outputTimeout);
                    outputTimeout = null;
                }
                const text = data.toString();
                errorOutput += text;
                console.log(`❌ stderr: ${text.trim()}`);
                checkMessageSent(text);
            });

            childProcess.on('error', (error) => {
                if (processFinished) return;
                processFinished = true;
                clearTimeout(timeout);
                if (outputTimeout) {
                    clearTimeout(outputTimeout);
                    outputTimeout = null;
                }
                if (successTimeoutId) {
                    clearTimeout(successTimeoutId);
                    successTimeoutId = null;
                }
                if (credsMonitorInterval) {
                    clearInterval(credsMonitorInterval);
                    credsMonitorInterval = null;
                }
                hasError = true;
                
                if (backupCreated && credsBackup) {
                    (async () => {
                        try {
                            const credsPath = path.join(absoluteCacheDir, "creds.json");
                            await fs.access(credsPath);
                            const credsContent = await fs.readFile(credsPath, 'utf-8');
                            if (!credsContent || credsContent.trim().length === 0) {
                                await fs.writeFile(credsPath, credsBackup, 'utf-8');
                            }
                        } catch (restoreError) {
                            if (restoreError.code === 'ENOENT') {
                                try {
                                    const credsPath = path.join(absoluteCacheDir, "creds.json");
                                    await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                } catch (writeError) {
                                }
                            }
                        }
                    })();
                }
                
                reject(error);
            });

            childProcess.on('close', async (code) => {
                if (processFinished) return;
                
                if (successTimeoutId) {
                    clearTimeout(successTimeoutId);
                    successTimeoutId = null;
                }
                
                if (credsMonitorInterval) {
                    clearInterval(credsMonitorInterval);
                    credsMonitorInterval = null;
                }
                
                if (!isLogoutCommand) {
                    try {
                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                        await fs.access(credsPath);
                        const credsContent = await fs.readFile(credsPath, 'utf-8');
                        if (credsContent && credsContent.trim().length > 0) {
                        } else {
                            if (backupCreated && credsBackup && credsBackup.trim().length > 0) {
                                try {
                                    await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                } catch (restoreError) {
                                }
                            } 
                        }
                    } catch (credsError) {
                        if (credsError.code === 'ENOENT') {
                            if (!isLogoutCommand) {
                                if (backupCreated && credsBackup && credsBackup.trim().length > 0) {
                                    try {
                                        const credsPath = path.join(absoluteCacheDir, "creds.json");
                                        await fs.writeFile(credsPath, credsBackup, 'utf-8');
                                    } catch (restoreError) {
                                    }
                                }
                            }
                        } 
                    }
                }
                
                if (messageSentDetected && streamErrorAfterMessage) {
                    processFinished = true;
                    clearTimeout(timeout);
                    if (outputTimeout) {
                        clearTimeout(outputTimeout);
                        outputTimeout = null;
                    }
                    const fullOutput = output + errorOutput;
                    const fullOutputLower = fullOutput.toLowerCase();
                    const hasConflict = fullOutputLower.includes("conflict") || fullOutputLower.includes("replaced");
     
                    resolve(fullOutput || "");
                    return;
                }
                
                processFinished = true;
                clearTimeout(timeout);
                if (outputTimeout) {
                    clearTimeout(outputTimeout);
                    outputTimeout = null;
                }
                
                if (hasError) return;
                
                const fullOutput = output + errorOutput;
                const fullOutputLower = fullOutput.toLowerCase();
                const hasConflict = fullOutputLower.includes("conflict") || fullOutputLower.includes("replaced");
                
      
            
                
                if (isLogoutCommand && code === 0) {
                    const credsPath = path.join(absoluteCacheDir, "creds.json");
                    try {
                        await fs.access(credsPath);
                        await fs.unlink(credsPath);
                    } catch (deleteError) {
             
                    }
                    
                    const processKey = `${tenant}-${branchId}`;
                    if (activeLoginProcesses.has(processKey)) {
                        activeLoginProcesses.delete(processKey);
                    }
                    
                    resolve(fullOutput || "");
                } else if (code === 0) {
                    resolve(fullOutput || "");
                } else {
                    if (messageSentDetected) {
                        resolve(fullOutput || "");
                    } else {
                        
                        const errorMessage = fullOutput 
                            ? `Command failed with exit code ${code}. Output: ${fullOutput}`
                            : `Command failed with exit code ${code}. No output.`;
                        
                        reject(new Error(errorMessage));
                    }
                }
            });

        } catch (error) {
            reject(error);
        }
    });
};
