import { useRef, useState, useEffect, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as turf from '@turf/turf';
import { createCircle, getDefaultRadius } from '../utils/radiusCalculator';

// Import geocoded data directly from JSON file
import geocodedData from '../data/geocoded.json';

// Import Earth texture
import earthTexture from '../assets/8k_earth_daymap.jpg';

const RADIUS_KM = getDefaultRadius();

function GlobeComponent() {
  const globeRef = useRef();
  const [countries, setCountries] = useState({ features: [] });

  // Convert geocoded.json data to places array
  const geocodedPlaces = useMemo(() => {
    if (!geocodedData.places) return [];
    
    return Object.entries(geocodedData.places).map(([name, coords]) => ({
      title: name,
      lat: coords.lat,
      lng: coords.lng,
      formattedAddress: coords.formattedAddress,
      geocoded: true
    }));
  }, []);

  // Load country GeoJSON data
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => setCountries(data))
      .catch(err => console.error('Error loading country data:', err));
  }, []);

  // Create circles for all geocoded places
  const scratchedCircles = useMemo(() => {
    return geocodedPlaces
      .filter(place => place.geocoded && place.lat && place.lng)
      .map(place => {
        const circle = createCircle(place.lat, place.lng, RADIUS_KM, 64);
        circle.properties = {
          title: place.title,
          formattedAddress: place.formattedAddress,
          lat: place.lat,
          lng: place.lng
        };
        return circle;
      });
  }, [geocodedPlaces]);

  // Create center points for the circles (for labels)
  const centerPoints = useMemo(() => {
    return geocodedPlaces
      .filter(place => place.geocoded && place.lat && place.lng)
      .map(place => ({
        lat: place.lat,
        lng: place.lng,
        title: place.title,
        formattedAddress: place.formattedAddress
      }));
  }, [geocodedPlaces]);

  // Check if a country polygon intersects with any scratched circle
  const isCountryScratched = useMemo(() => {
    if (scratchedCircles.length === 0) return () => false;

    // Create a quick lookup using bounding boxes
    const circleBounds = scratchedCircles.map(circle => ({
      circle,
      bbox: turf.bbox(circle)
    }));

    return (country) => {
      try {
        const countryFeature = turf.feature(country.geometry);
        const countryBbox = turf.bbox(countryFeature);

        for (const { circle, bbox } of circleBounds) {
          // Quick bounding box check first
          if (
            countryBbox[2] < bbox[0] || // country max X < circle min X
            countryBbox[0] > bbox[2] || // country min X > circle max X
            countryBbox[3] < bbox[1] || // country max Y < circle min Y
            countryBbox[1] > bbox[3]    // country min Y > circle max Y
          ) {
            continue; // No overlap possible
          }

          // Check if country centroid is within any circle
          const centroid = turf.centroid(countryFeature);
          if (turf.booleanPointInPolygon(centroid, circle)) {
            return true;
          }

          // Check if any circle center is within the country
          const circleCenter = turf.point([circle.properties.lng, circle.properties.lat]);
          if (turf.booleanPointInPolygon(circleCenter, countryFeature)) {
            return true;
          }

          // Check for intersection
          try {
            if (turf.booleanIntersects(countryFeature, circle)) {
              return true;
            }
          } catch (e) {
            // Fallback: distance-based check
            const distance = turf.distance(centroid, circleCenter, { units: 'kilometers' });
            if (distance <= RADIUS_KM * 1.5) {
              return true;
            }
          }
        }
        return false;
      } catch (err) {
        console.warn('Error checking country intersection:', err);
        return false;
      }
    };
  }, [scratchedCircles]);

  // Determine polygon color based on whether it intersects with any scratched circle
  const getPolygonColor = useMemo(() => {
    return (country) => {
      if (isCountryScratched(country)) {
        // Scratched: transparent to show the globe underneath
        return 'rgba(0, 0, 0, 0)';
      } else {
        // Unscratched: hide the globe
        return 'rgba(0, 0, 0, 1)';
      }
    };
  }, [isCountryScratched]);


  // Points data for location markers
  const pointsData = useMemo(() => {
    return centerPoints.map(point => ({
      lat: point.lat,
      lng: point.lng,
      size: 0.1,
      color: '#ff6b6b',
      title: point.title
    }));
  }, [centerPoints]);

  return (
    <div style={{ width: '100%', height: '100%', userSelect: 'none', position: 'relative' }}>
      {/* Stats overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '10px 15px',
        borderRadius: '8px',
        color: 'white',
        fontSize: '14px'
      }}>
        📍 {geocodedPlaces.length} places loaded
      </div>
      <Globe
        ref={globeRef}
        // Texture haute résolution 8K (8192x4096) - locale
        globeImageUrl={earthTexture}
        bumpImageUrl="https://unpkg.com/three-globe@2.41.12/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0, 0, 0, 0)"
        
        // Amélioration du rendu WebGL
        rendererConfig={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance'
        }}
        
        // Country polygons as dark overlay
        polygonsData={countries.features}
        polygonGeoJsonGeometry={d => d.geometry}
        polygonCapColor={getPolygonColor}
        polygonSideColor={getPolygonColor}
        polygonStrokeColor={() => 'rgba(255, 255, 255, 0.1)'}
        polygonAltitude={0.01}
        
        
        // Location points
        pointsData={pointsData}
        pointLat={d => d.lat}
        pointLng={d => d.lng}
        pointColor={d => d.color}
        pointAltitude={0}
        pointRadius={d => d.size}
        
        enablePointerInteraction={true}
      />
    </div>
  );
}

export default GlobeComponent;
