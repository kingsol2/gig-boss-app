import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AppPreferences,
  AppState,
  Delivery,
  DeliveryExpense,
  DeliveryInput,
  ExpenseInput,
  GigPlatform,
  MaintenanceInput,
  MaintenanceRecord,
  MembershipTier,
  MileageTrip,
  MileageTripInput,
  UserProfile,
  VehicleProfile,
} from "../types/models";

const STORAGE_KEY = "gig-boss-local-preview-v1";
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const initialProfile: UserProfile = {
  id: "local-preview",
  fullName: "",
  email: "",
  platforms: [],
  membership: { tier: "free", priceMonthly: 0, billingStatus: "local-selection" },
  onboardingComplete: false,
  createdAt: now(),
  updatedAt: now(),
};

const initialState: AppState = {
  profile: initialProfile,
  preferences: {
    costPerMile: 0.67,
    notificationsEnabled: false,
    locationEnabled: false,
    screenshotConsent: { allowed: false },
  },
  deliveries: [],
  expenses: [],
  mileageTrips: [],
  vehicle: {},
  maintenanceRecords: [],
  previewSession: false,
};

interface AppContextValue extends AppState {
  initializationStatus: "loading" | "ready" | "error";
  initializationError?: string;
  retryInitialization: () => void;
  continueWithoutStoredData: () => void;
  startPreview: () => void;
  endPreview: () => void;
  updateProfile: (patch: Partial<Pick<UserProfile, "fullName" | "email">>) => void;
  setPlatforms: (platforms: GigPlatform[]) => void;
  setMembership: (tier: MembershipTier) => void;
  setConsent: (allowed: boolean) => void;
  completeOnboarding: () => void;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  setDailyNetGoal: (goal: number | undefined) => void;
  addDelivery: (input: DeliveryInput) => Delivery;
  updateDelivery: (id: string, input: DeliveryInput) => void;
  deleteDelivery: (id: string) => void;
  addExpense: (input: ExpenseInput) => DeliveryExpense;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
  addMileageTrip: (input: MileageTripInput) => MileageTrip;
  updateMileageTrip: (id: string, input: MileageTripInput) => void;
  deleteMileageTrip: (id: string) => void;
  updateVehicle: (patch: VehicleProfile) => void;
  addMaintenance: (input: MaintenanceInput) => MaintenanceRecord;
  updateMaintenance: (id: string, input: MaintenanceInput) => void;
  deleteMaintenance: (id: string) => void;
  resetLocalData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? { ...initialState, ...JSON.parse(stored) } : initialState;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [initializationStatus, setInitializationStatus] = useState<
    AppContextValue["initializationStatus"]
  >("loading");
  const [initializationError, setInitializationError] = useState<string>();
  const [persistenceEnabled, setPersistenceEnabled] = useState(true);

  const hydrate = useCallback(() => {
    try {
      setState(loadState());
      setPersistenceEnabled(true);
      setInitializationError(undefined);
      setInitializationStatus("ready");
    } catch {
      setInitializationError(
        "Gig Boss left the browser copy untouched. Retry, or continue in memory and review browser storage later.",
      );
      setInitializationStatus("error");
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (initializationStatus !== "ready" || !persistenceEnabled) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The app remains usable in-memory when storage is unavailable.
    }
  }, [initializationStatus, persistenceEnabled, state]);

  const update = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => updater(current));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      initializationStatus,
      initializationError,
      retryInitialization: () => {
        setInitializationStatus("loading");
        window.setTimeout(hydrate, 0);
      },
      continueWithoutStoredData: () => {
        setState(initialState);
        setPersistenceEnabled(false);
        setInitializationError(undefined);
        setInitializationStatus("ready");
      },
      startPreview: () => update((current) => ({ ...current, previewSession: true })),
      endPreview: () => update((current) => ({ ...current, previewSession: false })),
      updateProfile: (patch) =>
        update((current) => ({
          ...current,
          profile: { ...current.profile, ...patch, updatedAt: now() },
        })),
      setPlatforms: (platforms) =>
        update((current) => ({
          ...current,
          profile: { ...current.profile, platforms: [...new Set(platforms)], updatedAt: now() },
        })),
      setMembership: (tier) =>
        update((current) => ({
          ...current,
          profile: {
            ...current.profile,
            membership: {
              tier,
              priceMonthly: tier === "vip" ? 9 : 0,
              billingStatus: "local-selection",
            },
            updatedAt: now(),
          },
        })),
      setConsent: (allowed) =>
        update((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            screenshotConsent: { allowed, decidedAt: now() },
          },
        })),
      completeOnboarding: () =>
        update((current) => ({
          ...current,
          profile: { ...current.profile, onboardingComplete: true, updatedAt: now() },
        })),
      updatePreferences: (patch) =>
        update((current) => ({
          ...current,
          preferences: { ...current.preferences, ...patch },
        })),
      setDailyNetGoal: (goal) =>
        update((current) => ({
          ...current,
          preferences: { ...current.preferences, dailyNetGoal: goal },
        })),
      addDelivery: (input) => {
        const timestamp = now();
        const delivery: Delivery = {
          ...input,
          id: uid(),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        update((current) => ({ ...current, deliveries: [delivery, ...current.deliveries] }));
        return delivery;
      },
      updateDelivery: (id, input) =>
        update((current) => ({
          ...current,
          deliveries: current.deliveries.map((item) =>
            item.id === id ? { ...item, ...input, updatedAt: now() } : item,
          ),
        })),
      deleteDelivery: (id) =>
        update((current) => ({
          ...current,
          deliveries: current.deliveries.filter((item) => item.id !== id),
          expenses: current.expenses.filter((item) => item.deliveryId !== id),
        })),
      addExpense: (input) => {
        const timestamp = now();
        const expense: DeliveryExpense = {
          ...input,
          id: uid(),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        update((current) => ({ ...current, expenses: [expense, ...current.expenses] }));
        return expense;
      },
      updateExpense: (id, input) =>
        update((current) => ({
          ...current,
          expenses: current.expenses.map((item) =>
            item.id === id ? { ...item, ...input, updatedAt: now() } : item,
          ),
        })),
      deleteExpense: (id) =>
        update((current) => ({
          ...current,
          expenses: current.expenses.filter((item) => item.id !== id),
        })),
      addMileageTrip: (input) => {
        const timestamp = now();
        const trip: MileageTrip = {
          ...input,
          id: uid(),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        update((current) => ({ ...current, mileageTrips: [trip, ...current.mileageTrips] }));
        return trip;
      },
      updateMileageTrip: (id, input) =>
        update((current) => ({
          ...current,
          mileageTrips: current.mileageTrips.map((trip) =>
            trip.id === id ? { ...trip, ...input, updatedAt: now() } : trip,
          ),
        })),
      deleteMileageTrip: (id) =>
        update((current) => ({
          ...current,
          mileageTrips: current.mileageTrips.filter((trip) => trip.id !== id),
        })),
      updateVehicle: (patch) =>
        update((current) => ({
          ...current,
          vehicle: { ...current.vehicle, ...patch, updatedAt: now() },
        })),
      addMaintenance: (input) => {
        const timestamp = now();
        const recordId = uid();
        const expenseId = input.cost > 0 ? uid() : undefined;
        const record: MaintenanceRecord = {
          ...input,
          id: recordId,
          expenseId,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        update((current) => ({
          ...current,
          maintenanceRecords: [record, ...current.maintenanceRecords],
          expenses: expenseId
            ? [
                {
                  id: expenseId,
                  maintenanceRecordId: recordId,
                  category: "Maintenance",
                  amount: input.cost,
                  date: input.date,
                  notes: input.serviceType,
                  source: "maintenance",
                  createdAt: timestamp,
                  updatedAt: timestamp,
                },
                ...current.expenses,
              ]
            : current.expenses,
        }));
        return record;
      },
      updateMaintenance: (id, input) =>
        update((current) => {
          const existing = current.maintenanceRecords.find((record) => record.id === id);
          if (!existing) return current;
          const timestamp = now();
          const expenseId = input.cost > 0 ? existing.expenseId ?? uid() : undefined;
          const withoutExpense = current.expenses.filter(
            (expense) => expense.id !== existing.expenseId,
          );
          return {
            ...current,
            maintenanceRecords: current.maintenanceRecords.map((record) =>
              record.id === id
                ? { ...record, ...input, expenseId, updatedAt: timestamp }
                : record,
            ),
            expenses: expenseId
              ? [
                  {
                    id: expenseId,
                    maintenanceRecordId: id,
                    category: "Maintenance",
                    amount: input.cost,
                    date: input.date,
                    notes: input.serviceType,
                    source: "maintenance",
                    createdAt:
                      current.expenses.find((expense) => expense.id === expenseId)?.createdAt ??
                      timestamp,
                    updatedAt: timestamp,
                  },
                  ...withoutExpense,
                ]
              : withoutExpense,
          };
        }),
      deleteMaintenance: (id) =>
        update((current) => {
          const record = current.maintenanceRecords.find((item) => item.id === id);
          return {
            ...current,
            maintenanceRecords: current.maintenanceRecords.filter((item) => item.id !== id),
            expenses: record?.expenseId
              ? current.expenses.filter((expense) => expense.id !== record.expenseId)
              : current.expenses,
          };
        }),
      resetLocalData: () => setState(initialState),
    }),
    [hydrate, initializationError, initializationStatus, state, update],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used inside AppProvider");
  return context;
}
