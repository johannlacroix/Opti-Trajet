/**
 * Service de géocodage utilisant l'API Adresse Data Gouv
 * Convertit une adresse en coordonnées géographiques
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Simplifie une adresse en gardant uniquement les éléments essentiels
 */
function simplifierAdresse(adresse: string): string {
  // Retirer les détails comme "Résidence", "Bâtiment", "Entrée", etc.
  // Garder uniquement la rue, code postal et ville
  const parties = adresse.split(',').map(p => p.trim());
  
  if (parties.length <= 3) {
    // Adresse déjà simple
    return adresse.trim();
  }
  
  // Chercher le code postal (format 5 chiffres) et la ville (dernière partie)
  const codePostalIndex = parties.findIndex(p => /^\d{5}$/.test(p));
  
  if (codePostalIndex !== -1 && codePostalIndex < parties.length - 1) {
    // On a trouvé un code postal, prendre la partie juste avant (la rue), le code postal et la ville
    const rueIndex = codePostalIndex > 0 ? codePostalIndex - 1 : 0;
    const partiesEssentielles = [
      parties[rueIndex], // Rue
      parties[codePostalIndex], // Code postal
      parties[parties.length - 1] // Ville
    ];
    return partiesEssentielles.join(', ').trim();
  }
  
  // Fallback : prendre la première partie (rue) et les 2 dernières (code postal et ville si format standard)
  if (parties.length >= 3) {
    return [parties[0], parties[parties.length - 2], parties[parties.length - 1]].join(', ').trim();
  }
  
  return adresse.trim();
}

export async function geocoderAdresse(adresse: string): Promise<Coordinates | null> {
  if (!adresse || adresse.length < 3) {
    return null;
  }

  try {
    // Essayer d'abord avec l'adresse complète
    let response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`
    );

    if (!response.ok) {
      throw new Error('Erreur lors du géocodage');
    }

    let data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const coordinates = data.features[0].geometry.coordinates;
      return {
        lat: coordinates[1],
        lng: coordinates[0],
      };
    }

    // Si pas de résultat avec l'adresse complète, essayer avec l'adresse simplifiée
    const adresseSimplifiee = simplifierAdresse(adresse);
    if (adresseSimplifiee !== adresse) {
      response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresseSimplifiee)}&limit=1`
      );

      if (response.ok) {
        data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const coordinates = data.features[0].geometry.coordinates;
          return {
            lat: coordinates[1],
            lng: coordinates[0],
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Erreur géocodage:', error);
    return null;
  }
}

/**
 * Géocode plusieurs adresses en parallèle
 */
export async function geocoderPlusieursAdresses(adresses: string[]): Promise<(Coordinates | null)[]> {
  const promises = adresses.map(adresse => geocoderAdresse(adresse));
  return Promise.all(promises);
}
