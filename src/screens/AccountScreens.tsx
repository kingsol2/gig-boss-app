import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MapContainer, MembershipCard } from "../components/domain";
import { MaintenancePanel } from "../components/featurePanels";
import { Icon } from "../components/Icon";
import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  IntegrationNotice,
  MultiSelectPlatforms,
  PageLayout,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  SettingsRow,
  TextInput,
} from "../components/ui";
import { appPath, ROUTES } from "../lib/routes";
import { INTEGRATION_MESSAGES } from "../services/interfaces";
import { BrowserLocationPermissionService } from "../services/geographicInfrastructure";
import { useAppState } from "../state/AppContext";
import { useRouter } from "../state/RouterContext";
import type { GigPlatform, MembershipTier } from "../types/models";
import {
  US_STATES,
  type AnalysisWindowDays,
  type USStateCode,
} from "../types/profitIntelligence";
import { platformCapabilities } from "../platform/mobileRuntime";

export function MapScreen() {
  const { deliveries, preferences, updatePreferences } = useAppState();
  const { navigate } = useRouter();
  const locationService = useMemo(() => new BrowserLocationPermissionService(), []);
  const [stateCode, setStateCode] = useState<USStateCode | "">("");
  const [market, setMarket] = useState("");
  const [windowDays, setWindowDays] = useState<AnalysisWindowDays>(30);
  const [locationMessage, setLocationMessage] = useState("");
  const located = deliveries.filter(
    (delivery) => delivery.location?.pickup || delivery.location?.dropoff,
  );
  return (
    <PageLayout title="Delivery map" subtitle="Recorded locations only" back>
      <MapContainer>
        <p className="mt-4 rounded-lg bg-black/30 px-3 py-2 text-xs text-[#A3A3A3]">
          Smart Profit Zones remain unavailable until verified observations and privacy-safe
          published snapshots exist.
        </p>
      </MapContainer>
      <div className="mt-4">
        <IntegrationNotice>
          {INTEGRATION_MESSAGES.map} Location permission is currently{" "}
          {preferences.locationEnabled ? "allowed in local preferences" : "off"}.
        </IntegrationNotice>
      </div>
      <section className="mt-5 rounded-2xl border border-white/8 bg-[#181818] p-4">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#EF233C]">
          Smart Profit Zones
        </p>
        <h2 className="mt-1 text-lg font-black">Manual market selection</h2>
        <p className="mt-2 text-sm leading-6 text-[#A3A3A3]">
          Select an area for future verified queries. Selection does not label historical deliveries.
        </p>
        <div className="mt-4 space-y-4">
          <SelectInput
            label="State"
            value={stateCode}
            onChange={(value) => setStateCode(value as USStateCode)}
            options={[
              { label: "Select a state", value: "" },
              ...US_STATES.map((state) => ({
                label: `${state.name} (${state.code})`,
                value: state.code,
              })),
            ]}
          />
          <TextInput
            label="City or market"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            placeholder="Enter your market"
            hint="Stored only in this screen until a licensed market catalog is connected."
          />
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">
              Analysis period
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([30, 60, 90] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`min-h-11 rounded-xl text-sm font-bold ${
                    windowDays === days ? "bg-[#EF233C] text-white" : "bg-black/25 text-[#777]"
                  }`}
                  aria-pressed={windowDays === days}
                  onClick={() => setWindowDays(days)}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>
          <SecondaryButton
            onClick={async () => {
              const result = await locationService.requestCurrentLocation({
                initiatedByUser: true,
                maximumAgeMs: 0,
              });
              if (result.status === "authorized") {
                updatePreferences({ locationEnabled: true });
                setLocationMessage(
                  "Location permission granted for this request. No geocoding provider is connected, coordinates were not retained, and no historical delivery was labeled.",
                );
              } else {
                updatePreferences({ locationEnabled: false });
                setLocationMessage(
                  result.reason === "permission-denied"
                    ? "Location permission was denied. Manual market selection remains available."
                    : "Current location is unavailable. Manual market selection remains available.",
                );
              }
            }}
          >
            Request current location
          </SecondaryButton>
          {locationMessage && <IntegrationNotice>{locationMessage}</IntegrationNotice>}
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-extrabold">{market.trim() || "No market selected"}</p>
              <p className="mt-1 text-xs text-[#777]">
                {stateCode || "No state selected"} · {windowDays}-day window
              </p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-[#A3A3A3]">
              Gray · unavailable
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#A3A3A3]">
            Net hourly, net per mile, confidence, and zone classifications are withheld because
            there is no verified privacy-safe dataset. Exact contributor counts are not exposed.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
          <span className="rounded-lg bg-[#48FF85]/10 px-3 py-2 text-[#48FF85]">
            Green · strong
          </span>
          <span className="rounded-lg bg-yellow-400/10 px-3 py-2 text-yellow-300">
            Yellow · conditional
          </span>
          <span className="rounded-lg bg-[#EF233C]/10 px-3 py-2 text-[#ff8896]">
            Red · below threshold
          </span>
          <span className="rounded-lg bg-white/5 px-3 py-2 text-[#A3A3A3]">
            Gray · unavailable
          </span>
        </div>
      </section>
      <h2 className="mb-3 mt-6 text-sm font-extrabold uppercase tracking-wider">
        Deliveries with locations
      </h2>
      {located.length ? (
        <div className="space-y-3">
          {located.map((delivery) => (
            <button
              key={delivery.id}
              className="flex w-full items-center gap-3 rounded-xl bg-[#181818] p-4 text-left"
              onClick={() => navigate(appPath(ROUTES.locationDetails, delivery.id))}
            >
              <Icon name="map" className="text-[#EF233C]" />
              <span className="flex-1">
                <strong className="block text-sm">{delivery.platform}</strong>
                <small className="text-[#777]">{delivery.date}</small>
              </span>
              <Icon name="chevron" className="h-4 w-4 text-[#555]" />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="map"
          title="No recorded locations"
          description="Manual delivery entry does not invent pickup or drop-off locations."
        />
      )}
    </PageLayout>
  );
}

export function LocationDetailsScreen({ deliveryId }: { deliveryId: string }) {
  const { deliveries } = useAppState();
  const delivery = deliveries.find((item) => item.id === deliveryId);
  if (!delivery)
    return (
      <PageLayout title="Location details" back>
        <ErrorState message="Delivery not found." />
      </PageLayout>
    );
  const pickup = delivery.location?.pickup;
  const dropoff = delivery.location?.dropoff;
  return (
    <PageLayout title="Location details" subtitle={`${delivery.platform} · ${delivery.date}`} back>
      <MapContainer />
      <div className="mt-4 rounded-2xl border border-white/8 bg-[#181818] p-4">
        <LocationRow label="Pickup" value={pickup} />
        <LocationRow label="Drop-off" value={dropoff} />
      </div>
      {pickup || dropoff ? (
        <a
          className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-[#181818] text-sm font-bold"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoff ?? pickup ?? "")}`}
          target="_blank"
          rel="noreferrer"
        >
          Open recorded address in maps
        </a>
      ) : (
        <div className="mt-4">
          <IntegrationNotice>
            No address was recorded for this delivery, so external navigation is unavailable.
          </IntegrationNotice>
        </div>
      )}
    </PageLayout>
  );
}

function LocationRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border-b border-white/7 py-3 last:border-0">
      <p className="text-xs font-bold uppercase tracking-wider text-[#777]">{label}</p>
      <p className="mt-1 text-sm font-bold">{value ?? "Not recorded"}</p>
    </div>
  );
}

export function MembershipScreen() {
  const { profile, setMembership } = useAppState();
  const [selected, setSelected] = useState<MembershipTier>(profile.membership.tier);
  const [message, setMessage] = useState("");
  const choose = () => {
    if (selected === "free") {
      setMembership("free");
      setMessage("Free membership selection saved locally.");
    } else {
      setMessage(INTEGRATION_MESSAGES.stripe);
    }
  };
  return (
    <PageLayout title="Membership" subtitle="Plan and billing" back>
      <div className="mb-5 rounded-2xl border border-white/8 bg-[#181818] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#777]">Current selection</p>
        <p className="mt-2 text-xl font-black uppercase">{profile.membership.tier}</p>
        <p className="mt-1 text-xs text-[#A3A3A3]">
          Billing status:{" "}
          {profile.membership.billingStatus === "local-selection"
            ? "No active billing"
            : profile.membership.billingStatus}
        </p>
      </div>
      <div className="space-y-3">
        <MembershipCard
          tier="free"
          selected={selected === "free"}
          onSelect={() => {
            setSelected("free");
            setMessage("");
          }}
        />
        <MembershipCard
          tier="vip"
          selected={selected === "vip"}
          onSelect={() => {
            setSelected("vip");
            setMessage("");
          }}
        />
      </div>
      {message && (
        <div className="mt-4">
          <IntegrationNotice>{message}</IntegrationNotice>
        </div>
      )}
      <PrimaryButton className="mt-5" onClick={choose}>
        {selected === "vip" ? "Upgrade with Stripe" : "Select Free"}
      </PrimaryButton>
      <SecondaryButton className="mt-3" onClick={() => setMessage(INTEGRATION_MESSAGES.stripe)}>
        Manage subscription
      </SecondaryButton>
    </PageLayout>
  );
}

export function ProfileScreen() {
  const { profile } = useAppState();
  const { navigate } = useRouter();
  return (
    <PageLayout title="Profile" subtitle="Local preview profile">
      <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-[#181818] p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EF233C] text-xl font-black">
          {profile.fullName ? profile.fullName.slice(0, 1).toUpperCase() : "G"}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold">{profile.fullName || "Local driver"}</h2>
          <p className="mt-1 truncate text-sm text-[#777]">{profile.email || "No email saved"}</p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-[#181818]">
        <SettingsRow
          icon="user"
          label="Account details"
          detail="Name, email, and local data"
          onClick={() => navigate(ROUTES.account)}
        />
        <SettingsRow
          icon="delivery"
          label="Gig platforms"
          detail={profile.platforms.join(", ") || "None selected"}
          onClick={() => navigate(ROUTES.editPlatforms)}
        />
        <SettingsRow
          icon="wallet"
          label="Membership"
          detail={`${profile.membership.tier.toUpperCase()} · ${profile.membership.tier === "vip" ? "$9/month selection" : "Free"}`}
          onClick={() => navigate(ROUTES.membership)}
        />
        <SettingsRow
          icon="settings"
          label="Settings"
          detail="Calculations, privacy, and security"
          onClick={() => navigate(ROUTES.settings)}
        />
        <SettingsRow
          icon="help"
          label="Help & support"
          detail="Guides and common questions"
          onClick={() => navigate(ROUTES.help)}
        />
      </div>
      <div className="mt-4">
        <IntegrationNotice>
          Financial records and this profile are stored only in this browser until Firebase and
          Firestore are connected.
        </IntegrationNotice>
      </div>
    </PageLayout>
  );
}

export function EditPlatformsScreen() {
  const { profile, setPlatforms } = useAppState();
  const { back } = useRouter();
  const [platforms, setLocal] = useState<GigPlatform[]>(profile.platforms);
  const [error, setError] = useState("");
  const save = () => {
    if (!platforms.length) return setError("Select at least one platform.");
    setPlatforms(platforms);
    back();
  };
  return (
    <PageLayout title="Edit gig platforms" subtitle="Used for entry and comparisons" back>
      <MultiSelectPlatforms value={platforms} onChange={setLocal} />
      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}
      <PrimaryButton className="mt-6" onClick={save}>
        Save changes
      </PrimaryButton>
    </PageLayout>
  );
}

export function SettingsScreen() {
  const { navigate } = useRouter();
  const { endPreview } = useAppState();
  const signOut = () => {
    endPreview();
    navigate(ROUTES.login, { replace: true });
  };
  return (
    <PageLayout title="Settings" subtitle="Preferences and account" back>
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#181818]">
        <SettingsRow
          icon="user"
          label="Account settings"
          onClick={() => navigate(ROUTES.account)}
        />
        <SettingsRow
          icon="chart"
          label="Calculation settings"
          detail="Mileage cost, vehicle, and maintenance"
          onClick={() => navigate(ROUTES.calculations)}
        />
        <SettingsRow
          icon="bell"
          label="Notifications"
          onClick={() => navigate(ROUTES.notifications)}
        />
        <SettingsRow
          icon="shield"
          label="Privacy & data"
          onClick={() => navigate(ROUTES.privacy)}
        />
        <SettingsRow icon="lock" label="Security" onClick={() => navigate(ROUTES.security)} />
        <SettingsRow icon="wallet" label="Membership" onClick={() => navigate(ROUTES.membership)} />
        <SettingsRow icon="help" label="Help" onClick={() => navigate(ROUTES.help)} />
        <SettingsRow icon="back" label="Sign out of preview" danger onClick={signOut} />
      </div>
    </PageLayout>
  );
}

export function CalculationSettingsScreen() {
  const { preferences, updatePreferences } = useAppState();
  const [cost, setCost] = useState(String(preferences.costPerMile));
  const [message, setMessage] = useState("");
  const save = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(cost);
    if (!Number.isFinite(value) || value < 0 || value > 10)
      return setMessage("Enter a cost per mile between $0 and $10.");
    updatePreferences({ costPerMile: value });
    setMessage("Saved locally. All estimated expenses and net figures were recalculated.");
  };
  return (
    <PageLayout title="Calculation settings" subtitle="Vehicle cost assumptions" back>
      <form onSubmit={save} className="space-y-4">
        <TextInput
          label="Estimated cost per mile"
          type="number"
          min="0"
          max="10"
          step="0.01"
          value={cost}
          onChange={(e) => {
            setCost(e.target.value);
            setMessage("");
          }}
        />
        <div className="rounded-2xl bg-[#181818] p-4 text-sm leading-6 text-[#A3A3A3]">
          <strong className="text-white">How it works</strong>
          <p className="mt-2">
            Recorded miles × your cost-per-mile assumption = estimated vehicle cost. This is
            separate from tolls, parking, and other manually recorded expenses.
          </p>
        </div>
        {message && <IntegrationNotice>{message}</IntegrationNotice>}
        <PrimaryButton type="submit">Save and recalculate</PrimaryButton>
      </form>
      <p className="mt-4 text-xs leading-5 text-[#777]">
        This estimate is configurable planning information, not a verified tax deduction.
      </p>
      <MaintenancePanel />
    </PageLayout>
  );
}

export function NotificationsScreen() {
  const { preferences, updatePreferences } = useAppState();
  const [message, setMessage] = useState("");
  const toggle = async () => {
    if (preferences.notificationsEnabled) {
      updatePreferences({ notificationsEnabled: false });
      setMessage("Notification preference turned off locally.");
      return;
    }
    const permission = await platformCapabilities.requestNotificationPermission();
    if (permission === "unsupported")
      return setMessage("This device does not support notifications.");
    if (permission === "granted") {
      updatePreferences({ notificationsEnabled: true });
      setMessage(
        "Browser permission granted. A notification service is still required to deliver notifications.",
      );
    } else {
      updatePreferences({ notificationsEnabled: false });
      setMessage("Notification permission was not granted.");
    }
  };
  return (
    <PageLayout title="Notifications" subtitle="Permission and preferences" back>
      <button
        className="flex w-full items-center gap-4 rounded-2xl border border-white/8 bg-[#181818] p-4 text-left"
        onClick={toggle}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF233C]/10 text-[#EF233C]">
          <Icon name="bell" />
        </span>
        <span className="flex-1">
          <strong className="block">Earnings reminders</strong>
          <small className="mt-1 block text-[#777]">Browser permission and local preference</small>
        </span>
        <span
          className={`h-7 w-12 rounded-full p-1 ${preferences.notificationsEnabled ? "bg-[#EF233C]" : "bg-[#333]"}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition ${preferences.notificationsEnabled ? "translate-x-5" : ""}`}
          />
        </span>
      </button>
      {message && (
        <div className="mt-4">
          <IntegrationNotice>{message}</IntegrationNotice>
        </div>
      )}
      <div className="mt-4">
        <IntegrationNotice>
          No notification delivery service is connected, so there is no notification history and no
          reminders will be sent.
        </IntegrationNotice>
      </div>
    </PageLayout>
  );
}

export function PrivacyScreen() {
  const { preferences, setConsent, updatePreferences } = useAppState();
  const { navigate } = useRouter();
  return (
    <PageLayout title="Privacy & data" subtitle="Local privacy controls" back>
      <div className="space-y-3">
        <PreferenceToggle
          title="Screenshot processing consent"
          description={
            preferences.screenshotConsent.allowed
              ? "Allowed when a processor is connected"
              : "Manual entry only"
          }
          value={preferences.screenshotConsent.allowed}
          onToggle={() => setConsent(!preferences.screenshotConsent.allowed)}
        />
        <PreferenceToggle
          title="Location permission preference"
          description="No background tracking. A map provider is not connected."
          value={preferences.locationEnabled}
          onToggle={() => updatePreferences({ locationEnabled: !preferences.locationEnabled })}
        />
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/8 bg-[#181818]">
        <SettingsRow
          icon="user"
          label="Data management"
          detail="Review or remove local preview data"
          onClick={() => navigate(ROUTES.account)}
        />
        <SettingsRow
          icon="shield"
          label="Privacy policy"
          detail="Local preview privacy summary"
          onClick={() =>
            document.getElementById("privacy-summary")?.scrollIntoView({ behavior: "smooth" })
          }
        />
      </div>
      <div
        id="privacy-summary"
        className="mt-5 rounded-2xl bg-[#181818] p-4 text-sm leading-6 text-[#A3A3A3]"
      >
        <strong className="text-white">Preview privacy summary</strong>
        <p className="mt-2">
          Delivery and profile records remain in this browser’s local storage. No Firebase,
          analytics, screenshot processor, map provider, or payment service is connected by this
          build.
        </p>
      </div>
    </PageLayout>
  );
}

function PreferenceToggle({
  title,
  description,
  value,
  onToggle,
}: {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-[#181818] p-4 text-left"
      onClick={onToggle}
    >
      <span className="flex-1">
        <strong className="block text-sm">{title}</strong>
        <small className="mt-1 block text-xs leading-5 text-[#777]">{description}</small>
      </span>
      <span className={`h-7 w-12 rounded-full p-1 ${value ? "bg-[#EF233C]" : "bg-[#333]"}`}>
        <span
          className={`block h-5 w-5 rounded-full bg-white transition ${value ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}

export function SecurityScreen() {
  const { endPreview } = useAppState();
  const { navigate } = useRouter();
  const [message, setMessage] = useState("");
  return (
    <PageLayout title="Security" subtitle="Account access" back>
      <IntegrationNotice>
        Frontend preview routes are not backend-secured. Production security requires Firebase
        Authentication and Firestore security rules.
      </IntegrationNotice>
      {message && (
        <div className="mt-4">
          <ErrorState message={message} />
        </div>
      )}
      <div className="mt-5 space-y-3">
        <PrimaryButton onClick={() => setMessage(INTEGRATION_MESSAGES.firebase)}>
          Send password reset
        </PrimaryButton>
        <SecondaryButton
          onClick={() => {
            endPreview();
            navigate(ROUTES.login, { replace: true });
          }}
        >
          Sign out of local preview
        </SecondaryButton>
      </div>
    </PageLayout>
  );
}

const faqs = [
  [
    "How do I add a delivery?",
    "Open Upload and choose manual entry. Enter a completed delivery’s payout, tips, miles, and active duration, then save it locally.",
  ],
  [
    "How are earnings calculated?",
    "Gross includes base payout, tips when not already included, and other compensation. Estimated net subtracts mileage-based costs and recorded additional expenses.",
  ],
  [
    "How do I manage platforms?",
    "Open Profile, choose Gig platforms, select one or more services, and save.",
  ],
  [
    "Is my data synced?",
    "No. This build stores preview records only in this browser. Firebase and Firestore are not connected.",
  ],
];

export function HelpScreen() {
  const [open, setOpen] = useState<number>();
  return (
    <PageLayout title="Help & support" subtitle="Guides and common questions" back>
      <div className="space-y-3">
        {faqs.map(([question, answer], index) => (
          <button
            key={question}
            className="w-full rounded-2xl border border-white/8 bg-[#181818] p-4 text-left"
            onClick={() => setOpen(open === index ? undefined : index)}
          >
            <span className="flex items-center justify-between gap-3">
              <strong className="text-sm">{question}</strong>
              <Icon
                name="chevron"
                className={`h-4 w-4 shrink-0 text-[#777] transition ${open === index ? "rotate-90" : ""}`}
              />
            </span>
            {open === index && (
              <span className="mt-3 block text-sm leading-6 text-[#A3A3A3]">{answer}</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-5">
        <IntegrationNotice>
          Contact support is unavailable because no validated support destination was provided.
        </IntegrationNotice>
      </div>
    </PageLayout>
  );
}

export function AccountManagementScreen() {
  const { profile, updateProfile, endPreview, resetLocalData } = useAppState();
  const { navigate } = useRouter();
  const [name, setName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [message, setMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return setMessage("Enter a valid full name.");
    if (email && !email.includes("@")) return setMessage("Enter a valid email.");
    updateProfile({ fullName: name.trim(), email: email.trim() });
    setMessage("Profile changes saved locally.");
  };
  const signOut = () => {
    endPreview();
    navigate(ROUTES.login, { replace: true });
  };
  return (
    <PageLayout title="Account management" subtitle="Profile and local data" back>
      <form className="space-y-4" onSubmit={save}>
        <TextInput
          label="Full name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMessage("");
          }}
        />
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setMessage("");
          }}
        />
        {message && <IntegrationNotice>{message}</IntegrationNotice>}
        <PrimaryButton type="submit">Update local profile</PrimaryButton>
      </form>
      <div className="mt-7 space-y-3 border-t border-white/10 pt-6">
        <SecondaryButton onClick={signOut}>Sign out of local preview</SecondaryButton>
        <SecondaryButton className="text-[#ff6678]" onClick={() => setConfirmClear(true)}>
          Delete local preview data
        </SecondaryButton>
        <button
          className="w-full py-3 text-sm font-bold text-[#ff6678]"
          onClick={() =>
            setMessage(`Account deletion requires Firebase. ${INTEGRATION_MESSAGES.firebase}`)
          }
        >
          Request account deletion
        </button>
      </div>
      <ConfirmationDialog
        open={confirmClear}
        title="Delete all local data?"
        description="This removes your local profile, deliveries, expenses, and preferences from this browser. It does not delete a cloud account because none exists."
        confirmLabel="Delete local data"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          resetLocalData();
          navigate(ROUTES.login, { replace: true });
        }}
      />
    </PageLayout>
  );
}
