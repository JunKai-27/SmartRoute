// utils/notifications.js
// Phase 6 — Push Notification Utilities
// Handles: permission requests, token registration,
//          local notifications, Firestore token storage

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import Constants from "expo-constants";

// ─── Configure how notifications appear ──────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Register for push notifications ─────────────────────
// Call this on app startup for logged-in users
export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) {
    console.log("⚠️ Push notifications only work on real devices");
    return null;
  }

  try {
    // Request permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("❌ Notification permission denied");
      return null;
    }

    // Get push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "c3676aa6-f301-4501-8af0-edfd2d9d6b7f", 
    });
    const token = tokenData.data;
    console.log("🔔 Push token:", token);

    // Save token to Firestore against this user
    if (userId) {
      await updateDoc(doc(db, "users", userId), {
        pushToken: token,
      });
      console.log("✅ Push token saved to Firestore");
    }

    // Android channel setup
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("smartroute", {
        name:          "SmartRoute Notifications",
        importance:    Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:    "#2563EB",
      });
    }

    return token;

  } catch (error) {
    console.error("❌ Push notification setup error:", error);
    return null;
  }
}

// ─── Send a LOCAL notification (no server needed) ────────
// Used to notify the driver directly on their device
export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // show immediately
  });
}

// ─── Notification listener setup ─────────────────────────
// Call this in App.js to handle notification taps
export function setupNotificationListeners(onNotificationTap) {
  // Fired when notification is received while app is open
  const receivedSub = Notifications.addNotificationReceivedListener(
    notification => {
      console.log("🔔 Notification received:", notification);
    }
  );

  // Fired when user taps on a notification
  const responseSub = Notifications.addNotificationResponseReceivedListener(
    response => {
      console.log("👆 Notification tapped:", response);
      if (onNotificationTap) {
        onNotificationTap(response.notification.request.content.data);
      }
    }
  );

  // Return cleanup function
  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
