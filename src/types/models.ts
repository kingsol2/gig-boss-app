export const GIG_PLATFORMS = [
  "DoorDash",
  "Uber Eats",
  "Grubhub",
  "Walmart Spark",
  "Amazon Flex",
  "Instacart",
  "Other",
] as const;

export type GigPlatform = (typeof GIG_PLATFORMS)[number];
export type MembershipTier = "free" | "vip";

export interface Membership {
  tier: MembershipTier;
  priceMonthly: number;
  billingStatus: "local-selection" | "active" | "inactive";
}

export interface ScreenshotProcessingConsent {
  allowed: boolean;
  decidedAt?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  platforms: GigPlatform[];
  membership: Membership;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryExpense {
  id: string;
  deliveryId?: string;
  maintenanceRecordId?: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  source?: "manual" | "maintenance";
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryLocation {
  pickup?: string;
  dropoff?: string;
}

export interface Delivery {
  id: string;
  platform: GigPlatform;
  date: string;
  basePay: number;
  tips: number;
  otherPay: number;
  payoutIncludesTips: boolean;
  miles: number;
  durationMinutes: number;
  startTime?: string;
  notes?: string;
  location?: DeliveryLocation;
  createdAt: string;
  updatedAt: string;
}

export interface AppPreferences {
  costPerMile: number;
  dailyNetGoal?: number;
  notificationsEnabled: boolean;
  locationEnabled: boolean;
  screenshotConsent: ScreenshotProcessingConsent;
}

export interface MileageTrip {
  id: string;
  date: string;
  startOdometer: number;
  endOdometer: number;
  purpose: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleProfile {
  year?: number;
  make?: string;
  model?: string;
  currentOdometer?: number;
  updatedAt?: string;
}

export type MaintenanceType =
  | "Oil change"
  | "Tires"
  | "Brakes"
  | "Repair"
  | "Inspection"
  | "Other";

export interface MaintenanceRecord {
  id: string;
  serviceType: MaintenanceType;
  date: string;
  odometer: number;
  cost: number;
  nextServiceOdometer?: number;
  notes?: string;
  expenseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EarningsSummary {
  gross: number;
  tips: number;
  mileageCost: number;
  additionalExpenses: number;
  estimatedExpenses: number;
  estimatedNet: number;
  miles: number;
  durationMinutes: number;
  deliveryCount: number;
  grossPerMile: number;
  grossPerHour: number;
  netPerHour: number;
}

export type DatePreset = "today" | "week" | "month" | "custom" | "all";

export interface AppState {
  profile: UserProfile;
  preferences: AppPreferences;
  deliveries: Delivery[];
  expenses: DeliveryExpense[];
  mileageTrips: MileageTrip[];
  vehicle: VehicleProfile;
  maintenanceRecords: MaintenanceRecord[];
  previewSession: boolean;
}

export interface DeliveryInput {
  platform: GigPlatform;
  date: string;
  basePay: number;
  tips: number;
  otherPay: number;
  payoutIncludesTips: boolean;
  miles: number;
  durationMinutes: number;
  startTime?: string;
  notes?: string;
}

export interface ExpenseInput {
  deliveryId?: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}

export type MileageTripInput = Omit<MileageTrip, "id" | "createdAt" | "updatedAt">;

export type MaintenanceInput = Omit<
  MaintenanceRecord,
  "id" | "expenseId" | "createdAt" | "updatedAt"
>;
