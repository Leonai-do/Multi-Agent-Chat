/**
 * @file Renders a modal for editing a user's prompt.
 */
import React, { useState, useEffect, FC } from 'react';

/**
 * Props for the EditPromptModal component.
 * @property {boolean} isOpen - Whether the modal is currently visible.
 * @property {() => void} onClose - Function to call when the modal should be closed.
 * @property {string} initialText - The initial text of the prompt to be edited.
 * @property {(newText: string) => void} onSave - Callback to save changes without resending.
 * @property {(newText: string) => void} onSaveAndResend - Callback to save changes and resend the prompt.
 */
interface EditPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onSave: (newText: string) => void;
  onSaveAndResend: (newText: string) => void;
}

/**
 * A modal that provides a textarea to edit an existing user prompt.
 * It offers options to cancel, save changes, or save and resend the prompt
 * to generate a new response from that point in the conversation.
 *
 * @param {EditPromptModalProps} props - The component props.
 * @returns {React.ReactElement | null} The rendered modal or null if not open.
 */
const EditPromptModal: FC<EditPromptModalProps> = ({ isOpen, onClose, initialText, onSave, onSaveAndResend }) => {
  // Local state to manage the text being edited.
  const [text, setText] = useState(initialText);

  // Effect to reset local state when the modal is opened with new initial text.
  useEffect(() => {
    if (isOpen) {
      setText(initialText);
    }
  }, [initialText, isOpen]);
  
  if (!isOpen) return null;
  
  /** Calls the onSave callback and closes the modal. */
  const handleSave = () => {
    onSave(text);
    onClose();
  };

  /** Calls the onSaveAndResend callback and closes the modal. */
  const handleSaveAndResend = () => {
    // Note: The parent component handles the async AI call.
    // This function just passes the new text up and closes the modal immediately.
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