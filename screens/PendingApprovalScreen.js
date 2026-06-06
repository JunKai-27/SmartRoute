// screens/PendingApprovalScreen.js
// Shown to users who have registered but not yet approved by admin

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView,
} from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";

export default function PendingApprovalScreen() {
  const { logout, user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Icon */}
        <Text style={styles.icon}>⏳</Text>

        {/* Title */}
        <Text style={styles.title}>Awaiting Approval</Text>

        {/* Message */}
        <Text style={styles.message}>
          Your account has been created and is pending
          approval from an administrator.
        </Text>

        <Text style={styles.message}>
          You will be able to access SmartRoute as soon
          as your account is approved. This usually takes
          a short time during business hours.
        </Text>

        {/* Account info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Registered as</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>

        {/* What happens next */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>What happens next?</Text>
          <View style={styles.step}>
            <Text style={styles.stepNum}>1</Text>
            <Text style={styles.stepText}>
              An admin reviews your account registration
            </Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNum}>2</Text>
            <Text style={styles.stepText}>
              Your account is approved and activated
            </Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNum}>3</Text>
            <Text style={styles.stepText}>
              This screen updates automatically — no need to log out
            </Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1, padding: 24,
    justifyContent: "center", alignItems: "center",
  },
  icon: { fontSize: 72, marginBottom: 16 },
  title: {
    fontSize: 24, fontWeight: "800", color: "#1E293B",
    marginBottom: 16, textAlign: "center",
  },
  message: {
    fontSize: 14, color: "#64748B", textAlign: "center",
    lineHeight: 22, marginBottom: 12, paddingHorizontal: 8,
  },
  infoCard: {
    backgroundColor: "#EFF6FF", borderRadius: 12,
    padding: 16, width: "100%", marginTop: 8, marginBottom: 16,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoLabel: {
    fontSize: 12, color: "#64748B",
    fontWeight: "600", marginBottom: 4,
  },
  infoValue: {
    fontSize: 15, color: "#1D4ED8", fontWeight: "700",
  },
  stepsCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    width: "100%", marginBottom: 24,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  stepsTitle: {
    fontSize: 14, fontWeight: "700", color: "#1E293B",
    marginBottom: 12,
  },
  step: {
    flexDirection: "row", alignItems: "flex-start",
    marginBottom: 10,
  },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#2563EB", color: "#fff",
    fontSize: 12, fontWeight: "800",
    textAlign: "center", lineHeight: 24,
    marginRight: 10, flexShrink: 0,
  },
  stepText: {
    fontSize: 13, color: "#374151",
    flex: 1, lineHeight: 20, paddingTop: 2,
  },
  logoutBtn: {
    width: "100%", paddingVertical: 14,
    borderRadius: 12, alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1, borderColor: "#FECACA",
  },
  logoutText: {
    color: "#EF4444", fontWeight: "700", fontSize: 15,
  },
});