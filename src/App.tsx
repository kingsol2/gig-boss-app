import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { isAppRoute, routeMatches, routeParam, ROUTES } from "./lib/routes";
import { AppProvider, useAppState } from "./state/AppContext";
import { RouterProvider, useRouter } from "./state/RouterContext";
import { Brand, LoadingState, PrimaryButton } from "./components/ui";
import { StartupSplash } from "./components/StartupSplash";

const lazyScreen = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(async () => ({ default: (await loader())[name] as unknown as ComponentType }));

const lazyScreenWithProps =
  <P extends object>() =>
  <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, name: K) =>
    lazy(async () => ({ default: (await loader())[name] as unknown as ComponentType<P> }));

const SplashScreen = lazyScreen(() => import("./screens/AuthScreens"), "SplashScreen");
const LoginScreen = lazyScreen(() => import("./screens/AuthScreens"), "LoginScreen");
const SignUpScreen = lazyScreen(() => import("./screens/AuthScreens"), "SignUpScreen");
const ForgotPasswordScreen = lazyScreen(
  () => import("./screens/AuthScreens"),
  "ForgotPasswordScreen",
);
const EmailVerificationScreen = lazyScreen(
  () => import("./screens/AuthScreens"),
  "EmailVerificationScreen",
);
const PlatformSelectionScreen = lazyScreen(
  () => import("./screens/AuthScreens"),
  "PlatformSelectionScreen",
);
const MembershipSelectionScreen = lazyScreen(
  () => import("./screens/AuthScreens"),
  "MembershipSelectionScreen",
);
const ConsentScreen = lazyScreen(() => import("./screens/AuthScreens"), "ConsentScreen");
const OnboardingCompleteScreen = lazyScreen(
  () => import("./screens/AuthScreens"),
  "OnboardingCompleteScreen",
);
const DashboardScreen = lazyScreen(() => import("./screens/DeliveryScreens"), "DashboardScreen");
const UploadScreen = lazyScreen(() => import("./screens/DeliveryScreens"), "UploadScreen");
const ScreenshotReviewScreen = lazyScreen(
  () => import("./screens/DeliveryScreens"),
  "ScreenshotReviewScreen",
);
const ManualDeliveryScreen = lazyScreen(
  () => import("./screens/DeliveryScreens"),
  "ManualDeliveryScreen",
);
const DeliveryHistoryScreen = lazyScreen(
  () => import("./screens/DeliveryScreens"),
  "DeliveryHistoryScreen",
);
const DeliveryDetailsScreen = lazyScreenWithProps<{ deliveryId: string }>()(
  () => import("./screens/DeliveryScreens"),
  "DeliveryDetailsScreen",
);
const ReportsOverviewScreen = lazyScreen(
  () => import("./screens/ReportScreens"),
  "ReportsOverviewScreen",
);
const EarningsAnalyticsScreen = lazyScreen(
  () => import("./screens/ReportScreens"),
  "EarningsAnalyticsScreen",
);
const ExpenseTrackingScreen = lazyScreen(
  () => import("./screens/ReportScreens"),
  "ExpenseTrackingScreen",
);
const ProfitBreakdownScreen = lazyScreen(
  () => import("./screens/ReportScreens"),
  "ProfitBreakdownScreen",
);
const PlatformComparisonScreen = lazyScreen(
  () => import("./screens/ReportScreens"),
  "PlatformComparisonScreen",
);
const MapScreen = lazyScreen(() => import("./screens/AccountScreens"), "MapScreen");
const LocationDetailsScreen = lazyScreenWithProps<{ deliveryId: string }>()(
  () => import("./screens/AccountScreens"),
  "LocationDetailsScreen",
);
const MembershipScreen = lazyScreen(() => import("./screens/AccountScreens"), "MembershipScreen");
const ProfileScreen = lazyScreen(() => import("./screens/AccountScreens"), "ProfileScreen");
const EditPlatformsScreen = lazyScreen(
  () => import("./screens/AccountScreens"),
  "EditPlatformsScreen",
);
const SettingsScreen = lazyScreen(() => import("./screens/AccountScreens"), "SettingsScreen");
const CalculationSettingsScreen = lazyScreen(
  () => import("./screens/AccountScreens"),
  "CalculationSettingsScreen",
);
const NotificationsScreen = lazyScreen(
  () => import("./screens/AccountScreens"),
  "NotificationsScreen",
);
const PrivacyScreen = lazyScreen(() => import("./screens/AccountScreens"), "PrivacyScreen");
const SecurityScreen = lazyScreen(() => import("./screens/AccountScreens"), "SecurityScreen");
const HelpScreen = lazyScreen(() => import("./screens/AccountScreens"), "HelpScreen");
const AccountManagementScreen = lazyScreen(
  () => import("./screens/AccountScreens"),
  "AccountManagementScreen",
);

interface RouteDefinition {
  path: string;
  screen: (params: Record<string, string>) => ReactNode;
}

export const APP_ROUTES: RouteDefinition[] = [
  { path: ROUTES.splash, screen: () => <SplashScreen /> },
  { path: ROUTES.login, screen: () => <LoginScreen /> },
  { path: ROUTES.signup, screen: () => <SignUpScreen /> },
  { path: ROUTES.forgotPassword, screen: () => <ForgotPasswordScreen /> },
  { path: ROUTES.verifyEmail, screen: () => <EmailVerificationScreen /> },
  { path: ROUTES.onboardingPlatforms, screen: () => <PlatformSelectionScreen /> },
  { path: ROUTES.onboardingMembership, screen: () => <MembershipSelectionScreen /> },
  { path: ROUTES.onboardingConsent, screen: () => <ConsentScreen /> },
  { path: ROUTES.onboardingComplete, screen: () => <OnboardingCompleteScreen /> },
  { path: ROUTES.dashboard, screen: () => <DashboardScreen /> },
  { path: ROUTES.upload, screen: () => <UploadScreen /> },
  { path: ROUTES.screenshotReview, screen: () => <ScreenshotReviewScreen /> },
  { path: ROUTES.addDelivery, screen: () => <ManualDeliveryScreen /> },
  { path: ROUTES.deliveries, screen: () => <DeliveryHistoryScreen /> },
  {
    path: ROUTES.deliveryDetails,
    screen: (params) => <DeliveryDetailsScreen deliveryId={params.id} />,
  },
  { path: ROUTES.reports, screen: () => <ReportsOverviewScreen /> },
  { path: ROUTES.earningsAnalytics, screen: () => <EarningsAnalyticsScreen /> },
  { path: ROUTES.expenses, screen: () => <ExpenseTrackingScreen /> },
  { path: ROUTES.profitBreakdown, screen: () => <ProfitBreakdownScreen /> },
  { path: ROUTES.platformComparison, screen: () => <PlatformComparisonScreen /> },
  { path: ROUTES.map, screen: () => <MapScreen /> },
  {
    path: ROUTES.locationDetails,
    screen: (params) => <LocationDetailsScreen deliveryId={params.id} />,
  },
  { path: ROUTES.membership, screen: () => <MembershipScreen /> },
  { path: ROUTES.profile, screen: () => <ProfileScreen /> },
  { path: ROUTES.editPlatforms, screen: () => <EditPlatformsScreen /> },
  { path: ROUTES.settings, screen: () => <SettingsScreen /> },
  { path: ROUTES.calculations, screen: () => <CalculationSettingsScreen /> },
  { path: ROUTES.notifications, screen: () => <NotificationsScreen /> },
  { path: ROUTES.privacy, screen: () => <PrivacyScreen /> },
  { path: ROUTES.security, screen: () => <SecurityScreen /> },
  { path: ROUTES.help, screen: () => <HelpScreen /> },
  { path: ROUTES.account, screen: () => <AccountManagementScreen /> },
];

function RouteRenderer() {
  const { path, navigate } = useRouter();
  const { previewSession } = useAppState();

  useEffect(() => {
    if (isAppRoute(path) && !previewSession) navigate(ROUTES.login, { replace: true });
  }, [navigate, path, previewSession]);

  if (isAppRoute(path) && !previewSession) return null;

  const route = APP_ROUTES.find((definition) => routeMatches(definition.path, path));
  if (!route) {
    return (
      <main
        id="main-content"
        className="app-viewport flex flex-col items-center justify-center bg-[#080808] px-6 text-center text-white"
      >
        <Brand />
        <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-[#EF233C]">
          Screen not found
        </p>
        <h1 className="mt-2 text-2xl font-black">This route doesn’t exist.</h1>
        <PrimaryButton
          className="mt-6 max-w-xs"
          onClick={() => navigate(previewSession ? ROUTES.dashboard : ROUTES.login)}
        >
          Return to Gig Boss
        </PrimaryButton>
      </main>
    );
  }

  const params: Record<string, string> = {};
  for (const match of route.path.matchAll(/:([^/]+)/g)) {
    const value = routeParam(route.path, path, match[1]);
    if (value) params[match[1]] = value;
  }
  return (
    <Suspense
      fallback={
        <main
          id="main-content"
          className="app-viewport bg-[#080808] pt-[max(5rem,env(safe-area-inset-top))] text-white"
        >
          <LoadingState label="Loading screen" />
        </main>
      }
    >
      {route.screen(params)}
    </Suspense>
  );
}

const MINIMUM_SPLASH_MS = 650;

function StartupGate({ children }: { children: ReactNode }) {
  const {
    initializationStatus,
    initializationError,
    retryInitialization,
    continueWithoutStoredData,
  } = useAppState();
  const { path, navigate } = useRouter();
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), MINIMUM_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (initializationStatus === "ready" && minimumElapsed && path === ROUTES.splash) {
      navigate(ROUTES.login, { replace: true });
    }
  }, [initializationStatus, minimumElapsed, navigate, path]);

  if (initializationStatus === "error") {
    return (
      <StartupSplash
        error={initializationError}
        onRetry={retryInitialization}
        onContinue={continueWithoutStoredData}
      />
    );
  }

  if (
    initializationStatus !== "ready" ||
    !minimumElapsed ||
    path === ROUTES.splash
  ) {
    return <StartupSplash />;
  }

  return <div className="startup-content">{children}</div>;
}

export default function App() {
  return (
    <RouterProvider>
      <AppProvider>
        <StartupGate>
          <div className="app-shell">
            <a className="skip-link" href="#main-content">
              Skip to content
            </a>
            <RouteRenderer />
          </div>
        </StartupGate>
      </AppProvider>
    </RouterProvider>
  );
}
