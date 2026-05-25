// COLLABCODE PRO - MONACO EDITOR CONTROLLER, COLLABORATION CHAT, & WebRTC CALLS

let editorInstance = null;
let socket = null;
let room = '';
let isRemoteChange = false;
let pendingServerData = null; // Buffer to hold server data if it loads before Monaco

// Multi-file state
let files = {
  "index.js": {
    code: `// Welcome to COLLABCODE Pro!\n// Start coding together in real-time!\n\nconsole.log("Hello from Collab Pro!");\n`,
    language: "javascript"
  }
};
let activeFile = "index.js";

// Visual theme configurations
let userInitialColors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#eab308', '#f97316'];

// WebRTC video calls state
let localStream = null;
let peerConnections = {}; // socketId -> RTCPeerConnection
const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Read room ID from query string
const urlParams = new URLSearchParams(window.location.search);
room = urlParams.get('room');

if (!room) {
  window.location.href = './index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialise Action Buttons
  const shareBtn = document.getElementById('btn-share');
  const saveBtn = document.getElementById('btn-save');
  const forkBtn = document.getElementById('btn-fork');
  const runBtn = document.getElementById('btn-run');
  const chatToggleBtn = document.getElementById('btn-chat-toggle');
  const addFileBtn = document.getElementById('btn-add-file');
  const languageSelect = document.getElementById('select-language');
  const themeSelect = document.getElementById('select-theme');

  // Copy shareable link
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const fullUrl = window.location.href;
      copyToClipboard(fullUrl, 'Share link copied to clipboard!');
      
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = '✓ Copied!';
      shareBtn.style.borderColor = 'var(--accent-green)';
      setTimeout(() => {
        shareBtn.innerHTML = originalText;
        shareBtn.style.borderColor = '';
      }, 1500);
    });
  }

  // Fork session (duplicates room code to a new session)
  if (forkBtn) {
    forkBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('collab_token');
      if (!token) {
        showToast('Please sign in to fork workspaces under your account', 'error');
        return;
      }

      forkBtn.setAttribute('disabled', 'disabled');
      forkBtn.innerHTML = '🍴 Forking...';

      const newRoom = generateRoomId();

      try {
        const response = await fetch('/api/sessions/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            roomId: newRoom,
            title: `Fork of ${room}`,
            files: files,
            activeFile: activeFile
          })
        });

        if (response.ok) {
          showToast('Session successfully forked! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = `./editor.html?room=${newRoom}`;
          }, 1200);
        } else {
          showToast('Failed to fork session', 'error');
          resetForkBtn();
        }
      } catch (err) {
        // Fallback for mock saving local testing
        setTimeout(() => {
          localStorage.setItem(`mock_room_${newRoom}`, JSON.stringify({ files, activeFile, timestamp: Date.now() }));
          showToast('[Mock Fork] Session duplicated locally! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = `./editor.html?room=${newRoom}`;
          }, 1200);
        }, 1000);
      }
    });
  }

  function resetForkBtn() {
    forkBtn.removeAttribute('disabled');
    forkBtn.innerHTML = '🍴 Fork';
  }

  // Save session to MongoDB (handles multi-file saving)
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!isAuthenticated()) {
        sessionStorage.setItem('redirect_room_id', room);
        showToast('Please sign in to save your workspace session', 'error');
        setTimeout(() => {
          window.location.href = './auth.html';
        }, 1200);
        return;
      }

      const token = localStorage.getItem('collab_token');

      saveBtn.setAttribute('disabled', 'disabled');
      saveBtn.innerHTML = '💾 Saving...';

      try {
        const response = await fetch('/api/sessions/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            roomId: room, 
            files: files, 
            activeFile: activeFile 
          })
        });

        if (response.ok) {
          showToast('Session saved to database!', 'success');
          saveBtn.innerHTML = '✓ Saved!';
          setTimeout(() => {
            saveBtn.removeAttribute('disabled');
            saveBtn.innerHTML = '💾 Save';
          }, 1500);
        } else {
          const result = await response.json();
          showToast(result.message || 'Failed to save session', 'error');
          resetSaveBtn();
        }
      } catch (error) {
        console.warn('Backend connection failed. Saving locally...', error);
        
        setTimeout(() => {
          localStorage.setItem(`mock_room_${room}`, JSON.stringify({ files, activeFile, timestamp: Date.now() }));
          showToast('[Mock Connected] Saved to local device!', 'success');
          saveBtn.innerHTML = '✓ Saved!';
          setTimeout(() => {
            saveBtn.removeAttribute('disabled');
            saveBtn.innerHTML = '💾 Save';
          }, 1500);
        }, 1000);
      }
    });
  }

  function resetSaveBtn() {
    saveBtn.removeAttribute('disabled');
    saveBtn.innerHTML = '💾 Save';
  }

  // Toggle Chat and WebRTC calls sidebar pane drawer
  if (chatToggleBtn) {
    chatToggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar-pane');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
          chatToggleBtn.innerHTML = '💬 Chat';
          chatToggleBtn.style.background = '';
          chatToggleBtn.style.color = '';
        } else {
          chatToggleBtn.innerHTML = '✕ Close Chat';
          chatToggleBtn.style.background = 'rgba(255, 23, 68, 0.08)';
          chatToggleBtn.style.borderColor = 'rgba(255, 23, 68, 0.2)';
          chatToggleBtn.style.color = 'var(--accent-red)';
          // Scroll chat messages to bottom
          const chatMsgBox = document.getElementById('chat-messages');
          if (chatMsgBox) chatMsgBox.scrollTop = chatMsgBox.scrollHeight;
        }
      }
    });
  }

  // Add File button tab row click handler
  if (addFileBtn) {
    addFileBtn.addEventListener('click', () => {
      const filename = prompt('Enter new filename (e.g. style.css, utils.py):');
      if (!filename) return;

      const trimmedName = filename.trim();
      if (trimmedName === '') return;

      if (files[trimmedName]) {
        showToast('A file with this name already exists!', 'error');
        return;
      }

      // Infer syntax language from extension
      const extension = trimmedName.split('.').pop().toLowerCase();
      let language = 'javascript';
      if (extension === 'py') language = 'python';
      if (extension === 'css') language = 'css';
      if (extension === 'html') language = 'html';
      if (extension === 'ts') language = 'typescript';
      if (extension === 'json') language = 'json';
      if (extension === 'md') language = 'markdown';

      // Local addition
      files[trimmedName] = {
        code: `// File: ${trimmedName}\n`,
        language: language
      };

      // Emit event
      if (socket && socket.connected) {
        socket.emit('file-create', { room, filename: trimmedName, language: language });
      }

      // Switch to new file tab
      switchActiveFile(trimmedName);
      renderTabs();
      showToast(`File ${trimmedName} created!`, 'success');
    });
  }

  // Theme dropdown switch event
  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const themeVal = themeSelect.value;
      
      // Update body styles variables class theme
      document.body.className = '';
      if (themeVal === 'monokai') document.body.classList.add('theme-monokai');
      if (themeVal === 'vs-light') document.body.classList.add('theme-vs-light');
      if (themeVal === 'hc-black') document.body.classList.add('theme-hc-black');

      if (editorInstance) {
        // Toggle Monaco editor built-in visual frames
        let monacoTheme = 'collabcode-dark';
        if (themeVal === 'vs-light') monacoTheme = 'vs';
        if (themeVal === 'hc-black') monacoTheme = 'hc-black';
        if (themeVal === 'monokai') monacoTheme = 'vs-dark'; // monaco default dark or custom Monokai
        
        monaco.editor.setTheme(monacoTheme);
      }

      showToast('Visual theme adjusted', 'success');
    });
  }

  // Init Sockets, Monaco, Chat, and Call relays
  initMonacoEditor();
  initSocketIO();
  setupChatMessaging();
  setupWebRTCCalls();
});

// INITIALISE MONACO EDITOR
function initMonacoEditor() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  editorContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-family:var(--font-sans);">Initializing IDE Core...</div>`;

  require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } });
  
  require(['vs/editor/editor.main'], () => {
    editorContainer.innerHTML = '';

    // Define standard custom dark theme
    monaco.editor.defineTheme('collabcode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', background: '0c0d11' },
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00e676', fontStyle: 'bold' },
        { token: 'string', foreground: '00b0ff' },
        { token: 'number', foreground: 'ffd600' },
        { token: 'regexp', foreground: 'ffd600' }
      ],
      colors: {
        'editor.background': '#0c0d11',
        'editor.foreground': '#f1f5f9',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#00e676',
        'editor.lineHighlightBackground': '#171a22',
        'editorCursor.foreground': '#00e676',
        'scrollbarSlider.background': '#1e293b40',
        'scrollbarSlider.hoverBackground': '#00e67640',
        'scrollbarSlider.activeBackground': '#00e67660'
      }
    });

    // Attempt to load mock cached version if available
    const cached = localStorage.getItem(`mock_room_${room}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.files) {
          files = parsed.files;
          activeFile = parsed.activeFile || Object.keys(files)[0];
        }
      } catch(e){}
    }

    // Set drop-down select language value of active file
    const activeFileData = files[activeFile] || Object.values(files)[0];
    const selectLanguage = document.getElementById('select-language');
    if (selectLanguage && activeFileData) {
      selectLanguage.value = activeFileData.language;
    }

    // Spawn editor instance
    editorInstance = monaco.editor.create(editorContainer, {
      theme: 'collabcode-dark',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontLigatures: true,
      lineHeight: 22,
      automaticLayout: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      wordWrap: 'on',
      minimap: { enabled: false },
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      },
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: 'always'
    });

    // Load server data if it arrived before editor was ready, otherwise fallback
    if (pendingServerData) {
      applyServerCode(pendingServerData);
      pendingServerData = null;
    } else {
      switchActiveFile(activeFile);
      renderTabs();
    }

    // Event: Capture code changes and emit
    editorInstance.onDidChangeModelContent((event) => {
      if (isRemoteChange) return;

      const currentCode = editorInstance.getValue();
      
      // Update our local state
      if (files[activeFile]) {
        files[activeFile].code = currentCode;
      }

      // Save locally as temporary auto-save
      localStorage.setItem(`mock_room_${room}_temp`, currentCode);

      if (socket && socket.connected) {
        socket.emit('code-change', { room, code: currentCode, filename: activeFile });
      }
    });

    // Language selector change listener
    const languageSelect = document.getElementById('select-language');
    if (languageSelect) {
      languageSelect.addEventListener('change', () => {
        const lang = languageSelect.value;
        if (files[activeFile]) {
          files[activeFile].language = lang;
        }
        setEditorLanguage(lang);
        if (socket && socket.connected) {
          socket.emit('language-change', { room, language: lang, filename: activeFile });
        }
        renderTabs();
        showToast(`Syntax set to ${lang.toUpperCase()}`, 'success');
      });
    }

    // Code runner setup
    setupCodeSandboxRunner();
  });
}

// RENDER TAB ROW ITEMS
function renderTabs() {
  const tabsList = document.getElementById('tabs-list');
  if (!tabsList) return;

  tabsList.innerHTML = '';

  Object.keys(files).forEach(filename => {
    const fileData = files[filename];
    const isMainFile = filename === "index.js";

    const tab = document.createElement('div');
    tab.className = `tab ${filename === activeFile ? 'active' : ''}`;
    
    // Icon based on extension
    let icon = '📄';
    if (fileData.language === 'python') icon = '🐍';
    if (fileData.language === 'html') icon = '🌐';
    if (fileData.language === 'css') icon = '🎨';
    if (fileData.language === 'markdown') icon = '📝';

    tab.innerHTML = `
      <span>${icon} ${filename}</span>
      ${!isMainFile ? `<span class="tab-close" onclick="deleteFileTab(event, '${filename}')" title="Delete File">×</span>` : ''}
    `;

    tab.addEventListener('click', (e) => {
      // Avoid firing tab swap on close button click
      if (e.target.classList.contains('tab-close')) return;
      
      switchActiveFile(filename);
      if (socket && socket.connected) {
        socket.emit('file-switch', { room, filename });
      }
    });

    tabsList.appendChild(tab);
  });
}

// SWAP DYNAMIC ACTIVE FILE MODEL
function switchActiveFile(filename) {
  if (!editorInstance || !files[filename]) return;

  activeFile = filename;
  
  // Update select language dropdown
  const selectLanguage = document.getElementById('select-language');
  if (selectLanguage) {
    selectLanguage.value = files[filename].language;
  }

  // In Monaco, we switch models to keep active histories and caret indexes
  let model = monaco.editor.getModels().find(m => m.filename === filename);
  
  if (!model) {
    let monacoLang = files[filename].language;
    if (monacoLang === 'js') monacoLang = 'javascript';
    if (monacoLang === 'ts') monacoLang = 'typescript';
    if (monacoLang === 'md') monacoLang = 'markdown';
    
    model = monaco.editor.createModel(files[filename].code, monacoLang);
    model.filename = filename;
  }

  isRemoteChange = true;
  editorInstance.setModel(model);
  isRemoteChange = false;

  renderTabs();
}

// APPLY SERVER LOADED CODE BUFFER
function applyServerCode(data) {
  if (data.files) {
    files = data.files;
    activeFile = data.activeFile || "index.js";
  } else if (data.code) {
    files["index.js"] = { code: data.code, language: data.language || "javascript" };
    activeFile = "index.js";
  }
  switchActiveFile(activeFile);
  renderTabs();
}

// DELETE A TABS WRITER FILE
function deleteFileTab(event, filename) {
  event.stopPropagation();
  
  if (filename === "index.js") return;
  if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

  delete files[filename];

  if (activeFile === filename) {
    activeFile = Object.keys(files)[0] || "index.js";
  }

  if (socket && socket.connected) {
    socket.emit('file-delete', { room, filename });
  }

  switchActiveFile(activeFile);
  renderTabs();
  showToast(`File ${filename} deleted`, 'success');
}

// SWITCH EDITOR HIGHLIGHT
function setEditorLanguage(lang) {
  if (!editorInstance) return;
  const model = editorInstance.getModel();
  
  let monacoLang = lang;
  if (lang === 'js') monacoLang = 'javascript';
  if (lang === 'ts') monacoLang = 'typescript';
  if (lang === 'md') monacoLang = 'markdown';
  
  monaco.editor.setModelLanguage(model, monacoLang);
}

// SOCKETS COLLABORATION DRAWER BINDINGS
function initSocketIO() {
  const username = localStorage.getItem('collab_username') || `Dev-${Math.floor(1000 + Math.random() * 9000)}`;

  if (typeof io === 'undefined') {
    updateUsersStack([{ username, letter: username.charAt(0).toUpperCase() }]);
    return;
  }

  socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    timeout: 5000
  });

  socket.on('connect', () => {
    showToast('Connected to collaboration room!', 'success');
    socket.emit('join-room', { room, username });
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err);
    showToast(`Collaboration server offline: ${err.message}`, 'error');
  });

  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
    showToast(`Connection lost: ${reason}`, 'error');
  });

  // Sync: Loads room multi-file workspace
  socket.on('load-code', (data) => {
    if (!editorInstance) {
      pendingServerData = data; // Keep in buffer until editor is ready
      return;
    }
    applyServerCode(data);
  });

  // Sync: Dynamic character modifications
  socket.on('code-update', (data) => {
    if (!editorInstance) return;

    const file = data.filename || "index.js";
    const code = typeof data === 'string' ? data : data.code;

    // Update state silently
    if (files[file]) {
      files[file].code = code;
    } else {
      files[file] = { code, language: 'javascript' };
      renderTabs();
    }

    // If typing is happening on the active editing tab, sync model
    if (file === activeFile) {
      const model = editorInstance.getModel();
      const cursor = editorInstance.getPosition();
      
      isRemoteChange = true;
      model.setValue(code);
      isRemoteChange = false;

      if (cursor) {
        editorInstance.setPosition(cursor);
      }
    }
  });

  // Sync: Language edits
  socket.on('language-update', (data) => {
    const file = data.filename || "index.js";
    const lang = data.language || data;

    if (files[file]) {
      files[file].language = lang;
    }
    
    if (file === activeFile) {
      const select = document.getElementById('select-language');
      if (select) select.value = lang;
      setEditorLanguage(lang);
    }
    
    renderTabs();
    showToast(`Collaborator updated ${file} language syntax to ${lang.toUpperCase()}`, 'success');
  });

  // Sync: Sockets Multi-File created
  socket.on('file-created', (data) => {
    files[data.filename] = data.fileData;
    renderTabs();
    showToast(`New file added: ${data.filename}`, 'success');
  });

  // Sync: Sockets Multi-File deleted
  socket.on('file-deleted', (data) => {
    delete files[data.filename];
    if (activeFile === data.filename) {
      switchActiveFile(data.fallbackFile || "index.js");
    }
    renderTabs();
    showToast(`Collaborator deleted file: ${data.filename}`, 'success');
  });

  // Sync: Sockets Multi-File renamed
  socket.on('file-renamed', (data) => {
    files[data.newFilename] = files[data.oldFilename];
    delete files[data.oldFilename];
    if (activeFile === data.oldFilename) {
      activeFile = data.newFilename;
      switchActiveFile(activeFile);
    }
    renderTabs();
  });

  // Sync: Participants stacking
  socket.on('room-users', (users) => {
    const mapped = users.map(u => ({
      username: u.username,
      letter: u.username.charAt(0).toUpperCase()
    }));
    updateUsersStack(mapped);
  });

  // Sync: Sockets peer codes executed
  socket.on('run-update', (data) => {
    renderOutputLogs(data.logs, data.error, true);
  });
}

// UPDATE TOPBAR STACKED COLLABORATORS
function updateUsersStack(users) {
  const avatarStack = document.getElementById('avatar-stack');
  const onlineCount = document.getElementById('online-count');
  if (!avatarStack || !onlineCount) return;

  avatarStack.innerHTML = '';
  onlineCount.textContent = `${users.length} online`;

  users.forEach((user, index) => {
    let colorHash = 0;
    for (let i = 0; i < user.username.length; i++) {
      colorHash += user.username.charCodeAt(i);
    }
    const color = userInitialColors[colorHash % userInitialColors.length];

    const avatar = document.createElement('div');
    avatar.className = 'avatar-circle';
    avatar.style.backgroundColor = color;
    avatar.style.zIndex = users.length - index;
    avatar.innerHTML = `
      ${user.letter}
      <span class="avatar-tooltip">${user.username}</span>
    `;

    avatarStack.appendChild(avatar);
  });
}

// CHAT MESSAGING DRAWER CONTROLS
function setupChatMessaging() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');

  if (!chatForm || !chatInput || !chatMessages) return;

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const text = chatInput.value.trim();
    if (text === '') return;

    const username = localStorage.getItem('collab_username') || 'Developer';
    
    // 1. Render outgoing bubble
    appendChatBubble(text, username, 'outgoing');

    // 2. Emit chat message over sockets
    if (socket && socket.connected) {
      socket.emit('send-message', { room, message: text, username });
    }

    chatInput.value = '';
  });

  // Socket: Receive incoming chat messages
  if (socket) {
    socket.on('receive-message', (data) => {
      appendChatBubble(data.message, data.username, 'incoming', data.timestamp);
      
      // If sidebar is collapsed, flash toast alert badge
      const sidebar = document.getElementById('sidebar-pane');
      if (sidebar && sidebar.classList.contains('collapsed')) {
        showToast(`New message from ${data.username}: "${data.message.substring(0, 15)}..."`, 'success');
        
        // Flash glow on Chat Toggle Button
        const chatToggleBtn = document.getElementById('btn-chat-toggle');
        if (chatToggleBtn) {
          chatToggleBtn.style.animation = 'pulse-green 1.5s infinite';
        }
      }
    });
  }
}

// APPEND A MESSAGE BUBBLE IN SIDEBAR CHAT BOX
function appendChatBubble(text, sender, direction, timestampVal) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  // Clear placeholder on first message
  const placeholder = chatMessages.querySelector('.chat-placeholder');
  if (placeholder) placeholder.remove();

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${direction}`;

  const time = timestampVal || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.innerHTML = `
    ${direction === 'incoming' ? `<span class="chat-sender">${sender}</span>` : ''}
    <span class="chat-bubble-text">${text}</span>
    <span class="chat-timestamp">${time}</span>
  `;

  chatMessages.appendChild(bubble);
  
  // Auto-scroll chat box to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// SANDBOX COMPILATION API RUNNER
function setupCodeSandboxRunner() {
  const runBtn = document.getElementById('btn-run');
  if (!runBtn) return;

  runBtn.addEventListener('click', () => {
    executeWorkspaceCode();
  });
}

// EXECUTE MULTI-LANGUAGE SCRIPT
async function executeWorkspaceCode() {
  if (!editorInstance) return;

  const currentLanguage = document.getElementById('select-language').value;
  const code = editorInstance.getValue();

  updateStatusDot('running', 'Executing...');
  showToast(`Compiling ${currentLanguage.toUpperCase()} Sandbox...`, 'success');

  // 1. JavaScript Solo Sandbox Execution Fallback
  if (currentLanguage === 'javascript') {
    executeLocalJavaScript(code);
    return;
  }

  // 2. Multi-Language Sandboxing via free secure Piston API engine
  let pistonLangMap = {
    'python': 'python3',
    'typescript': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'markdown': 'markdown'
  };

  const pistonLang = pistonLangMap[currentLanguage];
  if (!pistonLang) {
    updateStatusDot('error', 'Execution Failed');
    showToast('Multi-Language sandbox does not support this language!', 'error');
    return;
  }

  try {
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language: currentLanguage === 'python' ? 'python' : currentLanguage,
        version: '*',
        files: [
          {
            name: activeFile,
            content: code
          }
        ]
      })
    });

    const result = await response.json();

    if (result && result.run) {
      const logs = [];
      const stdout = result.run.stdout;
      const stderr = result.run.stderr;

      if (stdout) {
        logs.push({ type: 'log', text: stdout.trim() });
      }
      if (stderr) {
        logs.push({ type: 'error', text: stderr.trim() });
      }

      const hasError = result.run.code !== 0 || !!stderr;
      renderOutputLogs(logs, hasError ? 'Compilation Error' : null, false);

      // Broadcast output results to collaborators
      if (socket && socket.connected) {
        socket.emit('run-code', { room, logs, error: hasError ? 'Compilation Error' : null });
      }
    } else {
      updateStatusDot('error', 'Execution Failed');
      showToast('Piston sandbox compiler returned an empty response', 'error');
    }
  } catch (err) {
    console.error('Piston sandbox connection error:', err);
    updateStatusDot('error', 'Network Error');
    showToast('Failed to connect to sandboxed compiler API', 'error');
  }
}

// EXECUTE LOCAL JAVASCRIPT IN BROWSER
function executeLocalJavaScript(code) {
  const capturedLogs = [];
  
  const originalLog = console.log;
  console.log = function(...args) {
    const formatted = args.map(arg => {
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg, null, 2); } catch(e) { return String(arg); }
      }
      return String(arg);
    }).join(' ');
    capturedLogs.push({ type: 'log', text: formatted });
    originalLog.apply(console, args);
  };

  let executionError = null;

  try {
    const userScript = new Function(code);
    userScript();
  } catch (error) {
    executionError = `${error.name}: ${error.message}`;
    capturedLogs.push({ type: 'error', text: executionError });
  }

  console.log = originalLog;
  renderOutputLogs(capturedLogs, executionError, false);

  if (socket && socket.connected) {
    socket.emit('run-code', { room, logs: capturedLogs, error: executionError });
  }
}

// RENDER LOG STREAMS
function renderOutputLogs(logs, error, isPeerBroadcast = false) {
  const outputBody = document.getElementById('output-body');
  if (!outputBody) return;

  outputBody.innerHTML = '';

  if (logs.length === 0) {
    outputBody.innerHTML = `<span class="output-placeholder">// Script success, but returned empty stdout</span>`;
    updateStatusDot('idle', 'Success');
    return;
  }

  logs.forEach(log => {
    const logEl = document.createElement('div');
    if (log.type === 'error') {
      logEl.className = 'output-error';
      logEl.textContent = log.text;
    } else {
      logEl.className = 'output-success';
      logEl.textContent = log.text;
    }
    outputBody.appendChild(logEl);
  });

  if (error) {
    updateStatusDot('error', 'Error');
    if (isPeerBroadcast) showToast('Peer ran script and hit compile errors!', 'error');
  } else {
    updateStatusDot('idle', 'Success');
    if (isPeerBroadcast) showToast('Peer executed script successfully!', 'success');
  }

  outputBody.scrollTop = outputBody.scrollHeight;
}

// LED STATUS UTILS
function updateStatusDot(state, text) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-text');
  if (!dot || !label) return;

  dot.className = `status-dot ${state}`;
  label.textContent = text;
}

// WebRTC VIDEO / VOICE PEERS CONNECTIONS
function setupWebRTCCalls() {
  const joinCallBtn = document.getElementById('btn-join-call');
  const toggleMicBtn = document.getElementById('btn-toggle-mic');
  const toggleCamBtn = document.getElementById('btn-toggle-cam');

  if (!joinCallBtn || !toggleMicBtn || !toggleCamBtn) return;

  joinCallBtn.addEventListener('click', async () => {
    // 1. Join Video Call
    if (!localStream) {
      try {
        joinCallBtn.innerHTML = 'Connecting...';
        
        // Request microphone and camera browser permissions
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Render local video tile
        appendVideoFeed(localStream, 'local-video', 'You (Local)', true);
        
        // Enable mute controls
        toggleMicBtn.removeAttribute('disabled');
        toggleMicBtn.classList.remove('disabled');
        toggleMicBtn.classList.add('active');
        toggleCamBtn.removeAttribute('disabled');
        toggleCamBtn.classList.remove('disabled');
        toggleCamBtn.classList.add('active');
        
        joinCallBtn.innerHTML = '📞 Leave Call';
        joinCallBtn.classList.remove('btn-primary');
        joinCallBtn.classList.add('btn-danger');

        showToast('Joined voice/video call room!', 'success');
        
        // Notify other room users to make WebRTC offers
        triggerCallToPeers();
      } catch (err) {
        console.error('Camera/Mic permission denied:', err);
        joinCallBtn.innerHTML = '📞 Join Call';
        showToast('Camera or Microphone access was denied!', 'error');
      }
    } else {
      // 2. Leave Video Call
      leaveActiveCall();
    }
  });

  // Toggle Microphone mute state
  toggleMicBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      toggleMicBtn.classList.toggle('active');
      showToast(audioTrack.enabled ? 'Microphone active' : 'Microphone muted', 'success');
    }
  });

  // Toggle Camera frame state
  toggleCamBtn.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      toggleCamBtn.classList.toggle('active');
      showToast(videoTrack.enabled ? 'Camera active' : 'Camera hidden', 'success');
    }
  });

  // Socket: Receive signaling broker offers, answers, and candidates
  if (socket) {
    // Listen for new user joining call room, then initiate calling them
    socket.on('user-joined-call', async (data) => {
      if (!localStream) return; // Only call them if we are currently active in the call ourselves

      const pc = getOrCreatePeerConnection(data.socketId, data.username);
      
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        const myUsername = localStorage.getItem('collab_username') || 'Developer';
        socket.emit('call-user', {
          room,
          userToCall: data.socketId,
          offer,
          from: myUsername
        });
      } catch (e) {
        console.error('Error initiating call offer:', e);
      }
    });

    // Receive ICE Signaling Offer
    socket.on('call-made', async (data) => {
      if (!localStream) return; // Only process if active in call

      const pc = getOrCreatePeerConnection(data.socket, data.username);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(new RTCSessionDescription(answer));
        
        socket.emit('make-answer', {
          to: data.socket,
          answer
        });
      } catch (e) {
        console.error('Error handling RTC offer:', e);
      }
    });

    // Receive ICE Signaling Answer
    socket.on('answer-made', async (data) => {
      const pc = peerConnections[data.socket];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
          console.error('Error setting RTC answer:', e);
        }
      }
    });

    // Receive ICE Signaling Candidate
    socket.on('ice-candidate-received', async (data) => {
      const pc = peerConnections[data.socket];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    // Sockets clean disconnect call relays
    socket.on('user-left-call', (data) => {
      const pc = peerConnections[data.socketId];
      if (pc) {
        pc.close();
        delete peerConnections[data.socketId];
      }
      
      const feed = document.getElementById(`video-tile-${data.socketId}`);
      if (feed) feed.remove();

      checkVideoPlaceholder();
    });
  }
}

// JOIN CALL SIGNALLING TRIGGERS
function triggerCallToPeers() {
  if (!socket || !socket.connected) return;

  // We ask all other connected socket rooms to offer a Peer Connection
  const username = localStorage.getItem('collab_username') || 'Developer';
  
  // Sockets connections list stack users
  socket.emit('request-calls-signaling', { room, username });
}

// INITIATE/RETRIEVE WebRTC PEER CONNECTIONS
function getOrCreatePeerConnection(socketId, peerName) {
  if (peerConnections[socketId]) return peerConnections[socketId];

  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections[socketId] = pc;

  // Add local track feeds
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  // ICE Candidates signaling broker
  pc.onicecandidate = ({ candidate }) => {
    if (candidate && socket && socket.connected) {
      socket.emit('ice-candidate', {
        to: socketId,
        candidate
      });
    }
  };

  // Remote media track received
  pc.ontrack = ({ streams }) => {
    const remoteStream = streams[0];
    appendVideoFeed(remoteStream, `video-tile-${socketId}`, peerName || 'Remote Peer', false);
  };

  return pc;
}

// APPEND A VIDEO CONTAINER NODE
function appendVideoFeed(stream, id, label, isMuted = false) {
  const grid = document.getElementById('video-grid');
  const placeholder = document.getElementById('video-placeholder-box');
  
  if (!grid) return;
  if (placeholder) placeholder.style.display = 'none';

  // Check if tile already exists
  let tile = document.getElementById(id);
  if (!tile) {
    tile = document.createElement('div');
    tile.id = id;
    tile.className = 'video-tile';
    tile.style.position = 'relative';

    const video = document.createElement('video');
    video.className = 'video-tile';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isMuted;
    video.srcObject = stream;

    const nameLabel = document.createElement('span');
    nameLabel.className = 'video-tile-name';
    nameLabel.textContent = label;

    tile.appendChild(video);
    tile.appendChild(nameLabel);
    grid.appendChild(tile);
  } else {
    const video = tile.querySelector('video');
    if (video) video.srcObject = stream;
  }
}

// LEAVE AND TEARDOWN AUDIO/VIDEO MEDIA TRACKS
function leaveActiveCall() {
  const joinCallBtn = document.getElementById('btn-join-call');
  const toggleMicBtn = document.getElementById('btn-toggle-mic');
  const toggleCamBtn = document.getElementById('btn-toggle-cam');

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  // Terminate all peer connection nodes
  Object.keys(peerConnections).forEach(socketId => {
    peerConnections[socketId].close();
  });
  peerConnections = {};

  // Notify other room users that we have left the call
  if (socket && socket.connected) {
    socket.emit('leave-call', { room });
  }

  // Reset frontend UI panels
  const localVideo = document.getElementById('local-video');
  if (localVideo) localVideo.remove();

  const grid = document.getElementById('video-grid');
  if (grid) {
    grid.querySelectorAll('.video-tile').forEach(t => t.remove());
  }

  if (toggleMicBtn) {
    toggleMicBtn.setAttribute('disabled', 'disabled');
    toggleMicBtn.className = 'video-btn disabled';
  }
  if (toggleCamBtn) {
    toggleCamBtn.setAttribute('disabled', 'disabled');
    toggleCamBtn.className = 'video-btn disabled';
  }
  if (joinCallBtn) {
    joinCallBtn.innerHTML = '📞 Join Call';
    joinCallBtn.classList.remove('btn-danger');
    joinCallBtn.classList.add('btn-primary');
  }

  checkVideoPlaceholder();
  showToast('Voice/video call disconnected', 'error');
}

// VERIFY PLACEHOLDER CARDS
function checkVideoPlaceholder() {
  const grid = document.getElementById('video-grid');
  const placeholder = document.getElementById('video-placeholder-box');
  
  if (grid && placeholder) {
    const tilesCount = grid.querySelectorAll('.video-tile').length;
    placeholder.style.display = tilesCount === 0 ? 'flex' : 'none';
  }
}
