# Opti-Trajet

Application d'optimisation de trajets pour chauffeurs accompagnateurs d'enfants handicapés.

## Fonctionnalités

- 📇 **Répertoire de contacts** : Gestion complète des contacts (nom, adresse, téléphone)
- 🔍 **Autocomplétion d'adresses** : Utilisation de l'API Adresse Data Gouv (service gratuit)
- 🗺️ **Génération de trajets optimisés** : Calcul de l'ordre optimal des points de passage avec algorithme TSP
- 🧭 **Carte interactive** : Affichage du trajet avec points numérotés sur une carte Leaflet
- ⏱️ **Calcul de distances et durées** : Estimation des temps de trajet et distances
- 💾 **Stockage local** : Les contacts sont sauvegardés dans le localStorage

## Technologies

- **Next.js 14** (React)
- **TypeScript**
- **Tailwind CSS**
- **Leaflet** & **React-Leaflet** (cartes interactives)
- **API Adresse Data Gouv** (géocodage et recherche d'adresses - gratuit)
- **OpenRouteService** (calcul d'itinéraires - gratuit avec limitations)

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Utilisation

### 1. Gestion du répertoire

- Ajoutez, modifiez ou supprimez des contacts depuis l'onglet "Répertoire"
- Chaque contact contient : nom, prénom (optionnel), adresse, téléphone (optionnel)

### 2. Création d'un trajet

1. Allez dans l'onglet "Nouveau trajet"
2. Renseignez les heures de départ et d'arrivée
3. Saisissez le point de départ (votre domicile)
4. Le point d'arrivée est pré-rempli avec l'établissement
5. Sélectionnez les contacts à inclure dans le trajet
6. Cliquez sur "Générer le trajet optimal"

### 3. Affichage du trajet optimisé

Le trajet optimisé affiche :
- Une carte interactive avec tous les points de passage numérotés
- Une feuille de route détaillée avec les adresses complètes
- La distance totale et la durée estimée
- Les numéros de téléphone des contacts

## Notes importantes

### API OpenRouteService

OpenRouteService peut nécessiter une clé API gratuite pour des requêtes fréquentes :
1. Créez un compte sur [OpenRouteService](https://openrouteservice.org/)
2. Obtenez votre clé API
3. Créez un fichier `.env.local` :
   ```
   NEXT_PUBLIC_ORS_API_KEY=votre_cle_api
   ```
4. Modifiez `lib/route-service.ts` pour utiliser la clé API si nécessaire

**Alternative** : L'application fonctionne aussi sans clé API pour des usages limités.

## Structure du projet

```
/
├── app/                    # Pages Next.js
│   ├── page.tsx           # Page principale
│   ├── layout.tsx         # Layout global
│   └── globals.css        # Styles globaux
├── components/            # Composants React
│   ├── ContactForm.tsx    # Formulaire d'ajout/modification de contact
│   ├── ContactList.tsx    # Liste des contacts
│   ├── TrajetForm.tsx     # Formulaire de création de trajet
│   ├── TrajetOptimise.tsx # Affichage du trajet optimisé
│   ├── MapView.tsx        # Composant de carte Leaflet
│   └── MapViewWrapper.tsx # Wrapper pour chargement dynamique
├── lib/                   # Services et utilitaires
│   ├── api-adresse.ts     # Service de recherche d'adresses
│   ├── geocoding.ts       # Service de géocodage
│   ├── route-service.ts   # Service de calcul d'itinéraires
│   ├── tsp-solver.ts      # Algorithme d'optimisation TSP
│   ├── trajet-optimiseur.ts # Orchestrateur d'optimisation
│   └── utils.ts           # Utilitaires généraux
├── types/                 # Définitions TypeScript
│   └── index.ts
└── data/                  # Données initiales
    └── initial-data.ts
```

## Fonctionnalités futures

- ⏱️ Trafic en temps réel (nécessite une clé API Google Maps ou équivalent)
- 📄 Export PDF de la feuille de route
- 💾 Sauvegarde des trajets précédents
- 📊 Statistiques sur les trajets

## Licence

Ce projet est un outil personnel pour l'optimisation de trajets.
