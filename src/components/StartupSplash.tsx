import { Brand, PrimaryButton, SecondaryButton } from "./ui";

export function StartupSplash({
  error,
  onRetry,
  onContinue,
}: {
  error?: string;
  onRetry?: () => void;
  onContinue?: () => void;
}) {
  return (
    <main
      id="main-content"
      className="startup-splash app-viewport relative flex flex-col items-center justify-center overflow-hidden bg-[#080808] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] text-center text-white"
      aria-busy={!error}
    >
      <div className="startup-splash-logo">
        <div className="splash-mark">
          <Brand />
        </div>
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.35em] text-[#A3A3A3]">
        Drive smarter. Keep more.
      </p>

      {error ? (
        <div
          className="mt-8 w-full max-w-sm rounded-2xl border border-[#EF233C]/35 bg-[#181818] p-5 text-left"
          role="alert"
        >
          <h1 className="font-extrabold">Your saved workspace could not be loaded.</h1>
          <p className="mt-2 text-sm leading-6 text-[#A3A3A3]">{error}</p>
          <div className="mt-5 space-y-3">
            <PrimaryButton onClick={onRetry}>Retry loading saved data</PrimaryButton>
            <SecondaryButton onClick={onContinue}>Continue without changing saved data</SecondaryButton>
          </div>
        </div>
      ) : (
        <>
          <span className="sr-only" role="status" aria-live="polite">
            Loading your saved Gig Boss workspace
          </span>
          <span
            className="absolute bottom-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] h-1 w-16 overflow-hidden rounded-full bg-white/10"
            aria-hidden="true"
          >
            <span className="startup-progress block h-full w-full origin-left bg-[#EF233C]" />
          </span>
        </>
      )}
    </main>
  );
}
