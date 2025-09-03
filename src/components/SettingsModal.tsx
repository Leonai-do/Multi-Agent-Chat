/**
 * @file Renders a modal for configuring AI agent system instructions.
 */
import React, { useState, useEffect, FC } from 'react';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';

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
  
  // Effect to sync local state with props when the modal is opened.
  useEffect(() => {
    if (isOpen) {
      setCurrentInstructions(instructions);
      setCurrentTavilyKey(tavilyApiKey);
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