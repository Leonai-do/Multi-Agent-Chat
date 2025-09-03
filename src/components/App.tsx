

import React, { useState, useEffect, useRef, FormEvent, FC } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useTheme } from '../hooks/useTheme';
import Sidebar from './Sidebar';
import SettingsModal from './SettingsModal';
import ChatView from './ChatView';
import { MODEL_NAME, INITIAL_SYSTEM_INSTRUCTION, REFINEMENT_SYSTEM_INSTRUCTION, SYNTHESIZER_SYSTEM_INSTRUCTION } from '../constants';
import type { Chat, Message, LiveAgentState, CollaborationTrace } from '../types';

const App: FC = () => {
  useTheme();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const [currentCollaborationState, setCurrentCollaborationState] = useState<LiveAgentState[]>([]);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [agentInstructions, setAgentInstructions] = useState<string[]>(() => Array(4).fill(INITIAL_SYSTEM_INSTRUCTION));
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

  useEffect(() => {
    const apiKey = (globalThis as any)?.process?.env?.API_KEY || '';
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    } else {
        console.error("API Key not found. Please set it in your environment variables.");
    }
    
    try {
      const savedChats = localStorage.getItem('multi-agent-chats');
      if (savedChats) {
        setChats(JSON.parse(savedChats));
      }
    } catch (error) {
      console.error("Failed to load chats from localStorage", error);
    }
  }, []);
  
  useEffect(() => {
    try {
      localStorage.setItem('multi-agent-chats', JSON.stringify(chats));
    } catch (error) {
      console.error("Failed to save chats to localStorage", error);
    }
  }, [chats]);
  
  const handleNewChat = () => setActiveChatId(null);
  const handleSelectChat = (id: string) => setActiveChatId(id);
  const handleDeleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const runAgentCollaboration = async (prompt: string, chatId: string, isNewChat: boolean) => {
    setIsLoading(true);
    setShowCollaboration(true);
    const initialAgents: LiveAgentState[] = Array.from({ length: 4 }, (_, i) => ({ id: i, status: 'initializing', response: '' }));
    setCurrentCollaborationState(initialAgents);
    
    const ai = aiRef.current;
    if (!ai) {
        console.error('AI not initialized');
        setIsLoading(false);
        return;
    }
      
    try {
      setCurrentCollaborationState(prev => prev.map(a => ({ ...a, status: 'writing' })));
      const initialResponses = await Promise.all(
        initialAgents.map(async (agent) => {
          const response = await ai.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { systemInstruction: agentInstructions[agent.id] } });
          const text = response.text ?? '';
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
          return text;
        })
      );
      
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
      
      const finalPrompt = `Here are the four refined responses from the agent team:\n\n${refinedResponses.map((r, i) => `Refined Response from Agent ${i + 1}:\n${r}`).join('\n\n---\n\n')}\n\nSynthesize these into a single, final, comprehensive answer for the user.`;
      const finalResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: finalPrompt }] }], config: { systemInstruction: SYNTHESIZER_SYSTEM_INSTRUCTION } });
      const finalText = finalResponse.text ?? '';
      
      const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
      const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: finalText }], collaborationTrace };
      
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMessage] } : c));

      if (isNewChat) {
        const titlePrompt = `Based on the following interaction, create a short, concise title (max 5 words).\n\nUser: ${prompt}\n\nAssistant: ${finalText}`;
        try {
            const titleResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: [{ role: 'user', parts: [{ text: titlePrompt }] }] });
            const newTitle = (titleResponse.text ?? 'Untitled Chat').replace(/"/g, '').trim();
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
        } catch (e) {
            console.error("Failed to generate title", e);
        }
      }

    } catch (error) {
      console.error(error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: 'Sorry, something went wrong. Please try again.' }] };
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
    } finally {
      setIsLoading(false);
      setCurrentCollaborationState([]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const promptText = input;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', parts: [{ text: promptText }] };
    let currentChatId = activeChatId;
    let isNewChat = false;

    if (!currentChatId) {
      isNewChat = true;
      currentChatId = Date.now().toString();
      const newChat: Chat = { id: currentChatId, title: "New Chat", messages: [userMessage] };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(currentChatId);
    } else {
      setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [...c.messages, userMessage] } : c));
    }

    setInput('');
    await runAgentCollaboration(promptText, currentChatId, isNewChat);
  };
  
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
