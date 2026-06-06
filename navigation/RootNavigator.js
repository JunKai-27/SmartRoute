// navigation/RootNavigator.js
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import PendingApprovalScreen from "../screens/PendingApprovalScreen";
import DriverPlaceholder from "../screens/placeholders/DriverPlaceholder";
import AdminPlaceholder from "../screens/placeholders/AdminPlaceholder";
import QRScannerScreen from "../screens/driver/QRScannerScreen";
import RouteScreen from "../screens/driver/RouteScreen";
import MapScreen from "../screens/driver/MapScreen";

const Stack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function PendingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="PendingApproval"
        component={PendingApprovalScreen}
      />
    </Stack.Navigator>
  );
}

function DriverNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverHome"     component={DriverPlaceholder} />
      <Stack.Screen name="QRScanner"      component={QRScannerScreen} />
      <Stack.Screen name="RouteOptimizer" component={RouteScreen} />
      <Stack.Screen name="MapView"        component={MapScreen} />
    </Stack.Navigator>
  );
}


function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome" component={AdminPlaceholder} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, role, status, loading } = useAuth(); // ← add status

  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:"center",
        alignItems:"center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // Not logged in
  if (!user) return <AuthNavigator />;

  // ✅ Logged in but pending approval
  if (status === "pending") return <PendingNavigator />;

  // Logged in and approved — route by role
  if (role === "driver")     return <DriverNavigator />;
  if (role === "admin")      return <AdminNavigator />;

  // Fallback
  return <AuthNavigator />;
}
