import assert from "node:assert/strict";
import test from "node:test";
import { US_STATES } from "../src/types/profitIntelligence.ts";
import {
  BrowserLocationPermissionService,
  CatalogDriverMarketService,
  UnavailableGeocodingService,
  createLocationAwareRankingQuery,
  resolveAuthorizedDriverMarket,
  validateGeographicMarket,
} from "../src/services/geographicInfrastructure.ts";

const now = "2025-04-01T12:00:00.000Z";

const market = (stateCode = "TX", overrides = {}) => ({
  stateCode,
  marketId: `${stateCode.toLowerCase()}-synthetic-market`,
  marketName: `${stateCode} Synthetic Market`,
  timeZone: "America/Chicago",
  boundary: {
    type: "provider-reference",
    providerBoundaryId: `${stateCode.toLowerCase()}-boundary`,
    providerName: "Synthetic Test Provider",
    boundaryVersion: "synthetic-boundary-v1",
  },
  datasetVersion: "synthetic-market-v1",
  source: {
    providerName: "Synthetic Test Provider",
    datasetName: "Synthetic Market Catalog",
    datasetVersion: "synthetic-market-v1",
    retrievedAt: now,
  },
  ...overrides,
});

const successfulPosition = {
  coords: {
    latitude: 30.2672,
    longitude: -97.7431,
    accuracy: 25,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: Date.parse(now),
  toJSON: () => ({}),
};

const runtime = ({
  permissionState = "prompt",
  geolocation = "success",
  calls = { location: 0, permission: 0 },
} = {}) => ({
  calls,
  runtime: {
    now: () => new Date(now),
    permissions: {
      query: async () => {
        calls.permission += 1;
        return { state: permissionState };
      },
    },
    geolocation:
      geolocation === "missing"
        ? undefined
        : {
            getCurrentPosition: (success, error) => {
              calls.location += 1;
              if (geolocation === "success") success(successfulPosition);
              if (geolocation === "denied")
                error({ code: 1, message: "Denied", PERMISSION_DENIED: 1 });
              if (geolocation === "unavailable")
                error({ code: 2, message: "Unavailable", POSITION_UNAVAILABLE: 2 });
              if (geolocation === "timeout") error({ code: 3, message: "Timeout", TIMEOUT: 3 });
            },
          },
  },
});

test("permission granted requires explicit user action and returns a transient position", async () => {
  const mock = runtime({ permissionState: "granted" });
  const service = new BrowserLocationPermissionService(mock.runtime);
  const result = await service.requestCurrentLocation({ initiatedByUser: true });

  assert.equal(result.status, "authorized");
  assert.equal(result.permission.state, "granted");
  assert.equal(result.permission.appAuthorized, true);
  assert.equal(result.coordinates.latitude, 30.2672);
  assert.equal(result.coordinates.longitude, -97.7431);
  assert.equal(mock.calls.location, 1);
});

test("prompt state can be inspected without accessing coordinates", async () => {
  const mock = runtime({ permissionState: "prompt" });
  const service = new BrowserLocationPermissionService(mock.runtime);
  const permission = await service.getPermissionState();

  assert.equal(permission.state, "prompt");
  assert.equal(permission.appAuthorized, false);
  assert.equal(mock.calls.location, 0);
  assert.equal(mock.calls.permission, 1);
});

test("permission denied and unavailable states do not claim authorization", async () => {
  const denied = new BrowserLocationPermissionService(
    runtime({ permissionState: "denied", geolocation: "denied" }).runtime,
  );
  const deniedResult = await denied.requestCurrentLocation({ initiatedByUser: true });
  assert.equal(deniedResult.status, "not-authorized");
  assert.equal(deniedResult.permission.state, "denied");
  assert.equal(deniedResult.reason, "permission-denied");

  const missing = new BrowserLocationPermissionService(runtime({ geolocation: "missing" }).runtime);
  const unavailableResult = await missing.requestCurrentLocation({ initiatedByUser: true });
  assert.equal(unavailableResult.status, "not-authorized");
  assert.equal(unavailableResult.permission.state, "unavailable");
  assert.equal(unavailableResult.reason, "geolocation-unavailable");
});

test("previously granted or withdrawn permission becomes revoked", async () => {
  let permissionState = "granted";
  const calls = { location: 0, permission: 0 };
  const mockRuntime = runtime({ calls }).runtime;
  mockRuntime.permissions.query = async () => {
    calls.permission += 1;
    return { state: permissionState };
  };
  const service = new BrowserLocationPermissionService(mockRuntime);

  assert.equal(
    (await service.requestCurrentLocation({ initiatedByUser: true })).status,
    "authorized",
  );
  permissionState = "denied";
  assert.equal((await service.getPermissionState()).state, "revoked");
  assert.equal(service.withdrawAuthorization().state, "revoked");
  assert.equal((await service.getPermissionState()).state, "revoked");
});

test("no unauthorized request invokes browser geolocation", async () => {
  const calls = { location: 0, permission: 0 };
  const service = new BrowserLocationPermissionService(runtime({ calls }).runtime);
  const result = await service.requestCurrentLocation({ initiatedByUser: false });

  assert.equal(result.status, "not-authorized");
  assert.equal(result.reason, "explicit-user-action-required");
  assert.equal(calls.location, 0);
});

test("manual state and market selection works without location permission", () => {
  const service = new CatalogDriverMarketService([market()], () => new Date(now));
  const result = service.selectManualMarket("TX", "tx-synthetic-market");

  assert.equal(result.status, "resolved");
  assert.equal(result.area.source, "manual-selection");
  assert.equal(result.area.stateCode, "TX");
  assert.equal(result.area.marketId, "tx-synthetic-market");
  assert.equal(result.area.preciseCoordinatesRetained, false);
  assert.equal("latitude" in result.area, false);
  assert.equal("longitude" in result.area, false);
});

test("market catalogs and manual fallback support all 50 state identifiers", () => {
  const markets = US_STATES.map(({ code }) => market(code));
  const service = new CatalogDriverMarketService(markets, () => new Date(now));

  assert.equal(US_STATES.length, 50);
  for (const { code } of US_STATES) {
    assert.equal(service.listMarkets(code).length, 1);
    const result = service.selectManualMarket(code, `${code.toLowerCase()}-synthetic-market`);
    assert.equal(result.status, "resolved");
    assert.equal(result.area.stateCode, code);
  }
});

test("invalid market IDs, timezones, and unsupported boundaries are rejected", () => {
  const invalidId = validateGeographicMarket(market("TX", { marketId: "INVALID MARKET!" }));
  const invalidTimeZone = validateGeographicMarket(market("TX", { timeZone: "Not/A_Timezone" }));
  const unsupportedBoundary = validateGeographicMarket(
    market("TX", {
      boundary: { type: "circle", center: [0, 0], radius: 10 },
    }),
  );

  assert.equal(invalidId.valid, false);
  assert.equal(invalidId.issues.includes("Market ID is invalid."), true);
  assert.equal(invalidTimeZone.valid, false);
  assert.equal(invalidTimeZone.issues.includes("IANA timezone is invalid."), true);
  assert.equal(unsupportedBoundary.valid, false);
  assert.equal(
    unsupportedBoundary.issues.includes("Geographic boundary is unsupported or invalid."),
    true,
  );
});

test("missing geocoding providers fail without inferring a market", async () => {
  const locationService = new BrowserLocationPermissionService(runtime().runtime);
  const location = await locationService.requestCurrentLocation({ initiatedByUser: true });
  const marketService = new CatalogDriverMarketService([market()]);

  const missing = await resolveAuthorizedDriverMarket(location, null, marketService);
  assert.deepEqual(missing, {
    status: "unresolved",
    reason: "geographic-provider-unavailable",
  });

  const unavailable = await resolveAuthorizedDriverMarket(
    location,
    new UnavailableGeocodingService(),
    marketService,
  );
  assert.deepEqual(unavailable, {
    status: "unresolved",
    reason: "geographic-provider-unavailable",
  });
});

test("verified geocoding resolves a market without retaining coordinates", async () => {
  const locationService = new BrowserLocationPermissionService(runtime().runtime);
  const location = await locationService.requestCurrentLocation({ initiatedByUser: true });
  let receivedCoordinates;
  const geocoder = {
    available: true,
    reverseGeocode: async (coordinates) => {
      receivedCoordinates = coordinates;
      return {
        stateCode: "TX",
        marketId: "tx-synthetic-market",
        providerName: "Synthetic Test Provider",
        datasetVersion: "synthetic-market-v1",
        verifiedAt: now,
      };
    },
  };
  const result = await resolveAuthorizedDriverMarket(
    location,
    geocoder,
    new CatalogDriverMarketService([market()], () => new Date(now)),
  );

  assert.equal(receivedCoordinates.latitude, 30.2672);
  assert.equal(result.status, "resolved");
  assert.equal(result.area.source, "authorized-location");
  assert.equal(result.area.preciseCoordinatesRetained, false);
  assert.equal("latitude" in result.area, false);
  assert.equal("longitude" in result.area, false);
});

test("verified provider results must match catalog state, market, and dataset", () => {
  const service = new CatalogDriverMarketService([market()], () => new Date(now));
  const missingMarket = service.resolveVerifiedArea({
    stateCode: "TX",
    marketId: "tx-missing-market",
    providerName: "Synthetic Test Provider",
    datasetVersion: "synthetic-market-v1",
    verifiedAt: now,
  });
  const wrongDataset = service.resolveVerifiedArea({
    stateCode: "TX",
    marketId: "tx-synthetic-market",
    providerName: "Synthetic Test Provider",
    datasetVersion: "wrong-version",
    verifiedAt: now,
  });

  assert.equal(missingMarket.status, "unresolved");
  assert.equal(missingMarket.reason, "market-not-found");
  assert.equal(wrongDataset.status, "unresolved");
  assert.equal(wrongDataset.reason, "market-dataset-mismatch");
});

test("location-aware queries cannot escape the authorized or manually selected area", () => {
  const marketService = new CatalogDriverMarketService([market()], () => new Date(now));
  const selected = marketService.selectManualMarket("TX", "tx-synthetic-market");
  assert.equal(selected.status, "resolved");

  const ready = createLocationAwareRankingQuery(selected.area, {
    stateCode: "TX",
    marketId: "tx-synthetic-market",
    zoneIds: ["zone-1", "zone-2"],
    analysisWindowDays: 60,
    datasetVersion: "synthetic-market-v1",
    asOf: now,
  });
  assert.equal(ready.status, "ready");
  assert.deepEqual(ready.query.zoneIds, ["zone-1", "zone-2"]);
  assert.equal("latitude" in ready.query, false);
  assert.equal("longitude" in ready.query, false);

  const wrongState = createLocationAwareRankingQuery(selected.area, {
    stateCode: "CA",
    marketId: "tx-synthetic-market",
    analysisWindowDays: 60,
    datasetVersion: "synthetic-market-v1",
    asOf: now,
  });
  const wrongMarket = createLocationAwareRankingQuery(selected.area, {
    stateCode: "TX",
    marketId: "different-market",
    analysisWindowDays: 60,
    datasetVersion: "synthetic-market-v1",
    asOf: now,
  });
  const invalidZones = createLocationAwareRankingQuery(selected.area, {
    stateCode: "TX",
    marketId: "tx-synthetic-market",
    zoneIds: ["zone-1", "zone-1"],
    analysisWindowDays: 60,
    datasetVersion: "synthetic-market-v1",
    asOf: now,
  });

  assert.equal(wrongState.status, "rejected");
  assert.equal(wrongState.reason, "unauthorized-area");
  assert.equal(wrongMarket.status, "rejected");
  assert.equal(wrongMarket.reason, "unauthorized-area");
  assert.equal(invalidZones.status, "rejected");
  assert.equal(invalidZones.reason, "invalid-zone-filter");
});
