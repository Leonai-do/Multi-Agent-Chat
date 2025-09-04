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
import { LS_CHATS_KEY, LS_TAVILY_KEY, LS_PROVIDER_GLOBAL, LS_PROVIDER_PER_AGENT, LS_MODEL_GLOBAL, LS_MODEL_PER_AGENT, LS_AGENT_INSTRUCTIONS, LS_AGENT_NAMES, getGeminiApiKey, getGroqApiKey } from '../config';
import { registerProvider, getProvider } from '../llm/registry';
import type { ProviderName } from '../llm/provider';
import GeminiProvider from '../llm/geminiProvider';
import GroqProvider from '../llm/groqProvider';
import { addLog, exportLogs, logEvent } from '../state/logs';
import GenerationController from '../state/generation';

/**
 * Sanitize and normalize a generated chat title to be short, plain text.
 * - Remove common Markdown punctuation
 * - Strip surrounding quotes
 * - Limit to 5 words and 64 chars
 */
const sanitizeTitle = (t: string): string => {
  try {
    let s = (t || '').replace(/[`*_#>\[\]()]/g, '');
    s = s.replace(/^\s*"+|"+\s*$/g, '');
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
  const [currentCollaborationState, setCurrentCollaborationState] = useState<LiveAgentState[]>([]);
  // State for showing/hiding the live agent workspace
  const [showCollaboration, setShowCollaboration] = useState(false);
  // State for the settings modal visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // State for the customizable system instructions and names for the agents
  const [agentInstructions, setAgentInstructions] = useState<string[]>(() => Array(4).fill(INITIAL_SYSTEM_INSTRUCTION));
  const [agentNames, setAgentNames] = useState<string[]>(() => Array(4).fill('').map((_, i) => `Agent ${i + 1}`));
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

      const savedInstr = localStorage.getItem(LS_AGENT_INSTRUCTIONS);
      if (savedInstr) {
        try { const arr = JSON.parse(savedInstr); if (Array.isArray(arr) && arr.length) setAgentInstructions(arr); } catch {}
      }
      const savedNames = localStorage.getItem(LS_AGENT_NAMES);
      if (savedNames) {
        try { const arr = JSON.parse(savedNames); if (Array.isArray(arr) && arr.length) setAgentNames(arr); } catch {}
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

  /**
   * The core logic for the multi-agent collaboration process.
   * @param {string} prompt - The user's input prompt.
   * @param {string} chatId - The ID of the chat to add the response to.
   * @param {boolean} isNewChat - Flag indicating if this is the first message in a new chat (for title generation).
   */
  const runAgentCollaboration = async (prompt: string, chatId: string, isNewChat: boolean) => {
    // Begin a new generation run and create an abort signal
    const runToken = generationControllerRef.current.start();
    try { logEvent('pipeline','info','run_start', { runId: String(runToken), chatId, prompt, internetEnabled }); } catch {}
    setRunStartTs(Date.now());
    const signal = generationControllerRef.current.signal;
    setIsLoading(true);
    setShowCollaboration(true);
    setLoadingMessage('');
    setProgressDone(0);
    setProgressTotal((internetEnabled ? 1 : 0) + 4 + 4 + 1);

    let webContext = '';
    let sources: Source[] = [];
    // Defensive: resolve agent names fallback to avoid runtime ReferenceError in templates
    const namesLocal: string[] = (Array.isArray(agentNames) && agentNames.length)
      ? agentNames
      : Array(4).fill('').map((_, i) => `Agent ${i + 1}`);
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
        const fetchWithRetry = async (attempts = 3): Promise<Response> => {
          let last: Response | null = null;
          for (let i = 1; i <= attempts; i++) {
            last = await fetch('/api/tools/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: prompt,
                search_depth: 'basic',
                include_raw_content: true,
                max_results: 3,
              }),
              signal: generationControllerRef.current.signal,
            });
            if (last.ok) return last;
            // 5xx: backoff and retry
            if (last.status >= 500 && i < attempts) {
              await new Promise(r => setTimeout(r, 300 * i));
              continue;
            }
            return last;
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return last!;
        };
        const response = await fetchWithRetry(3);
        if (!response.ok) throw new Error(`Web search error: ${response.status} ${response.statusText}`);
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
            const advice = e?.message?.includes('500') ? 'Ensure the server has TAVILY_API_KEY configured (see Settings → Providers & Models notes) and try again.' : '';
            const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: `Sorry, I couldn't search the web. ${e.message}${advice ? `\n\nHint: ${advice}` : ''}` }] };
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
            try { logEvent('pipeline','error','web_search_failed', { runId: String(runToken), error: e?.message || String(e) }); } catch {}
          }
          setIsLoading(false);
          // keep workspace content as-is on abort/error; just reset progress
          setLoadingMessage('');
          setProgressDone(0);
          setProgressTotal(0);
          generationControllerRef.current.finish(runToken);
          return;
      }
      // web search finished successfully
      setProgressDone(d => d + 1);
      try { logEvent('pipeline','info','web_search_done', { runId: String(runToken), sources: sources.length }); } catch {}
    }
    
    setLoadingMessage('Agents are collaborating...');
    try { addLog('info', 'Phase started', { phase: 'initial' }); } catch {}
    try { logEvent('pipeline','info','phase_start', { runId: String(runToken), phase: 'initial' }); } catch {}
    // Initialize live agent state for the UI
    const initialAgents: LiveAgentState[] = Array.from({ length: 4 }, (_, i) => ({ id: i, status: 'initializing', response: '' }));
    setCurrentCollaborationState(initialAgents);
    
    // Note: We no longer require GoogleGenAI client to run the pipeline.
    // Providers handle generation; the Google client is only used optionally for title.
      
    try {
      const promptForAgents = webContext ? `${webContext}\n\nBased on the context above, please answer the following user query:\n${prompt}` : prompt;
      
      // Step 1: Get initial responses sequentially (one agent at a time)
      const initialResponses: string[] = Array(initialAgents.length).fill('');
      for (const agent of initialAgents) {
        if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        setLoadingMessage(`Writing: Agent ${agent.id + 1}/4`);
        const provider = perAgentProviders[agent.id] || globalProvider;
        const model = perAgentModels[agent.id] || globalModel || MODEL_NAME;
        const sys = `You are ${namesLocal[agent.id]}. ${agentInstructions[agent.id]}`;
        const pName = provider as ProviderName;
        const p = getProvider(pName);
        if (!p) throw new Error(`Provider not registered: ${pName}`);
        setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'writing', response: '' } : a));
        try { logEvent('pipeline','info','agent_step_start', { runId: String(runToken), phase: 'initial', agentId: agent.id, provider, model }); } catch {}
        let text = '';
        const canStream = !!(p.capabilities?.streaming && typeof p.generateStream === 'function');
        // Per-step timeout (25s) to avoid hanging on network issues
        const stepController = new AbortController();
        const stepTimer = setTimeout(() => { try { stepController.abort(); } catch {} }, 25000);
        const stepSignal = (AbortSignal as any)?.any ? (AbortSignal as any).any([generationControllerRef.current.signal, stepController.signal]) : stepController.signal;
        try {
          if (canStream) {
            let acc = '';
            let chunkCount = 0;
            for await (const chunk of p.generateStream({ model, prompt: promptForAgents, system: sys, signal: stepSignal })) {
              if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              clearTimeout(stepTimer); // first chunk arrived
              acc += chunk || '';
              chunkCount++;
              const safeAcc = acc;
              setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: safeAcc } : a));
              try { logEvent('pipeline','debug','agent_step_chunk', { runId: String(runToken), phase: 'initial', agentId: agent.id, chunkLen: (chunk||'').length, chunks: chunkCount }); } catch {}
            }
            text = acc;
          } else {
            text = await p.generateText({ model, prompt: promptForAgents, system: sys, signal: stepSignal });
            if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            clearTimeout(stepTimer);
            setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
          }
        } catch (e: any) {
          clearTimeout(stepTimer);
          if (generationControllerRef.current.signal.aborted) throw e; // global abort
          // Per-step timeout or fetch error: record and continue with next agent
          try { addLog('error', 'Initial step failed', { agent: agent.id, error: e?.message || String(e) }); } catch {}
          text = '';
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
        }
        setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'done' } : a));
        setProgressDone(d => d + 1);
        addLog('debug', 'Initial response', { agent: agent.id, provider, model, length: text.length });
        try { logEvent('pipeline','info','agent_step_done', { runId: String(runToken), phase: 'initial', agentId: agent.id, length: text.length }); } catch {}
        initialResponses[agent.id] = text;
      }
      
      // Step 2: Get refined responses sequentially
      try { addLog('info', 'Phase started', { phase: 'refinement-sequential' }); } catch {}
      try { logEvent('pipeline','info','phase_start', { runId: String(runToken), phase: 'refinement' }); } catch {}
      // Collect refined responses for each agent
      const refinedResponses: string[] = Array(initialAgents.length).fill('');
      for (const agent of initialAgents) {
        if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        setLoadingMessage(`Refining: Agent ${agent.id + 1}/4`);
        const provider = perAgentProviders[agent.id] || globalProvider;
        const model = perAgentModels[agent.id] || globalModel || MODEL_NAME;
        const otherResponses = initialResponses.map((resp, i) => `Response from Agent ${i + 1}:\n${resp}`).join('\n\n---\n\n');
        const refinementPrompt = `Your original instruction was: "You are ${namesLocal[agent.id]}. ${agentInstructions[agent.id]}"\n\nHere are the initial responses from all four agents, including your own:\n\n${otherResponses}\n\nPlease critically evaluate all responses. Identify weaknesses, inconsistencies, or factual errors. Then, generate a new, superior response that improves upon these initial drafts.`;
        const pName = provider as ProviderName;
        const p = getProvider(pName);
        if (!p) throw new Error(`Provider not registered: ${pName}`);
        setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'refining', response: '' } : a));
        try { logEvent('pipeline','info','agent_step_start', { runId: String(runToken), phase: 'refinement', agentId: agent.id, provider, model }); } catch {}
        let text = '';
        const canStream = !!(p.capabilities?.streaming && typeof p.generateStream === 'function');
        const stepController = new AbortController();
        const stepTimer = setTimeout(() => { try { stepController.abort(); } catch {} }, 25000);
        const stepSignal = (AbortSignal as any)?.any ? (AbortSignal as any).any([generationControllerRef.current.signal, stepController.signal]) : stepController.signal;
        try {
          if (canStream) {
            let acc = '';
            let chunkCount = 0;
            for await (const chunk of p.generateStream({ model, prompt: refinementPrompt, system: REFINEMENT_SYSTEM_INSTRUCTION, signal: stepSignal })) {
              if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              clearTimeout(stepTimer);
              acc += chunk || '';
              chunkCount++;
              const safeAcc = acc;
              setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: safeAcc } : a));
              try { logEvent('pipeline','debug','agent_step_chunk', { runId: String(runToken), phase: 'refinement', agentId: agent.id, chunkLen: (chunk||'').length, chunks: chunkCount }); } catch {}
            }
            text = acc;
          } else {
            text = await p.generateText({ model, prompt: refinementPrompt, system: REFINEMENT_SYSTEM_INSTRUCTION, signal: stepSignal });
            if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            clearTimeout(stepTimer);
            setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
          }
        } catch (e: any) {
          clearTimeout(stepTimer);
          if (generationControllerRef.current.signal.aborted) throw e;
          try { addLog('error', 'Refine step failed', { agent: agent.id, error: e?.message || String(e) }); } catch {}
          text = '';
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
        }
        setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'done' } : a));
        setProgressDone(d => d + 1);
        addLog('debug', 'Refined response', { agent: agent.id, provider, model, length: text.length });
        try { logEvent('pipeline','info','agent_step_done', { runId: String(runToken), phase: 'refinement', agentId: agent.id, length: text.length }); } catch {}
        refinedResponses[agent.id] = text;
      }
      
      // Step 3: Get the final synthesized response from the fifth agent
      const sourceListForSynthesizer = sources.map((s, i) => `Source [${i + 1}]: ${s.url}`).join('\n');

      const finalPrompt = `Here are the four refined responses from the agent team:\n\n${refinedResponses.map((r, i) => `Refined Response from Agent ${i + 1}:\n${r}`).join('\n\n---\n\n')}\n\n${sourceListForSynthesizer ? `Use these sources for citation:\n${sourceListForSynthesizer}\n\n` : ''}Synthesize these into a single, final, comprehensive answer for the user. Remember to add citations like [1], [2] etc. where appropriate.`;
      if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      let finalText = '';
      let streamedFinal = false;
      const finalProvider = globalProvider;
      const finalModel = globalModel || MODEL_NAME;
      {
        const p = getProvider(finalProvider as ProviderName);
        if (!p) throw new Error(`Provider not registered: ${finalProvider}`);
        try { addLog('info', 'Phase started', { phase: 'final' }); } catch {}
        try { logEvent('pipeline','info','phase_start', { runId: String(runToken), phase: 'final' }); } catch {}
        setLoadingMessage('Synthesizing final answer...');
        if (p.capabilities?.streaming && typeof p.generateStream === 'function') {
          streamedFinal = true;
          let acc = '';
          const stepController = new AbortController();
          const stepTimer = setTimeout(() => { try { stepController.abort(); } catch {} }, 30000);
          const stepSignal = (AbortSignal as any)?.any ? (AbortSignal as any).any([generationControllerRef.current.signal, stepController.signal]) : stepController.signal;
          let finalMessageId: string | null = null;
          let chunkCount = 0;
          for await (const chunk of p.generateStream({ model: finalModel, prompt: finalPrompt, system: SYNTHESIZER_SYSTEM_INSTRUCTION, signal: stepSignal })) {
            if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            clearTimeout(stepTimer);
            acc += chunk || '';
            chunkCount++;
            const textNow = acc;
            if (!finalMessageId) {
              // Create a provisional message and append it to chat
              finalMessageId = (Date.now() + Math.floor(Math.random() * 1000)).toString();
              const provisional: Message = { id: finalMessageId, role: 'model', parts: [{ text: textNow }], createdAt: Date.now(), provider: finalProvider, model: finalModel };
              setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, provisional] } : c));
              try { logEvent('chat','info','message_add', { runId: String(runToken), chatId, messageId: finalMessageId, type: 'provisional_final' }); } catch {}
            } else {
              // Update existing provisional message text
              const idToUpdate = finalMessageId;
              setChats(prev => prev.map(c => {
                if (c.id !== chatId) return c;
                return {
                  ...c,
                  messages: c.messages.map(m => m.id === idToUpdate ? { ...m, parts: [{ text: textNow }] } : m)
                };
              }));
            }
            try { logEvent('pipeline','debug','final_chunk', { runId: String(runToken), chunkLen: (chunk||'').length, chunks: chunkCount }); } catch {}
          }
          finalText = acc;
          // Attach trace and sources to the provisional message if it exists
          if (finalMessageId) {
            const idToUpdate = finalMessageId;
            const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
            setChats(prev => prev.map(c => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map(m => m.id === idToUpdate ? { ...m, collaborationTrace, sources: sources.length > 0 ? sources : undefined } : m)
              };
            }));
            try { logEvent('chat','info','message_update', { runId: String(runToken), chatId, messageId: finalMessageId, attach: ['collaborationTrace','sources'] }); } catch {}
          }
        } else {
          finalText = await p.generateText({ model: finalModel, prompt: finalPrompt, system: SYNTHESIZER_SYSTEM_INSTRUCTION, signal: generationControllerRef.current.signal });
          if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        }
        addLog('info', 'Final synthesized response', { provider: finalProvider, model: finalModel, length: finalText.length });
        try { logEvent('pipeline','info','final_done', { runId: String(runToken), length: finalText.length }); } catch {}
      }
      setProgressDone(d => d + 1);
      
      // If we didn't stream into an existing provisional message, append now
      if (!streamedFinal) {
        const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
        const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: finalText }], collaborationTrace, sources: sources.length > 0 ? sources : undefined, createdAt: Date.now(), provider: finalProvider, model: finalModel };
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMessage] } : c));
        try { logEvent('chat','info','message_add', { runId: String(runToken), chatId, messageId: modelMessage.id, type: 'final' }); } catch {}
      }

      // Step 4 (Optional): If it's a new chat, generate a short plain-text title
      if (isNewChat) {
        const titlePrompt = `Generate a very short, plain-text chat title for this conversation.\n\nRules:\n- Maximum 5 words\n- Plain text only (no markdown, no quotes)\n- If naturally appropriate, include at most one relevant emoji\n- Return only the title line\n\nConversation:\nUser: ${prompt}\nAssistant: ${finalText}`;
        try {
            const ai = aiRef.current;
            const titleResponse = await ai!.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: titlePrompt }] }] });
            const raw = (titleResponse.text ?? 'New Chat').trim();
            const newTitle = sanitizeTitle(raw);
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
            try { logEvent('chat','info','title_set', { chatId, title: newTitle }); } catch {}
        } catch (e) {
            console.error("Failed to generate title", e);
            // Non-critical error, chat will remain "New Chat"
        }
      }

    } catch (error) {
      if ((error as any)?.name === 'AbortError' || signal.aborted) {
        // User aborted; keep partial content and workspace as-is
        try { logEvent('pipeline','warn','run_aborted', { runId: String(runToken), reason: (error as any)?.message || 'Abort' }); } catch {}
      } else {
        console.error("An error occurred during agent collaboration:", error);
        // push notice and log
        try { addLog('error', 'Run failed', { error: (error as any)?.message || String(error) }); } catch {}
        try { logEvent('pipeline','error','run_failed', { runId: String(runToken), error: (error as any)?.message || String(error) }); } catch {}
        try { pushNotice('error', `Run failed: ${(error as any)?.message || String(error)}`); } catch {}
        const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: 'Sorry, something went wrong. Please check the console for details.' }], createdAt: Date.now() };
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
        try { logEvent('chat','info','message_add', { chatId, messageId: errorMessage.id, type: 'error' }); } catch {}
      }
    } finally {
      setIsLoading(false);
      // If aborted, keep currentCollaborationState so partials remain visible
      if (!signal.aborted) {
        setCurrentCollaborationState([]);
        setLoadingMessage('');
      }
      setProgressDone(0);
      setProgressTotal(0);
      generationControllerRef.current.finish(runToken);
      setRunStartTs(null);
      try { pushNotice('success', 'Processing done'); } catch {}
      try { addLog('info', 'Run finished'); } catch {}
      try { logEvent('pipeline','info','run_finish', { runId: String(runToken) }); } catch {}
      try {
        const chat = chats.find(c => c.id === chatId);
        if (chat) logEvent('chat','info','snapshot', { chatId, chat });
      } catch {}
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
    await runAgentCollaboration(promptText, currentChatId, isNewChat);
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
      await runAgentCollaboration(newText, activeChatId, false);
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
