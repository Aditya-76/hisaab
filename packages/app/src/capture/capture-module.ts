import { NativeModules } from "react-native";

/**
 * TS mirror of the Kotlin CaptureModule bridge — the only "API contract" in
 * a serverless app (TECH-DESIGN §5.3). Raw-event flow never crosses this
 * bridge: native writes SQLite, JS reads SQLite.
 */
export interface CaptureStatus {
  notificationAccess: boolean;
  smsGranted: boolean;
  lastEventAt: string | null;
}

export interface OemInfo {
  manufacturer: string;
  knownAggressive: boolean;
}

export interface CaptureModuleSpec {
  getCaptureStatus(): Promise<CaptureStatus>;
  openNotificationAccessSettings(): void;
  requestSmsPermission(): Promise<boolean>;
  runSmsBackfill(days: number): Promise<{ imported: number }>;
  getOemInfo(): Promise<OemInfo>;
  emitTestNotification(): Promise<void>;
}

export function captureModule(): CaptureModuleSpec {
  const module = (NativeModules as Record<string, unknown>).CaptureModule;
  if (module == null) {
    throw new Error(
      "CaptureModule native module not linked — is the app running outside the Android build?",
    );
  }
  return module as CaptureModuleSpec;
}
