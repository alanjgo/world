/**
 * Radius Calculation Module
 * Creates 100km radius circles around geocoded addresses using Turf.js
 */

import * as turf from '@turf/turf';

const RADIUS_KM = 100;
const RADIUS_CACHE_KEY = 'scratch-map-radius-circles';

/**
 * Create a circular polygon around a point with given radius
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radiusKm - Radius in kilometers (default 100)
 * @param {number} steps - Number of steps for circle approximation (default 64)
 * @returns {Object} GeoJSON Feature (Polygon)
 */
export function createCircle(lat, lng, radiusKm = RADIUS_KM, steps = 64) {
  const center = turf.point([lng, lat]);
  const circle = turf.circle(center, radiusKm, { steps, units: 'kilometers' });
  return circle;
}

/**
 * Create circles for all geocoded places
 * @param {Array} geocodedPlaces - Array of places with lat/lng
 * @returns {Object} GeoJSON FeatureCollection of circles
 */
export function createCirclesForPlaces(geocodedPlaces) {
  const circles = geocodedPlaces
    .filter(place => place.geocoded && place.lat && place.lng)
    .map(place => {
      const circle = createCircle(place.lat, place.lng);
      circle.properties = {
        title: place.title,
        formattedAddress: place.formattedAddress
      };
      return circle;
    });

  return turf.featureCollection(circles);
}

/**
 * Merge overlapping circles into a single polygon
 * @param {Object} circlesCollection - GeoJSON FeatureCollection of circles
 * @returns {Object} GeoJSON Feature or FeatureCollection of merged polygons
 */
export function mergeCircles(circlesCollection) {
  if (!circlesCollection.features || circlesCollection.features.length === 0) {
    return turf.featureCollection([]);
  }

  if (circlesCollection.features.length === 1) {
    return circlesCollection;
  }

  try {
    // Union all circles together
    let merged = circlesCollection.features[0];
    for (let i = 1; i < circlesCollection.features.length; i++) {
      try {
        merged = turf.union(turf.featureCollection([merged, circlesCollection.features[i]]));
      } catch (e) {
        // If union fails, keep separate
        console.warn('Could not merge circle:', e);
      }
    }
    return turf.featureCollection([merged]);
  } catch (error) {
    console.error('Error merging circles:', error);
    return circlesCollection;
  }
}

/**
 * Check if a point is within any of the circles
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} circlesCollection - GeoJSON FeatureCollection of circles
 * @returns {boolean} True if point is within any circle
 */
export function isPointInCircles(lat, lng, circlesCollection) {
  if (!circlesCollection.features || circlesCollection.features.length === 0) {
    return false;
  }

  const point = turf.point([lng, lat]);
  
  for (const circle of circlesCollection.features) {
    if (turf.booleanPointInPolygon(point, circle)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a point is within a certain distance of any center point
 * This is faster than polygon checks for simple distance calculations
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} centers - Array of {lat, lng} center points
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} True if point is within radius of any center
 */
export function isPointWithinRadius(lat, lng, centers, radiusKm = RADIUS_KM) {
  const point = turf.point([lng, lat]);
  
  for (const center of centers) {
    const centerPoint = turf.point([center.lng, center.lat]);
    const distance = turf.distance(point, centerPoint, { units: 'kilometers' });
    if (distance <= radiusKm) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the minimum distance from a point to any center
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} centers - Array of {lat, lng} center points
 * @returns {number} Minimum distance in kilometers, or Infinity if no centers
 */
export function getMinDistanceToCenter(lat, lng, centers) {
  if (!centers || centers.length === 0) {
    return Infinity;
  }

  const point = turf.point([lng, lat]);
  let minDistance = Infinity;
  
  for (const center of centers) {
    const centerPoint = turf.point([center.lng, center.lat]);
    const distance = turf.distance(point, centerPoint, { units: 'kilometers' });
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
}

/**
 * Save radius circles to localStorage cache
 * @param {Object} circlesCollection - GeoJSON FeatureCollection
 */
export function saveCirclesToCache(circlesCollection) {
  try {
    localStorage.setItem(RADIUS_CACHE_KEY, JSON.stringify(circlesCollection));
  } catch (error) {
    console.error('Error saving circles to cache:', error);
  }
}

/**
 * Load radius circles from localStorage cache
 * @returns {Object|null} GeoJSON FeatureCollection or null
 */
export function loadCirclesFromCache() {
  try {
    const cached = localStorage.getItem(RADIUS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error loading circles from cache:', error);
    return null;
  }
}

/**
 * Clear the radius circles cache
 */
export function clearCirclesCache() {
  try {
    localStorage.removeItem(RADIUS_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing circles cache:', error);
  }
}

/**
 * Calculate total scratched area in square kilometers
 * @param {Object} circlesCollection - GeoJSON FeatureCollection of circles
 * @returns {number} Total area in square kilometers
 */
export function calculateTotalArea(circlesCollection) {
  if (!circlesCollection.features || circlesCollection.features.length === 0) {
    return 0;
  }

  try {
    // Merge circles first to avoid counting overlaps
    const merged = mergeCircles(circlesCollection);
    let totalArea = 0;
    
    for (const feature of merged.features) {
      totalArea += turf.area(feature) / 1000000; // Convert m² to km²
    }
    
    return totalArea;
  } catch (error) {
    console.error('Error calculating area:', error);
    // Fallback: calculate individual circle areas
    return circlesCollection.features.length * Math.PI * RADIUS_KM * RADIUS_KM;
  }
}

/**
 * Get the default radius in kilometers
 * @returns {number} Radius in kilometers
 */
export function getDefaultRadius() {
  return RADIUS_KM;
}
