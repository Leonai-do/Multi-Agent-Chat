/**
 * @file A simple error boundary to prevent blank screens and show a friendly error state.
 */
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, message: String(error?.message || error) };
  }

  componentDidCatch(error: any, info: any) {
    // Log to console; in production, send to monitoring
    console.error('UI error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',padding:'1rem',textAlign:'center'}}>
          <div>
            <h2 style={{margin:'0 0 0.5rem'}}>Something went wrong</h2>
            <p style={{opacity:0.8, margin:0}}>Please reload the page. If the problem persists, check the console.</p>
            {this.state.message && (
              <pre style={{textAlign:'left',opacity:0.7,marginTop:'0.75rem',maxWidth:600,overflow:'auto'}}>{this.state.message}</pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

