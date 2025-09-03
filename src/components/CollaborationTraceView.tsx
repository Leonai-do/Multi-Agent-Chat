import React, { FC } from 'react';
import type { CollaborationTrace } from '../types';
import { TraceAgentBox } from './AgentBox';

const CollaborationTraceView: FC<{ trace: CollaborationTrace }> = ({ trace }) => {
  const maxAgents = Math.max(trace.initialResponses?.length || 0, trace.refinedResponses?.length || 0);
  return (
    <div className="collaboration-trace">
      <div className="agent-grid">
        {Array.from({ length: maxAgents }).map((_, index) => (
          <TraceAgentBox key={`trace-agent-${index}`} agentId={index} initial={trace.initialResponses?.[index]} refined={trace.refinedResponses?.[index]} />
        ))}
      </div>
    </div>
  );
};

export default CollaborationTraceView;
