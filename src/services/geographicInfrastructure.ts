import { US_STATES, type USStateCode } from "../types/profitIntelligence.ts";
import type {
  AuthorizedDriverArea,
  DriverLocationPermissionState,
  DriverMarketResolutionResult,
  GeographicMarket,
  GeographicMarketBoundary,
  LocationAwareRankingQuery,
  LocationAwareRankingQueryInput,
  LocationAwareRankingQueryResult,
  LocationPermissionSnapshot,
  LocationRequestOptions,
  LocationRequestResult,
  MarketValidationResult,
  PreciseDriverCoordinates,
  VerifiedGeocodedArea,
} from "../types/geographicInfrastructure.ts";
import type { GeographicRankingResult } from "../types/geographicProfitIntelligence.ts";

export interface LocationPermissionService {
  getPermissionState(): Promise<LocationPermissionSnapshot>;
  requestCurrentLocation(options: LocationRequestOptions): Promise<LocationRequestResult>;
  withdrawAuthorization(): LocationPermissionSnapshot;
}

export interface DriverMarketService {
  listMarkets(stateCode: USStateCode): readonly GeographicMarket[];
  resolveVerifiedArea(area: VerifiedGeocodedArea): DriverMarketResolutionResult;
  selectManualMarket(stateCode: USStateCode, marketId: string): DriverMarketResolutionResult;
}

export interface GeocodingService {
  readonly available: boolean;
  reverseGeocode(coordinates: PreciseDriverCoordinates): Promise<VerifiedGeocodedArea | null>;
}

export interface GeographicBenchmarkService {
  queryProfitability(query: LocationAwareRankingQuery): Promise<GeographicRankingResult>;
}

interface PermissionStatusLike {
  state: PermissionState;
}

export interface BrowserLocationRuntime {
  geolocation?: Pick<Geolocation, "getCurrentPosition">;
  permissions?: {
    query(descriptor: PermissionDescriptor): Promise<PermissionStatusLike>;
  };
  now: () => Date;
}

const browserRuntime = (): BrowserLocationRuntime => ({
  geolocation: typeof navigator === "undefined" ? undefined : navigator.geolocation,
  permissions: typeof navigator === "undefined" ? undefined : navigator.permissions,
  now: () => new Date(),
});

const snapshot = (
  state: DriverLocationPermissionState,
  appAuthorized: boolean,
  now: Date,
): LocationPermissionSnapshot => ({
  state,
  appAuthorized,
  checkedAt: now.toISOString(),
});

const validCoordinate = (value: number, minimum: number, maximum: number): boolean =>
  Number.isFinite(value) && value >= minimum && value <= maximum;

export class BrowserLocationPermissionService implements LocationPermissionService {
  private readonly runtime: BrowserLocationRuntime;
  private appAuthorized = false;
  private previouslyGranted = false;
  private withdrawn = false;

  constructor(runtime: BrowserLocationRuntime = browserRuntime()) {
    this.runtime = runtime;
  }

  async getPermissionState(): Promise<LocationPermissionSnapshot> {
    if (this.withdrawn) return snapshot("revoked", false, this.runtime.now());
    if (!this.runtime.geolocation) return snapshot("unavailable", false, this.runtime.now());
    if (!this.runtime.permissions)
      return snapshot("prompt", this.appAuthorized, this.runtime.now());

    try {
      const status = await this.runtime.permissions.query({
        name: "geolocation",
      } as PermissionDescriptor);
      if (status.state === "granted")
        return snapshot("granted", this.appAuthorized, this.runtime.now());
      if (status.state === "denied")
        return snapshot(
          this.previouslyGranted || this.appAuthorized ? "revoked" : "denied",
          false,
          this.runtime.now(),
        );
      return snapshot("prompt", false, this.runtime.now());
    } catch {
      return snapshot("prompt", this.appAuthorized, this.runtime.now());
    }
  }

  async requestCurrentLocation(options: LocationRequestOptions): Promise<LocationRequestResult> {
    if (!options.initiatedByUser) {
      return {
        status: "not-authorized",
        permission: await this.getPermissionState(),
        reason: "explicit-user-action-required",
      };
    }
    if (!this.runtime.geolocation) {
      return {
        status: "not-authorized",
        permission: snapshot("unavailable", false, this.runtime.now()),
        reason: "geolocation-unavailable",
      };
    }

    this.withdrawn = false;
    const position = await new Promise<
      | { status: "success"; position: GeolocationPosition }
      | { status: "error"; error: GeolocationPositionError }
    >((resolve) => {
      this.runtime.geolocation!.getCurrentPosition(
        (result) => resolve({ status: "success", position: result }),
        (error) => resolve({ status: "error", error }),
        {
          enableHighAccuracy: options.enableHighAccuracy ?? false,
          timeout: options.timeoutMs ?? 10_000,
          maximumAge: options.maximumAgeMs ?? 0,
        },
      );
    });

    if (position.status === "error") {
      this.appAuthorized = false;
      const denied = position.error.code === 1;
      const state: DriverLocationPermissionState = denied
        ? this.previouslyGranted
          ? "revoked"
          : "denied"
        : "unavailable";
      return {
        status: "not-authorized",
        permission: snapshot(state, false, this.runtime.now()),
        reason: denied
          ? state === "revoked"
            ? "permission-revoked"
            : "permission-denied"
          : position.error.code === 3
            ? "request-timeout"
            : "position-unavailable",
      };
    }

    const { latitude, longitude, accuracy } = position.position.coords;
    if (
      !validCoordinate(latitude, -90, 90) ||
      !validCoordinate(longitude, -180, 180) ||
      !Number.isFinite(accuracy) ||
      accuracy < 0
    ) {
      this.appAuthorized = false;
      return {
        status: "not-authorized",
        permission: snapshot("unavailable", false, this.runtime.now()),
        reason: "position-unavailable",
      };
    }

    this.appAuthorized = true;
    this.previouslyGranted = true;
    const permission = snapshot("granted", true, this.runtime.now());
    return {
      status: "authorized",
      permission,
      coordinates: {
        latitude,
        longitude,
        accuracyMeters: accuracy,
        capturedAt: new Date(position.position.timestamp).toISOString(),
      },
    };
  }

  withdrawAuthorization(): LocationPermissionSnapshot {
    this.appAuthorized = false;
    this.withdrawn = true;
    return snapshot("revoked", false, this.runtime.now());
  }
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validStateCode = (value: unknown): value is USStateCode =>
  typeof value === "string" && US_STATES.some((state) => state.code === value);

const validTimeZone = (value: unknown): value is string => {
  if (!nonEmptyString(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};

const validMarketId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(value);

const validPosition = (position: unknown): boolean =>
  Array.isArray(position) &&
  position.length === 2 &&
  validCoordinate(position[0], -180, 180) &&
  validCoordinate(position[1], -90, 90);

const validRing = (ring: unknown): boolean => {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(validPosition)) return false;
  const first = ring[0] as readonly number[];
  const last = ring.at(-1) as readonly number[];
  return first[0] === last[0] && first[1] === last[1];
};

const validPolygon = (coordinates: unknown): boolean =>
  Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(validRing);

const validBoundary = (boundary: unknown): boundary is GeographicMarketBoundary => {
  if (!boundary || typeof boundary !== "object") return false;
  const value = boundary as Record<string, unknown>;
  if (value.type === "provider-reference")
    return (
      nonEmptyString(value.providerBoundaryId) &&
      nonEmptyString(value.providerName) &&
      nonEmptyString(value.boundaryVersion)
    );
  if (value.type !== "geojson" || !value.geometry || typeof value.geometry !== "object")
    return false;
  const geometry = value.geometry as Record<string, unknown>;
  if (geometry.type === "Polygon") return validPolygon(geometry.coordinates);
  if (geometry.type === "MultiPolygon")
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every(validPolygon)
    );
  return false;
};

export const validateGeographicMarket = (value: unknown): MarketValidationResult => {
  const issues: string[] = [];
  if (!value || typeof value !== "object")
    return { valid: false, issues: ["Market must be an object."] };
  const market = value as Partial<GeographicMarket>;
  if (!validStateCode(market.stateCode)) issues.push("State code is invalid.");
  if (!validMarketId(market.marketId)) issues.push("Market ID is invalid.");
  if (!nonEmptyString(market.marketName)) issues.push("Market name is required.");
  if (!validTimeZone(market.timeZone)) issues.push("IANA timezone is invalid.");
  if (!validBoundary(market.boundary))
    issues.push("Geographic boundary is unsupported or invalid.");
  if (!nonEmptyString(market.datasetVersion)) issues.push("Dataset version is required.");
  if (!market.source || typeof market.source !== "object") {
    issues.push("Source metadata is required.");
  } else {
    if (!nonEmptyString(market.source.providerName))
      issues.push("Source provider name is required.");
    if (!nonEmptyString(market.source.datasetName)) issues.push("Source dataset name is required.");
    if (!nonEmptyString(market.source.datasetVersion))
      issues.push("Source dataset version is required.");
    if (
      market.source.datasetVersion !== undefined &&
      market.source.datasetVersion !== market.datasetVersion
    )
      issues.push("Source and market dataset versions must match.");
    if (
      !nonEmptyString(market.source.retrievedAt) ||
      !Number.isFinite(Date.parse(market.source.retrievedAt))
    )
      issues.push("Source retrieval timestamp is invalid.");
  }
  return issues.length
    ? { valid: false, issues }
    : { valid: true, market: market as GeographicMarket, issues: [] };
};

export class CatalogDriverMarketService implements DriverMarketService {
  private readonly markets: GeographicMarket[];
  private readonly now: () => Date;

  constructor(markets: readonly unknown[], now: () => Date = () => new Date()) {
    this.now = now;
    this.markets = markets
      .map(validateGeographicMarket)
      .filter(
        (result): result is MarketValidationResult & { market: GeographicMarket } =>
          result.valid && Boolean(result.market),
      )
      .map((result) => result.market);
  }

  listMarkets(stateCode: USStateCode): readonly GeographicMarket[] {
    if (!validStateCode(stateCode)) return [];
    return this.markets.filter((market) => market.stateCode === stateCode);
  }

  resolveVerifiedArea(area: VerifiedGeocodedArea): DriverMarketResolutionResult {
    if (
      !validStateCode(area.stateCode) ||
      !validMarketId(area.marketId) ||
      !nonEmptyString(area.providerName) ||
      !nonEmptyString(area.datasetVersion) ||
      !Number.isFinite(Date.parse(area.verifiedAt))
    )
      return { status: "unresolved", reason: "geocoding-failed" };
    const market = this.markets.find(
      (item) => item.stateCode === area.stateCode && item.marketId === area.marketId,
    );
    if (!market) return { status: "unresolved", reason: "market-not-found" };
    if (market.datasetVersion !== area.datasetVersion)
      return { status: "unresolved", reason: "market-dataset-mismatch" };
    return { status: "resolved", area: this.authorizedArea(market, "authorized-location") };
  }

  selectManualMarket(stateCode: USStateCode, marketId: string): DriverMarketResolutionResult {
    if (!validStateCode(stateCode) || !validMarketId(marketId))
      return { status: "unresolved", reason: "invalid-manual-selection" };
    const market = this.markets.find(
      (item) => item.stateCode === stateCode && item.marketId === marketId,
    );
    if (!market) return { status: "unresolved", reason: "market-not-found" };
    return { status: "resolved", area: this.authorizedArea(market, "manual-selection") };
  }

  private authorizedArea(
    market: GeographicMarket,
    source: AuthorizedDriverArea["source"],
  ): AuthorizedDriverArea {
    return {
      source,
      stateCode: market.stateCode,
      marketId: market.marketId,
      marketName: market.marketName,
      timeZone: market.timeZone,
      datasetVersion: market.datasetVersion,
      selectedAt: this.now().toISOString(),
      preciseCoordinatesRetained: false,
    };
  }
}

export class UnavailableGeocodingService implements GeocodingService {
  readonly available = false;

  async reverseGeocode(): Promise<null> {
    return null;
  }
}

export const resolveAuthorizedDriverMarket = async (
  location: LocationRequestResult,
  geocodingService: GeocodingService | null,
  marketService: DriverMarketService,
): Promise<DriverMarketResolutionResult> => {
  if (location.status !== "authorized")
    return { status: "unresolved", reason: "location-not-authorized" };
  if (!geocodingService?.available)
    return { status: "unresolved", reason: "geographic-provider-unavailable" };

  try {
    // Coordinates stay in this call boundary and are not included in the resolved area.
    const geocoded = await geocodingService.reverseGeocode(location.coordinates);
    if (!geocoded) return { status: "unresolved", reason: "geocoding-failed" };
    return marketService.resolveVerifiedArea(geocoded);
  } catch {
    return { status: "unresolved", reason: "geocoding-failed" };
  }
};

export const createLocationAwareRankingQuery = (
  area: AuthorizedDriverArea,
  input: LocationAwareRankingQueryInput,
): LocationAwareRankingQueryResult => {
  if (input.stateCode !== area.stateCode || input.marketId !== area.marketId)
    return { status: "rejected", reason: "unauthorized-area" };
  if (![30, 60, 90].includes(input.analysisWindowDays))
    return { status: "rejected", reason: "invalid-analysis-window" };
  if (!nonEmptyString(input.datasetVersion) || input.datasetVersion !== area.datasetVersion)
    return { status: "rejected", reason: "invalid-dataset-version" };
  if (!Number.isFinite(Date.parse(input.asOf)))
    return { status: "rejected", reason: "invalid-as-of-date" };
  if (
    input.zoneIds &&
    (input.zoneIds.length === 0 ||
      new Set(input.zoneIds).size !== input.zoneIds.length ||
      input.zoneIds.some((zoneId) => !validMarketId(zoneId)))
  )
    return { status: "rejected", reason: "invalid-zone-filter" };

  return {
    status: "ready",
    query: {
      stateCode: area.stateCode,
      marketId: area.marketId,
      zoneIds: input.zoneIds ? [...input.zoneIds] : undefined,
      analysisWindowDays: input.analysisWindowDays,
      datasetVersion: area.datasetVersion,
      asOf: input.asOf,
    },
  };
};
