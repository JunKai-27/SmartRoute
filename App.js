// App.js
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context"; // ← add
import { AuthProvider } from "./context/AuthContext";
import RootNavigator from "./navigation/RootNavigator";
import {
  setupNotificationListeners,
} from "./utils/notifications";

export default function App() {
  useEffect(() => {
    const cleanup = setupNotificationListeners((data) => {
      console.log("📬 Notification data:", data);
    });
    return cleanup;
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}