import React from "react";

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "#a00", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          <h2 style={{ color: "#a00" }}>App crashed</h2>
          <pre>{this.state.error.stack ?? this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })}>Reset</button>
        </div>
      );
    }
    return this.props.children;
  }
}
