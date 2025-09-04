/**
 * @file This is the main entry point for the React application.
 * It imports the global styles, renders the root App component,
 * and mounts it to the DOM.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/components/App';
import ErrorBoundary from './src/components/ErrorBoundary';
import { hookConsoleAndNetwork } from './src/state/consoleCapture';

// Find the root DOM element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find the root element to mount the application.");
}

// Create a React root and render the App component
// Hook console and network logging early
try { hookConsoleAndNetwork(); } catch {}

// Defensive: ensure a global placeholder exists to avoid stray ReferenceErrors in runtime
try { (window as any).agentNames = (window as any).agentNames || []; } catch {}

const root = createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
