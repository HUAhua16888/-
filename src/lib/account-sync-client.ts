export const accountSyncDeviceStorageKey = "tongqu-growth-web-account-sync-device";

function createFallbackDeviceId() {
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getAccountSyncDeviceInfo() {
  if (typeof window === "undefined") {
    return {
      deviceId: "server",
      deviceName: "server",
    };
  }

  const existing = window.localStorage.getItem(accountSyncDeviceStorageKey)?.trim();
  const deviceId =
    existing ||
    (window.crypto?.randomUUID ? window.crypto.randomUUID() : createFallbackDeviceId());
  const deviceName = [
    window.navigator.platform,
    window.navigator.language,
    window.screen ? `${window.screen.width}x${window.screen.height}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 120);

  if (!existing) {
    window.localStorage.setItem(accountSyncDeviceStorageKey, deviceId);
  }

  return {
    deviceId,
    deviceName: deviceName || "browser",
  };
}
