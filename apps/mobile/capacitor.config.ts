import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.drivewise.mobile",
  appName: "DriveWise",
  webDir: "dist",
  android: {
    // @capacitor-community/background-geolocation requires this: without
    // it, Android silently stops delivering location updates ~5 minutes
    // after the app backgrounds, because Capacitor's default WebView
    // bridge (not this legacy one) throttles JS execution in the
    // background the same way any background tab would. See
    // https://github.com/capacitor-community/background-geolocation/issues/89
    useLegacyBridge: true,
  },
};

export default config;
