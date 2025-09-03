import React, { useState, useEffect, FC } from 'react';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';

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
              <textarea id={`agent-inst-${index}`} value={inst} onChange={(e) => handleInstructionChange(index, e.target.value)} rows={5} aria-label={`System instruction for Agent ${index + 1}`} />
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
