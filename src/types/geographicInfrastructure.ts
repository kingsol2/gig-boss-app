import type { AnalysisWindowDays, USStateCode } from "./profitIntelligence.ts";

export type DriverLocationPermissionState =
  | "prompt"
  | "granted"
  | "denied"
  | "unavailable"
  | "revoked";

export interface LocationPermissionSnapshot {
  state: DriverLocationPermissionState;
  appAuthorized: boolean;
  checkedAt: string;
}

export interface PreciseDriverCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
}

export interface LocationRequestOptions {
  initiatedByUser: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
}

export type LocationRequestResult =
  | {
      status: "authorized";
      permission: LocationPermissionSnapshot;
      coordinates: PreciseDriverCoordinates;
    }
  | {
      status: "not-authorized";
      permission: LocationPermissionSnapshot;
      reason:
        | "explicit-user-action-required"
        | "permission-denied"
        | "permission-revoked"
        | "geolocation-unavailable"
        | "position-unavailable"
        | "request-timeout";
    };

export type GeoJsonPosition = readonly [longitude: number, latitude: number];
export type GeoJsonLinearRing = readonly GeoJsonPosition[];
export type GeoJsonPolygonCoordinates = readonly GeoJsonLinearRing[];
export type GeoJsonMultiPolygonCoordinates = readonly GeoJsonPolygonCoordinates[];

export type GeographicMarketBoundary =
  | {
      type: "provider-reference";
      providerBoundaryId: string;
      providerName: string;
      boundaryVersion: string;
    }
  | {
      type: "geojson";
      geometry:
        | { type: "Polygon"; coordinates: GeoJsonPolygonCoordinates }
        | { type: "MultiPolygon"; coordinates: GeoJsonMultiPolygonCoordinates };
    };

export interface GeographicSourceMetadata {
  providerName: string;
  datasetName: string;
  datasetVersion: string;
  retrievedAt: string;
  license?: string;
  sourceUrl?: string;
}

export interface GeographicMarket {
  stateCode: USStateCode;
  marketId: string;
  marketName: string;
  timeZone: string;
  boundary: GeographicMarketBoundary;
  datasetVersion: string;
  source: GeographicSourceMetadata;
}

export interface MarketValidationResult {
  valid: boolean;
  market?: GeographicMarket;
  issues: string[];
}

export interface VerifiedGeocodedArea {
  stateCode: USStateCode;
  marketId: string;
  providerName: string;
  datasetVersion: string;
  verifiedAt: string;
}

export interface AuthorizedDriverArea {
  source: "authorized-location" | "manual-selection";
  stateCode: USStateCode;
  marketId: string;
  marketName: string;
  timeZone: string;
  datasetVersion: string;
  selectedAt: string;
  preciseCoordinatesRetained: false;
}

export type DriverMarketResolutionResult =
  | { status: "resolved"; area: AuthorizedDriverArea }
  | {
      status: "unresolved";
      reason:
        | "location-not-authorized"
        | "geographic-provider-unavailable"
        | "geocoding-failed"
        | "market-not-found"
        | "market-dataset-mismatch"
        | "invalid-manual-selection";
    };

export interface LocationAwareRankingQuery {
  stateCode: USStateCode;
  marketId: string;
  zoneIds?: readonly string[];
  analysisWindowDays: AnalysisWindowDays;
  datasetVersion: string;
  asOf: string;
}

export interface LocationAwareRankingQueryInput {
  stateCode: USStateCode;
  marketId: string;
  zoneIds?: readonly string[];
  analysisWindowDays: AnalysisWindowDays;
  datasetVersion: string;
  asOf: string;
}

export type LocationAwareRankingQueryResult =
  | { status: "ready"; query: LocationAwareRankingQuery }
  | {
      status: "rejected";
      reason:
        | "unauthorized-area"
        | "invalid-analysis-window"
        | "invalid-dataset-version"
        | "invalid-as-of-date"
        | "invalid-zone-filter";
    };
