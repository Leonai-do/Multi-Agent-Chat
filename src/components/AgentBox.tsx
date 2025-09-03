/**
 * @file This file contains components for displaying individual agent information,
 * both for live collaboration status and historical trace views.
 */
import React, { useState, FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Props for the AgentBox component, used for displaying live status.
 * @property {number} agentId - The agent's ID (0-3).
 * @property {string} [status] - The current status of the agent (e.g., 'writing').
 * @property {string} response - The current response text from the agent.
 */
interface AgentBoxProps {
    agentId: number;
    status?: string;
    response: string;
}

/**
 * Props for the TraceAgentBox component, used for displaying historical data.
 * @property {number} agentId - The agent's ID (0-3).
 * @property {string} [initial] - The agent's initial response.
 * @property {string} [refined] - The agent's refined response.
 */
interface TraceAgentBoxProps {
    agentId: number;
    initial?: string;
    refined?: string;
}

/**
 * A component to display the live status and response of a single agent during collaboration.
 * @param {AgentBoxProps} props - The component props.
 * @returns {React.ReactElement} The rendered live agent status box.
 */
export const AgentBox: FC<AgentBoxProps> = ({ agentId, status, response }) => (
    <div className={`agent-box agent-box--color-${agentId + 1}`}>
        <div className="agent-box__header">
            Agent {agentId + 1}
            {status && <span className={`agent-box__status agent-box__status--${status}`}>{status}</span>}
        </div>
        <div className="agent-box__content">
            {/* FIX: Corrected the code component rendering in ReactMarkdown. The previous implementation was calling an undefined 'code' function. */}
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: ({ children }) => <>{children}</>, code: ({ children }) => <code>{children}</code> }}>
                {response || '...'}
            </ReactMarkdown>
        </div>
    </div>
);

/**
 * A component to display the historical initial and refined responses of a single agent.
 * Includes a toggle to switch between the two views.
 * @param {TraceAgentBoxProps} props - The component props.
 * @returns {React.ReactElement} The rendered historical agent trace box.
 */
export const TraceAgentBox: FC<TraceAgentBoxProps> = ({ agentId, initial, refined }) => {
    // Determine if content exists for each view
    const hasInitial = Boolean(initial && initial.trim());
    const hasRefined = Boolean(refined && refined.trim());
    
    // State to manage which response (initial or refined) is currently visible.
    const [view, setView] = useState<'initial' | 'refined'>(hasRefined ? 'refined' : 'initial');
    
    // Determine the content to display based on the current view state.
    const content = view === 'refined' ? (refined || '') : (initial || '');

    return (
        <div className={`agent-box agent-box--color-${agentId + 1}`}>
            <div className="agent-box__header">
                <span>Agent {agentId + 1}</span>
                <div className="agent-box__toggle-group" role="group" aria-label={`Toggle Agent ${agentId + 1} response`}>
                    <button type="button" className={`agent-box__toggle ${view === 'initial' ? 'agent-box__toggle--active' : ''}`} onClick={() => setView('initial')} disabled={!hasInitial} aria-pressed={view === 'initial'} aria-label="Show initial response">Initial</button>
                    <button type="button" className={`agent-box__toggle ${view === 'refined' ? 'agent-box__toggle--active' : ''}`} onClick={() => setView('refined')} disabled={!hasRefined} aria-pressed={view === 'refined'} aria-label="Show refined response">Refined</button>
                </div>
            </div>
            <div className="agent-box__content">
                {content ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: ({ children }) => <>{children}</>, code: ({ children }) => <code>{children}</code> }}>{content}</ReactMarkdown> : <div className="placeholder">No response available</div>}
            </div>
        </div>
    );
};