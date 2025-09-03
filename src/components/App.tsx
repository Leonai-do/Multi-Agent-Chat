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
import { MODEL_NAME, INITIAL_SYSTEM_INSTRUCTION, REFINEMENT_SYSTEM_INSTRUCTION, SYNTHESIZER_SYSTEM_INSTRUCTION } from '../constants';
import type { Chat, Message, LiveAgentState, CollaborationTrace, Source } from '../types';
import { LS_CHATS_KEY, LS_TAVILY_KEY, LS_PROVIDER_GLOBAL, LS_PROVIDER_PER_AGENT, LS_MODEL_GLOBAL, LS_MODEL_PER_AGENT, getGeminiApiKey, getGroqApiKey } from '../config';
import { generateGroqTextViaREST } from '../llm/groqRest';
import { addLog, exportLogs } from '../state/logs';
import GenerationController from '../state/generation';

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
  const [currentCollaborationState, setCurrentCollaborationState] = useState<LiveAgentState[]>([]);
  // State for showing/hiding the live agent workspace
  const [showCollaboration, setShowCollaboration] = useState(false);
  // State for the settings modal visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // State for the customizable system instructions for the initial agents
  const [agentInstructions, setAgentInstructions] = useState<string[]>(() => Array(4).fill(INITIAL_SYSTEM_INSTRUCTION));
  // State for sidebar visibility, especially on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  // State for enabling/disabling internet access
  const [internetEnabled, setInternetEnabled] = useState(false);
  // State for showing a loading message during web search
  const [loadingMessage, setLoadingMessage] = useState('');
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
    // Resolve Gemini API key from env
    const apiKey = getGeminiApiKey() || '';
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    } else {
        console.error("Gemini API Key not found. Please ensure it's set in your environment variables.");
    }
    
    // Load chats and Tavily API key from local storage on initial render
    try {
      const savedChats = localStorage.getItem(LS_CHATS_KEY);
      if (savedChats) setChats(JSON.parse(savedChats));
      
      const savedTavilyKey = localStorage.getItem(LS_TAVILY_KEY);
      if (savedTavilyKey) setTavilyApiKey(savedTavilyKey);

    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);
  
  // Effect to save chats to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LS_CHATS_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error("Failed to save chats to localStorage", error);
    }
  }, [chats]);
  
  // --- Chat Management Handlers ---

  /** Saves the Tavily API key to state and localStorage. */
  const handleSaveTavilyApiKey = (key: string) => {
    setTavilyApiKey(key);
    try {
        localStorage.setItem(LS_TAVILY_KEY, key);
    } catch (error) {
        console.error("Failed to save Tavily API key to localStorage", error);
    }
  };

  /** Sets the active chat to null, effectively showing the welcome screen to start a new chat. */
  const handleNewChat = () => setActiveChatId(null);
  
  /** Sets the active chat to the one with the specified ID. */
  const handleSelectChat = (id: string) => setActiveChatId(id);
  
  /** Deletes a chat and resets the view if the deleted chat was active. */
  const handleDeleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  /**
   * The core logic for the multi-agent collaboration process.
   * @param {string} prompt - The user's input prompt.
   * @param {string} chatId - The ID of the chat to add the response to.
   * @param {boolean} isNewChat - Flag indicating if this is the first message in a new chat (for title generation).
   */
  const runAgentCollaboration = async (prompt: string, chatId: string, isNewChat: boolean) => {
    // Begin a new generation run and create an abort signal
    generationControllerRef.current.start();
    const signal = generationControllerRef.current.signal;
    setIsLoading(true);
    setShowCollaboration(true);
    setLoadingMessage('');

    let webContext = '';
    let sources: Source[] = [];
    // Load provider/model preferences
    const count = 4;
    let globalProvider: 'gemini'|'groq' = 'gemini';
    let perAgentProviders: Array<'gemini'|'groq'> = Array(count).fill('gemini');
    let globalModel: string | undefined = undefined;
    let perAgentModels: string[] = Array(count).fill('');
    try {
      const gp = (localStorage.getItem(LS_PROVIDER_GLOBAL) as any) || 'gemini';
      const pa = JSON.parse(localStorage.getItem(LS_PROVIDER_PER_AGENT) || '[]');
      const gm = localStorage.getItem(LS_MODEL_GLOBAL) || '';
      const pam = JSON.parse(localStorage.getItem(LS_MODEL_PER_AGENT) || '[]');
      globalProvider = (gp === 'groq') ? 'groq' : 'gemini';
      perAgentProviders = Array(count).fill(globalProvider).map((v, i) => (pa[i] === 'groq' ? 'groq' : (pa[i] === 'gemini' ? 'gemini' : globalProvider)));
      globalModel = gm || undefined;
      perAgentModels = Array(count).fill(globalModel || '').map((v, i) => pam[i] || v);
    } catch {}

    // Step 0: Perform web search if internet is enabled
    if (internetEnabled) {
      setLoadingMessage('Searching the web...');
      try {
        if (!tavilyApiKey) {
          throw new Error("Tavily API key not found. Please add it in the settings menu to enable web search.");
        }

        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: prompt,
            search_depth: 'basic',
            include_raw_content: true,
            max_results: 3,
          }),
          signal: generationControllerRef.current.signal,
        });
        if (!response.ok) throw new Error(`Tavily API error: ${response.statusText}`);
        const searchData = await response.json();
        
        sources = (searchData.results || []).map((r: any): Source => ({
            title: r.title,
            url: r.url,
            content: r.raw_content || '',
        })).filter(s => s.content);

        if (sources.length > 0) {
            webContext = "Here is some context from a web search. Use this to inform your answer:\n\n" + 
                sources.map((s, i) => `Source [${i + 1}] (${s.title}):\n${s.content}`).join('\n\n---\n\n');
        }
      } catch (e: any) {
          console.error("Failed to fetch from Tavily API", e);
          if (e?.name === 'AbortError' || signal.aborted) {
            // Silent cancel
          } else {
            const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: `Sorry, I couldn't search the web. ${e.message}` }] };
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
          }
          setIsLoading(false);
          setCurrentCollaborationState([]);
          setLoadingMessage('');
          generationControllerRef.current.finish();
          return;
      }
    }
    
    setLoadingMessage('Agents are collaborating...');
    // Initialize live agent state for the UI
    const initialAgents: LiveAgentState[] = Array.from({ length: 4 }, (_, i) => ({ id: i, status: 'initializing', response: '' }));
    setCurrentCollaborationState(initialAgents);
    
    const ai = aiRef.current;
    if (!ai) {
        console.error('AI client is not initialized.');
        setIsLoading(false);
        setCurrentCollaborationState([]);
        setLoadingMessage('');
        // Ensure controller is finalized even on early return
        generationControllerRef.current.finish();
        return;
    }
      
    try {
      const promptForAgents = webContext ? `${webContext}\n\nBased on the context above, please answer the following user query:\n${prompt}` : prompt;
      
      // Step 1: Get initial responses from all four agents in parallel
      setCurrentCollaborationState(prev => prev.map(a => ({ ...a, status: 'writing' })));
      const initialResponses = await Promise.all(
        initialAgents.map(async (agent) => {
          if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const provider = perAgentProviders[agent.id] || globalProvider;
          const model = perAgentModels[agent.id] || globalModel || MODEL_NAME;
          let text = '';
          if (provider === 'groq') {
            const groqKey = getGroqApiKey();
            if (!groqKey) throw new Error('Groq API key not set');
            text = await generateGroqTextViaREST({ apiKey: groqKey, model, system: agentInstructions[agent.id], prompt: promptForAgents, signal: generationControllerRef.current.signal });
          } else {
            const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: promptForAgents }] }], config: { systemInstruction: agentInstructions[agent.id] } });
            text = response.text ?? '';
          }
          if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
          addLog('debug', 'Initial response', { agent: agent.id, provider, model, length: text.length });
          return text;
        })
      );
      
      // Step 2: Get refined responses from all four agents in parallel
      setCurrentCollaborationState(prev => prev.map(a => ({ ...a, status: 'refining' })));
      const refinedResponses = await Promise.all(
        initialAgents.map(async (agent, agentIndex) => {
          if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const provider = perAgentProviders[agent.id] || globalProvider;
          const model = perAgentModels[agent.id] || globalModel || MODEL_NAME;
          const otherResponses = initialResponses.map((resp, i) => `Response from Agent ${i + 1}:\n${resp}`).join('\n\n---\n\n');
          const refinementPrompt = `Your original instruction was: "${agentInstructions[agentIndex]}"\n\nHere are the initial responses from all four agents, including your own:\n\n${otherResponses}\n\nPlease critically evaluate all responses. Identify weaknesses, inconsistencies, or factual errors. Then, generate a new, superior response that improves upon these initial drafts.`;
          let text = '';
          if (provider === 'groq') {
            const groqKey = getGroqApiKey();
            if (!groqKey) throw new Error('Groq API key not set');
            text = await generateGroqTextViaREST({ apiKey: groqKey, model, system: REFINEMENT_SYSTEM_INSTRUCTION, prompt: refinementPrompt, signal: generationControllerRef.current.signal });
          } else {
            const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: refinementPrompt }] }], config: { systemInstruction: REFINEMENT_SYSTEM_INSTRUCTION } });
            text = response.text ?? '';
          }
          if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text, status: 'done' } : a));
          addLog('debug', 'Refined response', { agent: agent.id, provider, model, length: text.length });
          return text;
        })
      );
      
      // Step 3: Get the final synthesized response from the fifth agent
      const sourceListForSynthesizer = sources.map((s, i) => `Source [${i + 1}]: ${s.url}`).join('\n');
      const finalPrompt = `Here are the four refined responses from the agent team:\n\n${refinedResponses.map((r, i) => `Refined Response from Agent ${i + 1}:\n${r}`).join('\n\n---\n\n')}\n\n${sourceListForSynthesizer ? `Use these sources for citation:\n${sourceListForSynthesizer}\n\n` : ''}Synthesize these into a single, final, comprehensive answer for the user. Remember to add citations like [1], [2] etc. where appropriate.`;
      if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      let finalText = '';
      {
        const provider = globalProvider;
        const model = globalModel || MODEL_NAME;
        if (provider === 'groq') {
          const groqKey = getGroqApiKey();
          if (!groqKey) throw new Error('Groq API key not set');
          finalText = await generateGroqTextViaREST({ apiKey: groqKey, model, system: SYNTHESIZER_SYSTEM_INSTRUCTION, prompt: finalPrompt, signal: generationControllerRef.current.signal });
        } else {
          const finalResponse = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: finalPrompt }] }], config: { systemInstruction: SYNTHESIZER_SYSTEM_INSTRUCTION } });
          finalText = finalResponse.text ?? '';
        }
        addLog('info', 'Final synthesized response', { provider, model, length: finalText.length });
      }
      
      const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
      const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: finalText }], collaborationTrace, sources: sources.length > 0 ? sources : undefined };
      
      // Add the final model message to the active chat
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMessage] } : c));

      // Step 4 (Optional): If it's a new chat, generate a title
      if (isNewChat) {
        const titlePrompt = `Based on the following interaction, create a short, concise title (max 5 words).\n\nUser: ${prompt}\n\nAssistant: ${finalText}`;
        try {
            const titleResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: titlePrompt }] }] });
            const newTitle = (titleResponse.text ?? 'Untitled Chat').replace(/"/g, '').trim();
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
        } catch (e) {
            console.error("Failed to generate title", e);
            // Non-critical error, chat will remain "New Chat"
        }
      }

    } catch (error) {
      if ((error as any)?.name === 'AbortError' || generationControllerRef.current.signal.aborted) {
        // User aborted; do not append error message
      } else {
        console.error("An error occurred during agent collaboration:", error);
        // push notice and log
        try { addLog('error', 'Run failed', { error: (error as any)?.message || String(error) }); } catch {}
        try { pushNotice('error', `Run failed: ${(error as any)?.message || String(error)}`); } catch {}
        const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: 'Sorry, something went wrong. Please check the console for details.' }] };
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
      }
    } finally {
      setIsLoading(false);
      setCurrentCollaborationState([]);
      setLoadingMessage('');
      generationControllerRef.current.finish();
      try { pushNotice('success', 'Processing done'); } catch {}
      try { addLog('info', 'Run finished'); } catch {}
    }
  };

  /** Handles the submission of the main input form. */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const promptText = input;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', parts: [{ text: promptText }] };
    let currentChatId = activeChatId;
    let isNewChat = false;

    // If there's no active chat, create a new one
    if (!currentChatId) {
      isNewChat = true;
      currentChatId = Date.now().toString();
      const newChat: Chat = { id: currentChatId, title: "New Chat", messages: [userMessage] };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(currentChatId);
    } else {
      // Otherwise, add the message to the existing active chat
      setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [...c.messages, userMessage] } : c));
    }

    setInput('');
    await runAgentCollaboration(promptText, currentChatId, isNewChat);
  };
  
  /** Updates the text of a specific message, used for saving an edit. */
  const handleUpdateMessage = (messageId: string, newText: string) => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, parts: [{ text: newText }] } : m)
        };
      }
      return c;
    }));
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
          return { ...c, messages: truncatedMessages };
        }
        return c;
      }));
      await runAgentCollaboration(newText, activeChatId, false);
    };
    resend();
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  /** Stops any in-flight generation and resets UI state. */
  const handleStopGeneration = () => {
    generationControllerRef.current.stop();
    setIsLoading(false);
    setCurrentCollaborationState([]);
    setLoadingMessage('');
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
        onClose={() => setIsSettingsOpen(false)} 
        instructions={agentInstructions} 
        onSave={setAgentInstructions}
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
        internetEnabled={internetEnabled}
        onToggleInternet={() => setInternetEnabled(prev => !prev)}
        currentCollaborationState={currentCollaborationState}
        showCollaboration={showCollaboration}
        setShowCollaboration={setShowCollaboration}
        handleSubmit={handleSubmit}
        input={input}
        setInput={setInput}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        onUpdateMessage={handleUpdateMessage}
        onResendMessage={handleResendMessage}
        onStopGeneration={handleStopGeneration}
      />
    </div>
  );
};

export default App;
