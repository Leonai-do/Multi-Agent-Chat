import React, { FC } from 'react';
import type { LiveAgentState } from '../types';
import { AgentBox } from './AgentBox';

interface LiveAgentWorkspaceProps {
    agentStates: LiveAgentState[];
    isVisible: boolean;
}

const LiveAgentWorkspace: FC<LiveAgentWorkspaceProps> = ({ agentStates, isVisible }) => (
  <div className={`agent-grid-container ${isVisible ? 'visible' : ''}`}>
    <div className="agent-grid">
      {agentStates.map(agent => (
        <AgentBox key={agent.id} agentId={agent.id} status={agent.status} response={agent.response} />
      ))}
    </div>
  </div>
);

export default LiveAgentWorkspace;
