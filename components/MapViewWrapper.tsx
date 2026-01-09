'use client';

import dynamic from 'next/dynamic';
import { PointTrajet } from '@/types';
import { Coordinates } from '@/lib/geocoding';

// Charger MapView dynamiquement pour éviter les erreurs SSR avec Leaflet
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
      <p className="text-gray-500">Chargement de la carte...</p>
    </div>
  ),
});

interface MapViewWrapperProps {
  points: PointTrajet[];
  routeGeometry?: Coordinates[];
  center?: Coordinates;
  zoom?: number;
}

export default function MapViewWrapper(props: MapViewWrapperProps) {
  return <MapView {...props} />;
}
