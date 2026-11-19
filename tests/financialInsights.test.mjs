import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeWorkPatterns,
  calculateEarningsForecast,
  createFinancialCsv,
  mileageTripDistance,
  planningSetAside,
} from "../src/utils/financialInsights.ts";
import { ROUTES } from "../src/lib/routes.ts";

const makeDelivery = (id, date, overrides = {}) => ({
  id,
  platform: "DoorDash",
  date,
  basePay: 20,
  tips: 5,
  otherPay: 0,
  payoutIncludesTips: false,
  miles: 10,
  durationMinutes: 60,
  startTime: "18:00",
  createdAt: `${date}T18:00:00.000Z`,
  updatedAt: `${date}T18:00:00.000Z`,
  ...overrides,
});

test("forecast uses only recorded recent deliveries and returns an observed range", () => {
  const deliveries = [
    makeDelivery("1", "2025-01-04"),
    makeDelivery("2", "2025-01-05"),
    makeDelivery("3", "2025-01-11"),
    makeDelivery("4", "2025-01-12"),
    makeDelivery("5", "2025-01-18"),
    makeDelivery("old", "2024-10-01", { basePay: 1000 }),
  ];
  const result = calculateEarningsForecast(deliveries, [], 0.5, new Date("2025-01-20T12:00:00"));
  assert.equal(result.status, "available");
  assert.equal(result.basisDeliveryCount, 5);
  assert.ok(result.weekly > 0);
  assert.ok(result.weeklyLow <= result.weekly);
  assert.ok(result.weeklyHigh >= result.weekly);
});

test("forecast reports insufficient data instead of inventing earnings", () => {
  const result = calculateEarningsForecast(
    [makeDelivery("1", "2025-01-20")],
    [],
    0.5,
    new Date("2025-01-20T12:00:00"),
  );
  assert.equal(result.status, "insufficient-data");
  assert.equal(result.weekly, 0);
});

test("work patterns require recorded start times for time-of-day results", () => {
  const patterns = analyzeWorkPatterns(
    [
      makeDelivery("1", "2025-01-17"),
      makeDelivery("2", "2025-01-18"),
      makeDelivery("3", "2025-01-19", { startTime: undefined }),
    ],
    [],
    0.5,
  );
  const evening = patterns.times.find((item) => item.key === "evening");
  assert.equal(evening.deliveryCount, 2);
  assert.equal(evening.status, "available");
});

test("CSV labels recorded and estimated financial values", () => {
  const csv = createFinancialCsv({
    deliveries: [makeDelivery("1", "2025-01-20")],
    expenses: [],
    costPerMile: 0.5,
  });
  assert.match(csv, /Gross earnings/);
  assert.match(csv, /Recorded/);
  assert.match(csv, /Mileage vehicle cost/);
  assert.match(csv, /Estimated/);
});

test("mileage and user-selected planning calculations are deterministic", () => {
  assert.equal(
    mileageTripDistance({
      id: "trip",
      date: "2025-01-01",
      startOdometer: 100,
      endOdometer: 112.5,
      purpose: "Deliveries",
      createdAt: "",
      updatedAt: "",
    }),
    12.5,
  );
  assert.equal(planningSetAside(1000, 20), 200);
  assert.equal(planningSetAside(-100, 20), 0);
});

test("all 32 existing route paths remain registered", () => {
  assert.equal(Object.values(ROUTES).length, 32);
  assert.equal(new Set(Object.values(ROUTES)).size, 32);
});
