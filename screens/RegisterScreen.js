// screens/RegisterScreen.js
// Registration screen — creates Firebase Auth user + Firestore user document with role

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const ROLES = ["driver", "dispatcher", "admin"];

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("driver");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Step 2: Save user profile + role to Firestore
      await setDoc(doc(db, "users", uid), {
       name,
       email,
       role: selectedRole,
       status: "pending",        
       createdAt: new Date().toISOString(),
});

      // Auth state change in RootNavigator will handle navigation automatically
    } catch (error) {
      let message = "Registration failed. Please try again.";
      if (error.code === "auth/email-already-in-use") message = "This email is already registered.";
      if (error.code === "auth/invalid-email") message = "Invalid email format.";
      Alert.alert("Registration Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>📦 SmartRoute</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} placeholder="Enter your name"
            value={name} onChangeText={setName} />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="Enter your email"
            value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="Min. 6 characters"
            value={password} onChangeText={setPassword} secureTextEntry />

          {/* Role Selector */}
          <Text style={styles.label}>Select Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, selectedRole === r && styles.roleBtnActive]}
                onPress={() => setSelectedRole(r)}
              >
                <Text style={[styles.roleBtnText, selectedRole === r && styles.roleBtnTextActive]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating account..." : "Register"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.link}>Already have an account? Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { padding: 24, justifyContent: "center", flexGrow: 1 },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { fontSize: 36, fontWeight: "bold", color: "#2563EB" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 4 },
  form: { backgroundColor: "#fff", borderRadius: 16, padding: 24, elevation: 4 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8,
    padding: 12, fontSize: 14, marginBottom: 16, backgroundColor: "#F9FAFB",
  },
  roleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  roleBtn: {
    flex: 1, marginHorizontal: 4, padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: "#D1D5DB",
    alignItems: "center", backgroundColor: "#F9FAFB",
  },
  roleBtnActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  roleBtnText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  roleBtnTextActive: { color: "#fff" },
  button: {
    backgroundColor: "#2563EB", borderRadius: 8,
    padding: 14, alignItems: "center", marginTop: 4,
  },
  buttonDisabled: { backgroundColor: "#93C5FD" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  link: { textAlign: "center", marginTop: 16, color: "#2563EB", fontSize: 13 },
});