export type Theme = "light" | "dark";

/** Bảng màu token theo theme — dùng cho Chart.js (canvas không đọc CSS var). */
export function themeColors(t: Theme): Record<string, string> {
  if (t === "dark") {
    return {
      "--bg": "#0e1013", "--surface": "#16191e", "--surface-2": "#1b1f26",
      "--border": "#262b33", "--border-strong": "#333a44",
      "--text": "#e6e8eb", "--muted": "#9aa4b2", "--faint": "#6b7480",
      "--accent": "#3b82f6", "--accent-soft": "#16233b",
      "--good": "#22c55e", "--warn": "#f59e0b", "--danger": "#f87171",
      "--danger-soft": "#2a1a1c", "--row-hover": "#1b2028",
    };
  }
  return {
    "--bg": "#f6f7f9", "--surface": "#ffffff", "--surface-2": "#fbfcfd",
    "--border": "#e8eaed", "--border-strong": "#d1d5db",
    "--text": "#14171a", "--muted": "#6b7280", "--faint": "#9ca3af",
    "--accent": "#2563eb", "--accent-soft": "#eff4ff",
    "--good": "#16a34a", "--warn": "#d97706", "--danger": "#dc2626",
    "--danger-soft": "#fef2f2", "--row-hover": "#f7f8fa",
  };
}

export function chartGrid(t: Theme): string {
  return t === "dark" ? "rgba(255,255,255,.07)" : "rgba(15,23,42,.07)";
}
export function chartTick(t: Theme): string {
  return t === "dark" ? "#9aa4b2" : "#6b7280";
}
