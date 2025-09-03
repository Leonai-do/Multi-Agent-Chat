/**
 * @file Renders a pre-formatted code block with a copy button.
 */
import React, { useState, FC, ReactNode } from 'react';

/**
 * Props for the CodeBlock component.
 * @property {ReactNode} [children] - The code content to be displayed.
 */
interface CodeBlockProps {
    children?: ReactNode;
}

/**
 * A component that wraps code content in a styled `pre` block
 * and provides a button to copy the content to the clipboard.
 *
 * @param {CodeBlockProps} props - The component props.
 * @returns {React.ReactElement} The rendered code block.
 */
const CodeBlock: FC<CodeBlockProps> = ({ children }) => {
  // State to track if the content has been copied
  const [copied, setCopied] = useState(false);
  // Prepare the text for copying by converting children to a string
  const textToCopy = String(children).replace(/\n$/, '');
  
  /**
   * Handles the copy button click event.
   * Writes the code text to the clipboard and updates the button state.
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };
  
  return (
    <div className="code-block-wrapper">
      <pre><code>{children}</code></pre>
      <button onClick={handleCopy} className="copy-button" aria-label="Copy code">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          {copied 
            ? <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/> 
            : <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-5zm0 16H8V7h11v14z"/>
          }
        </svg>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};

export default CodeBlock;