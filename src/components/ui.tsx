import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatMoney } from "../lib/calculations";
import { ROUTES } from "../lib/routes";
import { useRouter } from "../state/RouterContext";
import { GIG_PLATFORMS, type GigPlatform } from "../types/models";
import { Icon, type IconName } from "./Icon";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2" aria-label="Gig Boss">
      <span className={`font-black tracking-[-0.06em] ${compact ? "text-xl" : "text-4xl"}`}>
        GIG
      </span>
      <span
        className={`bg-[#EF233C] px-2 py-0.5 font-black tracking-[-0.05em] text-white -skew-x-6 ${compact ? "text-lg" : "text-3xl"}`}
      >
        BOSS
      </span>
    </div>
  );
}

export function AppHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}) {
  const { back: goBack } = useRouter();
  return (
    <header className="app-header sticky top-0 z-30 border-b border-white/8 bg-[#080808]/95 pb-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))] backdrop-blur sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
      <div className="app-header-content mx-auto flex min-h-10 items-center gap-3">
        {back ? (
          <button
            type="button"
            className="icon-button -ml-2"
            onClick={goBack}
            aria-label="Go back"
          >
            <Icon name="back" />
          </button>
        ) : (
          <Brand compact />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-[#A3A3A3]">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

const tabs = [
  { label: "Home", icon: "home" as const, route: ROUTES.dashboard },
  { label: "Upload", icon: "upload" as const, route: ROUTES.upload },
  { label: "Reports", icon: "chart" as const, route: ROUTES.reports },
  { label: "Profile", icon: "user" as const, route: ROUTES.profile },
];

export function BottomNavigation() {
  const { path, navigate } = useRouter();
  const activeRoute =
    path.startsWith("/app/reports") || path === ROUTES.expenses
      ? ROUTES.reports
      : path.startsWith("/app/profile") ||
          path.startsWith("/app/settings") ||
          [ROUTES.membership, ROUTES.help, ROUTES.account].includes(path as never)
        ? ROUTES.profile
        : path === ROUTES.upload || path === ROUTES.screenshotReview || path === ROUTES.addDelivery
          ? ROUTES.upload
          : ROUTES.dashboard;

  return (
    <nav
      className="bottom-navigation fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[768px] border-t border-white/10 bg-[#111]/98 px-[max(8px,env(safe-area-inset-left))] pb-[max(8px,env(safe-area-inset-bottom))] pt-2 pr-[max(8px,env(safe-area-inset-right))]"
      aria-label="Primary navigation"
    >
      {tabs.map((tab) => {
        const active = activeRoute === tab.route;
        return (
          <button
            type="button"
            key={tab.route}
            onClick={() => navigate(tab.route)}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
              active ? "bg-[#EF233C]/12 text-[#EF233C]" : "text-[#777]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} className="h-5 w-5" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function PageLayout({
  title,
  subtitle,
  back,
  children,
  bottomNav = true,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: ReactNode;
  bottomNav?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="app-viewport bg-[#080808] text-white">
      <AppHeader title={title} subtitle={subtitle} back={back} action={action} />
      <main
        id="main-content"
        className={`page-content mx-auto py-5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] ${bottomNav ? "page-content-with-nav" : "pb-[max(2rem,env(safe-area-inset-bottom))]"}`}
      >
        {children}
      </main>
      {bottomNav && <BottomNavigation />}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean };

export function PrimaryButton({ className = "", full = true, ...props }: ButtonProps) {
  return (
    <button
      className={`min-h-12 rounded-xl bg-[#EF233C] px-5 py-3 text-sm font-extrabold text-white transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${full ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

export function SecondaryButton({ className = "", full = true, ...props }: ButtonProps) {
  return (
    <button
      className={`min-h-12 rounded-xl border border-white/15 bg-[#181818] px-5 py-3 text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-40 ${full ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextInput({ label, error, hint, id, className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">
        {label}
      </span>
      <input
        id={inputId}
        className={`input ${error ? "ring-2 ring-[#EF233C]" : ""} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...props}
      />
      {error && (
        <span id={messageId} className="mt-1.5 block text-xs text-[#ff6678]">
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={messageId} className="mt-1.5 block text-xs text-[#777]">
          {hint}
        </span>
      )}
    </label>
  );
}

export function PasswordInput(props: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput {...props} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        className="absolute right-2 top-7 flex h-11 w-11 items-center justify-center text-black"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        <Icon name={visible ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

export function SelectInput({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#A3A3A3]">
        {label}
      </span>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MultiSelectPlatforms({
  value,
  onChange,
}: {
  value: GigPlatform[];
  onChange: (value: GigPlatform[]) => void;
}) {
  const toggle = (platform: GigPlatform) =>
    onChange(
      value.includes(platform) ? value.filter((item) => item !== platform) : [...value, platform],
    );

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Gig platforms">
      {GIG_PLATFORMS.map((platform) => {
        const selected = value.includes(platform);
        return (
          <button
            type="button"
            key={platform}
            onClick={() => toggle(platform)}
            aria-pressed={selected}
            className={`flex min-h-14 items-center justify-between rounded-xl border px-3 text-left text-sm font-bold ${
              selected
                ? "border-[#EF233C] bg-[#EF233C]/12 text-white"
                : "border-white/10 bg-[#181818] text-[#A3A3A3]"
            }`}
          >
            {platform}
            {selected && <Icon name="check" className="h-4 w-4 text-[#EF233C]" />}
          </button>
        );
      })}
    </div>
  );
}

export function EarningsCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#48FF85]/20 bg-gradient-to-br from-[#17231b] to-[#111] p-5">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#A3A3A3]">{label}</p>
      <p className="mt-2 text-4xl font-black tracking-tight text-[#48FF85]">{formatMoney(value)}</p>
      {note && <p className="mt-2 text-xs text-[#777]">{note}</p>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon,
  positive,
}: {
  label: string;
  value: string;
  icon?: IconName;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#181818] p-4">
      <div className="flex items-center gap-2 text-[#777]">
        {icon && <Icon name={icon} className="h-4 w-4" />}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-2 text-xl font-extrabold ${positive ? "text-[#48FF85]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon = "delivery",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-[#111] px-6 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-[#777]">
        <Icon name={icon} />
      </span>
      <h3 className="mt-4 font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#A3A3A3]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="py-12 text-center text-sm text-[#A3A3A3]">
      {label}…
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#EF233C]/40 bg-[#EF233C]/10 p-4 text-sm text-[#ff9aa6]"
    >
      {message}
    </div>
  );
}

export function IntegrationNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-[#181818] p-4 text-sm leading-5 text-[#A3A3A3]">
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-[#EF233C]" />
      <div>{children}</div>
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center"
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#181818] p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId} className="text-lg font-extrabold">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-[#A3A3A3]">
          {description}
        </p>
        <div className="mt-6 flex gap-3">
          <SecondaryButton autoFocus onClick={onCancel}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export function SettingsRow({
  icon,
  label,
  detail,
  onClick,
  danger,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className="flex min-h-16 w-full items-center gap-3 border-b border-white/7 px-4 text-left last:border-0"
      onClick={onClick}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${danger ? "bg-[#EF233C]/12 text-[#EF233C]" : "bg-white/5 text-[#A3A3A3]"}`}
      >
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${danger ? "text-[#ff6678]" : ""}`}>{label}</span>
        {detail && <span className="mt-0.5 block truncate text-xs text-[#777]">{detail}</span>}
      </span>
      <Icon name="chevron" className="h-4 w-4 text-[#555]" />
    </button>
  );
}
