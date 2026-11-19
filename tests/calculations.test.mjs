import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryGross,
  filterDeliveries,
  roundCurrency,
  safeDivide,
  summarizeEarnings,
} from "../src/lib/calculations.ts";

const delivery = {
  id: "delivery-1",
  platform: "DoorDash",
  date: "2025-01-10",
  basePay: 20,
  tips: 5,
  otherPay: 2,
  payoutIncludesTips: false,
  miles: 10,
  durationMinutes: 60,
  createdAt: "2025-01-10T00:00:00.000Z",
  updatedAt: "2025-01-10T00:00:00.000Z",
};

test("gross adds tips only when they are not already included", () => {
  assert.equal(deliveryGross(delivery), 27);
  assert.equal(deliveryGross({ ...delivery, payoutIncludesTips: true }), 22);
});

test("summary separates mileage and additional expenses without double counting", () => {
  const summary = summarizeEarnings(
    [delivery],
    [
      {
        id: "expense-1",
        category: "Parking",
        amount: 3,
        date: delivery.date,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      },
    ],
    0.5,
  );
  assert.equal(summary.gross, 27);
  assert.equal(summary.mileageCost, 5);
  assert.equal(summary.additionalExpenses, 3);
  assert.equal(summary.estimatedNet, 19);
  assert.equal(summary.grossPerMile, 2.7);
  assert.equal(summary.grossPerHour, 27);
});

test("division and rounding are safe for zero and invalid values", () => {
  assert.equal(safeDivide(10, 0), 0);
  assert.equal(safeDivide(Number.NaN, 2), 0);
  assert.equal(roundCurrency(10.235), 10.24);
});

test("delivery filters combine date, platform, and search", () => {
  const result = filterDeliveries(
    [delivery, { ...delivery, id: "delivery-2", platform: "Uber Eats", notes: "Late night" }],
    { start: "2025-01-01", end: "2025-01-31", platform: "Uber Eats", search: "night" },
  );
  assert.deepEqual(
    result.map((item) => item.id),
    ["delivery-2"],
  );
});
