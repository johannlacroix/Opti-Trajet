'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PointTrajet } from '@/types';
import { Coordinates } from '@/lib/geocoding';

// Fix pour les icônes Leaflet avec Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewProps {
  points: PointTrajet[];
  routeGeometry?: Coordinates[];
  center?: Coordinates;
  zoom?: number;
}

// Composant pour ajuster la vue de la carte
function MapBounds({ points }: { points: PointTrajet[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(
        points.map(p => [p.coordinates.lat, p.coordinates.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points]);

  return null;
}

export default function MapView({ points, routeGeometry, center, zoom = 13 }: MapViewProps) {
  const mapCenter = center || (points.length > 0 
    ? points[0].coordinates 
    : { lat: 44.8378, lng: -0.5792 }); // Bordeaux par défaut

  // Créer des icônes personnalisées numérotées
  const createNumberedIcon = (number: number) => {
    return L.divIcon({
      className: 'custom-numbered-marker',
      html: `
        <div style="
          background-color: #3b82f6;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${number}
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-300">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds points={points} />
        
        {/* Tracer la route si disponible */}
        {routeGeometry && routeGeometry.length > 1 && (
          <Polyline
            positions={routeGeometry.map(coord => [coord.lat, coord.lng] as [number, number])}
            color="#3b82f6"
            weight={4}
            opacity={0.7}
          />
        )}

        {/* Marqueurs pour chaque point */}
        {points.map((point, index) => {
          return (
            <Marker
              key={index}
              position={[point.coordinates.lat, point.coordinates.lng]}
              icon={createNumberedIcon(point.index)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold">{point.label}</div>
                  <div className="text-gray-600 mt-1">{point.adresse}</div>
                  {point.contact?.telephone_parents && (
                    <div className="text-gray-500 mt-1">📞 {point.contact.telephone_parents}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
