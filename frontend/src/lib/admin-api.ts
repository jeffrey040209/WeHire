import { API_URL } from "@/lib/api";

export async function adminRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const csrf = await fetch(`${API_URL}/auth/csrf`, { credentials: "include", cache: "no-store" });
    if (csrf.status === 401) { window.location.replace("/sign-in"); throw new Error("Please sign in again."); }
    if (!csrf.ok) throw new Error("Unable to verify your session. Please try again.");
    headers["X-CSRF-Token"] = (await csrf.json()).csrf_token;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_URL}${path}`, {
    method, headers, credentials: "include", cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 401) { window.location.replace("/sign-in"); throw new Error("Your session has ended. Please sign in again."); }
  if (response.status === 403) throw new Error("You do not have permission to perform this action.");
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.detail === "string" ? payload.detail : "The request could not be completed.");
  }
  return response.status === 204 ? undefined as T : response.json();
}
