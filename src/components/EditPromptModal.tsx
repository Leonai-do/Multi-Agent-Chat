

import React, { useState, useEffect, FC } from 'react';

interface EditPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onSave: (newText: string) => void;
  onSaveAndResend: (newText: string) => void;
}

const EditPromptModal: FC<EditPromptModalProps> = ({ isOpen, onClose, initialText, onSave, onSaveAndResend }) => {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
    }
  }, [initialText, isOpen]);
  
  if (!isOpen) return null;
  
  const handleSave = () => {
    onSave(text);
    onClose();
  };

  const handleSaveAndResend = () => {
    onSaveAndResend(text);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-prompt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Prompt</h2>
          <button onClick={onClose} className="close-button" aria-label="Close edit modal">&times;</button>
        </div>
        <div className="modal-body">
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            aria-label="Prompt text editor"
            rows={10} 
          />
        </div>
        <div className="modal-footer">
          <div className="modal-actions">
            <button onClick={onClose} className="button-secondary">Cancel</button>
            <button onClick={handleSave} className="button-secondary">Save Changes</button>
            <button onClick={handleSaveAndResend} className="button-primary">
              Save & Resend
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPromptModal;
