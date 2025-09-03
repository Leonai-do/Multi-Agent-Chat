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
 */
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instructions: string[];
  onSave: (newInstructions: string[]) => void;
}

/**
 * A modal component that allows users to view and edit the system instructions
 * for each of the four AI agents.
 *
 * @param {SettingsModalProps} props - The component props.
 * @returns {React.ReactElement | null} The rendered modal or null if not open.
 */
const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, instructions, onSave }) => {
  // Local state to manage instruction edits before saving.
  const [currentInstructions, setCurrentInstructions] = useState(instructions);
  
  // Effect to sync local state with props when the modal is opened.
  useEffect(() => {
    if (isOpen) {
      setCurrentInstructions(instructions);
    }
  }, [instructions, isOpen]);
  
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
   * Saves the current local state via the onSave prop and closes the modal.
   */
  const handleSave = () => {
    onSave(currentInstructions);
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
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
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

export default SettingsModal;