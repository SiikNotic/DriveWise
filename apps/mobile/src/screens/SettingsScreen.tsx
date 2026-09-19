import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { colors } from "../theme";

export function SettingsScreen({ email }: { email: string | undefined }) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <Pressable style={styles.signOutButton} onPress={() => void supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "700", color: colors.foreground },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  label: { fontSize: 12, color: colors.mutedForeground },
  email: { fontSize: 16, color: colors.foreground, fontWeight: "600" },
  signOutButton: { borderRadius: 10, borderWidth: 1, borderColor: colors.destructive, paddingVertical: 14, alignItems: "center" },
  signOutText: { color: colors.destructive, fontSize: 16, fontWeight: "600" },
});
