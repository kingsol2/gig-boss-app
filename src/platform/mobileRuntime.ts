export type RuntimePlatform = "web" | "pwa" | "ios-native" | "android-native";
export type PermissionResult = PermissionState | "unsupported";

export interface PlatformCapabilities {
  requestNotificationPermission(): Promise<PermissionResult>;
  requestLocationPermission(): Promise<PermissionResult>;
}

interface CapacitorRuntime {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
}

declare global {
  interface Window {
    Capacitor?: CapacitorRuntime;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function detectRuntimePlatform(): RuntimePlatform {
  const nativePlatform = window.Capacitor?.isNativePlatform?.()
    ? window.Capacitor.getPlatform?.()
    : undefined;
  if (nativePlatform === "ios") return "ios-native";
  if (nativePlatform === "android") return "android-native";
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  ) {
    return "pwa";
  }
  return "web";
}

const browserCapabilities: PlatformCapabilities = {
  async requestNotificationPermission() {
    if (!("Notification" in window)) return "unsupported";
    const permission = await Notification.requestPermission();
    return permission === "default" ? "prompt" : permission;
  },
  async requestLocationPermission() {
    if (!("geolocation" in navigator)) return "unsupported";
    if (!navigator.permissions) return "prompt";
    try {
      return (await navigator.permissions.query({ name: "geolocation" })).state;
    } catch {
      return "prompt";
    }
  },
};

let activeCapabilities: PlatformCapabilities = browserCapabilities;

/**
 * A future Capacitor bootstrap can register native permission adapters without
 * coupling shared screens to Capacitor packages.
 */
export const platformCapabilities: PlatformCapabilities = {
  requestNotificationPermission: () => activeCapabilities.requestNotificationPermission(),
  requestLocationPermission: () => activeCapabilities.requestLocationPermission(),
};

export function registerPlatformCapabilities(capabilities: PlatformCapabilities) {
  activeCapabilities = capabilities;
}

export function initializeMobileRuntime() {
  const root = document.documentElement;
  root.dataset.runtime = detectRuntimePlatform();

  const updateViewport = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    root.style.setProperty("--app-height", `${Math.round(height)}px`);
    root.dataset.keyboardOpen = String(
      Boolean(viewport && window.innerHeight - viewport.height - viewport.offsetTop > 150),
    );
  };

  updateViewport();
  window.addEventListener("resize", updateViewport, { passive: true });
  window.addEventListener("orientationchange", updateViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", updateViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", updateViewport, { passive: true });
}
