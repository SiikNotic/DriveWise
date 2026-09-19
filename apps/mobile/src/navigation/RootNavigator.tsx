import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useSession } from "../hooks/use-session";
import { LoginScreen } from "../screens/LoginScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { TrackingScreen } from "../screens/TrackingScreen";
import { TripsScreen } from "../screens/TripsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme";
import type { AuthStackParamList, AppStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs = createBottomTabNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator({ userId, email }: { userId: string; email: string | undefined }) {
  return (
    <AppTabs.Navigator
      screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}
    >
      <AppTabs.Screen name="Tracking">{() => <TrackingScreen userId={userId} />}</AppTabs.Screen>
      <AppTabs.Screen name="Trips">{() => <TripsScreen userId={userId} />}</AppTabs.Screen>
      <AppTabs.Screen name="Settings">{() => <SettingsScreen email={email} />}</AppTabs.Screen>
    </AppTabs.Navigator>
  );
}

/**
 * Switches between the auth flow and the tracking app based on Supabase
 * session state — the mobile equivalent of apps/web's (auth)/(app) route
 * groups, just done in-memory instead of via the URL.
 */
export function RootNavigator() {
  const { session, loaded } = useSession();

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? (
        <AppNavigator userId={session.user.id} email={session.user.email} />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
