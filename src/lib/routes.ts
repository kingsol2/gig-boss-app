export const ROUTES = {
  splash: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  verifyEmail: "/verify-email",
  onboardingPlatforms: "/onboarding/platforms",
  onboardingMembership: "/onboarding/membership",
  onboardingConsent: "/onboarding/consent",
  onboardingComplete: "/onboarding/complete",
  dashboard: "/app/dashboard",
  upload: "/app/upload",
  screenshotReview: "/app/screenshot-review",
  addDelivery: "/app/deliveries/new",
  deliveries: "/app/deliveries",
  deliveryDetails: "/app/deliveries/:id",
  reports: "/app/reports",
  earningsAnalytics: "/app/reports/earnings",
  expenses: "/app/expenses",
  profitBreakdown: "/app/reports/profit",
  platformComparison: "/app/reports/platforms",
  map: "/app/map",
  locationDetails: "/app/locations/:id",
  membership: "/app/membership",
  profile: "/app/profile",
  editPlatforms: "/app/profile/platforms",
  settings: "/app/settings",
  calculations: "/app/settings/calculations",
  notifications: "/app/settings/notifications",
  privacy: "/app/settings/privacy",
  security: "/app/settings/security",
  help: "/app/help",
  account: "/app/account",
} as const;

export const appPath = (template: string, id: string): string =>
  template.replace(":id", encodeURIComponent(id));

export const isAppRoute = (path: string): boolean => path.startsWith("/app/");

export const routeMatches = (template: string, path: string): boolean => {
  const pattern = template.replace(/:[^/]+/g, "[^/]+");
  return new RegExp(`^${pattern}$`).test(path);
};

export const routeParam = (template: string, path: string, name: string): string | undefined => {
  const keys = [...template.matchAll(/:([^/]+)/g)].map((match) => match[1]);
  const pattern = template.replace(/:[^/]+/g, "([^/]+)");
  const match = path.match(new RegExp(`^${pattern}$`));
  const index = keys.indexOf(name);
  return match && index >= 0 ? decodeURIComponent(match[index + 1]) : undefined;
};
