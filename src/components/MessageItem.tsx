/**
 * @file Renders a single message item in the chat, including user prompts and model responses.
 * It handles displaying the message content, collaboration traces, and provides actions
 * like editing, copying, and viewing raw text.
 */
import React, { useState, FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';
import CodeBlock from './CodeBlock';
import CollaborationTraceView from './CollaborationTraceView';
import EditPromptModal from './EditPromptModal';

/**
 * Props for the MessageItem component.
 * @property {Message} message - The message object to display.
 * @property {(messageId: string, newText: string) => void} onUpdateMessage - Callback to update a message's text.
 * @property {(messageId: string, newText: string) => void} onResendMessage - Callback to resend an edited message, branching the conversation.
 */
interface MessageItemProps {
  message: Message;
  onUpdateMessage: (messageId: string, newText: string) => void;
  onResendMessage: (messageId: string, newText: string) => void;
}

/**
 * A component that renders a single chat message bubble for either a user or a model.
 * It includes toolbars for actions and can expand to show agent collaboration details.
 *
 * @param {MessageItemProps} props - The component props.
 * @returns {React.ReactElement} The rendered message item.
 */
const MessageItem: FC<MessageItemProps> = ({ message, onUpdateMessage, onResendMessage }) => {
  // State for toggling the visibility of the collaboration trace
  const [isTraceVisible, setIsTraceVisible] = useState(false);
  // State for switching between rendered Markdown and raw text view
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  // State for managing the edit modal visibility for user messages
  const [isEditing, setIsEditing] = useState(false);

  const messageText = message?.parts?.[0]?.text ?? '';

  /** Handles copying the raw message text to the clipboard with a safe fallback. */
  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(messageText).catch(() => {
        // Fallback on failure
        const ta = document.createElement('textarea');
        ta.value = messageText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = messageText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
  };

  /** Handles saving an edited prompt without resending. */
  const handleSave = (newText: string) => {
    onUpdateMessage(message.id, newText);
  };

  /** Handles saving an edited prompt and triggering a new model response. */
  const handleSaveAndResend = (newText: string) => {
    onResendMessage(message.id, newText);
  };

  return (
    <>
      <div className={`message-item ${message.collaborationTrace && isTraceVisible ? 'message-item--trace-visible' : ''}`}>
        <div className={`message-item__wrapper message-item__wrapper--${message.role}`}>
            <div className="message-item__actions">
            {message.role === 'user' && (
                <button className="message-item__action-button" onClick={() => setIsEditing(true)} aria-label="Edit prompt">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
            )}
            <button className="message-item__action-button" onClick={handleCopy} aria-label="Copy message">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-5zm0 16H8V7h11v14z"/></svg>
            </button>
            </div>
            <div className={`message-bubble message-bubble--${message.role}`} onDoubleClick={message.role === 'user' ? () => setIsEditing(true) : undefined}>
            {/* Message header */}
            <div className="message-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}>
              <span className="message-header__name" style={{fontWeight:600,fontSize:'0.9rem'}}>
                {message.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <span style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                {message.role === 'model' && message.provider && (
                  <span className="badge" title={message.model || ''} style={{padding:'0.15rem 0.5rem',borderRadius:'999px',border:'1px solid var(--border-color)',fontSize:'0.75rem',color:'var(--secondary-text-color)'}}>
                    {message.provider}{message.model ? ` · ${message.model}` : ''}
                  </span>
                )}
                <span className="message-header__time" style={{fontSize:'0.75rem',color:'var(--secondary-text-color)'}}>
                  {message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : ''}
                </span>
              </span>
            </div>
            {viewMode === 'rendered' ? (
                <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom component for code blocks to add copy functionality
                    code({ children, className }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? <CodeBlock>{children}</CodeBlock> : <code className={className}>{children}</code>;
                    },
                }}
                >
                {messageText}
                </ReactMarkdown>
            ) : (
                <pre className="message-bubble__raw-text"><code>{messageText}</code></pre>
            )}

            {/* Render sources if they exist */}
            {message.sources && message.sources.length > 0 && (
              <div className="sources-list">
                  <h4 className="sources-list__title">Sources</h4>
                  <ol className="sources-list__items">
                      {message.sources.map((source, index) => (
                          <li key={index} className="source-item">
                              <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.url}>
                                  {source.title}
                              </a>
                          </li>
                      ))}
                  </ol>
              </div>
            )}
            
            {/* Toolbar for model messages */}
            {message.role === 'model' && (
                <div className="message-bubble__toolbar">
                <button onClick={() => setViewMode(viewMode === 'rendered' ? 'raw' : 'rendered')} className="message-bubble__view-toggle" aria-label={`Switch to ${viewMode === 'rendered' ? 'raw' : 'rendered'} view`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
                    {viewMode === 'rendered' ? 'Raw' : 'Rendered'}
                </button>

                {message.collaborationTrace && (
                    <button onClick={() => setIsTraceVisible(!isTraceVisible)} className="message-bubble__collaboration-toggle" aria-expanded={isTraceVisible}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 15.5c-2.26 0-4.26-1.23-5.43-3.13.34-.39.64-.82.89-1.28.63.49 1.37.84 2.16 1.05V10.5h2v1.65c.79-.21 1.53-.56 2.16-1.05.25.46.55.89.89 1.28-1.17 1.9-3.17 3.13-5.43 3.13zM12 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-7.5-1.5c-2.26 0-4.26-1.23-5.43-3.13C-.21 8.98 0 8.44 0 8c0-.44.21-.98.57-1.37C1.74 4.73 3.74 3.5 6 3.5c2.26 0 4.26 1.23 5.43 3.13-.34.39-.64.82-.89 1.28-.63-.49-1.37-.84-2.16-1.05V8.5h-2v-1.65c-.79.21-1.53.56-2.16 1.05-.25-.46-.55-.89-.89-1.28C4.76 4.73 2.76 3.5.5 3.5 2.76 3.5 4.76 4.73 5.93 6.63c.34.39.64.82.89 1.28.63-.49 1.37-.84 2.16-1.05V8.5h2v1.65c.79.21 1.53.56 2.16 1.05.25.46.55.89.89 1.28C10.24 14.27 8.24 15.5 6 15.5c-2.26 0-4.26-1.23-5.43-3.13.34-.39.64-.82.89-1.28-.63.49-1.37-.84-2.16-1.05V10.5h-2v-1.65c-.79.21-1.53-.56-2.16-1.05C1.74 6.27 3.74 7.5 6 7.5c2.26 0 4.26-1.23 5.43-3.13C11.79 4.02 12 4.56 12 5c0 .44-.21.98-.57 1.37C10.26 8.27 8.26 9.5 6 9.5s-4.26-1.23-5.43-3.13z"/></svg>
                    <span>{isTraceVisible ? 'Hide' : 'View'} Collaboration</span>
                    </button>
                )}
                </div>
            )}
            </div>
        </div>

        {/* The collaboration trace view, visibility controlled by state */}
        {message.collaborationTrace && (
            <div className={`collaboration-trace-wrapper ${isTraceVisible ? 'collaboration-trace-wrapper--visible' : ''}`}>
                <div className="collaboration-trace">
                    <CollaborationTraceView trace={message.collaborationTrace} className="agent-grid" />
                </div>
            </div>
        )}
      </div>

      {/* Render the edit modal for user messages */}
      {message.role === 'user' && (
        <EditPromptModal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          initialText={messageText}
          onSave={handleSave}
          onSaveAndResend={handleSaveAndResend}
        />
      )}
    </>
  );
};

export default MessageItem;
