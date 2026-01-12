# Opti-Trajet

Application d'optimisation de trajets pour chauffeurs accompagnateurs d'enfants handicapés.

## Fonctionnalités

- 📇 **Répertoire de contacts** : Gestion complète des contacts (nom, adresse, téléphone)
- 🔍 **Autocomplétion d'adresses** : Utilisation de l'API Adresse Data Gouv (service gratuit)
- 🗺️ **Génération de trajets optimisés** : Calcul de l'ordre optimal des points de passage avec algorithme TSP (Traveling Salesman Problem)
- 🧭 **Carte interactive** : Affichage du trajet avec points numérotés sur une carte Leaflet
- ⏱️ **Calcul de distances et durées** : Estimation des temps de trajet et distances avec prise en compte du trafic en temps réel
- 💾 **Stockage local** : Les contacts sont sauvegardés dans le localStorage
- 🚌 **Deux modes de trajet** :
  - **Institut → Domicile(s)** : Départ depuis l'institut, dépôt des enfants à leur domicile
  - **Domicile(s) → Institut** : Récupération des enfants depuis leur domicile, arrivée à l'institut
- 🎯 **Optimisation flexible** :
  - Minimisation de la durée totale du trajet (TSP classique)
  - Minimisation du temps de chaque enfant dans le véhicule (tri par distance)
- 📊 **Comparaison de variantes** : Génération automatique de plusieurs variantes de trajet avec tri par durée, distance et facilité

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
2. Choisissez le sens du trajet :
   - **Institut → Domicile(s)** : Départ depuis l'institut (heure de départ requise)
   - **Domicile(s) → Institut** : Arrivée à l'institut (heure d'arrivée requise)
3. Selon le mode choisi :
   - **Institut → Domicile(s)** : L'institut est le point de départ (fixe)
   - **Domicile(s) → Institut** : Choisissez votre point de départ (par défaut votre adresse personnelle, ou sélectionnez un contact)
4. Sélectionnez les contacts à inclure dans le trajet
5. (Optionnel) Cochez "Optimiser pour minimiser le temps de chaque enfant" pour comparer les stratégies
6. Cliquez sur "Générer le trajet optimal"

L'application génère automatiquement deux variantes (durée totale minimisée et temps par enfant minimisé) et les classe par durée, distance et facilité (nombre de segments).

### 3. Affichage du trajet optimisé

Le trajet optimisé affiche :
- Des onglets pour chaque variante de trajet générée (Trajet Premier, Trajet Bis, etc.)
- Une carte interactive avec tous les points de passage numérotés (0, 1, 2, ...)
- Une feuille de route détaillée avec les adresses complètes et les numéros de téléphone
- La distance totale et la durée estimée (incluant 5 minutes par arrêt pour dépôt/récupération)
- Les heures de départ et d'arrivée calculées automatiquement

## Notes importantes

### API OpenRouteService

OpenRouteService nécessite une clé API (gratuite) pour les requêtes fréquentes :
1. Créez un compte sur [OpenRouteService](https://openrouteservice.org/)
2. Obtenez votre clé API gratuite
3. Créez un fichier `.env.local` à la racine du projet :
   ```
   NEXT_PUBLIC_ORS_API_KEY=votre_cle_api
   ```
4. Redémarrez le serveur de développement (`npm run dev`)

Voir `SETUP_API_KEY.md` pour plus de détails.

**Note** : L'application utilise OpenRouteService pour :
- Le calcul d'itinéraires (directions)
- Les matrices de distances et durées (pour l'optimisation TSP)
- La prise en compte du trafic en temps réel (durées de trajet)

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

## Algorithme d'optimisation

L'application utilise plusieurs algorithmes pour optimiser les trajets :

1. **TSP (Traveling Salesman Problem)** : Algorithme du plus proche voisin (Nearest Neighbor) suivi d'une optimisation 2-opt pour minimiser la durée totale du trajet
2. **Tri par distance** : Pour minimiser le temps de chaque enfant dans le véhicule, tri des domiciles par distance depuis le point de départ
3. **Critères de tri des variantes** : Les variantes sont triées par :
   - Durée totale (principal)
   - Distance (en cas d'égalité de durée)
   - Nombre de segments (facilité, en cas d'égalité de durée et distance)

## Fonctionnalités futures

- 📄 Export PDF de la feuille de route
- 💾 Sauvegarde des trajets précédents
- 📊 Statistiques sur les trajets
- 🗺️ Options de visualisation avancées (couleurs par variante, etc.)

## Licence

Ce projet est un outil personnel pour l'optimisation de trajets.
