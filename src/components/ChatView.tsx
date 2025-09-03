/**
 * @file This component represents the main chat interface, including the header,
 * message list, and input form.
 */
import React, { FC, FormEvent, useRef, useEffect } from 'react';
import type { Chat, LiveAgentState } from '../types';
import MessageItem from './MessageItem';
import LiveAgentWorkspace from './LiveAgentWorkspace';
import ThemeSwitcher from './ThemeSwitcher';

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
 *
 * @param {ChatViewProps} props - The component props.
 * @returns {React.ReactElement} The rendered chat view.
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
    onResendMessage
}) => {
    const messageListRef = useRef<HTMLDivElement>(null);

    /**
     * Effect to automatically scroll to the bottom of the message list
     * when new messages are added or the collaboration state appears.
     */
    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    }, [activeChat, currentCollaborationState, loadingMessage]);

    return (
        <div className="chat-view">
            <header className="chat-view__header">
                <button className="icon-button chat-view__menu-button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle menu">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 1