import { Coordinates } from './geocoding';
import { calculerMatriceDistances, calculerMatriceDurees } from './route-service';

/**
 * Résout le problème du voyageur de commerce (TSP) pour trouver l'ordre optimal
 * Utilise un algorithme heuristique simple (nearest neighbor) pour les petits ensembles
 * et un algorithme plus sophistiqué pour les plus grands
 */
export interface TSPResult {
  ordre: number[];
  distance: number;
}

/**
 * Algorithme du plus proche voisin (Nearest Neighbor)
 * Simple et rapide pour les petits nombres de points
 */
function nearestNeighborTSP(distanceMatrix: number[][], startIndex: number = 0): TSPResult {
  const n = distanceMatrix.length;
  const visited = new Set<number>();
  const ordre: number[] = [startIndex];
  let distance = 0;
  
  visited.add(startIndex);
  let current = startIndex;

  for (let i = 1; i < n; i++) {
    let nearest = -1;
    let nearestDistance = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && distanceMatrix[current][j] < nearestDistance) {
        nearestDistance = distanceMatrix[current][j];
        nearest = j;
      }
    }

    if (nearest !== -1) {
      ordre.push(nearest);
      visited.add(nearest);
      distance += nearestDistance;
      current = nearest;
    }
  }

  // Retour au point de départ
  distance += distanceMatrix[current][startIndex];

  return { ordre, distance };
}

/**
 * Algorithme 2-opt pour améliorer une solution TSP
 */
function twoOpt(ordre: number[], distanceMatrix: number[][]): { ordre: number[]; distance: number } {
  let improved = true;
  let meilleurOrdre = [...ordre];
  let meilleureDistance = calculerDistanceTotale(ordre, distanceMatrix);

  while (improved) {
    improved = false;

    for (let i = 1; i < meilleurOrdre.length - 1; i++) {
      for (let j = i + 1; j < meilleurOrdre.length; j++) {
        const nouveauOrdre = [...meilleurOrdre];
        // Inverser la section entre i et j
        for (let k = i; k <= j; k++) {
          nouveauOrdre[k] = meilleurOrdre[j - (k - i)];
        }

        const nouvelleDistance = calculerDistanceTotale(nouveauOrdre, distanceMatrix);

        if (nouvelleDistance < meilleureDistance) {
          meilleurOrdre = nouveauOrdre;
          meilleureDistance = nouvelleDistance;
          improved = true;
        }
      }
    }
  }

  return { ordre: meilleurOrdre, distance: meilleureDistance };
}

function calculerDistanceTotale(ordre: number[], distanceMatrix: number[][]): number {
  let distance = 0;
  for (let i = 0; i < ordre.length - 1; i++) {
    distance += distanceMatrix[ordre[i]][ordre[i + 1]];
  }
  // Retour au point de départ
  distance += distanceMatrix[ordre[ordre.length - 1]][ordre[0]];
  return distance;
}

/**
 * Résout le TSP en utilisant nearest neighbor puis 2-opt
 * Optimise par défaut sur les durées (trafic) au lieu des distances pour un trajet plus rapide
 */
export async function resoudreTSP(
  points: Coordinates[],
  pointDepartIndex: number = 0,
  utiliserDurees: boolean = true
): Promise<TSPResult | null> {
  if (points.length < 2) {
    return { ordre: [0], distance: 0 };
  }

  // Calculer la matrice (distances ou durées selon le paramètre)
  const matrix = utiliserDurees
    ? await calculerMatriceDurees(points)
    : await calculerMatriceDistances(points);
  
  if (!matrix) {
    // Si on ne peut pas calculer la matrice, retourner l'ordre original
    console.warn('Impossible de calculer la matrice, utilisation de l\'ordre original');
    return {
      ordre: points.map((_, i) => i),
      distance: 0
    };
  }

  // Résoudre avec nearest neighbor
  let result = nearestNeighborTSP(matrix, pointDepartIndex);

  // Améliorer avec 2-opt si on a plus de 3 points
  if (points.length > 3) {
    result = twoOpt(result.ordre, matrix);
  }

  return result;
}
