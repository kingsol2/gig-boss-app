import { useMemo, useState, type FormEvent } from "react";
import { formatMoney, summarizeEarnings } from "../lib/calculations";
import { useAppState } from "../state/AppContext";
import type { GigPlatform, MaintenanceRecord, MaintenanceType, MileageTrip } from "../types/models";
import type { DeliveryOfferRecord } from "../types/profitIntelligence";
import { evaluateDeliveryOffer } from "../utils/gigBossAlgorithm";
import {
  analyzeWorkPatterns,
  buildCoachInsights,
  calculateEarningsForecast,
  calculateMilestones,
  compareThirtyDayPerformance,
  createFinancialCsv,
  downloadCsv,
  mileageTripDistance,
  netForDate,
  planningSetAside,
  sumMileageTrips,
} from "../utils/financialInsights";
import { Icon } from "./Icon";
import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  IntegrationNotice,
  MetricCard,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextInput,
} from "./ui";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string) => Number(value) || 0;

function PanelTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#EF233C]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#A3A3A3]">{description}</p>
    </div>
  );
}

export function OfferAnalyzerPanel() {
  const { preferences, profile } = useAppState();
  const platforms = profile.platforms.length ? profile.platforms : [];
  const [form, setForm] = useState({
    platform: platforms[0] ?? "",
    payment: "",
    miles: "",
    minutes: "",
    vehicleCost: "",
    additional: "",
    greenHourly: "",
    yellowHourly: "",
    greenPerMile: "",
    yellowPerMile: "",
  });
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReturnType<typeof evaluateDeliveryOffer>>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payment = money(form.payment);
    const miles = money(form.miles);
    const minutes = money(form.minutes);
    const vehicleCost =
      form.vehicleCost === "" ? miles * preferences.costPerMile : money(form.vehicleCost);
    const greenHourly = money(form.greenHourly);
    const yellowHourly = money(form.yellowHourly);
    const greenPerMile = money(form.greenPerMile);
    const yellowPerMile = money(form.yellowPerMile);
    if (!form.platform) return setError("Select a configured platform.");
    if (payment <= 0 || miles <= 0 || minutes <= 0)
      return setError("Enter a positive payment, mileage, and completion time.");
    if (
      yellowHourly <= 0 ||
      yellowPerMile <= 0 ||
      greenHourly < yellowHourly ||
      greenPerMile < yellowPerMile
    )
      return setError("Enter profitability targets with strong targets at or above minimums.");

    const offer: DeliveryOfferRecord = {
      id: crypto.randomUUID(),
      recordType: "delivery-offer",
      status: "projected",
      platform: form.platform as GigPlatform,
      offeredAt: new Date().toISOString(),
      projectedGross: payment,
      projectedMiles: miles,
      projectedDurationMinutes: minutes,
      projectedAdditionalExpenses: money(form.additional),
    };
    setResult(
      evaluateDeliveryOffer(offer, {
        asOf: new Date().toISOString(),
        costPerMile: vehicleCost / miles,
        thresholds: {
          greenMinimumNetHourly: greenHourly,
          yellowMinimumNetHourly: yellowHourly,
          greenMinimumNetPerMile: greenPerMile,
          yellowMinimumNetPerMile: yellowPerMile,
        },
      }),
    );
    setError("");
  };

  return (
    <section className="space-y-5" aria-labelledby="offer-analyzer-title">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#EF233C]">
          Projected offer
        </p>
        <h2 id="offer-analyzer-title" className="mt-1 text-xl font-black">
          Delivery offer analyzer
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#A3A3A3]">
          Deterministic analysis using your inputs. Offers are never counted as completed income.
        </p>
      </div>
      {!platforms.length ? (
        <IntegrationNotice>Select at least one gig platform in Profile before analysis.</IntegrationNotice>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <SelectInput
            label="Platform"
            value={form.platform}
            onChange={(platform) => setForm({ ...form, platform: platform as GigPlatform })}
            options={platforms.map((platform) => ({ label: platform, value: platform }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Offered payment"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.payment}
              onChange={(event) => setForm({ ...form, payment: event.target.value })}
            />
            <TextInput
              label="Estimated miles"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={form.miles}
              onChange={(event) => setForm({ ...form, miles: event.target.value })}
            />
          </div>
          <TextInput
            label="Estimated completion time (minutes)"
            type="number"
            min="1"
            inputMode="numeric"
            value={form.minutes}
            onChange={(event) => setForm({ ...form, minutes: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Vehicle cost estimate"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.vehicleCost}
              onChange={(event) => setForm({ ...form, vehicleCost: event.target.value })}
              hint={`Blank uses ${formatMoney(preferences.costPerMile)}/mile`}
            />
            <TextInput
              label="Additional expenses"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.additional}
              onChange={(event) => setForm({ ...form, additional: event.target.value })}
            />
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#181818] p-4">
            <p className="text-xs font-extrabold uppercase tracking-wider">Your profit targets</p>
            <p className="mt-1 text-xs leading-5 text-[#777]">
              These driver-entered targets control the green, yellow, and red assessment.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <TextInput
                label="Strong net / hour"
                type="number"
                min="0"
                step="0.01"
                value={form.greenHourly}
                onChange={(event) => setForm({ ...form, greenHourly: event.target.value })}
              />
              <TextInput
                label="Minimum net / hour"
                type="number"
                min="0"
                step="0.01"
                value={form.yellowHourly}
                onChange={(event) => setForm({ ...form, yellowHourly: event.target.value })}
              />
              <TextInput
                label="Strong net / mile"
                type="number"
                min="0"
                step="0.01"
                value={form.greenPerMile}
                onChange={(event) => setForm({ ...form, greenPerMile: event.target.value })}
              />
              <TextInput
                label="Minimum net / mile"
                type="number"
                min="0"
                step="0.01"
                value={form.yellowPerMile}
                onChange={(event) => setForm({ ...form, yellowPerMile: event.target.value })}
              />
            </div>
          </div>
          {error && <ErrorState message={error} />}
          <PrimaryButton type="submit">Analyze projected offer</PrimaryButton>
        </form>
      )}
      {result?.metrics && (
        <div
          className={`rounded-2xl border p-5 ${
            result.zone === "green"
              ? "border-[#48FF85]/30 bg-[#48FF85]/6"
              : result.zone === "yellow"
                ? "border-yellow-400/30 bg-yellow-400/6"
                : "border-[#EF233C]/30 bg-[#EF233C]/6"
          }`}
          aria-live="polite"
        >
          <p className="text-xs font-black uppercase tracking-wider">
            {result.recommendation === "strong"
              ? "Meets your strong targets"
              : result.recommendation === "conditional"
                ? "Meets your minimum targets"
                : "Below your minimum targets"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard label="Projected net" value={formatMoney(result.metrics.estimatedNetEarnings)} />
            <MetricCard label="Vehicle cost" value={formatMoney(result.metrics.mileageCost)} />
            <MetricCard
              label="Net / mile"
              value={formatMoney(result.metrics.estimatedNetPerMile.value ?? 0)}
            />
            <MetricCard
              label="Net / hour"
              value={formatMoney(result.metrics.estimatedNetHourly.value ?? 0)}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-[#A3A3A3]">
            Projected payment minus estimated vehicle cost and additional expenses. This is not a
            completed delivery and was not added to earnings.
          </p>
        </div>
      )}
    </section>
  );
}

export function DailyGoalPanel() {
  const { deliveries, expenses, preferences, setDailyNetGoal } = useAppState();
  const [editing, setEditing] = useState(!preferences.dailyNetGoal);
  const [goal, setGoal] = useState(preferences.dailyNetGoal ? String(preferences.dailyNetGoal) : "");
  const current = netForDate(today(), deliveries, expenses, preferences.costPerMile);
  const target = preferences.dailyNetGoal ?? 0;
  const progress = target > 0 ? Math.min(100, Math.max(0, (current.estimatedNet / target) * 100)) : 0;
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().slice(0, 10);
  });

  return (
    <section className="rounded-2xl border border-white/8 bg-[#181818] p-5">
      <div className="flex items-start justify-between gap-3">
        <PanelTitle
          eyebrow="Daily goal"
          title={target ? `${formatMoney(target)} net target` : "Set a net-profit target"}
          description="Progress uses estimated net profit, never gross earnings."
        />
        {target > 0 && (
          <button
            type="button"
            className="icon-button shrink-0"
            onClick={() => setEditing(true)}
            aria-label="Edit daily goal"
          >
            <Icon name="edit" />
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(goal);
            if (value > 0) {
              setDailyNetGoal(value);
              setEditing(false);
            }
          }}
        >
          <TextInput
            label="Daily estimated net-profit target"
            type="number"
            min="1"
            step="1"
            inputMode="decimal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            {target > 0 && (
              <SecondaryButton type="button" onClick={() => setEditing(false)}>
                Cancel
              </SecondaryButton>
            )}
            <PrimaryButton type="submit">Save target</PrimaryButton>
          </div>
        </form>
      ) : (
        <>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-[#48FF85]">
                {formatMoney(current.estimatedNet)}
              </p>
              <p className="mt-1 text-xs text-[#777]">Today’s estimated net</p>
            </div>
            <p className="text-sm font-bold text-[#A3A3A3]">
              {formatMoney(Math.max(0, target - current.estimatedNet))} remaining
            </p>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-white/6"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div className="h-full rounded-full bg-[#EF233C]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1" aria-label="Last seven daily goal results">
            {dates.reverse().map((date) => {
              const net = netForDate(date, deliveries, expenses, preferences.costPerMile).estimatedNet;
              const met = net >= target;
              return (
                <div key={date} className="text-center">
                  <span
                    className={`mx-auto block h-3 w-3 rounded-full ${
                      met ? "bg-[#48FF85]" : net !== 0 ? "bg-[#EF233C]" : "bg-white/10"
                    }`}
                    title={`${date}: ${formatMoney(net)}`}
                    role="img"
                    aria-label={`${date}: ${formatMoney(net)} estimated net${met ? ", goal met" : ""}`}
                  />
                  <span className="mt-1 block text-[9px] text-[#777]">
                    {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" })}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export function CoachPanel() {
  const { deliveries, expenses, preferences } = useAppState();
  const insights = buildCoachInsights(
    deliveries,
    expenses,
    preferences.costPerMile,
    preferences.dailyNetGoal,
  );
  return (
    <section className="rounded-2xl border border-white/8 bg-[#181818] p-5">
      <PanelTitle
        eyebrow="Gig Boss Coach"
        title="Private performance guidance"
        description="Deterministic insights from local records. No conversational AI or external data sharing."
      />
      <div className="mt-4 space-y-3">
        {insights.map((insight) => (
          <div key={insight} className="flex gap-3 text-sm leading-6 text-[#A3A3A3]">
            <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-[#48FF85]" />
            <p>{insight}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ForecastPanel() {
  const { deliveries, expenses, preferences } = useAppState();
  const forecast = useMemo(
    () => calculateEarningsForecast(deliveries, expenses, preferences.costPerMile),
    [deliveries, expenses, preferences.costPerMile],
  );
  return (
    <section className="rounded-2xl border border-white/8 bg-[#181818] p-5">
      <PanelTitle
        eyebrow="Forecast"
        title="Historical earnings projection"
        description="Uses the last 28 days of recorded work. It is not a guarantee of future earnings."
      />
      {forecast.status === "insufficient-data" ? (
        <div className="mt-4">
          <EmptyState
            icon="chart"
            title="More history required"
            description={`Record at least 5 deliveries across 3 active days. Current basis: ${forecast.basisDeliveryCount} deliveries across ${forecast.basisActiveDays} days.`}
          />
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MetricCard label="Weekly net estimate" value={formatMoney(forecast.weekly)} positive />
            <MetricCard label="Monthly net estimate" value={formatMoney(forecast.monthly)} positive />
            <MetricCard label="Weekly expenses est." value={formatMoney(forecast.weeklyExpenses)} />
            <MetricCard label="Weekly work hours" value={`${forecast.weeklyHours.toFixed(1)}h`} />
            <MetricCard label="Historical 28-day net" value={formatMoney(forecast.historicalNet)} />
            <MetricCard label="Historical deliveries" value={String(forecast.basisDeliveryCount)} />
          </div>
          <div className="mt-4 rounded-xl bg-black/20 p-4 text-sm leading-6 text-[#A3A3A3]">
            <p>
              Observed weekly range:{" "}
              <strong className="text-white">
                {formatMoney(forecast.weeklyLow)}–{formatMoney(forecast.weeklyHigh)}
              </strong>
            </p>
            <p>
              Observed monthly range:{" "}
              <strong className="text-white">
                {formatMoney(forecast.monthlyLow)}–{formatMoney(forecast.monthlyHigh)}
              </strong>
            </p>
            <p className="mt-2 text-xs text-[#777]">
              Range uses your lowest and highest recorded active-day net results scaled by recent
              work frequency.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export function WorkPlannerPanel() {
  const { deliveries, expenses, preferences } = useAppState();
  const [view, setView] = useState<"days" | "times" | "platforms">("days");
  const patterns = useMemo(
    () => analyzeWorkPatterns(deliveries, expenses, preferences.costPerMile),
    [deliveries, expenses, preferences.costPerMile],
  );
  const items = patterns[view].slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === "available" ? -1 : 1;
    return b.netPerHour - a.netPerHour;
  });
  const available = items.filter((item) => item.status === "available");
  return (
    <section className="rounded-2xl border border-white/8 bg-[#181818] p-5">
      <PanelTitle
        eyebrow="Work planner"
        title="Best time to work"
        description="Historical mileage estimates and delivery-linked expenses only—no live demand, surge, or future volume data."
      />
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1">
        {(["days", "times", "platforms"] as const).map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => setView(option)}
            aria-pressed={view === option}
            className={`min-h-11 rounded-lg text-xs font-bold capitalize ${
              view === option ? "bg-[#EF233C] text-white" : "text-[#777]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {!available.length ? (
        <p className="mt-4 rounded-xl bg-black/20 p-4 text-sm leading-6 text-[#A3A3A3]">
          {view === "times"
            ? "Time-of-day comparison needs at least two completed deliveries with a recorded start time in a time period."
            : "Each comparison needs at least two completed deliveries with recorded duration."}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.slice(0, 5).map((item, index) => (
            <div key={item.key} className="rounded-xl border border-white/7 bg-black/15 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold">
                    {item.status === "available" && index === 0 ? "Best recorded · " : ""}
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-[#777]">{item.deliveryCount} deliveries</p>
                </div>
                <p className={item.status === "available" ? "font-black text-[#48FF85]" : "text-[#777]"}>
                  {item.status === "available" ? `${formatMoney(item.netPerHour)}/hr` : "Not enough data"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MileageTripForm({
  trip,
  onSave,
  onCancel,
}: {
  trip?: MileageTrip;
  onSave: (input: Omit<MileageTrip, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(trip?.date ?? today());
  const [start, setStart] = useState(trip ? String(trip.startOdometer) : "");
  const [end, setEnd] = useState(trip ? String(trip.endOdometer) : "");
  const [purpose, setPurpose] = useState(trip?.purpose ?? "Gig deliveries");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-2xl border border-white/10 bg-[#181818] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!date || !purpose.trim()) return setError("Enter a date and business purpose.");
        if (Number(end) <= Number(start)) return setError("End mileage must be greater than start mileage.");
        onSave({
          date,
          startOdometer: Number(start),
          endOdometer: Number(end),
          purpose: purpose.trim(),
          notes: notes.trim() || undefined,
        });
      }}
    >
      <h3 className="font-extrabold">{trip ? "Edit mileage trip" : "Add mileage trip"}</h3>
      <TextInput label="Trip date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Start odometer"
          type="number"
          min="0"
          step="0.1"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <TextInput
          label="End odometer"
          type="number"
          min="0"
          step="0.1"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </div>
      <TextInput label="Business purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
      <TextInput label="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
      {error && <ErrorState message={error} />}
      <div className="grid grid-cols-2 gap-3">
        <SecondaryButton type="button" onClick={onCancel}>Cancel</SecondaryButton>
        <PrimaryButton type="submit">Save trip</PrimaryButton>
      </div>
    </form>
  );
}

export function MileageTrackerPanel() {
  const { mileageTrips, addMileageTrip, updateMileageTrip, deleteMileageTrip } = useAppState();
  const [editing, setEditing] = useState<MileageTrip | "new">();
  const [deleting, setDeleting] = useState<MileageTrip>();
  const end = today();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 29);
  return (
    <section className="mt-7 border-t border-white/10 pt-6">
      <PanelTitle
        eyebrow="Mileage log"
        title="Manual business trips"
        description="Odometer mileage is tracked separately from delivery mileage so vehicle costs are not counted twice."
      />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricCard label="Today" value={`${sumMileageTrips(mileageTrips, end, end).toFixed(1)} mi`} />
        <MetricCard
          label="7 days"
          value={`${sumMileageTrips(mileageTrips, weekStart.toISOString().slice(0, 10), end).toFixed(1)} mi`}
        />
        <MetricCard
          label="30 days"
          value={`${sumMileageTrips(mileageTrips, monthStart.toISOString().slice(0, 10), end).toFixed(1)} mi`}
        />
      </div>
      <div className="mt-4">
        {editing ? (
          <MileageTripForm
            trip={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(undefined)}
            onSave={(input) => {
              if (editing === "new") addMileageTrip(input);
              else updateMileageTrip(editing.id, input);
              setEditing(undefined);
            }}
          />
        ) : (
          <PrimaryButton onClick={() => setEditing("new")}>Add manual trip</PrimaryButton>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {mileageTrips.map((trip) => (
          <article key={trip.id} className="flex items-center gap-3 rounded-xl bg-[#181818] p-4">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{mileageTripDistance(trip).toFixed(1)} miles</p>
              <p className="mt-1 truncate text-xs text-[#777]">{trip.date} · {trip.purpose}</p>
            </div>
            <button type="button" className="icon-button" onClick={() => setEditing(trip)} aria-label="Edit mileage trip">
              <Icon name="edit" />
            </button>
            <button type="button" className="icon-button text-[#ff6678]" onClick={() => setDeleting(trip)} aria-label="Delete mileage trip">
              <Icon name="trash" />
            </button>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-[#777]">
        Automatic background tracking requires a future native permission-enabled implementation.
      </p>
      <ConfirmationDialog
        open={Boolean(deleting)}
        title="Delete mileage trip?"
        description="This removes the manual odometer record. Delivery records are unchanged."
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) deleteMileageTrip(deleting.id);
          setDeleting(undefined);
        }}
      />
    </section>
  );
}

export function TaxCenterPanel() {
  const { deliveries, expenses, mileageTrips, preferences } = useAppState();
  const years = [...new Set([...deliveries.map((item) => item.date.slice(0, 4)), String(new Date().getFullYear())])].sort().reverse();
  const [year, setYear] = useState(years[0]);
  const [rate, setRate] = useState("");
  const yearDeliveries = deliveries.filter((delivery) => delivery.date.startsWith(year));
  const yearExpenses = expenses.filter((expense) => expense.date.startsWith(year));
  const summary = summarizeEarnings(yearDeliveries, yearExpenses, preferences.costPerMile);
  const categoryTotals = [...new Set(yearExpenses.map((expense) => expense.category))]
    .map((category) => ({
      category,
      total: yearExpenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .sort((left, right) => right.total - left.total);
  const quarters = [1, 2, 3, 4].map((quarter) => {
    const startMonth = String((quarter - 1) * 3 + 1).padStart(2, "0");
    const endMonth = String(quarter * 3).padStart(2, "0");
    const start = `${year}-${startMonth}-01`;
    const endDate = new Date(Number(year), quarter * 3, 0);
    const end = `${year}-${endMonth}-${String(endDate.getDate()).padStart(2, "0")}`;
    return {
      quarter,
      summary: summarizeEarnings(
        yearDeliveries.filter((delivery) => delivery.date >= start && delivery.date <= end),
        yearExpenses.filter((expense) => expense.date >= start && expense.date <= end),
        preferences.costPerMile,
      ),
    };
  });
  const setAside = rate === "" ? null : planningSetAside(summary.estimatedNet, Number(rate));

  return (
    <section className="mt-7 border-t border-white/10 pt-6">
      <PanelTitle
        eyebrow="Tax center"
        title="Recorded business summary"
        description="Recorded amounts and planning estimates are separated. This is not tax advice."
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SelectInput
          label="Tax year"
          value={year}
          onChange={setYear}
          options={years.map((value) => ({ label: value, value }))}
        />
        <TextInput
          label="Your planning rate (%)"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
          hint="Optional, driver supplied"
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Gross recorded" value={formatMoney(summary.gross)} />
        <MetricCard label="Expenses recorded" value={formatMoney(summary.additionalExpenses)} />
        <MetricCard label="Vehicle cost est." value={formatMoney(summary.mileageCost)} />
        <MetricCard label="Net business est." value={formatMoney(summary.estimatedNet)} positive />
        <MetricCard label="Delivery miles" value={`${summary.miles.toFixed(1)} mi`} />
        <MetricCard label="Odometer log" value={`${sumMileageTrips(mileageTrips, `${year}-01-01`, `${year}-12-31`).toFixed(1)} mi`} />
      </div>
      {setAside !== null && (
        <div className="mt-4 rounded-xl border border-[#48FF85]/20 bg-[#48FF85]/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#48FF85]">Planning set-aside</p>
          <p className="mt-2 text-2xl font-black">{formatMoney(setAside)}</p>
          <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">
            Based only on your {rate}% planning input and positive estimated net profit. No tax rate
            or legal deductibility has been validated by Gig Boss.
          </p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {quarters.map(({ quarter, summary: quarterSummary }) => (
          <div key={quarter} className="rounded-xl bg-[#181818] p-4">
            <p className="text-xs font-bold uppercase text-[#777]">Quarter {quarter}</p>
            <p className="mt-2 font-black text-[#48FF85]">{formatMoney(quarterSummary.estimatedNet)}</p>
            <p className="mt-1 text-xs text-[#777]">{quarterSummary.deliveryCount} deliveries</p>
            {rate !== "" && (
              <p className="mt-1 text-xs text-[#A3A3A3]">
                {formatMoney(planningSetAside(quarterSummary.estimatedNet, Number(rate)))} planned
                set-aside
              </p>
            )}
          </div>
        ))}
      </div>
      {categoryTotals.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#181818] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#777]">
            Recorded expense categories
          </p>
          <div className="mt-2">
            {categoryTotals.map((item) => (
              <div
                key={item.category}
                className="flex justify-between border-b border-white/7 py-2 text-sm last:border-0"
              >
                <span className="text-[#A3A3A3]">{item.category}</span>
                <strong>{formatMoney(item.total)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      <PrimaryButton
        className="mt-4"
        onClick={() =>
          downloadCsv(
            `gig-boss-tax-summary-${year}.csv`,
            createFinancialCsv({
              deliveries,
              expenses,
              mileageTrips,
              costPerMile: preferences.costPerMile,
              start: `${year}-01-01`,
              end: `${year}-12-31`,
            }),
          )
        }
      >
        Download annual tax-planning CSV
      </PrimaryButton>
      <p className="mt-4 text-xs leading-5 text-[#777]">
        Delivery mileage and manual odometer mileage are shown separately and are not added together.
        A qualified professional must determine deductible treatment.
      </p>
    </section>
  );
}

export function ReportExportPanel() {
  const { deliveries, expenses, mileageTrips, preferences, profile } = useAppState();
  const [period, setPeriod] = useState("month");
  const [platform, setPlatform] = useState<GigPlatform | "all">("all");
  const bounds = useMemo(() => {
    const end = today();
    const date = new Date(`${end}T12:00:00`);
    if (period === "day") return { start: end, end };
    if (period === "week") date.setDate(date.getDate() - 6);
    if (period === "month") date.setDate(date.getDate() - 29);
    if (period === "year") return { start: `${end.slice(0, 4)}-01-01`, end };
    return { start: undefined, end: undefined };
  }, [period]);
  return (
    <section className="rounded-2xl border border-white/8 bg-[#181818] p-5">
      <PanelTitle
        eyebrow="Professional reports"
        title="Download financial CSV"
        description="Exports actual local records and clearly labeled estimates. No income verification is implied."
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SelectInput
          label="Report period"
          value={period}
          onChange={setPeriod}
          options={[
            { label: "Daily", value: "day" },
            { label: "Weekly", value: "week" },
            { label: "Monthly", value: "month" },
            { label: "Annual", value: "year" },
            { label: "All records", value: "all" },
          ]}
        />
        <SelectInput
          label="Platform"
          value={platform}
          onChange={(value) => setPlatform(value as GigPlatform | "all")}
          options={[
            { label: "All platforms", value: "all" },
            ...profile.platforms.map((value) => ({ label: value, value })),
          ]}
        />
      </div>
      <PrimaryButton
        className="mt-4"
        onClick={() =>
          downloadCsv(
            `gig-boss-${period}-${platform.toLowerCase().replace(/\s/g, "-")}.csv`,
            createFinancialCsv({
              deliveries,
              expenses,
              mileageTrips,
              costPerMile: preferences.costPerMile,
              start: bounds.start,
              end: bounds.end,
              platform,
            }),
          )
        }
      >
        Download CSV report
      </PrimaryButton>
      <p className="mt-3 text-xs leading-5 text-[#777]">
        PDF export is unavailable because no validated PDF generator is connected.
      </p>
    </section>
  );
}

export function PerformanceInsightsPanel() {
  const { deliveries, expenses, preferences } = useAppState();
  const comparison = compareThirtyDayPerformance(deliveries, expenses, preferences.costPerMile);
  const milestones = calculateMilestones(
    deliveries,
    expenses,
    preferences.costPerMile,
    preferences.dailyNetGoal,
  );
  const change = (value: number | null, inverse = false) => {
    if (value === null) return "Not enough history";
    const improved = inverse ? value <= 0 : value >= 0;
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}% ${improved ? "improved" : "changed"}`;
  };
  return (
    <section className="rounded-2xl border border-white/8 bg-[#181818] p-5">
      <PanelTitle
        eyebrow="Performance"
        title="Insights and milestones"
        description="Personal comparisons from actual records. No public rankings or fictional achievements."
      />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricCard label="Net trend" value={change(comparison.netChangePercent)} />
        <MetricCard label="Mileage efficiency" value={change(comparison.mileageEfficiencyChangePercent)} />
        <MetricCard label="Expense trend" value={change(comparison.expenseChangePercent, true)} />
      </div>
      <div className="mt-5 space-y-3">
        {milestones.map((milestone) => {
          const percent = Math.min(100, Math.max(0, (milestone.progress / milestone.target) * 100));
          return (
            <div key={milestone.label}>
              <div className="mb-2 flex justify-between gap-3 text-xs">
                <span className="font-bold">{milestone.achieved ? "Completed · " : ""}{milestone.label}</span>
                <span className="text-[#777]">
                  {Math.max(0, milestone.progress).toFixed(milestone.unit === "dollars" ? 0 : 1)} / {milestone.target} {milestone.unit}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-white/6"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={`h-full rounded-full ${milestone.achieved ? "bg-[#48FF85]" : "bg-[#EF233C]"}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const maintenanceTypes: MaintenanceType[] = [
  "Oil change",
  "Tires",
  "Brakes",
  "Repair",
  "Inspection",
  "Other",
];

function MaintenanceForm({
  record,
  onSave,
  onCancel,
}: {
  record?: MaintenanceRecord;
  onSave: (input: Omit<MaintenanceRecord, "id" | "expenseId" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}) {
  const [serviceType, setServiceType] = useState<MaintenanceType>(record?.serviceType ?? "Oil change");
  const [date, setDate] = useState(record?.date ?? today());
  const [odometer, setOdometer] = useState(record ? String(record.odometer) : "");
  const [cost, setCost] = useState(record ? String(record.cost) : "");
  const [next, setNext] = useState(record?.nextServiceOdometer ? String(record.nextServiceOdometer) : "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [error, setError] = useState("");
  return (
    <form
      className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-[#181818] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!date || Number(odometer) < 0 || Number(cost) < 0)
          return setError("Enter a valid date, odometer, and non-negative cost.");
        if (next && Number(next) <= Number(odometer))
          return setError("Next service mileage must be above the service odometer.");
        onSave({
          serviceType,
          date,
          odometer: Number(odometer),
          cost: Number(cost),
          nextServiceOdometer: next ? Number(next) : undefined,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <SelectInput
        label="Service type"
        value={serviceType}
        onChange={(value) => setServiceType(value as MaintenanceType)}
        options={maintenanceTypes.map((value) => ({ label: value, value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Service date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <TextInput label="Odometer" type="number" min="0" step="1" value={odometer} onChange={(event) => setOdometer(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Maintenance cost" type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} />
        <TextInput label="Next service mileage" type="number" min="0" step="1" value={next} onChange={(event) => setNext(event.target.value)} />
      </div>
      <TextInput label="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
      {error && <ErrorState message={error} />}
      <div className="grid grid-cols-2 gap-3">
        <SecondaryButton type="button" onClick={onCancel}>Cancel</SecondaryButton>
        <PrimaryButton type="submit">Save service</PrimaryButton>
      </div>
    </form>
  );
}

export function MaintenancePanel() {
  const {
    vehicle,
    maintenanceRecords,
    updateVehicle,
    addMaintenance,
    updateMaintenance,
    deleteMaintenance,
  } = useAppState();
  const [vehicleForm, setVehicleForm] = useState({
    year: vehicle.year ? String(vehicle.year) : "",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    odometer: vehicle.currentOdometer ? String(vehicle.currentOdometer) : "",
  });
  const [editing, setEditing] = useState<MaintenanceRecord | "new">();
  const [deleting, setDeleting] = useState<MaintenanceRecord>();
  const upcoming = maintenanceRecords
    .filter(
      (record) =>
        record.nextServiceOdometer !== undefined &&
        vehicle.currentOdometer !== undefined &&
        record.nextServiceOdometer >= vehicle.currentOdometer,
    )
    .sort((a, b) => (a.nextServiceOdometer ?? 0) - (b.nextServiceOdometer ?? 0))[0];

  return (
    <section className="mt-7 border-t border-white/10 pt-6">
      <PanelTitle
        eyebrow="Vehicle"
        title="Maintenance intelligence"
        description="Driver-recorded service history and reminders. No diagnostics or manufacturer connection."
      />
      <form
        className="mt-4 space-y-4 rounded-2xl bg-[#181818] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          updateVehicle({
            year: vehicleForm.year ? Number(vehicleForm.year) : undefined,
            make: vehicleForm.make.trim() || undefined,
            model: vehicleForm.model.trim() || undefined,
            currentOdometer: vehicleForm.odometer ? Number(vehicleForm.odometer) : undefined,
          });
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          <TextInput label="Year" type="number" min="1900" max="2100" value={vehicleForm.year} onChange={(event) => setVehicleForm({ ...vehicleForm, year: event.target.value })} />
          <TextInput label="Make" value={vehicleForm.make} onChange={(event) => setVehicleForm({ ...vehicleForm, make: event.target.value })} />
          <TextInput label="Model" value={vehicleForm.model} onChange={(event) => setVehicleForm({ ...vehicleForm, model: event.target.value })} />
        </div>
        <TextInput label="Current odometer" type="number" min="0" step="1" value={vehicleForm.odometer} onChange={(event) => setVehicleForm({ ...vehicleForm, odometer: event.target.value })} />
        <PrimaryButton type="submit">Save vehicle information</PrimaryButton>
      </form>
      {upcoming && (
        <div className="mt-4 rounded-xl border border-yellow-400/25 bg-yellow-400/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-yellow-300">Upcoming service</p>
          <p className="mt-2 font-extrabold">{upcoming.serviceType} at {upcoming.nextServiceOdometer?.toLocaleString()} miles</p>
          <p className="mt-1 text-xs text-[#A3A3A3]">
            {Math.max(0, (upcoming.nextServiceOdometer ?? 0) - (vehicle.currentOdometer ?? 0)).toLocaleString()} miles remaining
          </p>
        </div>
      )}
      {editing ? (
        <MaintenanceForm
          record={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(undefined)}
          onSave={(input) => {
            if (editing === "new") addMaintenance(input);
            else updateMaintenance(editing.id, input);
            setEditing(undefined);
          }}
        />
      ) : (
        <PrimaryButton className="mt-4" onClick={() => setEditing("new")}>Record maintenance</PrimaryButton>
      )}
      <div className="mt-4 space-y-3">
        {maintenanceRecords.map((record) => (
          <article key={record.id} className="rounded-xl bg-[#181818] p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{record.serviceType}</p>
                <p className="mt-1 text-xs text-[#777]">
                  {record.date} · {record.odometer.toLocaleString()} mi · {formatMoney(record.cost)}
                </p>
                {record.notes && <p className="mt-2 text-sm text-[#A3A3A3]">{record.notes}</p>}
              </div>
              <button type="button" className="icon-button" onClick={() => setEditing(record)} aria-label="Edit maintenance record"><Icon name="edit" /></button>
              <button type="button" className="icon-button text-[#ff6678]" onClick={() => setDeleting(record)} aria-label="Delete maintenance record"><Icon name="trash" /></button>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-[#777]">
        Maintenance costs are added once to recorded expenses. They do not change your cost-per-mile
        assumption unless you edit that setting.
      </p>
      <ConfirmationDialog
        open={Boolean(deleting)}
        title="Delete maintenance record?"
        description="This also removes the expense created for this service."
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) deleteMaintenance(deleting.id);
          setDeleting(undefined);
        }}
      />
    </section>
  );
}
