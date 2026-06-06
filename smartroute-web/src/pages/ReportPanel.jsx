// smartroute-web/src/pages/ReportPanel.jsx
// Phase 6 — Reporting Panel
// Shows: summary stats, per-driver performance,
//        area type breakdown, recent deliveries log

export default function ReportPanel({ packages = [], drivers = [], jobs = [] }) {

  // ─── Helpers ─────────────────────────────────────────────
  const getDriverJob = (driverId) =>
    jobs.find(j => j.assignedDriverId === driverId && j.status === "pending");

  const getJobPackages = (job) => {
    if (!job?.packageIds) return [];
    return packages.filter(p => job.packageIds.includes(p.packageId));
  };

  const deliveredPkgs  = packages.filter(p => p.status === "delivered");
  const pendingPkgs    = packages.filter(p => p.status !== "delivered");
  const activeJobs     = jobs.filter(j => j.status === "pending");
  const completionRate = packages.length > 0
    ? Math.round((deliveredPkgs.length / packages.length) * 100)
    : 0;

  // ─── Area info map ────────────────────────────────────────
  const AREA_INFO = {
    housing:    { icon:"🏠", color:"#16A34A", bg:"#DCFCE7", label:"Housing" },
    office:     { icon:"🏢", color:"#2563EB", bg:"#EFF6FF", label:"Office / Industrial" },
    retail:     { icon:"🛍️", color:"#7C3AED", bg:"#F3E8FF", label:"Retail / Shop" },
    restaurant: { icon:"🍽️", color:"#EA580C", bg:"#FFF7ED", label:"Restaurant / F&B" },
    warehouse:  { icon:"🏭", color:"#64748B", bg:"#F1F5F9", label:"Warehouse" },
    unknown:    { icon:"📦", color:"#94A3B8", bg:"#F8FAFC", label:"Untagged" },
  };

  // ─── Area breakdown calculation ───────────────────────────
  const areaBreakdown = packages.reduce((acc, pkg) => {
    const type = pkg.areaType || "unknown";
    if (!acc[type]) acc[type] = { total: 0, delivered: 0 };
    acc[type].total++;
    if (pkg.status === "delivered") acc[type].delivered++;
    return acc;
  }, {});

  // ─── Styles ───────────────────────────────────────────────
  const s = {
    title:    { fontSize: 24, fontWeight: 800, color: "#1E293B",
                marginBottom: 8, marginTop: 0 },
    subtitle: { color: "#64748B", marginBottom: 24, marginTop: 0 },
    card: {
      backgroundColor: "#fff", borderRadius: 16, padding: 24,
      marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    },
    cardTitle: { fontSize: 16, fontWeight: 700, color: "#1E293B",
                 marginBottom: 16, marginTop: 0 },
    statGrid: {
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16, marginBottom: 24,
    },
    statCard: { borderRadius: 16, padding: 20, textAlign: "center" },
    statIcon:  { fontSize: 28, marginBottom: 8 },
    statValue: { fontSize: 32, fontWeight: 800, margin: 0 },
    statLabel: { fontSize: 12, color: "#64748B", marginTop: 4 },
    table:     { width: "100%", borderCollapse: "collapse" },
    thead:     { backgroundColor: "#F8FAFC" },
    th: {
      padding: "10px 12px", fontSize: 12, fontWeight: 700,
      color: "#64748B", textAlign: "left",
      borderBottom: "1px solid #E2E8F0",
    },
    tr:  { borderBottom: "1px solid #F1F5F9" },
    td:  { padding: "12px 12px", fontSize: 13, color: "#374151" },
    badge: { padding: "4px 10px", borderRadius: 20,
             fontSize: 12, fontWeight: 700 },
    driverCell: { display: "flex", alignItems: "center", gap: 10 },
    avatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: "#2563EB", display: "flex",
      alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0,
    },
    progressTrack: {
      height: 6, backgroundColor: "#E2E8F0",
      borderRadius: 3, overflow: "hidden",
    },
    areaGrid: {
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
    },
    emptyText: {
      textAlign: "center", color: "#94A3B8",
      padding: 32, fontStyle: "italic",
    },
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div>
      <h2 style={s.title}>📊 Delivery Reports</h2>
      <p style={s.subtitle}>
        Live performance summary. Updates automatically as drivers
        confirm deliveries.
      </p>

      {/* ── Summary Stats Grid ── */}
      <div style={s.statGrid}>
        {[
          { label:"Total Packages",  value: packages.length,
            icon:"📦", color:"#2563EB", bg:"#EFF6FF" },
          { label:"Delivered",       value: deliveredPkgs.length,
            icon:"✅", color:"#16A34A", bg:"#DCFCE7" },
          { label:"Pending",         value: pendingPkgs.length,
            icon:"⏳", color:"#854D0E", bg:"#FEF9C3" },
          { label:"Total Drivers",   value: drivers.length,
            icon:"🚚", color:"#7C3AED", bg:"#F3E8FF" },
          { label:"Active Jobs",     value: activeJobs.length,
            icon:"📋", color:"#0F766E", bg:"#CCFBF1" },
          { label:"Completion Rate", value: `${completionRate}%`,
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

      {/* ── Overall Progress Bar ── */}
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom: 10 }}>
          <h3 style={{ ...s.cardTitle, marginBottom: 0 }}>
            Overall Delivery Progress
          </h3>
          <span style={{ fontWeight: 800, color: "#2563EB", fontSize: 18 }}>
            {completionRate}%
          </span>
        </div>
        <div style={{ ...s.progressTrack, height: 10, marginBottom: 8 }}>
          <div style={{
            height: "100%",
            width: `${completionRate}%`,
            backgroundColor: completionRate === 100 ? "#16A34A" : "#2563EB",
            borderRadius: 3,
            transition: "width 0.5s ease",
          }} />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>
          {deliveredPkgs.length} of {packages.length} packages delivered
        </p>
      </div>

      {/* ── Per-Driver Performance ── */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>🚚 Per-Driver Performance</h3>
        <table style={s.table}>
          <thead style={s.thead}>
            <tr>
              <th style={s.th}>Driver</th>
              <th style={s.th}>Assigned</th>
              <th style={s.th}>Delivered</th>
              <th style={s.th}>Pending</th>
              <th style={s.th}>Progress</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...s.td, ...s.emptyText }}>
                  No drivers registered yet.
                </td>
              </tr>
            ) : drivers.map(driver => {
              const job     = getDriverJob(driver.id);
              const pkgs    = getJobPackages(job);
              const done    = pkgs.filter(p => p.status === "delivered").length;
              const pending = pkgs.length - done;
              const rate    = pkgs.length > 0
                ? Math.round((done / pkgs.length) * 100) : 0;

              return (
                <tr key={driver.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.driverCell}>
                      <div style={s.avatar}>
                        {driver.name?.charAt(0)?.toUpperCase() || "D"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{driver.name}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>
                          {driver.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...s.td, fontWeight: 700 }}>
                    {pkgs.length}
                  </td>
                  <td style={{ ...s.td, fontWeight: 700, color: "#16A34A" }}>
                    {done}
                  </td>
                  <td style={{ ...s.td, fontWeight: 700, color: "#854D0E" }}>
                    {pending}
                  </td>
                  <td style={s.td}>
                    <div style={s.progressTrack}>
                      <div style={{
                        height: "100%", width: `${rate}%`,
                        borderRadius: 3,
                        backgroundColor: rate === 100 ? "#16A34A"
                          : rate >= 50   ? "#2563EB" : "#EF4444",
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B",
                      marginTop: 3 }}>
                      {rate}%
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.badge,
                      backgroundColor: job ? "#DCFCE7" : "#F1F5F9",
                      color: job ? "#16A34A" : "#94A3B8",
                    }}>
                      {job ? "● Active" : "○ Idle"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Area Type Breakdown ── */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>🏘️ Deliveries by Area Type</h3>
        {Object.keys(areaBreakdown).length === 0 ? (
          <p style={s.emptyText}>No packages created yet.</p>
        ) : (
          <div style={s.areaGrid}>
            {Object.entries(areaBreakdown).map(([type, data]) => {
              const info = AREA_INFO[type] || AREA_INFO.unknown;
              const rate = data.total > 0
                ? Math.round((data.delivered / data.total) * 100) : 0;
              return (
                <div key={type} style={{
                  backgroundColor: info.bg, borderRadius: 12, padding: 16,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>
                    {info.icon}
                  </div>
                  <div style={{ fontWeight: 700, color: info.color,
                    fontSize: 14, marginBottom: 4 }}>
                    {info.label}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B",
                    marginBottom: 8 }}>
                    {data.delivered} / {data.total} delivered
                  </div>
                  <div style={{ ...s.progressTrack }}>
                    <div style={{
                      height: "100%", width: `${rate}%`,
                      backgroundColor: info.color, borderRadius: 3,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B",
                    marginTop: 4 }}>
                    {rate}% completion
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Deliveries Log ── */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>🕐 Recent Deliveries (Last 10)</h3>
        <table style={s.table}>
          <thead style={s.thead}>
            <tr>
              <th style={s.th}>Package ID</th>
              <th style={s.th}>Recipient</th>
              <th style={s.th}>Area</th>
              <th style={s.th}>Delivered By</th>
              <th style={s.th}>Time</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {deliveredPkgs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...s.td, ...s.emptyText }}>
                  No deliveries confirmed yet.
                </td>
              </tr>
            ) : (
              [...deliveredPkgs]
                .sort((a, b) =>
                  new Date(b.deliveredAt || 0) - new Date(a.deliveredAt || 0)
                )
                .slice(0, 10)
                .map(pkg => {
                  const info = AREA_INFO[pkg.areaType] || AREA_INFO.unknown;
                  return (
                    <tr key={pkg.id} style={s.tr}>
                      <td style={{ ...s.td, fontWeight: 700,
                        color: "#2563EB" }}>
                        {pkg.packageId}
                      </td>
                      <td style={s.td}>{pkg.recipient}</td>
                      <td style={s.td}>
                        {info.icon} {info.label}
                      </td>
                      <td style={{ ...s.td, fontSize: 12 }}>
                        {pkg.deliveredBy || "—"}
                      </td>
                      <td style={{ ...s.td, fontSize: 12 }}>
                        {pkg.deliveredAt
                          ? new Date(pkg.deliveredAt).toLocaleString("en-MY", {
                              dateStyle: "short", timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.badge,
                          backgroundColor: "#DCFCE7", color: "#16A34A" }}>
                          ✅ Delivered
                        </span>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}