// screens/driver/RouteScreen.js
// Phase 3 — Route Optimizer UI
// Fetches assigned job from Firestore, runs optimization,
// displays ordered stop list with distance savings

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert, SafeAreaView,
} from "react-native-safe-area-context";
import * as Location from "expo-location";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { optimizeRoute } from "../../utils/routeOptimizer";

export default function RouteScreen({ navigation }) {
  const { user } = useAuth();

  const [loading, setLoading]             = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [optimizedStops, setOptimizedStops]   = useState([]);
  const [routeStats, setRouteStats]           = useState(null);
  const [driverLocation, setDriverLocation]   = useState(null);
  const [jobId, setJobId]                     = useState(null);
  const [error, setError]                     = useState(null);

  // Get driver's current GPS location on mount
  useEffect(() => {
    getDriverLocation();
  }, []);

  // ─── Get GPS Location ───────────────────────────────────
  const getDriverLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // Use default Penang location if permission denied
        console.warn("⚠️ Location permission denied — using default");
        setDriverLocation({ latitude: 5.4141, longitude: 100.3288 });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDriverLocation({
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      console.log("📍 Driver location:", loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      console.error("❌ Location error:", err);
      // Fallback to default
      setDriverLocation({ latitude: 5.4141, longitude: 100.3288 });
    } finally {
      setLocationLoading(false);
    }
  };

  // ─── Fetch Job + Packages from Firestore ────────────────
  const fetchJobAndPackages = async () => {
    if (!user?.uid) return null;

    // Find the pending job assigned to this driver
    const jobQuery = query(
      collection(db, "jobs"),
      where("assignedDriverId", "==", user.uid),
      where("status", "==", "pending")
    );
    const jobSnap = await getDocs(jobQuery);

    if (jobSnap.empty) {
      throw new Error("No pending jobs assigned to you.");
    }

    const jobDoc  = jobSnap.docs[0];
    const jobData = jobDoc.data();
    setJobId(jobDoc.id);
    console.log("📋 Job found:", jobDoc.id, "Packages:", jobData.packageIds);

    // Fetch each package document
    const packagePromises = jobData.packageIds.map(pkgId =>
      getDoc(doc(db, "packages", pkgId))
    );
    const packageDocs = await Promise.all(packagePromises);

    const stops = packageDocs
      .filter(d => d.exists() && d.data().status !== "delivered")
      .map(d => ({
        id:          d.id,
        packageId:   d.data().packageId,
        recipient:   d.data().recipient,
        address:     d.data().address,
        latitude:    d.data().latitude,
        longitude:   d.data().longitude,
        driverNote:  d.data().driverNote,
        status:      d.data().status,
      }));

    if (stops.length === 0) {
      throw new Error("All packages in this job are already delivered! 🎉");
    }

    return stops;
  };

  // ─── Run Optimization ───────────────────────────────────
  const handleOptimize = async () => {
    if (!driverLocation) {
      Alert.alert("Location Required", "Waiting for your GPS location...");
      return;
    }

    setLoading(true);
    setError(null);
    setOptimizedStops([]);
    setRouteStats(null);

    try {
      // Fetch packages from Firestore
      const packageStops = await fetchJobAndPackages();

      // Prepend driver's current location as the start point
      const allStops = [
        {
          id:        "driver-location",
          packageId: "START",
          recipient: "Your Location",
          address:   "Current GPS Position",
          latitude:  driverLocation.latitude,
          longitude: driverLocation.longitude,
        },
        ...packageStops,
      ];

      // Run optimization
      const result = await optimizeRoute(allStops);

      // Remove the driver start point from displayed results
      const displayStops = result.optimizedStops.filter(
        s => s.id !== "driver-location"
      );

      setOptimizedStops(displayStops);
      setRouteStats({
        totalDistance:  result.totalDistance,
        initialDistance: result.initialDistance,
        savedDistance:  result.savedDistance,
        savingPercent:  result.savingPercent,
        stopCount:      displayStops.length,
      });

    } catch (err) {
      console.error("❌ Optimization error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render Stop Card ────────────────────────────────────
  const renderStop = (stop, index) => (
    <View style={styles.stopCard} key={stop.id}>
      <View style={styles.stopNumber}>
        <Text style={styles.stopNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.stopInfo}>
        <Text style={styles.stopPackageId}>{stop.packageId}</Text>
        <Text style={styles.stopRecipient}>{stop.recipient}</Text>
        <Text style={styles.stopAddress}>{stop.address}</Text>
        {stop.driverNote ? (
          <Text style={styles.stopNote}>📝 {stop.driverNote}</Text>
        ) : null}
      </View>
      <View style={[
        styles.stopStatus,
        { backgroundColor: stop.status === "delivered" ? "#DCFCE7" : "#FEF9C3" }
      ]}>
        <Text style={[
          styles.stopStatusText,
          { color: stop.status === "delivered" ? "#16A34A" : "#854D0E" }
        ]}>
          {stop.status === "delivered" ? "✅" : "⏳"}
        </Text>
      </View>
    </View>
  );

  // ─── Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🗺️ Route Optimizer</Text>
          <Text style={styles.subtitle}>
            AI-powered delivery sequence
          </Text>
        </View>

        {/* Location Status */}
        <View style={styles.locationCard}>
          {locationLoading ? (
            <View style={styles.locationRow}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.locationText}>  Getting your location...</Text>
            </View>
          ) : driverLocation ? (
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>
                Location ready: {driverLocation.latitude.toFixed(4)},
                {" "}{driverLocation.longitude.toFixed(4)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.locationRow}
              onPress={getDriverLocation}
            >
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={[styles.locationText, { color: "#EF4444" }]}>
                Location unavailable — tap to retry
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Optimize Button */}
        <TouchableOpacity
          style={[
            styles.optimizeBtn,
            (loading || locationLoading) && styles.optimizeBtnDisabled,
          ]}
          onPress={handleOptimize}
          disabled={loading || locationLoading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.optimizeBtnText}>  Optimizing Route...</Text>
            </View>
          ) : (
            <Text style={styles.optimizeBtnText}>
              🚀 Calculate Optimized Route
            </Text>
          )}
        </TouchableOpacity>

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Route Stats */}
        {routeStats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>📊 Optimization Results</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(routeStats.totalDistance / 1000).toFixed(2)} km
                </Text>
                <Text style={styles.statLabel}>Optimized Distance</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(routeStats.savedDistance / 1000).toFixed(2)} km
                </Text>
                <Text style={styles.statLabel}>Distance Saved</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#16A34A" }]}>
                  {routeStats.savingPercent}%
                </Text>
                <Text style={styles.statLabel}>Route Improvement</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {routeStats.stopCount}
                </Text>
                <Text style={styles.statLabel}>Stops Remaining</Text>
              </View>
            </View>
          </View>
        )}

        {/* Optimized Stop List */}
        {optimizedStops.length > 0 && (
          <View style={styles.stopList}>
            <Text style={styles.stopListTitle}>
              📦 Optimized Delivery Sequence
            </Text>
            <Text style={styles.stopListSubtitle}>
              Follow this order for the shortest route
            </Text>
            {optimizedStops.map((stop, index) => renderStop(stop, index))}
          </View>
        )}

        {/* Empty state */}
        {!loading && optimizedStops.length === 0 && !error && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyText}>
              Tap the button above to calculate your optimized delivery route
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll:    { padding: 20, paddingBottom: 40 },

  // Header
  header:   { marginBottom: 20 },
  backBtn:  {
    alignSelf: "flex-start", backgroundColor: "#E2E8F0",
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 8, marginBottom: 12,
  },
  backBtnText: { color: "#374151", fontWeight: "700", fontSize: 14 },
  title:    { fontSize: 26, fontWeight: "bold", color: "#1E293B" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 4 },

  // Location card
  locationCard: {
    backgroundColor: "#EFF6FF", borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  locationRow: { flexDirection: "row", alignItems: "center" },
  locationIcon: { fontSize: 16 },
  locationText: { fontSize: 13, color: "#1D4ED8", marginLeft: 6, flex: 1 },

  // Optimize button
  optimizeBtn: {
    backgroundColor: "#2563EB", borderRadius: 12,
    padding: 16, alignItems: "center", marginBottom: 20,
  },
  optimizeBtnDisabled: { backgroundColor: "#93C5FD" },
  optimizeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  loadingRow: { flexDirection: "row", alignItems: "center" },

  // Error
  errorCard: {
    backgroundColor: "#FEF2F2", borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#FECACA",
  },
  errorText: { color: "#DC2626", fontSize: 14, lineHeight: 20 },

  // Stats card
  statsCard: {
    backgroundColor: "#fff", borderRadius: 16,
    padding: 20, marginBottom: 20,
    elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  statsTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B",
                marginBottom: 16 },
  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
  },
  statItem: {
    flex: 1, minWidth: "40%", backgroundColor: "#F8FAFC",
    borderRadius: 10, padding: 12, alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800", color: "#2563EB" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 4,
               textAlign: "center" },

  // Stop list
  stopList:      { marginBottom: 20 },
  stopListTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B",
                   marginBottom: 4 },
  stopListSubtitle: { fontSize: 12, color: "#64748B", marginBottom: 16 },

  stopCard: {
    backgroundColor: "#fff", borderRadius: 12,
    padding: 14, marginBottom: 10, flexDirection: "row",
    alignItems: "flex-start", elevation: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4,
  },
  stopNumber: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#2563EB", alignItems: "center",
    justifyContent: "center", marginRight: 12, marginTop: 2,
  },
  stopNumberText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stopInfo:       { flex: 1 },
  stopPackageId:  { fontSize: 12, color: "#2563EB", fontWeight: "700",
                    marginBottom: 2 },
  stopRecipient:  { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  stopAddress:    { fontSize: 13, color: "#64748B", marginTop: 2 },
  stopNote:       { fontSize: 12, color: "#854D0E", marginTop: 4,
                    backgroundColor: "#FEF9C3", padding: 4,
                    borderRadius: 4 },
  stopStatus: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", marginLeft: 8,
  },
  stopStatusText: { fontSize: 16 },

  // Empty state
  emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
  emptyIcon:  { fontSize: 64, marginBottom: 16 },
  emptyText:  { fontSize: 15, color: "#94A3B8", textAlign: "center",
                lineHeight: 22 },
});