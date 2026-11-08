import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: if a bug crashes the UI, show a message instead of a
 * blank window. Data is saved after every change, so nothing is lost.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24 }}>
        <div
          style={{
            maxWidth: 520,
            padding: 32,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 26,
            boxShadow: 'var(--shadow)',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Hoppla – da ist etwas schiefgelaufen</h1>
          <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>
            Deine Daten sind sicher gespeichert. Starte die Ansicht neu, um weiterzumachen.
          </p>
          <pre
            className="selectable"
            style={{
              padding: 12,
              background: 'var(--surface-2)',
              borderRadius: 10,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              color: 'var(--text-2)',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="btn btn--primary btn--md"
            style={{ marginTop: 16 }}
            onClick={() => window.location.reload()}
          >
            Neu laden
          </button>
        </div>
      </div>
    );
  }
}
