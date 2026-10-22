# Visage 3D articulé

Photo → relief 3D (IA) → disques mobiles imprimés en une fois → STL / 3MF / G-code.

## Mettre en ligne sur GitHub Pages (page de test)
1. Crée un dépôt GitHub et envoie-y tous ces fichiers (`index.html` doit être à la racine).
2. Dépôt → **Settings → Pages** → *Deploy from a branch* → branche `main`, dossier `/ (root)` → Save.
3. Après 1 à 2 minutes : `https://TON-PSEUDO.github.io/NOM-DU-DEPOT/`.

La photo reste dans ton navigateur. STL et 3MF fonctionnent sans serveur.

## G-code sans serveur : GitHub Actions + PrusaSlicer (recommandé)
Le workflow `.github/workflows/slice.yml` tranche avec PrusaSlicer directement chez GitHub.
1. Dépôt → **Settings → Actions → General → Workflow permissions** → *Read and write permissions*.
2. Crée un jeton : **Settings (ton profil) → Developer settings → Fine-grained tokens** → ce dépôt uniquement, permission **Contents : Read and write**.
3. Sur la page : colle `pseudo/depot` et le jeton (gardé seulement le temps de la session), puis clique sur « G-code ». Compte 2 à 4 minutes.

Attention : dans un dépôt public, les modèles envoyés et les G-code sont visibles de tous (et restent dans l'historique git).

## G-code (alternative : serveur PrusaSlicer)
GitHub Pages ne peut pas exécuter PrusaSlicer. Déploie le dossier `server/` (ex. Fly.io) :
```
cd server
fly auth login
fly launch --no-deploy --copy-config --name visage3d-tonnom
fly deploy
```
Colle ensuite `https://visage3d-tonnom.fly.dev` dans le champ « Serveur de tranchage » de la page.
Pour limiter l'accès : `fly secrets set ALLOW_ORIGIN=https://TON-PSEUDO.github.io`.
