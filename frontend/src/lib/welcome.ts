export const WELCOMED_KEY = "globecloud_welcomed";

export function hasWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markWelcomed() {
  localStorage.setItem(WELCOMED_KEY, "1");
}
