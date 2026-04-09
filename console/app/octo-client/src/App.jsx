import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from './context/SettingsContext';
import MessageBubble from './components/Chat/MessageBubble';
import CommandMenu from './components/Chat/CommandMenu';
import AttachmentPreview from './components/Chat/AttachmentPreview';
import CustomPromptModal from './components/Modals/CustomPromptModal';
import SkillModal from './components/Modals/SkillModal';
import { api } from './api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function App() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [messages, setMessages] = useState([]);
  const [inputObj, setInputObj] = useState({ text: '' });
  const [leftOpen, setLeftOpen] = useState(false); // Default collapsed
  const [rightOpen, setRightOpen] = useState(false); // Default collapsed
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyID, setHistoryID] = useState('');

  // Attachments
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  // Commands
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  // Settings / Modals
  const [skills, setSkills] = useState([]);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Save");

  // Helper to format time
  const formatTime = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Load Skills on mount
  useEffect(() => {
    const loadSkills = async () => {
      const list = await api.getSkills();
      setSkills(list);
    };
    loadSkills();
  }, []);

  // Handle Input Change & Command Menu
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputObj({ ...inputObj, text: val });

    const pos = e.target.selectionStart || 0;
    const hasAt = pos > 0 && val[pos - 1] === "@";
    setShowCommandMenu(hasAt);

    // Auto resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const insertCommand = (cmd) => {
    const val = inputObj.text;
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1) {
      const newVal = val.substring(0, lastAt) + `@${cmd} `;
      setInputObj({ ...inputObj, text: newVal });
    }
    setShowCommandMenu(false);
  };

  // Attachments
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
    e.target.value = null; // reset
  };

  const handleSend = async (e) => {
    e.preventDefault();
    let textToSend = inputObj.text.trim();

    // Read attachment if exists
    if (attachment) {
      try {
        const content = await attachment.text();
        // Append to text
        if (textToSend) textToSend += "\n";
        textToSend += content;
        setAttachment(null); // Clear after reading
      } catch (err) {
        alert("Error reading file attachment");
        return;
      }
    }

    if (!textToSend) return;

    const newMsg = {
      role: 'user',
      text: textToSend, // Legacy parity: shows full content
      sender: settings.ntid || 'You',
      time: formatTime()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputObj({ text: '' });
    setIsProcessing(true);
    setShowCommandMenu(false);

    try {
      // Detect commands
      let option = null;
      let finalMessage = textToSend;

      if (textToSend.startsWith('@analyze')) {
        option = 'analyze';
        finalMessage = textToSend.replace('@analyze', '').trim();
      } else if (textToSend.startsWith('@refactor')) {
        option = 'refactor';
        finalMessage = textToSend.replace('@refactor', '').trim();
      } else if (textToSend.startsWith('@review')) {
        option = 'review';
        finalMessage = textToSend.replace('@review', '').trim();
      }

      const data = await api.chat(
        finalMessage,
        settings,
        option,
        false,
        { historyID }
      );

      if (data.hisID) setHistoryID(data.hisID);

      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.reply,
        sender: 'Octo Agent',
        time: formatTime()
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `**Error:** ${error.message}`,
        sender: 'Octo Agent',
        time: formatTime()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = () => {
    if (!settings.ntid) resetSettings();
    setSaveStatus("Saved ✓");
    setTimeout(() => setSaveStatus("Save"), 1200);
  };

  return (
    <div className="app">
      {/* Left Sidebar */}
      <aside id="leftSidebar" className={`sidebar sidebar-left ${leftOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-content">
          <button className="btn-new-chat" onClick={() => { setMessages([]); setHistoryID(''); }}>
            <span className="icon">+</span>
            <span>New Chat</span>
          </button>

          <div className="recent-chats-section">
            <div className="section-header" style={{ cursor: 'pointer' }}>
              <span>Recent Chats</span>
              <span className="toggle-icon">▼</span>
            </div>
            {/* Recent chats list placeholder */}
          </div>
        </div>
        <button className="sidebar-toggle sidebar-toggle-left" onClick={() => setLeftOpen(!leftOpen)}>
          {leftOpen ? "▶" : "▶"}
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="chat-header">
          <div className="brain-info">
            <span className="brain-icon">🧠</span>
            <span id="currentBrainName">Octo Agent</span>
          </div>
        </div>

        <div className="chat-container">
          <div id="messages" className="messages">
            {messages.length === 0 && (
              <div className="welcome-screen">
                <div className="welcome-title">Welcome to Octo Agent.</div>
                <div className="welcome-text">
                  Use <span className="command-highlight" onClick={() => insertCommand("analyze")}>@analyze</span> to analyze ABAP R/3 logic,
                  <span className="command-highlight" onClick={() => insertCommand("refactor")}>@refactor</span> to refactor code to ABAP S/4HANA, and
                  <span className="command-highlight" onClick={() => insertCommand("review")}>@review</span> to review any ABAP code block.
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                role={msg.role}
                text={msg.text}
                time={msg.time}
                sender={msg.sender}
              />
            ))}
          </div>

          <form className="chat-input" onSubmit={handleSend} autoComplete="off">
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.abap"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <div className="input-wrapper">
              <AttachmentPreview file={attachment} onRemove={() => setAttachment(null)} />

              <textarea
                rows={1}
                placeholder="Send a message to brain 'Octo Agent'..."
                value={inputObj.text}
                onChange={handleInputChange}
              />

              <button type="button" className="btn-attach" title="Attach file" onClick={() => fileInputRef.current.click()}>
                <span>+</span>
              </button>
            </div>

            <CommandMenu show={showCommandMenu} onSelect={insertCommand} />

            <button type="submit" className="btn-send">
              <span>↑</span>
            </button>
          </form>

          <div className="copyright-notice">
            <a href="#" target="_blank">v1.0.0</a>
          </div>
        </div>

        {/* Wait Overlay */}
        {isProcessing && (
          <div id="waitOverlay" className="wait-overlay">
            <div className="wait-box">
              <span className="spinner"></span>
              <span>Please wait ...</span>
            </div>
          </div>
        )}
      </main>

      {/* Right Sidebar */}
      <aside id="rightSidebar" className={`sidebar sidebar-right ${rightOpen ? '' : 'collapsed'}`}>
        <button className="sidebar-toggle sidebar-toggle-right" onClick={() => setRightOpen(!rightOpen)}>
          {rightOpen ? "◀" : "◀"}
        </button>
        <div className="sidebar-content">
          <div className="section-header">
            <span>Settings</span>
            <span className="toggle-icon">▼</span>
          </div>

          <section className="settings-panel">
            <div className="settings-grid">
              <label className="field">
                <span>Brain ID</span>
                <input
                  type="text"
                  value={settings.brainId}
                  onChange={e => updateSettings({ brainId: e.target.value })}
                  placeholder="Brain ID"
                />
              </label>
              <label className="field">
                <span>NTID</span>
                <input type="text" value={settings.ntid || ''} readOnly placeholder="NTID" />
              </label>
              <label className="field">
                <span>Theme</span>
                <select value={settings.theme} onChange={e => updateSettings({ theme: e.target.value })}>
                  <option value="colorful">Colorful</option>
                  <option value="dark-gray">Dark Gray</option>
                  <option value="black">Black</option>
                  <option value="white">White</option>
                </select>
              </label>
              <label className="field">
                <span>Skill</span>
                <select
                  className="skill-dropdown"
                  value={settings.skill || ''}
                  onChange={e => updateSettings({ skill: e.target.value })}
                >
                  <option value="" disabled>Select a skill...</option>
                  {skills.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  type="button"
                  className="btn-edit-skill"
                  onClick={() => {
                    if (!settings.skill) {
                      alert("Please select a skill to edit");
                      return;
                    }
                    setIsSkillModalOpen(true);
                  }}
                >
                  Edit
                </button>
              </label>
              <label className="field">
                <span>Specific Requirements</span>
                <textarea
                  rows={4}
                  maxLength="2000"
                  placeholder="Input Specific Requirements..."
                  value={settings.customPrompt}
                  onChange={e => updateSettings({ customPrompt: e.target.value })}
                ></textarea>
                <button type="button" className="btn-expand-prompt" onClick={() => setIsPromptModalOpen(true)}>Edit</button>
              </label>
            </div>
            <div className="settings-actions">
              <button className="btn-primary" onClick={handleSaveSettings}>{saveStatus}</button>
              <button className="btn-ghost" onClick={resetSettings}>Reset</button>
            </div>
          </section>
        </div>
      </aside>

      {/* Modals */}
      <CustomPromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        value={settings.customPrompt}
        onApply={(val) => updateSettings({ customPrompt: val })}
      />

      <SkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        filename={settings.skill}
      />

    </div>
  );
}

export default App;
