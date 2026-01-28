/**
 * Geofence Utilities
 *
 * Implements accurate geofence calculations using the Haversine formula.
 * These utilities are used on both client and server for:
 * - Client: Quick UI feedback
 * - Server: Authoritative verification (anti-spoofing)
 */

// Earth's radius in meters
const EARTH_RADIUS_METERS = 6371000;

/**
 * Coordinates type
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Location with accuracy information
 */
export interface LocationWithAccuracy extends Coordinates {
  accuracy: number; // meters
  timestamp?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
}

/**
 * Geofence configuration
 */
export interface GeofenceConfig {
  center: Coordinates;
  radiusMeters: number;
}

/**
 * Result of a geofence check
 */
export interface GeofenceResult {
  isWithinRange: boolean;
  distanceMeters: number;
  radiusMeters: number;
  /** Margin of error based on GPS accuracy */
  marginOfError: number;
  /** Whether the result is definitive or uncertain */
  isDefinitive: boolean;
  /** Human-readable status */
  status: "in_range" | "out_of_range" | "uncertain";
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two coordinates using Haversine formula.
 *
 * The Haversine formula determines the great-circle distance between
 * two points on a sphere given their longitudes and latitudes.
 *
 * @returns Distance in meters
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const lat1 = toRadians(point1.latitude);
  const lat2 = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if a location is within a geofence.
 *
 * This performs a simple radius check and returns detailed results.
 *
 * @param location - The location to check
 * @param geofence - The geofence configuration
 */
export function checkGeofence(
  location: LocationWithAccuracy,
  geofence: GeofenceConfig
): GeofenceResult {
  const distance = calculateDistance(
    { latitude: location.latitude, longitude: location.longitude },
    geofence.center
  );

  const marginOfError = location.accuracy;

  // Definitive if the distance +/- accuracy is clearly inside or outside
  const isDefinitelyInside = distance + marginOfError <= geofence.radiusMeters;
  const isDefinitelyOutside = distance - marginOfError > geofence.radiusMeters;

  let status: "in_range" | "out_of_range" | "uncertain";
  let isWithinRange: boolean;

  if (isDefinitelyInside) {
    status = "in_range";
    isWithinRange = true;
  } else if (isDefinitelyOutside) {
    status = "out_of_range";
    isWithinRange = false;
  } else {
    // In the uncertain zone - we'll be lenient and allow
    status = "uncertain";
    isWithinRange = distance <= geofence.radiusMeters;
  }

  return {
    isWithinRange,
    distanceMeters: Math.round(distance),
    radiusMeters: geofence.radiusMeters,
    marginOfError: Math.round(marginOfError),
    isDefinitive: isDefinitelyInside || isDefinitelyOutside,
    status,
  };
}

/**
 * Check location against multiple geofences (for orgs with multiple locations).
 * Returns the closest geofence result.
 */
export function checkMultipleGeofences(
  location: LocationWithAccuracy,
  geofences: GeofenceConfig[]
): {
  closestResult: GeofenceResult;
  closestGeofence: GeofenceConfig;
  allResults: Array<{ geofence: GeofenceConfig; result: GeofenceResult }>;
} {
  if (geofences.length === 0) {
    throw new Error("At least one geofence is required");
  }

  const results = geofences.map((geofence) => ({
    geofence,
    result: checkGeofence(location, geofence),
  }));

  // Sort by distance
  results.sort((a, b) => a.result.distanceMeters - b.result.distanceMeters);

  // The closest geofence is the first one
  const closest = results[0];

  return {
    closestResult: closest.result,
    closestGeofence: closest.geofence,
    allResults: results,
  };
}

/**
 * Server-side verification of a client-reported location.
 *
 * This adds additional checks beyond the basic geofence check:
 * - Validates coordinate ranges
 * - Checks for obviously fake coordinates
 * - Considers accuracy limitations
 *
 * @param reportedLocation - Location reported by the client
 * @param geofence - The geofence to check against
 * @param options - Additional verification options
 */
export function serverVerifyLocation(
  reportedLocation: LocationWithAccuracy,
  geofence: GeofenceConfig,
  options: {
    maxAcceptableAccuracy?: number; // Max GPS accuracy to accept (meters)
    requireRecentTimestamp?: boolean;
    maxTimestampAge?: number; // Max age of timestamp in ms
  } = {}
): {
  verified: boolean;
  result: GeofenceResult;
  flags: string[];
  rejectionReason?: string;
} {
  const {
    maxAcceptableAccuracy = 100, // 100 meters max
    requireRecentTimestamp = true,
    maxTimestampAge = 60000, // 1 minute
  } = options;

  const flags: string[] = [];
  let rejectionReason: string | undefined;

  // Validate coordinate ranges
  if (
    reportedLocation.latitude < -90 ||
    reportedLocation.latitude > 90 ||
    reportedLocation.longitude < -180 ||
    reportedLocation.longitude > 180
  ) {
    return {
      verified: false,
      result: {
        isWithinRange: false,
        distanceMeters: 0,
        radiusMeters: geofence.radiusMeters,
        marginOfError: 0,
        isDefinitive: true,
        status: "out_of_range",
      },
      flags: ["invalid_coordinates"],
      rejectionReason: "Invalid coordinate values",
    };
  }

  // Check for suspiciously perfect coordinates (potential spoofing)
  const latDecimals = (reportedLocation.latitude.toString().split(".")[1] || "").length;
  const lonDecimals = (reportedLocation.longitude.toString().split(".")[1] || "").length;

  if (latDecimals < 4 || lonDecimals < 4) {
    flags.push("low_precision");
  }

  // Check accuracy
  if (reportedLocation.accuracy > maxAcceptableAccuracy) {
    flags.push("low_accuracy");
  }

  // Check timestamp if required
  if (requireRecentTimestamp && reportedLocation.timestamp) {
    const age = Date.now() - reportedLocation.timestamp;
    if (age > maxTimestampAge) {
      flags.push("stale_location");
    }
  }

  // Perform the actual geofence check
  const result = checkGeofence(reportedLocation, geofence);

  // Determine if we should verify based on result and flags
  let verified = result.isWithinRange;

  // If there are concerning flags, be stricter
  if (flags.includes("low_precision") && result.status === "uncertain") {
    verified = false;
    rejectionReason = "Location precision too low for uncertain result";
  }

  if (flags.includes("low_accuracy") && result.status === "uncertain") {
    verified = false;
    rejectionReason = "GPS accuracy too low for uncertain result";
  }

  if (result.isDefinitive && result.status === "in_range") {
    flags.push("high_confidence");
  }

  return {
    verified,
    result,
    flags,
    rejectionReason,
  };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Check if location data appears to be spoofed.
 *
 * Common spoofing indicators:
 * - Perfect/round coordinates
 * - Accuracy of exactly 0 or very low
 * - Impossible speed (if tracking over time)
 */
export function detectPotentialSpoofing(
  location: LocationWithAccuracy,
  previousLocation?: LocationWithAccuracy
): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check for suspiciously perfect coordinates
  const lat = location.latitude;
  const lon = location.longitude;

  // Check if coordinates are too "round" (potential manual entry)
  if (Number.isInteger(lat) || Number.isInteger(lon)) {
    reasons.push("Integer coordinates detected");
  }

  // Check for accuracy of exactly 0 (impossible for real GPS)
  if (location.accuracy === 0) {
    reasons.push("Zero accuracy reported");
  }

  // Check for impossibly high accuracy
  if (location.accuracy < 1) {
    reasons.push("Unrealistically high accuracy");
  }

  // If we have previous location, check for impossible movement
  if (previousLocation && previousLocation.timestamp && location.timestamp) {
    const distance = calculateDistance(previousLocation, location);
    const timeSeconds =
      (location.timestamp - previousLocation.timestamp) / 1000;

    if (timeSeconds > 0) {
      const speedMs = distance / timeSeconds;
      const speedKmh = speedMs * 3.6;

      // Max realistic speed (even on a plane) is ~900 km/h
      if (speedKmh > 1000) {
        reasons.push(`Impossible speed detected: ${Math.round(speedKmh)} km/h`);
      }
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Calculate the bearing between two points (direction in degrees).
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  let bearing = Math.atan2(y, x);
  bearing = bearing * (180 / Math.PI);
  bearing = (bearing + 360) % 360;

  return bearing;
}
