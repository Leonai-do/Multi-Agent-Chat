import React, { useState, useEffect, useRef, FormEvent, FC, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MODEL_NAME = 'gemini-2.5-flash';
const INITIAL_SYSTEM_INSTRUCTION = "You are one of four collaborative agents. Your task is to provide an initial, concise, and factual response to the user's query. This is a first draft that your peers will critique and refine. Your work is internal and feeds into a final, synthesized answer.";
const REFINEMENT_SYSTEM_INSTRUCTION = "You are a peer-review agent. Your goal is to improve the team's work. You have received four initial drafts, including your own. Critically analyze all four, identifying strengths to keep and weaknesses to fix. Synthesize these insights into a single, superior second draft. This refined version will be given to the final Synthesizer.";
const SYNTHESIZER_SYSTEM_INSTRUCTION = "You are the Synthesizer agent, responsible for the final output. You will receive four refined responses from your team. Your job is to integrate the best elements from each, resolve contradictions, and create one single, cohesive, and high-quality answer. This is the only response the user will see.";

type Theme = 'light' | 'dark' | 'system';

const useTheme = (): [Theme, (theme: Theme) => void] => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    return savedTheme || 'system';
  });

  useEffect(() => {
    const applyTheme = (t: Theme) => {
      if (t === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = systemPrefersDark ? 'dark' : 'light';
      } else {
        document.documentElement.dataset.theme = t;
      }
      localStorage.setItem('theme', t);
    };

    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme(theme);

    if (theme === 'system') {
      mediaQuery.addEventListener('change', handleChange);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return [theme, setTheme];
};

const ThemeSwitcher: FC = () => {
  const [currentTheme, setTheme] = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const themes: { id: Theme, name: string, icon: ReactNode }[] = [
    { id: 'light', name: 'Light', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41L5.64 5.64zm12.73 12.73c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-1.06-1.06zM5.64 18.36c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-1.06-1.06c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06zm12.73-12.73c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-1.06-1.06c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06z"/></svg> },
    { id: 'dark', name: 'Dark', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.64-.11 2.4-.31-.3-.39-.55-.83-.73-1.31-.36-.98-.3-2.1.16-3.04.48-.98 1.39-1.66 2.47-1.92.23-.05.47-.07.7-.07.03 0 .06 0 .09.01.28.01.55.05.81.12.01 0 .03-.01.04-.01.25.07.5.16.73.27.02 0 .03-.01.05-.01.23.11.45.24.66.38.1.07.21.13.31.21.01 0 .01 0 .02.01.02 0 .03.01.05.02.01 0 .02.01.04.01.01 0 .02.01.03.01.03.01.05.02.08.04.18.1.36.22.52.34.02.01.03.02.05.03.09.06.17.13.25.2.02.02.04.03.06.05.17.13.34.28.49.44.02.02.03.03.05.05.08.09.16.18.24.27l.02.02c.02.03.04.05.06.08.07.09.14.19.2.28.02.03.03.05.05.08.06.09.12.19.17.29.01.03.02.05.04.08.05.1.09.2.13.3.01.03.02.05.03.08.04.1.08.21.11.31.01.03.02.06.03.09.03.11.06.22.08.33.01.03.01.06.02.09.02.11.04.22.05.33.01.03.01.06.02.09.01.11.02.22.02.34 0 .22-.02.44-.05.65-.02.12-.05.24-.08.35-.01.03-.02.06-.03.09-.03.12-.07.24-.11.36-.01.03-.02.06-.04.09-.04.12-.09.23-.14.34-.01.03-.02.06-.04.09-.05.12-.11.23-.17.34-.01.03-.02.06-.04.09-.06.12-.13.23-.2.34-.01.03-.02.06-.04.09-.07.12-.15.23-.22.34-.01.03-.02.06-.04.09-.08.12-.16.23-.25.34-.01.03-.02.06-.04.09-.09.12-.18.23-.28.34-.01.03-.02.06-.04.09-.1.12-.2.23-.31.34A9.01 9.01 0 0112 21z"/></svg>},
    { id: 'system', name: 'System', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 4h16v2H4zm0 4h16v2H4z"/></svg> },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="theme-switcher" ref={dropdownRef}>
      <button className="theme-button" onClick={() => setIsOpen(!isOpen)} aria-label="Select theme">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.64-.11 2.4-.31-.3-.39-.55-.83-.73-1.31-.36-.98-.3-2.1.16-3.04.48-.98 1.39-1.66 2.47-1.92.23-.05.47-.07.7-.07.03 0 .06 0 .09.01.28.01.55.05.81.12.01 0 .03-.01.04-.01.25.07.5.16.73.27.02 0 .03-.01.05-.01.23.11.45.24.66.38.1.07.21.13.31.21.01 0 .01 0 .02.01.02 0 .03.01.05.02.01 0 .02.01.04.01.01 0 .02.01.03.01.03.01.05.02.08.04.18.1.36.22.52.34.02.01.03.02.05.03.09.06.17.13.25.2.02.02.04.03.06.05.17.13.34.28.49.44.02.02.03.03.05.05.08.09.16.18.24.27l.02.02c.02.03.04.05.06.08.07.09.14.19.2.28.02.03.03.05.05.08.06.09.12.19.17.29.01.03.02.05.04.08.05.1.09.2.13.3.01.03.02.05.03.08.04.1.08.21.11.31.01.03.02.06.03.09.03.11.06.22.08.33.01.03.01.06.02.09.02.11.04.22.05.33.01.03.01.06.02.09.01.11.02.22.02.34 0 .22-.02.44-.05.65-.02.12-.05.24-.08.35-.01.03-.02.06-.03.09-.03.12-.07.24-.11.36-.01.03-.02.06-.04.09-.04.12-.09.23-.14.34-.01.03-.02.06-.04.09-.05.12-.11.23-.17.34-.01.03-.02.06-.04.09-.06.12-.13.23-.2.34-.01.03-.02.06-.04.09-.07.12-.15.23-.22.34-.01.03-.02.06-.04.09-.08.12-.16.23-.25.34-.01.03-.02.06-.04.09-.09.12-.18.23-.28.34-.01.03-.02.06-.04.09-.1.12-.2.23-.31.34A9.01 9.01 0 0112 21z"/></svg>
      </button>
      {isOpen && (
        <div className="theme-dropdown">
          {themes.map(t => (
            <button key={t.id} className={`theme-item ${currentTheme === t.id ? 'active' : ''}`} onClick={() => { setTheme(t.id); setIsOpen(false); }}>
              {t.icon}
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


interface CollaborationTrace {
  initialResponses: string[];
  refinedResponses: string[];
}

interface Message {
  id: string;
  role: 'user' | 'model';
  parts: { text: string }[];
  collaborationTrace?: CollaborationTrace;
}

interface LiveAgentState {
  id: number;
  status: 'pending' | 'initializing' | 'writing' | 'refining' | 'done';
  response: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instructions: string[];
  onSave: (newInstructions: string[]) => void;
}

const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, instructions, onSave }) => {
  const [currentInstructions, setCurrentInstructions] = useState(instructions);

  useEffect(() => {
    if (isOpen) {
      setCurrentInstructions(instructions);
    }
  }, [instructions, isOpen]);

  if (!isOpen) return null;

  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...currentInstructions];
    newInstructions[index] = value;
    setCurrentInstructions(newInstructions);
  };

  const handleSave = () => {
    onSave(currentInstructions);
    onClose();
  };

  const handleReset = () => {
    setCurrentInstructions(Array(4).fill(INITIAL_SYSTEM_INSTRUCTION));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Agent System Instructions</h2>
          <button onClick={onClose} className="close-button" aria-label="Close settings">&times;</button>
        </div>
        <div className="modal-body">
          <p>Customize the core behavior for each agent. This instruction is used for their initial response.</p>
          {currentInstructions.map((inst, index) => (
            <div key={index} className={`instruction-editor instruction-editor-color-${index + 1}`}>
              <label htmlFor={`agent-inst-${index}`}>Agent {index + 1} Instruction</label>
              <textarea
                id={`agent-inst-${index}`}
                value={inst}
                onChange={(e) => handleInstructionChange(index, e.target.value)}
                rows={5}
                aria-label={`System instruction for Agent ${index + 1}`}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button onClick={handleReset} className="button-secondary">Reset to Defaults</button>
          <div className="modal-actions">
            <button onClick={onClose} className="button-secondary">Cancel</button>
            <button onClick={handleSave} className="button-primary">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};


const CodeBlock: FC<{ children?: ReactNode }> = ({ children }) => {
  const [copied, setCopied] = useState(false);
  const textToCopy = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="code-block-wrapper">
      <pre><code>{children}</code></pre>
      <button onClick={handleCopy} className="copy-button" aria-label="Copy code">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          {copied ? (
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          ) : (
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-5zm0 16H8V7h11v14z"/>
          )}
        </svg>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};

const AgentBox: FC<{ agentId: number, status?: string, response: string }> = ({ agentId, status, response }) => (
    <div className={`agent-box agent-box-color-${agentId + 1} ${status || ''}`}>
      <div className="agent-box-header">
        Agent {agentId + 1}
        {status && <span className="agent-status-indicator">{status}</span>}
      </div>
      <div className="agent-box-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: ({ children }) => <>{children}</>, code: ({ children }) => <code>{children}</code> }}>
          {response || '...'}
        </ReactMarkdown>
      </div>
    </div>
  );

// Trace view agent box with toggle between initial and refined responses
const TraceAgentBox: FC<{ agentId: number, initial?: string, refined?: string }> = ({ agentId, initial, refined }) => {
  const hasInitial = Boolean(initial && initial.trim());
  const hasRefined = Boolean(refined && refined.trim());
  const [view, setView] = useState<'initial' | 'refined'>(hasRefined ? 'refined' : 'initial');
  const content = view === 'refined' ? (refined || '') : (initial || '');

  return (
    <div className={`agent-box agent-box-color-${agentId + 1}`}>
      <div className="agent-box-header">
        <span>Agent {agentId + 1}</span>
        <div className="response-toggle-group" role="group" aria-label={`Toggle Agent ${agentId + 1} response`}>
          <button
            type="button"
            className={`response-toggle ${view === 'initial' ? 'active' : ''}`}
            onClick={() => setView('initial')}
            disabled={!hasInitial}
            aria-pressed={view === 'initial'}
            aria-label="Show initial response"
          >
            Initial
          </button>
          <button
            type="button"
            className={`response-toggle ${view === 'refined' ? 'active' : ''}`}
            onClick={() => setView('refined')}
            disabled={!hasRefined}
            aria-pressed={view === 'refined'}
            aria-label="Show refined response"
          >
            Refined
          </button>
        </div>
      </div>
      <div className="agent-box-content">
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: ({ children }) => <>{children}</>, code: ({ children }) => <code>{children}</code> }}>
            {content}
          </ReactMarkdown>
        ) : (
          <div className="placeholder">No response available</div>
        )}
      </div>
    </div>
  );
};

const CollaborationTraceView: FC<{ trace: CollaborationTrace }> = ({ trace }) => {
  const maxAgents = Math.max(trace.initialResponses?.length || 0, trace.refinedResponses?.length || 0);
  return (
    <div className="collaboration-trace">
      <div className="agent-grid">
        {Array.from({ length: maxAgents }).map((_, index) => (
          <TraceAgentBox
            key={`trace-agent-${index}`}
            agentId={index}
            initial={trace.initialResponses?.[index]}
            refined={trace.refinedResponses?.[index]}
          />
        ))}
      </div>
    </div>
  );
};

const LiveAgentWorkspace: FC<{ agentStates: LiveAgentState[], isVisible: boolean }> = ({ agentStates, isVisible }) => (
  <div className={`agent-grid-container ${isVisible ? 'visible' : ''}`}>
    <div className="agent-grid">
      {agentStates.map(agent => (
        <AgentBox key={agent.id} agentId={agent.id} status={agent.status} response={agent.response} />
      ))}
    </div>
  </div>
);

const MessageItem: FC<{ message: Message }> = ({ message }) => {
  const [isTraceVisible, setIsTraceVisible] = useState(false);

  return (
    <div className={`message ${message.role}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return match ? (
              <CodeBlock>{children}</CodeBlock>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          }
        }}
      >
        {message.parts[0].text}
      </ReactMarkdown>
      {message.role === 'model' && message.collaborationTrace && (
        <div className="collaboration-container">
          <button onClick={() => setIsTraceVisible(!isTraceVisible)} className="collaboration-toggle-history" aria-expanded={isTraceVisible}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.5 15.5c-2.26 0-4.26-1.23-5.43-3.13.34-.39.64-.82.89-1.28.63.49 1.37.84 2.16 1.05V10.5h2v1.65c.79-.21 1.53-.56 2.16-1.05.25.46.55.89.89 1.28-1.17 1.9-3.17 3.13-5.43 3.13zM12 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-7.5-1.5c-2.26 0-4.26-1.23-5.43-3.13C-.21 8.98 0 8.44 0 8c0-.44.21-.98.57-1.37C1.74 4.73 3.74 3.5 6 3.5c2.26 0 4.26 1.23 5.43 3.13-.34.39-.64.82-.89 1.28-.63-.49-1.37-.84-2.16-1.05V8.5h-2v-1.65c-.79.21-1.53.56-2.16 1.05-.25-.46-.55-.89-.89-1.28C4.76 4.73 2.76 3.5.5 3.5 2.76 3.5 4.76 4.73 5.93 6.63c.34.39.64.82.89 1.28.63-.49 1.37-.84 2.16-1.05V8.5h2v1.65c.79.21 1.53.56 2.16 1.05.25.46.55.89.89 1.28C10.24 14.27 8.24 15.5 6 15.5c-2.26 0-4.26-1.23-5.43-3.13.34-.39.64-.82.89-1.28-.63.49-1.37.84-2.16-1.05V10.5h-2v-1.65c-.79.21-1.53-.56-2.16-1.05C1.74 6.27 3.74 7.5 6 7.5c2.26 0 4.26-1.23 5.43-3.13C11.79 4.02 12 4.56 12 5c0 .44-.21.98-.57 1.37C10.26 8.27 8.26 9.5 6 9.5s-4.26-1.23-5.43-3.13z"/>
            </svg>
            <span>{isTraceVisible ? 'Hide' : 'View'} Collaboration</span>
          </button>
          <div className={`collaboration-trace-wrapper ${isTraceVisible ? 'visible' : ''}`}>
             <CollaborationTraceView trace={message.collaborationTrace} />
          </div>
        </div>
      )}
    </div>
  );
};


const App: FC = () => {
  useTheme(); // Initialize and apply theme
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [currentCollaborationState, setCurrentCollaborationState] = useState<LiveAgentState[]>([]);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [agentInstructions, setAgentInstructions] = useState<string[]>(() => Array(4).fill(INITIAL_SYSTEM_INSTRUCTION));

  useEffect(() => {
    const apiKey = (globalThis as any)?.process?.env?.API_KEY || localStorage.getItem('GENAI_API_KEY') || '';
    aiRef.current = new GoogleGenAI({ apiKey });
  }, []);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, currentCollaborationState]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', parts: [{ text: input }] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowCollaboration(true);

    const initialAgents: LiveAgentState[] = Array.from({ length: 4 }, (_, i) => ({
      id: i, status: 'initializing', response: '',
    }));
    setCurrentCollaborationState(initialAgents);

    try {
      const ai = aiRef.current;
      if (!ai) throw new Error('AI not initialized');

      // Phase 1: Initial Response Generation
      setCurrentCollaborationState(prev => prev.map(a => ({ ...a, status: 'writing' })));
      const initialResponses = await Promise.all(
        initialAgents.map(async (agent) => {
          const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: input }] }],
            config: { systemInstruction: agentInstructions[agent.id] },
          });
          const text = response.text ?? '';
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
          return text;
        })
      );
      setCurrentCollaborationState(prev => prev.map(a => ({ ...a, status: 'refining' })));

      // Phase 2: Refinement
      const refinedResponses = await Promise.all(
        initialAgents.map(async (agent, agentIndex) => {
          const otherResponses = initialResponses.map((resp, i) => `Response from Agent ${i + 1}:\n${resp}`).join('\n\n---\n\n');
          const refinementPrompt = `Your original instruction was: "${agentInstructions[agentIndex]}"\n\nHere are the initial responses from all four agents, including your own:\n\n${otherResponses}\n\nPlease critically evaluate all responses. Identify weaknesses, inconsistencies, or factual errors. Then, generate a new, superior response that improves upon these initial drafts.`;

          const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: refinementPrompt }] }],
            config: { systemInstruction: REFINEMENT_SYSTEM_INSTRUCTION },
          });
          const text = response.text ?? '';
          setCurrentCollaborationState(prev => prev.map(a => a.id === agent.id ? { ...a, response: text, status: 'done' } : a));
          return text;
        })
      );

      // Phase 3: Synthesizer
      const finalPrompt = `Here are the four refined responses from the agent team:\n\n${refinedResponses.map((r, i) => `Refined Response from Agent ${i + 1}:\n${r}`).join('\n\n---\n\n')}\n\nSynthesize these into a single, final, comprehensive answer for the user.`;
      
      const finalResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        config: { systemInstruction: SYNTHESIZER_SYSTEM_INSTRUCTION },
      });
      const finalText = finalResponse.text ?? '';

      const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
      const modelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        parts: [{ text: finalText }],
        collaborationTrace,
      };
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        parts: [{ text: 'Sorry, something went wrong. Please try again.' }],
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setCurrentCollaborationState([]);
    }
  };
  
  const handleSaveInstructions = (newInstructions: string[]) => {
    setAgentInstructions(newInstructions);
  };

  return (
    <div className="chat-container">
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        instructions={agentInstructions}
        onSave={handleSaveInstructions}
      />
      <header>
        <h1>Multi-Agent Chat</h1>
        <div className="header-actions">
           <ThemeSwitcher />
           <button className="settings-button" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
               <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
             </svg>
           </button>
        </div>
      </header>
      <div className="message-list" ref={messageListRef}>
        {messages.map((msg) => <MessageItem key={msg.id} message={msg} />)}
         {isLoading && (
          <div className="agent-workspace">
            <div className="agent-workspace-header">
              <span className="agent-workspace-title">Agent Collaboration Status</span>
               <button onClick={() => setShowCollaboration(!showCollaboration)} className="collaboration-toggle" aria-expanded={showCollaboration}>
                  {showCollaboration ? 'Hide' : 'Show'} Details
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={showCollaboration ? 'expanded' : ''}>
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                  </svg>
              </button>
            </div>
            <LiveAgentWorkspace agentStates={currentCollaborationState} isVisible={showCollaboration}/>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="input-area">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the agent team..."
          aria-label="Chat input"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
