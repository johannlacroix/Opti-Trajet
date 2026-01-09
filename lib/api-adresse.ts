import { AdresseAutocomplete } from '@/types';

/**
 * Service d'autocomplétion d'adresses utilisant l'API Adresse Data Gouv
 * (Service gratuit du gouvernement français)
 */
export async function rechercherAdresses(query: string): Promise<AdresseAutocomplete[]> {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la recherche d\'adresses');
    }

    const data = await response.json();
    
    return data.features.map((feature: any) => ({
      label: feature.properties.label,
      value: feature.properties.label,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
      },
    }));
  } catch (error) {
    console.error('Erreur API adresse:', error);
    return [];
  }
}
