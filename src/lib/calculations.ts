import type {
  DatePreset,
  Delivery,
  DeliveryExpense,
  EarningsSummary,
  GigPlatform,
} from "../types/models.ts";

export const roundCurrency = (value: number): number =>
  Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;

export const safeDivide = (numerator: number, denominator: number): number =>
  Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? numerator / denominator
    : 0;

export const deliveryGross = (delivery: Delivery): number => {
  const base = Math.max(0, delivery.basePay || 0);
  const tips = Math.max(0, delivery.tips || 0);
  const other = Math.max(0, delivery.otherPay || 0);
  return roundCurrency(base + (delivery.payoutIncludesTips ? 0 : tips) + other);
};

export const summarizeEarnings = (
  deliveries: Delivery[],
  expenses: DeliveryExpense[],
  costPerMile: number,
): EarningsSummary => {
  const gross = deliveries.reduce((sum, delivery) => sum + deliveryGross(delivery), 0);
  const tips = deliveries.reduce((sum, delivery) => sum + Math.max(0, delivery.tips || 0), 0);
  const miles = deliveries.reduce((sum, delivery) => sum + Math.max(0, delivery.miles || 0), 0);
  const durationMinutes = deliveries.reduce(
    (sum, delivery) => sum + Math.max(0, delivery.durationMinutes || 0),
    0,
  );
  const mileageCost = miles * Math.max(0, costPerMile || 0);
  const additionalExpenses = expenses.reduce(
    (sum, expense) => sum + Math.max(0, expense.amount || 0),
    0,
  );
  const estimatedExpenses = mileageCost + additionalExpenses;
  const hours = durationMinutes / 60;

  return {
    gross: roundCurrency(gross),
    tips: roundCurrency(tips),
    mileageCost: roundCurrency(mileageCost),
    additionalExpenses: roundCurrency(additionalExpenses),
    estimatedExpenses: roundCurrency(estimatedExpenses),
    estimatedNet: roundCurrency(gross - estimatedExpenses),
    miles: roundCurrency(miles),
    durationMinutes,
    deliveryCount: deliveries.length,
    grossPerMile: roundCurrency(safeDivide(gross, miles)),
    grossPerHour: roundCurrency(safeDivide(gross, hours)),
    netPerHour: roundCurrency(safeDivide(gross - estimatedExpenses, hours)),
  };
};

export const dateBounds = (
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
): { start?: string; end?: string } => {
  if (preset === "all") return {};
  if (preset === "custom") return { start: customStart, end: customEnd };

  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(now);
  if (preset === "week") startDate.setDate(now.getDate() - 6);
  if (preset === "month") startDate.setDate(now.getDate() - 29);
  return { start: startDate.toISOString().slice(0, 10), end };
};

export const inDateRange = (date: string, start?: string, end?: string): boolean =>
  (!start || date >= start) && (!end || date <= end);

export const filterDeliveries = (
  deliveries: Delivery[],
  options: {
    preset?: DatePreset;
    start?: string;
    end?: string;
    platform?: GigPlatform | "all";
    search?: string;
  },
): Delivery[] => {
  const bounds = options.preset
    ? dateBounds(options.preset, options.start, options.end)
    : { start: options.start, end: options.end };
  const query = options.search?.trim().toLowerCase();

  return deliveries.filter(
    (delivery) =>
      inDateRange(delivery.date, bounds.start, bounds.end) &&
      (!options.platform || options.platform === "all" || delivery.platform === options.platform) &&
      (!query ||
        delivery.platform.toLowerCase().includes(query) ||
        delivery.notes?.toLowerCase().includes(query)),
  );
};

export const filterExpenses = (
  expenses: DeliveryExpense[],
  preset: DatePreset,
  start?: string,
  end?: string,
): DeliveryExpense[] => {
  const bounds = dateBounds(preset, start, end);
  return expenses.filter((expense) => inDateRange(expense.date, bounds.start, bounds.end));
};

export const formatMoney = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const formatDuration = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
};
