// src/pages/DispatcherDashboard.jsx
import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc,
  doc, query, where, deleteDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  detectAreaType, TIME_WINDOWS,
  isWithinDeliveryWindow, getNextWindowMessage,
} from "../utils/areaDetector";
import ReportPanel from "./ReportPanel";

// ─── Colour helpers ───────────────────────────────────────
const STATUS_COLORS = {
  delivered: { bg: "#DCFCE7", text: "#16A34A" },
  pending:   { bg: "#FEF9C3", text: "#854D0E" },
  default:   { bg: "#F1F5F9", text: "#64748B" },
};

export default function DispatcherDashboard({ user }) {
  const [tab, setTab]               = useState("overview");
  const [drivers, setDrivers]       = useState([]);
  const [packages, setPackages]     = useState([]);
  const [jobs, setJobs]             = useState([]);

  // New package form
  const EMPTY_PKG ={
    packageId:  "",
    autoId:     true,
    recipient:  "",
    phone:      "",
    address:    "",
    areaType:   "",
    driverNote: "",
    latitude:   "",
    longitude:  "",
  };
  const [newPkg, setNewPkg]             = useState(EMPTY_PKG);
  const [detectedArea, setDetectedArea] = useState(null);
  const [pkgLoading, setPkgLoading]     = useState(false);

  // Assign form
  const [selectedPkgs, setSelectedPkgs]     = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [assignLoading, setAssignLoading]   = useState(false);

  // ── Auto Package ID generator ─────────────────────────────
  const generatePackageId = () => {
  const date   = new Date();
  const ymd    = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PKG-${ymd}-${random}`;
};

  // ── Search & Filter state ─────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState("");
  const [filterStatus, setFilterStatus]  = useState("all");
  const [filterArea, setFilterArea]      = useState("all");
  const [filterDriver, setFilterDriver]  = useState("all");

  // ── Real-time listeners ─────────────────────────────────
  useEffect(() => {
    const unsubs = [];

    unsubs.push(onSnapshot(
      query(collection(db, "users"), where("role", "==", "driver")),
      snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ));

    unsubs.push(onSnapshot(
      collection(db, "packages"),
      snap => setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ));

    unsubs.push(onSnapshot(
      collection(db, "jobs"),
      snap => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ));

    return () => unsubs.forEach(fn => fn());
  }, []);

  // ── Address auto-detection ──────────────────────────────
  const handleAddressChange = (value) => {
    setNewPkg(prev => { 
    const detected = detectAreaType(value);
    setDetectedArea(value.trim() ? detected : null);
    return{
      ...prev,
      address: value,
      areaType: value.trim() 
      ? (detected || prev.areaType) 
      : "",
    };
    });
  };

  // ── Create package ──────────────────────────────────────
  const handleCreatePackage = async (e) => {
  e.preventDefault();
  if (!newPkg.recipient || !newPkg.address || !newPkg.phone) {
    alert("Please fill in Recipient, Phone, and Address.");
    return;
  }

  const finalPackageId = newPkg.autoId
    ? generatePackageId()
    : newPkg.packageId.toUpperCase();

  if (!finalPackageId) {
    alert("Please enter a Package ID or enable Auto-generate.");
    return;
  }

  // Check for duplicate package ID
  const duplicate = packages.find(p => p.packageId === finalPackageId);
  if (duplicate) {
    alert(`Package ID "${finalPackageId}" already exists. Please use a different ID.`);
    return;
  }

  setPkgLoading(true);
  try {
    await addDoc(collection(db, "packages"), {
      packageId:  finalPackageId,
      recipient:  newPkg.recipient,
      phone:      newPkg.phone,
      address:    newPkg.address,
      areaType:   newPkg.areaType || "unknown",
      driverNote: newPkg.driverNote,
      latitude:   parseFloat(newPkg.latitude)  || 5.4141,
      longitude:  parseFloat(newPkg.longitude) || 100.3288,
      status:     "pending",
      createdAt:  new Date().toISOString(),
      createdBy:  user.email,
    });

    // ← Reset everything cleanly after submit
    setNewPkg(EMPTY_PKG);
    setDetectedArea(null);
    alert(`✅ Package ${finalPackageId} created successfully!`);
  } catch (err) {
    alert("Error creating package: " + err.message);
  } finally {
    setPkgLoading(false);
  }
};
// ── Delete a package ──────────────────────────────────────
const handleDeletePackage = async (pkgId, packageDocId) => {
  if (!window.confirm(
    `Are you sure you want to delete package ${pkgId}?\nThis cannot be undone.`
  )) return;

  try {
    await deleteDoc(doc(db, "packages", packageDocId));

    // Also remove from any job that references this packageId
    const affectedJobs = jobs.filter(j =>
      j.packageIds?.includes(pkgId)
    );
    for (const job of affectedJobs) {
      const updatedIds = job.packageIds.filter(id => id !== pkgId);
      if (updatedIds.length === 0) {
        await deleteDoc(doc(db, "jobs", job.id));
      } else {
        await updateDoc(doc(db, "jobs", job.id), {
          packageIds: updatedIds,
        });
      }
    }
    alert(`🗑️ Package ${pkgId} deleted.`);
  } catch (err) {
    alert("Error deleting package: " + err.message);
  }
};

// ── Reassign package to different driver ──────────────────
const handleChangeDriver = async (pkgId, currentJobId, newDriverId) => {
  if (!newDriverId) return;
  try {
    // Remove from current job
    if (currentJobId) {
      const currentJob = jobs.find(j => j.id === currentJobId);
      if (currentJob) {
        const updatedIds = currentJob.packageIds.filter(id => id !== pkgId);
        if (updatedIds.length === 0) {
          await deleteDoc(doc(db, "jobs", currentJobId));
        } else {
          await updateDoc(doc(db, "jobs", currentJobId), {
            packageIds: updatedIds,
          });
        }
      }
    }

    // Add to new driver's job
    const newDriverJob = jobs.find(
      j => j.assignedDriverId === newDriverId && j.status === "pending"
    );
    if (newDriverJob) {
      await updateDoc(doc(db, "jobs", newDriverJob.id), {
        packageIds: [...new Set([...newDriverJob.packageIds, pkgId])],
      });
    } else {
      await addDoc(collection(db, "jobs"), {
        jobId:            `JOB-${Date.now()}`,
        assignedDriverId: newDriverId,
        packageIds:       [pkgId],
        status:           "pending",
        createdAt:        new Date().toISOString(),
        completedAt:      null,
      });
    }
    alert(`✅ Package ${pkgId} reassigned successfully!`);
  } catch (err) {
    alert("Error reassigning package: " + err.message);
  }
};

  // ── Assign packages to driver ───────────────────────────
  const handleAssign = async () => {
    if (!selectedDriver || selectedPkgs.length === 0) return;
    setAssignLoading(true);

    try {
      const existingJob = jobs.find(
        j => j.assignedDriverId === selectedDriver.id && j.status === "pending"
      );

      if (existingJob) {
        const updatedIds = [
          ...new Set([
            ...(existingJob.packageIds || []),
            ...selectedPkgs.map(p => p.packageId),
          ])
        ];
        await updateDoc(doc(db, "jobs", existingJob.id), {
          packageIds: updatedIds,
        });
      } else {
        await addDoc(collection(db, "jobs"), {
          jobId:            `JOB-${Date.now()}`,
          assignedDriverId: selectedDriver.id,
          packageIds:       selectedPkgs.map(p => p.packageId),
          status:           "pending",
          createdAt:        new Date().toISOString(),
          completedAt:      null,
        });
      }

      alert(`✅ ${selectedPkgs.length} package(s) assigned to ${selectedDriver.name}!`);
      setSelectedPkgs([]);
      setSelectedDriver(null);

    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────
  const getDriverJob = (driverId) =>
    jobs.find(j => j.assignedDriverId === driverId && j.status === "pending");

  const getJobPackages = (job) => {
    if (!job?.packageIds) return [];
    return packages.filter(p => job.packageIds.includes(p.packageId));
  };

  const unassignedPackages = packages.filter(p => {
    const assignedIds = jobs.flatMap(j => j.packageIds || []);
    return !assignedIds.includes(p.packageId) && p.status !== "delivered";
  });

  // ── Filtered packages (search + filter) ──────────────────
const filteredPackages = packages.filter(pkg => {
  const keyword = searchQuery.toLowerCase();
  const matchesSearch = !keyword ||
    pkg.packageId?.toLowerCase().includes(keyword) ||
    pkg.recipient?.toLowerCase().includes(keyword) ||
    pkg.address?.toLowerCase().includes(keyword) ||
    pkg.phone?.toLowerCase().includes(keyword);

  const matchesStatus =
    filterStatus === "all" || pkg.status === filterStatus;

  const matchesArea =
    filterArea === "all" || pkg.areaType === filterArea;

  const assignedJob = jobs.find(j =>
    j.packageIds?.includes(pkg.packageId)
  );
  const assignedDriverId = assignedJob?.assignedDriverId || "unassigned";
  const matchesDriver =
    filterDriver === "all" ||
    (filterDriver === "unassigned" && !assignedJob) ||
    assignedDriverId === filterDriver;

  return matchesSearch && matchesStatus && matchesArea && matchesDriver;
});

  const deliveredCount = packages.filter(p => p.status === "delivered").length;
  const totalCount     = packages.length;

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* ── Sidebar ── */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <span style={{ fontSize: 28 }}>📦</span>
          <span style={styles.sidebarTitle}>SmartRoute</span>
        </div>

        <nav style={styles.nav}>
          {[
            { key: "overview",  icon: "📊", label: "Overview"       },
            { key: "packages",  icon: "📦", label: "Create Package" },
            { key: "assign",    icon: "🚚", label: "Assign Jobs"    },
            { key: "fleet",     icon: "🗺️", label: "Fleet Monitor"  },
            { key: "reports", icon: "📊", label: "Reports" },
        ].map(item => {
          const isActive = tab === item.key;
          return (
            <button
              key={item.key}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "11px 14px",
                background: isActive
                  ? "rgba(255,255,255,0.15)"
                  : "transparent",
                border: "none",
                borderLeft: isActive
                  ? "3px solid #fff"
                  : "3px solid transparent",
                color: isActive
                  ? "#fff"
                  : "rgba(255,255,255,0.65)",
                fontSize: 14, fontWeight: isActive ? 700 : 600,
                borderRadius: isActive ? "0 8px 8px 0" : 8,
                cursor: "pointer", marginBottom: 4,
                textAlign: "left", position: "relative",
                transition: "all 0.15s ease",
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
          onClick={() => setTab(item.key)}
        >
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          {item.label}
          {item.key === "assign" && unassignedPackages.length > 0 && (
            <span style={{
              marginLeft: "auto", backgroundColor: "#EF4444",
              color: "#fff", fontSize: 11, fontWeight: 800,
              borderRadius: 10, padding: "2px 7px",
        }}>
          {unassignedPackages.length}
        </span>
      )}
    </button>
      );
      })}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>
              {user?.name?.charAt(0) || "D"}
            </div>
            <div>
              <div style={styles.userName}>{user?.name || "Dispatcher"}</div>
              <div style={styles.userEmail}>{user?.email}</div>
            </div>
          </div>
          <button
            style={styles.logoutBtn}
            onClick={() => signOut(auth)}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={styles.main}>

        {/* ════════════════════════════════════════ */}
        {/* OVERVIEW TAB                            */}
        {/* ════════════════════════════════════════ */}
        {tab === "overview" && (
          <div>
            <h2 style={styles.pageTitle}>📊 Overview</h2>

            {/* Stat cards */}
            <div style={styles.statGrid}>
              {[
                { label:"Total Packages", value:totalCount,
                  color:"#2563EB", bg:"#EFF6FF", icon:"📦" },
                { label:"Delivered",      value:deliveredCount,
                  color:"#16A34A", bg:"#DCFCE7", icon:"✅" },
                { label:"Pending",
                  value:totalCount - deliveredCount,
                  color:"#854D0E", bg:"#FEF9C3", icon:"⏳" },
                { label:"Active Drivers",
                  value:drivers.filter(d => getDriverJob(d.id)).length,
                  color:"#7C3AED", bg:"#F3E8FF", icon:"🚚" },
              ].map(stat => (
                <div key={stat.label} style={{ ...styles.statCard,
                  backgroundColor: stat.bg }}>
                  <div style={styles.statIcon}>{stat.icon}</div>
                  <div style={{ ...styles.statValue, color: stat.color }}>
                    {stat.value}
                  </div>
                  <div style={styles.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>Overall Delivery Progress</span>
                <span style={{ fontWeight: 800, color: "#2563EB" }}>
                  {totalCount > 0
                    ? Math.round((deliveredCount / totalCount) * 100)
                    : 0}%
                </span>
              </div>
              <div style={styles.progressTrack}>
                <div style={{
                  ...styles.progressFill,
                  width: totalCount > 0
                    ? `${(deliveredCount / totalCount) * 100}%`
                    : "0%",
                }} />
              </div>
              <p style={styles.progressSub}>
                {deliveredCount} of {totalCount} packages delivered
              </p>
            </div>

            {/* Driver overview table */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>👥 Driver Summary</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHead}>
                    <th style={styles.th}>Driver</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Progress</th>
                    <th style={styles.th}>Packages</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map(driver => {
                    const job   = getDriverJob(driver.id);
                    const pkgs  = getJobPackages(job);
                    const done  = pkgs.filter(p => p.status === "delivered").length;
                    const pct   = pkgs.length > 0
                      ? Math.round((done / pkgs.length) * 100) : 0;

                    return (
                      <tr key={driver.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.driverCell}>
                            <div style={styles.avatar}>
                              {driver.name?.charAt(0) || "D"}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {driver.name}
                              </div>
                              <div style={{ fontSize: 12, color: "#64748B" }}>
                                {driver.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: job ? "#DCFCE7" : "#F1F5F9",
                            color: job ? "#16A34A" : "#94A3B8",
                          }}>
                            {job ? "● Active" : "○ Idle"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {job ? (
                            <div>
                              <div style={styles.progressTrackSm}>
                                <div style={{
                                  ...styles.progressFillSm,
                                  width: `${pct}%`,
                                  backgroundColor:
                                    pct === 100 ? "#16A34A" : "#2563EB",
                                }} />
                              </div>
                              <div style={{ fontSize: 12, color: "#64748B",
                                           marginTop: 4 }}>
                                {pct}%
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#94A3B8", fontSize: 13 }}>
                              No job
                            </span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontWeight: 700 }}>
                            {done}/{pkgs.length}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* CREATE PACKAGE TAB                      */}
        {/* ════════════════════════════════════════ */}
        {tab === "packages" && (
  <div>
    <h2 style={styles.pageTitle}>📦 Manage Packages</h2>
    <div style={{ display:"grid",
      gridTemplateColumns:"1fr 1fr", gap:24 }}>

      {/* ── Create Package Form ── */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>➕ Create New Package</h3>
        <form onSubmit={handleCreatePackage}>

          {/* Auto Package ID toggle */}
          <div style={styles.formField}>
            <label style={styles.formLabel}>Package ID</label>
            <div style={{ display:"flex", alignItems:"center",
              gap:10, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={newPkg.autoId}
                onChange={e => setNewPkg(prev => ({
                  ...prev, autoId: e.target.checked, packageId: "",
                }))}
                id="autoId"
              />
              <label htmlFor="autoId" style={{ fontSize:13,
                color:"#374151", cursor:"pointer" }}>
                🔑 Auto-generate Package ID (recommended)
              </label>
            </div>
            {!newPkg.autoId && (
              <input
                style={styles.formInput}
                placeholder="e.g. PKG-001"
                value={newPkg.packageId}
                onChange={e => setNewPkg(prev => ({
                  ...prev, packageId: e.target.value.toUpperCase()
                }))}
              />
            )}
            {newPkg.autoId && (
              <div style={{ fontSize:12, color:"#64748B",
                backgroundColor:"#F1F5F9", padding:"8px 12px",
                borderRadius:8, fontFamily:"monospace" }}>
                Will be generated as: PKG-{new Date().toISOString()
                  .slice(0,10).replace(/-/g,"")}-XXX
              </div>
            )}
          </div>

          {/* Recipient */}
          <div style={styles.formField}>
            <label style={styles.formLabel}>Recipient Name *</label>
            <input
              style={styles.formInput}
              placeholder="Full name of recipient"
              value={newPkg.recipient}
              onChange={e => setNewPkg(prev => ({
                ...prev, recipient: e.target.value
              }))}
              required
            />
          </div>

          {/* Phone number */}
          <div style={styles.formField}>
            <label style={styles.formLabel}>Phone Number *</label>
            <input
              style={styles.formInput}
              placeholder="e.g. 011-12345678"
              value={newPkg.phone}
              onChange={e => setNewPkg(prev => ({
                ...prev, phone: e.target.value
              }))}
              type="tel"
              required
            />
          </div>

          {/* Address with auto-detect */}
          <div style={styles.formField}>
            <label style={styles.formLabel}>
              Delivery Address *
              {detectedArea && (
                <span style={{ marginLeft:8, fontSize:12,
                  color: detectedArea
                    ? TIME_WINDOWS[detectedArea]?.color : "#94A3B8",
                  fontWeight:600 }}>
                  {TIME_WINDOWS[detectedArea]?.icon} Auto-detected:{" "}
                  {TIME_WINDOWS[detectedArea]?.label}
                </span>
              )}
            </label>
            <input
              style={styles.formInput}
              placeholder="Full delivery address"
              value={newPkg.address}
              onChange={e => handleAddressChange(e.target.value)}
              required
            />
          </div>

          {/* Area Type selector */}
          <div style={styles.formField}>
            <label style={styles.formLabel}>Area Type *</label>
            <div style={styles.areaGrid}>
              {Object.entries(TIME_WINDOWS).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  style={{
                    ...styles.areaBtn,
                    ...(newPkg.areaType === key ? {
                      backgroundColor: info.bgColor,
                      borderColor: info.color,
                      color: info.color,
                    } : {}),
                  }}
                  onClick={() => setNewPkg(prev => ({
                    ...prev, areaType: key
                  }))}
                >
                  {info.icon} {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time window preview */}
          {newPkg.areaType && TIME_WINDOWS[newPkg.areaType] && (
            <div style={{
              ...styles.timeWindowBox,
              backgroundColor: TIME_WINDOWS[newPkg.areaType].bgColor,
              borderColor: TIME_WINDOWS[newPkg.areaType].color,
            }}>
              <div style={{ fontWeight:700, marginBottom:6,
                color: TIME_WINDOWS[newPkg.areaType].color }}>
                ⏰ Delivery Time Windows
              </div>
              {TIME_WINDOWS[newPkg.areaType].windows.map(w => (
                <div key={w.label} style={styles.windowRow}>
                  <span style={styles.windowLabel}>{w.label}</span>
                  <span style={{ fontWeight:700,
                    color: TIME_WINDOWS[newPkg.areaType].color }}>
                    {w.start} – {w.end}
                  </span>
                </div>
              ))}
              <div style={{ marginTop:8, fontSize:12, color:"#64748B" }}>
                🚫 Avoid: {TIME_WINDOWS[newPkg.areaType].avoid}
              </div>
              <div style={{ marginTop:4, fontSize:12, color:"#64748B" }}>
                {TIME_WINDOWS[newPkg.areaType].description}
              </div>
            </div>
          )}

          {/* Driver Note */}
          <div style={styles.formField}>
            <label style={styles.formLabel}>Driver Note</label>
            <input
              style={styles.formInput}
              placeholder="e.g. Leave at door, call before delivery"
              value={newPkg.driverNote}
              onChange={e => setNewPkg(prev => ({
                ...prev, driverNote: e.target.value
              }))}
            />
          </div>

          {/* Coordinates */}
          <div style={{ display:"grid",
            gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={styles.formField}>
              <label style={styles.formLabel}>
              </label>
              <input
                style={styles.formInput}
                placeholder="e.g. 5.4141"
                value={newPkg.latitude}
                onChange={e => setNewPkg(prev => ({
                  ...prev, latitude: e.target.value
                }))}
                type="number" step="any"
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel}>
              </label>
              <input
                style={styles.formInput}
                placeholder="e.g. 100.3288"
                value={newPkg.longitude}
                onChange={e => setNewPkg(prev => ({
                  ...prev, longitude: e.target.value
                }))}
                type="number" step="any"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button
              type="submit"
              style={{ ...styles.submitBtn, flex:1,
                opacity: pkgLoading ? 0.6 : 1 }}
              disabled={pkgLoading}
            >
              {pkgLoading ? "Creating..." : "✅ Create Package"}
            </button>
            {/* Clear button */}
            <button
              type="button"
              style={{
                padding:"13px 20px", fontSize:14, fontWeight:700,
                backgroundColor:"#F1F5F9", color:"#64748B",
                border:"1px solid #E2E8F0", borderRadius:8,
                cursor:"pointer",
              }}
              onClick={() => {
                setNewPkg(EMPTY_PKG);
                setDetectedArea(null);
              }}
            >
              🗑️ Clear
            </button>
          </div>
        </form>
      </div>

      {/* ── All Packages List ── */}
                  
      <div style={styles.card}>
       <h3 style={styles.cardTitle}>
         All Packages ({filteredPackages.length}
         {filteredPackages.length !== packages.length
           ? ` of ${packages.length}` : ""})
       </h3>

       {/* Search bar */}
       <div style={{ marginBottom: 12 }}>
         <input
           style={{
             ...styles.formInput,
              marginBottom: 0,
              paddingLeft: 36,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2364748B' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.868-3.833zm-5.242 1.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "12px center",
            }}
            placeholder="Search by ID, recipient, address, phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter row */}
        <div style={{ display:"flex", gap:8, marginBottom:12,
          flexWrap:"wrap" }}>

          {/* Status */}
          <select
            style={{
              fontSize:13, padding:"6px 10px", borderRadius:8,
              border:"1px solid #D1D5DB", cursor:"pointer",
              backgroundColor: filterStatus !== "all" ? "#EFF6FF" : "#fff",
              color: filterStatus !== "all" ? "#2563EB" : "#374151",
              fontWeight: filterStatus !== "all" ? 700 : 400,
            }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">⏳ Pending</option>
            <option value="delivered">✅ Delivered</option>
          </select>

          {/* Area */}
          <select
            style={{
              fontSize:13, padding:"6px 10px", borderRadius:8,
              border:"1px solid #D1D5DB", cursor:"pointer",
              backgroundColor: filterArea !== "all" ? "#EFF6FF" : "#fff",
              color: filterArea !== "all" ? "#2563EB" : "#374151",
              fontWeight: filterArea !== "all" ? 700 : 400,
            }}
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
          >
            <option value="all">All Areas</option>
            <option value="housing">🏠 Housing</option>
            <option value="office">🏢 Office / Industrial</option>
            <option value="retail">🛍️ Retail</option>
            <option value="restaurant">🍽️ Restaurant</option>
            <option value="warehouse">🏭 Warehouse</option>
          </select>

          {/* Driver */}
          <select
            style={{
              fontSize:13, padding:"6px 10px", borderRadius:8,
              border:"1px solid #D1D5DB", cursor:"pointer",
              backgroundColor: filterDriver !== "all" ? "#EFF6FF" : "#fff",
              color: filterDriver !== "all" ? "#2563EB" : "#374151",
              fontWeight: filterDriver !== "all" ? 700 : 400,
            }}
            value={filterDriver}
            onChange={e => setFilterDriver(e.target.value)}
          >
            <option value="all">All Drivers</option>
            <option value="unassigned">— Unassigned</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Clear filters */}
          {(searchQuery || filterStatus !== "all" ||
            filterArea !== "all" || filterDriver !== "all") && (
           <button
             style={{ fontSize:13, padding:"6px 12px", borderRadius:8,
               border:"1px solid #FECACA", backgroundColor:"#FEF2F2",
               color:"#EF4444", cursor:"pointer", fontWeight:700 }}
             onClick={() => {
               setSearchQuery("");
               setFilterStatus("all");
                setFilterArea("all");
               setFilterDriver("all");
             }}
            >
              ✕ Clear Filters
           </button>
          )}
        </div>

        {/* Result count when filtered */}
       {(searchQuery || filterStatus !== "all" ||
         filterArea !== "all" || filterDriver !== "all") && (
         <div style={{ fontSize:12, color:"#64748B",
           marginBottom:12, fontStyle:"italic" }}>
           Showing {filteredPackages.length} of {packages.length} packages
          </div>
       )}

        {/* Package list */}
        <div style={{ maxHeight:600, overflowY:"auto" }}>
          {filteredPackages.length === 0 ? (
            <div style={{ textAlign:"center", padding:40 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
              <div style={{ fontWeight:700, color:"#1E293B",
                marginBottom:4 }}>
                No packages found
              </div>
              <div style={{ fontSize:13, color:"#94A3B8" }}>
                Try adjusting your search or filters
              </div>
            </div>
          ) : filteredPackages.map(pkg => {
            const area = TIME_WINDOWS[pkg.areaType];
            const withinWindow = pkg.areaType
              ? isWithinDeliveryWindow(pkg.areaType) : true;
            const assignedJob = jobs.find(j =>
              j.packageIds?.includes(pkg.packageId)
            );
            const assignedDriver = assignedJob
              ? drivers.find(d => d.id === assignedJob.assignedDriverId)
              : null;

            return (
              <div key={pkg.id} style={{
                borderBottom:"1px solid #F1F5F9",
                paddingBottom:16, marginBottom:16,
              }}>
                <div style={{ display:"flex",
                  justifyContent:"space-between",
                  alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13,
                      color:"#2563EB" }}>
                      {pkg.packageId}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600,
                      color:"#1E293B" }}>
                      {pkg.recipient}
                    </div>
                    {pkg.phone && (
                      <div style={{ fontSize:12, color:"#64748B" }}>
                        📞 {pkg.phone}
                      </div>
                    )}
                    <div style={{ fontSize:12, color:"#64748B" }}>
                      {pkg.address}
                    </div>
                    {area && (
                      <div style={{ marginTop:6, display:"flex",
                        alignItems:"center", gap:6, flexWrap:"wrap" }}>
                       <span style={{ fontSize:11, fontWeight:700,
                         color:area.color, backgroundColor:area.bgColor,
                         padding:"2px 8px", borderRadius:10 }}>
                         {area.icon} {area.label}
                       </span>
                       <span style={{ fontSize:11,
                         color: withinWindow ? "#16A34A" : "#EF4444" }}>
                         {withinWindow
                           ? "✅ Deliverable now"
                           : `⚠️ ${getNextWindowMessage(pkg.areaType)}`}
                       </span>
                     </div>
                   )}
                   <div style={{ marginTop:4 }}>
                     <span style={{
                       fontSize:11, fontWeight:700,
                       padding:"2px 8px", borderRadius:10,
                       backgroundColor: pkg.status === "delivered"
                         ? "#DCFCE7" : "#FEF9C3",
                       color: pkg.status === "delivered"
                         ? "#16A34A" : "#854D0E",
                     }}>
                       {pkg.status === "delivered"
                         ? "✅ Delivered" : "⏳ Pending"}
                     </span>
                   </div>
                   <div style={{ marginTop:6, fontSize:12,
                     color:"#64748B" }}>
                      {assignedDriver
                       ? `👤 Assigned to: ${assignedDriver.name}`
                        : "👤 Not assigned"}
                    </div>
                  </div>

                  {pkg.status !== "delivered" && (
                    <button
                      onClick={() =>
                        handleDeletePackage(pkg.packageId, pkg.id)
                      }
                      style={{
                        backgroundColor:"#FEF2F2", color:"#EF4444",
                        border:"1px solid #FECACA", borderRadius:8,
                        padding:"6px 10px", cursor:"pointer",
                        fontSize:12, fontWeight:700,
                        marginLeft:8, flexShrink:0,
                      }}
                    >
                      🗑️ Delete
                    </button>
                 )}
                </div>

               {pkg.status !== "delivered" && drivers.length > 0 && (
                 <div style={{ marginTop:10 }}>
                    <label style={{ fontSize:12, color:"#64748B",
                     fontWeight:600 }}>
                      Change Driver:
                    </label>
                    <select
                     style={{ marginLeft:8, fontSize:12,
                        padding:"4px 8px", borderRadius:6,
                       border:"1px solid #D1D5DB", cursor:"pointer" }}
                      value={assignedDriver?.id || ""}
                     onChange={e => handleChangeDriver(
                       pkg.packageId,
                        assignedJob?.id || null,
                        e.target.value
                      )}
                    >
                     <option value="">— Select Driver —</option>
                      {drivers.map(d => (
                       <option key={d.id} value={d.id}>
                          {d.name}
                         {assignedDriver?.id === d.id ? " (current)" : ""}
                       </option>
                     ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
)}

        {/* ════════════════════════════════════════ */}
        {/* ASSIGN JOBS TAB                         */}
        {/* ════════════════════════════════════════ */}
        {tab === "assign" && (
          <div>
            <h2 style={styles.pageTitle}>🚚 Assign Jobs</h2>
            <div style={{ display: "grid",
              gridTemplateColumns: "1fr 1fr", gap: 24 }}>

              {/* Package selection */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>
                  📦 Unassigned Packages ({unassignedPackages.length})
                </h3>

                {unassignedPackages.length === 0 ? (
                  <div style={styles.empty}>
                    <div style={{ fontSize: 40 }}>🎉</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>
                      All packages assigned!
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "#64748B",
                      marginBottom: 12 }}>
                      Select packages to assign to a driver.
                    </p>
                    {unassignedPackages.map(pkg => {
                      const isSelected = selectedPkgs.find(
                        p => p.id === pkg.id
                      );
                      const area = TIME_WINDOWS[pkg.areaType];
                      const withinWindow = pkg.areaType
                        ? isWithinDeliveryWindow(pkg.areaType) : true;

                      return (
                        <div
                          key={pkg.id}
                          style={{
                            ...styles.pkgRow,
                            cursor: "pointer",
                            border: isSelected
                              ? "2px solid #2563EB"
                              : "1px solid #E2E8F0",
                            backgroundColor: isSelected ? "#EFF6FF" : "#fff",
                            borderRadius: 10, padding: 12, marginBottom: 8,
                          }}
                          onClick={() => setSelectedPkgs(prev =>
                            prev.find(p => p.id === pkg.id)
                              ? prev.filter(p => p.id !== pkg.id)
                              : [...prev, pkg]
                          )}
                        >
                          <div style={styles.pkgRowLeft}>
                            <div style={{ fontWeight: 700, fontSize: 13,
                              color: "#2563EB" }}>
                              {isSelected ? "☑️" : "⬜"} {pkg.packageId}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                              {pkg.recipient}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748B" }}>
                              {pkg.address}
                            </div>
                            {area && (
                              <div style={{ marginTop: 4, fontSize: 11 }}>
                                <span style={{
                                  color: area.color,
                                  backgroundColor: area.bgColor,
                                  padding: "2px 8px", borderRadius: 10,
                                  fontWeight: 700,
                                }}>
                                  {area.icon} {area.label}
                                </span>
                                <span style={{
                                  marginLeft: 6,
                                  color: withinWindow ? "#16A34A" : "#EF4444",
                                }}>
                                  {withinWindow
                                    ? "✅ Now deliverable"
                                    : `⚠️ ${getNextWindowMessage(pkg.areaType)}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Driver selection + assign */}
              <div>
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>👤 Select Driver</h3>
                  {drivers.map(driver => {
                    const isSelected = selectedDriver?.id === driver.id;
                    const job        = getDriverJob(driver.id);
                    return (
                      <div
                        key={driver.id}
                        style={{
                          ...styles.pkgRow,
                          cursor: "pointer",
                          border: isSelected
                            ? "2px solid #2563EB" : "1px solid #E2E8F0",
                          backgroundColor: isSelected ? "#EFF6FF" : "#fff",
                          borderRadius: 10, padding: 12, marginBottom: 8,
                          alignItems: "center",
                        }}
                        onClick={() =>
                          setSelectedDriver(isSelected ? null : driver)
                        }
                      >
                        <div style={styles.avatar}>
                          {driver.name?.charAt(0) || "D"}
                        </div>
                        <div style={{ marginLeft: 12, flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{driver.name}</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>
                            {job
                              ? `Active job — ${job.packageIds?.length || 0} packages`
                              : "Available"}
                          </div>
                        </div>
                        {isSelected && (
                          <span style={{ fontSize: 20 }}>✅</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Summary + Assign button */}
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>📋 Assignment Summary</h3>
                  <div style={{ marginBottom: 12 }}>
                    <div style={styles.summaryRow}>
                      <span style={styles.summaryLabel}>Driver</span>
                      <span style={styles.summaryValue}>
                        {selectedDriver?.name || "Not selected"}
                      </span>
                    </div>
                    <div style={styles.summaryRow}>
                      <span style={styles.summaryLabel}>Packages</span>
                      <span style={styles.summaryValue}>
                        {selectedPkgs.length} selected
                      </span>
                    </div>
                    {selectedPkgs.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {selectedPkgs.map(p => (
                          <span key={p.id} style={styles.pkgPill}>
                            {p.packageId}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    style={{
                      ...styles.submitBtn,
                      opacity: (!selectedDriver || selectedPkgs.length === 0
                        || assignLoading) ? 0.5 : 1,
                    }}
                    onClick={handleAssign}
                    disabled={
                      !selectedDriver ||
                      selectedPkgs.length === 0 ||
                      assignLoading
                    }
                  >
                    {assignLoading
                      ? "Assigning..."
                      : `✅ Assign ${selectedPkgs.length} Package(s) to ${selectedDriver?.name || "Driver"}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* FLEET MONITOR TAB                       */}
        {/* ════════════════════════════════════════ */}
        {tab === "fleet" && (
          <div>
            <h2 style={styles.pageTitle}>🗺️ Fleet Monitor</h2>
            <p style={{ color: "#64748B", marginBottom: 24 }}>
              Real-time delivery status for all active drivers.
              Updates automatically as drivers confirm deliveries.
            </p>

            {drivers.map(driver => {
              const job  = getDriverJob(driver.id);
              const pkgs = getJobPackages(job);
              const done = pkgs.filter(p => p.status === "delivered").length;
              const pct  = pkgs.length > 0
                ? Math.round((done / pkgs.length) * 100) : 0;

              return (
                <div key={driver.id} style={styles.card}>
                  <div style={{ display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={styles.avatar}>
                        {driver.name?.charAt(0) || "D"}
                      </div>
                      <div style={{ marginLeft: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                          {driver.name}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748B" }}>
                          {driver.email}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: job ? "#DCFCE7" : "#F1F5F9",
                      color: job ? "#16A34A" : "#94A3B8",
                      fontSize: 13, padding: "6px 14px",
                    }}>
                      {job ? "● On Duty" : "○ Idle"}
                    </span>
                  </div>

                  {job ? (
                    <>
                      <div style={{ display: "flex",
                        justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: "#64748B" }}>
                          Job: {job.jobId || job.id}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                          {done}/{pkgs.length} delivered
                        </span>
                      </div>
                      <div style={styles.progressTrack}>
                        <div style={{
                          ...styles.progressFill,
                          width: `${pct}%`,
                          backgroundColor: pct === 100 ? "#16A34A" : "#2563EB",
                        }} />
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B",
                        marginTop: 6, marginBottom: 16 }}>
                        {pct}% complete
                      </div>

                      {/* Package breakdown */}
                      <table style={styles.table}>
                        <thead>
                          <tr style={styles.tableHead}>
                            <th style={styles.th}>Package ID</th>
                            <th style={styles.th}>Recipient</th>
                            <th style={styles.th}>Area Type</th>
                            <th style={styles.th}>Deliverable Now</th>
                            <th style={styles.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pkgs.map(pkg => {
                            const area = TIME_WINDOWS[pkg.areaType];
                            const canDeliver = pkg.areaType
                              ? isWithinDeliveryWindow(pkg.areaType) : true;
                            return (
                              <tr key={pkg.id} style={styles.tr}>
                                <td style={{ ...styles.td, fontWeight: 700,
                                  color: "#2563EB" }}>
                                  {pkg.packageId}
                                </td>
                                <td style={styles.td}>{pkg.recipient}</td>
                                <td style={styles.td}>
                                  {area ? (
                                    <span style={{
                                      backgroundColor: area.bgColor,
                                      color: area.color,
                                      padding: "2px 8px", borderRadius: 10,
                                      fontSize: 12, fontWeight: 600,
                                    }}>
                                      {area.icon} {area.label}
                                    </span>
                                  ) : "—"}
                                </td>
                                <td style={styles.td}>
                                  {pkg.status === "delivered" ? "—" : (
                                    <span style={{
                                      color: canDeliver ? "#16A34A" : "#EF4444",
                                      fontWeight: 600, fontSize: 13,
                                    }}>
                                      {canDeliver
                                        ? "✅ Yes"
                                        : `⚠️ ${getNextWindowMessage(pkg.areaType)}`}
                                    </span>
                                  )}
                                </td>
                                <td style={styles.td}>
                                  <span style={{
                                    ...styles.badge,
                                    backgroundColor: pkg.status === "delivered"
                                      ? "#DCFCE7" : "#FEF9C3",
                                    color: pkg.status === "delivered"
                                      ? "#16A34A" : "#854D0E",
                                  }}>
                                    {pkg.status === "delivered"
                                      ? "✅ Delivered" : "⏳ Pending"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p style={{ color: "#94A3B8", fontStyle: "italic",
                      fontSize: 13 }}>
                      No active job. Assign packages in the Assign Jobs tab.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* REPORTS TAB                             */}
        {/* ════════════════════════════════════════ */}
        {tab === "reports" && (
         <ReportPanel
           packages={packages}
            drivers={drivers}
            jobs={jobs}
          />
        )}

      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = {
  page:    { display: "flex", minHeight: "100vh",
             fontFamily: "Arial, sans-serif", backgroundColor: "#F8FAFC" },

  // Sidebar
  sidebar: {
    width: 240, backgroundColor: "#1E40AF", display: "flex",
    flexDirection: "column", padding: "24px 0", position: "fixed",
    height: "100vh", overflowY: "auto",
  },
  sidebarLogo: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  sidebarTitle: { color: "#fff", fontWeight: 800, fontSize: 18 },
  nav:    { flex: 1, padding: "16px 12px" },
  navBtn: {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "10px 14px", background: "transparent", border: "none",
  color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 600,
  borderRadius: 8, cursor: "pointer", marginBottom: 4,
  textAlign: "left", position: "relative", transition: "all 0.15s ease",
  },
  navBtnActive: {
  backgroundColor: "rgba(255,255,255,0.15)",
  color: "#fff",
  borderLeft: "3px solid #fff",
  },
  navBtnHover: {
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#fff",
  },
  navIcon:  { fontSize: 18 },
  navBadge: {
    marginLeft: "auto", backgroundColor: "#EF4444",
    color: "#fff", fontSize: 11, fontWeight: 800,
    borderRadius: 10, padding: "2px 7px",
  },
  sidebarFooter: {
    padding: "16px 20px",
    borderTop: "1px solid rgba(255,255,255,0.1)",
  },
  userInfo:   { display: "flex", alignItems: "center",
                gap: 10, marginBottom: 12 },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800,
  },
  userName:  { color: "#fff", fontWeight: 700, fontSize: 13 },
  userEmail: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  logoutBtn: {
    width: "100%", padding: "8px 0", backgroundColor: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8,
    color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },

  // Main
  main:      { marginLeft: 240, flex: 1, padding: 32 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: "#1E293B",
               marginBottom: 24, marginTop: 0 },

  // Cards
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 24,
    marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 12 },
  cardTitle:  { fontSize: 16, fontWeight: 700, color: "#1E293B",
                margin: "0 0 16px" },

  // Stat grid
  statGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16, marginBottom: 20,
  },
  statCard:  { borderRadius: 16, padding: 20, textAlign: "center" },
  statIcon:  { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 32, fontWeight: 800 },
  statLabel: { fontSize: 12, color: "#64748B", marginTop: 4 },

  // Progress
  progressTrack: {
    height: 8, backgroundColor: "#E2E8F0",
    borderRadius: 4, overflow: "hidden", marginBottom: 6,
  },
  progressFill:   { height: "100%", backgroundColor: "#2563EB",
                    borderRadius: 4, transition: "width 0.5s ease" },
  progressTrackSm: { height: 6, backgroundColor: "#E2E8F0",
                     borderRadius: 3, overflow: "hidden" },
  progressFillSm:  { height: "100%", borderRadius: 3 },
  progressSub:     { fontSize: 12, color: "#94A3B8" },

  // Table
  table:     { width: "100%", borderCollapse: "collapse" },
  tableHead: { backgroundColor: "#F8FAFC" },
  th: {
    padding: "10px 12px", fontSize: 12, fontWeight: 700,
    color: "#64748B", textAlign: "left",
    borderBottom: "1px solid #E2E8F0",
  },
  tr: { borderBottom: "1px solid #F1F5F9" },
  td: { padding: "12px 12px", fontSize: 13, color: "#374151" },

  // Badge
  badge: { padding: "4px 10px", borderRadius: 20,
           fontSize: 12, fontWeight: 700 },

  // Driver cell
  driverCell: { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#2563EB",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0,
  },

  // Form
  formField: { marginBottom: 16 },
  formLabel: { display: "block", fontSize: 13, fontWeight: 600,
               color: "#374151", marginBottom: 6 },
  formInput: {
    width: "100%", padding: "10px 12px", fontSize: 14,
    border: "1.5px solid #D1D5DB", borderRadius: 8,
    boxSizing: "border-box", outline: "none",
  },
  areaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 8, marginTop: 4 },
  areaBtn: {
    padding: "8px 10px", border: "1.5px solid #D1D5DB",
    borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
    backgroundColor: "#F8FAFC", color: "#374151", textAlign: "left",
  },
  timeWindowBox: {
    border: "1.5px solid", borderRadius: 10, padding: 14, marginBottom: 16,
  },
  windowRow: {
    display: "flex", justifyContent: "space-between",
    fontSize: 13, marginBottom: 4,
  },
  windowLabel: { color: "#64748B" },
  submitBtn: {
    width: "100%", padding: "13px", fontSize: 14, fontWeight: 700,
    backgroundColor: "#2563EB", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8,
  },

  // Package list
  pkgList: { maxHeight: 500, overflowY: "auto" },
  pkgRow:  { display: "flex", justifyContent: "space-between",
             alignItems: "flex-start", padding: "12px 0",
             borderBottom: "1px solid #F1F5F9" },
  pkgRowLeft: { flex: 1 },

  // Assign
  summaryRow: { display: "flex", justifyContent: "space-between",
                fontSize: 14, marginBottom: 8 },
  summaryLabel: { color: "#64748B", fontWeight: 600 },
  summaryValue: { fontWeight: 700, color: "#1E293B" },
  pkgPill: {
    display: "inline-block", backgroundColor: "#EFF6FF",
    color: "#2563EB", padding: "3px 10px", borderRadius: 12,
    fontSize: 12, fontWeight: 700, margin: "2px 4px 2px 0",
  },

  // Empty
  empty: { textAlign: "center", padding: 32, color: "#64748B" },
};