import React from 'react';

class LeagueErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('[LeagueErrorBoundary] Caught error in League tab:', error);
    console.error('[LeagueErrorBoundary] Error info:', errorInfo);
    
    // Store error details in state
    this.setState({
      error,
      errorInfo,
      hasError: true
    });
  }

  handleRetry = () => {
    // Reset error state and increment retry count
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
          <div className="flex flex-col justify-center items-center min-h-[200px]">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              League Tab Error
            </h3>
            <p className="text-text-secondary text-center mb-4 max-w-md">
              Something went wrong loading the League standings. This might be a temporary issue with data loading or network connectivity.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-primary text-text-primary rounded-md font-semibold hover:bg-primary/80 transition-colors"
              >
                🔄 Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary border border-border-secondary rounded-md hover:bg-bg-primary transition-colors"
              >
                🔁 Reload Page
              </button>
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 w-full">
                <summary className="cursor-pointer text-text-muted text-sm mb-2">
                  🔧 Developer Details (click to expand)
                </summary>
                <div className="bg-bg-tertiary p-3 rounded-md border border-border-secondary text-xs font-mono">
                  <div className="text-red-400 mb-2">
                    <strong>Error:</strong> {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <div className="text-text-muted">
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                  <div className="text-text-muted mt-2">
                    <strong>Retry Count:</strong> {this.state.retryCount}
                  </div>
                </div>
              </details>
            )}
            
            <p className="text-xs text-text-muted text-center mt-4">
              If this issue persists, try refreshing the page or check your internet connection.
              The workout feed below should still work normally.
            </p>
          </div>
        </div>
      );
    }

    // Normal render - pass through children with retry count as key to force remount
    return React.cloneElement(this.props.children, { 
      key: `league-${this.state.retryCount}` 
    });
  }
}

export default LeagueErrorBoundary; 