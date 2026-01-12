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
  contactsAvecCoords: Array<{ contact: Contact; coordinates: Coordinates; indexDansCoords?: number }>,
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
    // Utiliser l'index stocké si disponible, sinon chercher par comparaison de coordonnées
    let indexDansCoords: number;
    if (data.indexDansCoords !== undefined) {
      indexDansCoords = data.indexDansCoords;
    } else {
      // Fallback : chercher par comparaison de coordonnées
      if (sensTrajet === 'institut-domiciles') {
        // coords[0] = institut, coords[1..n] = domiciles
        indexDansCoords = coords.findIndex((coord, idx) => 
          idx > 0 &&
          Math.abs(coord.lat - data.coordinates.lat) < 0.0001 &&
          Math.abs(coord.lng - data.coordinates.lng) < 0.0001
        );
      } else {
        // coords[0] = domicile départ, coords[1..n-1] = autres domiciles, coords[n] = institut
        indexDansCoords = coords.findIndex((coord, idx) => 
          idx > 0 && idx < coords.length - 1 &&
          Math.abs(coord.lat - data.coordinates.lat) < 0.0001 &&
          Math.abs(coord.lng - data.coordinates.lng) < 0.0001
        );
      }
      
      if (indexDansCoords === -1) {
        // Fallback : utiliser contactIndex + 1 si la recherche échoue
        indexDansCoords = contactIndex + 1;
      }
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
): Promise<{ trajet: TrajetOptimise; routeGeometry?: Coordinates[]; nombreSegments?: number } | null> {
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
    let contactsAvecCoords: Array<{ contact: Contact; coordinates: Coordinates; indexDansCoords?: number }>;
    
    if (trajetData.sensTrajet === 'institut-domiciles') {
      // Pour "Institut → Domiciles", tous les contacts sont des destinations
      contactsAvecCoords = trajetData.contactsSelectionnes.map((contact, index) => ({
        contact,
        coordinates: coords[index + 1], // +1 car le premier est l'Institut
        indexDansCoords: index + 1,
      }));
    } else {
      // Pour "Domiciles → Institut", exclure le contact du point de départ
      const contactsFiltres = trajetData.contactsSelectionnes.filter(contact => {
        const adresseContact = formaterAdresse(contact.adresse);
        return adresseContact !== trajetData.pointDepart;
      });
      
      console.log('DEBUG: contactsSelectionnes.length =', trajetData.contactsSelectionnes.length);
      console.log('DEBUG: contactsFiltres.length =', contactsFiltres.length);
      console.log('DEBUG: adresses.length =', adresses.length);
      console.log('DEBUG: adresses =', adresses);
      
      // Mapper chaque contact filtré avec ses coordonnées en trouvant l'index dans adresses
      contactsAvecCoords = contactsFiltres.map((contact, indexFiltre) => {
        const adresseContact = formaterAdresse(contact.adresse);
        // Pour domiciles-institut: adresses[0] = point de départ, adresses[1..n-1] = contacts, adresses[n] = institut
        // Les contacts sont ajoutés dans le même ordre que contactsFiltres
        // Donc l'index devrait être indexFiltre + 1
        const adresseIndexAttendu = indexFiltre + 1;
        
        console.log(`DEBUG: contact ${contact.nom}, adresseContact=${adresseContact}, adresseIndexAttendu=${adresseIndexAttendu}, adresses[${adresseIndexAttendu}]=${adresses[adresseIndexAttendu]}`);
        
        // Vérifier que l'adresse à cet index correspond bien
        if (adresses[adresseIndexAttendu] === adresseContact) {
          return {
            contact,
            coordinates: coords[adresseIndexAttendu],
            indexDansCoords: adresseIndexAttendu,
          };
        }
        
        // Fallback : chercher dans adresses si l'ordre ne correspond pas
        const adresseIndex = adresses.findIndex((addr, idx) => 
          idx > 0 && idx < adresses.length - 1 && addr === adresseContact
        );
        
        if (adresseIndex === -1) {
          throw new Error(`Impossible de trouver l'adresse ${adresseContact} dans la liste des adresses`);
        }
        
        console.log(`DEBUG: Fallback - contact ${contact.nom}, adresseIndex trouvé=${adresseIndex}`);
        
        return {
          contact,
          coordinates: coords[adresseIndex],
          indexDansCoords: adresseIndex,
        };
      });
      
      console.log('DEBUG: contactsAvecCoords.length =', contactsAvecCoords.length);
      console.log('DEBUG: contactsAvecCoords =', contactsAvecCoords.map(c => ({ nom: c.contact.nom, indexDansCoords: c.indexDansCoords })));
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
        let dernierIndexTSP: number | null = null;
        
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
          dernierIndexTSP = tousPointsPourTSP.length - 1;
        }

        const resultTSP = await resoudreTSP(tousPointsPourTSP, 0, true); // Toujours optimiser sur les durées (trafic)
        
        if (!resultTSP || !resultTSP.ordre) {
          throw new Error('Impossible d\'optimiser le trajet');
        }
        
        ordreOptimise = resultTSP.ordre;
        
        // Pour "domiciles-institut", les indices retournés par le TSP sont relatifs à tousPointsPourTSP
        // Il faut les convertir en indices dans coords pour le mapping
        if (trajetData.sensTrajet === 'domiciles-institut' && dernierIndexTSP !== null) {
          // Les indices 1 à dernierIndexTSP-1 dans tousPointsPourTSP correspondent aux contacts
          // et sont dans le même ordre que dans coords (coords[1] à coords[coords.length-2])
          // Donc l'index dans tousPointsPourTSP = index dans coords pour les contacts
          // On filtre juste pour exclure le départ (0) et l'arrivée (dernierIndexTSP)
          ordreOptimise = ordreOptimise.filter(idx => idx !== 0 && idx !== dernierIndexTSP);
        }
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
        // Dans ce mode, optimiserPourEnfants retourne [0, index1, index2, ...] 
        // où les index sont les indices dans coords des enfants seulement (pas l'institut)
        // On exclut seulement le premier (départ), pas le dernier car l'institut n'est pas inclus
        indicesIntermediaires = ordreOptimise.slice(1); // Tous sauf le départ
      } else {
        if (trajetData.sensTrajet === 'institut-domiciles') {
          // Pour "Institut → Domiciles", tous les indices sauf le premier (départ) sont des domiciles
          indicesIntermediaires = ordreOptimise.slice(1);
        } else {
          // Pour "Domiciles → Institut", ordreOptimise contient déjà uniquement les indices des contacts
          // (le départ et l'arrivée ont déjà été filtrés)
          indicesIntermediaires = ordreOptimise;
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
        // Pour domiciles-institut, mapper les indices des coords vers les contacts
        // coords[0] = point de départ, coords[1..n-1] = contacts intermédiaires, coords[n] = institut
        console.log('DEBUG mapping: contactsAvecCoords.length =', contactsAvecCoords.length);
        contactsAvecCoords.forEach((contactData, contactIndex) => {
          // Utiliser l'index stocké (qui devrait toujours être défini maintenant)
          if (contactData.indexDansCoords !== undefined) {
            console.log(`DEBUG mapping: ${contactData.contact.nom}, indexDansCoords=${contactData.indexDansCoords}, contactIndex=${contactIndex}`);
            mappingIndices.set(contactData.indexDansCoords, contactIndex);
          } else {
            // Fallback : chercher par comparaison de coordonnées (ne devrait pas arriver)
            console.warn('indexDansCoords non défini pour un contact, utilisation du fallback');
            const coordIndex = coords.findIndex((coord, idx) => 
              idx > 0 && idx < coords.length - 1 &&
              Math.abs(coord.lat - contactData.coordinates.lat) < 0.0001 &&
              Math.abs(coord.lng - contactData.coordinates.lng) < 0.0001
            );
            if (coordIndex !== -1) {
              mappingIndices.set(coordIndex, contactIndex);
            }
          }
        });
        console.log('DEBUG mapping: mappingIndices.size =', mappingIndices.size);
        console.log('DEBUG mapping: mappingIndices =', Array.from(mappingIndices.entries()));
      }
      
      console.log('DEBUG mapping: indicesIntermediaires =', indicesIntermediaires);
      indicesIntermediaires.forEach((idxCoord, i) => {
        const contactIndex = mappingIndices.get(idxCoord);
        console.log(`DEBUG mapping: idxCoord=${idxCoord}, contactIndex=${contactIndex}, contactsAvecCoords.length=${contactsAvecCoords.length}`);
        if (contactIndex !== undefined && contactIndex < contactsAvecCoords.length) {
          const contactData = contactsAvecCoords[contactIndex];
          console.log(`DEBUG mapping: Ajout ${contactData.contact.nom} à l'index ${i + 1}`);
          pointsOptimises.push({
            label: contactData.contact.prenom 
              ? `${contactData.contact.prenom} ${contactData.contact.nom}` 
              : contactData.contact.nom,
            adresse: formaterAdresse(contactData.contact.adresse),
            coordinates: contactData.coordinates,
            contact: contactData.contact,
            index: i + 1,
          });
        } else {
          console.warn(`DEBUG mapping: Contact non mappé! idxCoord=${idxCoord}, contactIndex=${contactIndex}`);
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
    let nombreSegmentsTotal = 0; // Nombre total de segments (pour tri par facilité)
    const routeSegments: Coordinates[][] = [];

    for (let i = 0; i < pointsOptimises.length - 1; i++) {
      const route = await calculerItineraire(
        pointsOptimises[i].coordinates,
        pointsOptimises[i + 1].coordinates
      );
      
      if (route) {
        distanceTotale += route.distance;
        dureeTotale += route.duration;
        nombreSegmentsTotal += route.segments?.length || 0;
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
      nombreSegments: nombreSegmentsTotal,
    };
  } catch (error) {
    console.error('Erreur optimisation trajet:', error);
    throw error;
  }
}
