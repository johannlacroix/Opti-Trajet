# Configuration de la clé API OpenRouteService

Votre clé API a été intégrée dans le code. Pour une meilleure sécurité, il est recommandé de la stocker dans un fichier `.env.local`.

## Option 1 : Utilisation directe (déjà configurée)

La clé API est déjà intégrée dans le code comme valeur par défaut, donc l'application fonctionne immédiatement sans configuration supplémentaire.

## Option 2 : Fichier .env.local (recommandé)

Pour une meilleure sécurité, créez un fichier `.env.local` à la racine du projet avec le contenu suivant :

```
NEXT_PUBLIC_ORS_API_KEY=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE1YzNhZDc2OTQ5MTQ3YTJiZmJiMWJiNDgxNDVlZjc2IiwiaCI6Im11cm11cjY0In0=
```

**Note :** Le fichier `.env.local` est déjà dans le `.gitignore`, donc il ne sera pas versionné sur Git.

## Redémarrer le serveur

Après avoir créé le fichier `.env.local`, redémarrez le serveur de développement :

```bash
npm run dev
```

L'application est maintenant prête à utiliser l'API OpenRouteService avec votre clé !
