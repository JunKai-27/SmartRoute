// smartroute-web/src/pages/AdminPanel.jsx
// Admin Panel — Full system management
// Features: User management, system stats, 
//           all packages, all jobs, role changes, delete users

import { useState, useEffect } from "react";
import {
  collection, onSnapshot, doc,
  updateDoc, deleteDoc, query, where, getDocs,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth"; // ← add this

export default function AdminPanel({ user }) {
  const [tab, setTab]         = useState("overview");
  const [users, setUsers]     = useState([]);
  const [packages, setPackages] = useState([]);
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);

  // ── Real-time listeners ─────────────────────────────────
  useEffect(() => {
    const unsubs = [];

    unsubs.push(onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(collection(db, "packages"), snap => {
      setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }));

    unsubs.push(onSnapshot(collection(db, "jobs"), snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    // Listen to pending users
    unsubs.push(onSnapshot(
      query(collection(db, "users"), where("status", "==", "pending")),
      snap => setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ));

    return () => unsubs.forEach(fn => fn());
  }, []);

  // ── Helpers ─────────────────────────────────────────────
  const drivers     = users.filter(u => u.role === "driver");
  const dispatchers = users.filter(u => u.role === "dispatcher");
  const admins      = users.filter(u => u.role === "admin");
  const delivered   = packages.filter(p => p.status === "delivered");
  const pending     = packages.filter(p => p.status !== "delivered");
  const completionRate = packages.length > 0
    ? Math.round((delivered.length / packages.length) * 100) : 0;

  // ── Change user role ────────────────────────────────────
  const handleRoleChange = async (userId, newRole) => {
    if (userId === user.uid) {
      alert("You cannot change your own role.");
      return;
    }
    if (!window.confirm(
      `Change this user's role to "${newRole}"?`
    )) return;

    setActionLoading(userId);
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Delete user from Firestore ──────────────────────────
  // Note: deletes Firestore profile only (Firebase Auth account
  // requires Admin SDK to delete — can be done via Cloud Functions)
  const handleDeleteUser = async (userId, userName) => {
    if (userId === user.uid) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!window.confirm(
      `Delete user "${userName}"?\n\nThis removes their profile and all assigned jobs. This cannot be undone.`
    )) return;

    setActionLoading(userId);
    try {
      // Remove from all jobs
      const affectedJobs = jobs.filter(
        j => j.assignedDriverId === userId
      );
      for (const job of affectedJobs) {
        await deleteDoc(doc(db, "jobs", job.id));
      }
      // Delete user profile
      await deleteDoc(doc(db, "users", userId));
      alert(`✅ User "${userName}" deleted.`);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Approve user ──────────────────────────────────────────
const handleApproveUser = async (userId, userName) => {
  setActionLoading(userId);
  try {
    await updateDoc(doc(db, "users", userId), {
      status: "active",
    });
    alert(`✅ ${userName}'s account has been approved! They can now log in.`);
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    setActionLoading(null);
  }
};

// ── Reject user (delete account) ──────────────────────────
const handleRejectUser = async (userId, userName) => {
  if (!window.confirm(
    `Reject and delete "${userName}"'s account?\nThis cannot be undone.`
  )) return;

  setActionLoading(userId);
  try {
    await deleteDoc(doc(db, "users", userId));
    alert(`🗑️ ${userName}'s account has been rejected and removed.`);
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    setActionLoading(null);
  }
};

  // ── Delete package ──────────────────────────────────────
  const handleDeletePackage = async (pkgId, pkgDocId) => {
    if (!window.confirm(
      `Delete package ${pkgId}? This cannot be undone.`
    )) return;

    try {
      await deleteDoc(doc(db, "packages", pkgDocId));
      // Clean from jobs
      for (const job of jobs) {
        if (job.packageIds?.includes(pkgId)) {
          const updated = job.packageIds.filter(id => id !== pkgId);
          if (updated.length === 0) {
            await deleteDoc(doc(db, "jobs", job.id));
          } else {
            await updateDoc(doc(db, "jobs", job.id),
              { packageIds: updated });
          }
        }
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ── Styles ───────────────────────────────────────────────
  const s = {
    page: {
      display: "flex", minHeight: "100vh",
      fontFamily: "Arial, sans-serif",
      backgroundColor: "#F8FAFC",
    },
    sidebar: {
      width: 240, backgroundColor: "#0F172A",
      display: "flex", flexDirection: "column",
      padding: "24px 0", position: "fixed",
      height: "100vh", overflowY: "auto",
    },
    sidebarLogo: {
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 20px 24px",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
    },
    sidebarTitle: { color: "#fff", fontWeight: 800, fontSize: 18 },
    adminBadge: {
      backgroundColor: "#EF4444", color: "#fff",
      fontSize: 10, fontWeight: 800, padding: "2px 6px",
      borderRadius: 6, marginLeft: 6,
    },
    nav: { flex: 1, padding: "16px 12px" },
    main: { marginLeft: 240, flex: 1, padding: 32 },
    pageTitle: {
      fontSize: 24, fontWeight: 800, color: "#1E293B",
      marginBottom: 24, marginTop: 0,
    },
    card: {
      backgroundColor: "#fff", borderRadius: 16, padding: 24,
      marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    },
    cardTitle: {
      fontSize: 16, fontWeight: 700, color: "#1E293B",
      marginBottom: 16, marginTop: 0,
    },
    statGrid: {
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      gap: 16, marginBottom: 24,
    },
    statCard: { borderRadius: 16, padding: 20, textAlign: "center" },
    statIcon:  { fontSize: 28, marginBottom: 8 },
    statValue: { fontSize: 28, fontWeight: 800, margin: 0 },
    statLabel: { fontSize: 12, color: "#64748B", marginTop: 4 },
    table:  { width: "100%", borderCollapse: "collapse" },
    thead:  { backgroundColor: "#F8FAFC" },
    th: {
      padding: "10px 12px", fontSize: 12, fontWeight: 700,
      color: "#64748B", textAlign: "left",
      borderBottom: "1px solid #E2E8F0",
    },
    tr:  { borderBottom: "1px solid #F1F5F9" },
    td:  { padding: "12px 12px", fontSize: 13, color: "#374151" },
    badge: {
      padding: "3px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 700, display: "inline-block",
    },
    roleBadge: {
      driver:     { bg: "#EFF6FF", color: "#2563EB" },
      dispatcher: { bg: "#F3E8FF", color: "#7C3AED" },
      admin:      { bg: "#FEF2F2", color: "#EF4444" },
    },
    driverCell: { display: "flex", alignItems: "center", gap: 10 },
    avatar: (color = "#2563EB") => ({
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: color, display: "flex",
      alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0,
    }),
    sidebarFooter: {
      padding: "16px 20px",
      borderTop: "1px solid rgba(255,255,255,0.1)",
    },
    userInfo: { display: "flex", alignItems: "center",
                gap: 10, marginBottom: 12 },
    userName:  { color: "#fff", fontWeight: 700, fontSize: 13 },
    userEmail: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
    logoutBtn: {
      width: "100%", padding: "8px 0",
      backgroundColor: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 8, color: "#fff", cursor: "pointer",
      fontSize: 13, fontWeight: 600,
    },
    deleteBtn: {
      backgroundColor: "#FEF2F2", color: "#EF4444",
      border: "1px solid #FECACA", borderRadius: 6,
      padding: "4px 10px", cursor: "pointer",
      fontSize: 12, fontWeight: 700,
    },
    dangerBtn: {
      backgroundColor: "#EF4444", color: "#fff",
      border: "none", borderRadius: 6,
      padding: "4px 10px", cursor: "pointer",
      fontSize: 12, fontWeight: 700,
    },
    select: {
      fontSize: 12, padding: "4px 8px",
      borderRadius: 6, border: "1px solid #D1D5DB",
      cursor: "pointer", backgroundColor: "#fff",
    },
    progressTrack: {
      height: 6, backgroundColor: "#E2E8F0",
      borderRadius: 3, overflow: "hidden",
    },
    emptyRow: {
      textAlign: "center", color: "#94A3B8",
      padding: 32, fontStyle: "italic",
    },
  };

  // ── Nav button renderer ─────────────────────────────────
  const NavBtn = ({ id, icon, label, badge }) => {
    const isActive = tab === id;
    return (
      <button
        style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "11px 14px",
          background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
          border: "none",
          borderLeft: isActive ? "3px solid #fff" : "3px solid transparent",
          color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
          fontSize: 14, fontWeight: isActive ? 700 : 600,
          borderRadius: isActive ? "0 8px 8px 0" : 8,
          cursor: "pointer", marginBottom: 4,
          textAlign: "left",
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#fff";
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.65)";
          }
        }}
        onClick={() => setTab(id)}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        {label}
        {badge > 0 && (
          <span style={{
            marginLeft: "auto", backgroundColor: "#EF4444",
            color: "#fff", fontSize: 11, fontWeight: 800,
            borderRadius: 10, padding: "2px 7px",
          }}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div style={{ display:"flex", justifyContent:"center",
        alignItems:"center", minHeight:"100vh",
        fontFamily:"Arial, sans-serif", color:"#64748B" }}>
        Loading Admin Panel...
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* ── Sidebar ── */}
      <div style={s.sidebar}>
        <div style={s.sidebarLogo}>
          <span style={{ fontSize: 28 }}>📦</span>
          <div>
            <div style={s.sidebarTitle}>
              SmartRoute
              <span style={s.adminBadge}>ADMIN</span>
            </div>
          </div>
        </div>

        <nav style={s.nav}>
          <NavBtn id="overview"  icon="📊" label="Overview" />
          <NavBtn id="users"     icon="👥" label="User Management"
                  badge={users.length} />
          <NavBtn id="packages"  icon="📦" label="All Packages"
                  badge={pending.length} />
          <NavBtn id="jobs"      icon="📋" label="All Jobs"
                  badge={jobs.filter(j=>j.status==="pending").length} />
          <NavBtn id="reports"   icon="📈" label="System Reports" />
          <NavBtn id="pending" icon="🔔" label="Pending Approvals"
                  badge={pendingUsers.length} />
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.userInfo}>
            <div style={s.avatar("#EF4444")}>
              {user?.name?.charAt(0) || "A"}
            </div>
            <div>
              <div style={s.userName}>{user?.name || "Admin"}</div>
              <div style={s.userEmail}>{user?.email}</div>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={s.main}>

        {/* ════════════════════════════════════ */}
        {/* OVERVIEW TAB                        */}
        {/* ════════════════════════════════════ */}
        {tab === "overview" && (
          <div>
            <h2 style={s.pageTitle}>📊 System Overview</h2>

            {/* Stat cards */}
            <div style={s.statGrid}>
              {[
                { label:"Total Users",    value: users.length,
                  icon:"👥", color:"#2563EB", bg:"#EFF6FF" },
                { label:"Drivers",        value: drivers.length,
                  icon:"🚚", color:"#0F766E", bg:"#CCFBF1" },
                { label:"Dispatchers",    value: dispatchers.length,
                  icon:"📋", color:"#7C3AED", bg:"#F3E8FF" },
                { label:"Admins",         value: admins.length,
                  icon:"⚙️", color:"#EF4444", bg:"#FEF2F2" },
                { label:"Total Packages", value: packages.length,
                  icon:"📦", color:"#2563EB", bg:"#EFF6FF" },
                { label:"Delivered",      value: delivered.length,
                  icon:"✅", color:"#16A34A", bg:"#DCFCE7" },
                { label:"Pending",        value: pending.length,
                  icon:"⏳", color:"#854D0E", bg:"#FEF9C3" },
                { label:"Completion",     value:`${completionRate}%`,
                  icon:"📈", color:"#EA580C", bg:"#FFF7ED" },
              ].map(stat => (
                <div key={stat.label}
                  style={{ ...s.statCard, backgroundColor: stat.bg }}>
                  <div style={s.statIcon}>{stat.icon}</div>
                  <div style={{ ...s.statValue, color: stat.color }}>
                    {stat.value}
                  </div>
                  <div style={s.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Overall progress */}
            <div style={s.card}>
              <div style={{ display:"flex",
                justifyContent:"space-between", marginBottom:10 }}>
                <h3 style={{ ...s.cardTitle, marginBottom:0 }}>
                  System-Wide Delivery Progress
                </h3>
                <span style={{ fontWeight:800, color:"#2563EB",
                  fontSize:18 }}>
                  {completionRate}%
                </span>
              </div>
              <div style={{ ...s.progressTrack, height:10,
                marginBottom:8 }}>
                <div style={{
                  height:"100%",
                  width:`${completionRate}%`,
                  backgroundColor: completionRate===100
                    ? "#16A34A" : "#2563EB",
                  borderRadius:3,
                  transition:"width 0.5s ease",
                }} />
              </div>
              <p style={{ margin:0, fontSize:13, color:"#94A3B8" }}>
                {delivered.length} of {packages.length} packages
                delivered system-wide
              </p>
            </div>

            {/* Quick user breakdown */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>👥 User Breakdown</h3>
              <div style={{ display:"grid",
                gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {[
                  { role:"driver",     label:"Drivers",
                    count:drivers.length,
                    color:"#2563EB", bg:"#EFF6FF", icon:"🚚" },
                  { role:"dispatcher", label:"Dispatchers",
                    count:dispatchers.length,
                    color:"#7C3AED", bg:"#F3E8FF", icon:"📋" },
                  { role:"admin",      label:"Admins",
                    count:admins.length,
                    color:"#EF4444", bg:"#FEF2F2", icon:"⚙️" },
                ].map(item => (
                  <div key={item.role} style={{
                    backgroundColor:item.bg,
                    borderRadius:12, padding:20, textAlign:"center",
                  }}>
                    <div style={{ fontSize:32 }}>{item.icon}</div>
                    <div style={{ fontSize:28, fontWeight:800,
                      color:item.color }}>
                      {item.count}
                    </div>
                    <div style={{ fontSize:13, color:"#64748B",
                      marginTop:4 }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════ */}
        {/* USER MANAGEMENT TAB                 */}
        {/* ════════════════════════════════════ */}
        {tab === "users" && (
          <div>
            <h2 style={s.pageTitle}>👥 User Management</h2>
            <p style={{ color:"#64748B", marginBottom:24, marginTop:-16 }}>
              View all registered users, change roles, or remove accounts.
            </p>

            <div style={s.card}>
              <h3 style={s.cardTitle}>
                All Users ({users.length})
              </h3>
              <table style={s.table}>
                <thead style={s.thead}>
                  <tr>
                    <th style={s.th}>User</th>
                    <th style={s.th}>Role</th>
                    <th style={s.th}>Joined</th>
                    <th style={s.th}>Change Role</th>
                    <th style={s.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{...s.td,...s.emptyRow}}>
                        No users found.
                      </td>
                    </tr>
                  ) : users.map(u => {
                    const roleStyle = s.roleBadge[u.role]
                      || { bg:"#F1F5F9", color:"#64748B" };
                    const avatarColor = u.role === "admin"
                      ? "#EF4444" : u.role === "dispatcher"
                      ? "#7C3AED" : "#2563EB";
                    const isMe = u.id === user.uid;

                    return (
                      <tr key={u.id} style={{
                        ...s.tr,
                        backgroundColor: isMe
                          ? "#FFFBEB" : "transparent",
                      }}>
                        <td style={s.td}>
                          <div style={s.driverCell}>
                            <div style={s.avatar(avatarColor)}>
                              {u.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <div style={{ fontWeight:600 }}>
                                {u.name}
                                {isMe && (
                                  <span style={{ fontSize:10,
                                    color:"#854D0E",
                                    backgroundColor:"#FEF9C3",
                                    padding:"1px 6px", borderRadius:6,
                                    marginLeft:6 }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:12,
                                color:"#64748B" }}>
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={s.td}>
                          <span style={{
                            ...s.badge,
                            backgroundColor: roleStyle.bg,
                            color: roleStyle.color,
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontSize:12 }}>
                          {u.createdAt
                            ? new Date(u.createdAt)
                                .toLocaleDateString("en-MY")
                            : "—"}
                        </td>
                        <td style={s.td}>
                          {!isMe ? (
                            <select
                              style={s.select}
                              value={u.role}
                              disabled={actionLoading === u.id}
                              onChange={e =>
                                handleRoleChange(u.id, e.target.value)
                              }
                            >
                              <option value="driver">Driver</option>
                              <option value="dispatcher">
                                Dispatcher
                              </option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span style={{ fontSize:12,
                              color:"#94A3B8" }}>
                              Cannot change own role
                            </span>
                          )}
                        </td>
                        <td style={s.td}>
                          {!isMe ? (
                            <button
                              style={s.deleteBtn}
                              disabled={actionLoading === u.id}
                              onClick={() =>
                                handleDeleteUser(u.id, u.name)
                              }
                            >
                              {actionLoading === u.id
                                ? "..." : "🗑️ Delete"}
                            </button>
                          ) : (
                            <span style={{ fontSize:12,
                              color:"#94A3B8" }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════ */}
        {/* ALL PACKAGES TAB                    */}
        {/* ════════════════════════════════════ */}
        {tab === "packages" && (
          <div>
            <h2 style={s.pageTitle}>📦 All Packages</h2>
            <div style={s.card}>
              <div style={{ display:"flex",
                justifyContent:"space-between",
                alignItems:"center", marginBottom:16 }}>
                <h3 style={{ ...s.cardTitle, marginBottom:0 }}>
                  {packages.length} Total Packages
                </h3>
                <div style={{ display:"flex", gap:12,
                  fontSize:13, color:"#64748B" }}>
                  <span style={{ color:"#16A34A", fontWeight:700 }}>
                    ✅ {delivered.length} delivered
                  </span>
                  <span style={{ color:"#854D0E", fontWeight:700 }}>
                    ⏳ {pending.length} pending
                  </span>
                </div>
              </div>

              <table style={s.table}>
                <thead style={s.thead}>
                  <tr>
                    <th style={s.th}>Package ID</th>
                    <th style={s.th}>Recipient</th>
                    <th style={s.th}>Phone</th>
                    <th style={s.th}>Address</th>
                    <th style={s.th}>Assigned Driver</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{...s.td,...s.emptyRow}}>
                        No packages found.
                      </td>
                    </tr>
                  ) : [...packages]
                    .sort((a,b) =>
                      new Date(b.createdAt||0) - new Date(a.createdAt||0)
                    )
                    .map(pkg => {
                      const assignedJob = jobs.find(j =>
                        j.packageIds?.includes(pkg.packageId)
                      );
                      const driver = assignedJob
                        ? users.find(u =>
                            u.id === assignedJob.assignedDriverId)
                        : null;

                      return (
                        <tr key={pkg.id} style={s.tr}>
                          <td style={{ ...s.td, fontWeight:700,
                            color:"#2563EB" }}>
                            {pkg.packageId}
                          </td>
                          <td style={s.td}>{pkg.recipient}</td>
                          <td style={{ ...s.td, fontSize:12 }}>
                            {pkg.phone || "—"}
                          </td>
                          <td style={{ ...s.td, fontSize:12,
                            maxWidth:200 }}>
                            {pkg.address}
                          </td>
                          <td style={s.td}>
                            {driver ? (
                              <div style={s.driverCell}>
                                <div style={s.avatar("#2563EB")}>
                                  {driver.name?.charAt(0) || "D"}
                                </div>
                                <span style={{ fontSize:12 }}>
                                  {driver.name}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color:"#94A3B8",
                                fontSize:12 }}>
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td style={s.td}>
                            <span style={{
                              ...s.badge,
                              backgroundColor: pkg.status==="delivered"
                                ? "#DCFCE7" : "#FEF9C3",
                              color: pkg.status==="delivered"
                                ? "#16A34A" : "#854D0E",
                            }}>
                              {pkg.status==="delivered"
                                ? "✅ Delivered" : "⏳ Pending"}
                            </span>
                          </td>
                          <td style={s.td}>
                            <button
                              style={s.deleteBtn}
                              onClick={() =>
                                handleDeletePackage(pkg.packageId, pkg.id)
                              }
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════ */}
        {/* ALL JOBS TAB                        */}
        {/* ════════════════════════════════════ */}
        {tab === "jobs" && (
          <div>
            <h2 style={s.pageTitle}>📋 All Jobs</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>
                {jobs.length} Total Jobs
              </h3>
              <table style={s.table}>
                <thead style={s.thead}>
                  <tr>
                    <th style={s.th}>Job ID</th>
                    <th style={s.th}>Assigned Driver</th>
                    <th style={s.th}>Packages</th>
                    <th style={s.th}>Progress</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Created</th>
                    <th style={s.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{...s.td,...s.emptyRow}}>
                        No jobs created yet.
                      </td>
                    </tr>
                  ) : [...jobs]
                    .sort((a,b) =>
                      new Date(b.createdAt||0) - new Date(a.createdAt||0)
                    )
                    .map(job => {
                      const driver = users.find(
                        u => u.id === job.assignedDriverId
                      );
                      const jobPkgs = packages.filter(p =>
                        job.packageIds?.includes(p.packageId)
                      );
                      const done = jobPkgs.filter(
                        p => p.status === "delivered"
                      ).length;
                      const rate = jobPkgs.length > 0
                        ? Math.round((done/jobPkgs.length)*100) : 0;

                      return (
                        <tr key={job.id} style={s.tr}>
                          <td style={{ ...s.td, fontWeight:700,
                            fontSize:12, color:"#7C3AED" }}>
                            {job.jobId || job.id.slice(0,8)}
                          </td>
                          <td style={s.td}>
                            {driver ? (
                              <div style={s.driverCell}>
                                <div style={s.avatar("#2563EB")}>
                                  {driver.name?.charAt(0) || "D"}
                                </div>
                                <div>
                                  <div style={{ fontWeight:600,
                                    fontSize:13 }}>
                                    {driver.name}
                                  </div>
                                  <div style={{ fontSize:11,
                                    color:"#64748B" }}>
                                    {driver.email}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color:"#94A3B8" }}>
                                Unknown
                              </span>
                            )}
                          </td>
                          <td style={s.td}>
                            <div style={{ display:"flex",
                              flexWrap:"wrap", gap:4 }}>
                              {job.packageIds?.map(id => (
                                <span key={id} style={{
                                  backgroundColor:"#EFF6FF",
                                  color:"#2563EB", fontSize:11,
                                  fontWeight:700, padding:"2px 6px",
                                  borderRadius:6,
                                }}>
                                  {id}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={s.td}>
                            <div style={{ minWidth:80 }}>
                              <div style={s.progressTrack}>
                                <div style={{
                                  height:"100%",
                                  width:`${rate}%`,
                                  backgroundColor: rate===100
                                    ? "#16A34A" : "#2563EB",
                                  borderRadius:3,
                                }} />
                              </div>
                              <div style={{ fontSize:11,
                                color:"#64748B", marginTop:3 }}>
                                {done}/{jobPkgs.length} ({rate}%)
                              </div>
                            </div>
                          </td>
                          <td style={s.td}>
                            <span style={{
                              ...s.badge,
                              backgroundColor: job.status==="completed"
                                ? "#DCFCE7" : "#FEF9C3",
                              color: job.status==="completed"
                                ? "#16A34A" : "#854D0E",
                            }}>
                              {job.status==="completed"
                                ? "✅ Completed" : "⏳ Pending"}
                            </span>
                          </td>
                          <td style={{ ...s.td, fontSize:12 }}>
                            {job.createdAt
                              ? new Date(job.createdAt)
                                  .toLocaleDateString("en-MY")
                              : "—"}
                          </td>
                          <td style={s.td}>
                            <button
                              style={s.deleteBtn}
                              onClick={async () => {
                                if (!window.confirm(
                                  "Delete this job? Packages will become unassigned."
                                )) return;
                                await deleteDoc(
                                  doc(db, "jobs", job.id)
                                );
                              }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════ */}
        {/* SYSTEM REPORTS TAB                  */}
        {/* ════════════════════════════════════ */}
        {tab === "reports" && (
          <div>
            <h2 style={s.pageTitle}>📈 System Reports</h2>
            <p style={{ color:"#64748B", marginBottom:24,
              marginTop:-16 }}>
              System-wide performance metrics across all drivers
              and dispatchers.
            </p>

            {/* Stats */}
            <div style={{ display:"grid",
              gridTemplateColumns:"repeat(3,1fr)",
              gap:16, marginBottom:24 }}>
              {[
                { label:"Total Packages",  value:packages.length,
                  icon:"📦", color:"#2563EB", bg:"#EFF6FF" },
                { label:"Delivered",       value:delivered.length,
                  icon:"✅", color:"#16A34A", bg:"#DCFCE7" },
                { label:"Pending",         value:pending.length,
                  icon:"⏳", color:"#854D0E", bg:"#FEF9C3" },
                { label:"Total Drivers",   value:drivers.length,
                  icon:"🚚", color:"#0F766E", bg:"#CCFBF1" },
                { label:"Total Jobs",      value:jobs.length,
                  icon:"📋", color:"#7C3AED", bg:"#F3E8FF" },
                { label:"Completion Rate", value:`${completionRate}%`,
                  icon:"📈", color:"#EA580C", bg:"#FFF7ED" },
              ].map(stat => (
                <div key={stat.label} style={{
                  backgroundColor:stat.bg, borderRadius:16,
                  padding:20, textAlign:"center",
                }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>
                    {stat.icon}
                  </div>
                  <div style={{ fontSize:28, fontWeight:800,
                    color:stat.color }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize:12, color:"#64748B",
                    marginTop:4 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-driver breakdown */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>🚚 Driver Performance</h3>
              <table style={s.table}>
                <thead style={s.thead}>
                  <tr>
                    <th style={s.th}>Driver</th>
                    <th style={s.th}>Assigned</th>
                    <th style={s.th}>Delivered</th>
                    <th style={s.th}>Pending</th>
                    <th style={s.th}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{...s.td,...s.emptyRow}}>
                        No drivers registered.
                      </td>
                    </tr>
                  ) : drivers.map(driver => {
                    const job = jobs.find(
                      j => j.assignedDriverId === driver.id
                        && j.status === "pending"
                    );
                    const driverPkgs = job
                      ? packages.filter(p =>
                          job.packageIds?.includes(p.packageId))
                      : [];
                    const done    = driverPkgs.filter(
                      p => p.status==="delivered").length;
                    const pending = driverPkgs.length - done;
                    const rate    = driverPkgs.length > 0
                      ? Math.round((done/driverPkgs.length)*100) : 0;

                    return (
                      <tr key={driver.id} style={s.tr}>
                        <td style={s.td}>
                          <div style={s.driverCell}>
                            <div style={s.avatar("#2563EB")}>
                              {driver.name?.charAt(0) || "D"}
                            </div>
                            <div>
                              <div style={{ fontWeight:600 }}>
                                {driver.name}
                              </div>
                              <div style={{ fontSize:12,
                                color:"#64748B" }}>
                                {driver.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...s.td, fontWeight:700 }}>
                          {driverPkgs.length}
                        </td>
                        <td style={{ ...s.td, fontWeight:700,
                          color:"#16A34A" }}>
                          {done}
                        </td>
                        <td style={{ ...s.td, fontWeight:700,
                          color:"#854D0E" }}>
                          {pending}
                        </td>
                        <td style={s.td}>
                          <div style={s.progressTrack}>
                            <div style={{
                              height:"100%", width:`${rate}%`,
                              backgroundColor: rate===100 ? "#16A34A"
                                : rate>=50 ? "#2563EB" : "#EF4444",
                              borderRadius:3,
                            }} />
                          </div>
                          <div style={{ fontSize:11, color:"#64748B",
                            marginTop:3 }}>
                            {rate}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Recent deliveries */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>
                🕐 Recent Deliveries (Last 10)
              </h3>
              <table style={s.table}>
                <thead style={s.thead}>
                  <tr>
                    <th style={s.th}>Package ID</th>
                    <th style={s.th}>Recipient</th>
                    <th style={s.th}>Delivered By</th>
                    <th style={s.th}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {delivered.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{...s.td,...s.emptyRow}}>
                        No deliveries yet.
                      </td>
                    </tr>
                  ) : [...delivered]
                    .sort((a,b) =>
                      new Date(b.deliveredAt||0)
                        - new Date(a.deliveredAt||0)
                    )
                    .slice(0,10)
                    .map(pkg => (
                      <tr key={pkg.id} style={s.tr}>
                        <td style={{ ...s.td, fontWeight:700,
                          color:"#2563EB" }}>
                          {pkg.packageId}
                        </td>
                        <td style={s.td}>{pkg.recipient}</td>
                        <td style={{ ...s.td, fontSize:12 }}>
                          {pkg.deliveredBy || "—"}
                        </td>
                        <td style={{ ...s.td, fontSize:12 }}>
                          {pkg.deliveredAt
                            ? new Date(pkg.deliveredAt)
                                .toLocaleString("en-MY", {
                                  dateStyle:"short",
                                  timeStyle:"short",
                                })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ════════════════════════════════════ */}
{/* PENDING APPROVALS TAB               */}
{/* ════════════════════════════════════ */}
{tab === "pending" && (
  <div>
    <h2 style={s.pageTitle}>🔔 Pending Approvals</h2>
    <p style={{ color:"#64748B", marginBottom:24, marginTop:-16 }}>
      New user registrations waiting for your approval
      before they can access SmartRoute.
    </p>

    {pendingUsers.length === 0 ? (
      <div style={{ ...s.card, textAlign:"center", padding:48 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <div style={{ fontSize:18, fontWeight:700,
          color:"#1E293B", marginBottom:8 }}>
          No pending approvals
        </div>
        <div style={{ fontSize:14, color:"#64748B" }}>
          All registered users have been reviewed.
        </div>
      </div>
    ) : (
      <>
        {/* Warning banner */}
        <div style={{
          backgroundColor:"#FEF9C3", borderRadius:12,
          padding:16, marginBottom:20, display:"flex",
          alignItems:"center", gap:12,
          borderLeft:"4px solid #F59E0B",
        }}>
          <span style={{ fontSize:24 }}>⚠️</span>
          <div>
            <div style={{ fontWeight:700, color:"#854D0E" }}>
              {pendingUsers.length} account{pendingUsers.length > 1
                ? "s" : ""} awaiting approval
            </div>
            <div style={{ fontSize:13, color:"#92400E", marginTop:2 }}>
              Review each registration carefully before approving
              access to the SmartRoute system.
            </div>
          </div>
        </div>

        {/* Pending users list */}
        {pendingUsers.map(u => (
          <div key={u.id} style={{
            ...s.card,
            borderLeft: "4px solid #F59E0B",
          }}>
            <div style={{ display:"flex",
              justifyContent:"space-between",
              alignItems:"flex-start" }}>

              {/* User info */}
              <div style={{ display:"flex",
                alignItems:"flex-start", gap:16 }}>
                <div style={{
                  width:52, height:52, borderRadius:26,
                  backgroundColor:"#FEF9C3",
                  border:"2px solid #F59E0B",
                  display:"flex", alignItems:"center",
                  justifyContent:"center",
                  fontSize:22, fontWeight:800, color:"#854D0E",
                  flexShrink:0,
                }}>
                  {u.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:700,
                    color:"#1E293B", marginBottom:4 }}>
                    {u.name}
                  </div>
                  <div style={{ fontSize:13, color:"#64748B",
                    marginBottom:4 }}>
                    📧 {u.email}
                  </div>
                  <div style={{ display:"flex", gap:8,
                    flexWrap:"wrap" }}>
                    <span style={{
                      ...s.badge,
                      backgroundColor: "#EFF6FF", color:"#2563EB",
                    }}>
                      Requested role: {u.role}
                    </span>
                    <span style={{
                      ...s.badge,
                      backgroundColor:"#FEF9C3", color:"#854D0E",
                    }}>
                      ⏳ Pending
                    </span>
                    <span style={{ fontSize:12, color:"#94A3B8" }}>
                      Registered:{" "}
                      {u.createdAt
                        ? new Date(u.createdAt)
                            .toLocaleString("en-MY", {
                              dateStyle:"short",
                              timeStyle:"short",
                            })
                        : "Unknown"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:8,
                flexShrink:0, marginLeft:16 }}>
                <button
                  style={{
                    backgroundColor:"#DCFCE7", color:"#16A34A",
                    border:"1px solid #86EFAC", borderRadius:8,
                    padding:"8px 16px", cursor:"pointer",
                    fontSize:13, fontWeight:700,
                    opacity: actionLoading === u.id ? 0.6 : 1,
                  }}
                  disabled={actionLoading === u.id}
                  onClick={() => handleApproveUser(u.id, u.name)}
                >
                  {actionLoading === u.id ? "..." : "✅ Approve"}
                </button>
                <button
                  style={{
                    backgroundColor:"#FEF2F2", color:"#EF4444",
                    border:"1px solid #FECACA", borderRadius:8,
                    padding:"8px 16px", cursor:"pointer",
                    fontSize:13, fontWeight:700,
                    opacity: actionLoading === u.id ? 0.6 : 1,
                  }}
                  disabled={actionLoading === u.id}
                  onClick={() => handleRejectUser(u.id, u.name)}
                >
                  {actionLoading === u.id ? "..." : "❌ Reject"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </>
    )}
  </div>
)}

      </div>
    </div>
  );
}
