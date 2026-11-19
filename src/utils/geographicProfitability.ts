import { roundCurrency } from "../lib/calculations.ts";
import { GIG_PLATFORMS, type GigPlatform } from "../types/models.ts";
import {
  type GeographicConfidence,
  type GeographicConfidenceFactor,
  type GeographicDataIssue,
  type GeographicExclusionSummary,
  type GeographicInputExclusionCode,
  type GeographicRankingOptions,
  type GeographicRankingPolicy,
  type GeographicRankingResult,
  type GeographicZoneIdentity,
  type GeographicZoneMetrics,
  type GeographicZoneRanking,
  type VerifiedGeographicDeliveryObservation,
} from "../types/geographicProfitIntelligence.ts";
import {
  US_STATES,
  type CompletedDeliveryRecord,
  type ProfitabilityThresholds,
  type USStateCode,
} from "../types/profitIntelligence.ts";
import {
  calculateDeliveryProfit,
  calculateEarningsPerMile,
  calculateHourlyEarnings,
  isCompletedDeliveryRecord,
  isDeliveryOfferRecord,
} from "./gigBossAlgorithm.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isStateCode = (value: unknown): value is USStateCode =>
  typeof value === "string" && US_STATES.some((state) => state.code === value);

const isGigPlatform = (value: unknown): value is GigPlatform =>
  typeof value === "string" && GIG_PLATFORMS.includes(value as GigPlatform);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isIanaTimeZone = (value: unknown): value is string => {
  if (!nonEmptyString(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};

const datePartsInTimeZone = (
  timestamp: number,
  timeZone: string,
): { year: number; month: number; day: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
};

const localDateKey = (timestamp: number, timeZone: string): string => {
  const { year, month, day } = datePartsInTimeZone(timestamp, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const shiftDateKey = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const calendarDayDifference = (laterDateKey: string, earlierDateKey: string): number =>
  Math.max(
    0,
    Math.round(
      (Date.parse(`${laterDateKey}T00:00:00.000Z`) -
        Date.parse(`${earlierDateKey}T00:00:00.000Z`)) /
        DAY_MS,
    ),
  );

const validThresholds = (thresholds: ProfitabilityThresholds): boolean => {
  const values = [
    thresholds.greenMinimumNetHourly,
    thresholds.yellowMinimumNetHourly,
    thresholds.greenMinimumNetPerMile,
    thresholds.yellowMinimumNetPerMile,
  ];
  return (
    values.every(isFiniteNonNegative) &&
    thresholds.greenMinimumNetHourly >= thresholds.yellowMinimumNetHourly &&
    thresholds.greenMinimumNetPerMile >= thresholds.yellowMinimumNetPerMile
  );
};

const validPolicy = (policy: GeographicRankingPolicy): boolean =>
  isPositiveInteger(policy.minimumCompletedDeliveries) &&
  isPositiveInteger(policy.minimumActiveDays) &&
  isPositiveInteger(policy.minimumContributors) &&
  isFiniteNonNegative(policy.minimumDataCompleteness) &&
  policy.minimumDataCompleteness <= 1 &&
  Number.isInteger(policy.maximumObservationAgeDays) &&
  policy.maximumObservationAgeDays >= 0;

const validGeography = (value: unknown): value is GeographicZoneIdentity =>
  isObject(value) &&
  isStateCode(value.stateCode) &&
  nonEmptyString(value.marketId) &&
  nonEmptyString(value.zoneId) &&
  isIanaTimeZone(value.marketTimeZone);

const validRecordedExpenses = (value: unknown): boolean =>
  value === undefined ||
  (Array.isArray(value) &&
    value.every(
      (expense) =>
        isObject(expense) &&
        nonEmptyString(expense.id) &&
        isFiniteNonNegative(expense.amount) &&
        (expense.includedInMileageCost === undefined ||
          typeof expense.includedInMileageCost === "boolean"),
    ));

export const isVerifiedGeographicDeliveryObservation = (
  value: unknown,
): value is VerifiedGeographicDeliveryObservation =>
  isCompletedDeliveryRecord(value) &&
  isObject(value) &&
  value.verificationStatus === "verified" &&
  nonEmptyString(value.contributorId) &&
  validGeography(value.geography) &&
  nonEmptyString(value.datasetVersion) &&
  validRecordedExpenses(value.recordedExpenses) &&
  isGigPlatform(value.platform);

const incrementExclusion = (
  counts: Map<GeographicInputExclusionCode, number>,
  code: GeographicInputExclusionCode,
) => counts.set(code, (counts.get(code) ?? 0) + 1);

const exclusionSummary = (
  counts: Map<GeographicInputExclusionCode, number>,
): GeographicExclusionSummary[] =>
  [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => ({ code, count }));

const configurationIssues = (options: GeographicRankingOptions): string[] => {
  const issues: string[] = [];
  if (!Number.isFinite(Date.parse(options.asOf)))
    issues.push("The geographic analysis as-of timestamp is invalid.");
  if (![30, 60, 90].includes(options.windowDays))
    issues.push("The geographic analysis window must be exactly 30, 60, or 90 days.");
  if (!nonEmptyString(options.datasetVersion))
    issues.push("A non-empty dataset version is required.");
  if (!isFiniteNonNegative(options.costPerMile))
    issues.push("Cost per mile must be a finite, non-negative number.");
  if (!validThresholds(options.thresholds))
    issues.push(
      "Profitability thresholds must be non-negative and green minimums must meet or exceed yellow minimums.",
    );
  if (!validPolicy(options.policy))
    issues.push("The geographic data-quality and privacy policy is invalid.");
  return issues;
};

interface AcceptedObservation {
  observation: VerifiedGeographicDeliveryObservation;
  localDate: string;
}

interface ZoneAccumulator {
  identity: GeographicZoneIdentity;
  observations: AcceptedObservation[];
  windowStartLocalDate: string;
  windowEndLocalDate: string;
}

const zoneKey = (identity: GeographicZoneIdentity): string =>
  [identity.stateCode, identity.marketId, identity.zoneId].join("\u001f");

const confidenceForZone = (
  observationCount: number,
  activeDayCount: number,
  contributorCount: number,
  dataCompleteness: number,
  latestAgeDays: number,
  policy: GeographicRankingPolicy,
): GeographicConfidence => {
  const recencyScore =
    policy.maximumObservationAgeDays === 0
      ? Number(latestAgeDays === 0)
      : Math.max(0, 1 - latestAgeDays / (policy.maximumObservationAgeDays + 1));
  const factors: GeographicConfidenceFactor[] = [
    {
      key: "sample-size",
      score: Math.min(1, observationCount / policy.minimumCompletedDeliveries),
      weight: 0.25,
      explanation: `${observationCount} verified observations; ${policy.minimumCompletedDeliveries} required.`,
    },
    {
      key: "active-days",
      score: Math.min(1, activeDayCount / policy.minimumActiveDays),
      weight: 0.15,
      explanation: `${activeDayCount} market-local active days; ${policy.minimumActiveDays} required.`,
    },
    {
      key: "contributors",
      score: Math.min(1, contributorCount / policy.minimumContributors),
      weight: 0.25,
      explanation: `${contributorCount} distinct contributors; ${policy.minimumContributors} required.`,
    },
    {
      key: "data-completeness",
      score: dataCompleteness,
      weight: 0.2,
      explanation: `${roundCurrency(dataCompleteness * 100)}% of observations include positive mileage and duration.`,
    },
    {
      key: "recency",
      score: recencyScore,
      weight: 0.15,
      explanation: `Latest observation is ${latestAgeDays} market-local calendar days old; maximum is ${policy.maximumObservationAgeDays}.`,
    },
  ];
  const weightedScore = roundCurrency(
    factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0) * 100,
  );
  const minimumsMet =
    observationCount >= policy.minimumCompletedDeliveries &&
    activeDayCount >= policy.minimumActiveDays &&
    contributorCount >= policy.minimumContributors &&
    dataCompleteness >= policy.minimumDataCompleteness &&
    latestAgeDays <= policy.maximumObservationAgeDays;
  const score = minimumsMet ? weightedScore : Math.min(49, weightedScore);
  return {
    score,
    level: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    factors,
  };
};

const dataIssues = (
  observationCount: number,
  activeDayCount: number,
  contributorCount: number,
  dataCompleteness: number,
  latestAgeDays: number,
  policy: GeographicRankingPolicy,
  netHourlyAvailable: boolean,
  netPerMileAvailable: boolean,
): GeographicDataIssue[] => {
  const issues: GeographicDataIssue[] = [];
  if (observationCount < policy.minimumCompletedDeliveries)
    issues.push({
      code: "too-few-observations",
      message: `${observationCount} observations are available; ${policy.minimumCompletedDeliveries} are required.`,
    });
  if (activeDayCount < policy.minimumActiveDays)
    issues.push({
      code: "too-few-active-days",
      message: `${activeDayCount} active days are available; ${policy.minimumActiveDays} are required.`,
    });
  if (contributorCount < policy.minimumContributors)
    issues.push({
      code: "too-few-contributors",
      message: `${contributorCount} contributors are available; ${policy.minimumContributors} are required.`,
    });
  if (dataCompleteness < policy.minimumDataCompleteness)
    issues.push({
      code: "low-data-completeness",
      message: `${roundCurrency(dataCompleteness * 100)}% completeness is available; ${roundCurrency(policy.minimumDataCompleteness * 100)}% is required.`,
    });
  if (latestAgeDays > policy.maximumObservationAgeDays)
    issues.push({
      code: "stale-observations",
      message: `The latest observation is ${latestAgeDays} days old; the maximum is ${policy.maximumObservationAgeDays}.`,
    });
  if (!netHourlyAvailable)
    issues.push({
      code: "unavailable-net-hourly",
      message: "Estimated net hourly earnings cannot be calculated.",
    });
  if (!netPerMileAvailable)
    issues.push({
      code: "unavailable-net-per-mile",
      message: "Estimated net per mile cannot be calculated.",
    });
  return issues;
};

const classifyZone = (
  metrics: GeographicZoneMetrics,
  thresholds: ProfitabilityThresholds,
): "green" | "yellow" | "red" => {
  if (
    metrics.estimatedNetHourly >= thresholds.greenMinimumNetHourly &&
    metrics.estimatedNetPerMile >= thresholds.greenMinimumNetPerMile
  )
    return "green";
  if (
    metrics.estimatedNetHourly >= thresholds.yellowMinimumNetHourly &&
    metrics.estimatedNetPerMile >= thresholds.yellowMinimumNetPerMile
  )
    return "yellow";
  return "red";
};

const aggregateZone = (
  zone: ZoneAccumulator,
  options: GeographicRankingOptions,
): GeographicZoneRanking => {
  const complete = zone.observations.filter(
    ({ observation }) => observation.miles > 0 && observation.durationMinutes > 0,
  );
  const activeDayCount = new Set(zone.observations.map((item) => item.localDate)).size;
  const contributorCount = new Set(
    zone.observations.map(({ observation }) => observation.contributorId),
  ).size;
  const dataCompleteness = zone.observations.length
    ? complete.length / zone.observations.length
    : 0;
  const latestLocalDate = [...zone.observations]
    .map((item) => item.localDate)
    .sort()
    .at(-1)!;
  const latestAgeDays = calendarDayDifference(zone.windowEndLocalDate, latestLocalDate);

  const seenExpenseIds = new Set<string>();
  const profitResults = complete.map(({ observation }) => {
    const uniqueExpenses = observation.recordedExpenses?.filter((expense) => {
      if (seenExpenseIds.has(expense.id)) return false;
      seenExpenseIds.add(expense.id);
      return true;
    });
    return calculateDeliveryProfit(
      { ...observation, recordedExpenses: uniqueExpenses },
      { costPerMile: options.costPerMile, asOf: options.asOf },
    );
  });
  const totals = {
    estimatedNetEarnings: profitResults.reduce(
      (sum, result) => sum + (result.metrics?.estimatedNetEarnings ?? 0),
      0,
    ),
    totalMiles: complete.reduce((sum, item) => sum + item.observation.miles, 0),
    totalDurationMinutes: complete.reduce((sum, item) => sum + item.observation.durationMinutes, 0),
  };
  const netPerMile = calculateEarningsPerMile({
    estimatedNetEarnings: totals.estimatedNetEarnings,
    miles: totals.totalMiles,
  });
  const netHourly = calculateHourlyEarnings({
    estimatedNetEarnings: totals.estimatedNetEarnings,
    durationMinutes: totals.totalDurationMinutes,
  });
  const issues = dataIssues(
    zone.observations.length,
    activeDayCount,
    contributorCount,
    dataCompleteness,
    latestAgeDays,
    options.policy,
    netHourly.status === "available",
    netPerMile.status === "available",
  );
  const privacySuppressed = contributorCount < options.policy.minimumContributors;
  const confidence = confidenceForZone(
    zone.observations.length,
    activeDayCount,
    contributorCount,
    dataCompleteness,
    latestAgeDays,
    options.policy,
  );
  const eligible = issues.length === 0;
  const metrics: GeographicZoneMetrics | null =
    eligible && netHourly.value !== null && netPerMile.value !== null
      ? {
          estimatedNetEarnings: roundCurrency(totals.estimatedNetEarnings),
          estimatedNetHourly: netHourly.value,
          estimatedNetPerMile: netPerMile.value,
          totalMiles: roundCurrency(totals.totalMiles),
          totalDurationMinutes: totals.totalDurationMinutes,
        }
      : null;

  return {
    ...zone.identity,
    analysisWindowDays: options.windowDays,
    windowStartLocalDate: zone.windowStartLocalDate,
    windowEndLocalDate: zone.windowEndLocalDate,
    datasetVersion: options.datasetVersion,
    observationCount: zone.observations.length,
    completeObservationCount: complete.length,
    activeDayCount,
    contributorCount,
    dataCompleteness: roundCurrency(dataCompleteness),
    confidence,
    classification: metrics ? classifyZone(metrics, options.thresholds) : "gray",
    rank: null,
    metrics,
    insufficientDataIssues: issues,
    privacySuppressed,
  };
};

export const rankGeographicProfitabilityZones = (
  records: readonly unknown[],
  options: GeographicRankingOptions,
): GeographicRankingResult => {
  const configIssues = configurationIssues(options);
  if (configIssues.length) {
    return {
      status: "invalid-configuration",
      analysisWindowDays: options.windowDays,
      datasetVersion: options.datasetVersion,
      generatedAsOf: options.asOf,
      zones: [],
      exclusionSummary: [],
      configurationIssues: configIssues,
    };
  }

  const asOf = Date.parse(options.asOf);
  const exclusions = new Map<GeographicInputExclusionCode, number>();
  const seenIds = new Set<string>();
  const zones = new Map<string, ZoneAccumulator>();

  for (const record of records) {
    if (isDeliveryOfferRecord(record)) {
      incrementExclusion(exclusions, "not-completed");
      continue;
    }
    if (isObject(record) && record.verificationStatus !== "verified") {
      incrementExclusion(exclusions, "unverified-observation");
      continue;
    }
    if (!isVerifiedGeographicDeliveryObservation(record)) {
      incrementExclusion(exclusions, "invalid-observation");
      continue;
    }
    if (seenIds.has(record.id)) {
      incrementExclusion(exclusions, "duplicate-observation");
      continue;
    }
    seenIds.add(record.id);
    if (record.datasetVersion !== options.datasetVersion) {
      incrementExclusion(exclusions, "dataset-version-mismatch");
      continue;
    }
    const completedAt = Date.parse(record.completedAt);
    if (completedAt > asOf) {
      incrementExclusion(exclusions, "future-dated-observation");
      continue;
    }

    const endLocalDate = localDateKey(asOf, record.geography.marketTimeZone);
    const startLocalDate = shiftDateKey(endLocalDate, -(options.windowDays - 1));
    const completedLocalDate = localDateKey(completedAt, record.geography.marketTimeZone);
    if (completedLocalDate < startLocalDate || completedLocalDate > endLocalDate) {
      incrementExclusion(exclusions, "outside-analysis-window");
      continue;
    }

    const key = zoneKey(record.geography);
    const existing = zones.get(key);
    if (existing && existing.identity.marketTimeZone !== record.geography.marketTimeZone) {
      incrementExclusion(exclusions, "timezone-mismatch");
      continue;
    }
    if (existing) {
      existing.observations.push({ observation: record, localDate: completedLocalDate });
    } else {
      zones.set(key, {
        identity: record.geography,
        observations: [{ observation: record, localDate: completedLocalDate }],
        windowStartLocalDate: startLocalDate,
        windowEndLocalDate: endLocalDate,
      });
    }
  }

  const results = [...zones.values()].map((zone) => aggregateZone(zone, options));
  const eligible = results
    .filter((zone): zone is GeographicZoneRanking & { metrics: GeographicZoneMetrics } =>
      Boolean(zone.metrics),
    )
    .sort(
      (left, right) =>
        right.metrics.estimatedNetHourly - left.metrics.estimatedNetHourly ||
        right.metrics.estimatedNetPerMile - left.metrics.estimatedNetPerMile ||
        left.zoneId.localeCompare(right.zoneId),
    );
  eligible.forEach((zone, index) => {
    zone.rank = index + 1;
  });
  const eligibleByKey = new Map(eligible.map((zone) => [zoneKey(zone), zone]));
  const rankedZones = results
    .map((zone) => eligibleByKey.get(zoneKey(zone)) ?? zone)
    .sort((left, right) => {
      if (left.rank !== null && right.rank !== null) return left.rank - right.rank;
      if (left.rank !== null) return -1;
      if (right.rank !== null) return 1;
      return zoneKey(left).localeCompare(zoneKey(right));
    });

  return {
    status: eligible.length ? "ranked" : rankedZones.length ? "insufficient-data" : "no-data",
    analysisWindowDays: options.windowDays,
    datasetVersion: options.datasetVersion,
    generatedAsOf: options.asOf,
    zones: rankedZones,
    exclusionSummary: exclusionSummary(exclusions),
    configurationIssues: [],
  };
};
