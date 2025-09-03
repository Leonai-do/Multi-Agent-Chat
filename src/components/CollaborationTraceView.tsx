/**
 * @file Renders the historical collaboration trace, showing each agent's initial and refined responses.
 */
import React, { FC } from 'react';
import type { CollaborationTrace } from '../types';
import { TraceAgentBox } from './AgentBox';

/**
 * Props for the CollaborationTraceView component.
 * @property {CollaborationTrace} trace - The trace data containing initial and refined responses.
 * @property {string} [className] - An optional CSS class for the grid layout, provided by the parent.
 */
interface CollaborationTraceViewProps {
  trace: CollaborationTrace;
  className?: string;
}

/**
 * A component that displays a grid of `TraceAgentBox` components, one for each agent,
 * visualizing the entire two-step collaboration process.
 *
 * @param {CollaborationTraceViewProps} props - The component props.
 * @returns {React.ReactElement} The rendered collaboration trace grid.
 */
const CollaborationTraceView: FC<CollaborationTraceViewProps> = ({ trace, className }) => {
  // Determine the number of agents to display based on the available data.
  const maxAgents = Math.max(trace.initialResponses?.length || 0, trace.refinedResponses?.length || 0);
  
  return (
    <div className={className}>
      {/* Map over the number of agents and render a trace box for each one */}
      {Array.from({ length: maxAgents }).map((_, index) => (
        <TraceAgentBox
          key={`trace-agent-${index}`}
          agentId={index}
          initial={trace.initialResponses?.[index]}
          refined={trace.refinedResponses?.[index]}
        />
      ))}
    </div>
  );
};

export default CollaborationTraceView;