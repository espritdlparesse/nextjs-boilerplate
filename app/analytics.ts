import { apiFetch } from "@/app/apiFetch";

export function fireAnalytics(event: string, properties?: Record<string, unknown>) {
  apiFetch("/api/v2/analytics", {
    method: "POST",
    body: JSON.stringify({ event, properties: properties ?? {} }),
  }).catch(() => undefined);
}
