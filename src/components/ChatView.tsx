/**
 * @file This component represents the main chat interface, including the header,
 * message list, live agent workspace, and input form.
 */
import React, { FC, FormEvent, useRef, useEffect } from 'react';
import type { Chat, LiveAgentState } from '../types';
import MessageItem from './MessageItem';
import LiveAgentWorkspace from './LiveAgentWorkspace';
import ThemeSwitcher from './ThemeSwitcher';
import { APP_TITLE, INPUT_PLACEHOLDER } from '../config';

/** Props for the ChatView component. */
interface ChatViewProps {
  activeChat: Chat | undefined;
  isLoading: boolean;
  loadingMessage: string;
  internetEnabled: boolean;
  onToggleInternet: () => void;
  currentCollaborationState: LiveAgentState[];
  showCollaboration: boolean;
  setShowCollaboration: (show: boolean) => void;
  handleSubmit: (e: FormEvent) => void;
  input: string;
  setInput: (input: string) => void;
  setIsSidebarOpen: (open: boolean) => void;
  isSidebarOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  onUpdateMessage: (messageId: string, newText: string) => void;
  onResendMessage: (messageId: string, newText: string) => void;
}

/**
 * The main view for a chat conversation. It displays messages, handles user input,
 * and shows the live agent workspace during generation.
 */
const ChatView: FC<ChatViewProps> = ({
  activeChat,
  isLoading,
  loadingMessage,
  internetEnabled,
  onToggleInternet,
  currentCollaborationState,
  showCollaboration,
  setShowCollaboration,
  handleSubmit,
  input,
  setInput,
  setIsSidebarOpen,
  isSidebarOpen,
  setIsSettingsOpen,
  onUpdateMessage,
  onResendMessage,
}) => {
  const messageListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when messages or collaboration state update
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [activeChat, currentCollaborationState, loadingMessage]);

  const hasMessages = !!activeChat && activeChat.messages && activeChat.messages.length > 0;
  const showWorkspace = currentCollaborationState && currentCollaborationState.length > 0;

  return (
    <div className="chat-view">
      {/* Header */}
      <header className="chat-view__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="icon-button chat-view__menu-button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
          </button>
          <h1 className="chat-view__title">{APP_TITLE}</h1>
        </div>

        <div className="chat-view__header-actions">
          <button
            className={`internet-toggle ${internetEnabled ? 'internet-toggle--enabled' : ''}`}
            onClick={onToggleInternet}
            aria-pressed={internetEnabled}
            aria-label="Toggle internet access"
            title="Toggle Internet"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4a8 8 0 100 16 8 8 0 000-16zm6.32 5H15.2A12.56 12.56 0 0013 5.36 6.03 6.03 0 0118.32 9zM12 6.1c.7.7 1.32 1.63 1.8 2.9H10.2c.48-1.27 1.1-2.2 1.8-2.9zM5.68 9A6.03 6.03 0 0111 5.36 12.56 12.56 0 018.8 9H5.68zM6.1 12c0-.34.02-.67.06-1h3.5a18.9 18.9 0 000 2h-3.5c-.04-.33-.06-.66-.06-1zm.58 3h3.12a12.56 12.56 0 001.2 3.64A6.03 6.03 0 016.68 15zM12 17.9c-.7-.7-1.32-1.63-1.8-2.9h3.6c-.48 1.27-1.1 2.2-1.8 2.9zM17.32 15A6.03 6.03 0 0113 18.64 12.56 12.56 0 0015.2 15h2.12zM17.84 13h-3.5a18.9 18.9 0 000-2h3.5c.04.33.06.66.06 1s-.02.67-.06 1z" />
            </svg>
            <span>Internet</span>
          </button>

          <ThemeSwitcher />

          <button
            className="icon-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 00.12-.66l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7.028 7.028 0 00-1.62-.94l-.36-2.54A.5.5 0 0014.3 1h-4.6a.5.5 0 00-.49.41l-.36 2.54c-.59.23-1.13.54-1.62.94l-2.39-.96a.5.5 0 00-.61.22L2.7 7.99a.5.5 0 00.12.66l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 13.7a.5.5 0 00-.12.66l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.49.4 1.03.71 1.62.94l.36 2.54c.05.24.25.41.49.41h4.6c.24 0 .44-.17.49-.41l.36-2.54c.59-.23 1.13-.54 1.62-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 00-.12-.66l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Message list */}
      {!hasMessages ? (
        <div className="welcome-screen">
          <div>
            <div className="welcome-screen__title">Welcome to Multi-Agent Gemini Chat</div>
            <div className="welcome-screen__subtitle">Start by typing a prompt below and press Enter.</div>
          </div>
        </div>
      ) : (
        <div className="message-list" ref={messageListRef}>
          {activeChat!.messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onUpdateMessage={onUpdateMessage}
              onResendMessage={onResendMessage}
            />
          ))}

          {loadingMessage && (
            <div className="message-list__loading">{loadingMessage}</div>
          )}

          {/* Live Agent Workspace during generation */}
          {showWorkspace && (
            <div className="agent-workspace">
              <div className="agent-workspace__header">
                <div className="agent-workspace__title">Live Agent Workspace</div>
                <button
                  className="agent-workspace__toggle"
                  onClick={() => setShowCollaboration(!showCollaboration)}
                  aria-expanded={showCollaboration}
                >
                  <svg
                    className={showCollaboration ? 'expanded' : ''}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 15.6l-6-6 1.4-1.4L12 12.8l4.6-4.6L18 9.6l-6 6z" />
                  </svg>
                  {showCollaboration ? 'Hide details' : 'Show details'}
                </button>
              </div>
              <div className={`agent-grid-wrapper ${showCollaboration ? 'agent-grid-wrapper--visible' : ''}`}>
                <LiveAgentWorkspace agentStates={currentCollaborationState} className="agent-grid" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input form */}
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          className="chat-input__text-field"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={INPUT_PLACEHOLDER}
          disabled={isLoading}
          aria-label="Type your message"
        />
        <button
          type="submit"
          className="chat-input__submit-button"
          disabled={isLoading || input.trim() === ''}
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatView;
