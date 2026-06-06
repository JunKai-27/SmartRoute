// src/utils/areaDetector.js
// Auto-detects delivery area type from address text
// Used to suggest time windows when dispatcher creates a package

const AREA_KEYWORDS = {
  housing: [
    "taman", "residensi", "villa", "permai", "indah", "damai",
    "apartment", "kondominium", "flat", "court", "heights", "garden",
    "park", "grove", "haven", "homes", "residence", "jaya", "maju",
  ],
  office: [
    "sdn bhd", "berhad", "tower", "plaza", "enterprise", "corp",
    "industries", "industri", "manufacturing", "office", "centre",
    "center", "teknologi", "technology", "solutions", "services",
    "headquarters", "hq",
  ],
  retail: [
    "mall", "shopping", "supermarket", "market", "store", "kedai",
    "hypermarket", "bazaar", "pasar",
  ],
  restaurant: [
    "restaurant", "cafe", "restoran", "kopitiam", "mamak",
    "bistro", "kitchen", "eatery", "food", "diner",
  ],
  warehouse: [
    "warehouse", "gudang", "logistics", "distribution", "depot",
    "storage", "fulfillment", "hub",
  ],
};

// Time windows per area type
export const TIME_WINDOWS = {
  housing: {
    label:       "Housing Area",
    icon:        "🏠",
    color:       "#16A34A",
    bgColor:     "#DCFCE7",
    windows: [
      { start: "08:00", end: "12:00", label: "Morning" },
      { start: "18:00", end: "21:00", label: "Evening" },
    ],
    avoid:       "12:00 – 18:00 (residents at work)",
    description: "Best delivered in the morning or evening when residents are home.",
  },
  office: {
    label:       "Office / Industrial",
    icon:        "🏢",
    color:       "#2563EB",
    bgColor:     "#EFF6FF",
    windows: [
      { start: "09:00", end: "12:00", label: "Morning" },
      { start: "14:00", end: "17:00", label: "Afternoon" },
    ],
    avoid:       "12:00 – 14:00 (lunch hour)",
    description: "Avoid lunch hours. Deliver during office hours only.",
  },
  retail: {
    label:       "Retail / Shop",
    icon:        "🛍️",
    color:       "#7C3AED",
    bgColor:     "#F3E8FF",
    windows: [
      { start: "10:00", end: "20:00", label: "Shop hours" },
    ],
    avoid:       "Before 10:00 and after 20:00",
    description: "Deliver during shop operating hours.",
  },
  restaurant: {
    label:       "Restaurant / F&B",
    icon:        "🍽️",
    color:       "#EA580C",
    bgColor:     "#FFF7ED",
    windows: [
      { start: "14:00", end: "17:00", label: "Afternoon break" },
    ],
    avoid:       "11:00 – 14:00 and 18:00 – 21:00 (peak service)",
    description: "Only deliver during afternoon break between meal services.",
  },
  warehouse: {
    label:       "Warehouse / Logistics",
    icon:        "🏭",
    color:       "#64748B",
    bgColor:     "#F1F5F9",
    windows: [
      { start: "08:00", end: "17:00", label: "Working hours" },
    ],
    avoid:       "After 17:00 and weekends",
    description: "Deliver during standard working hours only.",
  },
};

// Detect area type from address string
export function detectAreaType(address) {
  if (!address) return null;
  const lower = address.toLowerCase();

  for (const [type, keywords] of Object.entries(AREA_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return type;
      }
    }
  }
  return null; // unknown — dispatcher must select manually
}

// Check if current time falls within a delivery window
export function isWithinDeliveryWindow(areaType) {
  const windows = TIME_WINDOWS[areaType]?.windows;
  if (!windows) return true; // no constraint

  const now     = new Date();
  const current = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

  return windows.some(w => {
    const [startH, startM] = w.start.split(":").map(Number);
    const [endH,   endM  ] = w.end.split(":").map(Number);
    const start = startH * 60 + startM;
    const end   = endH   * 60 + endM;
    return current >= start && current <= end;
  });
}

// Get the next available delivery window message
export function getNextWindowMessage(areaType) {
  const windows = TIME_WINDOWS[areaType]?.windows;
  if (!windows) return "Anytime";

  const now     = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  for (const w of windows) {
    const [startH, startM] = w.start.split(":").map(Number);
    const start = startH * 60 + startM;
    if (start > current) {
      return `Next window: ${w.label} from ${w.start}`;
    }
  }
  return `Next window: Tomorrow ${windows[0].label} from ${windows[0].start}`;
}
