const { ipcRenderer } = require('electron');

const container = document.getElementById('container');
const answerArea = document.getElementById('answer-area');
const batchCounter = document.getElementById('batch-counter');
const statusDot = document.getElementById('status-dot');


// ═══════════════════════════════════════════
//  PHANTOM-BATCH RENDERER v11.0
// ═══════════════════════════════════════════

let questions = [[]]; // 2D array: [QuestionIndex][LineIndex]
let qIdx = 0;
let lIdx = 0;
let isPinned = false;
let rawText = "";

ipcRenderer.on('update-hud', (event, state) => {
    const navInfo = questions.length > 0 ? `Q:${qIdx+1}/${questions.length}` : '';
    const topLock = state.isAlwaysOnTop ? ' T' : '';
    const sectionInfo = ` [${state.activeSection}]`;
    const combatStatus = state.isCombatMode ? ' (LEX-SAFE)' : '';
    
    batchCounter.innerText = `[${state.count}/10] ${navInfo}${sectionInfo}${topLock}${combatStatus}`;

    // Update dot color based on combat mode
    statusDot.style.background = state.isCombatMode ? '#00ffcc' : '#f44336';

    // Global Visibility (Alt+X / Jitter)
    container.style.display = state.isForcedHidden ? 'none' : 'flex';
    
    if (isPinned) {
        container.classList.add('pinned');
    } else {
        container.classList.remove('pinned');
    }

    renderView();
});

ipcRenderer.on('update-ans', (event, text) => {
    if (!text || text === rawText) return;
    rawText = text;

    // Restore multi-question support via message dividers
    const messageBlocks = text.split(/───/);
    questions = messageBlocks.map(block => {
        return block.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }).filter(q => q.length > 0);

    if (questions.length > 0) {
        statusDot.classList.remove('active'); 
    } else {
        statusDot.classList.add('active'); 
    }

    if (qIdx >= questions.length) qIdx = questions.length - 1;
    if (qIdx < 0) qIdx = 0;
    
    renderView();

    // Auto-Scroll
    setTimeout(() => {
        answerArea.scrollTop = answerArea.scrollHeight;
    }, 50);
});

ipcRenderer.on('nav', (event, action) => {
    if (action === 'next-q') qIdx = Math.min(qIdx + 1, questions.length - 1);
    if (action === 'prev-q') qIdx = Math.max(qIdx - 1, 0);
    if (action === 'next-l') lIdx = Math.min(lIdx + 1, (questions[qIdx]?.length || 1) - 1);
    if (action === 'prev-l') lIdx = Math.max(lIdx - 1, 0);
    
    // Reset line index when switching questions
    if (action.includes('-q')) lIdx = 0;
    
    renderView();
});

function renderView() {
    const currentQ = questions[qIdx] || [];
    const fullAnswerText = currentQ.join('\n');
    
    if (fullAnswerText) {
        statusDot.classList.remove('active');
        
        // Label the Question (always visible at top)
        let mcqMatch = fullAnswerText.match(/^\(?([A-D])\)?[\s.:]/i);
        let label = `[Q${qIdx+1}${mcqMatch ? ':' + mcqMatch[1].toUpperCase() : ''}] `;
        
        // Show Full Answer (Limit to 4 lines via CSS)
        answerArea.innerHTML = `<span class="q-prefix">${label}</span><span class="stealth-line">${highlightCode(fullAnswerText)}</span>`;
        
        if (isPinned) {
            container.classList.add('active'); // Show border/box if pinned
        } else {
            container.classList.remove('active'); // Max Stealth
        }
    } else if (rawText === 'SOLVING') {
        answerArea.innerHTML = `<div style="opacity: 0.2; font-size: 8px; letter-spacing: 2px;">SYS_RESOLVING...</div>`;
    } else {
        answerArea.innerHTML = '';
    }
}

function highlightCode(text) {
    if (!text) return '';
    
    // 1. Clean markdown
    let clean = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    
    // 2. Escape HTML
    let safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Return safe text without any color spans
    return safe;
}
// Master Pinning (Alt+S or Double Click)
document.addEventListener('dblclick', () => {
    ipcRenderer.send('double-click');
});

// Sync Scroll with Ghost Line
answerArea.addEventListener('scroll', () => {
    // Optional: could translate scroll pos back to lIdx if needed
});

// 🕊️ STEALTH CLICK ROUTING
ipcRenderer.on('stealth-click', (event, { x, y }) => {
    const el = document.elementFromPoint(x, y);
    if (el) {
        // Trigger a real click event on the target
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y
        });
        el.dispatchEvent(clickEvent);
        
        // Handle double-click specifically if needed
        const now = Date.now();
        if (el._lastClick && (now - el._lastClick < 300)) {
            const dblClickEvent = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: y
            });
            el.dispatchEvent(dblClickEvent);
        }
        el._lastClick = now;
    }
});
