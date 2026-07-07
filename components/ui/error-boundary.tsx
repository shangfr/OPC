"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-muted/50 p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            组件渲染出错
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {this.state.error?.message || "该组件遇到了未知错误。"}
          </p>
          <button
            className="mt-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            onClick={() => this.setState({ hasError: false, error: null })}
            type="button"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
