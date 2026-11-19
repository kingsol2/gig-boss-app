import type { Delivery, GigPlatform } from "./models.ts";

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export type USStateCode = (typeof US_STATES)[number]["code"];
export type AnalysisWindowDays = 30 | 60 | 90;
export type ProfitabilityZone = "green" | "yellow" | "red";
export type OfferStatus = "projected" | "accepted" | "rejected" | "expired";

export interface RecordedProfitExpense {
  id: string;
  amount: number;
  category?: string;
  includedInMileageCost?: boolean;
}

export interface CompletedDeliveryRecord extends Delivery {
  recordType: "completed-delivery";
  status: "completed";
  completedAt: string;
  recordedExpenses?: readonly RecordedProfitExpense[];
  stateCode?: USStateCode;
  marketId?: string;
}

export interface DeliveryOfferRecord {
  id: string;
  recordType: "delivery-offer";
  status: OfferStatus;
  platform: GigPlatform;
  offeredAt: string;
  projectedGross: number;
  projectedMiles: number;
  projectedDurationMinutes: number;
  projectedAdditionalExpenses?: number;
  stateCode?: USStateCode;
  marketId?: string;
}

export type ProfitIntelligenceRecord = CompletedDeliveryRecord | DeliveryOfferRecord;

export interface CostAssumptions {
  costPerMile: number;
}

export interface DeliveryProfitOptions extends CostAssumptions {
  asOf: string;
}

export interface ProfitabilityThresholds {
  greenMinimumNetHourly: number;
  yellowMinimumNetHourly: number;
  greenMinimumNetPerMile: number;
  yellowMinimumNetPerMile: number;
}

export interface GeographicProfitabilityProfile {
  stateCode: USStateCode;
  marketId?: string;
  availability: "available" | "unavailable";
  thresholds?: ProfitabilityThresholds;
  sourceLabel?: string;
  datasetVersion?: string;
  dataAsOf?: string;
  sampleSize?: number;
}

export interface EarningsAnalysisOptions extends CostAssumptions {
  asOf: string;
  windowDays: AnalysisWindowDays;
  minimumCompletedDeliveries: number;
  minimumActiveDays: number;
}

export interface OfferEvaluationOptions extends CostAssumptions {
  asOf: string;
  thresholds: ProfitabilityThresholds;
  geographicProfile?: GeographicProfitabilityProfile;
}

export type InsufficientDataCode =
  | "invalid-record"
  | "invalid-cost-assumption"
  | "invalid-thresholds"
  | "invalid-analysis-window"
  | "invalid-date"
  | "future-dated-record"
  | "not-completed"
  | "offer-not-active"
  | "missing-or-zero-mileage"
  | "missing-or-zero-duration"
  | "invalid-amount"
  | "invalid-expense"
  | "too-few-deliveries"
  | "too-few-active-days"
  | "no-completed-deliveries";

export interface DataIssue {
  code: InsufficientDataCode;
  message: string;
  recordId?: string;
}

export interface CalculatedMetric {
  status: "available" | "insufficient-data";
  value: number | null;
  issue?: DataIssue;
}

export interface DeliveryProfitMetrics {
  grossEarnings: number;
  recordedTips: number;
  mileageCost: number;
  additionalExpenses: number;
  estimatedNetEarnings: number;
  estimatedNetPerMile: CalculatedMetric;
  estimatedNetHourly: CalculatedMetric;
}

export interface DeliveryProfitResult {
  status: "calculated" | "insufficient-data" | "excluded";
  deliveryId?: string;
  metrics: DeliveryProfitMetrics | null;
  issues: DataIssue[];
  countedExpenseIds: string[];
}

export interface ConfidenceFactor {
  key: "sample-size" | "active-days" | "data-completeness" | "recency";
  score: number;
  weight: number;
  explanation: string;
}

export interface ConfidenceResult {
  score: number;
  level: "low" | "medium" | "high";
  factors: ConfidenceFactor[];
}

export interface EarningsSummaryMetrics {
  grossEarnings: number;
  recordedTips: number;
  mileageCost: number;
  additionalExpenses: number;
  estimatedNetEarnings: number;
  totalMiles: number;
  totalDurationMinutes: number;
  completedDeliveryCount: number;
  activeDayCount: number;
  estimatedNetPerMile: CalculatedMetric;
  estimatedNetHourly: CalculatedMetric;
}

export interface ExcludedRecord {
  recordId?: string;
  issues: DataIssue[];
}

export interface EarningsSummaryResult {
  status: "calculated" | "insufficient-data";
  windowDays: AnalysisWindowDays;
  windowStart: string;
  windowEnd: string;
  metrics: EarningsSummaryMetrics;
  confidence: ConfidenceResult;
  issues: DataIssue[];
  includedDeliveryIds: string[];
  excludedRecords: ExcludedRecord[];
}

export interface OfferEvaluationResult {
  status: "evaluated" | "insufficient-data" | "excluded";
  offerId?: string;
  zone: ProfitabilityZone | null;
  recommendation: "strong" | "conditional" | "poor" | null;
  metrics: DeliveryProfitMetrics | null;
  issues: DataIssue[];
  geographyApplied: boolean;
  geographicProfile?: GeographicProfitabilityProfile;
}

export interface PlatformProfitComparison {
  platform: GigPlatform;
  rank: number;
  summary: EarningsSummaryResult;
}

export interface PlatformComparisonResult {
  status: "calculated" | "insufficient-data";
  comparisons: PlatformProfitComparison[];
  overall: EarningsSummaryResult;
}
