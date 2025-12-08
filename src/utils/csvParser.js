/**
 * CSV Parser Module
 * Parses CSV files from the data folder and extracts place information
 */

/**
 * Parse CSV content into an array of objects
 * @param {string} csvContent - Raw CSV content
 * @returns {Array} Array of parsed rows
 */
export function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    data.push(row);
  }
  
  return data;
}

/**
 * Parse a single CSV line, handling quoted values
 * @param {string} line - CSV line
 * @returns {Array} Array of values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  
  return values;
}

/**
 * Extract place information from parsed CSV data
 * @param {Array} csvData - Parsed CSV data
 * @returns {Array} Array of place objects with title and URL
 */
export function extractPlaces(csvData) {
  return csvData
    .filter(row => {
      // Must have either a title or a URL
      const hasTitle = row.Titre && row.Titre.trim();
      const hasURL = row.URL && row.URL.includes('google.com/maps');
      return hasTitle || hasURL;
    })
    .map(row => ({
      title: row.Titre?.trim() || 'Unknown Place',
      url: row.URL?.trim() || '',
      note: row.Note?.trim() || '',
      tags: row.Tags?.trim() || '',
      comment: row.Commentaire?.trim() || ''
    }));
}

/**
 * Extract place ID from Google Maps URL
 * @param {string} url - Google Maps URL
 * @returns {string|null} Place ID or null if not found
 */
export function extractPlaceIdFromURL(url) {
  if (!url) return null;
  
  // Pattern: !1s0x...:0x...
  const placeIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  if (placeIdMatch) {
    return placeIdMatch[1];
  }
  
  return null;
}

/**
 * Extract place name from Google Maps URL
 * @param {string} url - Google Maps URL
 * @returns {string|null} Place name or null if not found
 */
export function extractPlaceNameFromURL(url) {
  if (!url) return null;
  
  // Pattern: /place/Place+Name/
  const placeMatch = url.match(/\/place\/([^\/]+)\//);
  if (placeMatch) {
    // Decode URL-encoded characters and replace + with spaces
    return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
  }
  
  return null;
}

/**
 * Load and parse a CSV file
 * @param {string} filePath - Path to CSV file (relative to public or src)
 * @returns {Promise<Array>} Promise resolving to array of places
 */
export async function loadCSVFile(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
    }
    const content = await response.text();
    const csvData = parseCSV(content);
    return extractPlaces(csvData);
  } catch (error) {
    console.error(`Error loading CSV file ${filePath}:`, error);
    return [];
  }
}

/**
 * Get search query for geocoding from a place
 * @param {Object} place - Place object with title and url
 * @returns {string} Search query for geocoding
 */
export function getSearchQuery(place) {
  // Try to extract name from URL first (more reliable)
  const urlName = extractPlaceNameFromURL(place.url);
  if (urlName && urlName !== '') {
    return urlName;
  }
  
  // Fall back to title
  if (place.title && place.title !== 'Unknown Place') {
    return place.title;
  }
  
  return null;
}
