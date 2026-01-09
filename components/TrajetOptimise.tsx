'use client';

import { TrajetOptimise, PointTrajet } from '@/types';
import MapViewWrapper from './MapViewWrapper';
import { formaterAdresse } from '@/lib/utils';

interface TrajetOptimiseProps {
  trajet: TrajetOptimise;
  routeGeometry?: { lat: number; lng: number }[];
}

export default function TrajetOptimiseView({ trajet, routeGeometry }: TrajetOptimiseProps) {
  const formatDuree = (secondes: number): string => {
    const heures = Math.floor(secondes / 3600);
    const minutes = Math.floor((secondes % 3600) / 60);
    
    if (heures > 0) {
      return `${heures}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const formatDistance = (metres: number): string => {
    if (metres < 1000) {
      return `${Math.round(metres)} m`;
    }
    return `${(metres / 1000).toFixed(1)} km`;
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec informations générales */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Trajet optimisé</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Heure de départ</div>
            <div className="text-xl font-bold text-blue-600">{trajet.heureDepart}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Heure d'arrivée</div>
            <div className="text-xl font-bold text-orange-600">{trajet.heureArrivee}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Distance totale</div>
            <div className="text-xl font-bold text-green-600">{formatDistance(trajet.distance)}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Durée estimée</div>
            <div className="text-xl font-bold text-purple-600">{formatDuree(trajet.duree)}</div>
          </div>
        </div>
      </div>

      {/* Carte */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Carte du trajet</h3>
        <MapViewWrapper 
          points={trajet.points} 
          routeGeometry={routeGeometry}
        />
      </div>

      {/* Liste des points de passage */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Feuille de route</h3>
        
        <div className="space-y-4">
          {trajet.points.map((point, index) => {
            return (
              <div
                key={index}
                className="flex gap-4 p-4 rounded-lg border-2 bg-blue-50 border-blue-200"
              >
                {/* Numéro du point */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-blue-500">
                  {point.index}
                </div>

                {/* Informations du point */}
                <div className="flex-1">
                  <div className="font-bold text-lg text-gray-800">{point.label}</div>
                  <div className="text-gray-600 mt-1">{point.adresse}</div>
                  {point.contact?.telephone_parents && (
                    <div className="text-gray-500 mt-1 flex items-center gap-2">
                      <span>📞</span>
                      <span>{point.contact.telephone_parents}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
