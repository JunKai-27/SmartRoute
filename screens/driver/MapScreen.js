// screens/driver/MapScreen.js
// Phase 4 — Driver Map View
// Shows optimized route on map with live GPS tracking
// Google Maps API key required for full functionality
// Runs in placeholder mode until API key is activated

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Alert,
  ScrollView, Platform,
} from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../context/AuthContext";

// ─── Map placeholder when no API key yet ─────────────────
// Set this to true once you activate your Google Maps API key
const GOOGLE_MAPS_ACTIVE = false;

export default function MapScreen({ navigation }) {
  const { user } = useAuth();

  const mapRef = useRef(null);

  const [driverLocation, setDriverLocation]   = useState(null);
  const [stops, setStops]                     = useState([]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [loading, setLoading]                 = useState(true);
  const [locationError, setLocationError]     = useState(false);
  const [watchSub, setWatchSub]               = useState(null);

  // ─── On Mount: get location + fetch job stops ──────────
  useEffect(() => {
    initializeMap();
    return () => {
      // Cleanup GPS watcher on unmount
      if (watchSub) watchSub.remove();
    };
  }, []);

  const initializeMap = async () => {
    setLoading(true);
    await getDriverLocation();
    await fetchAssignedStops();
    setLoading(false);
  };

  // ─── GPS Location ──────────────────────────────────────
  const getDriverLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("⚠️ Location permission denied");
        setLocationError(true);
        // Use default Penang location as fallback
        setDriverLocation({ latitude: 5.4141, longitude: 100.3288 });
        return;
      }

      // Get current position
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDriverLocation({
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      // Watch position for live tracking
      const subscription = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.Balanced,
          timeInterval:     5000,  // update every 5 seconds
          distanceInterval: 10,    // or every 10 metres
        },
        (newLoc) => {
          setDriverLocation({
            latitude:  newLoc.coords.latitude,
            longitude: newLoc.coords.longitude,
          });
        }
      );
      setWatchSub(subscription);

    } catch (error) {
      console.error("❌ Location error:", error);
      setLocationError(true);
      setDriverLocation({ latitude: 5.4141, longitude: 100.3288 });
    }
  };

  // ─── Fetch Assigned Job Stops ──────────────────────────
  const fetchAssignedStops = async () => {
    if (!user?.uid) return;

    try {
      // Find pending job for this driver
      const jobQuery = query(
        collection(db, "jobs"),
        where("assignedDriverId", "==", user.uid),
        where("status", "==", "pending")
      );
      const jobSnap = await getDocs(jobQuery);

      if (jobSnap.empty) {
        console.log("No pending jobs");
        setStops([]);
        return;
      }

      const jobData = jobSnap.docs[0].data();

      // Fetch each package
      const packageDocs = await Promise.all(
        jobData.packageIds.map(id => getDoc(doc(db, "packages", id)))
      );

      const fetchedStops = packageDocs
        .filter(d => d.exists())
        .map((d, index) => ({
          id:         d.id,
          packageId:  d.data().packageId,
          recipient:  d.data().recipient,
          address:    d.data().address,
          latitude:   d.data().latitude   || (5.4141 + index * 0.01),
          longitude:  d.data().longitude  || (100.3288 + index * 0.01),
          status:     d.data().status,
          driverNote: d.data().driverNote,
        }));

      setStops(fetchedStops);
      console.log(`📦 Loaded ${fetchedStops.length} stops`);

    } catch (error) {
      console.error("❌ Fetch stops error:", error);
    }
  };

  // ─── Centre Map on Driver ──────────────────────────────
  const centreOnDriver = () => {
    if (mapRef.current && driverLocation) {
      mapRef.current.animateToRegion({
        latitude:       driverLocation.latitude,
        longitude:      driverLocation.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }, 800);
    }
  };

  // ─── Mark Stop as Active ───────────────────────────────
  const handleSelectStop = (index) => {
    setActiveStopIndex(index);
    if (mapRef.current && stops[index]) {
      mapRef.current.animateToRegion({
        latitude:       stops[index].latitude,
        longitude:      stops[index].longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }, 600);
    }
  };

  // ─── Build Route Coordinates ───────────────────────────
  // Connects driver → all stops in order
  const routeCoordinates = driverLocation
    ? [
        driverLocation,
        ...stops.map(s => ({
          latitude:  s.latitude,
          longitude: s.longitude,
        })),
      ]
    : [];

  // ─── Initial Map Region ────────────────────────────────
  const initialRegion = driverLocation
    ? {
        latitude:       driverLocation.latitude,
        longitude:      driverLocation.longitude,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      }
    : {
        // Default: Penang
        latitude:       5.4141,
        longitude:      100.3288,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      };

  // ─── Loading Screen ────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </SafeAreaView>
    );
  }

  // ─── Placeholder Mode (no API key yet) ────────────────
  if (!GOOGLE_MAPS_ACTIVE) {
    return (
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🗺️ Driver Map View</Text>
        </View>

        <ScrollView contentContainerStyle={styles.placeholderScroll}>

          {/* API notice */}
          <View style={styles.apiNotice}>
            <Text style={styles.apiNoticeIcon}>🔑</Text>
            <Text style={styles.apiNoticeTitle}>
              Google Maps API Not Yet Activated
            </Text>
            <Text style={styles.apiNoticeText}>
              The live map will be available once the Google Maps API key
              is configured. All route data is ready — the map will render
              automatically when activated.
            </Text>
          </View>

          {/* Driver location card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>📍 Your Location</Text>
            <Text style={styles.infoCardText}>
              {locationError
                ? "Using default location (Penang)"
                : driverLocation
                  ? `${driverLocation.latitude.toFixed(5)}, ${driverLocation.longitude.toFixed(5)}`
                  : "Unavailable"}
            </Text>
          </View>

          {/* Stop list */}
          {stops.length > 0 ? (
            <View style={styles.stopListContainer}>
              <Text style={styles.stopListTitle}>
                📦 Delivery Stops ({stops.length})
              </Text>
              <Text style={styles.stopListSubtitle}>
                Tap a stop to set it as your active destination
              </Text>
              {stops.map((stop, index) => (
                <TouchableOpacity
                  key={stop.id}
                  style={[
                    styles.stopCard,
                    activeStopIndex === index && styles.stopCardActive,
                  ]}
                  onPress={() => handleSelectStop(index)}
                >
                  <View style={[
                    styles.stopBadge,
                    { backgroundColor: activeStopIndex === index
                        ? "#2563EB" : "#E2E8F0" }
                  ]}>
                    <Text style={[
                      styles.stopBadgeText,
                      { color: activeStopIndex === index ? "#fff" : "#374151" }
                    ]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={styles.stopPackageId}>
                      {stop.packageId}
                      {activeStopIndex === index
                        ? "  🎯 Active" : ""}
                    </Text>
                    <Text style={styles.stopRecipient}>{stop.recipient}</Text>
                    <Text style={styles.stopAddress}>{stop.address}</Text>
                    {stop.driverNote ? (
                      <Text style={styles.stopNote}>📝 {stop.driverNote}</Text>
                    ) : null}
                  </View>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: stop.status === "delivered"
                        ? "#16A34A" : "#F59E0B" }
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noJobCard}>
              <Text style={styles.noJobIcon}>🎉</Text>
              <Text style={styles.noJobTitle}>No Active Jobs</Text>
              <Text style={styles.noJobText}>
                No pending delivery jobs assigned to you.
                Check back with your dispatcher.
              </Text>
            </View>
          )}

          {/* What the map will show */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>
              🗺️ When Google Maps is Active:
            </Text>
            {[
              "📍 Your live GPS position tracked in real-time",
              "🔵 Blue polyline connecting all stops in optimized order",
              "🔴 Numbered markers for each delivery stop",
              "🎯 Active stop highlighted in distinct colour",
              "🔄 Route updates automatically after each delivery",
            ].map((item, i) => (
              <Text key={i} style={styles.previewItem}>{item}</Text>
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Full Map View (when API is active) ────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={false}
      >
        {/* Route polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563EB"
            strokeWidth={4}
            lineDashPattern={[1]}
          />
        )}

        {/* Stop markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{
              latitude:  stop.latitude,
              longitude: stop.longitude,
            }}
            title={`Stop ${index + 1}: ${stop.packageId}`}
            description={stop.recipient}
            pinColor={
              stop.status === "delivered"
                ? "green"
                : activeStopIndex === index
                  ? "red"
                  : "orange"
            }
            onPress={() => handleSelectStop(index)}
          />
        ))}
      </MapView>

      {/* Floating header */}
      <SafeAreaView style={styles.mapOverlay} pointerEvents="box-none">
        <View style={styles.mapHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.mapHeaderTitle}>🗺️ Live Map</Text>
          <TouchableOpacity
            style={styles.centreBtn}
            onPress={centreOnDriver}
          >
            <Text style={styles.centreBtnText}>📍</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Active stop banner */}
      {stops[activeStopIndex] && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerLabel}>
            🎯 Next Stop ({activeStopIndex + 1}/{stops.length})
          </Text>
          <Text style={styles.activeBannerRecipient}>
            {stops[activeStopIndex].recipient}
          </Text>
          <Text style={styles.activeBannerAddress}>
            {stops[activeStopIndex].address}
          </Text>
          {stops[activeStopIndex].driverNote ? (
            <Text style={styles.activeBannerNote}>
              📝 {stops[activeStopIndex].driverNote}
            </Text>
          ) : null}

          {/* Navigate to QR scanner for this stop */}
          <TouchableOpacity
            style={styles.scanThisBtn}
            onPress={() => navigation.navigate("QRScanner")}
          >
            <Text style={styles.scanThisBtnText}>
              📷 Scan This Package
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#F8FAFC" },
  loadingContainer: { flex: 1, justifyContent: "center",
                      alignItems: "center", backgroundColor: "#F8FAFC" },
  loadingText:      { marginTop: 12, fontSize: 15, color: "#64748B" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    padding: 16, paddingTop: Platform.OS === "android" ? 40 : 16,
    backgroundColor: "#fff", borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B",
                 marginLeft: 12 },
  backBtn: {
    backgroundColor: "#E2E8F0", paddingVertical: 6,
    paddingHorizontal: 14, borderRadius: 8,
  },
  backBtnText: { color: "#374151", fontWeight: "700", fontSize: 14 },

  // Placeholder scroll
  placeholderScroll: { padding: 20, paddingBottom: 40 },

  // API notice
  apiNotice: {
    backgroundColor: "#FEF9C3", borderRadius: 16,
    padding: 20, marginBottom: 16, alignItems: "center",
    borderWidth: 1, borderColor: "#FDE68A",
  },
  apiNoticeIcon:  { fontSize: 32, marginBottom: 8 },
  apiNoticeTitle: { fontSize: 16, fontWeight: "700", color: "#854D0E",
                    marginBottom: 8, textAlign: "center" },
  apiNoticeText:  { fontSize: 13, color: "#92400E", textAlign: "center",
                    lineHeight: 20 },

  // Info card
  infoCard: {
    backgroundColor: "#EFF6FF", borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoCardTitle: { fontSize: 14, fontWeight: "700", color: "#1D4ED8",
                   marginBottom: 4 },
  infoCardText:  { fontSize: 13, color: "#1E40AF" },

  // Stop list
  stopListContainer: { marginBottom: 16 },
  stopListTitle:     { fontSize: 16, fontWeight: "700", color: "#1E293B",
                       marginBottom: 4 },
  stopListSubtitle:  { fontSize: 12, color: "#64748B", marginBottom: 12 },
  stopCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    marginBottom: 10, flexDirection: "row", alignItems: "flex-start",
    borderWidth: 1, borderColor: "#E2E8F0",
    elevation: 1,
  },
  stopCardActive: {
    borderColor: "#2563EB", borderWidth: 2,
    backgroundColor: "#EFF6FF",
  },
  stopBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    marginRight: 12, marginTop: 2,
  },
  stopBadgeText:  { fontWeight: "800", fontSize: 14 },
  stopInfo:       { flex: 1 },
  stopPackageId:  { fontSize: 12, color: "#2563EB", fontWeight: "700",
                    marginBottom: 2 },
  stopRecipient:  { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  stopAddress:    { fontSize: 13, color: "#64748B", marginTop: 2 },
  stopNote:       { fontSize: 12, color: "#854D0E", marginTop: 4,
                    backgroundColor: "#FEF9C3", padding: 4, borderRadius: 4 },
  statusDot: {
    width: 12, height: 12, borderRadius: 6, marginLeft: 8, marginTop: 4,
  },

  // No job
  noJobCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 32,
    alignItems: "center", marginBottom: 16,
  },
  noJobIcon:  { fontSize: 48, marginBottom: 12 },
  noJobTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B",
                marginBottom: 8 },
  noJobText:  { fontSize: 14, color: "#64748B", textAlign: "center",
                lineHeight: 20 },

  // Preview card
  previewCard: {
    backgroundColor: "#F0FDF4", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  previewTitle: { fontSize: 15, fontWeight: "700", color: "#15803D",
                  marginBottom: 12 },
  previewItem:  { fontSize: 13, color: "#166534", marginBottom: 8,
                  lineHeight: 20 },

  // Full map styles (when API active)
  map:        { flex: 1 },
  mapOverlay: {
    position: "absolute", top: 0, left: 0, right: 0,
  },
  mapHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", margin: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12, padding: 12, elevation: 4,
  },
  mapHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  centreBtn: {
    backgroundColor: "#EFF6FF", padding: 8,
    borderRadius: 8,
  },
  centreBtnText: { fontSize: 18 },

  // Active stop banner
  activeBanner: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", padding: 20,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    elevation: 8,
  },
  activeBannerLabel:     { fontSize: 12, color: "#64748B",
                           fontWeight: "600", marginBottom: 4 },
  activeBannerRecipient: { fontSize: 18, fontWeight: "700",
                           color: "#1E293B" },
  activeBannerAddress:   { fontSize: 14, color: "#64748B", marginTop: 4 },
  activeBannerNote: {
    fontSize: 13, color: "#854D0E", marginTop: 8,
    backgroundColor: "#FEF9C3", padding: 8, borderRadius: 8,
  },
  scanThisBtn: {
    backgroundColor: "#2563EB", borderRadius: 10,
    padding: 14, alignItems: "center", marginTop: 14,
  },
  scanThisBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
