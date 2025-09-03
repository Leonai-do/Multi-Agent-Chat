

import React, { FC, FormEvent, useRef, useEffect } from 'react';
import type { Chat, LiveAgentState } from '../types';
import MessageItem from './MessageItem';
import LiveAgentWorkspace from './LiveAgentWorkspace';
import ThemeSwitcher from './ThemeSwitcher';

interface ChatViewProps {
    activeChat: Chat | undefined;
    isLoading: boolean;
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

const ChatView: FC<ChatViewProps> = ({ 
    activeChat, 
    isLoading, 
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
    onResendMessage
}) => {
    const messageListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    }, [activeChat, currentCollaborationState]);

    return (
        <div className="chat-container">
            <header>
                <button className="menu-button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle menu">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" /></svg>
                </button>
                <h1>Multi-Agent Chat</h1>
                <div className="header-actions">
                    <ThemeSwitcher />
                    <button className="settings-button" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" /></svg>
                    </button>
                </div>
            </header>
            
            <div className="message-list" ref={messageListRef}>
                {activeChat ? (
                    <>
                        {activeChat.messages.map((msg) => <MessageItem key={msg.id} message={msg} onUpdateMessage={onUpdateMessage} onResendMessage={onResendMessage} />)}
                        {isLoading && (
                            <div className="agent-workspace">
                                <div className="agent-workspace-header">
                                    <span className="agent-workspace-title">Agent Collaboration Status</span>
                                    <button onClick={() => setShowCollaboration(!showCollaboration)} className="collaboration-toggle" aria-expanded={showCollaboration}>
                                        {showCollaboration ? 'Hide' : 'Show'} Details
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={showCollaboration ? 'expanded' : ''}><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" /></svg>
                                    </button>
                                </div>
                                <LiveAgentWorkspace agentStates={currentCollaborationState} isVisible={showCollaboration} />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="welcome-screen">
                        <div>
                            <h2>Multi-Agent Chat</h2>
                            <p>Ask the agent team anything to start a new conversation.</p>
                        </div>
                    </div>
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="input-area">
                <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask the agent team..." aria-label="Chat input" disabled={isLoading} />
                <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                </button>
            </form>
        </div>
    );
};

export default ChatView;
