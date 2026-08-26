"use client";

import { Component } from "react";

export default class ToolErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    this.setState({ hasError: true });
    // Log for debugging without crashing parent
    if (typeof console !== "undefined") {
      console.error("[ToolErrorBoundary] caught error:", error, info);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.toolId !== this.props.toolId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass"
          style={{ padding: 24, maxWidth: 720, margin: "40px auto" }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-1)",
              marginBottom: 8,
            }}
          >
            Something went wrong in this tool.
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--text-3)",
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            Your progress is safe. Try reloading this section.
          </div>
          <button
            className="btn-ghost"
            onClick={() => this.setState({ hasError: false })}
          >
            Reload tool
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
