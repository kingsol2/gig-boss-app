import assert from "node:assert/strict";
import test from "node:test";
import { PROVISIONAL_SHARED_RANKING_MINIMUMS } from "../src/types/geographicProfitIntelligence.ts";
import {
  isVerifiedGeographicDeliveryObservation,
  rankGeographicProfitabilityZones,
} from "../src/utils/geographicProfitability.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const asOf = "2025-04-01T23:00:00.000Z";

const thresholds = {
  greenMinimumNetHourly: 25,
  yellowMinimumNetHourly: 15,
  greenMinimumNetPerMile: 2.5,
  yellowMinimumNetPerMile: 1.5,
};

const policy = {
  ...PROVISIONAL_SHARED_RANKING_MINIMUMS,
  minimumDataCompleteness: 0.9,
  maximumObservationAgeDays: 7,
};

const options = (overrides = {}) => ({
  asOf,
  windowDays: 30,
  datasetVersion: "synthetic-v1",
  costPerMile: 0.5,
  thresholds,
  policy,
  ...overrides,
});

const observation = (overrides = {}) => ({
  id: "observation-1",
  recordType: "completed-delivery",
  status: "completed",
  verificationStatus: "verified",
  contributorId: "synthetic-driver-1",
  platform: "DoorDash",
  date: "2025-04-01",
  completedAt: "2025-04-01T12:00:00.000Z",
  basePay: 35,
  tips: 0,
  otherPay: 0,
  payoutIncludesTips: false,
  miles: 10,
  durationMinutes: 60,
  createdAt: "2025-04-01T12:00:00.000Z",
  updatedAt: "2025-04-01T12:00:00.000Z",
  geography: {
    stateCode: "TX",
    marketId: "synthetic-market",
    zoneId: "synthetic-zone",
    marketTimeZone: "America/Chicago",
  },
  datasetVersion: "synthetic-v1",
  ...overrides,
});

const zoneObservations = ({
  zoneId,
  basePay,
  count = 30,
  contributors = 10,
  activeDays = 10,
  dayOffset = 0,
  mutate,
}) =>
  Array.from({ length: count }, (_, index) => {
    const completedAt = new Date(
      Date.parse(asOf) - (dayOffset + (index % activeDays)) * DAY_MS,
    ).toISOString();
    const base = observation({
      id: `${zoneId}-observation-${index}`,
      contributorId: `${zoneId}-synthetic-driver-${index % contributors}`,
      basePay,
      date: completedAt.slice(0, 10),
      completedAt,
      geography: {
        stateCode: "TX",
        marketId: "synthetic-market",
        zoneId,
        marketTimeZone: "America/Chicago",
      },
    });
    return mutate ? mutate(base, index) : base;
  });

test("runtime validation requires verified completed observations and valid geography", () => {
  assert.equal(isVerifiedGeographicDeliveryObservation(observation()), true);
  assert.equal(
    isVerifiedGeographicDeliveryObservation(observation({ verificationStatus: "unverified" })),
    false,
  );
  assert.equal(
    isVerifiedGeographicDeliveryObservation(
      observation({
        geography: {
          stateCode: "TX",
          marketId: "market",
          zoneId: "zone",
          marketTimeZone: "Not/A_Timezone",
        },
      }),
    ),
    false,
  );
  assert.equal(
    isVerifiedGeographicDeliveryObservation(
      observation({
        recordedExpenses: [{ id: "invalid-expense", amount: Number.NaN }],
      }),
    ),
    false,
  );
});

test("eligible zones classify green, yellow, and red and rank by net hourly earnings", () => {
  const result = rankGeographicProfitabilityZones(
    [
      ...zoneObservations({ zoneId: "green-zone", basePay: 35 }),
      ...zoneObservations({ zoneId: "yellow-zone", basePay: 23 }),
      ...zoneObservations({ zoneId: "red-zone", basePay: 15 }),
    ],
    options(),
  );

  assert.equal(result.status, "ranked");
  assert.deepEqual(
    result.zones.map((zone) => [zone.zoneId, zone.classification, zone.rank]),
    [
      ["green-zone", "green", 1],
      ["yellow-zone", "yellow", 2],
      ["red-zone", "red", 3],
    ],
  );
  assert.equal(result.zones[0].metrics?.estimatedNetHourly, 30);
  assert.equal(result.zones[0].metrics?.estimatedNetPerMile, 3);
  assert.equal(result.zones[0].observationCount, 30);
  assert.equal(result.zones[0].activeDayCount, 10);
  assert.equal(result.zones[0].contributorCount, 10);
  assert.equal(result.zones[0].dataCompleteness, 1);
});

test("sample, active-day, completeness, recency, and privacy failures become gray", () => {
  const result = rankGeographicProfitabilityZones(
    [
      ...zoneObservations({ zoneId: "sample-failure", basePay: 35, count: 29 }),
      ...zoneObservations({
        zoneId: "active-day-failure",
        basePay: 35,
        activeDays: 6,
      }),
      ...zoneObservations({
        zoneId: "privacy-failure",
        basePay: 35,
        contributors: 9,
      }),
      ...zoneObservations({
        zoneId: "completeness-failure",
        basePay: 35,
        mutate: (record, index) => (index < 10 ? { ...record, miles: 0 } : record),
      }),
      ...zoneObservations({
        zoneId: "recency-failure",
        basePay: 35,
        dayOffset: 10,
      }),
    ],
    options(),
  );

  const byId = Object.fromEntries(result.zones.map((zone) => [zone.zoneId, zone]));
  assert.equal(result.status, "insufficient-data");
  for (const zone of result.zones) {
    assert.equal(zone.classification, "gray");
    assert.equal(zone.rank, null);
    assert.equal(zone.metrics, null);
    assert.equal(zone.confidence.level, "low");
  }
  assert.equal(
    byId["sample-failure"].insufficientDataIssues.some(
      (item) => item.code === "too-few-observations",
    ),
    true,
  );
  assert.equal(
    byId["active-day-failure"].insufficientDataIssues.some(
      (item) => item.code === "too-few-active-days",
    ),
    true,
  );
  assert.equal(byId["privacy-failure"].privacySuppressed, true);
  assert.equal(
    byId["privacy-failure"].insufficientDataIssues.some(
      (item) => item.code === "too-few-contributors",
    ),
    true,
  );
  assert.equal(
    byId["completeness-failure"].insufficientDataIssues.some(
      (item) => item.code === "low-data-completeness",
    ),
    true,
  );
  assert.equal(
    byId["recency-failure"].insufficientDataIssues.some(
      (item) => item.code === "stale-observations",
    ),
    true,
  );
});

test("market-local calendar windows honor explicit IANA timezones", () => {
  const localOptions = options({
    asOf: "2025-04-01T06:00:00.000Z",
    policy: {
      minimumCompletedDeliveries: 1,
      minimumActiveDays: 1,
      minimumContributors: 1,
      minimumDataCompleteness: 1,
      maximumObservationAgeDays: 30,
    },
  });
  const included = observation({
    id: "local-march-2",
    date: "2025-03-02",
    completedAt: "2025-03-02T08:30:00.000Z",
    geography: {
      stateCode: "CA",
      marketId: "synthetic-la",
      zoneId: "local-zone",
      marketTimeZone: "America/Los_Angeles",
    },
  });
  const outside = observation({
    id: "local-march-1",
    date: "2025-03-02",
    completedAt: "2025-03-02T07:30:00.000Z",
    geography: included.geography,
  });
  const result = rankGeographicProfitabilityZones([included, outside], localOptions);

  assert.equal(result.zones.length, 1);
  assert.equal(result.zones[0].windowStartLocalDate, "2025-03-02");
  assert.equal(result.zones[0].windowEndLocalDate, "2025-03-31");
  assert.equal(result.zones[0].observationCount, 1);
  assert.equal(
    result.exclusionSummary.some(
      (item) => item.code === "outside-analysis-window" && item.count === 1,
    ),
    true,
  );
});

test("geographic analysis supports 30, 60, and 90 market-local calendar-day windows", () => {
  const localPolicy = {
    minimumCompletedDeliveries: 1,
    minimumActiveDays: 1,
    minimumContributors: 1,
    minimumDataCompleteness: 1,
    maximumObservationAgeDays: 90,
  };
  const records = [
    observation({ id: "current-observation" }),
    observation({
      id: "observation-45",
      date: "2025-02-15",
      completedAt: new Date(Date.parse(asOf) - 45 * DAY_MS).toISOString(),
    }),
    observation({
      id: "observation-75",
      date: "2025-01-16",
      completedAt: new Date(Date.parse(asOf) - 75 * DAY_MS).toISOString(),
    }),
  ];
  const countFor = (windowDays) =>
    rankGeographicProfitabilityZones(records, options({ windowDays, policy: localPolicy })).zones[0]
      .observationCount;

  assert.equal(countFor(30), 1);
  assert.equal(countFor(60), 2);
  assert.equal(countFor(90), 3);
});

test("offers, unverified, duplicates, future records, and dataset mismatches are excluded", () => {
  const base = observation();
  const result = rankGeographicProfitabilityZones(
    [
      base,
      { ...base },
      observation({ id: "unverified", verificationStatus: "unverified" }),
      observation({
        id: "future",
        completedAt: "2025-04-02T12:00:00.000Z",
      }),
      observation({ id: "wrong-version", datasetVersion: "synthetic-v2" }),
      {
        id: "projected-offer",
        recordType: "delivery-offer",
        status: "projected",
        platform: "DoorDash",
        offeredAt: "2025-04-01T12:00:00.000Z",
        projectedGross: 100,
        projectedMiles: 1,
        projectedDurationMinutes: 5,
      },
    ],
    options({
      policy: {
        minimumCompletedDeliveries: 1,
        minimumActiveDays: 1,
        minimumContributors: 1,
        minimumDataCompleteness: 1,
        maximumObservationAgeDays: 7,
      },
    }),
  );
  const exclusions = Object.fromEntries(
    result.exclusionSummary.map((item) => [item.code, item.count]),
  );

  assert.equal(result.zones[0].observationCount, 1);
  assert.equal(exclusions["duplicate-observation"], 1);
  assert.equal(exclusions["unverified-observation"], 1);
  assert.equal(exclusions["future-dated-observation"], 1);
  assert.equal(exclusions["dataset-version-mismatch"], 1);
  assert.equal(exclusions["not-completed"], 1);
});

test("privacy suppression exposes no contributor IDs, record IDs, or profitability metrics", () => {
  const records = zoneObservations({
    zoneId: "private-zone",
    basePay: 35,
    contributors: 9,
  });
  const result = rankGeographicProfitabilityZones(records, options());
  const serialized = JSON.stringify(result);

  assert.equal(result.zones[0].privacySuppressed, true);
  assert.equal(result.zones[0].metrics, null);
  assert.equal(serialized.includes("private-zone-synthetic-driver"), false);
  assert.equal(serialized.includes("private-zone-observation-"), false);
});

test("shared expense IDs are counted once across a zone", () => {
  const result = rankGeographicProfitabilityZones(
    [
      observation({
        id: "expense-observation-1",
        contributorId: "driver-1",
        recordedExpenses: [{ id: "shared-parking", amount: 5 }],
      }),
      observation({
        id: "expense-observation-2",
        contributorId: "driver-2",
        completedAt: "2025-03-31T12:00:00.000Z",
        date: "2025-03-31",
        recordedExpenses: [{ id: "shared-parking", amount: 5 }],
      }),
    ],
    options({
      policy: {
        minimumCompletedDeliveries: 2,
        minimumActiveDays: 2,
        minimumContributors: 2,
        minimumDataCompleteness: 1,
        maximumObservationAgeDays: 7,
      },
    }),
  );

  assert.equal(result.zones[0].metrics?.estimatedNetEarnings, 55);
  assert.equal(result.zones[0].metrics?.estimatedNetHourly, 27.5);
});

test("no observations produce no rankings and invalid policies fail closed", () => {
  const empty = rankGeographicProfitabilityZones([], options());
  assert.equal(empty.status, "no-data");
  assert.deepEqual(empty.zones, []);

  const invalid = rankGeographicProfitabilityZones(
    [observation()],
    options({
      policy: { ...policy, minimumContributors: 0 },
    }),
  );
  assert.equal(invalid.status, "invalid-configuration");
  assert.deepEqual(invalid.zones, []);
  assert.equal(invalid.configurationIssues.length > 0, true);
});
