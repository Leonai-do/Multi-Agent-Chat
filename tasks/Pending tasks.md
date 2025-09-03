[ - ] 1- Add multi-line support to the app, when the users are writing a message, they must be able to write multiple lines of text by using ctl+enter or shit+enter, and send the message by using enter.

[ - ] 2- Add an stop button to stop the generation of the response from the agents.

[ - ] 3- Add file upload support to each, specific agent, to provide any image, if the target model supports it, pdf, text or code file that the agents can use to answer the user query.

[ - ] 4- Add file upload support to the app, to provide any pdf, text or code file that the agents can use to answer the user query.

[ - ] 5- Add a copy button for both inital and refined response from the agents, in the agent box, and in the collaboration trace view.

[ + ] 6- Add thinking visibility to the app, so when any model that supports thinking, is thinking, the user can see the thinking process of the model, and the app shows the user the thinking process of the model, and then the user can see the final answer of the model in a separate box.

[ X ] 7- @/home/leonai-do/LeonAI_DO/dev/Multi-Agent Gemini Chat/Docs/Pending tasks.md Based on these pending tasks, please analyze the file and make a plan for all UI/UX improvements, just those for now, after that, please tell me your thougths on them, what can you do to make the app more usable, with soft animations, with transparent floating boxes, but being efficient with server and browser loading and memory and CPU efficient.

I need the app to become more simplistic, while being a better experience for the users throuhout the complete usage of the app.

I also need you to make a detailed plan to divide each file where the content is very long like the @/home/leonai-do/LeonAI_DO/dev/Multi-Agent Gemini Chat/index.css , reduce the lines by dividing the file into more manageable components to achieve a better mantainability and ease of debuging and refactor, while saving time to modify without needing to read the whole file at once.

[ X ] 8- Add internet support to the multi chat app

[ - ] 9- Fix the text rendering in the multi chat app
 
[ - ] 10- Add a copy button for both inital and refined response from the agents

[ - ] 11- Add an agent number definition to the app, to add more to the team

[ - ] 12- Fix the horizontal scroll bar to make all line show when raw content is displayed

[ - ] 13- Add more colors with a color pallete for the themes

[ + ] 14- Add visibility to the thinking mechanism of the models

[ - ] 15- Add different model providers to the app

[ - ] 16- Add a better UI with clear icon or logo, name and separation between new conversation and the conversation list, the new conversation button must be shorter and separated from the header, but on the top of the UI

[ + ] 17- Add Internet Support: Useful, but you’ll want a tool layer + server proxy to avoid leaking API keys. Approach: add a “tools” adapter (search, fetch page, cite) and pass retrieved snippets into prompts. UI: toggle in settings with “include web results” and “max sources”. Note: this front‑end only app needs a small backend for search APIs.

[ - ] 18- Fix Text Rendering: Tidy up Markdown and raw view. Specifically change raw view to use horizontal scroll instead of wrapping: index.css:633 uses white-space: pre-wrap; prefer white-space: pre; overflow-x: auto. Tables/links can render better by styling table elements and adding target="_blank" for links via ReactMarkdown components in src/components/MessageItem.tsx.

[ - ] 19- Copy Buttons for Initial/Refined: Straightforward. Add a copy button to agent boxes in both live and trace views: src/components/AgentBox.tsx (both AgentBox and TraceAgentBox). Reuse the logic in src/components/CodeBlock.tsx for consistent UX.

[ - ] 20- Raw View Horizontal Scroll: See item 9. Change index.css:633-642 to white-space: pre; overflow-x: auto; so long lines don’t wrap/crop. The CSS module version src/components/MessageItem.module.css already has the correct pattern; the app uses global CSS now.

[ - ] 21- More Theme Colors: You already centralize tokens in index.css and src/styles/global.css. Add accent palettes (e.g., brand, neutral, solarized variants) and expose them in src/components/ThemeSwitcher.tsx as selectable presets. Also add more agent colors and map --agent-N-color dynamically based on team size.

[ + ] 22- Thinking Visibility: Two parts: status + streaming. Status is there (“writing”, “refining”) in live view. Consider switching to streaming for token‑by‑token updates if the API supports it, and show per‑agent progress/timers. Avoid exposing chain‑of‑thought; instead show “reasoning in progress” intents and high‑level steps.

[ - ] 23- Different Model Providers: Worth it. Add a provider interface (generate, model, systemInstruction) and adapters for Google, OpenAI, Anthropic, etc. Settings should allow selecting provider/model and configuring API keys (prefer backend storage). Centralize the client in a src/llm/provider.ts to decouple UI from SDKs.

[ - ] 24- Better UI Structure: Tighter header (logo/name), smaller “New Chat” button separated above the chat list, clearer sectioning. A compact top bar + sidebar grouping would improve scanability. Add per‑message actions grouping and more visual separation for collaboration trace.
Refactors & Fixes (Codebase‑Specific)

[ + ] 25- Remove hard‑coded agent count: Replace Array(4) with a derived count or setting in src/components/App.tsx:40,100 and src/components/SettingsModal.tsx:65. Also adjust prompts that say “four agents.”
Unify styling approach: The app uses global CSS (index.css) while CSS modules exist but aren’t imported (src/components/*.module.css, src/styles/global.css). Choose one approach (likely global, given index.html) and delete unused modules to reduce confusion.

[ - ] 26- Agent Number Definition: Good enhancement. The agent count is hard‑coded in multiple places: src/components/App.tsx:40,100, src/components/SettingsModal.tsx:65. Introduce AGENT_COUNT in src/constants.ts (or a setting), derive state arrays from it, and update SettingsModal to render dynamic instruction editors.

[ - ] 27- Raw text view wrapping: Update index.css:633-642 as noted to use horizontal scroll. This addresses the “all line show” feedback for raw content.

[ - ] 28- Consistent Markdown rendering: In src/components/MessageItem.tsx, consider adding components for links (a), tables, and list spacing. For Agent live/trace (src/components/AgentBox.tsx), you currently override pre → fragment; that can break code block layout. Prefer consistent pre/code blocks with the same rules used in messages.

[ - ] 29- Provider abstraction: Extract Gemini calls out of src/components/App.tsx into a provider. This simplifies adding providers (item 15) and testing. Also enables adding tools (item 8) without touching UI.
[ - ] 30- Abort/stop generation: Wire AbortController through the provider so a “Stop” button can cancel in‑flight calls; aligns with better UX and prevents duplicate updates.

[ - ] 31- Batch state updates: Inside runAgentCollaboration you call setCurrentCollaborationState multiple times during Promise.all. Consider buffering updates per agent and applying in fewer renders to reduce UI churn.
Settings extensibility: src/components/SettingsModal.tsx currently manages only initial instructions. Make it data‑driven so it can handle agent count, model/provider selection, and toggles for web tools without new component logic.

[ + ] 32- Title generation robustness: The title prompt is fine; consider truncation/sanitization and a small debounce or retry given occasional transient errors.

[ X ] 33- Build path clarity: You have both Vite and a CDN import map setup (index.html). Ensure local dev and deployment paths are aligned (either bundle with Vite and drop CDN import map, or clearly document both paths).

[ - ] 34- Export/import chats: Add JSON export/import for localStorage data to aid portability.

[ - ] 35- Keyboard UX: Shift+Enter for newline, Cmd/Ctrl+Enter to send, Esc to close modals.

[ - ] 36- Message actions: Add “Regenerate” for last turn, “Copy all” for model messages, and “Delete message”.

[ - ] 37- Syntax highlighting: Add rehype-highlight for code blocks in Markdown.
Virtualized message list: For long histories, use list virtualization to keep scrolling smooth.

[ + ] 38- Accessibility: Ensure buttons have clear labels (many do), and improve focus rings for keyboard navigation.

[ - ] 39- Error surfacing: Replace generic error message with a visible banner that suggests checking settings/API keys.

[ - ] 40- Analytics/telemetry (optional): Basic client‑side metrics for generation duration per agent and errors.

[ - ] 41- Make the agent's instruction box collapsable, separate their names in the boxes by adding a padding, since the names are too close to the content. of the box.