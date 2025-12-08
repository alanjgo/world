/**
 * Geocoding Module
 * Uses Google Maps Geocoding API to convert addresses to coordinates
 * Combines data from geocoded.json file with localStorage cache
 */

const GEOCODE_CACHE_KEY = 'scratch-map-geocode-cache';
const GEOCODE_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Import pre-loaded geocoded data from JSON file
import geocodedDataFile from '../data/geocoded.json';

/**
 * Get cached geocode results (merges JSON file data with localStorage)
 * @returns {Object} Cached results keyed by search query
 */
export function getGeocodeCache() {
  // Start with data from the JSON file
  const fileData = geocodedDataFile.places || {};
  
  // Merge with localStorage data (localStorage takes precedence for updates)
  try {
    const localData = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (localData) {
      const parsed = JSON.parse(localData);
      return { ...fileData, ...parsed };
    }
  } catch (error) {
    console.error('Error reading geocode cache:', error);
  }
  
  return fileData;
}

/**
 * Save geocode result to cache
 * @param {string} query - Search query
 * @param {Object} result - Geocode result with lat, lng
 */
export function cacheGeocodeResult(query, result) {
  try {
    const cache = getGeocodeCache();
    cache[query.toLowerCase()] = result;
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving to geocode cache:', error);
  }
}

/**
 * Get cached result for a query
 * @param {string} query - Search query
 * @returns {Object|null} Cached result or null
 */
export function getCachedResult(query) {
  const cache = getGeocodeCache();
  return cache[query.toLowerCase()] || null;
}

/**
 * Geocode a single address using Google Maps API
 * @param {string} address - Address or place name to geocode
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<Object|null>} Geocode result with lat, lng, or null on failure
 */
export async function geocodeAddress(address, apiKey) {
  if (!address || !apiKey) {
    console.error('Missing address or API key');
    return null;
  }

  // Check cache first
  const cached = getCachedResult(address);
  if (cached) {
    return cached;
  }

  try {
    const url = `${GEOCODE_API_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const result = {
        lat: location.lat,
        lng: location.lng,
        formattedAddress: data.results[0].formatted_address,
        placeId: data.results[0].place_id
      };
      
      // Cache the result
      cacheGeocodeResult(address, result);
      
      return result;
    } else if (data.status === 'ZERO_RESULTS') {
      console.warn(`No results for: ${address}`);
      return null;
    } else if (data.status === 'REQUEST_DENIED') {
      console.error('API request denied. Check your API key.');
      throw new Error('API_KEY_INVALID');
    } else if (data.status === 'OVER_QUERY_LIMIT') {
      console.error('API quota exceeded');
      throw new Error('QUOTA_EXCEEDED');
    } else {
      console.error(`Geocoding error: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding "${address}":`, error);
    throw error;
  }
}

/**
 * Geocode multiple places with rate limiting
 * @param {Array} places - Array of place objects with title and url
 * @param {string} apiKey - Google Maps API key
 * @param {Function} onProgress - Progress callback (current, total)
 * @param {Function} getSearchQuery - Function to get search query from place
 * @returns {Promise<Array>} Array of geocoded places with coordinates
 */
export async function geocodePlaces(places, apiKey, onProgress, getSearchQuery) {
  const results = [];
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const query = getSearchQuery(place);
    
    if (!query) {
      console.warn('No search query for place:', place);
      continue;
    }

    try {
      const coords = await geocodeAddress(query, apiKey);
      
      if (coords) {
        results.push({
          ...place,
          lat: coords.lat,
          lng: coords.lng,
          formattedAddress: coords.formattedAddress,
          geocoded: true
        });
      } else {
        results.push({
          ...place,
          geocoded: false,
          error: 'No results found'
        });
      }
    } catch (error) {
      if (error.message === 'API_KEY_INVALID') {
        throw error; // Stop processing on API key error
      }
      
      results.push({
        ...place,
        geocoded: false,
        error: error.message
      });
      
      if (error.message === 'QUOTA_EXCEEDED') {
        // Wait longer on quota exceeded
        await delay(2000);
      }
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, places.length);
    }

    // Rate limiting: wait 100ms between requests to avoid hitting limits
    // Skip delay if result was cached
    const cached = getCachedResult(query);
    if (!cached && i < places.length - 1) {
      await delay(100);
    }
  }

  return results;
}

/**
 * Clear the geocode cache
 */
export function clearGeocodeCache() {
  try {
    localStorage.removeItem(GEOCODE_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing geocode cache:', error);
  }
}

/**
 * Get statistics about the geocode cache
 * @returns {Object} Cache statistics
 */
export function getGeocodeStats() {
  const cache = getGeocodeCache();
  const entries = Object.keys(cache).length;
  return {
    totalCached: entries,
    cacheSize: JSON.stringify(cache).length
  };
}
