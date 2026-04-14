import sys
import os
import re

# 🛡️ DEPENDENCY CHECK: Ensure uiautomation is available
try:
    import uiautomation as auto
except ImportError:
    print("ERROR: Missing Python dependency 'uiautomation'.\nRun: pip install uiautomation")
    sys.exit(1)

# ═══════════════════════════════════════════
#  UNIVERSAL STEALTH EXTRACTOR v2.0
# ═══════════════════════════════════════════

def get_universal_text():
    try:
        auto.uiautomation.DEBUG_SEARCH_TIME = False
        auto.uiautomation.SET_TEXT_WAIT_TIME = 0.2

        # 1. Capture Foreground window
        hwnd = auto.GetForegroundWindow()
        if not hwnd: return "ERROR: No active window."

        window = auto.ControlFromHandle(hwnd)
        if not window: return "ERROR: Attach failed."

        # 🎯 RENDERER WAKE-UP
        try: window.GetPropertyValue(auto.PropertyId.IsPasswordPropertyId)
        except: pass

        extracted = []
        seen = set()

        # 🚫 BLACKLIST (Ignore these UI elements)
        BLACKLIST = {
            'TitleBarControl', 'MenuBarControl', 'ScrollBarControl', 
            'ToolBarControl', 'ThumbControl', 'HeaderControl', 
            'ButtonControl' # Usually buttons are just noise, content is in TextControls
        }

        # 🧹 NOISE FILTER (Ignore specific UI labels & junk)
        NOISE = {
            "minimize", "maximize", "close", "search tabs", "extensions", 
            "chrome", "edge", "firefox", "new tab", "address and search bar",
            "bookmark", "share this page", "settings", "view site information",
            "time remaining", "submit exam", "proctoring is active", "question of",
            "share this", "success message", "are you sure", "hurray", "complete!",
            "context menu", "image descriptions"
        }

        SOCIAL_DOMAINS = ["whatsapp.com", "twitter.com", "facebook.com", "linkedin.com", "reddit.com", "pinterest.com"]

        # 🚀 MCQ & CONTENT HEURISTICS
        def is_useful_text(text, role):
            if not text: return False
            clean = text.strip()
            if len(clean) < 2: return False
            
            low = clean.lower()
            
            # 1. Noise Keywords & UI Junk
            if any(n in low for n in NOISE): return False
            
            # 2. Social Media Links
            if any(dom in low for dom in SOCIAL_DOMAINS): return False
            
            # 3. URL-only strings (Skip raw links)
            if re.match(r'^https?://[^\s]+$', clean): return False

            # 4. MCQ Detection (A, B, C, D Patterns)
            mcq_pattern = r'^\(?[A-D0-9ivx]\)?[\s.:-]'
            if re.search(mcq_pattern, clean): return True

            # 5. Code/Equation Detection (The "Gold")
            # Look for common code markers like braces, semicolons, comments
            if any(char in clean for char in '{};$='): return True
            if clean.startswith('//') or clean.startswith('/*'): return True

            # 6. General Content (3+ words or sentence ending)
            words = clean.split()
            if len(words) >= 3: return True
            if re.search(r'[.!?:]$', clean): return True

            return False

        def clean_val(text):
            return re.sub(r'\s+', ' ', str(text)).strip()

        # 🔍 THE SMART WALKER
        def walk(ctrl, depth=0):
            if depth > 40: return # Performance safety
            
            try:
                role = ctrl.ControlTypeName
                if role in BLACKLIST: return

                # Capture text from this control
                text_to_check = []
                
                # Try Name and Value
                if ctrl.Name: text_to_check.append(ctrl.Name)
                
                try: 
                    v = ctrl.GetValuePattern().Value
                    if v: text_to_check.append(v)
                except: pass

                # Process candidates
                for raw in text_to_check:
                    clean = clean_val(raw)
                    if is_useful_text(clean, role):
                        norm = clean.lower()
                        if norm not in seen:
                            extracted.append(clean)
                            seen.add(norm)

                # Recursively walk children (ordered)
                for child in ctrl.GetChildren():
                    walk(child, depth + 1)
                    
            except: pass

        # Pass 1: Try to locate the main content pane (Efficient)
        # Browsers usually have a large Pane or Document
        candidates = [
            window.DocumentControl(),
            window.PaneControl(Name="Main"),
            window.GroupControl(searchDepth=2)
        ]
        
        found_start = False
        for c in candidates:
            if c.Exists(0.1):
                walk(c)
                found_start = True
                break
        
        # Pass 2: Fallback to global crawl if needed
        if not found_start or len(extracted) < 5:
            walk(window)

        # 🏁 FORMAT OUTPUT
        if extracted:
            # Join with dividers to help the ChatGPT script separate questions
            return "\n\n".join(extracted)
        else:
            return f"TARGET: {window.Name}"

    except Exception as e:
        return f"ERROR: {str(e)}"

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')
    print(get_universal_text())
