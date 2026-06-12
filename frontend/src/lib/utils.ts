import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const riskColors: Record<string, string> = {
  Low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  High: "bg-red-500/10 text-red-400 border-red-500/30",
  Critical: "bg-red-500/20 text-red-300 border-red-500/40",
};

export const statusColors: Record<string, string> = {
  New: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  Investigating: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  Escalated: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "Confirmed Fraud": "bg-red-500/10 text-red-400 border-red-500/30",
  "False Positive": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Closed: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

export const riskHex: Record<string, string> = {
  Low: "#10B981",
  Medium: "#F59E0B",
  High: "#EF4444",
  Critical: "#EF4444",
};

export const eventLabels: Record<string, string> = {
  login_new_device: "Login from new device",
  password_changed: "Password changed",
  email_changed: "Email changed",
  phone_changed: "Phone changed",
  balance_viewed: "Balance viewed",
  guest_booking_created: "Guest booking created",
  high_value_redemption: "High-value redemption",
  destination_cluster_detected: "Destination cluster detected",
  analyst_review: "Analyst review",
};

export function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

export function formatDateShort(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function formatPoints(n: number) {
  return n.toLocaleString("en-US");
}

export function tierLabel(tier: number) {
  return tier === 0 ? "Protective" : `Tier ${tier}`;
}
