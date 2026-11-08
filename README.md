# AXO ANALYTICS — Creator Control Center

Dashboard web responsive de statistiques créateur, thème sombre premium noir/violet.

## Lancer le site en local

Le projet est une version front-end statique, sans dépendance ni compilation :

1. Décompresse `axo-analytics.zip`.
2. Ouvre `index.html` dans un navigateur, ou lance un petit serveur local :

```bash
python -m http.server 8000
```

Puis ouvre http://localhost:8000.

## Fonctionnalités présentes

- Navigation entre vue générale, YouTube, TikTok, Instagram, vidéos, analyses, objectifs et paramètres.
- Cartes KPI, courbes SVG, donut de répartition et barres comparatives.
- Bibliothèque de publications avec recherche, filtres et tri.
- Export CSV des publications de démonstration.
- Thème clair/sombre, option animations et préférences locales.
- Mise en page responsive ordinateur/tablette/mobile.

## Important : données de démonstration

Les chiffres et publications actuellement affichés sont **fictifs**. Aucune plateforme n'est connectée. Le bouton de connexion est volontairement désactivé : une vraie connexion nécessite les applications développeur et permissions approuvées de chaque plateforme, ainsi qu'un backend sécurisé.

## Architecture recommandée pour la version connectée

- Frontend : cette interface (hébergeable sur Cloudflare Pages, Netlify ou Vercel).
- Backend : Node.js + Express (hébergeable séparément), pour gérer OAuth, les jetons et les appels API.
- Base de données : PostgreSQL ou SQLite au démarrage pour conserver les snapshots historiques, car les API ne fournissent pas toujours un historique complet jour par jour.
- Secrets : variables d'environnement côté serveur uniquement. Ne jamais placer `client_secret`, access tokens ou refresh tokens dans `app.js`, dans le dépôt Git ou dans le navigateur.

### APIs officielles à étudier

- YouTube Data API v3 et YouTube Analytics API : chaîne, vidéos et métriques autorisées.
- TikTok for Developers : produits Login Kit / Display API et éventuels accès analytics approuvés. Les statistiques disponibles dépendent des produits et de l'éligibilité du compte.
- Meta Instagram Graph API / Instagram Insights : nécessite généralement un compte professionnel ou Creator et les permissions Meta correspondantes.

Les accès, quotas, métriques et procédures d'approbation évoluent. Il faut vérifier la documentation officielle avant de promettre une métrique ou d'activer une connexion.

## Mise en ligne

Pour publier la version démo, importe le dossier dans un dépôt GitHub puis connecte ce dépôt à Cloudflare Pages, Netlify ou Vercel en choisissant le dossier racine comme répertoire de publication. Aucun build command n'est nécessaire ; le fichier d'entrée est `index.html`.

Pour la version réelle avec comptes connectés, il faudra également déployer le backend et configurer les URL de callback OAuth HTTPS de chaque fournisseur.
