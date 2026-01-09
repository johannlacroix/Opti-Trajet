import { Contact, Etablissement, PointTrajet, TrajetOptimise } from '@/types';
import { geocoderPlusieursAdresses, Coordinates } from './geocoding';
import { resoudreTSP } from './tsp-solver';
import { calculerItineraire, calculerMatriceDurees } from './route-service';
import { formaterAdresse } from './utils';

interface TrajetData {
  heureDepart: string;
  heureArrivee: string;
  pointDepart: string;
  pointArrivee: string;
  contactsSelectionnes: Contact[];
  sensTrajet?: 'institut-domiciles' | 'domiciles-institut';
  optimiserPourEnfants?: boolean;
}

/**
 * Calcule la distance entre deux points (formule de Haversine simplifiée pour petites distances)
 * Ou utilise la matrice de durées si disponible
 */
async function calculerDistanceDepuisPoint(
  pointDepart: Coordinates,
  pointArrivee: Coordinates,
  matriceDurees?: number[][],
  indexDepart?: number,
  indexArrivee?: number
): Promise<number> {
  // Si on a une matrice et les indices, utiliser la matrice (plus précise)
  if (matriceDurees && indexDepart !== undefined && indexArrivee !== undefined) {
    return matriceDurees[indexDepart][indexArrivee];
  }
  
  // Sinon, calculer la distance euclidienne simplifiée (approximation)
  const R = 6371000; // Rayon de la Terre en mètres
  const lat1 = pointDepart.lat * Math.PI / 180;
  const lat2 = pointArrivee.lat * Math.PI / 180;
  const deltaLat = (pointArrivee.lat - pointDepart.lat) * Math.PI / 180;
  const deltaLng = (pointArrivee.lng - pointDepart.lng) * Math.PI / 180;
  
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Optimise un trajet pour minimiser le temps de chaque enfant
 * Trie les domiciles par distance depuis le point de départ
 * Retourne les indices dans coords dans l'ordre optimisé
 */
async function optimiserPourEnfants(
  coords: Coordinates[],
  contactsAvecCoords: Array<{ contact: Contact; coordinates: Coordinates }>,
  sensTrajet: 'institut-domiciles' | 'domiciles-institut',
  pointDepartIndex: number
): Promise<number[]> {
  const pointDepart = coords[pointDepartIndex];
  
  // Calculer une matrice de durées pour obtenir les distances réelles depuis le point de départ
  const tousPoints = [pointDepart, ...contactsAvecCoords.map(c => c.coordinates)];
  const matriceDurees = await calculerMatriceDurees(tousPoints);
  
  if (!matriceDurees) {
    // Si on ne peut pas calculer la matrice, retourner l'ordre original
    return [pointDepartIndex, ...contactsAvecCoords.map((_, i) => i + pointDepartIndex + 1)];
  }
  
  // Créer un tableau avec les indices dans coords et les distances depuis le point de départ
  // Pour "institut-domiciles": coords = [institut(0), domicile1(1), domicile2(2), ...]
  // Pour "domiciles-institut": coords = [domicile_depart(0), domicile1(1), ..., institut(n)]
  const enfantsAvecDistance = contactsAvecCoords.map((data, contactIndex) => {
    // L'index dans coords dépend du sens du trajet
    let indexDansCoords: number;
    if (sensTrajet === 'institut-domiciles') {
      // coords[0] = institut, coords[1..n] = domiciles
      indexDansCoords = contactIndex + 1; // +1 car index 0 est l'institut
    } else {
      // coords[0] = domicile départ, coords[1..n-1] = autres domiciles, coords[n] = institut
      indexDansCoords = contactIndex + 1; // +1 car index 0 est le domicile départ
    }
    
    const distanceDepuisDepart = matriceDurees[0][contactIndex + 1]; // index 0 = départ dans matrice, contactIndex+1 = enfant
    return {
      indexDansCoords,
      distance: distanceDepuisDepart,
      contactData: data,
    };
  });
  
  // Trier selon le sens du trajet
  if (sensTrajet === 'institut-domiciles') {
    // Déposer du plus proche au plus loin (minimiser le temps de chaque enfant)
    enfantsAvecDistance.sort((a, b) => a.distance - b.distance);
  } else {
    // Récupérer du plus loin au plus proche (minimiser le temps de chaque enfant)
    enfantsAvecDistance.sort((a, b) => b.distance - a.distance);
  }
  
  // Construire l'ordre final : départ + enfants triés (indices dans coords)
  return [pointDepartIndex, ...enfantsAvecDistance.map(e => e.indexDansCoords)];
}

/**
 * Optimise un trajet en calculant l'ordre optimal des points de passage
 */
export async function optimiserTrajet(
  trajetData: TrajetData,
  etablissement: Etablissement
): Promise<{ trajet: TrajetOptimise; routeGeometry?: Coordinates[] } | null> {
  try {
    // 1. Construire la liste des adresses à visiter
    // Pour "Domiciles → Institut" : départ = premier domicile, intermédiaires = autres domiciles, arrivée = Institut
    // Pour "Institut → Domiciles" : départ = Institut, intermédiaires = tous les domiciles, arrivée = dernier domicile (après optimisation)
    
    const adresses: string[] = [trajetData.pointDepart];
    
    // Ajouter les adresses des contacts (ce sont les points intermédiaires)
    if (trajetData.sensTrajet === 'institut-domiciles') {
      // Pour "Institut → Domiciles", tous les domiciles des contacts sont des destinations
      trajetData.contactsSelectionnes.forEach(contact => {
        adresses.push(formaterAdresse(contact.adresse));
      });
    } else {
      // Pour "Domiciles → Institut", on exclut le contact du point de départ
      trajetData.contactsSelectionnes.forEach(contact => {
        const adresseContact = formaterAdresse(contact.adresse);
        if (adresseContact !== trajetData.pointDepart) {
          adresses.push(adresseContact);
        }
      });
      // L'arrivée est l'Institut
      if (trajetData.pointArrivee) {
        adresses.push(trajetData.pointArrivee);
      }
    }

    // 2. Géocoder toutes les adresses
    const coordinates = await geocoderPlusieursAdresses(adresses);
    
    // Vérifier que toutes les adresses ont été géocodées
    const nullIndex = coordinates.findIndex(coord => coord === null);
    if (nullIndex !== -1) {
      const adresseErronee = adresses[nullIndex];
      // Trouver quel contact correspond à cette adresse pour un message d'erreur plus clair
      let contactErrone = trajetData.contactsSelectionnes.find(c => 
        formaterAdresse(c.adresse) === adresseErronee
      );
      
      if (contactErrone) {
        const nomContact = contactErrone.prenom 
          ? `${contactErrone.prenom} ${contactErrone.nom}` 
          : contactErrone.nom;
        throw new Error(
          `Impossible de trouver les coordonnées pour l'adresse de ${nomContact}: ${adresseErronee}\n\n` +
          `Suggestion: Vérifiez que l'adresse est correcte ou simplifiez-la (rue, code postal, ville).`
        );
      } else {
        throw new Error(
          `Impossible de trouver les coordonnées pour l'adresse: ${adresseErronee}\n\n` +
          `Suggestion: Vérifiez que l'adresse est correcte.`
        );
      }
    }

    const coords = coordinates as Coordinates[];

    // 3. Construire les points de trajet
    let contactsAvecCoords: Array<{ contact: Contact; coordinates: Coordinates }>;
    
    if (trajetData.sensTrajet === 'institut-domiciles') {
      // Pour "Institut → Domiciles", tous les contacts sont des destinations
      contactsAvecCoords = trajetData.contactsSelectionnes.map((contact, index) => ({
        contact,
        coordinates: coords[index + 1], // +1 car le premier est l'Institut
      }));
    } else {
      // Pour "Domiciles → Institut", exclure le contact du point de départ
      contactsAvecCoords = trajetData.contactsSelectionnes
        .filter(contact => {
          const adresseContact = formaterAdresse(contact.adresse);
          return adresseContact !== trajetData.pointDepart;
        })
        .map((contact, index) => {
          const adresseContact = formaterAdresse(contact.adresse);
          const adresseIndex = adresses.findIndex((addr, idx) => idx > 0 && addr === adresseContact && idx < adresses.length - 1);
          return {
            contact,
            coordinates: adresseIndex !== -1 ? coords[adresseIndex] : coords[index + 1],
          };
        });
    }

    // Déterminer les labels pour le départ et l'arrivée
    const labelDepart = trajetData.sensTrajet === 'domiciles-institut' 
      ? 'Départ (domicile)' 
      : etablissement.nom;
    const labelArrivee = trajetData.sensTrajet === 'domiciles-institut'
      ? etablissement.nom
      : 'Arrivée (domicile)';

    // 4. Si on a des contacts, optimiser l'ordre
    let pointsOptimises: PointTrajet[];
    
    if (contactsAvecCoords.length === 0) {
      // Pas de contacts intermédiaires, trajet simple
      if (trajetData.sensTrajet === 'institut-domiciles') {
        throw new Error('Pour "Institut → Domiciles", vous devez sélectionner au moins un contact');
      }
      pointsOptimises = [
        {
          label: labelDepart,
          adresse: trajetData.pointDepart,
          coordinates: coords[0],
          index: 0,
        },
        {
          label: labelArrivee,
          adresse: trajetData.pointArrivee,
          coordinates: coords[coords.length - 1],
          index: 1,
        },
      ];
    } else if (contactsAvecCoords.length === 1) {
      // Un seul contact intermédiaire, pas besoin d'optimisation
      pointsOptimises = [
        {
          label: labelDepart,
          adresse: trajetData.pointDepart,
          coordinates: coords[0],
          index: 0,
        },
        {
          label: contactsAvecCoords[0].contact.prenom 
            ? `${contactsAvecCoords[0].contact.prenom} ${contactsAvecCoords[0].contact.nom}` 
            : contactsAvecCoords[0].contact.nom,
          adresse: formaterAdresse(contactsAvecCoords[0].contact.adresse),
          coordinates: contactsAvecCoords[0].coordinates,
          contact: contactsAvecCoords[0].contact,
          index: 1,
        },
      ];
      
      // Ajouter l'arrivée
      if (trajetData.sensTrajet === 'institut-domiciles') {
        // Pour "Institut → Domiciles", le seul contact est déjà ajouté avec index 1
        // C'est aussi l'arrivée, pas besoin d'en ajouter un autre
      } else {
        // Pour "Domiciles → Institut", l'arrivée est l'Institut
        pointsOptimises.push({
          label: labelArrivee,
          adresse: trajetData.pointArrivee,
          coordinates: coords[coords.length - 1],
          index: 2,
        });
      }
    } else {
      // Plusieurs contacts, utiliser TSP ou optimisation pour enfants
      const pointsIntermediaires = contactsAvecCoords.map(c => c.coordinates);
      
      let ordreOptimise: number[];
      
      if (trajetData.optimiserPourEnfants) {
        // Mode "optimiser pour enfants" : tri par distance depuis le point de départ
        const ordreComplet = await optimiserPourEnfants(
          coords,
          contactsAvecCoords,
          trajetData.sensTrajet || 'domiciles-institut',
          0
        );
        ordreOptimise = ordreComplet;
      } else {
        // Mode TSP classique : minimiser la durée totale
        // Pour le TSP, on inclut le départ et l'arrivée dans le calcul
        let tousPointsPourTSP: Coordinates[];
        
        if (trajetData.sensTrajet === 'institut-domiciles') {
          // Pour "Institut → Domiciles", on optimise tous les domiciles, le dernier sera l'arrivée
          // On inclut le départ (Institut) pour calculer les distances, mais on n'inclut pas d'arrivée fixe
          tousPointsPourTSP = [
            coords[0], // départ (Institut)
            ...pointsIntermediaires, // tous les domiciles
          ];
        } else {
          // Pour "Domiciles → Institut", départ et arrivée sont fixes
          tousPointsPourTSP = [
            coords[0], // départ
            ...pointsIntermediaires,
            coords[coords.length - 1], // arrivée (Institut)
          ];
        }

        const resultTSP = await resoudreTSP(tousPointsPourTSP, 0, true); // Toujours optimiser sur les durées (trafic)
        
        if (!resultTSP || !resultTSP.ordre) {
          throw new Error('Impossible d\'optimiser le trajet');
        }
        
        ordreOptimise = resultTSP.ordre;
      }
      
      // Reconstruire l'ordre optimisé
      pointsOptimises = [];
      
      // Le premier point est toujours le départ
      pointsOptimises.push({
        label: labelDepart,
        adresse: trajetData.pointDepart,
        coordinates: coords[0],
        index: 0,
      });

      // Les points intermédiaires
      let indicesIntermediaires: number[];
      if (trajetData.optimiserPourEnfants) {
        // Dans ce mode, l'ordre est déjà [0, index1, index2, ...] où les index sont relatifs aux contacts
        // On exclut le premier (départ) et le dernier si c'est un point fixe
        if (trajetData.sensTrajet === 'institut-domiciles') {
          indicesIntermediaires = ordreOptimise.slice(1); // Tous sauf le départ
        } else {
          indicesIntermediaires = ordreOptimise.slice(1, -1); // Exclure départ et arrivée
        }
      } else {
        if (trajetData.sensTrajet === 'institut-domiciles') {
          // Pour "Institut → Domiciles", tous les indices sauf le premier (départ) sont des domiciles
          indicesIntermediaires = ordreOptimise.slice(1);
        } else {
          // Pour "Domiciles → Institut", on exclut le premier (départ) et le dernier (arrivée)
          indicesIntermediaires = ordreOptimise.slice(1, -1);
        }
      }
      
      // Créer un mapping entre les indices dans coords et les contacts
      const mappingIndices: Map<number, number> = new Map();
      if (trajetData.sensTrajet === 'institut-domiciles') {
        // index 0 = départ, index 1..n = contacts
        contactsAvecCoords.forEach((_, i) => {
          mappingIndices.set(i + 1, i); // index dans coords -> index dans contactsAvecCoords
        });
      } else {
        // Pour domiciles-institut, c'est plus complexe car le départ peut être un domicile
        // On va mapper en fonction de l'ordre dans contactsAvecCoords
        let contactIndex = 0;
        for (let i = 1; i < coords.length - 1; i++) {
          mappingIndices.set(i, contactIndex++);
        }
      }
      
      indicesIntermediaires.forEach((idxCoord, i) => {
        const contactIndex = mappingIndices.get(idxCoord);
        if (contactIndex !== undefined && contactIndex < contactsAvecCoords.length) {
          const contactData = contactsAvecCoords[contactIndex];
          pointsOptimises.push({
            label: contactData.contact.prenom 
              ? `${contactData.contact.prenom} ${contactData.contact.nom}` 
              : contactData.contact.nom,
            adresse: formaterAdresse(contactData.contact.adresse),
            coordinates: contactData.coordinates,
            contact: contactData.contact,
            index: i + 1,
          });
        }
      });

      // Le dernier point est l'arrivée
      if (trajetData.sensTrajet === 'institut-domiciles') {
        // Pour "Institut → Domiciles", le dernier domicile dans l'ordre optimisé est déjà ajouté
        // Il n'y a pas besoin d'ajouter un point supplémentaire, le dernier ajouté est l'arrivée
        // L'index est déjà correct (pointsOptimises.length - 1, mais on n'a pas besoin de le modifier)
      } else {
        // Pour "Domiciles → Institut", l'arrivée est l'Institut
        pointsOptimises.push({
          label: labelArrivee,
          adresse: trajetData.pointArrivee,
          coordinates: coords[coords.length - 1],
          index: pointsOptimises.length,
        });
      }
    }

    // 5. Calculer la distance et durée totales en calculant chaque segment
    let distanceTotale = 0;
    let dureeTotale = 0; // Durée de conduite pure (sans arrêts)
    const routeSegments: Coordinates[][] = [];

    for (let i = 0; i < pointsOptimises.length - 1; i++) {
      const route = await calculerItineraire(
        pointsOptimises[i].coordinates,
        pointsOptimises[i + 1].coordinates
      );
      
      if (route) {
        distanceTotale += route.distance;
        dureeTotale += route.duration;
        if (route.geometry && route.geometry.length > 0) {
          routeSegments.push(route.geometry);
        }
      }
    }

    // Ajouter un temps de marge pour chaque arrêt (déposer/récupérer un enfant)
    // Temps moyen pour déposer/récupérer un enfant : 5 minutes
    const TEMPS_PAR_ARRET_SECONDES = 5 * 60; // 5 minutes en secondes
    const nombreArrets = contactsAvecCoords.length; // Nombre d'enfants à transporter
    const margeTotale = nombreArrets * TEMPS_PAR_ARRET_SECONDES;
    const dureeTotaleAvecMarge = dureeTotale + margeTotale;

    // Combiner toutes les géométries de route
    const routeGeometry = routeSegments.length > 0 
      ? routeSegments.flat()
      : undefined;

    // Calculer les heures selon le sens du trajet
    let heureDepartFinal: string;
    let heureArriveeFinal: string;

    if (trajetData.sensTrajet === 'domiciles-institut') {
      // Pour "Domiciles → Institut", on a l'heure d'arrivée, on calcule l'heure de départ
      heureArriveeFinal = trajetData.heureArrivee;
      // Calculer l'heure de départ en soustrayant la durée totale avec marge
      const [heuresArr, minutesArr] = trajetData.heureArrivee.split(':').map(Number);
      const totalMinutesArr = heuresArr * 60 + minutesArr;
      const totalMinutesDep = totalMinutesArr - Math.floor(dureeTotaleAvecMarge / 60);
      const heuresDep = Math.floor(totalMinutesDep / 60);
      const minutesDep = totalMinutesDep % 60;
      heureDepartFinal = `${String(heuresDep).padStart(2, '0')}:${String(minutesDep).padStart(2, '0')}`;
    } else {
      // Pour "Institut → Domiciles", on a l'heure de départ, on calcule l'heure d'arrivée
      heureDepartFinal = trajetData.heureDepart;
      // Calculer l'heure d'arrivée en ajoutant la durée totale avec marge
      const [heuresDep, minutesDep] = trajetData.heureDepart.split(':').map(Number);
      const totalMinutesDep = heuresDep * 60 + minutesDep;
      const totalMinutesArr = totalMinutesDep + Math.floor(dureeTotaleAvecMarge / 60);
      const heuresArr = Math.floor(totalMinutesArr / 60) % 24; // Gérer le dépassement de minuit
      const minutesArr = totalMinutesArr % 60;
      heureArriveeFinal = `${String(heuresArr).padStart(2, '0')}:${String(minutesArr).padStart(2, '0')}`;
    }

    const trajet: TrajetOptimise = {
      points: pointsOptimises,
      distance: distanceTotale,
      duree: dureeTotaleAvecMarge, // Utiliser la durée avec marge
      heureDepart: heureDepartFinal,
      heureArrivee: heureArriveeFinal,
    };

    return {
      trajet,
      routeGeometry,
    };
  } catch (error) {
    console.error('Erreur optimisation trajet:', error);
    throw error;
  }
}
