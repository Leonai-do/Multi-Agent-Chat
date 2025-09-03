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
import type { Chat, Message, LiveAgentState, CollaborationTrace } from '../types';

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

  // Effect to initialize the Gemini API client and load chats from localStorage
  useEffect(() => {
    // It's assumed API_KEY is set in the environment.
    const apiKey = (globalThis as any)?.process?.env?.API_KEY || '';
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    } else {
        console.error("API Key not found. Please ensure it's set in your environment variables.");
    }
    
    // Load chats from local storage on initial render
    try {
      const savedChats = localStorage.getItem('multi-agent-chats');
      if (savedChats) {
        setChats(JSON.parse(savedChats));
      }
    } catch (error) {
      console.error("Failed to load chats from localStorage", error);
    }
  }, []);
  
  // Effect to save chats to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('multi-agent-chats', JSON.stringify(chats));
    } catch (error) {
      console.error("Failed to save chats to localStorage", error);
    }
  }, [chats]);
  
  // --- Chat Management Handlers ---

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
    setIsLoading(true);
    setShowCollaboration(true);
    // Initialize live agent state for the UI
    const initialAgents: LiveAgentState[] = Array.from({ length: 4 }, (_, i) => ({ id: i, status: 'initializing', response: '' }));
    setCurrentCollaborationState(initialAgents);
    
    const ai = aiRef.current;
    if (!ai) {
        console.error('AI client is not initialized.');
        setIsLoading(false);
        return;
    }
      
    try {
      // Step 1: Get initial responses from all four agents in parallel
      setCurrentCollaborationState(prev => prev.map(a => ({ ...a, status: 'writing' })));
      const initialResponses = await Promise.all(
        initialAgents.map(async (agent) => {
          const response = await ai.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { systemInstruction: agentInstructions[agent.id] } });
          const text = response.text ?? '';
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
          return text;
        })
      );
      
      // Step 2: Get refined responses from all four agents in parallel
      setCurrentCollaborationState(prev => prev.map(a => ({ ...a, status: 'refining' })));
      const refinedResponses = await Promise.all(
        initialAgents.map(async (agent, agentIndex) => {
          const otherResponses = initialResponses.map((resp, i) => `Response from Agent ${i + 1}:\n${resp}`).join('\n\n---\n\n');
          const refinementPrompt = `Your original instruction was: "${agentInstructions[agentIndex]}"\n\nHere are the initial responses from all four agents, including your own:\n\n${otherResponses}\n\nPlease critically evaluate all responses. Identify weaknesses, inconsistencies, or factual errors. Then, generate a new, superior response that improves upon these initial drafts.`;
          const response = await ai.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: refinementPrompt }] }], config: { systemInstruction: REFINEMENT_SYSTEM_INSTRUCTION } });
          const text = response.text ?? '';
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text, status: 'done' } : a));
          return text;
        })
      );
      
      // Step 3: Get the final synthesized response from the fifth agent
      const finalPrompt = `Here are the four refined responses from the agent team:\n\n${refinedResponses.map((r, i) => `Refined Response from Agent ${i + 1}:\n${r}`).join('\n\n---\n\n')}\n\nSynthesize these into a single, final, comprehensive answer for the user.`;
      const finalResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: finalPrompt }] }], config: { systemInstruction: SYNTHESIZER_SYSTEM_INSTRUCTION } });
      const finalText = finalResponse.text ?? '';
      
      const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
      const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: finalText }], collaborationTrace };
      
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
      console.error("An error occurred during agent collaboration:", error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: 'Sorry, something went wrong. Please check the console for details.' }] };
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
    } finally {
      setIsLoading(false);
      setCurrentCollaborationState([]);
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

    // This needs to be async to run the collaboration, but the state update should be synchronous
    // so it happens before the AI call.
    const resend = async () => {
      // First, update the state to reflect the truncated and edited chat
      setChats(prev => prev.map(c => {
        if (c.id === activeChatId) {
          const updatedMessages = c.messages.map(m => m.id === messageId ? { ...m, parts: [{ text: newText }] } : m);
          const truncatedMessages = updatedMessages.slice(0, messageIndex + 1);
          return { ...c, messages: truncatedMessages };
        }
        return c;
      }));
      
      // Then, run the collaboration with the new prompt
      await runAgentCollaboration(newText, activeChatId, false);
    };

    resend();
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="app-wrapper">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} instructions={agentInstructions} onSave={setAgentInstructions} />
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <Sidebar chats={chats} activeChatId={activeChatId} onNewChat={handleNewChat} onSelectChat={handleSelectChat} onDeleteChat={handleDeleteChat} />
      </div>
      <ChatView 
        activeChat={activeChat}
        isLoading={isLoading}
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
      />
    </div>
  );
};

export default App;