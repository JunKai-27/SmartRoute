// src/pages/Login.jsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cred    = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));

      if (!userDoc.exists()) {
        setError("User profile not found.");
        return;
      }

      const role = userDoc.data().role;
      if (role !== "dispatcher" && role !== "admin") {
        setError("Access denied. This portal is for dispatchers and admins only.");
        await auth.signOut();
        return;
      }

      onLogin({ uid: cred.user.uid, email: cred.user.email, role, ...userDoc.data() });

    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Invalid email or password.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>📦</div>
        <h1 style={styles.title}>SmartRoute</h1>
        <p style={styles.subtitle}>Dispatcher & Admin Portal</p>

        {/* Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="dispatcher@smartroute.com"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={styles.note}>
          🚗 Driver? Use the SmartRoute mobile app instead.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    background: "#fff", borderRadius: 20, padding: 48,
    width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    textAlign: "center",
  },
  logo:     { fontSize: 52, marginBottom: 8 },
  title:    { fontSize: 28, fontWeight: 800, color: "#1E293B", margin: 0 },
  subtitle: { fontSize: 14, color: "#64748B", marginBottom: 32, marginTop: 6 },
  form:     { textAlign: "left" },
  field:    { marginBottom: 20 },
  label:    { display: "block", fontSize: 13, fontWeight: 600,
              color: "#374151", marginBottom: 6 },
  input: {
    width: "100%", padding: "12px 14px", fontSize: 14,
    border: "1.5px solid #D1D5DB", borderRadius: 8,
    boxSizing: "border-box", outline: "none",
    transition: "border-color 0.2s",
  },
  error: { color: "#EF4444", fontSize: 13, marginBottom: 12 },
  btn: {
    width: "100%", padding: "14px", fontSize: 15, fontWeight: 700,
    backgroundColor: "#2563EB", color: "#fff", border: "none",
    borderRadius: 8, cursor: "pointer", marginTop: 4,
  },
  note: { fontSize: 12, color: "#94A3B8", marginTop: 24, marginBottom: 0 },
};