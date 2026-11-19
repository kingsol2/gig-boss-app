import { useMemo, useState, type FormEvent } from "react";
import {
  DateRangeFilter,
  DeliveryCard,
  EarningsChart,
  PlatformBars,
  PlatformFilter,
  ScreenshotUploader,
} from "../components/domain";
import { Icon } from "../components/Icon";
import { CoachPanel, DailyGoalPanel, OfferAnalyzerPanel } from "../components/featurePanels";
import {
  ConfirmationDialog,
  EarningsCard,
  EmptyState,
  ErrorState,
  IntegrationNotice,
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
  formatDuration,
  formatMoney,
  summarizeEarnings,
} from "../lib/calculations";
import { appPath, ROUTES } from "../lib/routes";
import { INTEGRATION_MESSAGES } from "../services/interfaces";
import { useAppState } from "../state/AppContext";
import { useRouter } from "../state/RouterContext";
import {
  GIG_PLATFORMS,
  type DatePreset,
  type Delivery,
  type DeliveryInput,
  type GigPlatform,
} from "../types/models";

const today = () => new Date().toISOString().slice(0, 10);

export function DashboardScreen() {
  const { deliveries, expenses, preferences, profile, deleteDelivery } = useAppState();
  const { navigate } = useRouter();
  const [deleting, setDeleting] = useState<Delivery>();
  const todaysDeliveries = useMemo(
    () => deliveries.filter((item) => item.date === today()),
    [deliveries],
  );
  const todaysExpenses = useMemo(
    () => expenses.filter((item) => item.date === today()),
    [expenses],
  );
  const summary = useMemo(
    () => summarizeEarnings(todaysDeliveries, todaysExpenses, preferences.costPerMile),
    [preferences.costPerMile, todaysDeliveries, todaysExpenses],
  );

  return (
    <PageLayout
      title={profile.fullName ? `Hi, ${profile.fullName.split(" ")[0]}` : "Dashboard"}
      subtitle="Local earnings workspace"
    >
      <EarningsCard
        label="Today's estimated net"
        value={summary.estimatedNet}
        note="Gross minus mileage estimate and recorded expenses"
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricCard
          label="Gross earnings"
          value={formatMoney(summary.gross)}
          icon="wallet"
          positive
        />
        <MetricCard
          label="Est. expenses"
          value={formatMoney(summary.estimatedExpenses)}
          icon="chart"
        />
        <MetricCard label="Miles" value={summary.miles.toFixed(1)} icon="miles" />
        <MetricCard label="Gross / hour" value={formatMoney(summary.grossPerHour)} icon="clock" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <PrimaryButton onClick={() => navigate(ROUTES.addDelivery)}>
          <span className="flex items-center justify-center gap-2">
            <Icon name="plus" /> Add delivery
          </span>
        </PrimaryButton>
        <SecondaryButton onClick={() => navigate(ROUTES.upload)}>
          <span className="flex items-center justify-center gap-2">
            <Icon name="camera" /> Screenshot
          </span>
        </SecondaryButton>
      </div>
      <div className="mt-5">
        <DailyGoalPanel />
      </div>
      <SectionHeader title="Last 7 days" />
      <EarningsChart deliveries={deliveries} />
      <SectionHeader title="Platform earnings" />
      <PlatformBars
        deliveries={todaysDeliveries}
        expenses={todaysExpenses}
        costPerMile={preferences.costPerMile}
      />
      <SectionHeader
        title="Recent deliveries"
        action={
          <button
            className="text-xs font-bold text-[#EF233C]"
            onClick={() => navigate(ROUTES.deliveries)}
          >
            View all
          </button>
        }
      />
      {deliveries.length ? (
        <div className="space-y-3">
          {deliveries.slice(0, 3).map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onOpen={() => navigate(appPath(ROUTES.deliveryDetails, delivery.id))}
              onEdit={() => navigate(`${appPath(ROUTES.deliveryDetails, delivery.id)}?edit=1`)}
              onDelete={() => setDeleting(delivery)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No deliveries yet"
          description="Add your first completed delivery. Projected offers never count toward earnings."
          action={
            <PrimaryButton onClick={() => navigate(ROUTES.addDelivery)}>Add delivery</PrimaryButton>
          }
        />
      )}
      <button
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#A3A3A3]"
        onClick={() => navigate(ROUTES.map)}
      >
        <Icon name="map" className="h-4 w-4" /> Open delivery map
      </button>
      <div className="mt-5">
        <CoachPanel />
      </div>
      <ConfirmationDialog
        open={!!deleting}
        title="Delete delivery?"
        description="This also removes any attached expense and updates every report."
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) deleteDelivery(deleting.id);
          setDeleting(undefined);
        }}
      />
    </PageLayout>
  );
}

export function UploadScreen() {
  const { preferences } = useAppState();
  const { navigate } = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"screenshot" | "offer">("screenshot");

  const submit = () => {
    if (!file) return setError("Choose a screenshot first.");
    if (!preferences.screenshotConsent.allowed)
      return setError(
        "Screenshot processing consent is required. Update it in Privacy & Data, or use manual entry.",
      );
    setError("");
    setStatus(INTEGRATION_MESSAGES.screenshot);
  };

  return (
    <PageLayout title="Upload" subtitle="Delivery screenshot or manual entry">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-[#181818] p-1">
        <button
          type="button"
          className={`min-h-11 rounded-lg text-xs font-bold ${
            mode === "screenshot" ? "bg-[#EF233C] text-white" : "text-[#777]"
          }`}
          onClick={() => setMode("screenshot")}
          aria-pressed={mode === "screenshot"}
        >
          Completed delivery
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-lg text-xs font-bold ${
            mode === "offer" ? "bg-[#EF233C] text-white" : "text-[#777]"
          }`}
          onClick={() => setMode("offer")}
          aria-pressed={mode === "offer"}
        >
          Analyze offer
        </button>
      </div>
      {mode === "offer" ? (
        <OfferAnalyzerPanel />
      ) : (
        <>
          <ScreenshotUploader
            file={file}
            onFile={(next, nextError) => {
              setFile(next);
              setError(nextError ?? "");
              setStatus("");
            }}
          />
          {error && (
            <div className="mt-4">
              <ErrorState message={error} />
            </div>
          )}
          {status && (
            <div className="mt-4">
              <IntegrationNotice>{status}</IntegrationNotice>
            </div>
          )}
          <PrimaryButton className="mt-5" onClick={submit} disabled={!file}>
            Submit for processing
          </PrimaryButton>
          <p className="mt-3 text-center text-xs text-[#777]">
            No image leaves this device unless a processing service is connected and you consent.
          </p>
          <div className="my-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#555]">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <SecondaryButton onClick={() => navigate(ROUTES.addDelivery)}>
            Enter delivery manually
          </SecondaryButton>
          <button
            className="mt-3 w-full py-3 text-sm font-bold text-[#A3A3A3]"
            onClick={() => navigate(ROUTES.screenshotReview)}
          >
            View processing status
          </button>
        </>
      )}
    </PageLayout>
  );
}

export function ScreenshotReviewScreen() {
  const { navigate } = useRouter();
  return (
    <PageLayout title="Screenshot review" subtitle="Verify extracted delivery" back>
      <IntegrationNotice>{INTEGRATION_MESSAGES.screenshot}</IntegrationNotice>
      <EmptyState
        icon="camera"
        title="No extracted delivery"
        description="When a processing service is connected, extracted fields will appear here for correction before saving. Nothing has been invented."
        action={
          <PrimaryButton onClick={() => navigate(ROUTES.addDelivery)}>
            Use manual entry
          </PrimaryButton>
        }
      />
    </PageLayout>
  );
}

interface DeliveryFormState {
  platform: GigPlatform;
  date: string;
  payout: string;
  tips: string;
  otherPay: string;
  payoutIncludesTips: boolean;
  miles: string;
  duration: string;
  startTime: string;
  expense: string;
  notes: string;
}

function DeliveryForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Delivery;
  submitLabel: string;
  onSubmit: (input: DeliveryInput, expense: number) => void;
}) {
  const { profile } = useAppState();
  const platforms = profile.platforms.length ? profile.platforms : [...GIG_PLATFORMS];
  const [form, setForm] = useState<DeliveryFormState>({
    platform: initial?.platform ?? platforms[0],
    date: initial?.date ?? today(),
    payout: initial ? String(initial.basePay) : "",
    tips: initial ? String(initial.tips) : "",
    otherPay: initial ? String(initial.otherPay) : "",
    payoutIncludesTips: initial?.payoutIncludesTips ?? false,
    miles: initial ? String(initial.miles) : "",
    duration: initial ? String(initial.durationMinutes) : "",
    startTime: initial?.startTime ?? "",
    expense: "",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState("");
  const number = (value: string) => Number(value) || 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.platform) return setError("Select a platform.");
    if (!form.date) return setError("Choose the delivery date.");
    if (
      number(form.payout) < 0 ||
      number(form.tips) < 0 ||
      number(form.miles) < 0 ||
      number(form.duration) < 0
    )
      return setError("Amounts, miles, and duration cannot be negative.");
    if (
      number(form.payout) +
        (form.payoutIncludesTips ? 0 : number(form.tips)) +
        number(form.otherPay) <=
      0
    )
      return setError("Enter a payout greater than zero.");
    if (!number(form.duration)) return setError("Enter delivery duration in minutes.");
    onSubmit(
      {
        platform: form.platform,
        date: form.date,
        basePay: number(form.payout),
        tips: number(form.tips),
        otherPay: number(form.otherPay),
        payoutIncludesTips: form.payoutIncludesTips,
        miles: number(form.miles),
        durationMinutes: number(form.duration),
        startTime: form.startTime || undefined,
        notes: form.notes.trim() || undefined,
      },
      number(form.expense),
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <SelectInput
        label="Platform"
        value={form.platform}
        onChange={(value) => setForm({ ...form, platform: value as GigPlatform })}
        options={platforms.map((platform) => ({ label: platform, value: platform }))}
      />
      <TextInput
        label="Delivery date"
        type="date"
        value={form.date}
        onChange={(e) => setForm({ ...form, date: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Payout"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.payout}
          onChange={(e) => setForm({ ...form, payout: e.target.value })}
        />
        <TextInput
          label="Tips"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.tips}
          onChange={(e) => setForm({ ...form, tips: e.target.value })}
        />
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-[#181818] p-4 text-sm leading-5 text-[#A3A3A3]">
        <input
          type="checkbox"
          className="mt-1 accent-[#EF233C]"
          checked={form.payoutIncludesTips}
          onChange={(e) => setForm({ ...form, payoutIncludesTips: e.target.checked })}
        />
        <span>
          <strong className="block text-white">Payout already includes tips</strong>Prevents tips
          from being counted twice.
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Other pay"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.otherPay}
          onChange={(e) => setForm({ ...form, otherPay: e.target.value })}
        />
        <TextInput
          label="Miles"
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={form.miles}
          onChange={(e) => setForm({ ...form, miles: e.target.value })}
        />
      </div>
      <TextInput
        label="Duration (minutes)"
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={form.duration}
        onChange={(e) => setForm({ ...form, duration: e.target.value })}
        hint="Use total active time for this delivery."
      />
      <TextInput
        label="Start time (optional)"
        type="time"
        value={form.startTime}
        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
        hint="Enables historical time-of-day comparisons."
      />
      {!initial && (
        <TextInput
          label="Optional additional expense"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.expense}
          onChange={(e) => setForm({ ...form, expense: e.target.value })}
          hint="Tolls, parking, or another cost not included in mileage."
        />
      )}
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">
          Notes (optional)
        </span>
        <textarea
          className="input min-h-24 resize-y"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
      {error && <ErrorState message={error} />}
      <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
    </form>
  );
}

export function ManualDeliveryScreen() {
  const { addDelivery, addExpense } = useAppState();
  const { navigate } = useRouter();
  return (
    <PageLayout title="Add delivery" subtitle="Completed deliveries only" back>
      <DeliveryForm
        submitLabel="Save delivery locally"
        onSubmit={(input, expense) => {
          const delivery = addDelivery(input);
          if (expense > 0)
            addExpense({
              deliveryId: delivery.id,
              category: "Delivery expense",
              amount: expense,
              date: input.date,
            });
          navigate(appPath(ROUTES.deliveryDetails, delivery.id));
        }}
      />
      <p className="mt-4 text-center text-xs leading-5 text-[#777]">
        Saved only on this device. Estimated profit is not verified take-home pay or tax advice.
      </p>
    </PageLayout>
  );
}

export function DeliveryHistoryScreen() {
  const { deliveries, profile, deleteDelivery } = useAppState();
  const { navigate } = useRouter();
  const [preset, setPreset] = useState<DatePreset>("all");
  const [platform, setPlatform] = useState<GigPlatform | "all">("all");
  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [deleting, setDeleting] = useState<Delivery>();
  const filtered = useMemo(
    () => filterDeliveries(deliveries, { preset, start, end, platform, search }),
    [deliveries, end, platform, preset, search, start],
  );

  return (
    <PageLayout title="Delivery history" subtitle={`${filtered.length} recorded`} back>
      <div className="space-y-3">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-3.5 h-5 w-5 text-[#555]" />
          <input
            className="input pl-11"
            placeholder="Search platform or notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <DateRangeFilter
          preset={preset}
          onPreset={setPreset}
          start={start}
          end={end}
          onStart={setStart}
          onEnd={setEnd}
        />
        <PlatformFilter
          value={platform}
          platforms={profile.platforms.length ? profile.platforms : [...GIG_PLATFORMS]}
          onChange={setPlatform}
        />
      </div>
      <div className="mt-5 space-y-3">
        {filtered.map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            delivery={delivery}
            onOpen={() => navigate(appPath(ROUTES.deliveryDetails, delivery.id))}
            onEdit={() => navigate(`${appPath(ROUTES.deliveryDetails, delivery.id)}?edit=1`)}
            onDelete={() => setDeleting(delivery)}
          />
        ))}
        {!filtered.length && (
          <EmptyState
            title="No matching deliveries"
            description={
              deliveries.length
                ? "Adjust your search or filters."
                : "Saved completed deliveries appear here."
            }
            action={
              <PrimaryButton onClick={() => navigate(ROUTES.addDelivery)}>
                Add delivery
              </PrimaryButton>
            }
          />
        )}
      </div>
      <ConfirmationDialog
        open={!!deleting}
        title="Delete delivery?"
        description="This also removes any expenses attached to this delivery. This cannot be undone."
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) deleteDelivery(deleting.id);
          setDeleting(undefined);
        }}
      />
    </PageLayout>
  );
}

export function DeliveryDetailsScreen({ deliveryId }: { deliveryId: string }) {
  const { deliveries, expenses, preferences, updateDelivery, deleteDelivery } = useAppState();
  const { navigate } = useRouter();
  const delivery = deliveries.find((item) => item.id === deliveryId);
  const [editing, setEditing] = useState(window.location.search.includes("edit=1"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!delivery)
    return (
      <PageLayout title="Delivery not found" back>
        <ErrorState message="This delivery does not exist or was removed." />
        <PrimaryButton className="mt-5" onClick={() => navigate(ROUTES.deliveries)}>
          Back to history
        </PrimaryButton>
      </PageLayout>
    );

  if (editing) {
    return (
      <PageLayout title="Edit delivery" subtitle={delivery.platform} back>
        <DeliveryForm
          initial={delivery}
          submitLabel="Save changes"
          onSubmit={(input) => {
            updateDelivery(delivery.id, input);
            setEditing(false);
          }}
        />
      </PageLayout>
    );
  }
  const attachedExpenses = expenses.filter((expense) => expense.deliveryId === delivery.id);
  const summary = summarizeEarnings([delivery], attachedExpenses, preferences.costPerMile);

  return (
    <PageLayout
      title="Delivery details"
      subtitle={delivery.platform}
      back
      action={
        <button className="icon-button" onClick={() => setEditing(true)} aria-label="Edit delivery">
          <Icon name="edit" />
        </button>
      }
    >
      <EarningsCard
        label="Estimated net earnings"
        value={summary.estimatedNet}
        note={`${delivery.date} · ${delivery.platform}`}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricCard label="Gross payout" value={formatMoney(summary.gross)} positive />
        <MetricCard label="Est. costs" value={formatMoney(summary.estimatedExpenses)} />
        <MetricCard label="Miles" value={summary.miles.toFixed(1)} />
        <MetricCard label="Duration" value={formatDuration(summary.durationMinutes)} />
        <MetricCard label="Start time" value={delivery.startTime || "Not recorded"} />
        <MetricCard label="Gross / mile" value={formatMoney(summary.grossPerMile)} />
        <MetricCard label="Gross / hour" value={formatMoney(summary.grossPerHour)} />
      </div>
      <div className="mt-4 rounded-2xl border border-white/8 bg-[#181818] p-4 text-sm">
        <div className="flex justify-between py-2 text-[#A3A3A3]">
          <span>Recorded tips</span>
          <span className="text-white">{formatMoney(delivery.tips)}</span>
        </div>
        <div className="flex justify-between py-2 text-[#A3A3A3]">
          <span>Mileage cost estimate</span>
          <span className="text-white">{formatMoney(summary.mileageCost)}</span>
        </div>
        <div className="flex justify-between py-2 text-[#A3A3A3]">
          <span>Additional expenses</span>
          <span className="text-white">{formatMoney(summary.additionalExpenses)}</span>
        </div>
      </div>
      {delivery.notes && (
        <div className="mt-4 rounded-xl bg-[#181818] p-4">
          <p className="text-xs font-bold uppercase text-[#777]">Notes</p>
          <p className="mt-2 text-sm leading-6">{delivery.notes}</p>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={() => navigate(appPath(ROUTES.locationDetails, delivery.id))}>
          <span className="flex items-center justify-center gap-2">
            <Icon name="map" /> Location
          </span>
        </SecondaryButton>
        <SecondaryButton className="text-[#ff6678]" onClick={() => setConfirmDelete(true)}>
          <span className="flex items-center justify-center gap-2">
            <Icon name="trash" /> Delete
          </span>
        </SecondaryButton>
      </div>
      <ConfirmationDialog
        open={confirmDelete}
        title="Delete delivery?"
        description="This permanently removes the local delivery and attached expenses."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteDelivery(delivery.id);
          navigate(ROUTES.deliveries);
        }}
      />
    </PageLayout>
  );
}
