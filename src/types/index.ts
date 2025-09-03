import { ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface CollaborationTrace {
  initialResponses: string[];
  refinedResponses: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  parts: { text: string }[];
  collaborationTrace?: CollaborationTrace;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

export interface LiveAgentState {
  id: number;
  status: 'pending' | 'initializing' | 'writing' | 'refining' | 'done';
  response: string;
}
