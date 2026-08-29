import type { AppState } from "./domain";

export const defaultState: AppState = {
  workspace: {
    businessName: "",
    websiteUrl: "",
    category: "",
    currency: "USD",
    timezone: "Asia/Karachi",
    maxDailyBudget: 200,
    connected: false,
  },
  proposals: [],
  auditEvents: [],
};

const STORAGE_KEY = "adpilot-prototype-v1";

export function readState(): AppState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppState) : defaultState;
  } catch {
    return defaultState;
  }
}

export function writeState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState() {
  window.localStorage.removeItem(STORAGE_KEY);
}
