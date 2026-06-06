// screens/placeholders/DriverPlaceholder.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function DriverPlaceholder() {
  const { logout, user } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⚙️</Text>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.sub}>Logged in as: {user?.email}</Text>
      <Text style={styles.note}>Phase 4 — Map View coming soon</Text>
      <TouchableOpacity
  style={styles.btn}
  onPress={async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }}
>
  <Text style={styles.btnText}>Log Out</Text>
</TouchableOpacity>
    </View>
  );
}

// screens/placeholders/DispatcherPlaceholder.js — same structure, change emoji to 📋 and title
// screens/placeholders/AdminPlaceholder.js — same structure, change emoji to ⚙️ and title

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1E293B" },
  sub: { fontSize: 13, color: "#64748B", marginTop: 8 },
  note: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
  btn: { marginTop: 32, backgroundColor: "#EF4444", padding: 12, borderRadius: 8, paddingHorizontal: 32 },
  btnText: { color: "#fff", fontWeight: "700" },
});
