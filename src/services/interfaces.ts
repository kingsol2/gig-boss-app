import type {
  AppPreferences,
  Delivery,
  DeliveryExpense,
  Membership,
  UserProfile,
} from "../types/models";

export interface AuthService {
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  resendVerification(): Promise<void>;
}

export interface ProfileService {
  getProfile(userId: string): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;
}

export interface DeliveryService {
  list(userId: string): Promise<Delivery[]>;
  save(userId: string, delivery: Delivery): Promise<void>;
  remove(userId: string, deliveryId: string): Promise<void>;
}

export interface ExpenseService {
  list(userId: string): Promise<DeliveryExpense[]>;
  save(userId: string, expense: DeliveryExpense): Promise<void>;
  remove(userId: string, expenseId: string): Promise<void>;
}

export interface PreferencesService {
  get(userId: string): Promise<AppPreferences>;
  save(userId: string, preferences: AppPreferences): Promise<void>;
}

export interface MembershipService {
  get(userId: string): Promise<Membership>;
  beginUpgrade(userId: string): Promise<void>;
}

export interface ScreenshotProcessingService {
  process(file: File): Promise<Partial<Delivery>>;
}

export const INTEGRATION_MESSAGES = {
  firebase: "Firebase Authentication is not connected. No account action was performed.",
  firestore: "Firestore is not connected. This preview stores records only on this device.",
  screenshot: "Screenshot processing is not connected. Use manual entry instead.",
  map: "A map provider is not configured. No map or coordinates are being simulated.",
  stripe: "Stripe is not connected. No payment or subscription change was made.",
} as const;
