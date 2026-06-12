export type RiskStatus = "Low" | "Medium" | "High";
export type Severity = "Low" | "Medium" | "High" | "Critical";
export type CaseStatus =
  | "New"
  | "Investigating"
  | "Escalated"
  | "Confirmed Fraud"
  | "False Positive"
  | "Closed";

export interface SignalBreakdownItem {
  signal: string;
  label: string;
  weight: number;
  ecosystem_tier: number;
  triggered: boolean;
  description: string;
}

export interface RiskResult {
  risk_score: number;
  raw_score: number;
  risk_status: RiskStatus;
  recommended_action: string;
  breakdown: SignalBreakdownItem[];
  triggered: SignalBreakdownItem[];
}

export interface Account {
  id: number;
  account_id: string;
  loyalty_tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  account_age_days: number;
  points_balance: number;
  country: string;
  last_login_region: string;
  trusted_devices: number;
  risk_score: number;
  risk_status: RiskStatus;
  signals: Record<string, boolean>;
  days_between_change_and_booking: number | null;
  reviewed: boolean;
  created_at: string;
}

export interface AccountDetailData extends Account {
  risk_explanation: RiskResult;
  narrative: string;
  related_cases: CaseItem[];
}

export interface EventItem {
  id?: number;
  account_id?: string;
  event_type: string;
  timestamp: string;
  severity: Severity;
  risk_delta: number;
  description: string;
}

export interface CaseItem {
  id: number;
  case_id: string;
  account_id: string;
  severity: Severity;
  status: CaseStatus;
  assigned_analyst: string;
  summary: string;
  analyst_notes: string;
  recommended_action: string;
  created_at: string;
  updated_at: string;
}

export interface CaseDetailData extends CaseItem {
  account: Account | null;
  linked_events: EventItem[];
}

export interface ThreatIntelItem {
  id: number;
  title: string;
  category: string;
  severity: Severity;
  summary: string;
  related_signals: string[];
  ecosystem_tier: number;
  created_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "account" | "device" | "ip" | "guest" | "property" | "date";
  risk_score?: number;
  risk_status?: RiskStatus;
  suspicious?: boolean;
  cluster_ids?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  suspicious: boolean;
}

export interface ClusterMeta {
  cluster_id: string;
  cluster_type: string;
  description: string;
  severity: Severity;
  account_ids: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: ClusterMeta[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardStats {
  total_accounts: number;
  high_risk_accounts: number;
  open_investigations: number;
  flagged_guest_bookings: number;
  average_risk_score: number;
  risk_distribution: { bucket: string; count: number }[];
  events_over_time: { date: string; total: number; suspicious: number }[];
  cases_by_severity: { severity: Severity; count: number }[];
  event_type_frequency: { event_type: string; count: number }[];
  recent_events: EventItem[];
}

export interface SimulationInput {
  account_age_days: number;
  points_balance: number;
  loyalty_tier: string;
  new_device: boolean;
  password_changed: boolean;
  email_changed: boolean;
  phone_changed: boolean;
  dormant_account: boolean;
  guest_booking: boolean;
  high_value_redemption: boolean;
  same_property_cluster: boolean;
  days_between_change_and_booking: number | null;
}

export interface SimulationResult extends RiskResult {
  input: SimulationInput;
  timeline: EventItem[];
}

export interface SignalInfo {
  signal: string;
  label: string;
  weight: number;
  tier: number;
  description: string;
}

export interface RiskSignalsResponse {
  signals: SignalInfo[];
  risk_tiers: { name: string; min: number; max: number }[];
  recommended_actions: Record<string, string>;
}

// ---------------------------------------------------------------- ingestion

export interface DatasetItem {
  id: number;
  name: string;
  file_type: string;
  kind: string;
  status: string;
  rows_total: number;
  rows_accepted: number;
  rows_rejected: number;
  errors: { row: number; error: string; kind?: string }[];
  summary: {
    accepted?: Record<string, number>;
    pipeline?: {
      accounts_rescored: number;
      stub_accounts_created: number;
      clusters_detected: number;
      cluster_ids: string[];
    };
  };
  created_at: string;
}

export interface SystemMode {
  mode: "demo" | "uploaded";
  datasets: number;
  uploaded_accounts: number;
}

// ---------------------------------------------------------------- search

export interface SearchResult {
  type: "account" | "case" | "property" | "device" | "ip" | "guest" | "intel";
  id: string;
  label: string;
  sub: string;
  risk_status?: RiskStatus;
  link: string;
}

// ---------------------------------------------------------------- properties

export interface PropertyRiskItem {
  name: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  bookings: number;
  suspicious_bookings: number;
  points_redeemed: number;
  suspicious_points: number;
  linked_accounts: { account_id: string; risk_score: number; risk_status: RiskStatus }[];
  high_risk_accounts: number;
  cluster_ids: string[];
  risk_index: number;
  recent_bookings: BookingItem[];
}

export interface BookingItem {
  id: number;
  account_id: string;
  guest_name: string;
  property_name: string;
  booking_date: string;
  points_used: number;
  suspicious: boolean;
}

export interface DestinationRow {
  country: string;
  properties: number;
  bookings: number;
  suspicious_bookings: number;
  points_redeemed: number;
  suspicious_ratio: number;
}

export interface PropertyRiskResponse {
  mode: string;
  properties: PropertyRiskItem[];
  destinations: DestinationRow[];
  unmapped: string[];
}

// ---------------------------------------------------------------- economics

export interface EconImpact {
  mode: string;
  point_value_usd: number;
  points_at_risk: number;
  usd_at_risk: number;
  points_watchlist: number;
  usd_watchlist: number;
  suspicious_redemption_points: number;
  suspicious_redemption_usd: number;
  interdicted_points: number;
  interdicted_usd: number;
  confirmed_fraud_accounts: number;
  confirmed_fraud_balance_points: number;
  confirmed_fraud_balance_usd: number;
  false_positive_accounts: number;
  open_cases: number;
  high_risk_accounts: number;
  exposure_by_tier: { tier: string; accounts: number; high_risk: number; points_at_risk: number; usd_at_risk: number }[];
  exposure_trend: { date: string; points: number; usd: number }[];
  top_exposed_properties: { property: string; points: number; usd: number }[];
  methodology: string[];
}

// ---------------------------------------------------------------- ecosystem

export interface EcosystemTier {
  tier: number;
  name: string;
  actor: string;
  description: string;
  signals: { signal: string; label: string; weight: number; triggered_count: number }[];
  signal_triggers: number;
  active_accounts: number;
  dominant_accounts: number;
  example_accounts: { account_id: string; risk_score: number; risk_status: RiskStatus }[];
  intel_notes: number;
}

export interface EcosystemResponse {
  mode: string;
  tiers: EcosystemTier[];
  total_accounts: number;
  accounts_in_ecosystem: number;
}

// ---------------------------------------------------------------- graph entity

export interface EntityDetail {
  node_id: string;
  node_type: string;
  account?: Account;
  devices?: { device_id: string; ip_address: string; suspicious: boolean }[];
  bookings?: BookingItem[];
  cases?: CaseItem[];
  clusters?: ClusterMeta[];
  recent_events?: EventItem[];
  linked_accounts?: { account_id: string; risk_score: number; risk_status: RiskStatus; loyalty_tier: string; points_balance: number }[];
  property?: { name: string; city?: string; country?: string };
  suspicious?: boolean;
}
