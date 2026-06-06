// screens/driver/QRScannerScreen.js
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, ScrollView,
  TextInput, Platform, SafeAreaView, KeyboardAvoidingView,
} from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  collection, query, where, getDocs,
  doc, updateDoc, getDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { sendLocalNotification } from "../../utils/notifications";

export default function QRScannerScreen({ navigation }) {
  const { user } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [packageData, setPackageData]   = useState(null);
  const [packageDocId, setPackageDocId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmed, setConfirmed]       = useState(false);
  const [manualId, setManualId]         = useState("");
  const [showManual, setShowManual]     = useState(false);

  // ─── Firestore Lookup ─────────────────────────────────
  const lookupPackage = async (rawValue) => {
  const id = rawValue.trim().toUpperCase();
  if (!id) return;

  // ✅ Block URLs, Expo dev codes, and anything with slashes
  const isInvalidCode =
    id.includes("//") ||
    id.includes("HTTP") ||
    id.includes("EXP:") ||
    id.includes("HTTPS") ||
    id.startsWith("EXP+") ||
    id.length > 30; // package IDs should be short like PKG-001

  if (isInvalidCode) {
    setScanned(false); // reset so camera can scan again
    Alert.alert(
      "Wrong QR Code",
      "That's not a package QR code.\n\nMake sure you are scanning the label on the delivery package, not the Expo app code.",
      [{ text: "OK" }]
    );
    return;
  }

    setLoading(true);
    console.log("📦 Looking up:", id);
    try {
      const directSnap = await getDoc(doc(db, "packages", id));
      if (directSnap.exists()) {
        setPackageData(directSnap.data());
        setPackageDocId(directSnap.id);
        setConfirmed(false);
        setModalVisible(true);
        return;
      }
      const snapshot = await getDocs(query(
        collection(db, "packages"),
        where("packageId", "==", id)
      ));
      if (snapshot.empty) {
        Alert.alert(
          "Package Not Found",
          `No package found for ID: ${id}`,
          [{ text: "Try Again", onPress: resetScanner }]
        );
      } else {
        const docSnap = snapshot.docs[0];
        setPackageData(docSnap.data());
        setPackageDocId(docSnap.id);
        setConfirmed(false);
        setModalVisible(true);
      }
    } catch (error) {
      console.error("❌ Lookup error:", error);
      Alert.alert("Error", "Failed to fetch package. Check your connection.");
      [{ text: "OK", onPress: resetScanner }];
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned || loading) return;
    
    // ✅ Block Expo dev QR codes and URLs BEFORE anything else runs
    const upper = data.toUpperCase();
    const isInvalid =
      upper.includes("EXP://") ||
      upper.includes("EXP+") ||
      upper.includes("HTTP://") ||
      upper.includes("HTTPS://") ||
      upper.includes("//") ||
      data.length > 30;

   if (isInvalid) {
      // Don't set scanned = true, just silently ignore
      // No alert needed — camera keeps scanning automatically
     console.log("🚫 Ignored non-package QR:", data);
     return;
    }

   // Valid package ID — proceed
    setScanned(true);
    lookupPackage(data);
    };

  const handleManualSearch = () => {
    if (!manualId.trim()) {
      Alert.alert("Enter Package ID", "Please type a package ID first.");
      return;
    }
    setScanned(true);
    lookupPackage(manualId);
  };

  const handleConfirmDelivery = async () => {
  if (!packageDocId) return;
  try {
    await updateDoc(doc(db, "packages", packageDocId), {
      status:      "delivered",
      deliveredBy: user?.email,
      deliveredAt: new Date().toISOString(),
    });
    setPackageData(prev => ({ ...prev, status: "delivered" }));
    setConfirmed(true);

    // ✅ Phase 6 — Send local notification on delivery confirmation
    await sendLocalNotification(
      "✅ Delivery Confirmed!",
      `Package ${packageData?.packageId} delivered to ${packageData?.recipient}.`,
      { packageId: packageData?.packageId }
    );

  } catch (error) {
    console.error("❌ Update error:", error);
    Alert.alert("Error", "Failed to confirm delivery. Try again.");
  }
};

  const resetScanner = () => {
    setScanned(false);
    setPackageData(null);
    setPackageDocId(null);
    setModalVisible(false);
    setConfirmed(false);
    setManualId("");
    setShowManual(false);
  };

  // ─── Post-Confirm Buttons ─────────────────────────────
  const renderPostConfirmButtons = () => (
    <View style={styles.actionGroup}>
      <Text style={styles.actionGroupTitle}>
        What would you like to do next?
      </Text>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: "#2563EB" }]}
        onPress={resetScanner}
      >
        <Text style={styles.actionBtnText}>📷 Scan Next Package</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: "#0F766E" }]}
        onPress={() => {
          setModalVisible(false);
          setScanned(false);
          setConfirmed(false);
          setManualId("");
          setShowManual(true);
        }}
      >
        <Text style={styles.actionBtnText}>⌨️ Enter Another ID</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: "#7C3AED" }]}
        onPress={() => {
          resetScanner();
          navigation.navigate("DriverHome");
        }}
      >
        <Text style={styles.actionBtnText}>🏠 Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Permission: loading ──────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // ─── Permission: denied ───────────────────────────────
  if (!permission.granted) {
    return (
      <KeyboardAvoidingView 
        style={styles.centered}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.backBtnAbsolute}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.permText}>
          📷 Camera access is required to scan QR codes.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualToggleBtn}
          onPress={() => setShowManual(!showManual)}
        >
          <Text style={[styles.manualToggleText, { color: "#2563EB" }]}>
            ⌨️ Enter Package ID Manually
          </Text>
        </TouchableOpacity>
        {showManual && (
          <View style={styles.manualBox}>
            <TextInput
              style={styles.manualInput}
              placeholder="e.g. PKG-001"
              placeholderTextColor="#94A3B8"
              value={manualId}
              onChangeText={(text) => setManualId(text.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleManualSearch}
            />
            <TouchableOpacity
              style={styles.manualSearchBtn}
              onPress={handleManualSearch}
            >
              <Text style={styles.manualSearchText}>🔍 Search Package</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // ─── Main Render ──────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Camera layout set to fill the entire container background */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Floating Foreground Overlay */}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.topBarTitles}>
            <Text style={styles.topBarText}>📦 SmartRoute Scanner</Text>
            <Text style={styles.topBarSub}>
              Point camera at a package QR code
            </Text>
          </View>
        </View>

        {/* Scan Frame */}
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Looking up package...</Text>
            </>
          ) : scanned && !modalVisible ? (
            <TouchableOpacity style={styles.rescanBtn} onPress={resetScanner}>
              <Text style={styles.rescanBtnText}>🔄 Scan Again</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.scanHint}>
              Align QR code within the frame
            </Text>
          )}

          {!loading && !showManual && (
            <TouchableOpacity
              style={styles.manualToggleBtn}
              onPress={() => setShowManual(true)}
            >
              <Text style={styles.manualToggleText}>
                ⌨️ Enter ID Manually (Emulator)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Natively layout manual input block so KeyboardAvoidingView handles it fluidly */}
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        {showManual && !loading && (
          <View style={styles.floatingPanel}>
            <View style={styles.floatingHeader}>
              <Text style={styles.floatingTitle}>Enter Package ID</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowManual(false);
                  setManualId("");
                }}
              >
                <Text style={styles.floatingClose}>✕ Close</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.manualInput}
              placeholder="e.g. PKG-001"
              placeholderTextColor="#94A3B8"
              value={manualId}
              onChangeText={(text) => setManualId(text.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleManualSearch}
              autoFocus={true}
            />
            <TouchableOpacity
              style={styles.manualSearchBtn}
              onPress={handleManualSearch}
            >
              <Text style={styles.manualSearchText}>🔍 Search Package</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Package Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={resetScanner}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>📦 Package Details</Text>

              {[
                ["Package ID",  packageData?.packageId],
                ["Recipient",   packageData?.recipient],
                ["Address",     packageData?.address],
                ["Driver Note", packageData?.driverNote],
              ].map(([label, value]) => (
                <View style={styles.detailRow} key={label}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value || "—"}</Text>
                </View>
              ))}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: packageData?.status === "delivered"
                      ? "#DCFCE7" : "#FEF9C3" }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    { color: packageData?.status === "delivered"
                        ? "#16A34A" : "#854D0E" }
                  ]}>
                    {packageData?.status?.toUpperCase()}
                  </Text>
                </View>
              </View>

              {confirmed ? (
                <>
                  <View style={styles.successBanner}>
                    <Text style={styles.successBannerText}>
                      ✅ Delivery confirmed successfully!
                    </Text>
                  </View>
                  {renderPostConfirmButtons()}
                </>
              ) : packageData?.status === "delivered" ? (
                <>
                  <View style={styles.alreadyDelivered}>
                    <Text style={styles.alreadyDeliveredText}>
                      ✅ Already Delivered
                    </Text>
                  </View>
                  {renderPostConfirmButtons()}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleConfirmDelivery}
                  >
                    <Text style={styles.confirmBtnText}>
                      ✅ Confirm Delivery
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={resetScanner}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const CORNER_SIZE      = 28;
const CORNER_THICKNESS = 4;
const CORNER_COLOR     = "#2563EB";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: 24, backgroundColor: "#F8FAFC",
  },
  camera: { flex: 1 },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "space-between", alignItems: "center",
  },
  topBar: {
    width: "100%",
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 16, paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row", alignItems: "center",
  },
  topBarTitles: { flex: 1, alignItems: "center" },
  topBarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  topBarSub: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  backBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8, marginRight: 8,
  },
  backBtnAbsolute: {
    position: "absolute", top: 48, left: 20,
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: "#2563EB", borderRadius: 8,
  },
  backBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  scanFrame: {
    width: 240, height: 240, position: "relative",
    justifyContent: "center", alignItems: "center",
  },
  corner: {
    position: "absolute", width: CORNER_SIZE,
    height: CORNER_SIZE, borderColor: CORNER_COLOR,
  },
  topLeft: {
    top: 0, left: 0,
    borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
  },
  topRight: {
    top: 0, right: 0,
    borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
  },
  bottomBar: {
    width: "100%", paddingVertical: 24, paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center",
  },
  scanHint: { color: "#CBD5E1", fontSize: 14, marginBottom: 12 },
  loadingText: { color: "#CBD5E1", fontSize: 13, marginTop: 10 },
  rescanBtn: {
    backgroundColor: "#2563EB", paddingHorizontal: 32,
    paddingVertical: 12, borderRadius: 8, marginBottom: 12,
  },
  rescanBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  manualToggleBtn: { marginTop: 10, paddingVertical: 6 },
  manualToggleText: { color: "#93C5FD", fontSize: 13, fontWeight: "600" },
  manualBox: {
    width: "100%", marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, padding: 14,
  },
  floatingPanel: {
    backgroundColor: "#0F172A",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 2, borderTopColor: "#2563EB",
  },
  floatingHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  floatingTitle: { color: "#CBD5E1", fontSize: 14, fontWeight: "700" },
  floatingClose: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  manualInput: {
    backgroundColor: "#1E293B",
    color: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    borderWidth: 2,
    borderColor: "#60A5FA",
    marginBottom: 10,
    letterSpacing: 2,
    fontWeight: "700",
  },
  manualSearchBtn: {
    backgroundColor: "#2563EB", borderRadius: 8,
    paddingVertical: 12, alignItems: "center",
  },
  manualSearchText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  permText: {
    fontSize: 15, color: "#374151", textAlign: "center",
    marginBottom: 20, lineHeight: 22,
  },
  permBtn: {
    backgroundColor: "#2563EB", padding: 14,
    borderRadius: 8, paddingHorizontal: 24, marginBottom: 16,
  },
  permBtnText: { color: "#fff", fontWeight: "700" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff", borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 20, fontWeight: "bold",
    color: "#1E293B", marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  detailLabel: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  detailValue: {
    fontSize: 14, color: "#1E293B", fontWeight: "500",
    maxWidth: "55%", textAlign: "right",
  },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  successBanner: {
    backgroundColor: "#DCFCE7", borderRadius: 8,
    padding: 14, alignItems: "center", marginTop: 20,
  },
  successBannerText: { color: "#16A34A", fontWeight: "700", fontSize: 15 },
  actionGroup: { marginTop: 16, gap: 10 },
  actionGroupTitle: {
    fontSize: 13, color: "#64748B", fontWeight: "600",
    textAlign: "center", marginBottom: 4,
  },
  actionBtn: {
    borderRadius: 8, padding: 14,
    alignItems: "center", marginBottom: 2,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  alreadyDelivered: {
    backgroundColor: "#DCFCE7", borderRadius: 8,
    padding: 14, alignItems: "center", marginTop: 20,
  },
  alreadyDeliveredText: { color: "#16A34A", fontWeight: "700", fontSize: 15 },
  confirmBtn: {
    backgroundColor: "#16A34A", borderRadius: 8,
    padding: 14, alignItems: "center", marginTop: 20,
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8,
    padding: 14, alignItems: "center", marginTop: 12,
  },
  cancelBtnText: { color: "#64748B", fontWeight: "600" },
});