import { Component, type ReactNode } from "react";

/**
 * Catches render-time JS errors and shows the message/stack on screen
 * instead of the WebView going blank. Capacitor's WebView crashes are far
 * less opaque than a native/JSI crash was on the earlier Expo build — a JS
 * exception here is always catchable — but this still beats an unstyled
 * white screen with nothing printed anywhere.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white p-4">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-bold text-destructive">Something went wrong</p>
            <p className="text-sm text-foreground">{this.state.error.message}</p>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{this.state.error.stack}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
