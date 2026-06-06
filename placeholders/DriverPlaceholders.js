// screens/placeholders/DriverPlaceholder.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function DriverPlaceholder({ navigation }) {
  const { logout, user } = useAuth();

  return (
    <View style={styles.container}>

      {/* Header */}
      <Text style={styles.emoji}>🚚</Text>
      <Text style={styles.title}>Driver Dashboard</Text>
      <Text style={styles.sub}>Logged in as: {user?.email}</Text>

      {/* Action Buttons */}
      <View style={styles.buttonGroup}>

        {/* Phase 2 */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#2563EB" }]}
          onPress={() => navigation.navigate("QRScanner")}
        >
          <Text style={styles.btnText}>📷 Scan Package QR</Text>
        </TouchableOpacity>

        {/* Phase 3 */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#7C3AED" }]}
          onPress={() => navigation.navigate("RouteOptimizer")}
        >
          <Text style={styles.btnText}>🚀 Optimize My Route</Text>
        </TouchableOpacity>

        {/* Phase 4 */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#0F766E" }]}
          onPress={() => navigation.navigate("MapView")}
        >
          <Text style={styles.btnText}>🗺️ View Delivery Map</Text>
        </TouchableOpacity>

      </View>

      {/* Spacer pushes logout to bottom */}
      <View style={styles.spacer} />

      <Text style={styles.note}>Phases 5 & 6 coming soon</Text>

      {/* Logout — pinned at bottom, separated */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },

  // Header
  emoji: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1E293B" },
  sub:   { fontSize: 13, color: "#64748B", marginTop: 6, marginBottom: 32 },

  // Button group — all action buttons together
  buttonGroup: { width: "100%", gap: 12 },
  btn: {
    width: "100%", paddingVertical: 16,
    borderRadius: 12, alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Spacer pushes everything below it to the bottom
  spacer: { flex: 1 },

  note: { fontSize: 12, color: "#94A3B8", marginBottom: 20 },

  // Logout — clearly separated at the bottom
  logoutBtn: {
    width: "100%", paddingVertical: 14,
    borderRadius: 12, alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1, borderColor: "#FECACA",
  },
  logoutText: { color: "#EF4444", fontWeight: "700", fontSize: 15 },
});
