/**
 * @file Renders a modal for configuring AI agent system instructions.
 */
import React, { useState, useEffect, FC } from 'react';
import LoadingBar from './LoadingBar';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';
import { LS_GROQ_KEY, LS_GEMINI_KEY, LS_PROVIDER_GLOBAL, LS_PROVIDER_PER_AGENT, LS_MODEL_GLOBAL, LS_MODEL_PER_AGENT, LS_FLAG_VISION, LS_FLAG_FUNCTIONS } from '../config';
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
  names: string[];
  onSave: (newInstructions: string[], newNames: string[]) => void;
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
const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, instructions, names, onSave, tavilyApiKey, onSaveTavilyApiKey }) => {
  // Local state to manage instruction edits before saving.
  const [currentInstructions, setCurrentInstructions] = useState(instructions);
  // Local state for agent names
  const [currentNames, setCurrentNames] = useState<string[]>(names && names.length ? names : Array(4).fill('').map((_,i)=>`Agent ${i+1}`));
  // Local state for the Tavily API key.
  const [currentTavilyKey, setCurrentTavilyKey] = useState(tavilyApiKey);
  // Local state for the Groq API key.
  const [currentGroqKey, setCurrentGroqKey] = useState<string>('');
  // Local state for the Gemini API key.
  const [currentGeminiKey, setCurrentGeminiKey] = useState<string>('');
  // Provider selections (global + per-agent overrides)
  const [globalProvider, setGlobalProvider] = useState<'gemini' | 'groq'>('gemini');
  const [perAgentProviders, setPerAgentProviders] = useState<Array<'gemini' | 'groq'>>([]);
  const [globalModel, setGlobalModel] = useState<string>('');
  const [perAgentModels, setPerAgentModels] = useState<string[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<'gemini'|'groq', ModelOption[]>>({ gemini: [], groq: [] });
  const [isFetching, setIsFetching] = useState<boolean>(false);
  // Feature flags
  const [visionEnabled, setVisionEnabled] = useState<boolean>(false);
  const [functionsEnabled, setFunctionsEnabled] = useState<boolean>(false);
  const fetchAbortRef = React.useRef<AbortController | null>(null);
  // Feedback messages (floating)
  type Feedback = { id: number; type: 'success' | 'error' | 'info'; text: string };
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const addFeedback = (type: Feedback['type'], text: string) => {
    const id = Date.now() + Math.floor(Math.random()*1000);
    setFeedbacks((prev) => [...prev, { id, type, text }]);
    // Auto-remove after 6s for info/success
    if (type !== 'error') {
      setTimeout(() => setFeedbacks((prev) => prev.filter(f => f.id !== id)), 6000);
    }
  };
  const removeFeedback = (id: number) => setFeedbacks(prev => prev.filter(f => f.id !== id));
  
  // Effect to sync local state with props when the modal is opened.
  useEffect(() => {
    if (isOpen) {
      setCurrentInstructions(instructions);
      setCurrentNames(names && names.length ? names : Array(4).fill('').map((_,i)=>`Agent ${i+1}`));
      setCurrentTavilyKey(tavilyApiKey);
      // Load groq key and provider selections from LS
      try {
        const gk = localStorage.getItem(LS_GROQ_KEY) || '';
        setCurrentGroqKey(gk);
        const gmk = localStorage.getItem(LS_GEMINI_KEY) || '';
        setCurrentGeminiKey(gmk);
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
        // feature flags
        setVisionEnabled((localStorage.getItem(LS_FLAG_VISION) || '0') === '1');
        setFunctionsEnabled((localStorage.getItem(LS_FLAG_FUNCTIONS) || '0') === '1');
      } catch {
        const count = (instructions?.length || 4);
        setPerAgentProviders(Array(count).fill('gemini'));
        setPerAgentModels(Array(count).fill(''));
        setVisionEnabled(false);
        setFunctionsEnabled(false);
      }
      // Fetch models for current provider(s)
      (async () => {
        try {
          fetchAbortRef.current?.abort();
          fetchAbortRef.current = new AbortController();
          const signal = fetchAbortRef.current.signal;
          const [gemini, groq] = await Promise.all([
            fetchModelsForProvider('gemini', currentGeminiKey || undefined, signal).catch(() => []),
            fetchModelsForProvider('groq', currentGroqKey || undefined, signal).catch(() => []),
          ]);
          setModelsByProvider({ gemini, groq });
        } catch {}
      })();
    }
  }, [instructions, tavilyApiKey, isOpen]);

  // Handlers to save/test individual provider keys and refresh model lists
  const handleSaveGeminiKey = async () => {
    try {
      localStorage.setItem(LS_GEMINI_KEY, currentGeminiKey);
    } catch {}
    addFeedback('info', 'Loading Gemini models (using interface if configured)...');
    try {
      setIsFetching(true);
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = new AbortController();
      const signal = fetchAbortRef.current.signal;
      // Update state via unified util (prefers /api/models which can use interface API)
      const [gemini] = await Promise.all([
        fetchModelsForProvider('gemini', currentGeminiKey, signal).catch(() => []),
      ]);
      setModelsByProvider((prev) => ({ ...prev, gemini }));
      addFeedback('success', `Loaded Gemini models: ${gemini.length}`);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      addFeedback('error', `Gemini test failed: ${e?.message || e}`);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveGroqKey = async () => {
    try {
      localStorage.setItem(LS_GROQ_KEY, currentGroqKey);
    } catch {}
    addFeedback('info', 'Loading Groq models (using interface if configured)...');
    try {
      setIsFetching(true);
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = new AbortController();
      const signal = fetchAbortRef.current.signal;
      const groq = await fetchModelsForProvider('groq', currentGroqKey, signal).catch(() => []);
      setModelsByProvider((prev) => ({ ...prev, groq }));
      addFeedback('success', `Loaded Groq models: ${groq.length}`);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      addFeedback('error', `Groq test failed: ${e?.message || e}`);
    } finally {
      setIsFetching(false);
    }
  };
  
  // Sidebar tabs (must be declared before early return to keep hook order stable)
  const tabs: { id: string; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'providers', label: 'Providers & Models' },
    { id: 'agents', label: 'Agent Instructions' },
    { id: 'internet', label: 'Internet & Tools' },
    { id: 'rag', label: 'File Upload & RAG' },
    { id: 'vision', label: 'Vision' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'rendering', label: 'Messages & Rendering' },
    { id: 'data', label: 'Data & Export' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'about', label: 'About' },
  ];
  const [activeTab, setActiveTab] = useState<string>('providers');

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
    onSave(currentInstructions, currentNames.map((n,i)=> (n && n.trim()) ? n.trim() : `Agent ${i+1}`));
    onSaveTavilyApiKey(currentTavilyKey);
    try {
      localStorage.setItem(LS_GROQ_KEY, currentGroqKey);
      localStorage.setItem(LS_GEMINI_KEY, currentGeminiKey);
      localStorage.setItem(LS_PROVIDER_GLOBAL, globalProvider);
      localStorage.setItem(LS_PROVIDER_PER_AGENT, JSON.stringify(perAgentProviders));
      localStorage.setItem(LS_MODEL_GLOBAL, globalModel);
      localStorage.setItem(LS_MODEL_PER_AGENT, JSON.stringify(perAgentModels));
      localStorage.setItem(LS_FLAG_VISION, visionEnabled ? '1' : '0');
      localStorage.setItem(LS_FLAG_FUNCTIONS, functionsEnabled ? '1' : '0');
    } catch {}
    try { logEvent('settings','info','save_all', { instructionsLength: currentInstructions.map(x=>x.length), names: currentNames, globalProvider, globalModel, perAgentProviders, perAgentModels, visionEnabled, functionsEnabled }); } catch {}
    onClose();
  };
  
  /**
   * Resets the instructions in the local state to the default constant value.
   */
  const handleReset = () => {
    setCurrentInstructions(Array(4).fill(INITIAL_SYSTEM_INSTRUCTION));
  };


  const DevPlaceholder = ({ text = 'Development in progress' }: { text?: string }) => (
    <div className="dev-placeholder">
      <div>{text}</div>
    </div>
  );

  const ProvidersSection = (
    <>
      <div className="section-card">
        <div className="section-card__title">API Keys</div>
        <div className="section-card__desc">Add provider keys to enable model fetching and generation.</div>
        <div className="form-grid">
          <div className="input-with-button">
            <input id="tavily-api-key" type="password" className="api-key-editor__input" value={currentTavilyKey} onChange={(e) => setCurrentTavilyKey(e.target.value)} placeholder="Enter your Tavily API Key" aria-label="Tavily API Key input" />
          </div>
          <div className="input-with-button">
            <input id="gemini-api-key" type="password" className="api-key-editor__input" value={currentGeminiKey} onChange={(e) => setCurrentGeminiKey(e.target.value)} placeholder="Enter your Gemini API Key" aria-label="Gemini API Key input" />
            <button className="button button--primary" onClick={handleSaveGeminiKey} aria-label="Save Gemini API key and fetch models">Save & Test</button>
          </div>
          <div className="input-with-button" style={{ gridColumn: '1 / -1' }}>
            <input id="groq-api-key" type="password" className="api-key-editor__input" value={currentGroqKey} onChange={(e) => setCurrentGroqKey(e.target.value)} placeholder="Enter your Groq API Key" aria-label="Groq API Key input" />
            <button className="button button--primary" onClick={handleSaveGroqKey} aria-label="Save Groq API key and fetch models">Save & Test</button>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card__title">Global Defaults</div>
        <div className="form-row">
          <span className="form-row__label">Global Provider</span>
          <select className="select" value={globalProvider} onChange={(e) => {
            const val = (e.target.value as 'gemini' | 'groq');
            setGlobalProvider(val);
            setPerAgentProviders(prev => prev.map(() => val));
            setGlobalModel('');
            setPerAgentModels(prev => prev.map(() => ''));
            try { logEvent('settings','info','global_provider_change', { provider: val }); } catch {}
          }} aria-label="Global provider select">
            <option value="gemini">Gemini</option>
            <option value="groq">Groq</option>
          </select>
          <span className="form-row__label">Global Model</span>
          <select className="select" value={globalModel} onChange={(e) => { setGlobalModel(e.target.value); try { logEvent('settings','info','global_model_change', { model: e.target.value }); } catch {} }} aria-label="Global model select">
            <option value="" disabled>(Select model)</option>
            {(modelsByProvider[globalProvider] || []).map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            className="button button--secondary"
            onClick={async () => {
              addFeedback('info', 'Refreshing models...');
              try {
                setIsFetching(true);
                fetchAbortRef.current?.abort();
                fetchAbortRef.current = new AbortController();
                const signal = fetchAbortRef.current.signal;
                const [gemini, groq] = await Promise.all([
                  fetchModelsForProvider('gemini', currentGeminiKey, signal).catch(() => []),
                  fetchModelsForProvider('groq', currentGroqKey, signal).catch(() => []),
                ]);
                setModelsByProvider({ gemini, groq });
                addFeedback('success', `Refreshed models. Gemini: ${gemini.length}, Groq: ${groq.length}`);
                try { logEvent('settings','info','refresh_models', { gemini: gemini.length, groq: groq.length }); } catch {}
              } catch (e: any) {
                if (e?.name === 'AbortError') return;
                addFeedback('error', `Refresh failed: ${e?.message || e}`);
                try { logEvent('settings','error','refresh_models', { error: e?.message || String(e) }); } catch {}
              } finally {
                setIsFetching(false);
              }
            }}
            aria-label="Refresh models"
          >Refresh Models</button>
          <button
            className="button button--secondary"
            onClick={() => {
              setPerAgentProviders(prev => prev.map(() => globalProvider));
              setPerAgentModels(prev => prev.map(() => globalModel || ''));
              addFeedback('success', 'Applied global provider/model to all agents');
            }}
            aria-label="Apply global provider and model to all agents"
          >Apply Global to Agents</button>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card__title">Agents</div>
        <div className="providers-grid">
          {perAgentProviders.map((p, i) => (
            <div key={i} className="agent-row">
              <div className="agent-row__label">Agent {i + 1}</div>
              <select className="select agent-row__provider" aria-label={`Provider for Agent ${i + 1}`} value={p} onChange={(e) => {
                const v = (e.target.value as 'gemini' | 'groq');
                setPerAgentProviders(prev => prev.map((x, idx) => idx === i ? v : x));
                setPerAgentModels(prev => prev.map((x, idx) => idx === i ? '' : x));
                try { logEvent('settings','info','agent_provider_change', { agent: i, provider: v }); } catch {}
              }}>
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
              <select className="select agent-row__model" aria-label={`Model for Agent ${i + 1}`} value={perAgentModels[i] || ''} onChange={(e) => {
                const val = e.target.value;
                setPerAgentModels(prev => prev.map((x, idx) => idx === i ? val : x));
                try { logEvent('settings','info','agent_model_change', { agent: i, model: val }); } catch {}
              }}>
                <option value="" disabled>(Model)</option>
                {(modelsByProvider[perAgentProviders[i]] || []).map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const AgentsSection = (
    <>
      <p>Customize the core behavior for each agent. This instruction is used for their initial response.</p>
      {currentInstructions.map((inst, index) => (
        <div key={index} className={`instruction-editor instruction-editor--color-${index + 1}`}>
          <label htmlFor={`agent-name-${index}`} className="instruction-editor__label">Agent {index + 1} Name</label>
          <input
            id={`agent-name-${index}`}
            className="api-key-editor__input"
            value={currentNames[index] || ''}
            onChange={(e) => setCurrentNames(prev => prev.map((n, i) => i === index ? e.target.value : n))}
            placeholder={`Agent ${index + 1}`}
            aria-label={`Agent ${index + 1} Name`}
          />
          <label htmlFor={`agent-inst-${index}`} className="instruction-editor__label">System instructions for {currentNames[index] || `Agent ${index + 1}`}</label>
          <textarea id={`agent-inst-${index}`} className="instruction-editor__textarea" value={inst} onChange={(e) => handleInstructionChange(index, e.target.value)} rows={5} aria-label={`System instruction for Agent ${index + 1}`} />
        </div>
      ))}
    </>
  );

  const Sidebar = (
    <div className="settings-sidebar">
      <div className="settings-sidebar__section">
        <div className="settings-sidebar__title">Settings</div>
        {tabs.map(t => (
          <div key={t.id} className={`nav-item ${activeTab === t.id ? 'nav-item--active' : ''}`} onClick={() => { try { logEvent('ui','info','settings_tab_change', { to: t.id }); } catch {}; setActiveTab(t.id); }} role="button" aria-label={`Open ${t.label}`}>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Settings</h2>
          <button onClick={onClose} className="modal__close-button" aria-label="Close settings">&times;</button>
        </div>
        <div className="modal__body">
          {Sidebar}
          <div className="settings-content">
            {activeTab === 'providers' && ProvidersSection}
            {activeTab === 'agents' && AgentsSection}
            {activeTab === 'vision' && (
              <>
                <div className="section-card">
                  <div className="section-card__title">Vision</div>
                  <div className="section-card__desc">Enable image inputs and vision capabilities where supported by the selected provider.</div>
                  <div className="form-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={visionEnabled} onChange={(e) => setVisionEnabled(e.target.checked)} aria-label="Enable vision features" />
                      <span>Enable Vision</span>
                    </label>
                  </div>
                </div>
              </>
            )}
            {activeTab === 'advanced' && (
              <>
                <div className="section-card">
                  <div className="section-card__title">Function Calling</div>
                  <div className="section-card__desc">Enable function/tool calling where supported. This is a feature flag only; behavior will be no-op if the provider/model doesn’t support it.</div>
                  <div className="form-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={functionsEnabled} onChange={(e) => setFunctionsEnabled(e.target.checked)} aria-label="Enable function calling" />
                      <span>Enable Function Calling</span>
                    </label>
                  </div>
                </div>
              </>
            )}
            {activeTab !== 'providers' && activeTab !== 'agents' && activeTab !== 'vision' && activeTab !== 'advanced' && (
              <DevPlaceholder text="Development in progress" />
            )}
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
      {/* Inline loading bar for model fetch operations */}
      <LoadingBar visible={isFetching} label="Loading models..." />

      {/* Floating feedback box */}
      <div style={{ position: 'fixed', right: '1rem', bottom: '1rem', zIndex: 1000, maxWidth: '360px' }}>
        {feedbacks.map(f => (
          <div key={f.id} style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            background: f.type === 'success' ? 'rgba(46, 204, 113, 0.12)' : f.type === 'error' ? 'rgba(231, 76, 60, 0.12)' : 'rgba(52, 152, 219, 0.12)',
            color: f.type === 'success' ? '#2ecc71' : f.type === 'error' ? '#e74c3c' : '#3498db',
            border: `1px solid ${f.type === 'success' ? '#2ecc71' : f.type === 'error' ? '#e74c3c' : '#3498db'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.35 }}>{f.text}</div>
              <button onClick={() => removeFeedback(f.id)} aria-label="Dismiss message" style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsModal;
