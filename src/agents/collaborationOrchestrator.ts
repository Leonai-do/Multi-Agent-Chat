/**
 * @file This file contains the core logic for the multi-agent collaboration process.
 */
import { GoogleGenAI } from '@google/genai';
import type { Chat, Message, LiveAgentState, CollaborationTrace, Source } from '../types';
import { LS_PROVIDER_GLOBAL, LS_PROVIDER_PER_AGENT, LS_MODEL_GLOBAL, LS_MODEL_PER_AGENT, getIncludeWebResults, getMaxWebSources } from '../config';
import { getProvider } from '../llm/registry';
import type { ProviderName } from '../llm/provider';
import { addLog, logEvent } from '../state/logs';
import { MODEL_NAME, REFINEMENT_SYSTEM_INSTRUCTION, SYNTHESIZER_SYSTEM_INSTRUCTION, SELF_CRITIQUE_SYSTEM_INSTRUCTION } from '../constants';

export const runAgentCollaboration = async (
    prompt: string,
    chatId: string,
    isNewChat: boolean,
    agentCount: number,
    {
        setIsLoading,
        setShowCollaboration,
        setLoadingMessage,
        setProgressDone,
        setProgressTotal,
        setCurrentCollaborationState,
        setChats,
        pushNotice,
        setRunStartTs,
        internetEnabled,
        agentInstructions,
        agentNames,
        chats,
        activeChatId,
        generationControllerRef,
        aiRef,
    }: any
): Promise<string> => {
    // Begin a new generation run and create an abort signal
    const runToken = generationControllerRef.current.start();
    try { logEvent('pipeline','info','run_start', { runId: String(runToken), chatId, prompt, internetEnabled }); } catch {} // eslint-disable-line no-empty
    setRunStartTs(Date.now());
    const signal = generationControllerRef.current.signal;
    setIsLoading(true);
    setShowCollaboration(true);
    setLoadingMessage('');
    setProgressDone(0);
    
    if (agentCount === 1) {
        setProgressTotal((internetEnabled ? 1 : 0) + 3);
    } else {
        setProgressTotal((internetEnabled ? 1 : 0) + agentCount + agentCount + 1);
    }

    let webContext = '';
    let sources: Source[] = [];
    // Defensive: resolve agent names fallback to avoid runtime ReferenceError in templates
    const namesLocal: string[] = (Array.isArray(agentNames) && agentNames.length)
      ? agentNames
      : Array(agentCount).fill('').map((_, i) => `Agent ${i + 1}`);
    // Load provider/model preferences
    const count = agentCount;
    let globalProvider: 'gemini'|'groq' = 'gemini';
    let perAgentProviders: Array<'gemini'|'groq'> = Array(count).fill('gemini');
    let globalModel: string | undefined = undefined;
    let perAgentModels: string[] = Array(count).fill('');
    try {
      const gp = (localStorage.getItem(LS_PROVIDER_GLOBAL) as any) || 'gemini';
      const pa = JSON.parse(localStorage.getItem(LS_PROVIDER_PER_AGENT) || '[]');
      const gm = localStorage.getItem(LS_MODEL_GLOBAL) || '';
      const pam = JSON.parse(localStorage.getItem(LS_MODEL_PER_AGENT) || '[]');
      globalProvider = (gp === 'groq') ? 'groq' : 'gemini';
      perAgentProviders = Array(count).fill(globalProvider).map((v, i) => (pa[i] === 'groq' ? 'groq' : (pa[i] === 'gemini' ? 'gemini' : globalProvider)));
      globalModel = gm || undefined;
      perAgentModels = Array(count).fill(globalModel || '').map((v, i) => pam[i] || v);
    } catch {} // eslint-disable-line no-empty

    // Step 0: Perform web search if internet is enabled
    if (internetEnabled) {
      setLoadingMessage('Searching the web...');
      try {
        const fetchWithRetry = async (attempts = 3): Promise<Response> => {
          let last: Response | null = null;
          for (let i = 1; i <= attempts; i++) {
            last = await fetch('/api/tools/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: prompt,
                search_depth: 'basic',
                include_raw_content: true,
                max_results: 3,
              }),
              signal: generationControllerRef.current.signal,
            });
            if (last.ok) return last;
            // 5xx: backoff and retry
            if (last.status >= 500 && i < attempts) {
              await new Promise(r => setTimeout(r, 300 * i));
              continue;
            }
            return last!;
          }
          
          return last!;
        };
        const response = await fetchWithRetry(3);
        if (!response.ok) throw new Error(`Web search error: ${response.status} ${response.statusText}`);
        const searchData = await response.json();
        
        const maxSources = getMaxWebSources();
        sources = (searchData.results || []).slice(0, maxSources).map((r: any): Source => ({
            title: r.title,
            url: r.url,
            content: r.raw_content || '',
        })).filter(s => s.content);

        if (sources.length > 0) {
            webContext = "Here is some context from a web search. Use this to inform your answer:\n\n" + 
                sources.map((s, i) => `Source [${i + 1}] (${s.title}):\n${s.content}`).join('\n\n---\n\n');
        }
      } catch (e: any) {
          console.error("Failed to fetch from Tavily API", e);
          if (e?.name === 'AbortError' || signal.aborted) {
            // Silent cancel
          } else {
            const advice = e?.message?.includes('500') ? 'Ensure the server has TAVILY_API_KEY configured (see Settings → Providers & Models notes) and try again.' : '';
            const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: `Sorry, I couldn't search the web. ${e.message}${advice ? `\n\nHint: ${advice}` : ''}` }] };
            setChats((prev: Chat[]) => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
            try { logEvent('pipeline','error','web_search_failed', { runId: String(runToken), error: e?.message || String(e) }); } catch {} // eslint-disable-line no-empty
          }
          setIsLoading(false);
          // keep workspace content as-is on abort/error; just reset progress
          setLoadingMessage('');
          setProgressDone(0);
          setProgressTotal(0);
          generationControllerRef.current.finish(runToken);
          return '';
      }
      // web search finished successfully
      setProgressDone((d: number) => d + 1);
      try { logEvent('pipeline','info','web_search_done', { runId: String(runToken), sources: sources.length }); } catch {} // eslint-disable-line no-empty
    }
    
    setLoadingMessage('Agents are collaborating...');
    try { addLog('info', 'Phase started', { phase: 'initial' }); } catch {} // eslint-disable-line no-empty
    try { logEvent('pipeline','info','phase_start', { runId: String(runToken), phase: 'initial' }); } catch {} // eslint-disable-line no-empty
    // Initialize live agent state for the UI
    const initialAgents: LiveAgentState[] = Array.from({ length: agentCount }, (_, i) => ({ id: i, status: 'initializing', response: '' }));
    setCurrentCollaborationState(initialAgents);
    let finalText = '';
    
    // Note: We no longer require GoogleGenAI client to run the pipeline.
    // Providers handle generation; the Google client is only used optionally for title.
      
    try {
        if (agentCount === 1) {
            // Single-agent workflow
            const agent = initialAgents[0];
            const provider = perAgentProviders[0] || globalProvider;
            const model = perAgentModels[0] || globalModel || MODEL_NAME;
            const sys = `You are ${namesLocal[0]}. ${agentInstructions[0]}`;
            const pName = provider as ProviderName;
            const p = getProvider(pName);
            if (!p) throw new Error(`Provider not registered: ${pName}`);

            // Initial Response
            setLoadingMessage('Writing initial response...');
            setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, status: 'writing', response: '' } : a));
            const promptForAgent = webContext ? `${webContext}\n\nBased on the context above, please answer the following user query:\n${prompt}` : prompt;
            const initialResponse = await p.generateText({ model, prompt: promptForAgent, system: sys, signal });
            setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: initialResponse, status: 'done' } : a));
            setProgressDone((d: number) => d + 1);

            // Self-Critique
            setLoadingMessage('Performing self-critique...');
            setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, status: 'refining' } : a));
            const critiquePrompt = `Your response was: "${initialResponse}"`;
            const critiqueResponse = await p.generateText({ model, prompt: critiquePrompt, system: SELF_CRITIQUE_SYSTEM_INSTRUCTION, signal });
            setProgressDone((d: number) => d + 1);

            // Refined Answer
            setLoadingMessage('Generating refined answer...');
            const refinedResponse = critiqueResponse;
            setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: refinedResponse, status: 'done' } : a));
            setProgressDone((d: number) => d + 1);

            const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: refinedResponse }], collaborationTrace: { initialResponses: [initialResponse], refinedResponses: [refinedResponse] }, sources: sources.length > 0 ? sources : undefined, createdAt: Date.now(), provider, model };
            setChats((prev: Chat[]) => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMessage] } : c));
            finalText = refinedResponse;

        } else {
            // Multi-agent workflow
            const promptForAgents = webContext ? `${webContext}\n\nBased on the context above, please answer the following user query:\n${prompt}` : prompt;
      
            // Step 1: Get initial responses sequentially (one agent at a time)
            const initialResponses: string[] = Array(initialAgents.length).fill('');
            for (const agent of initialAgents) {
              if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              setLoadingMessage(`Writing: Agent ${agent.id + 1}/${agentCount}`);
              const provider = perAgentProviders[agent.id] || globalProvider;
              const model = perAgentModels[agent.id] || globalModel || MODEL_NAME;
              const sys = `You are ${namesLocal[agent.id]}. ${agentInstructions[agent.id]}`;
              const pName = provider as ProviderName;
              const p = getProvider(pName);
              if (!p) throw new Error(`Provider not registered: ${pName}`);
              setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, status: 'writing', response: '' } : a));
              try { logEvent('pipeline','info','agent_step_start', { runId: String(runToken), phase: 'initial', agentId: agent.id, provider, model }); } catch {} // eslint-disable-line no-empty
              let text = '';
              const canStream = !!(p.capabilities?.streaming && typeof p.generateStream === 'function');
              // Per-step timeout (25s) to avoid hanging on network issues
              const stepController = new AbortController();
              const stepTimer = setTimeout(() => { try { stepController.abort(); } catch {} }, 25000);
              const stepSignal = (AbortSignal as any)?.any ? (AbortSignal as any).any([generationControllerRef.current.signal, stepController.signal]) : stepController.signal;
              try {
                if (canStream) {
                  let acc = '';
                  let chunkCount = 0;
                  for await (const chunk of p.generateStream({ model, prompt: promptForAgents, system: sys, signal: stepSignal })) {
                    if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                    clearTimeout(stepTimer); // first chunk arrived
                    acc += chunk || '';
                    chunkCount++;
                    const safeAcc = acc;
                    setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: safeAcc } : a));
                    try { logEvent('pipeline','debug','agent_step_chunk', { runId: String(runToken), phase: 'initial', agentId: agent.id, chunkLen: (chunk||'').length, chunks: chunkCount }); } catch {} // eslint-disable-line no-empty
                  }
                  text = acc;
                } else {
                  text = await p.generateText({ model, prompt: promptForAgents, system: sys, signal: stepSignal });
                  if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                  clearTimeout(stepTimer);
                  setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
                }
              } catch (e: any) {
                clearTimeout(stepTimer);
                if (generationControllerRef.current.signal.aborted) throw e; // global abort
                // Per-step timeout or fetch error: record and continue with next agent
                try { addLog('error', 'Initial step failed', { agent: agent.id, error: e?.message || String(e) }); } catch {} // eslint-disable-line no-empty
                text = '';
                setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
              }
              setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, status: 'done' } : a));
              setProgressDone((d: number) => d + 1);
              addLog('debug', 'Initial response', { agent: agent.id, provider, model, length: text.length });
              try { logEvent('pipeline','info','agent_step_done', { runId: String(runToken), phase: 'initial', agentId: agent.id, length: text.length }); } catch {} // eslint-disable-line no-empty
              initialResponses[agent.id] = text;
            }
            
            // Step 2: Get refined responses sequentially
            try { addLog('info', 'Phase started', { phase: 'refinement-sequential' }); } catch {} // eslint-disable-line no-empty
            try { logEvent('pipeline','info','phase_start', { runId: String(runToken), phase: 'refinement' }); } catch {} // eslint-disable-line no-empty
            // Collect refined responses for each agent
            const refinedResponses: string[] = Array(initialAgents.length).fill('');
            for (const agent of initialAgents) {
              if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              setLoadingMessage(`Refining: Agent ${agent.id + 1}/${agentCount}`);
              const provider = perAgentProviders[agent.id] || globalProvider;
              const model = perAgentModels[agent.id] || globalModel || MODEL_NAME;
              const otherResponses = initialResponses.map((resp, i) => `Response from Agent ${i + 1}:\n${resp}`).join('\n\n---\n\n');
              const refinementPrompt = `Your original instruction was: "You are ${namesLocal[agent.id]}. ${agentInstructions[agent.id]}"

Here are the initial responses from all ${agentCount} agents, including your own:

${otherResponses}

Please critically evaluate all responses. Identify weaknesses, inconsistencies, or factual errors. Then, generate a new, superior response that improves upon these initial drafts.`;
              const pName = provider as ProviderName;
              const p = getProvider(pName);
              if (!p) throw new Error(`Provider not registered: ${pName}`);
              setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, status: 'refining', response: '' } : a));
              try { logEvent('pipeline','info','agent_step_start', { runId: String(runToken), phase: 'refinement', agentId: agent.id, provider, model }); } catch {} // eslint-disable-line no-empty
              let text = '';
              const canStream = !!(p.capabilities?.streaming && typeof p.generateStream === 'function');
              const stepController = new AbortController();
              const stepTimer = setTimeout(() => { try { stepController.abort(); } catch {} }, 25000);
              const stepSignal = (AbortSignal as any)?.any ? (AbortSignal as any).any([generationControllerRef.current.signal, stepController.signal]) : stepController.signal;
              try {
                if (canStream) {
                  let acc = '';
                  let chunkCount = 0;
                  for await (const chunk of p.generateStream({ model, prompt: refinementPrompt, system: REFINEMENT_SYSTEM_INSTRUCTION, signal: stepSignal })) {
                    if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                    clearTimeout(stepTimer);
                    acc += chunk || '';
                    chunkCount++;
                    const safeAcc = acc;
                    setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: safeAcc } : a));
                    try { logEvent('pipeline','debug','agent_step_chunk', { runId: String(runToken), phase: 'refinement', agentId: agent.id, chunkLen: (chunk||'').length, chunks: chunkCount }); } catch {} // eslint-disable-line no-empty
                  }
                  text = acc;
                } else {
                  text = await p.generateText({ model, prompt: refinementPrompt, system: REFINEMENT_SYSTEM_INSTRUCTION, signal: stepSignal });
                  if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                  clearTimeout(stepTimer);
                  setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
                }
              } catch (e: any) {
                clearTimeout(stepTimer);
                if (generationControllerRef.current.signal.aborted) throw e;
                try { addLog('error', 'Refine step failed', { agent: agent.id, error: e?.message || String(e) }); } catch {} // eslint-disable-line no-empty
                text = '';
                setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, response: text } : a));
              }
              setCurrentCollaborationState((prev: LiveAgentState[]) => prev.map(a => a.id === agent.id ? { ...a, status: 'done' } : a));
              setProgressDone((d: number) => d + 1);
              addLog('debug', 'Refined response', { agent: agent.id, provider, model, length: text.length });
              try { logEvent('pipeline','info','agent_step_done', { runId: String(runToken), phase: 'refinement', agentId: agent.id, length: text.length }); } catch {} // eslint-disable-line no-empty
              refinedResponses[agent.id] = text;
            }
            
            // Step 3: Get the final synthesized response from the fifth agent
            const sourceListForSynthesizer = sources.map((s, i) => `Source [${i + 1}]: ${s.url}`).join('\n');

            const finalPrompt = `Here are the refined responses from the agent team:\n\n${refinedResponses.map((r, i) => `Refined Response from Agent ${i + 1}:\n${r}`).join('\n\n---\n\n')}\n\n${sourceListForSynthesizer ? `Use these sources for citation:\n${sourceListForSynthesizer}\n\n` : ''}Synthesize these into a single, final, comprehensive answer for the user. Remember to add citations like [1], [2] etc. where appropriate.`;
            if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            
            let streamedFinal = false;
            const finalProvider = globalProvider;
            const finalModel = globalModel || MODEL_NAME;
            {
              const p = getProvider(finalProvider as ProviderName);
              if (!p) throw new Error(`Provider not registered: ${finalProvider}`);
              try { addLog('info', 'Phase started', { phase: 'final' }); } catch {} // eslint-disable-line no-empty
              try { logEvent('pipeline','info','phase_start', { runId: String(runToken), phase: 'final' }); } catch {} // eslint-disable-line no-empty
              setLoadingMessage('Synthesizing final answer...');
              if (p.capabilities?.streaming && typeof p.generateStream === 'function') {
                streamedFinal = true;
                let acc = '';
                const stepController = new AbortController();
                const stepTimer = setTimeout(() => { try { stepController.abort(); } catch {} }, 30000);
                const stepSignal = (AbortSignal as any)?.any ? (AbortSignal as any).any([generationControllerRef.current.signal, stepController.signal]) : stepController.signal;
                let finalMessageId: string | null = null;
                let chunkCount = 0;
                for await (const chunk of p.generateStream({ model: finalModel, prompt: finalPrompt, system: SYNTHESIZER_SYSTEM_INSTRUCTION, signal: stepSignal })) {
                  if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                  clearTimeout(stepTimer);
                  acc += chunk || '';
                  chunkCount++;
                  const textNow = acc;
                  if (!finalMessageId) {
                    // Create a provisional message and append it to chat
                    finalMessageId = (Date.now() + Math.floor(Math.random() * 1000)).toString();
                    const provisional: Message = { id: finalMessageId, role: 'model', parts: [{ text: textNow }], createdAt: Date.now(), provider: finalProvider, model: finalModel };
                    setChats((prev: Chat[]) => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, provisional] } : c));
                    try { logEvent('chat','info','message_add', { runId: String(runToken), chatId, messageId: finalMessageId, type: 'provisional_final' }); } catch {} // eslint-disable-line no-empty
                  } else {
                    // Update existing provisional message text
                    const idToUpdate = finalMessageId;
                    setChats((prev: Chat[]) => prev.map(c => {
                      if (c.id !== chatId) return c;
                      return {
                        ...c,
                        messages: c.messages.map(m => m.id === idToUpdate ? { ...m, parts: [{ text: textNow }] } : m)
                      };
                    }));
                  }
                  try { logEvent('pipeline','debug','final_chunk', { runId: String(runToken), chunkLen: (chunk||'').length, chunks: chunkCount }); } catch {} // eslint-disable-line no-empty
                }
                finalText = acc;
                // Attach trace and sources to the provisional message if it exists
                if (finalMessageId) {
                  const idToUpdate = finalMessageId;
                  const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
                  setChats((prev: Chat[]) => prev.map(c => {
                    if (c.id !== chatId) return c;
                    return {
                      ...c,
                      messages: c.messages.map(m => m.id === idToUpdate ? { ...m, collaborationTrace, sources: sources.length > 0 ? sources : undefined } : m)
                    };
                  }));
                  try { logEvent('chat','info','message_update', { runId: String(runToken), chatId, messageId: finalMessageId, attach: ['collaborationTrace','sources'] }); } catch {} // eslint-disable-line no-empty
                }
              } else {
                finalText = await p.generateText({ model: finalModel, prompt: finalPrompt, system: SYNTHESIZER_SYSTEM_INSTRUCTION, signal: generationControllerRef.current.signal });
                if (generationControllerRef.current.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              }
              addLog('info', 'Final synthesized response', { provider: finalProvider, model: finalModel, length: finalText.length });
              try { logEvent('pipeline','info','final_done', { runId: String(runToken), length: finalText.length }); } catch {} // eslint-disable-line no-empty
            }
            setProgressDone((d: number) => d + 1);
            
            // If we didn't stream into an existing provisional message, append now
            if (!streamedFinal) {
              const collaborationTrace: CollaborationTrace = { initialResponses, refinedResponses };
              const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: finalText }], collaborationTrace, sources: sources.length > 0 ? sources : undefined, createdAt: Date.now(), provider: finalProvider, model: finalModel };
              setChats((prev: Chat[]) => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMessage] } : c));
              try { logEvent('chat','info','message_add', { runId: String(runToken), chatId, messageId: modelMessage.id, type: 'final' }); } catch {} // eslint-disable-line no-empty
            }
        }

    } catch (error) {
      if ((error as any)?.name === 'AbortError' || signal.aborted) {
        // User aborted; keep partial content and workspace as-is
        try { logEvent('pipeline','warn','run_aborted', { runId: String(runToken), reason: (error as any)?.message || 'Abort' }); } catch {} // eslint-disable-line no-empty
      } else {
        console.error("An error occurred during agent collaboration:", error);
        // push notice and log
        try { addLog('error', 'Run failed', { error: (error as any)?.message || String(error) }); } catch {} // eslint-disable-line no-empty
        try { logEvent('pipeline','error','run_failed', { runId: String(runToken), error: (error as any)?.message || String(error) }); } catch {} // eslint-disable-line no-empty
        try { pushNotice('error', `Run failed: ${(error as any)?.message || String(error)}`); } catch {} // eslint-disable-line no-empty
        const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', parts: [{ text: 'Sorry, something went wrong. Please check the console for details.' }], createdAt: Date.now() };
        setChats((prev: Chat[]) => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
        try { logEvent('chat','info','message_add', { chatId, messageId: errorMessage.id, type: 'error' }); } catch {} // eslint-disable-line no-empty
      }
    } finally {
      setIsLoading(false);
      // If aborted, keep currentCollaborationState so partials remain visible
      if (!signal.aborted) {
        setCurrentCollaborationState([]);
        setLoadingMessage('');
      }
      setProgressDone(0);
      setProgressTotal(0);
      generationControllerRef.current.finish(runToken);
      setRunStartTs(null);
      try { pushNotice('success', 'Processing done'); } catch {} // eslint-disable-line no-empty
      try { addLog('info', 'Run finished'); } catch {} // eslint-disable-line no-empty
      try { logEvent('pipeline','info','run_finish', { runId: String(runToken) }); } catch {} // eslint-disable-line no-empty
      try {
        const chat = chats.find((c: Chat) => c.id === chatId);
        if (chat) logEvent('chat','info','snapshot', { chatId, chat });
      } catch {} // eslint-disable-line no-empty
    }
    return finalText;
  };