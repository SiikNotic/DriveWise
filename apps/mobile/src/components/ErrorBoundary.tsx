import { Component, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * The device-level crash the driver sees ("DriveWise closed because this
 * app has a bug") comes from Android's generic fatal-error handler and
 * carries zero information back to us — there is no way to attach a
 * debugger to a driver's phone. This boundary exists purely so that a
 * *render-time* JS error shows its message on screen instead of taking the
 * whole app down silently, turning an unreported crash into something a
 * driver can screenshot and send back.
 *
 * It cannot catch errors outside React's render/commit phases (event
 * handlers, timers, native-module exceptions) — see the try/catch in
 * TrackingScreen's handlers and the global handler in App.tsx for those.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{this.state.error.message}</Text>
            <Text style={styles.stack}>{this.state.error.stack}</Text>
          </View>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 16, backgroundColor: "#fff" },
  card: { gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#b91c1c" },
  message: { fontSize: 14, color: "#111827" },
  stack: { fontSize: 11, color: "#6b7280", fontFamily: "monospace" },
});
