// ==========================================================================
// CORE STATE MANAGER
// ==========================================================================
const state = {
    activeMode: 'explain', // explain, translate, analyze, refactor, chat
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    backendHasKey: false,
    chatHistory: [],
    templates: {
        fibonacci: {
            code: `def fibonacci(n):
    # Base cases
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    
    # Recursive breakdown
    return fibonacci(n - 1) + fibonacci(n - 2)`,
            language: 'python'
        },
        bubble_sort: {
            code: `def bubble_sort(arr):
    n = len(arr)
    # Traverse through all array elements
    for i in range(n):
        # Last i elements are already in place
        for j in range(0, n - i - 1):
            # Swap if the element found is greater than the next element
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
            language: 'python'
        },
        binary_search: {
            code: `function binarySearch(arr, target) {
    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
        let mid = Math.floor((left + right) / 2);

        // Check if target is present at mid
        if (arr[mid] === target) {
            return mid;
        }
        // If target greater, ignore left half
        if (arr[mid] < target) {
            left = mid + 1;
        } 
        // If target is smaller, ignore right half
        else {
            right = mid - 1;
        }
    }

    // Element was not present
    return -1;
}`,
            language: 'javascript'
        },
        sql_join: {
            code: `SELECT 
    o.order_id,
    c.customer_name,
    o.order_date,
    SUM(d.quantity * d.unit_price) AS total_revenue
FROM orders o
INNER JOIN customers c ON o.customer_id = c.customer_id
INNER JOIN order_details d ON o.order_id = d.order_id
WHERE o.status = 'Shipped' AND o.order_date >= '2026-01-01'
GROUP BY o.order_id, c.customer_name, o.order_date
ORDER BY total_revenue DESC
LIMIT 10;`,
            language: 'sql'
        }
    }
};

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
const DOM = {
    codeEditor: document.getElementById('codeEditor'),
    lineNumbers: document.getElementById('lineNumbers'),
    templateSelect: document.getElementById('templateSelect'),
    languageSelect: document.getElementById('languageSelect'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    optionsExplain: document.getElementById('optionsExplain'),
    optionsTranslate: document.getElementById('optionsTranslate'),
    optionsRefactor: document.getElementById('optionsRefactor'),
    detailLevelSelect: document.getElementById('detailLevelSelect'),
    targetLangSelect: document.getElementById('targetLangSelect'),
    refactorGoalSelect: document.getElementById('refactorGoalSelect'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    outputContent: document.getElementById('outputContent'),
    outputPaneTitle: document.getElementById('outputPaneTitle'),
    outputPaneActions: document.getElementById('outputPaneActions'),
    chatContainer: document.getElementById('chatContainer'),
    chatThread: document.getElementById('chatThread'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    copyOutputBtn: document.getElementById('copyOutputBtn'),
    statusBadge: document.getElementById('statusBadge'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
    saveKeyBtn: document.getElementById('saveKeyBtn'),
    clearKeyBtn: document.getElementById('clearKeyBtn')
};

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Check backend health and configuration
    checkBackendStatus();

    // Setup Textarea & Line Numbers syncing
    DOM.codeEditor.addEventListener('scroll', () => {
        DOM.lineNumbers.scrollTop = DOM.codeEditor.scrollTop;
    });
    DOM.codeEditor.addEventListener('input', () => {
        updateLineNumbers();
        // Clear chat history if code changes to prevent contextual divergence
        state.chatHistory = [];
        resetChatUI();
    });
    DOM.codeEditor.addEventListener('keydown', handleEditorTab);

    // Template Loading
    DOM.templateSelect.addEventListener('change', loadTemplate);

    // Mode Sidebar switching
    DOM.modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = btn.closest('.mode-btn').dataset.mode;
            switchMode(mode);
        });
    });

    // Run action
    DOM.analyzeBtn.addEventListener('click', runAnalysis);

    // Copy to clipboard
    DOM.copyOutputBtn.addEventListener('click', copyOutputToClipboard);

    // Settings Modal
    DOM.openSettingsBtn.addEventListener('click', openSettings);
    DOM.closeSettingsBtn.addEventListener('click', closeSettings);
    DOM.toggleApiKeyVisibility.addEventListener('click', toggleApiKeyVisibility);
    DOM.saveKeyBtn.addEventListener('click', saveApiKey);
    DOM.clearKeyBtn.addEventListener('click', clearApiKey);
    
    // Chat Form Submission
    DOM.chatForm.addEventListener('submit', submitChatMessage);

    // Initial setup
    updateLineNumbers();
});

// ==========================================================================
// CODE EDITOR CUSTOMIZATIONS
// ==========================================================================
function updateLineNumbers() {
    const text = DOM.codeEditor.value;
    const lines = text.split('\n');
    const lineCount = lines.length || 1;
    let numHtml = '';
    for (let i = 1; i <= lineCount; i++) {
        numHtml += `${i}\n`;
    }
    DOM.lineNumbers.textContent = numHtml;
}

function handleEditorTab(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const spaces = '    '; // 4 spaces
        this.value = this.value.substring(0, start) + spaces + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + spaces.length;
        updateLineNumbers();
    }
}

function loadTemplate() {
    const templateName = DOM.templateSelect.value;
    const template = state.templates[templateName];
    if (template) {
        DOM.codeEditor.value = template.code;
        DOM.languageSelect.value = template.language;
        updateLineNumbers();
        state.chatHistory = [];
        resetChatUI();
    }
}

// ==========================================================================
// MODE CONTROLLER
// ==========================================================================
function switchMode(mode) {
    state.activeMode = mode;
    
    // Highlight sidebar button
    DOM.modeBtns.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Hide/Show option configuration groups
    DOM.optionsExplain.classList.add('hidden');
    DOM.optionsTranslate.classList.add('hidden');
    DOM.optionsRefactor.classList.add('hidden');

    if (mode === 'explain') {
        DOM.optionsExplain.classList.remove('hidden');
    } else if (mode === 'translate') {
        DOM.optionsTranslate.classList.remove('hidden');
    } else if (mode === 'refactor') {
        DOM.optionsRefactor.classList.remove('hidden');
    }

    // Adjust visibility of right pane content (Chat vs. Analysis Output)
    if (mode === 'chat') {
        DOM.outputContent.classList.add('hidden');
        DOM.chatContainer.classList.remove('hidden');
        DOM.outputPaneTitle.innerHTML = `<i data-lucide="message-square" class="text-cyan"></i> <span>Interactive AI Chat</span>`;
        DOM.outputPaneActions.classList.add('hidden'); // Hide copy output btn for chat thread
        DOM.analyzeBtn.classList.add('hidden'); // Chat has its own submit
    } else {
        DOM.outputContent.classList.remove('hidden');
        DOM.chatContainer.classList.add('hidden');
        DOM.outputPaneActions.classList.remove('hidden');
        DOM.analyzeBtn.classList.remove('hidden');

        // Adjust title and button text based on mode
        let titleHtml = '';
        let btnHtml = '';

        if (mode === 'explain') {
            titleHtml = `<i data-lucide="file-text" class="text-cyan"></i> <span>AI Explanation Output</span>`;
            btnHtml = `<i data-lucide="play" class="btn-icon"></i> <span>Run Code Explanation</span>`;
        } else if (mode === 'translate') {
            titleHtml = `<i data-lucide="languages" class="text-cyan"></i> <span>AI Language Translation</span>`;
            btnHtml = `<i data-lucide="play" class="btn-icon"></i> <span>Translate Code</span>`;
        } else if (mode === 'analyze') {
            titleHtml = `<i data-lucide="shield-alert" class="text-cyan"></i> <span>Complexity & Vulnerability Analysis</span>`;
            btnHtml = `<i data-lucide="play" class="btn-icon"></i> <span>Analyze Security & Complexity</span>`;
        } else if (mode === 'refactor') {
            titleHtml = `<i data-lucide="zap" class="text-cyan"></i> <span>AI Optimized Code Output</span>`;
            btnHtml = `<i data-lucide="play" class="btn-icon"></i> <span>Refactor & Optimize Code</span>`;
        }

        DOM.outputPaneTitle.innerHTML = titleHtml;
        DOM.analyzeBtn.innerHTML = btnHtml;
    }

    // Refresh icons inside dynamically updated headers
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==========================================================================
// API CLIENT IMPLEMENTATION
// ==========================================================================
async function checkBackendStatus() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            const data = await response.json();
            state.backendHasKey = data.has_env_key;
            updateStatusIndicator();
        }
    } catch (e) {
        console.error("Backend health check failed. Using client state defaults.");
    }
}

function updateStatusIndicator() {
    const isLive = state.backendHasKey || state.geminiKey.trim() !== '';
    if (isLive) {
        DOM.statusBadge.innerHTML = `<span class="status-dot pulse-success"></span> <span class="status-text text-success">Live AI Mode</span>`;
    } else {
        DOM.statusBadge.innerHTML = `<span class="status-dot pulse-warning"></span> <span class="status-text text-warning">Simulation Mode</span>`;
    }
}

async function runAnalysis() {
    const code = DOM.codeEditor.value.trim();
    if (!code) {
        showOutputHTML(`<div class="empty-state">
            <i data-lucide="alert-circle" class="empty-icon text-error"></i>
            <h3>No Code Detected</h3>
            <p>Please enter or paste your code in the editor, or select a sample template to test.</p>
        </div>`);
        lucide.createIcons();
        return;
    }

    // Start loading state
    setLoadingState(true);

    const language = DOM.languageSelect.value;
    let endpoint = '';
    let payload = { code, language };

    // Determine payload based on mode
    if (state.activeMode === 'explain') {
        endpoint = '/api/explain';
        payload.detail_level = DOM.detailLevelSelect.value;
    } else if (state.activeMode === 'translate') {
        endpoint = '/api/translate';
        payload.source_language = language;
        payload.target_language = DOM.targetLangSelect.value;
    } else if (state.activeMode === 'analyze') {
        endpoint = '/api/analyze';
    } else if (state.activeMode === 'refactor') {
        endpoint = '/api/refactor';
        payload.goal = DOM.refactorGoalSelect.value;
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (state.geminiKey) {
            headers['X-Gemini-Key'] = state.geminiKey;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const htmlResult = renderMarkdown(data.result);
        showOutputHTML(htmlResult);

    } catch (error) {
        showOutputHTML(`<div class="empty-state">
            <i data-lucide="alert-triangle" class="empty-icon text-error"></i>
            <h3>Request Failed</h3>
            <p>${error.message}. Please check if the local server is running or try again later.</p>
        </div>`);
        lucide.createIcons();
    } finally {
        setLoadingState(false);
    }
}

// ==========================================================================
// CHAT SERVICES
// ==========================================================================
function resetChatUI() {
    DOM.chatThread.innerHTML = `<div class="chat-bubble assistant">
        <div class="bubble-text">
            Hello! Ask me any question about the code snippet in your editor. I can explain specific lines, propose alternatives, or check edge cases!
        </div>
    </div>`;
}

async function submitChatMessage(e) {
    e.preventDefault();
    const question = DOM.chatInput.value.trim();
    const code = DOM.codeEditor.value.trim();
    
    if (!question) return;
    if (!code) {
        appendChatBubble('assistant', 'Please paste code into the editor before initiating questions.');
        DOM.chatInput.value = '';
        return;
    }

    // Append User message
    appendChatBubble('user', question);
    DOM.chatInput.value = '';

    // Append temporary assistant typing bubble
    const typingBubble = appendChatBubble('assistant', '<div class="skeleton-line" style="width: 100px; height: 10px;"></div>');

    const language = DOM.languageSelect.value;
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (state.geminiKey) {
            headers['X-Gemini-Key'] = state.geminiKey;
        }

        const payload = {
            code,
            language,
            question,
            history: state.chatHistory
        };

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server error (${response.status})`);
        }

        const data = await response.json();
        
        // Remove typing bubble and render actual answer
        typingBubble.remove();
        
        // Render answer
        const bubbleContainer = appendChatBubble('assistant', renderMarkdown(data.result), true);
        
        // Update history
        state.chatHistory.push({ role: 'user', content: question });
        state.chatHistory.push({ role: 'assistant', content: data.result });

    } catch (error) {
        typingBubble.remove();
        appendChatBubble('assistant', `Failed to send question: ${error.message}`);
    }
}

function appendChatBubble(role, content, isHTML = false) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'bubble-text';
    if (isHTML) {
        textDiv.innerHTML = content;
    } else {
        textDiv.textContent = content;
    }
    
    bubble.appendChild(textDiv);
    DOM.chatThread.appendChild(bubble);
    DOM.chatThread.scrollTop = DOM.chatThread.scrollHeight;
    
    return bubble;
}

// ==========================================================================
// CUSTOM RENDERING (MARKDOWN TO HTML)
// ==========================================================================
function renderMarkdown(md) {
    if (!md) return '';
    
    let html = md;

    // 1. Escaping script tags or malicious tags to prevent XSS
    html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');

    // 2. Alert Blocks: Github syntax (> [!NOTE] or > [!WARNING])
    html = html.replace(/^>\s*\[!NOTE\]\s*\n([\s\S]*?)(?=\n[^>]|$)/gm, (match, content) => {
        const cleaned = content.replace(/^>\s?/gm, '').trim();
        return `<blockquote class="note-alert"><strong><i data-lucide="info" class="icon-inline"></i> Note:</strong><p>${cleaned.replace(/\n/g, '<br>')}</p></blockquote>`;
    });
    html = html.replace(/^>\s*\[!WARNING\]\s*\n([\s\S]*?)(?=\n[^>]|$)/gm, (match, content) => {
        const cleaned = content.replace(/^>\s?/gm, '').trim();
        return `<blockquote class="warning-alert"><strong><i data-lucide="alert-triangle" class="icon-inline"></i> Warning:</strong><p>${cleaned.replace(/\n/g, '<br>')}</p></blockquote>`;
    });
    html = html.replace(/^>\s*\[!IMPORTANT\]\s*\n([\s\S]*?)(?=\n[^>]|$)/gm, (match, content) => {
        const cleaned = content.replace(/^>\s?/gm, '').trim();
        return `<blockquote class="warning-alert" style="border-left-color: var(--color-primary); background: rgba(139, 92, 246, 0.03);"><strong><i data-lucide="alert-circle" class="icon-inline"></i> Important:</strong><p>${cleaned.replace(/\n/g, '<br>')}</p></blockquote>`;
    });

    // Standard blockquotes
    html = html.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');

    // 3. Fenced Code Blocks: ```javascript ... ```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const escapedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
    });

    // 4. Headers: ### Title, #### Title, etc.
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gm, '<h3>$1</h3>');

    // 5. Lists (Unordered & Ordered)
    // Bullet lists: - item or * item
    html = html.replace(/^\s*[\-\*]\s+(.*)$/gm, '<li>$1</li>');
    // Wrap consecutive lists inside <ul>
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>'); // Simplified wrap (since we parse in batches, we can do list cleanup below)
    
    // Ordered lists: 1. item
    html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');
    
    // Clean up adjacent lists (a simple wrapper repair)
    html = html.replace(/<\/li>\n<li>/g, '</li><li>');
    html = html.replace(/([^>])(<li>)/g, '$1<ul>$2');
    html = html.replace(/(<\/li>)(?!<li>|<\/ul>)/g, '$1</ul>');

    // 6. Inline Code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 7. Bold: **text**
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');

    // 8. Linebreaks & Paragraphs
    // To make sure block elements don't get wrapped in paragraphs, we replace text chunks
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        // If it starts with block element, don't wrap in p tag
        if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<block') || trimmed.startsWith('<li>')) {
            return trimmed;
        }
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    // Clean up empty lines
    html = html.replace(/<p><\/p>/g, '');

    // Re-initialize any icons we output in warnings/notes
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 50);

    return html;
}

// ==========================================================================
// SETTINGS DIALOG (API KEY SETUPS)
// ==========================================================================
function openSettings() {
    DOM.apiKeyInput.value = state.geminiKey;
    DOM.settingsModal.classList.remove('hidden');
}

function closeSettings() {
    DOM.settingsModal.classList.add('hidden');
}

function toggleApiKeyVisibility() {
    const type = DOM.apiKeyInput.type === 'password' ? 'text' : 'password';
    DOM.apiKeyInput.type = type;
    
    const icon = DOM.toggleApiKeyVisibility.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
        lucide.createIcons();
    }
}

function saveApiKey() {
    const key = DOM.apiKeyInput.value.trim();
    state.geminiKey = key;
    if (key) {
        localStorage.setItem('gemini_api_key', key);
    } else {
        localStorage.removeItem('gemini_api_key');
    }
    updateStatusIndicator();
    closeSettings();
}

function clearApiKey() {
    state.geminiKey = '';
    localStorage.removeItem('gemini_api_key');
    DOM.apiKeyInput.value = '';
    updateStatusIndicator();
    closeSettings();
}

// ==========================================================================
// INTERACTIVE ACTIONS & UI UPDATING HELPERS
// ==========================================================================
function showOutputHTML(html) {
    DOM.outputContent.innerHTML = html;
}

function setLoadingState(isLoading) {
    if (isLoading) {
        DOM.analyzeBtn.disabled = true;
        // Keep button icons spinning if needed
        DOM.outputContent.innerHTML = `
            <div class="skeleton-loader">
                <div class="skeleton-title"></div>
                <div class="skeleton-line" style="width: 90%;"></div>
                <div class="skeleton-line" style="width: 85%;"></div>
                <div class="skeleton-line" style="width: 95%;"></div>
                <div class="skeleton-line" style="width: 60%;"></div>
                
                <br>
                <div class="skeleton-title" style="width: 30%;"></div>
                <div class="skeleton-line" style="width: 80%;"></div>
                <div class="skeleton-line" style="width: 75%;"></div>
                <div class="skeleton-line" style="width: 40%;"></div>
            </div>
        `;
    } else {
        DOM.analyzeBtn.disabled = false;
    }
}

function copyOutputToClipboard() {
    // Extract text content from output panel
    const text = DOM.outputContent.innerText;
    if (!text || text.includes("Ready for Analysis")) return;

    navigator.clipboard.writeText(text).then(() => {
        const icon = DOM.copyOutputBtn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'check');
            lucide.createIcons();
            
            setTimeout(() => {
                icon.setAttribute('data-lucide', 'copy');
                lucide.createIcons();
            }, 2000);
        }
    }).catch(err => {
        console.error('Could not copy output: ', err);
    });
}
