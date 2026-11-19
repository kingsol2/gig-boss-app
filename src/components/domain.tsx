import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { deliveryGross, formatDuration, formatMoney, summarizeEarnings } from "../lib/calculations";
import type {
  DatePreset,
  Delivery,
  DeliveryExpense,
  GigPlatform,
  MembershipTier,
} from "../types/models";
import { Icon } from "./Icon";
import { EmptyState, IntegrationNotice, PrimaryButton, SecondaryButton, SelectInput } from "./ui";

export function DeliveryCard({
  delivery,
  onOpen,
  onEdit,
  onDelete,
}: {
  delivery: Delivery;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-[#181818] p-4">
      <button className="w-full text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-extrabold">{delivery.platform}</p>
            <p className="mt-1 text-xs text-[#777]">
              {new Date(`${delivery.date}T12:00:00`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <p className="text-xl font-black text-[#48FF85]">
            {formatMoney(deliveryGross(delivery))}
          </p>
        </div>
        <div className="mt-4 flex gap-4 border-t border-white/7 pt-3 text-xs text-[#A3A3A3]">
          <span>{delivery.miles.toFixed(1)} mi</span>
          <span>{formatDuration(delivery.durationMinutes)}</span>
          <span>{formatMoney(delivery.tips)} tips</span>
        </div>
      </button>
      <div className="mt-3 flex gap-2">
        <button className="mini-button" onClick={onEdit}>
          <Icon name="edit" className="h-4 w-4" /> Edit
        </button>
        <button className="mini-button text-[#ff6678]" onClick={onDelete}>
          <Icon name="trash" className="h-4 w-4" /> Delete
        </button>
      </div>
    </article>
  );
}

export function ExpenseCard({
  expense,
  onEdit,
  onDelete,
  locked = false,
}: {
  expense: DeliveryExpense;
  onEdit: () => void;
  onDelete: () => void;
  locked?: boolean;
}) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#181818] p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EF233C]/10 text-[#EF233C]">
        <Icon name="wallet" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{expense.category}</p>
        <p className="mt-1 truncate text-xs text-[#777]">
          {expense.date}
          {expense.notes ? ` · ${expense.notes}` : ""}
        </p>
      </div>
      <p className="font-extrabold">−{formatMoney(expense.amount)}</p>
      {locked ? (
        <span className="max-w-20 text-right text-[10px] font-bold uppercase leading-4 text-[#777]">
          Vehicle record
        </span>
      ) : (
        <>
          <button className="icon-button" onClick={onEdit} aria-label="Edit expense">
            <Icon name="edit" className="h-4 w-4" />
          </button>
          <button
            className="icon-button text-[#ff6678]"
            onClick={onDelete}
            aria-label="Delete expense"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </>
      )}
    </article>
  );
}

export function DateRangeFilter({
  preset,
  onPreset,
  start,
  end,
  onStart,
  onEnd,
}: {
  preset: DatePreset;
  onPreset: (preset: DatePreset) => void;
  start?: string;
  end?: string;
  onStart?: (value: string) => void;
  onEnd?: (value: string) => void;
}) {
  const presets: { value: DatePreset; label: string }[] = [
    { value: "all", label: "All" },
    { value: "today", label: "Today" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "custom", label: "Custom" },
  ];
  return (
    <div>
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-[#181818] p-1">
        {presets.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`min-h-11 rounded-lg text-xs font-bold ${preset === option.value ? "bg-[#EF233C] text-white" : "text-[#777]"}`}
            onClick={() => onPreset(option.value)}
            aria-pressed={preset === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-[#A3A3A3]">
            From
            <input
              className="input mt-2"
              type="date"
              value={start}
              onChange={(event) => onStart?.(event.target.value)}
            />
          </label>
          <label className="text-xs font-bold text-[#A3A3A3]">
            To
            <input
              className="input mt-2"
              type="date"
              value={end}
              onChange={(event) => onEnd?.(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function PlatformFilter({
  value,
  platforms,
  onChange,
}: {
  value: GigPlatform | "all";
  platforms: GigPlatform[];
  onChange: (value: GigPlatform | "all") => void;
}) {
  return (
    <SelectInput
      label="Platform"
      value={value}
      onChange={(next) => onChange(next as GigPlatform | "all")}
      options={[
        { label: "All platforms", value: "all" },
        ...platforms.map((platform) => ({ label: platform, value: platform })),
      ]}
    />
  );
}

export function EarningsChart({ deliveries, days = 7 }: { deliveries: Delivery[]; days?: number }) {
  const points = useMemo(() => {
    const values: { label: string; value: number }[] = [];
    const today = new Date();
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      const key = date.toISOString().slice(0, 10);
      values.push({
        label: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
        value: deliveries
          .filter((item) => item.date === key)
          .reduce((sum, item) => sum + deliveryGross(item), 0),
      });
    }
    return values;
  }, [days, deliveries]);
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="rounded-2xl border border-white/8 bg-[#181818] p-4">
      <div
        className="flex h-36 items-end gap-2"
        role="img"
        aria-label={`${days}-day earnings chart`}
      >
        {points.map((point, index) => (
          <div key={`${point.label}-${index}`} className="flex h-full flex-1 flex-col justify-end">
            <div className="group relative flex h-[105px] items-end">
              <div
                className="w-full rounded-t-md bg-[#EF233C] transition-all"
                style={{
                  height: `${Math.max(point.value ? 8 : 2, (point.value / max) * 100)}%`,
                  opacity: point.value ? 1 : 0.18,
                }}
                title={`${point.label}: ${formatMoney(point.value)}`}
              />
            </div>
            <span className="mt-2 text-center text-[10px] font-bold text-[#777]">
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MembershipCard({
  tier,
  selected,
  onSelect,
}: {
  tier: MembershipTier;
  selected: boolean;
  onSelect: () => void;
}) {
  const vip = tier === "vip";
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-5 text-left ${selected ? "border-[#EF233C] bg-[#EF233C]/8" : "border-white/10 bg-[#181818]"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-black uppercase">{vip ? "VIP" : "Free"}</p>
          <p className="mt-1 text-sm text-[#A3A3A3]">{vip ? "$9 / month" : "$0 / month"}</p>
        </div>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-[#EF233C] bg-[#EF233C]" : "border-[#555]"}`}
        >
          {selected && <Icon name="check" className="h-4 w-4" />}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#A3A3A3]">
        {vip
          ? "VIP membership selection. Feature entitlements will be defined before billing is enabled."
          : "Core Gig Boss experience with local manual entry and earnings estimates."}
      </p>
    </button>
  );
}

export function ScreenshotUploader({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (file: File | null, error?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const select = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      onFile(null, "Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      onFile(null, "Image must be 10 MB or smaller.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(selected));
    onFile(selected);
  };

  const remove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(undefined);
    if (inputRef.current) inputRef.current.value = "";
    onFile(null);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={select}
      />
      {file && preview ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#181818]">
          <img
            src={preview}
            alt="Selected delivery screenshot"
            className="max-h-80 w-full object-contain"
          />
          <div className="flex items-center gap-3 p-3">
            <p className="min-w-0 flex-1 truncate text-xs text-[#A3A3A3]">{file.name}</p>
            <button className="mini-button text-[#ff6678]" onClick={remove}>
              <Icon name="trash" className="h-4 w-4" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-[#181818] px-6 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EF233C]/10 text-[#EF233C]">
            <Icon name="camera" />
          </span>
          <span className="mt-4 font-extrabold">Choose screenshot</span>
          <span className="mt-2 text-xs text-[#777]">JPG, PNG, or WebP · up to 10 MB</span>
        </button>
      )}
    </div>
  );
}

export function MapContainer({ children }: { children?: ReactNode }) {
  return (
    <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#141414] p-6">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(#333_1px,transparent_1px),linear-gradient(90deg,#333_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="relative text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EF233C]/12 text-[#EF233C]">
          <Icon name="map" />
        </span>
        <p className="mt-4 font-extrabold">Map provider required</p>
        <p className="mt-2 text-sm leading-6 text-[#A3A3A3]">
          No coordinates or delivery locations are being invented.
        </p>
        {children}
      </div>
    </div>
  );
}

export function PlatformBars({
  deliveries,
  expenses,
  costPerMile,
}: {
  deliveries: Delivery[];
  expenses: DeliveryExpense[];
  costPerMile: number;
}) {
  const groups = useMemo(() => {
    const platforms = [...new Set(deliveries.map((delivery) => delivery.platform))];
    return platforms
      .map((platform) => {
        const items = deliveries.filter((delivery) => delivery.platform === platform);
        return {
          platform,
          summary: summarizeEarnings(
            items,
            expenses.filter(
              (expense) =>
                expense.deliveryId && items.some((item) => item.id === expense.deliveryId),
            ),
            costPerMile,
          ),
        };
      })
      .sort((a, b) => b.summary.gross - a.summary.gross);
  }, [costPerMile, deliveries, expenses]);
  const max = Math.max(...groups.map((group) => group.summary.gross), 1);

  if (!groups.length)
    return (
      <EmptyState
        title="No platform data yet"
        description="Platform performance appears after you save deliveries."
      />
    );
  return (
    <div className="space-y-4 rounded-2xl border border-white/8 bg-[#181818] p-4">
      {groups.map((group) => (
        <div key={group.platform}>
          <div className="mb-2 flex justify-between text-xs">
            <span className="font-bold">{group.platform}</span>
            <span className="text-[#48FF85]">{formatMoney(group.summary.gross)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[#EF233C]"
              style={{ width: `${(group.summary.gross / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
