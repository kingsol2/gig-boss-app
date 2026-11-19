import type {
  AnalysisWindowDays,
  CompletedDeliveryRecord,
  ProfitabilityThresholds,
  ProfitabilityZone,
  USStateCode,
} from "./profitIntelligence.ts";

export const PROVISIONAL_SHARED_RANKING_MINIMUMS = {
  minimumCompletedDeliveries: 30,
  minimumActiveDays: 7,
  minimumContributors: 10,
} as const;

export interface GeographicZoneIdentity {
  stateCode: USStateCode;
  marketId: string;
  zoneId: string;
  marketTimeZone: string;
}

export interface VerifiedGeographicDeliveryObservation extends CompletedDeliveryRecord {
  verificationStatus: "verified";
  contributorId: string;
  geography: GeographicZoneIdentity;
  datasetVersion: string;
}

export interface GeographicRankingPolicy {
  minimumCompletedDeliveries: number;
  minimumActiveDays: number;
  minimumContributors: number;
  minimumDataCompleteness: number;
  maximumObservationAgeDays: number;
}

export interface GeographicRankingOptions {
  asOf: string;
  windowDays: AnalysisWindowDays;
  datasetVersion: string;
  costPerMile: number;
  thresholds: ProfitabilityThresholds;
  policy: GeographicRankingPolicy;
}

export type GeographicClassification = ProfitabilityZone | "gray";

export type GeographicInsufficientDataCode =
  | "too-few-observations"
  | "too-few-active-days"
  | "too-few-contributors"
  | "low-data-completeness"
  | "stale-observations"
  | "unavailable-net-hourly"
  | "unavailable-net-per-mile";

export interface GeographicDataIssue {
  code: GeographicInsufficientDataCode;
  message: string;
}

export interface GeographicConfidenceFactor {
  key: "sample-size" | "active-days" | "contributors" | "data-completeness" | "recency";
  score: number;
  weight: number;
  explanation: string;
}

export interface GeographicConfidence {
  score: number;
  level: "low" | "medium" | "high";
  factors: GeographicConfidenceFactor[];
}

export interface GeographicZoneMetrics {
  estimatedNetEarnings: number;
  estimatedNetHourly: number;
  estimatedNetPerMile: number;
  totalMiles: number;
  totalDurationMinutes: number;
}

export interface GeographicZoneRanking {
  stateCode: USStateCode;
  marketId: string;
  zoneId: string;
  marketTimeZone: string;
  analysisWindowDays: AnalysisWindowDays;
  windowStartLocalDate: string;
  windowEndLocalDate: string;
  datasetVersion: string;
  observationCount: number;
  completeObservationCount: number;
  activeDayCount: number;
  contributorCount: number;
  dataCompleteness: number;
  confidence: GeographicConfidence;
  classification: GeographicClassification;
  rank: number | null;
  metrics: GeographicZoneMetrics | null;
  insufficientDataIssues: GeographicDataIssue[];
  privacySuppressed: boolean;
}

export type GeographicInputExclusionCode =
  | "invalid-observation"
  | "unverified-observation"
  | "not-completed"
  | "duplicate-observation"
  | "future-dated-observation"
  | "outside-analysis-window"
  | "dataset-version-mismatch"
  | "timezone-mismatch";

export interface GeographicExclusionSummary {
  code: GeographicInputExclusionCode;
  count: number;
}

export interface GeographicRankingResult {
  status: "ranked" | "insufficient-data" | "no-data" | "invalid-configuration";
  analysisWindowDays: AnalysisWindowDays;
  datasetVersion: string;
  generatedAsOf: string;
  zones: GeographicZoneRanking[];
  exclusionSummary: GeographicExclusionSummary[];
  configurationIssues: string[];
}
