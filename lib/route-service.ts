import { Coordinates } from './geocoding';

/**
 * Service de calcul d'itinéraire utilisant OpenRouteService (gratuit)
 * Documentation: https://openrouteservice.org/dev/#/api-docs
 */
export interface RoutePoint {
  coordinates: Coordinates;
  label: string;
}

export interface RouteSegment {
  distance: number; // en mètres
  duration: number; // en secondes
}

export interface RouteResult {
  geometry: Coordinates[];
  distance: number; // en mètres
  duration: number; // en secondes
  segments: RouteSegment[];
}

/**
 * Calcule un itinéraire simple entre deux points
 * Utilise l'API OpenRouteService (gratuite, pas besoin de clé API pour les requêtes limitées)
 */
export async function calculerItineraire(
  depart: Coordinates,
  arrivee: Coordinates
): Promise<RouteResult | null> {
  try {
    // OpenRouteService nécessite [lng, lat] et non [lat, lng]
    const body = {
      coordinates: [
        [depart.lng, depart.lat],
        [arrivee.lng, arrivee.lat]
      ],
      profile: 'driving-car',
      format: 'json'
    };

    const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE1YzNhZDc2OTQ5MTQ3YTJiZmJiMWJiNDgxNDVlZjc2IiwiaCI6Im11cm11cjY0In0=';
    
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      // Si erreur 403, on essaie avec une méthode alternative ou on retourne null
      if (response.status === 403) {
        console.warn('OpenRouteService nécessite une clé API pour les requêtes fréquentes');
        return null;
      }
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      
      // Gérer la géométrie (peut être encodée ou un tableau de coordonnées)
      let geometry: Coordinates[] = [];
      
      if (route.geometry) {
        if (Array.isArray(route.geometry.coordinates)) {
          // Format tableau de coordonnées
          geometry = route.geometry.coordinates.map((coord: number[]) => ({
            lng: coord[0],
            lat: coord[1]
          }));
        } else if (typeof route.geometry === 'string') {
          // Format encodé (polyline) - on retourne un tableau vide pour l'instant
          // On pourrait décoder le polyline avec une bibliothèque, mais pour l'instant on continue sans géométrie
          console.warn('Géométrie encodée détectée, non décodée');
          geometry = [];
        }
      }

      // Vérifier que summary existe
      if (!route.summary) {
        console.error('Résumé de route manquant:', route);
        return null;
      }

      return {
        geometry: geometry.length > 0 ? geometry : undefined,
        distance: route.summary.distance || 0,
        duration: route.summary.duration || 0,
        segments: route.segments?.map((seg: any) => ({
          distance: seg.distance || 0,
          duration: seg.duration || 0
        })) || []
      };
    }

    return null;
  } catch (error) {
    console.error('Erreur calcul itinéraire:', error);
    return null;
  }
}

/**
 * Calcule une matrice de distances entre plusieurs points
 * Utile pour l'optimisation TSP
 */
export async function calculerMatriceDistances(
  points: Coordinates[]
): Promise<number[][] | null> {
  try {
    const coordinates = points.map(p => [p.lng, p.lat]);
    
    const body = {
      locations: coordinates,
      profile: 'driving-car',
      metrics: ['distance'],
      units: 'm'
    };

    const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE1YzNhZDc2OTQ5MTQ3YTJiZmJiMWJiNDgxNDVlZjc2IiwiaCI6Im11cm11cjY0In0=';
    
    const response = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn('Impossible de calculer la matrice de distances');
      return null;
    }

    const data = await response.json();
    
    if (data.distances) {
      return data.distances;
    }

    return null;
  } catch (error) {
    console.error('Erreur calcul matrice:', error);
    return null;
  }
}

/**
 * Calcule une matrice de durées entre plusieurs points
 * Utile pour l'optimisation TSP basée sur les durées (trafic)
 */
export async function calculerMatriceDurees(
  points: Coordinates[]
): Promise<number[][] | null> {
  try {
    const coordinates = points.map(p => [p.lng, p.lat]);
    
    const body = {
      locations: coordinates,
      profile: 'driving-car',
      metrics: ['duration'],
    };

    const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE1YzNhZDc2OTQ5MTQ3YTJiZmJiMWJiNDgxNDVlZjc2IiwiaCI6Im11cm11cjY0In0=';
    
    const response = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn('Impossible de calculer la matrice de durées');
      return null;
    }

    const data = await response.json();
    
    if (data.durations) {
      return data.durations;
    }

    return null;
  } catch (error) {
    console.error('Erreur calcul matrice durées:', error);
    return null;
  }
}
