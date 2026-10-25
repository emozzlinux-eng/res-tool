import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level crash guard. Without it, any render-time exception unmounts the
 * whole tree and leaves the user on a blank white screen (and on a PWA the
 * broken shell can even get cached). This keeps the app recoverable:
 * reload first (state is persisted), reset-onboarding as last resort.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Single place to hang real telemetry later (Sentry, etc.).
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetOnboarding = () => {
    try {
      localStorage.removeItem('inventoryPro_state');
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 40 }} role="img" aria-label="warning">
          ⚠️
        </span>
        <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
        <p style={{ opacity: 0.8, maxWidth: 340, margin: 0 }}>
          The app hit an unexpected error. Your data is saved locally — reloading usually fixes
          it.
        </p>
        <button type="button" className="btn btn-primary" onClick={this.handleReload}>
          Reload App
        </button>
        <button type="button" className="btn btn-ghost" onClick={this.handleResetOnboarding}>
          Reset &amp; start fresh
        </button>
        <details style={{ maxWidth: 340, textAlign: 'left', opacity: 0.6 }}>
          <summary style={{ cursor: 'pointer' }}>Error details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{String(this.state.error)}</pre>
        </details>
      </div>
    );
  }
}
