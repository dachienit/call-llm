const STORAGE_KEY = "chatbox_env_settings_v1";

const defaultEnv = {
  brainId: "e39Lh3w2teng",
  ntid: "",
  customPrompt: "",
  theme: "colorful",
};

function applyTheme(theme) {
  document.body.classList.remove("theme-dark-gray", "theme-black", "theme-white");
  if (theme && theme !== "colorful") {
    document.body.classList.add(`theme-${theme}`);
  }
}

// Global variable to store settings, accessible from anywhere
let globalSettings = { ...defaultEnv };

// Flag to track reload/new chat state
let isReload = true;

// Assign to window to be accessible from console or other scripts
if (typeof window !== 'undefined') {
  window.globalSettings = globalSettings;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function adjustCodeTextareaHeight(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function renderBotText(text) {
  // Parse the entire message, only the part within <abap>...</abap> enters the edit frame,
  // the rest displays normal text.
  const startTag = "<abap>";
  const endTag = "</abap>";

  // If NO <abap> -> parse Markdown using marked
  if (!text.includes(startTag)) {
    return marked.parse(text);
  }

  let html = "";
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf(startTag, cursor);
    if (start === -1) {
      const rest = text.slice(cursor);
      if (rest.trim()) {
        html += marked.parse(rest);
      }
      break;
    }

    const plainPart = text.slice(cursor, start);
    if (plainPart.trim()) {
      html += marked.parse(plainPart);
    }

    const end = text.indexOf(endTag, start + startTag.length);
    if (end === -1) {
      // Closing tag not found, treat the rest as normal text
      const rest = text.slice(start);
      if (rest.trim()) {
        html += marked.parse(rest);
      }
      break;
    }

    const code = text.slice(start + startTag.length, end);
    if (code.trim()) {
      html += `
        <div class="code-block-editable">
          <div class="code-header">
            <span class="code-lang-label">abap</span>
            <button type="button" class="btn-ghost btn-copy-code">Copy code</button>
          </div>
          <textarea class="code-textarea" spellcheck="false">${code.trim()}</textarea>
          <div class="code-actions">
            <button type="button" class="btn-primary btn-review-code" style="margin-right: 8px;">Review</button>
            <button type="button" class="btn-primary btn-apply-code">Apply</button>
          </div>
        </div>
      `;
    }

    cursor = end + endTag.length;
  }

  if (!html) {
    // If no <abap> then show normally
    return marked.parse(text);
  }

  return html;
}

function loadEnv() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const env = { ...defaultEnv };
      globalSettings = env;
      if (typeof window !== 'undefined') {
        window.globalSettings = globalSettings;
      }
      return env;
    }
    const parsed = JSON.parse(raw);
    // Merge parsed with defaultEnv, but if parsed has empty strings for keys that have defaults, use defaults
    const env = { ...defaultEnv, ...parsed };


    globalSettings = env;
    if (typeof window !== 'undefined') {
      window.globalSettings = globalSettings;
    }
    return env;
  } catch {
    const env = { ...defaultEnv };
    globalSettings = env;
    if (typeof window !== 'undefined') {
      window.globalSettings = globalSettings;
    }
    return env;
  }
}

function saveEnv(env) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
  // Update global variable
  globalSettings = { ...env };
  // Update window object if available
  if (typeof window !== 'undefined') {
    window.globalSettings = globalSettings;
  }
}

// Variable to cache Windows username
let cachedWindowsUsername = null;

async function getWindowsNtid() {
  // If cached, return immediately
  if (cachedWindowsUsername) {
    console.log('[getWindowsNtid] Using cached username:', cachedWindowsUsername);
    return cachedWindowsUsername;
  }

  try {
    console.log('[getWindowsNtid] Fetching username from API...');
    // Call API from server to get Windows username
    const response = await fetch('/api/userinfo');
    if (response.ok) {
      const data = await response.json();
      console.log('[getWindowsNtid] API response:', data);
      if (data.username) {
        cachedWindowsUsername = data.username;
        console.log('[getWindowsNtid] Cached username:', cachedWindowsUsername);
        return data.username;
      }
    } else {
      console.error('[getWindowsNtid] API response not OK:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('[getWindowsNtid] Error fetching Windows username:', error);
  }

  // Fallback: try getting from path
  try {
    const path = window.location.pathname || "";
    const match = path.match(/[/\\]Users[/\\]([^/\\]+)/i);
    if (match && match[1]) {
      const username = decodeURIComponent(match[1]);
      cachedWindowsUsername = username;
      console.log('[getWindowsNtid] Using username from path:', username);
      return username;
    }
  } catch (err) {
    console.error('[getWindowsNtid] Error parsing path:', err);
  }

  console.warn('[getWindowsNtid] No username found, returning empty string');
  return "";
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createMessageElement({ role, text, env, time }) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  // Use NTID if available for user, otherwise default to "You"
  const who = role === "user" ? (env && env.ntid ? env.ntid : "You") : "Octo Agent";
  meta.innerHTML = `<span>${who}</span><span>${time || formatTime()}</span>`;

  const content = document.createElement("div");
  if (role === "bot") {
    content.innerHTML = renderBotText(text);
    // If text contains <abap>, add has-code class to wrapper
    if (text.includes("<abap>")) {
      wrapper.classList.add("has-code");

      // Defer execution to ensure elements are in DOM or just ready
      setTimeout(() => {
        const textareas = content.querySelectorAll(".code-textarea");
        textareas.forEach(textarea => {
          adjustCodeTextareaHeight(textarea);
          textarea.addEventListener("input", () => adjustCodeTextareaHeight(textarea));
        });
      }, 0);
    }
  } else {
    content.textContent = text;
  }

  wrapper.appendChild(meta);
  wrapper.appendChild(content);

  return wrapper;
}

document.addEventListener("DOMContentLoaded", () => {
  // Configure marked to treat newlines as line breaks
  if (typeof marked !== 'undefined') {
    marked.use({ breaks: true });
  }

  // Sidebar elements
  const leftSidebar = document.getElementById("leftSidebar");
  const rightSidebar = document.getElementById("rightSidebar");
  const leftSidebarToggle = document.getElementById("leftSidebarToggle");
  const rightSidebarToggle = document.getElementById("rightSidebarToggle");

  // Left sidebar elements
  const newChatBtn = document.getElementById("newChatBtn");
  const recentChatsToggle = document.getElementById("recentChatsToggle");
  const recentChatsList = document.getElementById("recentChatsList");

  // Right sidebar elements
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsPanel = document.getElementById("settingsPanel");
  const saveSettingsBtn = document.getElementById("saveSettings");
  const resetSettingsBtn = document.getElementById("resetSettings");

  const envBrainId = document.getElementById("envBrainId");
  const envNtid = document.getElementById("envNtid");
  const envTheme = document.getElementById("envTheme");
  const envCustomPrompt = document.getElementById("envCustomPrompt");

  // Chat elements
  const chatForm = document.getElementById("chatForm");
  const userInput = document.getElementById("userInput");
  const messages = document.getElementById("messages");
  const submitBtn = chatForm.querySelector("button[type='submit']") || chatForm.querySelector(".btn-send");
  const commandMenu = document.getElementById("commandMenu");
  const waitOverlay = document.getElementById("waitOverlay");

  // Modal elements
  const expandPromptBtn = document.getElementById("expandPromptBtn");
  const promptModal = document.getElementById("promptModal");
  const modalCustomPrompt = document.getElementById("modalCustomPrompt");
  const closePromptModal = document.getElementById("closePromptModal");
  const applyPromptBtn = document.getElementById("applyPromptBtn");
  const cancelPromptBtn = document.getElementById("cancelPromptBtn");
  const charCount = document.getElementById("charCount");

  // File Attachment elements
  const fileInput = document.getElementById("fileInput");
  const attachBtn = document.getElementById("attachBtn");
  const attachmentPreview = document.getElementById("attachmentPreview");
  const attachmentName = document.getElementById("attachmentName");
  const removeAttachmentBtn = document.getElementById("removeAttachmentBtn");

  // Auto-resize textarea
  const autoResize = () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
  };

  userInput.addEventListener('input', autoResize);

  let currentAttachmentFile = null;

  // Handle Attachment Button Click
  if (attachBtn && fileInput) {
    attachBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      currentAttachmentFile = file;
      if (attachmentName) {
        attachmentName.textContent = file.name;
      }
      if (attachmentPreview) {
        attachmentPreview.classList.remove("hidden");
      }

      // Reset file input so the same file can be selected again if needed
      fileInput.value = "";

      // Focus back to input
      userInput.focus();
    });
  }

  // Handle Remove Attachment
  if (removeAttachmentBtn) {
    removeAttachmentBtn.addEventListener("click", () => {
      currentAttachmentFile = null;
      if (attachmentPreview) {
        attachmentPreview.classList.add("hidden");
      }
    });
  }

  // Sidebar toggle functions
  leftSidebarToggle.addEventListener("click", () => {
    leftSidebar.classList.toggle("collapsed");
    const isCollapsed = leftSidebar.classList.contains("collapsed");
    leftSidebarToggle.textContent = isCollapsed ? "▶" : "◀";
    leftSidebarToggle.title = isCollapsed ? "Open left sidebar" : "Collapse left sidebar";
  });

  rightSidebarToggle.addEventListener("click", () => {
    rightSidebar.classList.toggle("collapsed");
    const isCollapsed = rightSidebar.classList.contains("collapsed");
    rightSidebarToggle.textContent = isCollapsed ? "◀" : "▶";
    rightSidebarToggle.title = isCollapsed ? "Open right sidebar" : "Collapse right sidebar";
  });

  // Set initial state - both sidebars collapsed by default
  // Ensure both sidebars are collapsed on load
  if (!leftSidebar.classList.contains("collapsed")) {
    leftSidebar.classList.add("collapsed");
  }
  if (!rightSidebar.classList.contains("collapsed")) {
    rightSidebar.classList.add("collapsed");
  }
  leftSidebarToggle.textContent = "▶";
  rightSidebarToggle.textContent = "◀";
  leftSidebarToggle.title = "Open left sidebar";
  rightSidebarToggle.title = "Open right sidebar";

  // Recent Chats toggle
  recentChatsToggle.addEventListener("click", () => {
    recentChatsToggle.classList.toggle("collapsed");
    recentChatsList.classList.toggle("collapsed");
  });

  // Settings toggle
  settingsToggle.addEventListener("click", () => {
    settingsToggle.classList.toggle("collapsed");
    settingsPanel.classList.toggle("hidden");
  });

  // New Chat button
  newChatBtn.addEventListener("click", () => {
    // Set reload flag
    isReload = true;

    // Clear messages
    messages.innerHTML = "";
    // Clear input
    userInput.value = "";
    // Clear Specific Requirements
    envCustomPrompt.value = "";
    globalSettings.customPrompt = "";
    // Reset Brain ID
    envBrainId.value = defaultEnv.brainId;
    globalSettings.brainId = defaultEnv.brainId;

    // Update active chat item
    document.querySelectorAll(".chat-item").forEach(item => {
      item.classList.remove("active");
    });

    // Refresh token
    //refreshToken();

    // You can add more logic here to create a new chat session
    console.log("New chat created");
    showWelcomeScreen();
  });

  // Chat items click handler
  document.querySelectorAll(".chat-item").forEach(item => {
    item.addEventListener("click", () => {
      // Remove active from all items
      document.querySelectorAll(".chat-item").forEach(i => i.classList.remove("active"));
      // Add active to clicked item
      item.classList.add("active");
      // You can add logic here to load chat history
      const chatTitle = item.querySelector(".chat-title").textContent;
      console.log("Switched to chat:", chatTitle);
    });
  });

  function showCommandMenu() {
    if (!commandMenu) return;
    commandMenu.classList.remove("hidden");
  }

  function hideCommandMenu() {
    if (!commandMenu) return;
    commandMenu.classList.add("hidden");
  }

  function maybeToggleCommandMenu() {
    const value = userInput.value;
    const pos = userInput.selectionStart || 0;
    const hasAt = pos > 0 && value[pos - 1] === "@";
    if (hasAt) {
      showCommandMenu();
    } else {
      hideCommandMenu();
    }
  }

  function showWelcomeScreen() {
    messages.innerHTML = `
      <div class="welcome-screen">

        <div class="welcome-title">Welcome to Octo Agent.</div>
        <div class="welcome-text">
          Use <span class="command-highlight">@analyze</span> to analyze ABAP R/3 logic, 
          <span class="command-highlight">@refactor</span> to refactor code to ABAP S/4HANA, and 
          <span class="command-highlight">@review</span> to review any ABAP code block.
        </div>
      </div>
    `;
  }

  // Load env on start
  const currentEnv = loadEnv();

  // Always clear Specific Requirements on reload/start
  currentEnv.customPrompt = "";
  envCustomPrompt.value = "";

  // Always reset Brain ID on reload/start
  currentEnv.brainId = defaultEnv.brainId;
  envBrainId.value = defaultEnv.brainId;

  // Initialize Theme
  if (!currentEnv.theme) currentEnv.theme = defaultEnv.theme;
  if (envTheme) envTheme.value = currentEnv.theme;
  applyTheme(currentEnv.theme);

  // Save the reset state to ensure consistency
  saveEnv(currentEnv);

  // Automatically get Windows username and fill in NTID
  (async () => {
    console.log('[DOMContentLoaded] Loading NTID...');
    console.log('[DOMContentLoaded] Current env ntid:', currentEnv.ntid);

    const defaultNtid = await getWindowsNtid();
    console.log('[DOMContentLoaded] Got default NTID:', defaultNtid);

    if (defaultNtid) {
      // If NTID from Windows exists and is not in env, or env is empty
      if (!currentEnv.ntid || currentEnv.ntid === "") {
        console.log('[DOMContentLoaded] Setting NTID to:', defaultNtid);
        envNtid.value = defaultNtid;
        // Update env and save
        const updatedEnv = { ...currentEnv, ntid: defaultNtid };
        saveEnv(updatedEnv);
      } else {
        // If already in env, use saved value
        console.log('[DOMContentLoaded] Using saved NTID:', currentEnv.ntid);
        envNtid.value = currentEnv.ntid;
      }
    } else if (currentEnv.ntid) {
      // If cannot get from Windows but exists in env
      console.log('[DOMContentLoaded] Using saved NTID (no Windows username):', currentEnv.ntid);
      envNtid.value = currentEnv.ntid;
    } else {
      // Nothing available
      console.warn('[DOMContentLoaded] No NTID available');
      envNtid.value = "";
    }

    // Refresh token on load
    //refreshToken();

    // Show welcome screen on load
    showWelcomeScreen();
  })();


  saveSettingsBtn.addEventListener("click", async () => {
    let ntidValue = envNtid.value.trim();
    // If NTID is empty, automatically get from Windows
    if (!ntidValue) {
      ntidValue = await getWindowsNtid() || defaultEnv.ntid;
      envNtid.value = ntidValue;
    }
    const newEnv = {
      brainId: envBrainId.value.trim(),
      ntid: ntidValue,
      customPrompt: envCustomPrompt.value.trim(),
      theme: envTheme ? envTheme.value : defaultEnv.theme,
    };
    saveEnv(newEnv);
    applyTheme(newEnv.theme);
    // simple visual feedback
    saveSettingsBtn.textContent = "Saved ✓";
    setTimeout(() => {
      saveSettingsBtn.textContent = "Save Settings";
    }, 1200);
  });

  resetSettingsBtn.addEventListener("click", async () => {

    envCustomPrompt.value = "";
    envBrainId.value = defaultEnv.brainId;
    if (envTheme) envTheme.value = defaultEnv.theme;
    const defaultNtid = await getWindowsNtid();
    envNtid.value = defaultNtid;
    const resetEnv = { ...defaultEnv, ntid: defaultNtid };
    saveEnv(resetEnv);
    applyTheme(resetEnv.theme);
  });

  // Modal handlers for Specific Requirements
  if (expandPromptBtn && promptModal && modalCustomPrompt) {
    // Open modal
    expandPromptBtn.addEventListener("click", () => {
      modalCustomPrompt.value = envCustomPrompt.value;
      if (charCount) {
        charCount.textContent = modalCustomPrompt.value.length;
      }
      promptModal.classList.remove("hidden");
    });

    // Close modal
    const closeModal = () => {
      promptModal.classList.add("hidden");
    };

    if (closePromptModal) {
      closePromptModal.addEventListener("click", closeModal);
    }

    if (cancelPromptBtn) {
      cancelPromptBtn.addEventListener("click", closeModal);
    }

    // Apply and close
    if (applyPromptBtn) {
      applyPromptBtn.addEventListener("click", () => {
        envCustomPrompt.value = modalCustomPrompt.value;
        closeModal();
      });
    }

    // Update character count
    modalCustomPrompt.addEventListener("input", () => {
      if (charCount) {
        charCount.textContent = modalCustomPrompt.value.length;
      }
    });

    // Close on escape key
    promptModal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    });

    // Close on backdrop click
    promptModal.addEventListener("click", (e) => {
      if (e.target === promptModal) {
        closeModal();
      }
    });
  }

  // Skill Editor Logic
  const envSkill = document.getElementById("envSkill");
  const editSkillBtn = document.getElementById("editSkillBtn");
  const skillModal = document.getElementById("skillModal");
  const skillModalTitle = document.getElementById("skillModalTitle");
  const modalSkillContent = document.getElementById("modalSkillContent");
  const closeSkillModal = document.getElementById("closeSkillModal");
  const saveSkillBtn = document.getElementById("saveSkillBtn");
  const cancelSkillBtn = document.getElementById("cancelSkillBtn");

  // Load skills
  async function loadSkills() {
    try {
      const response = await fetch('/api/skills');
      if (response.ok) {
        const files = await response.json();
        // Keep selected value if possible
        const currentVal = envSkill.value;
        envSkill.innerHTML = '<option value="" disabled selected>Select a skill...</option>';
        files.forEach(file => {
          const option = document.createElement("option");
          option.value = file;
          option.textContent = file;
          envSkill.appendChild(option);
        });
        if (currentVal && files.includes(currentVal)) {
          envSkill.value = currentVal;
        }
      }
    } catch (error) {
      console.error('Error loading skills:', error);
    }
  }

  // Initial load
  loadSkills();

  // Handle Edit Skill
  if (editSkillBtn && envSkill) {
    editSkillBtn.addEventListener("click", async () => {
      const filename = envSkill.value;
      if (!filename) {
        alert("Please select a skill to edit");
        return;
      }

      try {
        console.log('[DEBUG] Fetching skill:', filename);
        const response = await fetch(`/api/skills/${encodeURIComponent(filename)}`);
        if (response.ok) {
          const data = await response.json();
          modalSkillContent.value = data.content;
          skillModalTitle.textContent = `Edit Skill: ${filename}`;
          skillModal.classList.remove("hidden");
        } else {
          const errText = await response.text();
          console.error('[DEBUG] Failed to load skill:', response.status, errText);
          alert(`Failed to load skill content: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error loading skill content:', error);
        alert(`Error loading skill content: ${error.message}`);
      }
    });
  }

  // Close Skill Modal
  const closeSkillEditor = () => {
    skillModal.classList.add("hidden");
  };

  if (closeSkillModal) closeSkillModal.addEventListener("click", closeSkillEditor);
  if (cancelSkillBtn) cancelSkillBtn.addEventListener("click", closeSkillEditor);

  // Save Skill
  if (saveSkillBtn) {
    saveSkillBtn.addEventListener("click", async () => {
      const filename = envSkill.value;
      const content = modalSkillContent.value;

      try {
        const response = await fetch(`/api/skills/${filename}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        });

        if (response.ok) {
          alert("Skill saved successfully");
          closeSkillEditor();
        } else {
          alert("Failed to save skill");
        }
      } catch (error) {
        console.error('Error saving skill:', error);
        alert("Error saving skill");
      }
    });
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendToApi(messageText, env, option = null, reLoad = false, metadata = {}) {
    try {
      let historyID = "";
      if (!reLoad) {
        historyID = sessionStorage.getItem("historyID");
      }
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageText, env: env, option: option, reLoad: reLoad, ...metadata, historyID }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (reLoad && data.hisID) {
        sessionStorage.setItem("historyID", data.hisID);
      }
      return data.reply || messageText;
    } catch (error) {
      console.error('Error sending message to API:', error);
      throw error;
    }
  }

  async function refreshToken() {
    try {
      console.log('[refreshToken] Refreshing token...');
      const response = await fetch('/api/refresh-token', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        console.log('[refreshToken] Token refreshed:', data);
      } else {
        console.error('[refreshToken] Failed to refresh token:', response.status);
      }
    } catch (error) {
      console.error('[refreshToken] Error refreshing token:', error);
    }
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    let text = userInput.value.trim();

    // If there is an attachment, read it and append to text
    if (currentAttachmentFile) {
      try {
        let fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (error) => reject(error);
          reader.readAsText(currentAttachmentFile);
          //reader.readFile(currentAttachmentFile, 'utf8')
        });
        console.log(`[DEBUG] Read file ${currentAttachmentFile.name}, size: ${currentAttachmentFile.size}, content length: ${fileContent.length}`);
        fileContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        if (text) {
          text += "\n";
        }

        text += `${fileContent}`;

        // Clear attachment after reading
        currentAttachmentFile = null;
        if (attachmentPreview) {
          attachmentPreview.classList.add("hidden");
        }
      } catch (err) {
        console.error("Error reading file:", err);
        alert("Error reading file attachment");
        return;
      }
    }

    if (!text) return;

    // Load env but override with current UI values to ensure WYSIWYG
    const env = loadEnv();
    if (envBrainId) env.brainId = envBrainId.value.trim();
    if (envCustomPrompt) env.customPrompt = envCustomPrompt.value.trim();
    if (envNtid) env.ntid = envNtid.value.trim();

    // For display, we might want to show just the user input, or the full text?
    // User requested: "send Check file: (newline) + attached file content into userMessage of ask function"
    // But for UI display, usually we show what user typed + maybe an indicator of file.
    // Here I will show the full text being sent for clarity, or maybe just the user input?
    // Let's show the full text as it's what's being sent.
    // Actually, if the file is huge, showing it in chat might be bad.
    // But the requirement says "send ... into userMessage", which implies the backend receives it.
    // The UI `createMessageElement` displays `text`.
    // Let's display the full text for now to be safe, or maybe truncate it?
    // Given the requirement is about what is SENT, I will send the combined text.
    // For UI, I will display the combined text.

    // Clear welcome screen if present
    if (messages.querySelector(".welcome-screen")) {
      messages.innerHTML = "";
    }

    const userMsgEl = createMessageElement({
      role: "user",
      text, // Displaying full text including file content
      env,
    });
    messages.appendChild(userMsgEl);
    scrollToBottom();
    userInput.value = "";
    autoResize(); // Reset height

    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.6";
    submitBtn.style.cursor = "not-allowed";
    if (waitOverlay) {
      waitOverlay.classList.remove("hidden");
    }

    try {
      let option = null;
      let messageToSend = text;

      // Check for commands
      const commandRegex = /^@(analyze|refactor|review)(\s+|$)(.*)/s;
      const match = text.match(commandRegex);
      if (match) {
        option = match[1];
        messageToSend = match[3] || ""; // The rest of the message
      }

      const reply = await sendToApi(messageToSend, env, option, isReload);

      // Reset reload flag after sending
      isReload = false;

      const botMsgEl = createMessageElement({
        role: "bot",
        text: reply,
      });
      messages.appendChild(botMsgEl);
      scrollToBottom();
    } catch (err) {
      const errMsgEl = createMessageElement({
        role: "bot",
        text: "Error sending message. Please check ENV configuration or console.",
      });
      messages.appendChild(errMsgEl);
      scrollToBottom();
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
      if (waitOverlay) {
        waitOverlay.classList.add("hidden");
      }
    }
  });

  // Suggest commands @analyze, @refactor, @review
  userInput.addEventListener("input", () => {
    maybeToggleCommandMenu();
  });

  userInput.addEventListener("click", () => {
    maybeToggleCommandMenu();
  });

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
      return;
    }

    if (e.key === "Escape") {
      hideCommandMenu();
    }
    // read new selectionStart after a tick
    setTimeout(() => maybeToggleCommandMenu(), 0);
  });

  if (commandMenu) {
    commandMenu.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest(".command-item");
      if (!btn) return;
      const command = btn.getAttribute("data-command");
      if (!command) return;

      const value = userInput.value;
      const pos = userInput.selectionStart || 0;
      const atIndex = value.lastIndexOf("@", pos - 1);
      if (atIndex === -1) return;

      const before = value.slice(0, atIndex);
      const after = value.slice(pos);
      const insert = `@${command}`;
      const newVal = `${before}${insert} ${after}`;
      userInput.value = newVal;

      const newPos = before.length + insert.length + 1;
      userInput.selectionStart = newPos;
      userInput.selectionEnd = newPos;

      hideCommandMenu();
      userInput.focus();
    });
  }

  // Listen to Apply button in bot code block
  messages.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const applyBtn = target.closest(".btn-apply-code");
    const reviewBtn = target.closest(".btn-review-code");
    const copyBtn = target.closest(".btn-copy-code");

    const wrapper = (applyBtn || reviewBtn || copyBtn) && target.closest(".code-block-editable");
    if (!wrapper) return;
    const textarea = wrapper.querySelector(".code-textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    if (copyBtn) {
      const code = textarea.value;
      navigator.clipboard
        .writeText(code)
        .then(() => {
          copyBtn.textContent = "Copied";
          setTimeout(() => {
            copyBtn.textContent = "Copy";
          }, 1000);
        })
        .catch(() => {
          // fallback: select text
          textarea.focus();
          textarea.select();
        });
      return;
    }

    if (applyBtn) {
      const newCode = textarea.value;

      // Extract metadata
      const metadata = extractMetadata(wrapper);
      console.log('[Apply] Extracted metadata:', metadata);

      alert("Feature coming soon.");

      // Add User Message for visual feedback
      const userMsgEl = createMessageElement({
        role: "user",
        text: "@Apply",
        env: window.globalSettings || loadEnv(),
      });
      messages.appendChild(userMsgEl);
      scrollToBottom();

      // Send to API with option 'apply'
      const env = window.globalSettings || loadEnv();
      (async () => {
        try {
          if (waitOverlay) waitOverlay.classList.remove("hidden");
          const reply = await sendToApi(newCode, env, 'apply', false, metadata);
          const botMsgEl = createMessageElement({
            role: "bot",
            text: reply,
          });
          messages.appendChild(botMsgEl);
          messages.scrollTop = messages.scrollHeight;
        } catch (err) {
          console.error("Error applying code:", err);
          alert("Error applying code");
        } finally {
          if (waitOverlay) waitOverlay.classList.add("hidden");
        }
      })();
    }

    if (reviewBtn) {
      const code = textarea.value;

      // We need 'env' here. We can get it from globalSettings
      const env = window.globalSettings || loadEnv();

      // Extract metadata (Object Type, Object Name, Error)
      const metadata = extractMetadata(wrapper);
      console.log('[Review] Extracted metadata:', metadata);

      // Send to API with option 'review'
      // Add User Message for visual feedback
      const userMsgEl = createMessageElement({
        role: "user",
        text: "@Review",
        env: window.globalSettings || loadEnv(),
      });
      messages.appendChild(userMsgEl);
      scrollToBottom();

      // We want to display the bot's response
      (async () => {
        try {
          if (waitOverlay) waitOverlay.classList.remove("hidden");
          const reply = await sendToApi(code, env, 'review', false, metadata);
          const botMsgEl = createMessageElement({
            role: "bot",
            text: reply,
          });
          messages.appendChild(botMsgEl);
          messages.scrollTop = messages.scrollHeight;
        } catch (err) {
          console.error("Error reviewing code:", err);
          alert("Error reviewing code");
        } finally {
          if (waitOverlay) waitOverlay.classList.add("hidden");
        }
      })();
    }
  });

  function extractMetadata(wrapper) {
    let objectType = "";
    let objectName = "";
    let error = "";

    // The wrapper is the .code-block-editable div
    // We need to look at previous siblings of this wrapper
    let sibling = wrapper.previousElementSibling;

    console.log('[Metadata Extraction] Starting...');

    let attempts = 0;
    while (sibling && attempts < 10) {
      // console.log('[Metadata Extraction] Checking sibling:', sibling.tagName, sibling.textContent.trim().substring(0, 50) + "...");

      const text = sibling.innerText || sibling.textContent;

      // Try to match patterns in the text content of the sibling
      if (!objectType) {
        const match = text.match(/Object Type\s*[:]\s*(.*?)(\n|$)/i);
        if (match) objectType = match[1].trim().replace(/`/g, '');
      }
      if (!objectName) {
        const match = text.match(/Object Name\s*[:]\s*(.*?)(\n|$)/i);
        if (match) objectName = match[1].trim().replace(/`/g, '');
      }
      if (!error) {
        const match = text.match(/Error\s*[:]\s*(.*?)(\n|$)/i);
        if (match) error = match[1].trim().replace(/`/g, '');
      }

      if (objectType && objectName && error) {
        console.log('[Metadata Extraction] All metadata found.');
        break;
      }

      sibling = sibling.previousElementSibling;
      attempts++;
    }

    return { objectType, objectName, error };
  }
});


