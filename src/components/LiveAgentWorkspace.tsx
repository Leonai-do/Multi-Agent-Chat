/**
 * @file Renders the live agent workspace, showing the real-time status of each agent.
 */
import React, { FC } from 'react';
import type { LiveAgentState } from '../types';
import { AgentBox } from './AgentBox';

/**
 * Props for the LiveAgentWorkspace component.
 * @property {LiveAgentState[]} agentStates - An array of the current state for each agent.
 * @property {string} [className] - An optional CSS class for the grid layout, provided by the parent.
 */
interface LiveAgentWorkspaceProps {
    agentStates: LiveAgentState[];
    className?: string;
}

/**
 * A component that displays a grid of `AgentBox` components, one for each agent,
 * to show their real-time status and responses during the collaboration process.
 *
 * @param {LiveAgentWorkspaceProps} props - The component props.
 * @returns {React.ReactElement} The rendered live agent workspace grid.
 */
const LiveAgentWorkspace: FC<LiveAgentWorkspaceProps> = ({ agentStates, className }) => (
  <div className={className}>
    {/* Map over the agent states and render a status box for each one */}
    {agentStates.map(agent => (
      <AgentBox
        key={agent.id}
        agentId={agent.id}
        status={agent.status}
        response={agent.response}
      />
    ))}
  </div>
);

export default LiveAgentWorkspace;