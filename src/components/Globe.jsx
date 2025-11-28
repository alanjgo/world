import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Globe  from 'react-globe.gl';
import * as turf from '@turf/turf';

const STORAGE_KEY = 'scratch-map-scratched-countries';

function GlobeComponent() {
  const globeRef = useRef();
  const [countries, setCountries] = useState({ features: [] });
  const [scratchedCountries, setScratchedCountries] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // Load scratched countries from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setScratchedCountries(new Set(parsed));
      }
    } catch (err) {
      console.error('Error loading scratched countries:', err);
    }
  }, []);

  // Save scratched countries to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...scratchedCountries]));
    } catch (err) {
      console.error('Error saving scratched countries:', err);
    }
  }, [scratchedCountries]);

  // Get unique country identifier
  const getCountryId = useCallback((country) => {
    return country.properties.name || 
           country.properties.NAME || 
           country.properties.ADMIN || 
           country.properties.NAME_EN || 
           'unknown';
  }, []);

  // Handle mouse down - start dragging
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Handle mouse up - stop dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle polygon hover - scratch country when dragging
  const handlePolygonHover = useCallback((polygon, prevPolygon, event) => {
    if (isDragging && polygon) {
      const countryId = getCountryId(polygon);
      setScratchedCountries(prev => {
        const newSet = new Set(prev);
        newSet.add(countryId);
        return newSet;
      });
    }
  }, [isDragging, getCountryId]);

  // Handle polygon click - also scratch on click
  const handlePolygonClick = useCallback((polygon, event) => {
    if (polygon) {
      const countryId = getCountryId(polygon);
      setScratchedCountries(prev => {
        const newSet = new Set(prev);
        newSet.add(countryId);
        return newSet;
      });
    }
  }, [getCountryId]);

  useEffect(() => {
    // Charger les données GeoJSON des pays
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => setCountries(data))
      .catch(err => console.error('Erreur lors du chargement des données:', err));
  }, []);

  // Determine polygon color based on scratched state
  const getPolygonColor = useCallback((country) => {
    const countryId = getCountryId(country);
    const isScratched = scratchedCountries.has(countryId);
    
    if (isScratched) {
      // Scratched: transparent to show the globe underneath
      return 'rgba(0, 0, 0, 0)';
    } else {
      // Unscratched: completely opaque dark overlay to hide the globe
      return 'rgba(0, 0, 0, 1)';
    }
  }, [scratchedCountries, getCountryId]);

  // Create labels data for scratched countries
  const labelsData = useMemo(() => {
    return countries.features
      .filter(country => {
        const countryId = getCountryId(country);
        return scratchedCountries.has(countryId);
      })
      .map(country => {
        try {
          // Calculate centroid of the polygon
          const feature = turf.feature(country.geometry);
          const centroid = turf.centroid(feature);
          const [lng, lat] = centroid.geometry.coordinates;
          
          return {
            lat,
            lng,
            text: country.properties.name || 
                  country.properties.NAME || 
                  country.properties.ADMIN || 
                  country.properties.NAME_EN || 
                  'Unknown',
            countryId: getCountryId(country)
          };
        } catch (err) {
          // Fallback: try to get coordinates from the geometry
          const coords = country.geometry.coordinates;
          let lat, lng;
          
          if (country.geometry.type === 'Polygon' && coords[0] && coords[0].length > 0) {
            // Get first coordinate as fallback
            [lng, lat] = coords[0][0];
          } else if (country.geometry.type === 'MultiPolygon' && coords[0] && coords[0][0] && coords[0][0].length > 0) {
            [lng, lat] = coords[0][0][0];
          } else {
            return null;
          }
          
          return {
            lat,
            lng,
            text: country.properties.name || 
                  country.properties.NAME || 
                  country.properties.ADMIN || 
                  country.properties.NAME_EN || 
                  'Unknown',
            countryId: getCountryId(country)
          };
        }
      })
      .filter(label => label !== null);
  }, [countries.features, scratchedCountries, getCountryId]);

  return (
    <div 
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ width: '100%', height: '100%', userSelect: 'none' }}
    >
      <Globe
        ref={globeRef}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0, 0, 0, 0)"
        polygonsData={countries.features}
        polygonGeoJsonGeometry={d => d.geometry}
        polygonCapColor={getPolygonColor}
        polygonSideColor={getPolygonColor}
        polygonStrokeColor={() => 'rgba(255, 255, 255, 0.3)'}
        polygonAltitude={0.01}
        onPolygonHover={handlePolygonHover}
        onPolygonClick={handlePolygonClick}
        enablePointerInteraction={true}
        labelsData={labelsData}
        labelLat={d => d.lat}
        labelLng={d => d.lng}
        labelText={d => d.text}
        labelColor={() => 'rgba(255, 255, 255, 0.9)'}
        labelSize={1}
        labelAltitude={0.02}
        labelIncludeDot={false}
      />
    </div>
  );
}

export default GlobeComponent;

