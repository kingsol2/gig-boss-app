import assert from "node:assert/strict";
import test from "node:test";
import { US_STATES } from "../src/types/profitIntelligence.ts";
import {
  calculateDeliveryProfit,
  calculateEarningsPerMile,
  calculateEarningsSummary,
  calculateHourlyEarnings,
  compareGigPlatforms,
  evaluateDeliveryOffer,
  isCompletedDeliveryRecord,
  isDeliveryOfferRecord,
} from "../src/utils/gigBossAlgorithm.ts";

const asOf = "2025-04-01T23:59:59.000Z";

const analysisOptions = (windowDays = 30) => ({
  asOf,
  windowDays,
  costPerMile: 0.5,
  minimumCompletedDeliveries: 2,
  minimumActiveDays: 2,
});

const completedDelivery = (overrides = {}) => ({
  id: "delivery-1",
  recordType: "completed-delivery",
  status: "completed",
  platform: "DoorDash",
  date: "2025-04-01",
  completedAt: "2025-04-01T12:00:00.000Z",
  basePay: 20,
  tips: 5,
  otherPay: 2,
  payoutIncludesTips: false,
  miles: 10,
  durationMinutes: 60,
  createdAt: "2025-04-01T12:00:00.000Z",
  updatedAt: "2025-04-01T12:00:00.000Z",
  ...overrides,
});

const projectedOffer = (overrides = {}) => ({
  id: "offer-1",
  recordType: "delivery-offer",
  status: "projected",
  platform: "DoorDash",
  offeredAt: "2025-04-01T11:00:00.000Z",
  projectedGross: 30,
  projectedMiles: 10,
  projectedDurationMinutes: 60,
  projectedAdditionalExpenses: 2,
  ...overrides,
});

test("runtime guards distinguish completed deliveries from offers", () => {
  assert.equal(isCompletedDeliveryRecord(completedDelivery()), true);
  assert.equal(isCompletedDeliveryRecord(projectedOffer()), false);
  assert.equal(isDeliveryOfferRecord(projectedOffer()), true);
  assert.equal(isDeliveryOfferRecord(completedDelivery()), false);
});

test("delivery profit avoids double-counting tips and mileage-covered expenses", () => {
  const result = calculateDeliveryProfit(
    completedDelivery({
      recordedExpenses: [
        { id: "parking", amount: 3 },
        { id: "vehicle-cost", amount: 4, includedInMileageCost: true },
        { id: "parking", amount: 3 },
      ],
    }),
    { costPerMile: 0.5, asOf },
  );

  assert.equal(result.status, "calculated");
  assert.equal(result.metrics?.grossEarnings, 27);
  assert.equal(result.metrics?.mileageCost, 5);
  assert.equal(result.metrics?.additionalExpenses, 3);
  assert.equal(result.metrics?.estimatedNetEarnings, 19);
  assert.equal(result.metrics?.estimatedNetHourly.value, 19);
  assert.equal(result.metrics?.estimatedNetPerMile.value, 1.9);
  assert.deepEqual(result.countedExpenseIds, ["parking"]);

  const tipsIncluded = calculateDeliveryProfit(completedDelivery({ payoutIncludesTips: true }), {
    costPerMile: 0.5,
    asOf,
  });
  assert.equal(tipsIncluded.metrics?.grossEarnings, 22);
});

test("projected and uncompleted offers are excluded from actual delivery profit", () => {
  for (const status of ["projected", "accepted", "rejected", "expired"]) {
    const result = calculateDeliveryProfit(projectedOffer({ status }), {
      costPerMile: 0.5,
      asOf,
    });
    assert.equal(result.status, "excluded");
    assert.equal(result.metrics, null);
    assert.equal(result.issues[0].code, "not-completed");
  }
});

test("per-mile and hourly metrics explicitly report zero or missing denominators", () => {
  const perMile = calculateEarningsPerMile({ estimatedNetEarnings: 20, miles: 0 });
  const hourly = calculateHourlyEarnings({ estimatedNetEarnings: 20, durationMinutes: undefined });
  assert.equal(perMile.status, "insufficient-data");
  assert.equal(perMile.value, null);
  assert.equal(perMile.issue?.code, "missing-or-zero-mileage");
  assert.equal(hourly.status, "insufficient-data");
  assert.equal(hourly.value, null);
  assert.equal(hourly.issue?.code, "missing-or-zero-duration");
});

test("offer evaluation uses net hourly first and net per mile as a supporting threshold", () => {
  const result = evaluateDeliveryOffer(projectedOffer(), {
    costPerMile: 0.5,
    asOf,
    thresholds: {
      greenMinimumNetHourly: 20,
      yellowMinimumNetHourly: 15,
      greenMinimumNetPerMile: 2,
      yellowMinimumNetPerMile: 1.5,
    },
  });
  assert.equal(result.status, "evaluated");
  assert.equal(result.metrics?.estimatedNetEarnings, 23);
  assert.equal(result.metrics?.estimatedNetHourly.value, 23);
  assert.equal(result.metrics?.estimatedNetPerMile.value, 2.3);
  assert.equal(result.zone, "green");
  assert.equal(result.recommendation, "strong");
  assert.equal(result.geographyApplied, false);
});

test("geographic scoring applies only an explicitly available external profile", () => {
  const unavailable = evaluateDeliveryOffer(projectedOffer(), {
    costPerMile: 0.5,
    asOf,
    thresholds: {
      greenMinimumNetHourly: 20,
      yellowMinimumNetHourly: 15,
      greenMinimumNetPerMile: 2,
      yellowMinimumNetPerMile: 1.5,
    },
    geographicProfile: { stateCode: "CA", availability: "unavailable" },
  });
  assert.equal(unavailable.geographyApplied, false);

  const available = evaluateDeliveryOffer(projectedOffer(), {
    costPerMile: 0.5,
    asOf,
    thresholds: {
      greenMinimumNetHourly: 20,
      yellowMinimumNetHourly: 15,
      greenMinimumNetPerMile: 2,
      yellowMinimumNetPerMile: 1.5,
    },
    geographicProfile: {
      stateCode: "CA",
      availability: "available",
      sourceLabel: "Synthetic test profile",
      thresholds: {
        greenMinimumNetHourly: 30,
        yellowMinimumNetHourly: 20,
        greenMinimumNetPerMile: 3,
        yellowMinimumNetPerMile: 2,
      },
    },
  });
  assert.equal(available.geographyApplied, true);
  assert.equal(available.zone, "yellow");
});

test("earnings summaries exclude all offers and future-dated deliveries", () => {
  const summary = calculateEarningsSummary(
    [
      completedDelivery(),
      completedDelivery({
        id: "delivery-2",
        platform: "Uber Eats",
        date: "2025-03-31",
        completedAt: "2025-03-31T12:00:00.000Z",
      }),
      projectedOffer(),
      projectedOffer({ id: "accepted-offer", status: "accepted" }),
      completedDelivery({
        id: "future-delivery",
        date: "2025-04-02",
        completedAt: "2025-04-02T12:00:00.000Z",
      }),
    ],
    analysisOptions(),
  );

  assert.equal(summary.status, "calculated");
  assert.equal(summary.metrics.completedDeliveryCount, 2);
  assert.equal(summary.metrics.grossEarnings, 54);
  assert.deepEqual(summary.includedDeliveryIds, ["delivery-1", "delivery-2"]);
  assert.equal(summary.excludedRecords.length, 3);
  assert.equal(
    summary.excludedRecords.filter((record) => record.issues[0].code === "not-completed").length,
    2,
  );
  assert.equal(
    summary.excludedRecords.some((record) => record.issues[0].code === "future-dated-record"),
    true,
  );
});

test("30, 60, and 90 day windows include only records in their exact lookback", () => {
  const fortyFiveDaysOld = completedDelivery({
    id: "delivery-45",
    date: "2025-02-15",
    completedAt: "2025-02-15T23:59:59.000Z",
  });
  const seventyFiveDaysOld = completedDelivery({
    id: "delivery-75",
    date: "2025-01-16",
    completedAt: "2025-01-16T23:59:59.000Z",
  });
  const records = [completedDelivery(), fortyFiveDaysOld, seventyFiveDaysOld];

  assert.deepEqual(calculateEarningsSummary(records, analysisOptions(30)).includedDeliveryIds, [
    "delivery-1",
  ]);
  assert.deepEqual(calculateEarningsSummary(records, analysisOptions(60)).includedDeliveryIds, [
    "delivery-1",
    "delivery-45",
  ]);
  assert.deepEqual(calculateEarningsSummary(records, analysisOptions(90)).includedDeliveryIds, [
    "delivery-1",
    "delivery-45",
    "delivery-75",
  ]);
});

test("summary returns explicit insufficient-data issues and confidence factors", () => {
  const summary = calculateEarningsSummary([completedDelivery()], {
    ...analysisOptions(),
    minimumCompletedDeliveries: 5,
    minimumActiveDays: 3,
  });
  assert.equal(summary.status, "insufficient-data");
  assert.equal(
    summary.issues.some((item) => item.code === "too-few-deliveries"),
    true,
  );
  assert.equal(
    summary.issues.some((item) => item.code === "too-few-active-days"),
    true,
  );
  assert.equal(summary.confidence.factors.length, 4);
  assert.equal(summary.confidence.level, "low");
});

test("platform comparison ranks by estimated net hourly earnings", () => {
  const result = compareGigPlatforms(
    [
      completedDelivery(),
      completedDelivery({
        id: "delivery-2",
        date: "2025-03-31",
        completedAt: "2025-03-31T12:00:00.000Z",
      }),
      completedDelivery({
        id: "delivery-3",
        platform: "Uber Eats",
        date: "2025-03-31",
        completedAt: "2025-03-31T13:00:00.000Z",
        basePay: 35,
        tips: 5,
        otherPay: 0,
        miles: 10,
        durationMinutes: 60,
      }),
      projectedOffer({ id: "uber-offer", platform: "Uber Eats", projectedGross: 100 }),
    ],
    analysisOptions(),
  );
  assert.equal(result.comparisons.length, 2);
  assert.equal(result.comparisons[0].platform, "Uber Eats");
  assert.equal(result.comparisons[0].rank, 1);
  assert.equal(result.overall.metrics.completedDeliveryCount, 3);
});

test("nationwide identifiers contain each of the 50 states exactly once", () => {
  assert.equal(US_STATES.length, 50);
  assert.equal(new Set(US_STATES.map((state) => state.code)).size, 50);
  assert.equal(new Set(US_STATES.map((state) => state.name)).size, 50);
  assert.equal(
    US_STATES.some((state) => state.code === "CA"),
    true,
  );
  assert.equal(
    US_STATES.some((state) => state.code === "WY"),
    true,
  );
});

test("invalid records and invalid assumptions fail safely", () => {
  const invalidRecord = calculateDeliveryProfit(
    { ...completedDelivery(), basePay: Number.NaN },
    { costPerMile: 0.5, asOf },
  );
  assert.equal(invalidRecord.status, "insufficient-data");
  assert.equal(invalidRecord.metrics, null);

  const invalidAssumption = calculateDeliveryProfit(completedDelivery(), {
    costPerMile: -1,
    asOf,
  });
  assert.equal(invalidAssumption.status, "insufficient-data");
  assert.equal(invalidAssumption.metrics, null);

  const invalidOffer = evaluateDeliveryOffer(projectedOffer({ projectedDurationMinutes: 0 }), {
    costPerMile: 0.5,
    asOf,
    thresholds: {
      greenMinimumNetHourly: 20,
      yellowMinimumNetHourly: 15,
      greenMinimumNetPerMile: 2,
      yellowMinimumNetPerMile: 1,
    },
  });
  assert.equal(invalidOffer.status, "insufficient-data");
  assert.equal(invalidOffer.zone, null);

  const futureDelivery = calculateDeliveryProfit(
    completedDelivery({
      id: "future-delivery",
      date: "2025-04-02",
      completedAt: "2025-04-02T12:00:00.000Z",
    }),
    { costPerMile: 0.5, asOf },
  );
  assert.equal(futureDelivery.status, "excluded");
  assert.equal(futureDelivery.issues[0].code, "future-dated-record");

  const futureOffer = evaluateDeliveryOffer(
    projectedOffer({ offeredAt: "2025-04-02T12:00:00.000Z" }),
    {
      costPerMile: 0.5,
      asOf,
      thresholds: {
        greenMinimumNetHourly: 20,
        yellowMinimumNetHourly: 15,
        greenMinimumNetPerMile: 2,
        yellowMinimumNetPerMile: 1,
      },
    },
  );
  assert.equal(futureOffer.status, "excluded");
  assert.equal(futureOffer.issues[0].code, "future-dated-record");

  const invalidWindow = calculateEarningsSummary([completedDelivery()], {
    ...analysisOptions(),
    windowDays: 45,
  });
  assert.equal(invalidWindow.status, "insufficient-data");
  assert.equal(
    invalidWindow.issues.some((item) => item.code === "invalid-analysis-window"),
    true,
  );
});
