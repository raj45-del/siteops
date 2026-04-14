#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const mainPath = path.join(__dirname, '..', 'main.js');

// ══════════════════════════════════════════════════════════════════════════
//  WINDOWS DIAGNOSTIC UTILITY : LAUNCHER v2.0
// ══════════════════════════════════════════════════════════════════════════

if (!fs.existsSync(mainPath)) {
  console.error('[FATAL] System Diagnostic Core (main.js) missing. Please reinstall the utility.');
  process.exit(1);
}

// 🎯 DETACHED STEALTH BOOT
// This ensures the tool keeps running even if the terminal is killed.
const boot = () => {
    let electronPath;
    try {
        // Resolve Electron from the package environment
        electronPath = require('electron');
    } catch (e) {
        // Fallback for npx environments
        const localElectron = path.join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd');
        const localElectronSh = path.join(__dirname, '..', 'node_modules', '.bin', 'electron');
        
        if (fs.existsSync(localElectron)) {
            electronPath = localElectron;
        } else if (fs.existsSync(localElectronSh)) {
            electronPath = localElectronSh;
        } else {
            electronPath = 'electron'; 
        }
    }

    const child = spawn(electronPath, [mainPath], {
        stdio: 'ignore', 
        detached: true,
        windowsHide: true,
        shell: false
    });

    child.unref(); // Allow the parent process to exit
    
    console.log('[SYSTEM] siteops started in background.');
    console.log('[SYSTEM] Diagnostic ID: ' + Math.random().toString(36).substring(7).toUpperCase());
    process.exit(0); // Exit terminal immediately
};

boot();
