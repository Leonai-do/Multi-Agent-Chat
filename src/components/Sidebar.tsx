import React, { FC } from 'react';
import type { Chat } from '../types';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

const Sidebar: FC<SidebarProps> = ({ chats, activeChatId, onNewChat, onSelectChat, onDeleteChat }) => {
  return (
    <>
      <div className="sidebar-header">
        <button className="new-chat-button" onClick={onNewChat}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 6c.55 0 1 .45 1 1v4h4c.55 0 1 .45 1 1s-.45 1-1 1h-4v4c0 .55-.45 1-1 1s-1-.45-1-1v-4H7c-.55 0-1-.45-1-1s.45-1 1-1h4V7c0-.55.45-1 1-1z"/></svg>
          New Chat
        </button>
      </div>
      <ul className="chat-history-list">
        {chats.map(chat => (
          <li key={chat.id} className={`chat-history-item ${activeChatId === chat.id ? 'active' : ''}`} onClick={() => onSelectChat(chat.id)}>
            {chat.title}
            <button className="delete-chat-button" onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }} aria-label={`Delete chat: ${chat.title}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

export default Sidebar;
