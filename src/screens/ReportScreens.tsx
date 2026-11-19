import { useMemo, useState, type FormEvent } from "react";
import { DateRangeFilter, EarningsChart, ExpenseCard, PlatformBars } from "../components/domain";
import { Icon, type IconName } from "../components/Icon";
import {
  ForecastPanel,
  MileageTrackerPanel,
  PerformanceInsightsPanel,
  ReportExportPanel,
  TaxCenterPanel,
  WorkPlannerPanel,
} from "../components/featurePanels";
import {
  ConfirmationDialog,
  EarningsCard,
  EmptyState,
  ErrorState,
  MetricCard,
  PageLayout,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SelectInput,
  TextInput,
} from "../components/ui";
import {
  dateBounds,
  deliveryGross,
  filterDeliveries,
  filterExpenses,
  formatDuration,
  formatMoney,
  summarizeEarnings,
} from "../lib/calculations";
import { ROUTES } from "../lib/routes";
import { useAppState } from "../state/AppContext";
import { useRouter } from "../state/RouterContext";
import type { DatePreset, DeliveryExpense, ExpenseInput, GigPlatform } from "../types/models";

function ReportLink({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: IconName;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-4 rounded-2xl border border-white/8 bg-[#181818] p-4 text-left"
      onClick={onClick}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EF233C]/10 text-[#EF233C]">
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm">{title}</strong>
        <small className="mt-1 block text-xs leading-5 text-[#777]">{description}</small>
      </span>
      <Icon name="chevron" className="h-4 w-4 text-[#555]" />
    </button>
  );
}

function useFilteredReport() {
  const { deliveries, expenses, preferences } = useAppState();
  const [preset, setPreset] = useState<DatePreset>("week");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const filteredDeliveries = useMemo(
    () => filterDeliveries(deliveries, { preset, start, end }),
    [deliveries, end, preset, start],
  );
  const filteredExpenses = useMemo(
    () => filterExpenses(expenses, preset, start, end),
    [end, expenses, preset, start],
  );
  const summary = useMemo(
    () => summarizeEarnings(filteredDeliveries, filteredExpenses, preferences.costPerMile),
    [filteredDeliveries, filteredExpenses, preferences.costPerMile],
  );
  return {
    preset,
    setPreset,
    start,
    setStart,
    end,
    setEnd,
    filteredDeliveries,
    filteredExpenses,
    summary,
  };
}

export function ReportsOverviewScreen() {
  const { navigate } = useRouter();
  const report = useFilteredReport();
  return (
    <PageLayout title="Reports" subtitle="Recorded earnings and estimates">
      <DateRangeFilter
        preset={report.preset}
        onPreset={report.setPreset}
        start={report.start}
        end={report.end}
        onStart={report.setStart}
        onEnd={report.setEnd}
      />
      <div className="mt-5">
        <EarningsCard
          label="Estimated net profit"
          value={report.summary.estimatedNet}
          note="Not verified take-home pay"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricCard label="Gross" value={formatMoney(report.summary.gross)} positive />
        <MetricCard label="Est. expenses" value={formatMoney(report.summary.estimatedExpenses)} />
        <MetricCard label="Mileage" value={`${report.summary.miles.toFixed(1)} mi`} />
        <MetricCard label="Deliveries" value={String(report.summary.deliveryCount)} />
      </div>
      <SectionHeader title="Explore reports" />
      <div className="space-y-3">
        <ReportLink
          title="Earnings analytics"
          description="Trends, platform mix, and averages"
          icon="chart"
          onClick={() => navigate(ROUTES.earningsAnalytics)}
        />
        <ReportLink
          title="Expense tracking"
          description="Add and manage non-mileage costs"
          icon="wallet"
          onClick={() => navigate(ROUTES.expenses)}
        />
        <ReportLink
          title="Profit breakdown"
          description="See how every estimate is calculated"
          icon="delivery"
          onClick={() => navigate(ROUTES.profitBreakdown)}
        />
        <ReportLink
          title="Platform comparison"
          description="Compare your recorded platform results"
          icon="miles"
          onClick={() => navigate(ROUTES.platformComparison)}
        />
      </div>
      <SectionHeader title="Export" />
      <ReportExportPanel />
      <SectionHeader title="Performance" />
      <PerformanceInsightsPanel />
    </PageLayout>
  );
}

export function EarningsAnalyticsScreen() {
  const { preferences } = useAppState();
  const report = useFilteredReport();
  const previous = useMemo(() => {
    if (report.preset !== "week") return null;
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() - 7);
    const start = new Date(now);
    start.setDate(now.getDate() - 13);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }, [report.preset]);
  const { deliveries, expenses } = useAppState();
  const previousSummary = useMemo(() => {
    if (!previous) return null;
    const previousDeliveries = filterDeliveries(deliveries, previous);
    const previousExpenses = expenses.filter(
      (item) => item.date >= previous.start && item.date <= previous.end,
    );
    return summarizeEarnings(previousDeliveries, previousExpenses, preferences.costPerMile);
  }, [deliveries, expenses, preferences.costPerMile, previous]);
  const comparison =
    previousSummary && previousSummary.gross > 0
      ? ((report.summary.gross - previousSummary.gross) / previousSummary.gross) * 100
      : null;

  return (
    <PageLayout title="Earnings analytics" subtitle="Gross performance trends" back>
      <DateRangeFilter
        preset={report.preset}
        onPreset={report.setPreset}
        start={report.start}
        end={report.end}
        onStart={report.setStart}
        onEnd={report.setEnd}
      />
      <SectionHeader title="Earnings trend" />
      <EarningsChart
        deliveries={report.filteredDeliveries}
        days={report.preset === "month" ? 30 : 7}
      />
      {comparison !== null && (
        <p
          className={`mt-3 text-sm font-bold ${comparison >= 0 ? "text-[#48FF85]" : "text-[#ff6678]"}`}
        >
          {comparison >= 0 ? "+" : ""}
          {comparison.toFixed(1)}% gross vs previous week
        </p>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricCard
          label="Avg / delivery"
          value={formatMoney(
            report.summary.deliveryCount ? report.summary.gross / report.summary.deliveryCount : 0,
          )}
        />
        <MetricCard label="Gross / mile" value={formatMoney(report.summary.grossPerMile)} />
        <MetricCard label="Gross / hour" value={formatMoney(report.summary.grossPerHour)} />
        <MetricCard
          label="Net / hour est."
          value={formatMoney(report.summary.netPerHour)}
          positive
        />
      </div>
      <SectionHeader title="Earnings by platform" />
      <PlatformBars
        deliveries={report.filteredDeliveries}
        expenses={report.filteredExpenses}
        costPerMile={preferences.costPerMile}
      />
      <SectionHeader title="Forecasting" />
      <ForecastPanel />
      <SectionHeader title="Historical work planner" />
      <WorkPlannerPanel />
    </PageLayout>
  );
}

function ExpenseForm({
  expense,
  onSave,
  onCancel,
}: {
  expense?: DeliveryExpense;
  onSave: (input: ExpenseInput) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(expense?.category ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [error, setError] = useState("");
  const categories = [
    "Fuel",
    "Maintenance",
    "Parking",
    "Tolls",
    "Supplies",
    "Insurance",
    "Phone",
    "Other",
  ];
  const options = categories.includes(category) ? categories : [category, ...categories];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!category.trim()) return setError("Enter an expense category.");
    if (!(Number(amount) > 0)) return setError("Amount must be greater than zero.");
    if (!date) return setError("Choose a date.");
    onSave({
      deliveryId: expense?.deliveryId,
      category: category.trim(),
      amount: Number(amount),
      date,
      notes: notes.trim() || undefined,
    });
  };
  return (
    <form
      className="space-y-4 rounded-2xl border border-white/10 bg-[#181818] p-4"
      onSubmit={submit}
    >
      <h2 className="font-extrabold">{expense ? "Edit expense" : "Add expense"}</h2>
      <SelectInput
        label="Category"
        value={category}
        onChange={setCategory}
        options={options.map((value) => ({ label: value, value }))}
      />
      <TextInput
        label="Amount"
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <TextInput
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && <ErrorState message={error} />}
      <div className="grid grid-cols-2 gap-3">
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
        <PrimaryButton type="submit">Save</PrimaryButton>
      </div>
    </form>
  );
}

export function ExpenseTrackingScreen() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useAppState();
  const [editing, setEditing] = useState<DeliveryExpense | "new">();
  const [deleting, setDeleting] = useState<DeliveryExpense>();
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const week = dateBounds("week");
  const month = dateBounds("month");
  const periodTotal = (start?: string, end?: string) =>
    expenses
      .filter((expense) => (!start || expense.date >= start) && (!end || expense.date <= end))
      .reduce((sum, expense) => sum + expense.amount, 0);
  return (
    <PageLayout
      title="Expenses"
      subtitle={`${formatMoney(total)} recorded`}
      back
      action={
        <button
          className="icon-button bg-[#EF233C] text-white"
          onClick={() => setEditing("new")}
          aria-label="Add expense"
        >
          <Icon name="plus" />
        </button>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-2">
        <MetricCard label="Today" value={formatMoney(periodTotal(todayKey, todayKey))} />
        <MetricCard label="7 days" value={formatMoney(periodTotal(week.start, week.end))} />
        <MetricCard label="30 days" value={formatMoney(periodTotal(month.start, month.end))} />
      </div>
      {editing && (
        <ExpenseForm
          expense={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(undefined)}
          onSave={(input) => {
            if (editing === "new") addExpense(input);
            else updateExpense(editing.id, input);
            setEditing(undefined);
          }}
        />
      )}
      {!editing && (
        <PrimaryButton onClick={() => setEditing("new")}>
          <span className="flex items-center justify-center gap-2">
            <Icon name="plus" /> Add expense
          </span>
        </PrimaryButton>
      )}
      <SectionHeader title="Expense history" />
      <div className="space-y-3">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            onEdit={() => setEditing(expense)}
            onDelete={() => setDeleting(expense)}
            locked={expense.source === "maintenance"}
          />
        ))}
        {!expenses.length && (
          <EmptyState
            icon="wallet"
            title="No expenses recorded"
            description="Mileage costs are estimated automatically. Add separate costs such as tolls or parking here."
          />
        )}
      </div>
      <ConfirmationDialog
        open={!!deleting}
        title="Delete expense?"
        description="This expense will no longer be included in estimated profit."
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) deleteExpense(deleting.id);
          setDeleting(undefined);
        }}
      />
      <MileageTrackerPanel />
    </PageLayout>
  );
}

export function ProfitBreakdownScreen() {
  const report = useFilteredReport();
  const rows = [
    ["Gross earnings", report.summary.gross, true],
    ["Recorded tips (included in gross)", report.summary.tips, false],
    ["Mileage-based vehicle costs", -report.summary.mileageCost, false],
    ["Additional expenses", -report.summary.additionalExpenses, false],
  ] as const;
  return (
    <PageLayout title="Profit breakdown" subtitle="Transparent local estimates" back>
      <DateRangeFilter
        preset={report.preset}
        onPreset={report.setPreset}
        start={report.start}
        end={report.end}
        onStart={report.setStart}
        onEnd={report.setEnd}
      />
      <div className="mt-5">
        <EarningsCard
          label="Estimated net earnings"
          value={report.summary.estimatedNet}
          note="Not tax advice or a verified bank deposit"
        />
      </div>
      <div className="mt-4 rounded-2xl border border-white/8 bg-[#181818] p-4">
        {rows.map(([label, value, positive]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-white/7 py-4 last:border-0"
          >
            <span className="max-w-[65%] text-sm text-[#A3A3A3]">{label}</span>
            <span className={`font-extrabold ${positive ? "text-[#48FF85]" : ""}`}>
              {formatMoney(value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Gross / mile" value={formatMoney(report.summary.grossPerMile)} />
        <MetricCard label="Net / hour est." value={formatMoney(report.summary.netPerHour)} />
      </div>
      <p className="mt-5 text-xs leading-5 text-[#777]">
        Tips are displayed for transparency but are not added twice. Gross includes tips according
        to each delivery’s “payout includes tips” setting.
      </p>
      <TaxCenterPanel />
    </PageLayout>
  );
}

export function PlatformComparisonScreen() {
  const { deliveries, expenses, preferences, profile } = useAppState();
  const groups = useMemo(
    () => {
      const recentStart = dateBounds("month").start!;
      const previousEndDate = new Date(`${recentStart}T12:00:00`);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - 29);
      const previousStart = previousStartDate.toISOString().slice(0, 10);
      const previousEnd = previousEndDate.toISOString().slice(0, 10);
      return profile.platforms.map((platform) => {
        const items = deliveries.filter((delivery) => delivery.platform === platform);
        const ids = new Set(items.map((item) => item.id));
        const relatedExpenses = expenses.filter(
          (expense) => expense.deliveryId && ids.has(expense.deliveryId),
        );
        return {
          platform,
          summary: summarizeEarnings(items, relatedExpenses, preferences.costPerMile),
          recent: summarizeEarnings(
            items.filter((delivery) => delivery.date >= recentStart),
            relatedExpenses.filter((expense) => expense.date >= recentStart),
            preferences.costPerMile,
          ),
          previous: summarizeEarnings(
            items.filter(
              (delivery) => delivery.date >= previousStart && delivery.date <= previousEnd,
            ),
            relatedExpenses.filter(
              (expense) => expense.date >= previousStart && expense.date <= previousEnd,
            ),
            preferences.costPerMile,
          ),
        };
      });
    },
    [deliveries, expenses, preferences.costPerMile, profile.platforms],
  );
  return (
    <PageLayout title="Platform comparison" subtitle="Recorded delivery performance" back>
      {!groups.length ? (
        <EmptyState
          title="Select platforms first"
          description="Add gig platforms in your profile to compare them."
        />
      ) : (
        <div className="space-y-3">
          {groups.map(({ platform, summary, recent, previous }) => (
            <article key={platform} className="rounded-2xl border border-white/8 bg-[#181818] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-extrabold">{platform}</h2>
                  <p className="mt-1 text-xs text-[#777]">
                    {summary.deliveryCount} deliveries · {summary.miles.toFixed(1)} mi
                  </p>
                </div>
                {summary.deliveryCount > 0 ? (
                  <div className="text-right">
                    <p className="text-xl font-black text-[#48FF85]">
                      {formatMoney(summary.estimatedNet)}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase text-[#777]">
                      Estimated net
                    </p>
                  </div>
                ) : (
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-[#777]">
                    No records
                  </span>
                )}
              </div>
              {summary.deliveryCount > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/7 pt-3 sm:grid-cols-4">
                <SmallMetric label="Gross" value={formatMoney(summary.gross)} />
                <SmallMetric label="Net / hour" value={formatMoney(summary.netPerHour)} />
                <SmallMetric
                  label="Net / mile"
                  value={formatMoney(
                    summary.miles ? summary.estimatedNet / summary.miles : 0,
                  )}
                />
                <SmallMetric
                  label="Avg / delivery"
                  value={formatMoney(
                    summary.deliveryCount ? summary.gross / summary.deliveryCount : 0,
                  )}
                />
                <SmallMetric label="Completed" value={String(summary.deliveryCount)} />
                <SmallMetric label="Mileage" value={`${summary.miles.toFixed(1)} mi`} />
                <SmallMetric label="Work time" value={formatDuration(summary.durationMinutes)} />
                <SmallMetric
                  label="30-day trend"
                  value={
                    !recent.deliveryCount
                      ? "No records"
                      : previous.estimatedNet
                        ? `${((recent.estimatedNet - previous.estimatedNet) / Math.abs(previous.estimatedNet) * 100).toFixed(1)}%`
                        : "No prior period"
                  }
                />
                </div>
              ) : (
                <p className="mt-4 border-t border-white/7 pt-3 text-sm text-[#A3A3A3]">
                  Add a completed {platform} delivery to calculate performance.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="mt-5 text-xs leading-5 text-[#777]">
        Unattached general expenses are included in overall profit but cannot be attributed to a
        specific platform.
      </p>
    </PageLayout>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#777]">{label}</p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}
