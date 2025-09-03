import React, { useState, FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AgentBoxProps {
    agentId: number;
    status?: string;
    response: string;
}

interface TraceAgentBoxProps {
    agentId: number;
    initial?: string;
    refined?: string;
}

export const AgentBox: FC<AgentBoxProps> = ({ agentId, status, response }) => (
    <div className={`agent-box agent-box-color-${agentId + 1} ${status || ''}`}>
        <div className="agent-box-header">
            Agent {agentId + 1}
            {status && <span className="agent-status-indicator">{status}</span>}
        </div>
        <div className="agent-box-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: ({ children }) => <>{children}</>, code: ({ children }) => <code>{children}</code> }}>
                {response || '...'}
            </ReactMarkdown>
        </div>
    </div>
);

export const TraceAgentBox: FC<TraceAgentBoxProps> = ({ agentId, initial, refined }) => {
    const hasInitial = Boolean(initial && initial.trim());
    const hasRefined = Boolean(refined && refined.trim());
    const [view, setView] = useState<'initial' | 'refined'>(hasRefined ? 'refined' : 'initial');
    const content = view === 'refined' ? (refined || '') : (initial || '');

    return (
        <div className={`agent-box agent-box-color-${agentId + 1}`}>
            <div className="agent-box-header">
                <span>Agent {agentId + 1}</span>
                <div className="response-toggle-group" role="group" aria-label={`Toggle Agent ${agentId + 1} response`}>
                    <button type="button" className={`response-toggle ${view === 'initial' ? 'active' : ''}`} onClick={() => setView('initial')} disabled={!hasInitial} aria-pressed={view === 'initial'} aria-label="Show initial response">Initial</button>
                    <button type="button" className={`response-toggle ${view === 'refined' ? 'active' : ''}`} onClick={() => setView('refined')} disabled={!hasRefined} aria-pressed={view === 'refined'} aria-label="Show refined response">Refined</button>
                </div>
            </div>
            <div className="agent-box-content">
                {content ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: ({ children }) => <>{children}</>, code: ({ children }) => <code>{children}</code> }}>{content}</ReactMarkdown> : <div className="placeholder">No response available</div>}
            </div>
        </div>
    );
};
