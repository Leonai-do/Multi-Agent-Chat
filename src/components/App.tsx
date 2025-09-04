/**
 * @file This is the root component of the application.
 * It manages all application state, including chats, API interactions,
 * and UI state like modal visibility.
 */
import React, { useState, useEffect, useRef, FormEvent, FC } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useTheme } from '../hooks/useTheme';
import Sidebar from './Sidebar';
import SettingsModal from './SettingsModal';
import ChatView from './ChatView';
import { INITIAL_SYSTEM_INSTRUCTION, MODEL_NAME } from '../constants';
import type { Chat, Message } from '../types';
import { LS_CHATS_KEY, LS_TAVILY_KEY, LS_AGENT_INSTRUCTIONS, LS_AGENT_NAMES, getGeminiApiKey, LS_AGENT_COUNT } from '../config';
import { registerProvider } from '../llm/registry';
import GeminiProvider from '../llm/geminiProvider';
import GroqProvider from '../llm/groqProvider';
import { exportLogs, logEvent } from '../state/logs';
import GenerationController from '../state/generation';
import { runAgentCollaboration } from '../agents/collaborationOrchestrator';

const sanitizeTitle = (t: string): string => {
    try {
      let s = (t || '').replace(/[`*_#>[\]()]/g, '');
      s = s.replace(/^\s*"|"+\s*$/g, '');
      s = s.replace(/\s+/g, ' ').trim();
      if (!s) return 'New Chat';
      s = s.split(' ').slice(0, 5).join(' ');
      if (s.length > 64) s = s.slice(0, 64).trim();
      return s;
    } catch {
      return 'New Chat';
    }
  };

/**
 * The main App component.
 * @returns {React.ReactElement} The rendered application.
 */
const App: FC = () => {
  // Initialize theme management
  useTheme();
  
  // State for all chat sessions
  const [chats, setChats] = useState<Chat[]>([]);
  // State for the currently active chat ID
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  // State for the text in the input field
  const [input, setInput] = useState('');
  // State to track if the AI is currently generating a response
  const [isLoading, setIsLoading] = useState(false);
  // Ref to hold the initialized GoogleGenAI instance
  const aiRef = useRef<GoogleGenAI | null>(null);
  // State for the real-time status of collaborating agents
  const [currentCollaborationState, setCurrentCollaborationState] = useState<any[]>([]);
  // State for showing/hiding the live agent workspace
  const [showCollaboration, setShowCollaboration] = useState(false);
  // State for the settings modal visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // State for the customizable system instructions and names for the agents
  const [agentInstructions, setAgentInstructions] = useState<string[]>([]);
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const [agentCount, setAgentCount] = useState<number>(4);

  // State for sidebar visibility, especially on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  // State for enabling/disabling internet access
  const [internetEnabled, setInternetEnabled] = useState(false);
  // State for showing a loading message during web search
  const [loadingMessage, setLoadingMessage] = useState('');
  // Global progress bar state (determinate when total>0)
  const [progressTotal, setProgressTotal] = useState<number>(0);
  const [progressDone, setProgressDone] = useState<number>(0);
  // Mark the start timestamp of the current run for diagnostics filtering
  const [runStartTs, setRunStartTs] = useState<number | null>(null);
  // State for the Tavily API key, managed in Settings
  const [tavilyApiKey, setTavilyApiKey] = useState<string>('');
  // Floating notices for status/errors
  type Notice = { id: number; type: 'success'|'error'|'info'; text: string };
  const [notices, setNotices] = useState<Notice[]>([]);
  const pushNotice = (type: Notice['type'], text: string) => {
    const id = Date.now() + Math.floor(Math.random()*1000);
    setNotices(prev => [...prev, { id, type, text }]);
    if (type !== 'error') setTimeout(() => setNotices(prev => prev.filter(n => n.id !== id)), 6000);
  };
  const dismissNotice = (id: number) => setNotices(prev => prev.filter(n => n.id !== id));
  // Controller that coordinates generation runs and cancellation
  const generationControllerRef = useRef<GenerationController>(new GenerationController());

  // Effect to initialize the Gemini API client and load data from localStorage
  useEffect(() => {
    // Register providers once on app start
    try { registerProvider(GeminiProvider); registerProvider(GroqProvider); } catch {}
    // Resolve Gemini API key from env
    const apiKey = getGeminiApiKey() || '';
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    } else {
        console.error("Gemini API Key not found. Please ensure it's set in your environment variables.");
    }
    
    // Load chats, keys, and agent metadata from local storage on initial render
    try {
      const savedChats = localStorage.getItem(LS_CHATS_KEY);
      if (savedChats) setChats(JSON.parse(savedChats));
      
      const savedTavilyKey = localStorage.getItem(LS_TAVILY_KEY);
      if (savedTavilyKey) setTavilyApiKey(savedTavilyKey);

      const count = parseInt(localStorage.getItem(LS_AGENT_COUNT) || '4', 10);
      setAgentCount(count);

      const savedInstr = localStorage.getItem(LS_AGENT_INSTRUCTIONS);
      if (savedInstr) {
        try { 
          const arr = JSON.parse(savedInstr); 
          if (Array.isArray(arr) && arr.length) { 
            setAgentInstructions(arr); 
          } else {
            setAgentInstructions(Array(count).fill(INITIAL_SYSTEM_INSTRUCTION));
          }
        } catch {}
      } else {
        setAgentInstructions(Array(count).fill(INITIAL_SYSTEM_INSTRUCTION));
      }

      const savedNames = localStorage.getItem(LS_AGENT_NAMES);
      if (savedNames) {
        try { 
          const arr = JSON.parse(savedNames); 
          if (Array.isArray(arr) && arr.length) { 
            setAgentNames(arr); 
          } else {
            setAgentNames(Array(count).fill('').map((_, i) => `Agent ${i + 1}`));
          }
        } catch {}
      } else {
        setAgentNames(Array(count).fill('').map((_, i) => `Agent ${i + 1}`));
      }

    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);
  
  // Effect to save chats to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LS_CHATS_KEY, JSON.stringify(chats));
      try { logEvent('chat','info','chats_saved', { count: chats.length }); } catch {}
    } catch (error) {
      console.error("Failed to save chats to localStorage", error);
      try { logEvent('chat','error','chats_save_failed', { error: (error as any)?.message || String(error) }); } catch {}
    }
  }, [chats]);

  // Persist agent settings
  useEffect(() => {
    try { localStorage.setItem(LS_AGENT_INSTRUCTIONS, JSON.stringify(agentInstructions)); } catch {}
  }, [agentInstructions]);
  useEffect(() => {
    try { localStorage.setItem(LS_AGENT_NAMES, JSON.stringify(agentNames)); } catch {}
  }, [agentNames]);
  
  // --- Chat Management Handlers ---

  /** Saves the Tavily API key to state and localStorage. */
  const handleSaveTavilyApiKey = (key: string) => {
    setTavilyApiKey(key);
    try {
        localStorage.setItem(LS_TAVILY_KEY, key);
    } catch (error) {
        console.error("Failed to save Tavily API key to localStorage", error);
    }
    try { logEvent('settings','info','tavily_key_save', { length: key ? key.length : 0 }); } catch {}
  };

  /** Saves agent instructions and names from Settings modal. */
  const handleSaveAgentSettings = (newInstructions: string[], newNames: string[]) => {
    setAgentInstructions(newInstructions);
    setAgentNames(newNames);
    setAgentCount(newInstructions.length);
  };

  /** Sets the active chat to null, effectively showing the welcome screen to start a new chat. */
  const handleNewChat = () => { try { logEvent('ui','info','new_chat_click', {}); } catch {}; setActiveChatId(null); };
  
  /** Sets the active chat to the one with the specified ID. */
  const handleSelectChat = (id: string) => { try { logEvent('ui','info','select_chat', { chatId: id }); } catch {}; setActiveChatId(id); };
  
  /** Deletes a chat and resets the view if the deleted chat was active. */
  const handleDeleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    try { logEvent('chat','info','chat_deleted', { chatId: id }); } catch {}
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  /** Handles the submission of the main input form. */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const promptText = input;
    const now = Date.now();
    const userMessage: Message = { id: now.toString(), role: 'user', parts: [{ text: promptText }], createdAt: now };
    let currentChatId = activeChatId;
    let isNewChat = false;

    // If there's no active chat, create a new one
    if (!currentChatId) {
      isNewChat = true;
      currentChatId = Date.now().toString();
      const newChat: Chat = { id: currentChatId, title: "New Chat", messages: [userMessage] };
      setChats(prev => [newChat, ...prev]);
      try { logEvent('chat','info','chat_new', { chatId: currentChatId, title: 'New Chat' }); } catch {}
      try { logEvent('chat','info','snapshot', { chatId: currentChatId, chat: newChat }); } catch {}
      setActiveChatId(currentChatId);
    } else {
      // Otherwise, add the message to the existing active chat
      setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [...c.messages, userMessage] } : c));
      try {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) logEvent('chat','info','snapshot', { chatId: currentChatId, chat: { ...chat, messages: [...chat.messages, userMessage] } });
      } catch {}
    }
    try { logEvent('chat','info','message_add', { chatId: currentChatId, messageId: userMessage.id, type: 'user' }); } catch {}

    setInput('');
    const finalText = await runAgentCollaboration(promptText, currentChatId, isNewChat, agentCount, {
      setIsLoading,
      setShowCollaboration,
      setLoadingMessage,
      setProgressDone,
      setProgressTotal,
      setCurrentCollaborationState,
      setChats,
      pushNotice,
      setRunStartTs,
      internetEnabled,
      agentInstructions,
      agentNames,
      chats,
      activeChatId,
      generationControllerRef,
      aiRef,
    });

    if (isNewChat && finalText) {
        const titlePrompt = `Generate a very short, plain-text chat title for this conversation.\n\nRules:\n- Maximum 5 words\n- Plain text only (no markdown, no quotes)\n- If naturally appropriate, include at most one relevant emoji\n- Return only the title line\n\nConversation:\nUser: ${promptText}\nAssistant: ${finalText}`;
        try {
            const ai = aiRef.current;
            const titleResponse = await ai!.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: titlePrompt }] }] });
            const raw = (titleResponse.text ?? 'New Chat').trim();
            const newTitle = sanitizeTitle(raw);
            setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, title: newTitle } : c));
            try { logEvent('chat','info','title_set', { chatId: currentChatId, title: newTitle }); } catch {}
        } catch (e) {
            console.error("Failed to generate title", e);
            // Non-critical error, chat will remain "New Chat"
        }
    }
  };
  
  /** Updates the text of a specific message, used for saving an edit. */
  const handleUpdateMessage = (messageId: string, newText: string) => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        const updated = {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, parts: [{ text: newText }] } : m)
        };
        try { logEvent('chat','info','snapshot', { chatId: activeChatId, chat: updated }); } catch {}
        return updated;
      }
      return c;
    }));
    try { logEvent('chat','info','message_update', { chatId: activeChatId, messageId, newLength: newText.length }); } catch {}
  };

  /** Resends an edited message, truncating the chat history from that point. */
  const handleResendMessage = (messageId: string, newText: string) => {
    if (!activeChatId) return;
    
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    const messageIndex = chat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const resend = async () => {
      setChats(prev => prev.map(c => {
        if (c.id === activeChatId) {
          const updatedMessages = c.messages.map(m => m.id === messageId ? { ...m, parts: [{ text: newText }] } : m);
          const truncatedMessages = updatedMessages.slice(0, messageIndex + 1);
          const updated = { ...c, messages: truncatedMessages };
          try { logEvent('chat','info','snapshot', { chatId: activeChatId, chat: updated }); } catch {}
          return updated;
        }
        return c;
      }));
      try { logEvent('chat','info','resend', { chatId: activeChatId, messageId, truncatedAfter: messageId }); } catch {}
      await runAgentCollaboration(newText, activeChatId, false, agentCount, {
        setIsLoading,
        setShowCollaboration,
        setLoadingMessage,
        setProgressDone,
        setProgressTotal,
        setCurrentCollaborationState,
        setChats,
        pushNotice,
        setRunStartTs,
        internetEnabled,
        agentInstructions,
        agentNames,
        chats,
        activeChatId,
        generationControllerRef,
        aiRef,
      });
    };
    resend();
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  /** Stops any in-flight generation and resets UI state. */
  const handleStopGeneration = () => {
    generationControllerRef.current.stop();
    setIsLoading(false);
    // Preserve any partially generated content and statuses; optional label
    setLoadingMessage((msg) => msg || 'Stopped');
    try { logEvent('ui','info','stop_click', { runId: String(generationControllerRef.current.token || '') , actor: 'user' }); } catch {}
  };

  return (
    <div className="app-wrapper">
      {/* Floating notices */}
      <div style={{ position: 'fixed', right: '1rem', bottom: '1rem', zIndex: 1000, maxWidth: '360px' }}>
        {notices.map(n => (
          <div key={n.id} style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', background: n.type==='success'? 'rgba(46,204,113,0.12)' : n.type==='error'? 'rgba(231,76,60,0.12)' : 'rgba(52,152,219,0.12)', color: n.type==='success'? '#2ecc71' : n.type==='error'? '#e74c3c' : '#3498db', border: `1px solid ${n.type==='success'? '#2ecc71' : n.type==='error'? '#e74c3c' : '#3498db'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.35 }}>{n.text}</div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => exportLogs()} title="Export logs" aria-label="Export logs" style={{ border: 'none', background: 'transparent', color:'inherit', cursor:'pointer' }}>⤓</button>
                <button onClick={() => dismissNotice(n.id)} aria-label="Dismiss" style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>×</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => { try { logEvent('ui','info','settings_close', {}); } catch {}; setIsSettingsOpen(false); }}
        instructions={agentInstructions} 
        names={agentNames}
        onSave={handleSaveAgentSettings}
        tavilyApiKey={tavilyApiKey}
        onSaveTavilyApiKey={handleSaveTavilyApiKey}
      />
      <div className={`sidebar ${isSidebarOpen ? 'sidebar--open' : ''}`}>
        <Sidebar chats={chats} activeChatId={activeChatId} onNewChat={handleNewChat} onSelectChat={handleSelectChat} onDeleteChat={handleDeleteChat} />
      </div>
      <ChatView 
        activeChat={activeChat}
        isLoading={isLoading}
        loadingMessage={loadingMessage}
        progress={progressTotal > 0 ? (progressDone / Math.max(1, progressTotal)) : undefined}
        runStartTs={runStartTs}
        internetEnabled={internetEnabled}
        onToggleInternet={() => { const next = !internetEnabled; try { logEvent('ui','info','toggle_internet', { enabled: next }); } catch {}; setInternetEnabled(next); }}
        currentCollaborationState={currentCollaborationState}
        showCollaboration={showCollaboration}
        setShowCollaboration={(show) => { try { logEvent('ui','info','workspace_toggle', { show }); } catch {}; setShowCollaboration(show); }}
        handleSubmit={handleSubmit}
        input={input}
        setInput={setInput}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={(open) => { try { logEvent('ui','info','sidebar_toggle', { open }); } catch {}; setIsSidebarOpen(open); }}
        setIsSettingsOpen={(open) => { try { logEvent('ui','info','settings_open', {}); } catch {}; setIsSettingsOpen(open); }}
        onUpdateMessage={handleUpdateMessage}
        onResendMessage={handleResendMessage}
        onStopGeneration={handleStopGeneration}
      />
    </div>
  );
};

export default App;