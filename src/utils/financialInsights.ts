import {
  deliveryGross,
  inDateRange,
  roundCurrency,
  safeDivide,
  summarizeEarnings,
} from "../lib/calculations.ts";
import type {
  Delivery,
  DeliveryExpense,
  EarningsSummary,
  GigPlatform,
  MileageTrip,
} from "../types/models.ts";

const DAY_MS = 86_400_000;

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
};

export const netForDate = (
  date: string,
  deliveries: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
): EarningsSummary =>
  summarizeEarnings(
    deliveries.filter((delivery) => delivery.date === date),
    expenses.filter((expense) => expense.date === date),
    costPerMile,
  );

export interface EarningsForecast {
  status: "available" | "insufficient-data";
  basisDeliveryCount: number;
  basisActiveDays: number;
  basisStart: string;
  basisEnd: string;
  weekly: number;
  monthly: number;
  weeklyLow: number;
  weeklyHigh: number;
  monthlyLow: number;
  monthlyHigh: number;
  weeklyExpenses: number;
  monthlyExpenses: number;
  weeklyHours: number;
  monthlyHours: number;
  historicalNet: number;
}

export function calculateEarningsForecast(
  deliveries: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
  asOf = new Date(),
): EarningsForecast {
  const end = localDate(asOf);
  const start = shiftDate(end, -27);
  const recentDeliveries = deliveries.filter((delivery) =>
    inDateRange(delivery.date, start, end),
  );
  const recentExpenses = expenses.filter((expense) => inDateRange(expense.date, start, end));
  const activeDates = [...new Set(recentDeliveries.map((delivery) => delivery.date))].sort();
  const summary = summarizeEarnings(recentDeliveries, recentExpenses, costPerMile);
  const empty = {
    basisDeliveryCount: recentDeliveries.length,
    basisActiveDays: activeDates.length,
    basisStart: start,
    basisEnd: end,
    weekly: 0,
    monthly: 0,
    weeklyLow: 0,
    weeklyHigh: 0,
    monthlyLow: 0,
    monthlyHigh: 0,
    weeklyExpenses: 0,
    monthlyExpenses: 0,
    weeklyHours: 0,
    monthlyHours: 0,
    historicalNet: summary.estimatedNet,
  };
  if (recentDeliveries.length < 5 || activeDates.length < 3)
    return { status: "insufficient-data", ...empty };

  const dailyNet = activeDates.map(
    (date) => netForDate(date, recentDeliveries, recentExpenses, costPerMile).estimatedNet,
  );
  const activeDaysPerWeek = (activeDates.length / 28) * 7;
  const averageDay = dailyNet.reduce((sum, value) => sum + value, 0) / dailyNet.length;
  const weekly = averageDay * activeDaysPerWeek;
  const weeklyLow = Math.min(...dailyNet) * activeDaysPerWeek;
  const weeklyHigh = Math.max(...dailyNet) * activeDaysPerWeek;
  const weeklyScale = 7 / 28;
  const monthlyScale = 30 / 28;

  return {
    status: "available",
    ...empty,
    weekly: roundCurrency(weekly),
    monthly: roundCurrency((weekly / 7) * 30),
    weeklyLow: roundCurrency(Math.min(weeklyLow, weeklyHigh)),
    weeklyHigh: roundCurrency(Math.max(weeklyLow, weeklyHigh)),
    monthlyLow: roundCurrency((Math.min(weeklyLow, weeklyHigh) / 7) * 30),
    monthlyHigh: roundCurrency((Math.max(weeklyLow, weeklyHigh) / 7) * 30),
    weeklyExpenses: roundCurrency(summary.estimatedExpenses * weeklyScale),
    monthlyExpenses: roundCurrency(summary.estimatedExpenses * monthlyScale),
    weeklyHours: roundCurrency((summary.durationMinutes / 60) * weeklyScale),
    monthlyHours: roundCurrency((summary.durationMinutes / 60) * monthlyScale),
  };
}

export interface WorkPattern {
  key: string;
  label: string;
  deliveryCount: number;
  net: number;
  netPerHour: number;
  status: "available" | "insufficient-data";
}

const pattern = (
  key: string,
  label: string,
  items: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
): WorkPattern => {
  const ids = new Set(items.map((item) => item.id));
  const summary = summarizeEarnings(
    items,
    expenses.filter((expense) => expense.deliveryId && ids.has(expense.deliveryId)),
    costPerMile,
  );
  return {
    key,
    label,
    deliveryCount: items.length,
    net: summary.estimatedNet,
    netPerHour: summary.netPerHour,
    status: items.length >= 2 && summary.durationMinutes > 0 ? "available" : "insufficient-data",
  };
};

export function analyzeWorkPatterns(
  deliveries: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
): { days: WorkPattern[]; times: WorkPattern[]; platforms: WorkPattern[] } {
  const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days = dayLabels.map((label, day) =>
    pattern(
      `day-${day}`,
      label,
      deliveries.filter(
        (delivery) => new Date(`${delivery.date}T12:00:00`).getDay() === day,
      ),
      expenses,
      costPerMile,
    ),
  );
  const timeGroups = [
    { key: "morning", label: "Morning · 5–11", from: 5, to: 11 },
    { key: "afternoon", label: "Afternoon · 11–17", from: 11, to: 17 },
    { key: "evening", label: "Evening · 17–22", from: 17, to: 22 },
    { key: "late", label: "Late night · 22–5", from: 22, to: 29 },
  ];
  const times = timeGroups.map((group) =>
    pattern(
      group.key,
      group.label,
      deliveries.filter((delivery) => {
        if (!delivery.startTime) return false;
        const rawHour = Number(delivery.startTime.split(":")[0]);
        const hour = group.key === "late" && rawHour < 5 ? rawHour + 24 : rawHour;
        return hour >= group.from && hour < group.to;
      }),
      expenses,
      costPerMile,
    ),
  );
  const platforms = [...new Set(deliveries.map((delivery) => delivery.platform))].map(
    (platform) =>
      pattern(
        `platform-${platform}`,
        platform,
        deliveries.filter((delivery) => delivery.platform === platform),
        expenses,
        costPerMile,
      ),
  );
  return { days, times, platforms };
}

export interface PerformanceSnapshot {
  current: EarningsSummary;
  previous: EarningsSummary;
  netChangePercent: number | null;
  mileageEfficiencyChangePercent: number | null;
  expenseChangePercent: number | null;
}

export function compareThirtyDayPerformance(
  deliveries: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
  asOf = new Date(),
): PerformanceSnapshot {
  const currentEnd = localDate(asOf);
  const currentStart = shiftDate(currentEnd, -29);
  const previousEnd = shiftDate(currentStart, -1);
  const previousStart = shiftDate(previousEnd, -29);
  const summarize = (start: string, end: string) =>
    summarizeEarnings(
      deliveries.filter((delivery) => inDateRange(delivery.date, start, end)),
      expenses.filter((expense) => inDateRange(expense.date, start, end)),
      costPerMile,
    );
  const current = summarize(currentStart, currentEnd);
  const previous = summarize(previousStart, previousEnd);
  const percent = (next: number, prior: number) =>
    prior === 0 ? null : roundCurrency(((next - prior) / Math.abs(prior)) * 100);
  return {
    current,
    previous,
    netChangePercent: percent(current.estimatedNet, previous.estimatedNet),
    mileageEfficiencyChangePercent: percent(current.grossPerMile, previous.grossPerMile),
    expenseChangePercent: percent(current.estimatedExpenses, previous.estimatedExpenses),
  };
}

export function buildCoachInsights(
  deliveries: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
  dailyGoal?: number,
): string[] {
  if (!deliveries.length)
    return ["Add completed deliveries to generate private, deterministic coaching insights."];
  const summary = summarizeEarnings(deliveries, expenses, costPerMile);
  const platformTotals = [...new Set(deliveries.map((delivery) => delivery.platform))]
    .map((platform) => ({
      platform,
      summary: summarizeEarnings(
        deliveries.filter((delivery) => delivery.platform === platform),
        expenses.filter((expense) => {
          const delivery = deliveries.find((item) => item.id === expense.deliveryId);
          return delivery?.platform === platform;
        }),
        costPerMile,
      ),
    }))
    .sort((a, b) => b.summary.netPerHour - a.summary.netPerHour);
  const insights = [
    `Your recorded work is averaging ${roundCurrency(summary.netPerHour).toFixed(2)} estimated net dollars per hour.`,
    `${roundCurrency(summary.mileageCost)} of estimated vehicle cost comes from ${roundCurrency(summary.miles)} recorded miles.`,
  ];
  if (platformTotals.length > 1 && platformTotals[0].summary.deliveryCount)
    insights.push(
      `${platformTotals[0].platform} currently has your highest estimated net hourly result among platforms with records.`,
    );
  if (dailyGoal && dailyGoal > 0) {
    const achieved = new Set(deliveries.map((delivery) => delivery.date)).size;
    insights.push(
      `Your ${dailyGoal.toFixed(0)} dollar daily net goal is tracked against recorded daily results across ${achieved} active days.`,
    );
  }
  return insights;
}

export interface Milestone {
  label: string;
  achieved: boolean;
  progress: number;
  target: number;
  unit: string;
}

export function calculateMilestones(
  deliveries: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
  dailyGoal?: number,
): Milestone[] {
  const summary = summarizeEarnings(deliveries, expenses, costPerMile);
  const goalDays = dailyGoal
    ? [...new Set(deliveries.map((delivery) => delivery.date))].filter(
        (date) => netForDate(date, deliveries, expenses, costPerMile).estimatedNet >= dailyGoal,
      ).length
    : 0;
  return [
    {
      label: "Completed deliveries",
      achieved: deliveries.length >= 10,
      progress: deliveries.length,
      target: 10,
      unit: "deliveries",
    },
    {
      label: "Recorded business miles",
      achieved: summary.miles >= 100,
      progress: summary.miles,
      target: 100,
      unit: "miles",
    },
    {
      label: "Estimated net profit",
      achieved: summary.estimatedNet >= 1000,
      progress: summary.estimatedNet,
      target: 1000,
      unit: "dollars",
    },
    ...(dailyGoal
      ? [
          {
            label: "Daily goal days",
            achieved: goalDays >= 5,
            progress: goalDays,
            target: 5,
            unit: "days",
          },
        ]
      : []),
  ];
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export function createFinancialCsv(input: {
  deliveries: Delivery[];
  expenses: DeliveryExpense[];
  mileageTrips?: MileageTrip[];
  costPerMile: number;
  start?: string;
  end?: string;
  platform?: GigPlatform | "all";
}): string {
  const deliveries = input.deliveries.filter(
    (delivery) =>
      inDateRange(delivery.date, input.start, input.end) &&
      (!input.platform || input.platform === "all" || delivery.platform === input.platform),
  );
  const deliveryIds = new Set(deliveries.map((delivery) => delivery.id));
  const expenses = input.expenses.filter(
    (expense) =>
      inDateRange(expense.date, input.start, input.end) &&
      (input.platform && input.platform !== "all"
        ? Boolean(expense.deliveryId && deliveryIds.has(expense.deliveryId))
        : !expense.deliveryId || deliveryIds.has(expense.deliveryId)),
  );
  const mileageTrips = (input.mileageTrips ?? []).filter((trip) =>
    inDateRange(trip.date, input.start, input.end),
  );
  const summary = summarizeEarnings(deliveries, expenses, input.costPerMile);
  const rows: (string | number)[][] = [
    ["Gig Boss financial report"],
    ["Period start", input.start ?? "All records"],
    ["Period end", input.end ?? "All records"],
    ["Platform", input.platform ?? "all"],
    [],
    ["Summary", "Recorded/estimated", "Amount"],
    ["Gross earnings", "Recorded", summary.gross],
    ["Additional expenses", "Recorded", summary.additionalExpenses],
    ["Mileage vehicle cost", "Estimated", summary.mileageCost],
    ["Net profit", "Estimated", summary.estimatedNet],
    ["Recorded mileage", "Recorded", summary.miles],
    ["Manual odometer mileage", "Recorded separately", sumMileageTrips(mileageTrips)],
    ["Recorded work hours", "Recorded", roundCurrency(summary.durationMinutes / 60)],
    [],
    [
      "Delivery date",
      "Platform",
      "Gross recorded",
      "Tips recorded",
      "Miles recorded",
      "Minutes recorded",
      "Vehicle cost estimated",
    ],
    ...deliveries.map((delivery) => [
      delivery.date,
      delivery.platform,
      deliveryGross(delivery),
      delivery.tips,
      delivery.miles,
      delivery.durationMinutes,
      roundCurrency(delivery.miles * input.costPerMile),
    ]),
    [],
    ["Expense date", "Category", "Amount recorded", "Notes"],
    ...expenses.map((expense) => [
      expense.date,
      expense.category,
      expense.amount,
      expense.notes ?? "",
    ]),
    [],
    ["Mileage trip date", "Business purpose", "Start odometer", "End odometer", "Miles recorded"],
    ...mileageTrips.map((trip) => [
      trip.date,
      trip.purpose,
      trip.startOdometer,
      trip.endOdometer,
      mileageTripDistance(trip),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const mileageTripDistance = (trip: MileageTrip): number =>
  roundCurrency(Math.max(0, trip.endOdometer - trip.startOdometer));

export function sumMileageTrips(trips: MileageTrip[], start?: string, end?: string): number {
  return roundCurrency(
    trips
      .filter((trip) => inDateRange(trip.date, start, end))
      .reduce((sum, trip) => sum + mileageTripDistance(trip), 0),
  );
}

export function planningSetAside(netProfit: number, userRatePercent: number): number {
  if (!Number.isFinite(userRatePercent) || userRatePercent < 0 || userRatePercent > 100) return 0;
  return roundCurrency(Math.max(0, netProfit) * safeDivide(userRatePercent, 100));
}
