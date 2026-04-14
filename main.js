// ═══════════════════════════════════════════
//  GLOBAL STEALTH BOOT (MUST BE FIRST)
// ═══════════════════════════════════════════
const { app, BrowserWindow, screen, ipcMain, globalShortcut, clipboard, nativeImage, desktopCapturer, session } = require('electron');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'UserAgentClientHint');
app.commandLine.appendSwitch('no-sandbox'); 
app.commandLine.appendSwitch('disable-site-isolation-trials');

// CRITICAL: Prevent Chromium from pausing DOM updates when window is "hidden"
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { powerSaveBlocker } = require('electron');

// 🛡️ POWER SHIELD: Prevent system/renderer suspension
powerSaveBlocker.start('prevent-app-suspension');

// ═══════════════════════════════════════════
//  PROJECT GHOST-MODE 🛸 (Native Stealth)
// ═══════════════════════════════════════════
const { uIOhook } = require('uiohook-napi');
const koffi = require('koffi');

// ═══════════════════════════════════════════
//  PROJECT PHANTOM-BATCH v12.0 🛸 (Lex200 Sealed)
// ═══════════════════════════════════════════

let overlayWindow = null;
let chatgptWin = null;

let batchQueue = []; // Array of { img: String, timestamp }
let isForcedHidden = false; // Start VISIBLE
let isUiHidden = false; // Alt+E toggle
let isAdminVisible = false;
let isPinned = false; 
let isAlwaysOnTop = true;
let isCombatMode = false; // "Click-Through" Mode (Lex200 Defense)
let activeSection = "GEN"; // GEN, DEB, APT, PRG
let promptSent = false; 

// AMCAT Specialized Prompts
const SECTION_PROMPTS = {
    "GEN": "Solve this with 100% accuracy. Think step-by-step.",
    "DEB": "AMCAT DEBUGGING: Identify the bug in the provided code snippet. Explain the fix clearly and provide the corrected code.",
    "APT": "AMCAT APTITUDE: Solve this mathematical/logical problem step-by-step. Provide the final numerical answer clearly.",
    "PRG": "AMCAT PROGRAMMING: Write a complete, optimized solution for this problem. Include time/space complexity and handle all edge cases."
};

// Configuration State
let SYSTEM_PROMPT = "Solve this with 100% accuracy. Think step-by-step for every part of the question to be sure.";
let PROXY_RULE = ""; 

// ═══════════════════════════════════════════
//  ENVIRONMENT SELF-HEALING
// ═══════════════════════════════════════════
function checkEnvironment() {
    console.log('[SYSTEM] Verifying system dependencies...');
    
    // 1. Check for Python (Try 'python' then 'py' launcher)
    const checkPython = (cmd) => {
        return new Promise((resolve) => {
            exec(`${cmd} --version`, (err) => resolve(!err));
        });
    };

    (async () => {
        const hasPython = await checkPython('python');
        const hasPy = await checkPython('py');

        if (!hasPython && !hasPy) {
            console.log('[SYSTEM] Python NOT detected. Attempting Auto-Installation...');
            if (overlayWindow) overlayWindow.webContents.send('update-ans', '🔧 INITIALIZING SYSTEM (Installing Python Core)...');
            
            // Try winget (Windows native package manager)
            exec('winget install --id Python.Python.3 --silent --accept-package-agreements --accept-source-agreements', (wingetErr) => {
                if (wingetErr) {
                    console.error('[FATAL] Auto-install failed. Admin rights likely missing.');
                    if (overlayWindow) {
                        overlayWindow.webContents.send('update-ans', '❌ SYSTEM SETUP FAILED.\n1. Please RUN AS ADMINISTRATOR.\n2. Or install Python 3 manually from python.org');
                    }
                } else {
                    console.log('[SYSTEM] Python installed successfully. Please restart the app.');
                    if (overlayWindow) overlayWindow.webContents.send('update-ans', '✅ PYTHON INSTALLED. Please RESTART the app.');
                }
            });
        } else {
            // Already has python, just install deps
            const pythonCmd = hasPython ? 'python' : 'py';
            installPythonDeps(pythonCmd);
        }
    })();

    // 2. Check for Admin rights
    exec('net session', (err) => {
        if (err) {
            console.warn('[SECURITY] App not running as Administrator. Setup will likely fail.');
        } else {
            console.log('[SECURITY] Running with Administrator privileges.');
        }
    });
}

function installPythonDeps(pythonCmd) {
    exec(`${pythonCmd} -c "import uiautomation"`, (err) => {
        if (err) {
            console.log(`[SYSTEM] Missing "uiautomation" dependency. Using ${pythonCmd}...`);
            if (overlayWindow) overlayWindow.webContents.send('update-ans', '🔧 OPTIMIZING ENVIRONMENT (Installing UIA components)...');
            
            exec(`${pythonCmd} -m pip install uiautomation`, (pipErr) => {
                if (pipErr) {
                    console.error('[FATAL] Auto-install failed.');
                    if (overlayWindow) overlayWindow.webContents.send('update-ans', '❌ AUTO-FIX FAILED.\nPlease RUN AS ADMINISTRATOR.');
                } else {
                    console.log('[SYSTEM] Dependency auto-installed successfully.');
                    if (overlayWindow) overlayWindow.webContents.send('update-ans', '✅ ENVIRONMENT OPTIMIZED. Extraction ready.');
                }
            });
        }
    });
}

const configPath = path.join(process.cwd(), 'config.json');

// Load User Config if exists
if (fs.existsSync(configPath)) {
    try {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (userConfig.prompt) SYSTEM_PROMPT = userConfig.prompt;
        if (userConfig.proxy) PROXY_RULE = userConfig.proxy;
    } catch (e) {
        console.error('[CONFIG] Failed to parse config.json, using default prompt.');
    }
} else {
    // Create default config if missing
    try {
        fs.writeFileSync(configPath, JSON.stringify({
            prompt: SYSTEM_PROMPT,
            proxy: ""
        }, null, 4));
        console.log('[CONFIG] Default config.json created.');
    } catch (e) {
        console.error('[CONFIG] Failed to create default config.json');
    }
}

// Override with CLI Arg if provided (--prompt="..." or --proxy="...")
const promptArg = process.argv.find(arg => arg.startsWith('--prompt='));
if (promptArg) SYSTEM_PROMPT = promptArg.split('=')[1];

const proxyArg = process.argv.find(arg => arg.startsWith('--proxy='));
if (proxyArg) PROXY_RULE = proxyArg.split('=')[1];

// Mouse Analytics
let lastMousePos = { x: 0, y: 0 };
let edgeCooldown = 0;
let edgeActive = { left: false, right: false }; // Track if mouse is currently on edge
let wasVisible = true; // Sync state
// UI State
let lastOpacity = -1;

// ═══════════════════════════════════════════
//  WINDOW CREATION
// ═══════════════════════════════════════════

function createOverlayWindow() {
    overlayWindow = new BrowserWindow({
        width: 400, height: 300, transparent: true, frame: false, alwaysOnTop: true,
        skipTaskbar: true, resizable: false, focusable: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    overlayWindow.loadFile('index.html');
    
    // Layer 1: System Level Stealth
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    
    // Layer 2: Ultimate Stealth (True Invisibility)
    setUltimateStealth(overlayWindow);
    
    overlayWindow.setOpacity(0.9);
    overlayWindow.showInactive(); 
}

function setUltimateStealth(window) {
    if (!window || process.platform !== 'win32') return;
    try {
        const user32 = koffi.load('user32.dll');
        const SetWindowDisplayAffinity = user32.func('bool __stdcall SetWindowDisplayAffinity(intptr hWnd, uint32_t dwAffinity)');
        const handle = window.getNativeWindowHandle();
        const hwnd = handle.readUInt32LE();

        const result = SetWindowDisplayAffinity(hwnd, 0x00000011);
        if (result) {
            console.log('🛡️ STEALTH: WDA_EXCLUDEFROMCAPTURE Activated.');
        } else {
            console.warn('🛡️ WDA_EXCLUDEFROMCAPTURE failed — using setContentProtection fallback');
            window.setContentProtection(true);
        }
    } catch (e) {
        console.warn('🛡️ koffi WDA failed:', e.message);
        window.setContentProtection(true);
    }
}

// ═══════════════════════════════════════════
//  STEALTH HANDSHAKE (Active Stealth Bridge)
// ═══════════════════════════════════════════

function createBridge(name, url, partition) {
    const win = new BrowserWindow({
        width: 1, height: 1, x: 0, y: 0, show: true, // Ghost Anchor (Forces active rendering)
        skipTaskbar: true, frame: false, transparent: true, opacity: 0.01,
        webPreferences: { 
            partition: `persist:${partition}`, 
            contextIsolation: true, 
            nodeIntegration: false,
            javascript: true,
            webSecurity: true, 
            backgroundThrottling: false,
            offscreen: false 
        }
    });
    
    // 🛡️ ULTIMATE STEALTH: Hide from all capture tools even while at (0,0)
    setUltimateStealth(win);
    
    // High-Trust Firefox User Agent
    const highTrustUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0";
    const sess = session.fromPartition(`persist:${partition}`);
    sess.setUserAgent(highTrustUA);
    
    sess.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'notifications') return callback(false);
        callback(true);
    });

    win.webContents.setUserAgent(highTrustUA);

    // Deep Stealth Fingerprint (Enhanced for Resilience)
    win.webContents.on('dom-ready', () => {
        win.webContents.executeJavaScript(`
            // Security/Bot Detection Bypass
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 16 });
            
            // Mask Visibility API (Force "Running" state)
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            // State Force Injection
            window.isSleeping = false;
            window.isRunning = true;

            // Animation Heartbeat (Prevents renderer sleep)
            setInterval(() => {
                window.dispatchEvent(new Event('mousemove'));
                if (window.requestAnimationFrame) {
                    window.requestAnimationFrame(() => {});
                }
            }, 1000);

            // Mock Focus
            try { document.hasFocus = () => true; } catch(e) {}
            
            "Injection Success";
        `).catch(err => console.error("[DOM-READY ERR]", err));
    });

    win.loadURL(url);

    win.on('close', (e) => {
        e.preventDefault();
        win.setBounds({ x: 0, y: 0, width: 1, height: 1 });
        isAdminVisible = false;
    });
    return win;
}

// ═══════════════════════════════════════════
//  CORE WORKFLOW: CAPTURE -> BATCH -> STRIKE
// ═══════════════════════════════════════════

async function captureImageQuestion() {
    if (batchQueue.length >= 10) return; 
    console.log(`[CAPTURE] Using Stealth GDI Memory Capture (Zero-Screenshot)...`);
    
    const psPath = path.join(__dirname, 'bin', 'stealth_capture.ps1');
    const cmd = `powershell -ExecutionPolicy Bypass -File "${psPath}"`;
    
    // Increase buffer size for Base64 image data and PREVENT CONSOLE FLASH
    exec(cmd, { maxBuffer: 1024 * 1024 * 10, windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[CAPTURE] GDI Error: ${error.message}`);
            return;
        }
        const dataUrl = stdout.trim();
        if (dataUrl && dataUrl.startsWith("data:image")) {
            batchQueue.push({ img: dataUrl, text: null, time: Date.now() });
            console.log(`[QUEUE] Added stealth image ${batchQueue.length}/10`);
            updateUI();
        } else {
            console.warn(`[CAPTURE] Failed to get pixel data: ${dataUrl}`);
        }
    });
}

async function captureTextQuestion() {
    if (batchQueue.length >= 10) return;
    console.log(`[CAPTURE] Using Python UIA Extraction (Zero Screenshot)...`);
    
    const pyPath = path.join(__dirname, 'bin', 'uia_extract.py');
    const cmd = `python "${pyPath}"`;
    
    // Ensure no terminal pops up and steals focus
    exec(cmd, { encoding: 'utf8', windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[UIA] Python Error: ${error.message}`);
            return;
        }
        const text = stdout.trim();
        if (text && !text.startsWith("ERROR")) {
            batchQueue.push({ img: null, text: text, time: Date.now() });
            console.log(`[QUEUE] Added text question ${batchQueue.length}/10 (${text.length} chars)`);
            updateUI();
        } else {
            console.warn(`[UIA] No text extracted: ${text}`);
        }
    });
}

async function performOracleStrike() {
    if (batchQueue.length === 0) return;
    
    console.log(`[STRIKE] Sending ${batchQueue.length} questions to ChatGPT...`);
    
    const images = batchQueue.filter(q => q.img).map(item => item.img); 
    const textContext = batchQueue.filter(q => q.text).map(item => item.text).join('\n\n───\n\n');

    // Build the correct prompt based on section
    const finalPrompt = SECTION_PROMPTS[activeSection] || SYSTEM_PROMPT;

    // Preparation Script
    const injectionScript = `
        (async function() {
            try {
                const imgs = ${JSON.stringify(images)};
                const texts = ${JSON.stringify(textContext)};
                const PROMPT = ${JSON.stringify(finalPrompt)};

                const input = document.querySelector('div[contenteditable="true"]') || 
                              document.querySelector('textarea') || 
                              document.querySelector('.ProseMirror') || 
                              document.querySelector('[aria-label*="message"]');
                if (!input) return "Input Not Found";
                
                input.focus();
                
                // 1. Paste Images if any
                for (const dataUrl of imgs) {
                    const parts = dataUrl.split(',');
                    const bstr = atob(parts[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while(n--) u8arr[n] = bstr.charCodeAt(n);
                    const file = new File([u8arr], "question.png", { type: "image/png" });
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
                    input.dispatchEvent(pasteEvent);
                    await new Promise(r => setTimeout(r, 800)); 
                }

                // 2. Insert Accumulated Text Context
                if (texts) {
                    document.execCommand('insertText', false, "CONTEXT FROM UIA:\\n" + texts + "\\n\\n");
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // 3. Dynamic User-Controlled Prompt
                document.execCommand('insertText', false, PROMPT);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                // ☢️ STATE FORCE: Make React/ProseMirror recognize our text
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // 🎯 WAIT for Send button to become active, THEN press Enter
                let attempts = 0;
                while (attempts < 50) {
                    await new Promise(r => setTimeout(r, 200));
                    
                    const sendBtn = document.querySelector('button[data-testid="send-button"]') || 
                                    document.querySelector('button[aria-label*="Send"]');
                    
                    if (sendBtn && !sendBtn.disabled) {
                        // Button is ready — fire Enter
                        const enterDown = new KeyboardEvent('keydown', { 
                            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, 
                            bubbles: true, cancelable: true 
                        });
                        const enterPress = new KeyboardEvent('keypress', { 
                            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, 
                            bubbles: true, cancelable: true 
                        });
                        const enterUp = new KeyboardEvent('keyup', { 
                            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, 
                            bubbles: true, cancelable: true 
                        });
                        
                        input.focus();
                        input.dispatchEvent(enterDown);
                        input.dispatchEvent(enterPress);
                        input.dispatchEvent(enterUp);
                        
                        return "Success (Enter after " + (attempts * 200) + "ms)";
                    }
                    attempts++;
                }
                return "Timeout - Send never activated";
            } catch (err) { return "Error: " + err.message; }
        })()
    `;

    if (chatgptWin) {
        chatgptWin.webContents.executeJavaScript(injectionScript)
            .then(result => console.log("[STRIKE] Script Result:", result))
            .catch(err => console.error("[STRIKE ERROR] Failed to execute injection:", err));
        
        pollForResult(chatgptWin, 'chatgpt');
        promptSent = true; 
    }

    overlayWindow.webContents.send('update-ans', 'SOLVING');
    batchQueue = [];
    updateUI();
}


let lastAns = { chatgpt: "" };

let pollInterval = null;
async function pollForResult(win) {
    if (pollInterval) clearTimeout(pollInterval);
    
    const pollScript = `
        (function() {
            try {
                const msgs = document.querySelectorAll('.message, .prose, .markdown, [data-testid*="message"], [class*="messageContent"]');
                if (msgs.length === 0) return null;
                // Scrape the entire history for this session
                return Array.from(msgs)
                    .map(m => m.innerText)
                    .join('\\n\\n───\\n\\n'); 
            } catch(e) { return null; }
        })()
    `;
    
    async function runPoll() {
        if (!win || win.isDestroyed()) return;
        try {
            const result = await win.webContents.executeJavaScript(pollScript);
            if (result && result !== "Thinking...") {
                if (result !== lastAns.chatgpt) {
                    lastAns.chatgpt = result;
                    if (overlayWindow && !overlayWindow.isDestroyed()) {
                        overlayWindow.webContents.send('update-ans', result);
                        // Force a HUD refresh
                        updateUI();
                    }
                }
            }
        } catch (e) {
            console.error("[POLL ERROR]", e.message);
        }
        pollInterval = setTimeout(runPoll, 1000);
    }
    
    runPoll();
}

// ═══════════════════════════════════════════
//  UI DISPATCH & HUD
// ═══════════════════════════════════════════

function updateUI() {
    if (!overlayWindow) return;
    overlayWindow.webContents.send('update-hud', {
        count: batchQueue.length,
        isForcedHidden,
        isUiHidden,
        isPinned,
        isAlwaysOnTop,
        isCombatMode,
        activeSection
    });
    // Sync the answer area
    overlayWindow.webContents.send('update-ans', lastAns.chatgpt || "");
}

// ═══════════════════════════════════════════
//  STEALTH POLLING (Hover Reveal)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  STEALTH ENGINE (Edges & Jitter)
// ═══════════════════════════════════════════
setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    
    const mouse = screen.getCursorScreenPoint();
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().bounds;
    
    // 1. Edge Triggers (Capture/Solve)
    if (Date.now() > edgeCooldown) {
        if (mouse.x >= screenWidth - 1) { // Right Edge Proximity
            if (!edgeActive.right) {
                captureTextQuestion();
                edgeActive.right = true;
                edgeCooldown = Date.now() + 2000; // 2s cooldown
            }
        } else {
            edgeActive.right = false;
        }

        if (mouse.x <= 0) { // Left Edge Proximity
            if (!edgeActive.left) {
                performOracleStrike();
                edgeActive.left = true;
                edgeCooldown = Date.now() + 2000;
            }
        } else {
            edgeActive.left = false;
        }
    }

    lastMousePos = { x: mouse.x, y: mouse.y };
    
    // 3. Position HUD Window
    if (isPinned) return; 
    
    if (isForcedHidden) {
        if (wasVisible) {
            overlayWindow.hide();
            wasVisible = false;
        }
    } else {
        if (!wasVisible) {
            overlayWindow.showInactive();
            wasVisible = true;
        }
        
        const sf = screen.getPrimaryDisplay().scaleFactor || 1.0;
        overlayWindow.setBounds({
            x: Math.round(mouse.x + 10), y: Math.round(mouse.y + 10),
            width: Math.round(300 * sf), height: Math.round(150 * sf)
        });
    }
}, 25);

// ═══════════════════════════════════════════
//  HOTKEYS
// ═══════════════════════════════════════════

app.whenReady().then(async () => {
    app.setName('Windows Diagnostic Utility');

    // 🛡️ FIREWALL SHIELD: Apply Proxy if specified
    if (PROXY_RULE) {
        console.log(`[PROXY] Routing traffic through: ${PROXY_RULE}`);
        const proxyConfig = { proxyRules: PROXY_RULE };
        await session.defaultSession.setProxy(proxyConfig);
        const gptSess = session.fromPartition('persist:chatgpt');
        await gptSess.setProxy(proxyConfig);
    }

    createOverlayWindow();
    chatgptWin = createBridge('chatgpt', 'https://chat.openai.com', 'chatgpt');
    
    // Run environment check after windows are ready
    setTimeout(checkEnvironment, 2000);

    const register = (key, fn) => {
        const success = globalShortcut.register(key, fn);
        console.log(`[KEY] ${key} registration: ${success ? 'OK' : 'FAILED'}`);
        return success;
    };

    // 🎯 SECTION TOGGLES
    register('Alt+S', () => { isPinned = !isPinned; updateUI(); });
    register('Alt+C', () => { 
        isCombatMode = !isCombatMode; 
        updateUI(); 
        console.log(`[APP] Combat Mode (Lex200 Defense): ${isCombatMode}`); 
    });
    register('Alt+G', () => { 
        isAlwaysOnTop = !isAlwaysOnTop; 
        if (overlayWindow) overlayWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver', 1);
        updateUI(); 
    });

    // 🕊️ ZERO-FOCUS NAVIGATION (Alt + Arrows)
    register('Alt+Up', () => { if (overlayWindow) overlayWindow.webContents.send('ans-scroll', -40); });
    register('Alt+Down', () => { if (overlayWindow) overlayWindow.webContents.send('ans-scroll', 40); });
    register('Alt+Left', () => { if (overlayWindow) overlayWindow.webContents.send('nav', 'prev-q'); });
    register('Alt+Right', () => { if (overlayWindow) overlayWindow.webContents.send('nav', 'next-q'); });

    register('Alt+X', () => {
        if (isCombatMode) {
            console.warn(`🛡️ BLOCKED: Alt+X is disabled in Combat Mode to prevent Lex200 focus loss.`);
            return; 
        }
        isAdminVisible = !isAdminVisible;
        if (chatgptWin) {
            if (isAdminVisible) {
                // Restore Visibility & Move to center
                const { width, height } = screen.getPrimaryDisplay().workAreaSize;
                chatgptWin.setOpacity(1.0);
                chatgptWin.setBounds({ 
                    x: Math.round(width/2 - 550), 
                    y: Math.round(height/2 - 425), 
                    width: 1100, height: 850 
                });
                chatgptWin.focus(); 
            } else {
                // Ghost Mode: Move to anchor and set low opacity
                chatgptWin.setOpacity(0.01);
                chatgptWin.setBounds({ x: 0, y: 0, width: 1, height: 1 });
            }
        }
        console.log(`[APP] isAdminVisible: ${isAdminVisible}`);
    });

    // 🕊️ GHOST MODE: uIOhook Listener (Unified Input System)
    let isUpPressed = false, isDownPressed = false, isLeftPressed = false, isRightPressed = false;
    let isShiftPressed = false;
    let isChordLocked = false;

    uIOhook.on('keydown', (e) => {
        // Wrap in setImmediate to prevent N-API thread crash
        setImmediate(() => {
            if (e.keycode === 57416 || e.keycode === 72) isUpPressed = true;
            if (e.keycode === 57424 || e.keycode === 80) isDownPressed = true;
            if (e.keycode === 57419 || e.keycode === 75) isLeftPressed = true;
            if (e.keycode === 57421 || e.keycode === 77) isRightPressed = true;
            if (e.keycode === 42 || e.keycode === 54) isShiftPressed = true;

            // 1. Unified Section Switching (Shift + F1-F8)
            if (isShiftPressed) {
                if (e.keycode >= 59 && e.keycode <= 66) {
                    const sectionMap = { 59: "DEB", 60: "APT", 61: "PRG", 62: "GEN" };
                    activeSection = sectionMap[e.keycode] || "GEN";
                    console.log(`[SECTION] Active: ${activeSection}`);
                    updateUI();
                    if (e.keycode === 59) captureImageQuestion();
                    return;
                }
            }

            // 2. Hide/Unhide HUD (Up + Down)
            if (isUpPressed && isDownPressed) {
                isForcedHidden = !isForcedHidden;
                updateUI();
                isUpPressed = false; isDownPressed = false;
            }

            // 3. TEXT CAPTURE (Left + Right) — 100% Safe
            if (isLeftPressed && isRightPressed) {
                if (isChordLocked) return;
                console.log(`[CHORD] TEXT CAPTURE Triggered (Safe Mode)...`);
                isChordLocked = true;
                captureTextQuestion();
                isLeftPressed = false; isRightPressed = false;
                setTimeout(() => { isChordLocked = false; }, 2000);
            }

            // 3b. IMAGE CAPTURE (Down + Left) — Diagram Mode
            if (isDownPressed && isLeftPressed) {
                if (isChordLocked) return;
                console.log(`[CHORD] DIAGRAM CAPTURE Triggered (GDI Mode)...`);
                isChordLocked = true;
                captureImageQuestion();
                isDownPressed = false; isLeftPressed = false;
                setTimeout(() => { isChordLocked = false; }, 2000);
            }

            // 4. Perform Strike (Up + Right)
            if (isUpPressed && isRightPressed) {
                performOracleStrike();
                isUpPressed = false; isRightPressed = false;
            }

            // 5. Pin/Unpin (Up + Left)
            if (isUpPressed && isLeftPressed) {
                isPinned = !isPinned;
                updateUI();
                isUpPressed = false; isLeftPressed = false;
            }
        });
    });

    uIOhook.on('keyup', (e) => {
        setImmediate(() => {
            if (e.keycode === 57416 || e.keycode === 72) isUpPressed = false;
            if (e.keycode === 57424 || e.keycode === 80) isDownPressed = false;
            if (e.keycode === 57419 || e.keycode === 75) isLeftPressed = false;
            if (e.keycode === 57421 || e.keycode === 77) isRightPressed = false;
            if (e.keycode === 42 || e.keycode === 54) isShiftPressed = false;
        });
    });

    // STEALTH CLICK HANDLER: Manually route clicks when window is focusable:false
    uIOhook.on('mousedown', (e) => {
        setImmediate(() => {
            if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;
            const bounds = overlayWindow.getBounds();
            const primaryDisplay = screen.getPrimaryDisplay();
            const sf = primaryDisplay.scaleFactor;

            const mX = e.x / sf;
            const mY = e.y / sf;

            if (mX >= bounds.x && mX <= bounds.x + bounds.width &&
                mY >= bounds.y && mY <= bounds.y + bounds.height) {
                const clientX = Math.round(mX - bounds.x);
                const clientY = Math.round(mY - bounds.y);
                overlayWindow.webContents.send('stealth-click', { x: clientX, y: clientY });
            }
        });
    });

    // STEALTH SCROLL HANDLER: Manually route mouse wheel when hovering over HUD
    uIOhook.on('wheel', (e) => {
        setImmediate(() => {
            if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;
            const bounds = overlayWindow.getBounds();
            const sf = screen.getPrimaryDisplay().scaleFactor;

            const mX = e.x / sf;
            const mY = e.y / sf;

            // Only scroll if hovering over the HUD
            if (mX >= bounds.x && mX <= bounds.x + bounds.width &&
                mY >= bounds.y && mY <= bounds.y + bounds.height) {
                
                // e.rotation is positive for scrolled down, negative for scrolled up
                const scrollAmount = e.rotation > 0 ? 60 : -60;
                overlayWindow.webContents.send('ans-scroll', scrollAmount);
            }
        });
    });

    // Delay start to let Electron event loop stabilize
    setTimeout(() => {
        uIOhook.start();
        console.log('[GHOST] uIOhook started successfully.');
    }, 500);

    // ☢️ DECONTAMINATION PROTOCOL (Alt + Shift + X)
    register('Alt+Shift+X', async () => {
        console.log("☢️ SELF-DESTRUCT INITIATED...");
        const burnScript = `
            (async function() {
                try {
                    const gptDelete = document.querySelector('nav .bg-red-500') || document.querySelector('[aria-label*="Delete"]');
                    if (gptDelete) gptDelete.click();
                    await new Promise(r => setTimeout(r, 500));
                } catch(e) {}
            })()
        `;
        if (chatgptWin) {
            chatgptWin.webContents.executeJavaScript(burnScript).catch(e => {});
            await chatgptWin.webContents.session.clearStorageData();
        }
        promptSent = false;
        await session.defaultSession.clearStorageData();
        console.log("☢️ WIPE COMPLETE. EXITING.");
        app.exit(0);
    });

    ipcMain.on('double-click', () => {
        isPinned = !isPinned;
        updateUI();
    });
});
