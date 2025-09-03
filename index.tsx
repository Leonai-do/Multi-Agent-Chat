/**
 * @file This is the main entry point for the React application.
 * It imports the global styles, renders the root App component,
 * and mounts it to the DOM.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/components/App';

// Find the root DOM element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find the root element to mount the application.");
}

// Create a React root and render the App component
const root = createRoot(rootElement);
root.render(<App />);