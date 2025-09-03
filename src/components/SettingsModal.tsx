/**
 * @file Renders a modal for configuring AI agent system instructions.
 */
import React, { useState, useEffect, FC } from 'react';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';
import { LS_GROQ_KEY, LS_PROVIDER_GLOBAL, LS_PROVIDER_PER_AGENT, LS_MODEL_GLOBAL, LS_MODEL_PER_AGENT } from '../config';
import { fetchModelsForProvider, type ModelOption } from '../llm/models';

/**
 * Props for the SettingsModal component.
 * @property {boolean} isOpen - Whether the modal is currently visible.
 * @property {() => void} onClose - Function to call when the modal should be closed.
 * @property {string[]} instructions - The current system instructions for the agents.
 * @property {(newInstructions: string[]) => void} onSave - Callback function to save the updated instructions.
 * @property {string} tavilyApiKey - The current Tavily API key.
 * @property {(key: string) => void} onSaveTavilyApiKey - Callback to save the Tavily API key.
 */
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instructions: string[];
  onSave: (newInstructions: string[]) => void;
  tavilyApiKey: string;
  onSaveTavilyApiKey: (key: string) => void;
}

/**
 * A modal component that allows users to view and edit the system instructions
 * for each of the four AI agents.
 *
 * @param {SettingsModalProps} props - The component props.
 * @returns {React.ReactElement | null} The rendered modal or null if not open.
 */
const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, instructions, onSave, tavilyApiKey, onSaveTavilyApiKey }) => {
  // Local state to manage instruction edits before saving.
  const [currentInstructions, setCurrentInstructions] = useState(instructions);
  // Local state for the Tavily API key.
  const [currentTavilyKey, setCurrentTavilyKey] = useState(tavilyApiKey);
  // Local state for the Groq API key.
  const [currentGroqKey, setCurrentGroqKey] = useState<string>('');
  // Provider selections (global + per-agent overrides)
  const [globalProvider, setGlobalProvider] = useState<'gemini' | 'groq'>('gemini');
  const [perAgentProviders, setPerAgentProviders] = useState<Array<'gemini' | 'groq'>>([]);
  const [globalModel, setGlobalModel] = useState<string>('');
  const [perAgentModels, setPerAgentModels] = useState<string[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<'gemini'|'groq', ModelOption[]>>({ gemini: [], groq: [] });
  const fetchAbortRef = React.useRef<AbortController | null>(null);
  
  // Effect to sync local state with props when the modal is opened.
  useEffect(() => {
    if (isOpen) {
      setCurrentInstructions(instructions);
      setCurrentTavilyKey(tavilyApiKey);
      // Load groq key and provider selections from LS
      try {
        const gk = localStorage.getItem(LS_GROQ_KEY) || '';
        setCurrentGroqKey(gk);
        const gp = (localStorage.getItem(LS_PROVIDER_GLOBAL) as 'gemini' | 'groq' | null) || 'gemini';
        setGlobalProvider(gp);
        const count = (instructions?.length || 4);
        const paRaw = localStorage.getItem(LS_PROVIDER_PER_AGENT);
        const parsed = paRaw ? (JSON.parse(paRaw) as Array<'gemini' | 'groq'>) : Array(count).fill(gp);
        const normalized = Array(count).fill('gemini').map((_, i) => parsed[i] || gp);
        setPerAgentProviders(normalized);
        // models
        const gm = localStorage.getItem(LS_MODEL_GLOBAL) || '';
        setGlobalModel(gm);
        const pamRaw = localStorage.getItem(LS_MODEL_PER_AGENT);
        const pamParsed = pamRaw ? (JSON.parse(pamRaw) as string[]) : Array(count).fill(gm);
        setPerAgentModels(Array(count).fill('').map((_, i) => pamParsed[i] || gm));
      } catch {
        const count = (instructions?.length || 4);
        setPerAgentProviders(Array(count).fill('gemini'));
        setPerAgentModels(Array(count).fill(''));
      }
      // Fetch models for current provider(s)
      (async () => {
        try {
          fetchAbortRef.current?.abort();
          fetchAbortRef.current = new AbortController();
          const signal = fetchAbortRef.current.signal;
          const [gemini, groq] = await Promise.all([
            fetchModelsForProvider('gemini', undefined, signal).catch(() => []),
            fetchModelsForProvider('groq', undefined, signal).catch(() => []),
          ]);
          setModelsByProvider({ gemini, groq });
        } catch {}
      })();
    }
  }, [instructions, tavilyApiKey, isOpen]);
  
  // Don't render anything if the modal is not open.
  if (!isOpen) return null;
  
  /**
   * Updates the instruction for a specific agent in the local state.
   * @param {number} index - The index of the agent to update.
   * @param {string} value - The new instruction text.
   */
  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...currentInstructions];
    newInstructions[index] = value;
    setCurrentInstructions(newInstructions);
  };
  
  /**
   * Saves all settings (instructions and API key) and closes the modal.
   */
  const handleSave = () => {
    onSave(currentInstructions);
    onSaveTavilyApiKey(currentTavilyKey);
    try {
      localStorage.setItem(LS_GROQ_KEY, currentGroqKey);
      localStorage.setItem(LS_PROVIDER_GLOBAL, globalProvider);
      localStorage.setItem(LS_PROVIDER_PER_AGENT, JSON.stringify(perAgentProviders));
      localStorage.setItem(LS_MODEL_GLOBAL, globalModel);
      localStorage.setItem(LS_MODEL_PER_AGENT, JSON.stringify(perAgentModels));
    } catch {}
    onClose();
  };
  
  /**
   * Resets the instructions in the local state to the default constant value.
   */
  const handleReset = () => {
    setCurrentInstructions(Array(4).fill(INITIAL_SYSTEM_INSTRUCTION));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Settings</h2>
          <button onClick={onClose} className="modal__close-button" aria-label="Close settings">&times;</button>
        </div>
        <div className="modal__body">
          <div className="providers-editor" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Providers</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label>
                Global Provider
                <select value={globalProvider} onChange={(e) => {
                  const val = (e.target.value as 'gemini' | 'groq');
                  setGlobalProvider(val);
                  setPerAgentProviders(prev => prev.map(() => val));
                  // Reset models to empty until user selects
                  setGlobalModel('');
                  setPerAgentModels(prev => prev.map(() => ''));
                }} style={{ marginLeft: '0.5rem' }} aria-label="Global provider select">
                  <option value="gemini">Gemini</option>
                  <option value="groq">Groq</option>
                </select>
              </label>
              <label>
                Global Model
                <select value={globalModel} onChange={(e) => setGlobalModel(e.target.value)} style={{ marginLeft: '0.5rem' }} aria-label="Global model select">
                  <option value="" disabled>(Select model)</option>
                  {(modelsByProvider[globalProvider] || []).map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              {perAgentProviders.map((p, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.75rem', marginBottom: '0.5rem' }}>
                  <label aria-label={`Provider for Agent ${i + 1}`}>
                    Agent {i + 1}
                    <select value={p} onChange={(e) => {
                      const v = (e.target.value as 'gemini' | 'groq');
                      setPerAgentProviders(prev => prev.map((x, idx) => idx === i ? v : x));
                      setPerAgentModels(prev => prev.map((x, idx) => idx === i ? '' : x));
                    }}>
                      <option value="gemini">Gemini</option>
                      <option value="groq">Groq</option>
                    </select>
                  </label>
                  <label aria-label={`Model for Agent ${i + 1}`}>
                    <select value={perAgentModels[i] || ''} onChange={(e) => {
                      const val = e.target.value;
                      setPerAgentModels(prev => prev.map((x, idx) => idx === i ? val : x));
                    }}>
                      <option value="" disabled>(Model)</option>
                      {(modelsByProvider[perAgentProviders[i]] || []).map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                </span>
              ))}
            </div>
          </div>
          <div>
            <p>Customize the core behavior for each agent. This instruction is used for their initial response.</p>
            {currentInstructions.map((inst, index) => (
              <div key={index} className={`instruction-editor instruction-editor--color-${index + 1}`}>
                <label htmlFor={`agent-inst-${index}`} className="instruction-editor__label">Agent {index + 1} Instruction</label>
                <textarea
                  id={`agent-inst-${index}`}
                  className="instruction-editor__textarea"
                  value={inst}
                  onChange={(e) => handleInstructionChange(index, e.target.value)}
                  rows={5}
                  aria-label={`System instruction for Agent ${index + 1}`}
                />
              </div>
            ))}
          </div>

          <div className="api-key-editor">
             <label htmlFor="tavily-api-key" className="api-key-editor__label">Tavily API Key</label>
             <p>Required for the "Internet" toggle to function. Get a free key from Tavily AI.</p>
             <input
                id="tavily-api-key"
                type="password"
                className="api-key-editor__input"
                value={currentTavilyKey}
                onChange={(e) => setCurrentTavilyKey(e.target.value)}
                placeholder="Enter your Tavily API Key"
                aria-label="Tavily API Key input"
             />
          </div>

          <div className="api-key-editor">
             <label htmlFor="groq-api-key" className="api-key-editor__label">Groq API Key</label>
             <p>Used when selecting Groq as provider. For production, prefer a backend proxy to protect keys.</p>
             <input
                id="groq-api-key"
                type="password"
                className="api-key-editor__input"
                value={currentGroqKey}
                onChange={(e) => setCurrentGroqKey(e.target.value)}
                placeholder="Enter your Groq API Key"
                aria-label="Groq API Key input"
             />
          </div>

        </div>
        <div className="modal__footer">
          <button onClick={handleReset} className="button button--secondary">Reset Instructions</button>
          <div className="modal__actions">
            <button onClick={onClose} className="button button--secondary">Cancel</button>
            <button onClick={handleSave} className="button button--primary">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
