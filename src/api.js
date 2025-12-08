/**
 * API Configuration
 * Manages Google Maps API key and related settings
 */

/**
 * Get the Google Maps API key from environment variables
 * @returns {string|null} API key or null if not set
 */
export function getApiKey() {
  // Vite exposes env variables with VITE_ prefix
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || null;
}

/**
 * Check if an API key is configured
 * @returns {boolean} True if API key is available
 */
export function hasApiKey() {
  const key = getApiKey();
  return key && key.trim().length > 0;
}

/**
 * Validate API key format (basic check)
 * @param {string} key - API key to validate
 * @returns {boolean} True if format looks valid
 */
export function isValidKeyFormat(key) {
  if (!key || typeof key !== 'string') return false;
  // Google API keys are typically 39 characters
  return key.length >= 30 && key.length <= 50;
}

/**
 * Get instructions for setting up the API key
 * @returns {string} Setup instructions
 */
export function getApiKeyInstructions() {
  return `
To use the Google Maps Geocoding API:

1. Go to the Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the "Geocoding API" for your project
4. Create an API key in "Credentials"
5. Create a file named ".env.local" in the project root
6. Add the following line:
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
7. Restart the development server

Note: The Geocoding API has usage limits and may incur charges.
Check the pricing at: https://developers.google.com/maps/billing-and-pricing/pricing
  `.trim();
}
