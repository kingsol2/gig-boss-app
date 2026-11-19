import { deliveryGross, roundCurrency, safeDivide } from "../lib/calculations.ts";
import {
  US_STATES,
  type CalculatedMetric,
  type CompletedDeliveryRecord,
  type ConfidenceFactor,
  type ConfidenceResult,
  type CostAssumptions,
  type DataIssue,
  type DeliveryOfferRecord,
  type DeliveryProfitOptions,
  type DeliveryProfitMetrics,
  type DeliveryProfitResult,
  type EarningsAnalysisOptions,
  type EarningsSummaryMetrics,
  type EarningsSummaryResult,
  type ExcludedRecord,
  type OfferEvaluationOptions,
  type OfferEvaluationResult,
  type PlatformComparisonResult,
  type ProfitabilityThresholds,
  type RecordedProfitExpense,
  type USStateCode,
} from "../types/profitIntelligence.ts";
import { GIG_PLATFORMS, type GigPlatform } from "../types/models.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

const issue = (code: DataIssue["code"], message: string, recordId?: string): DataIssue => ({
  code,
  message,
  recordId,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const validDate = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "" && Number.isFinite(Date.parse(value));

const isStateCode = (value: unknown): value is USStateCode =>
  typeof value === "string" && US_STATES.some((state) => state.code === value);

const isGigPlatform = (value: unknown): value is GigPlatform =>
  typeof value === "string" && GIG_PLATFORMS.includes(value as GigPlatform);

export const isCompletedDeliveryRecord = (value: unknown): value is CompletedDeliveryRecord => {
  if (!isObject(value)) return false;
  return (
    value.recordType === "completed-delivery" &&
    value.status === "completed" &&
    typeof value.id === "string" &&
    isGigPlatform(value.platform) &&
    typeof value.date === "string" &&
    validDate(value.completedAt) &&
    isFiniteNonNegative(value.basePay) &&
    isFiniteNonNegative(value.tips) &&
    isFiniteNonNegative(value.otherPay) &&
    typeof value.payoutIncludesTips === "boolean" &&
    isFiniteNonNegative(value.miles) &&
    isFiniteNonNegative(value.durationMinutes) &&
    (value.stateCode === undefined || isStateCode(value.stateCode))
  );
};

export const isDeliveryOfferRecord = (value: unknown): value is DeliveryOfferRecord => {
  if (!isObject(value)) return false;
  return (
    value.recordType === "delivery-offer" &&
    ["projected", "accepted", "rejected", "expired"].includes(String(value.status)) &&
    typeof value.id === "string" &&
    isGigPlatform(value.platform) &&
    validDate(value.offeredAt) &&
    isFiniteNonNegative(value.projectedGross) &&
    isFiniteNonNegative(value.projectedMiles) &&
    isFiniteNonNegative(value.projectedDurationMinutes) &&
    (value.projectedAdditionalExpenses === undefined ||
      isFiniteNonNegative(value.projectedAdditionalExpenses)) &&
    (value.stateCode === undefined || isStateCode(value.stateCode))
  );
};

const validateCostAssumptions = (assumptions: CostAssumptions): DataIssue[] =>
  isFiniteNonNegative(assumptions.costPerMile)
    ? []
    : [issue("invalid-cost-assumption", "Cost per mile must be a finite, non-negative number.")];

const unavailableMetric = (
  code: DataIssue["code"],
  message: string,
  recordId?: string,
): CalculatedMetric => ({
  status: "insufficient-data",
  value: null,
  issue: issue(code, message, recordId),
});

export const calculateEarningsPerMile = (input: {
  estimatedNetEarnings: number | null | undefined;
  miles: number | null | undefined;
  recordId?: string;
}): CalculatedMetric => {
  if (!Number.isFinite(input.estimatedNetEarnings))
    return unavailableMetric(
      "invalid-amount",
      "Estimated net earnings are missing or invalid.",
      input.recordId,
    );
  if (!Number.isFinite(input.miles) || Number(input.miles) <= 0)
    return unavailableMetric(
      "missing-or-zero-mileage",
      "Recorded mileage must be greater than zero.",
      input.recordId,
    );
  return {
    status: "available",
    value: roundCurrency(safeDivide(Number(input.estimatedNetEarnings), Number(input.miles))),
  };
};

export const calculateHourlyEarnings = (input: {
  estimatedNetEarnings: number | null | undefined;
  durationMinutes: number | null | undefined;
  recordId?: string;
}): CalculatedMetric => {
  if (!Number.isFinite(input.estimatedNetEarnings))
    return unavailableMetric(
      "invalid-amount",
      "Estimated net earnings are missing or invalid.",
      input.recordId,
    );
  if (!Number.isFinite(input.durationMinutes) || Number(input.durationMinutes) <= 0)
    return unavailableMetric(
      "missing-or-zero-duration",
      "Recorded duration must be greater than zero.",
      input.recordId,
    );
  return {
    status: "available",
    value: roundCurrency(
      safeDivide(Number(input.estimatedNetEarnings), Number(input.durationMinutes) / 60),
    ),
  };
};

const validExpenses = (
  expenses: readonly RecordedProfitExpense[] | undefined,
  recordId: string,
  previouslyCountedIds: Set<string>,
): {
  amount: number;
  countedIds: string[];
  issues: DataIssue[];
} => {
  let amount = 0;
  const countedIds: string[] = [];
  const issues: DataIssue[] = [];

  for (const expense of expenses ?? []) {
    if (
      !isObject(expense) ||
      typeof expense.id !== "string" ||
      !isFiniteNonNegative(expense.amount)
    ) {
      issues.push(
        issue("invalid-expense", "An expense was missing a valid ID or amount.", recordId),
      );
      continue;
    }
    if (previouslyCountedIds.has(expense.id) || expense.includedInMileageCost) continue;
    previouslyCountedIds.add(expense.id);
    countedIds.push(expense.id);
    amount += expense.amount;
  }

  return { amount: roundCurrency(amount), countedIds, issues };
};

const completedProfit = (
  delivery: CompletedDeliveryRecord,
  assumptions: CostAssumptions,
  previouslyCountedIds = new Set<string>(),
): DeliveryProfitResult => {
  const issues = validateCostAssumptions(assumptions);
  const expenseResult = validExpenses(delivery.recordedExpenses, delivery.id, previouslyCountedIds);
  issues.push(...expenseResult.issues);
  if (issues.some((item) => item.code === "invalid-cost-assumption")) {
    return {
      status: "insufficient-data",
      deliveryId: delivery.id,
      metrics: null,
      issues,
      countedExpenseIds: expenseResult.countedIds,
    };
  }

  const grossEarnings = deliveryGross(delivery);
  const mileageCost = roundCurrency(delivery.miles * assumptions.costPerMile);
  const estimatedNetEarnings = roundCurrency(grossEarnings - mileageCost - expenseResult.amount);
  const estimatedNetPerMile = calculateEarningsPerMile({
    estimatedNetEarnings,
    miles: delivery.miles,
    recordId: delivery.id,
  });
  const estimatedNetHourly = calculateHourlyEarnings({
    estimatedNetEarnings,
    durationMinutes: delivery.durationMinutes,
    recordId: delivery.id,
  });
  if (estimatedNetPerMile.issue) issues.push(estimatedNetPerMile.issue);
  if (estimatedNetHourly.issue) issues.push(estimatedNetHourly.issue);

  return {
    status: issues.length ? "insufficient-data" : "calculated",
    deliveryId: delivery.id,
    metrics: {
      grossEarnings,
      recordedTips: roundCurrency(delivery.tips),
      mileageCost,
      additionalExpenses: expenseResult.amount,
      estimatedNetEarnings,
      estimatedNetPerMile,
      estimatedNetHourly,
    },
    issues,
    countedExpenseIds: expenseResult.countedIds,
  };
};

export const calculateDeliveryProfit = (
  record: unknown,
  options: DeliveryProfitOptions,
): DeliveryProfitResult => {
  if (isDeliveryOfferRecord(record)) {
    return {
      status: "excluded",
      deliveryId: record.id,
      metrics: null,
      issues: [
        issue(
          "not-completed",
          "Projected, accepted, rejected, and expired offers are never counted as completed earnings.",
          record.id,
        ),
      ],
      countedExpenseIds: [],
    };
  }
  if (!isCompletedDeliveryRecord(record)) {
    return {
      status: "insufficient-data",
      metrics: null,
      issues: [
        issue("invalid-record", "The completed delivery record is missing required fields."),
      ],
      countedExpenseIds: [],
    };
  }
  const asOf = Date.parse(options.asOf);
  if (!Number.isFinite(asOf)) {
    return {
      status: "insufficient-data",
      deliveryId: record.id,
      metrics: null,
      issues: [issue("invalid-date", "The profit calculation as-of date is invalid.", record.id)],
      countedExpenseIds: [],
    };
  }
  if (Date.parse(record.completedAt) > asOf) {
    return {
      status: "excluded",
      deliveryId: record.id,
      metrics: null,
      issues: [issue("future-dated-record", "Future-dated deliveries are excluded.", record.id)],
      countedExpenseIds: [],
    };
  }
  return completedProfit(record, options);
};

const validateThresholds = (thresholds: ProfitabilityThresholds): DataIssue[] => {
  const values = [
    thresholds.greenMinimumNetHourly,
    thresholds.yellowMinimumNetHourly,
    thresholds.greenMinimumNetPerMile,
    thresholds.yellowMinimumNetPerMile,
  ];
  if (
    values.some((value) => !isFiniteNonNegative(value)) ||
    thresholds.greenMinimumNetHourly < thresholds.yellowMinimumNetHourly ||
    thresholds.greenMinimumNetPerMile < thresholds.yellowMinimumNetPerMile
  ) {
    return [
      issue(
        "invalid-thresholds",
        "Profitability thresholds must be non-negative and green minimums must meet or exceed yellow minimums.",
      ),
    ];
  }
  return [];
};

export const evaluateDeliveryOffer = (
  record: unknown,
  options: OfferEvaluationOptions,
): OfferEvaluationResult => {
  if (!isDeliveryOfferRecord(record)) {
    return {
      status: "insufficient-data",
      offerId: isObject(record) && typeof record.id === "string" ? record.id : undefined,
      zone: null,
      recommendation: null,
      metrics: null,
      issues: [issue("invalid-record", "The projected offer is missing required fields.")],
      geographyApplied: false,
    };
  }
  if (record.status === "rejected" || record.status === "expired") {
    return {
      status: "excluded",
      offerId: record.id,
      zone: null,
      recommendation: null,
      metrics: null,
      issues: [
        issue("offer-not-active", "Rejected and expired offers are not evaluated.", record.id),
      ],
      geographyApplied: false,
    };
  }

  const asOf = Date.parse(options.asOf);
  if (!Number.isFinite(asOf)) {
    return {
      status: "insufficient-data",
      offerId: record.id,
      zone: null,
      recommendation: null,
      metrics: null,
      issues: [issue("invalid-date", "The offer evaluation as-of date is invalid.", record.id)],
      geographyApplied: false,
    };
  }
  if (Date.parse(record.offeredAt) > asOf) {
    return {
      status: "excluded",
      offerId: record.id,
      zone: null,
      recommendation: null,
      metrics: null,
      issues: [issue("future-dated-record", "Future-dated offers are excluded.", record.id)],
      geographyApplied: false,
    };
  }

  const geographicProfile = options.geographicProfile;
  const geographyApplied = Boolean(
    geographicProfile?.availability === "available" && geographicProfile.thresholds,
  );
  const thresholds = geographyApplied ? geographicProfile!.thresholds! : options.thresholds;
  const issues = [...validateCostAssumptions(options), ...validateThresholds(thresholds)];
  if (record.projectedGross <= 0)
    issues.push(issue("invalid-amount", "Projected gross must be greater than zero.", record.id));
  if (record.projectedMiles <= 0)
    issues.push(
      issue("missing-or-zero-mileage", "Projected mileage must be greater than zero.", record.id),
    );
  if (record.projectedDurationMinutes <= 0)
    issues.push(
      issue("missing-or-zero-duration", "Projected duration must be greater than zero.", record.id),
    );
  if (issues.length) {
    return {
      status: "insufficient-data",
      offerId: record.id,
      zone: null,
      recommendation: null,
      metrics: null,
      issues,
      geographyApplied,
      geographicProfile,
    };
  }

  const mileageCost = roundCurrency(record.projectedMiles * options.costPerMile);
  const additionalExpenses = roundCurrency(record.projectedAdditionalExpenses ?? 0);
  const estimatedNetEarnings = roundCurrency(
    record.projectedGross - mileageCost - additionalExpenses,
  );
  const estimatedNetPerMile = calculateEarningsPerMile({
    estimatedNetEarnings,
    miles: record.projectedMiles,
    recordId: record.id,
  });
  const estimatedNetHourly = calculateHourlyEarnings({
    estimatedNetEarnings,
    durationMinutes: record.projectedDurationMinutes,
    recordId: record.id,
  });
  const hourly = estimatedNetHourly.value ?? Number.NEGATIVE_INFINITY;
  const perMile = estimatedNetPerMile.value ?? Number.NEGATIVE_INFINITY;
  const green =
    hourly >= thresholds.greenMinimumNetHourly && perMile >= thresholds.greenMinimumNetPerMile;
  const yellow =
    hourly >= thresholds.yellowMinimumNetHourly && perMile >= thresholds.yellowMinimumNetPerMile;
  const zone = green ? "green" : yellow ? "yellow" : "red";

  return {
    status: "evaluated",
    offerId: record.id,
    zone,
    recommendation: green ? "strong" : yellow ? "conditional" : "poor",
    metrics: {
      grossEarnings: roundCurrency(record.projectedGross),
      recordedTips: 0,
      mileageCost,
      additionalExpenses,
      estimatedNetEarnings,
      estimatedNetPerMile,
      estimatedNetHourly,
    },
    issues: [],
    geographyApplied,
    geographicProfile,
  };
};

const analysisBounds = (
  options: EarningsAnalysisOptions,
): { start: number; end: number; startIso: string; endIso: string; issues: DataIssue[] } => {
  const end = Date.parse(options.asOf);
  if (!Number.isFinite(end)) {
    return {
      start: 0,
      end: 0,
      startIso: "",
      endIso: "",
      issues: [issue("invalid-date", "The analysis as-of date is invalid.")],
    };
  }
  const start = end - options.windowDays * DAY_MS;
  return {
    start,
    end,
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
    issues: [],
  };
};

const confidenceFor = (
  deliveries: readonly CompletedDeliveryRecord[],
  options: EarningsAnalysisOptions,
  asOf: number,
): ConfidenceResult => {
  const activeDays = new Set(deliveries.map((delivery) => delivery.completedAt.slice(0, 10))).size;
  const completeMetricCount = deliveries.reduce(
    (sum, delivery) => sum + Number(delivery.miles > 0) + Number(delivery.durationMinutes > 0),
    0,
  );
  const latest = Math.max(...deliveries.map((delivery) => Date.parse(delivery.completedAt)), 0);
  const ageDays = latest ? Math.max(0, (asOf - latest) / DAY_MS) : options.windowDays;
  const factors: ConfidenceFactor[] = [
    {
      key: "sample-size",
      score: Math.min(1, safeDivide(deliveries.length, options.minimumCompletedDeliveries)),
      weight: 0.4,
      explanation: `${deliveries.length} completed deliveries; ${options.minimumCompletedDeliveries} required for full sample confidence.`,
    },
    {
      key: "active-days",
      score: Math.min(1, safeDivide(activeDays, options.minimumActiveDays)),
      weight: 0.25,
      explanation: `${activeDays} active days; ${options.minimumActiveDays} required for full active-day confidence.`,
    },
    {
      key: "data-completeness",
      score: deliveries.length ? safeDivide(completeMetricCount, deliveries.length * 2) : 0,
      weight: 0.25,
      explanation: "Measures the share of completed records with both mileage and duration.",
    },
    {
      key: "recency",
      score: Math.max(0, 1 - safeDivide(ageDays, options.windowDays)),
      weight: 0.1,
      explanation: latest
        ? `Most recent completed delivery is ${roundCurrency(ageDays)} days before the analysis date.`
        : "No completed delivery is available in the analysis window.",
    },
  ];
  const weightedScore = roundCurrency(
    factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0) * 100,
  );
  const score =
    deliveries.length < options.minimumCompletedDeliveries || activeDays < options.minimumActiveDays
      ? Math.min(49, weightedScore)
      : weightedScore;
  return {
    score,
    level: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    factors,
  };
};

const emptyMetrics = (): EarningsSummaryMetrics => ({
  grossEarnings: 0,
  recordedTips: 0,
  mileageCost: 0,
  additionalExpenses: 0,
  estimatedNetEarnings: 0,
  totalMiles: 0,
  totalDurationMinutes: 0,
  completedDeliveryCount: 0,
  activeDayCount: 0,
  estimatedNetPerMile: unavailableMetric(
    "missing-or-zero-mileage",
    "No positive completed mileage is available.",
  ),
  estimatedNetHourly: unavailableMetric(
    "missing-or-zero-duration",
    "No positive completed duration is available.",
  ),
});

export const calculateEarningsSummary = (
  records: readonly unknown[],
  options: EarningsAnalysisOptions,
): EarningsSummaryResult => {
  const bounds = analysisBounds(options);
  const optionIssues = [
    ...bounds.issues,
    ...validateCostAssumptions(options),
    ...(![30, 60, 90].includes(options.windowDays)
      ? [issue("invalid-analysis-window", "Analysis window must be exactly 30, 60, or 90 days.")]
      : []),
    ...(!Number.isInteger(options.minimumCompletedDeliveries) ||
    options.minimumCompletedDeliveries <= 0
      ? [issue("invalid-record", "Minimum completed deliveries must be a positive integer.")]
      : []),
    ...(!Number.isInteger(options.minimumActiveDays) || options.minimumActiveDays <= 0
      ? [issue("invalid-record", "Minimum active days must be a positive integer.")]
      : []),
  ];
  const excludedRecords: ExcludedRecord[] = [];

  if (optionIssues.length) {
    return {
      status: "insufficient-data",
      windowDays: options.windowDays,
      windowStart: bounds.startIso,
      windowEnd: bounds.endIso,
      metrics: emptyMetrics(),
      confidence: { score: 0, level: "low", factors: [] },
      issues: optionIssues,
      includedDeliveryIds: [],
      excludedRecords,
    };
  }

  const deliveries: CompletedDeliveryRecord[] = [];
  for (const record of records) {
    if (isDeliveryOfferRecord(record)) {
      excludedRecords.push({
        recordId: record.id,
        issues: [
          issue(
            "not-completed",
            "Offers are excluded from actual earnings regardless of offer status.",
            record.id,
          ),
        ],
      });
      continue;
    }
    if (!isCompletedDeliveryRecord(record)) {
      excludedRecords.push({
        recordId: isObject(record) && typeof record.id === "string" ? record.id : undefined,
        issues: [issue("invalid-record", "Record is not a valid completed delivery.")],
      });
      continue;
    }
    const completedAt = Date.parse(record.completedAt);
    if (completedAt > bounds.end) {
      excludedRecords.push({
        recordId: record.id,
        issues: [issue("future-dated-record", "Future-dated deliveries are excluded.", record.id)],
      });
      continue;
    }
    if (completedAt < bounds.start) continue;
    deliveries.push(record);
  }

  const countedExpenseIds = new Set<string>();
  const profitResults = deliveries.map((delivery) =>
    completedProfit(delivery, options, countedExpenseIds),
  );
  const includedResults = profitResults.filter(
    (result): result is DeliveryProfitResult & { metrics: DeliveryProfitMetrics } =>
      result.metrics !== null,
  );
  const totals = includedResults.reduce(
    (sum, result) => ({
      grossEarnings: sum.grossEarnings + result.metrics.grossEarnings,
      recordedTips: sum.recordedTips + result.metrics.recordedTips,
      mileageCost: sum.mileageCost + result.metrics.mileageCost,
      additionalExpenses: sum.additionalExpenses + result.metrics.additionalExpenses,
      estimatedNetEarnings: sum.estimatedNetEarnings + result.metrics.estimatedNetEarnings,
    }),
    {
      grossEarnings: 0,
      recordedTips: 0,
      mileageCost: 0,
      additionalExpenses: 0,
      estimatedNetEarnings: 0,
    },
  );
  const totalMiles = deliveries.reduce((sum, delivery) => sum + delivery.miles, 0);
  const totalDurationMinutes = deliveries.reduce(
    (sum, delivery) => sum + delivery.durationMinutes,
    0,
  );
  const activeDayCount = new Set(deliveries.map((delivery) => delivery.completedAt.slice(0, 10)))
    .size;
  const metrics: EarningsSummaryMetrics = {
    grossEarnings: roundCurrency(totals.grossEarnings),
    recordedTips: roundCurrency(totals.recordedTips),
    mileageCost: roundCurrency(totals.mileageCost),
    additionalExpenses: roundCurrency(totals.additionalExpenses),
    estimatedNetEarnings: roundCurrency(totals.estimatedNetEarnings),
    totalMiles: roundCurrency(totalMiles),
    totalDurationMinutes,
    completedDeliveryCount: deliveries.length,
    activeDayCount,
    estimatedNetPerMile: calculateEarningsPerMile({
      estimatedNetEarnings: totals.estimatedNetEarnings,
      miles: totalMiles,
    }),
    estimatedNetHourly: calculateHourlyEarnings({
      estimatedNetEarnings: totals.estimatedNetEarnings,
      durationMinutes: totalDurationMinutes,
    }),
  };
  const issues: DataIssue[] = [];
  if (!deliveries.length)
    issues.push(issue("no-completed-deliveries", "No completed deliveries are in the window."));
  if (deliveries.length < options.minimumCompletedDeliveries)
    issues.push(
      issue(
        "too-few-deliveries",
        `${deliveries.length} completed deliveries are available; ${options.minimumCompletedDeliveries} are required.`,
      ),
    );
  if (activeDayCount < options.minimumActiveDays)
    issues.push(
      issue(
        "too-few-active-days",
        `${activeDayCount} active days are available; ${options.minimumActiveDays} are required.`,
      ),
    );
  if (metrics.estimatedNetPerMile.issue) issues.push(metrics.estimatedNetPerMile.issue);
  if (metrics.estimatedNetHourly.issue) issues.push(metrics.estimatedNetHourly.issue);
  for (const result of profitResults) issues.push(...result.issues);

  return {
    status: issues.length ? "insufficient-data" : "calculated",
    windowDays: options.windowDays,
    windowStart: bounds.startIso,
    windowEnd: bounds.endIso,
    metrics,
    confidence: confidenceFor(deliveries, options, bounds.end),
    issues,
    includedDeliveryIds: deliveries.map((delivery) => delivery.id),
    excludedRecords,
  };
};

export const compareGigPlatforms = (
  records: readonly unknown[],
  options: EarningsAnalysisOptions,
): PlatformComparisonResult => {
  const overall = calculateEarningsSummary(records, options);
  const completedById = new Set(overall.includedDeliveryIds);
  const platforms = new Set<GigPlatform>();
  for (const record of records) {
    if (isCompletedDeliveryRecord(record) && completedById.has(record.id))
      platforms.add(record.platform);
  }

  const summaries = [...platforms].map((platform) => {
    const platformRecords: CompletedDeliveryRecord[] = records.filter(
      (record): record is CompletedDeliveryRecord =>
        isCompletedDeliveryRecord(record) &&
        completedById.has(record.id) &&
        record.platform === platform,
    );
    return {
      platform,
      summary: calculateEarningsSummary(platformRecords, options),
    };
  });
  summaries.sort((left, right) => {
    const hourlyDifference =
      (right.summary.metrics.estimatedNetHourly.value ?? Number.NEGATIVE_INFINITY) -
      (left.summary.metrics.estimatedNetHourly.value ?? Number.NEGATIVE_INFINITY);
    return (
      hourlyDifference ||
      right.summary.metrics.estimatedNetEarnings - left.summary.metrics.estimatedNetEarnings
    );
  });

  return {
    status: overall.status,
    overall,
    comparisons: summaries.map((item, index) => ({ ...item, rank: index + 1 })),
  };
};
