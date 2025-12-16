import { useState, useEffect, useCallback } from 'react';
import { parseCSV, extractPlaces, getSearchQuery } from '../utils/csvParser';
import { geocodePlaces, getGeocodeStats, clearGeocodeCache, getCachedResult } from '../utils/geocoder';
import { calculateTotalArea, getDefaultRadius } from '../utils/radiusCalculator';
import { getApiKey, hasApiKey } from '../config/api';

// Import CSV files statically (Vite will handle this)
const csvFiles = import.meta.glob('../data/*.csv', { as: 'raw', eager: true });

function DataLoader({ onDataLoaded, onLoadingChange }) {
  const [places, setPlaces] = useState([]);
  const [geocodedPlaces, setGeocodedPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalPlaces: 0,
    geocodedCount: 0,
    failedCount: 0,
    cachedCount: 0,
    totalArea: 0
  });
  const [showPanel, setShowPanel] = useState(true);

  // Load CSV files on mount
  useEffect(() => {
    loadCSVFiles();
  }, []);

  // Notify parent when geocoded places change
  useEffect(() => {
    if (onDataLoaded) {
      onDataLoaded(geocodedPlaces);
    }
  }, [geocodedPlaces, onDataLoaded]);

  // Notify parent of loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  // Load all CSV files from the data folder
  const loadCSVFiles = useCallback(() => {
    const allPlaces = [];
    
    for (const [path, content] of Object.entries(csvFiles)) {
      try {
        const csvData = parseCSV(content);
        const filePlaces = extractPlaces(csvData);
        const fileName = path.split('/').pop();
        
        // Add source file info to each place
        filePlaces.forEach(place => {
          place.sourceFile = fileName;
        });
        
        allPlaces.push(...filePlaces);
      } catch (err) {
        console.error(`Error parsing ${path}:`, err);
      }
    }

    setPlaces(allPlaces);
    setStats(prev => ({ ...prev, totalPlaces: allPlaces.length }));
    
    // Try to load cached geocoded data
    loadCachedGeocodedData(allPlaces);
  }, []);

  // Load cached geocoded data from geocoder's cache
  const loadCachedGeocodedData = useCallback((allPlaces) => {
    const cachedResults = [];
    
    for (const place of allPlaces) {
      const query = getSearchQuery(place);
      if (!query) continue;
      
      // Use the geocoder's cache function for consistency
      const cached = getCachedResult(query);
      if (cached) {
        cachedResults.push({
          ...place,
          lat: cached.lat,
          lng: cached.lng,
          formattedAddress: cached.formattedAddress,
          geocoded: true,
          cached: true
        });
      }
    }

    if (cachedResults.length > 0) {
      setGeocodedPlaces(cachedResults);
      updateStats(cachedResults);
    }
  }, []);

  // Update statistics
  const updateStats = useCallback((geocoded) => {
    const geocodedCount = geocoded.filter(p => p.geocoded).length;
    const failedCount = geocoded.filter(p => !p.geocoded).length;
    const cachedCount = geocoded.filter(p => p.cached).length;
    
    // Calculate total area
    const circles = geocoded
      .filter(p => p.geocoded)
      .map(p => ({ lat: p.lat, lng: p.lng }));
    
    // Approximate area (100km radius circles)
    const radius = getDefaultRadius();
    const circleArea = Math.PI * radius * radius;
    const totalArea = circles.length * circleArea;

    setStats({
      totalPlaces: places.length || geocoded.length,
      geocodedCount,
      failedCount,
      cachedCount,
      totalArea: Math.round(totalArea)
    });
  }, [places.length]);

  // Start geocoding process
  const startGeocoding = useCallback(async () => {
    const apiKey = getApiKey();
    
    if (!apiKey) {
      setError('Google Maps API key is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: places.length });

    try {
      const results = await geocodePlaces(
        places,
        apiKey,
        (current, total) => setProgress({ current, total }),
        getSearchQuery
      );

      // Results are automatically cached by geocodePlaces via cacheGeocodeResult

      setGeocodedPlaces(results);
      updateStats(results);
    } catch (err) {
      if (err.message === 'API_KEY_INVALID') {
        setError('Invalid API key. Please check your Google Maps API key.');
      } else {
        setError(`Geocoding error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [places, updateStats]);

  // Clear all cached data
  const clearCache = useCallback(() => {
    clearGeocodeCache();
    
    setGeocodedPlaces([]);
    setStats({
      totalPlaces: places.length,
      geocodedCount: 0,
      failedCount: 0,
      cachedCount: 0,
      totalArea: 0
    });
  }, [places.length]);

  const panelStyle = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    zIndex: 1000,
    background: 'rgba(0, 0, 0, 0.85)',
    padding: showPanel ? '20px' : '10px',
    borderRadius: '10px',
    color: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    maxWidth: '350px',
    maxHeight: showPanel ? '80vh' : 'auto',
    overflowY: 'auto',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  };

  const buttonStyle = {
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '10px',
    marginTop: '10px'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: '#666'
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    background: '#f44336'
  };

  if (!showPanel) {
    return (
      <div style={panelStyle}>
        <button
          onClick={() => setShowPanel(true)}
          style={{ ...buttonStyle, margin: 0, padding: '5px 15px' }}
        >
          ☰ Show Panel
        </button>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>🗺️ Scratch Map</h3>
        <button
          onClick={() => setShowPanel(false)}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}
        >
          ×
        </button>
      </div>

      {/* Statistics */}
      <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px' }}>
        <div style={{ marginBottom: '5px' }}>
          <strong>📍 Places loaded:</strong> {stats.totalPlaces}
        </div>
        <div style={{ marginBottom: '5px' }}>
          <strong>✅ Geocoded:</strong> {stats.geocodedCount}
          {stats.cachedCount > 0 && <span style={{ color: '#aaa' }}> ({stats.cachedCount} cached)</span>}
        </div>
        {stats.failedCount > 0 && (
          <div style={{ marginBottom: '5px', color: '#ff6b6b' }}>
            <strong>❌ Failed:</strong> {stats.failedCount}
          </div>
        )}
        <div>
          <strong>📐 Area scratched:</strong> ~{stats.totalArea.toLocaleString()} km²
        </div>
        <div style={{ marginTop: '5px', color: '#aaa', fontSize: '12px' }}>
          Radius: {getDefaultRadius()} km per location
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          background: 'rgba(244, 67, 54, 0.2)', 
          borderRadius: '5px',
          border: '1px solid #f44336'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* API Key Status */}
      {!hasApiKey() && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          background: 'rgba(255, 193, 7, 0.2)', 
          borderRadius: '5px',
          border: '1px solid #ffc107',
          fontSize: '12px'
        }}>
          ⚠️ <strong>API Key Required</strong><br/>
          Create a <code>.env.local</code> file with:<br/>
          <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '3px' }}>
            VITE_GOOGLE_MAPS_API_KEY=your_key_here
          </code>
        </div>
      )}

      {/* Progress bar */}
      {isLoading && (
        <div style={{ marginBottom: '15px' }}>
          <div style={{ marginBottom: '5px' }}>
            Geocoding: {progress.current} / {progress.total}
          </div>
          <div style={{ 
            width: '100%', 
            height: '10px', 
            background: 'rgba(255,255,255,0.2)', 
            borderRadius: '5px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${(progress.current / progress.total) * 100}%`, 
              height: '100%', 
              background: '#4CAF50',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <button
          onClick={startGeocoding}
          disabled={isLoading || places.length === 0}
          style={{
            ...buttonStyle,
            opacity: (isLoading || places.length === 0) ? 0.5 : 1,
            cursor: (isLoading || places.length === 0) ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? '⏳ Loading...' : '🔄 Geocode Places'}
        </button>
        
        <button
          onClick={loadCSVFiles}
          disabled={isLoading}
          style={secondaryButtonStyle}
        >
          ↻ Reload CSV
        </button>
        
        <button
          onClick={clearCache}
          disabled={isLoading}
          style={dangerButtonStyle}
        >
          🗑️ Clear Cache
        </button>
      </div>

      {/* CSV Files Info */}
      <div style={{ marginTop: '15px', fontSize: '12px', color: '#aaa' }}>
        <strong>CSV Files:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          {Object.keys(csvFiles).map(path => (
            <li key={path}>{path.split('/').pop()}</li>
          ))}
        </ul>
      </div>

      {/* Geocoded places list */}
      {geocodedPlaces.length > 0 && (
        <div style={{ marginTop: '15px' }}>
          <strong>Recent Places:</strong>
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto', 
            marginTop: '5px',
            fontSize: '12px'
          }}>
            {geocodedPlaces.slice(0, 20).map((place, index) => (
              <div 
                key={index} 
                style={{ 
                  padding: '5px', 
                  color: place.geocoded ? '#fff' : '#ff6b6b'
                }}
              >
                {place.geocoded ? '✓' : '✗'} {place.title}
                {place.geocoded && (
                  <span style={{ color: '#aaa', marginLeft: '5px' }}>
                    ({place.lat.toFixed(2)}, {place.lng.toFixed(2)})
                  </span>
                )}
              </div>
            ))}
            {geocodedPlaces.length > 20 && (
              <div style={{ padding: '5px', color: '#aaa' }}>
                ... and {geocodedPlaces.length - 20} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataLoader;
