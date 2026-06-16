# Mettre SafeMarket Optimiseur en ligne (production)

Guide ordonné, de zéro à « de vraies personnes l'utilisent ». Deux livrables distincts :

1. **Le backend** (API + base de données + WebSocket) → hébergé sur un serveur, accessible en HTTPS.
2. **L'application desktop** (.exe) → compilée, signée, distribuée aux utilisateurs.

L'app desktop doit pointer vers l'URL **publique** du backend (et non `127.0.0.1`).

---

## Étape 0 — Pré-requis

- [ ] Un nom de domaine (ex. `safemarket.app`).
- [ ] Un compte chez un hébergeur (Railway, Render, Fly.io, ou un VPS Hetzner/DigitalOcean).
- [ ] (Recommandé) Un certificat de signature de code Windows (voir Étape 7).

---

## Étape 1 — Préparer le backend pour la production

1. **Base de données.** SQLite convient pour démarrer (1 fichier, persistant). Pour de la
   montée en charge, migrer vers **PostgreSQL** (Railway/Render/Neon en fournissent un managé).
   - Si vous gardez SQLite : assurez-vous que le dossier `server/data/` est sur un **volume
     persistant** (sinon la base est effacée à chaque redéploiement).
2. **Variables d'environnement** (ne jamais committer `.env`) :
   ```
   PORT=4317
   NODE_ENV=production
   JWT_SECRET=<chaîne aléatoire de 64+ caractères>   # openssl rand -hex 48
   JWT_EXPIRES_IN=30d
   CORS_ORIGIN=*        # une app Electron n'a pas d'origine web fixe ; laissez * ou gérez via token
   ```
3. **Durcissement** (déjà en place, à vérifier) : `helmet`, validation `zod`, bcrypt, JWT signé,
   vérification HWID/rôle côté serveur. **Ajout recommandé : rate-limiting** sur `/api/auth/*`
   (`express-rate-limit`, ex. 10 tentatives / 15 min) pour bloquer le brute-force.
4. **Build** : `npm --prefix server run build` → lance `node dist/index.js` en prod.

---

## Étape 2 — Héberger le backend

**Option A — Railway / Render (le plus simple, recommandé)**
1. Poussez le repo sur GitHub.
2. Créez un service à partir du dossier `server/`.
   - Build : `npm install && npm run build`
   - Start : `node dist/index.js`
3. Renseignez les variables d'environnement de l'Étape 1.
4. Ajoutez un **volume persistant** monté sur `server/data` (pour SQLite).
5. Le service expose une URL HTTPS (ex. `https://safemarket-api.up.railway.app`) — HTTPS et
   WebSocket (`wss://`) sont gérés automatiquement.

**Option B — VPS (contrôle total)**
1. `ssh` sur le VPS, installez Node 20+.
2. Clonez le repo, `npm --prefix server install && npm --prefix server run build`.
3. Lancez avec **PM2** : `pm2 start dist/index.js --name safemarket-api`.
4. Mettez **Nginx** en reverse-proxy devant le port 4317, avec **HTTPS via Let's Encrypt**
   (`certbot`) et le support WebSocket :
   ```nginx
   server {
     server_name api.safemarket.app;
     location / {
       proxy_pass http://127.0.0.1:4317;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;       # WebSocket
       proxy_set_header Connection "upgrade";        # WebSocket
       proxy_set_header Host $host;
     }
   }
   ```

---

## Étape 3 — Nom de domaine + HTTPS

1. Pointez un sous-domaine `api.safemarket.app` vers l'hébergeur (CNAME Railway/Render, ou A record → IP du VPS).
2. HTTPS : automatique chez Railway/Render ; via `certbot --nginx` sur un VPS.
3. Vérifiez : `https://api.safemarket.app/api/health` doit répondre `{"ok":true}`.

---

## Étape 4 — Pointer l'app desktop vers le backend public

Dans `desktop/src/preload/index.ts`, remplacez l'URL locale par l'URL publique (idéalement via
une variable injectée au build) :
```ts
const API = import.meta.env.VITE_API_URL ?? 'https://api.safemarket.app';
config: {
  apiUrl: `${API}/api`,
  wsUrl:  `${API.replace(/^http/, 'ws')}/ws`,   // -> wss://api.safemarket.app/ws
}
```
Mettez aussi à jour la **CSP** dans `desktop/src/renderer/index.html` :
`connect-src 'self' https://api.safemarket.app wss://api.safemarket.app;`

---

## Étape 5 — Créer le premier compte admin en production

Au **premier démarrage** du backend en prod, une clé admin est imprimée dans les logs du serveur
(Railway/Render → onglet Logs ; VPS → `pm2 logs`). Utilisez-la pour créer votre compte admin via
l'app, puis générez les clés utilisateur depuis le panneau Admin.

---

## Étape 6 — Générer l'installateur Windows (.exe)

```bash
npm --prefix desktop run dist
```
Produit `desktop/release/SafeMarket Optimiseur-Setup-<version>.exe` (installateur NSIS : choix du
dossier, raccourcis bureau + menu Démarrer, icône émeraude). Incrémentez `version` dans
`desktop/package.json` à chaque release.

---

## Étape 7 — Signer l'application (fortement recommandé)

Sans signature, Windows SmartScreen affiche un avertissement « Éditeur inconnu » qui fait fuir les
utilisateurs.
1. Achetez un **certificat de signature de code** (OV ~70-200 €/an, ou **EV** pour une réputation
   SmartScreen immédiate — clé matérielle requise). Fournisseurs : Sectigo, DigiCert, SSL.com.
2. Configurez `electron-builder` pour signer :
   ```yaml
   win:
     certificateFile: cert.pfx          # ou via variables d'env CSC_LINK / CSC_KEY_PASSWORD
     certificatePassword: ${CSC_KEY_PASSWORD}
     signAndEditExecutable: true
   ```
3. Relancez `npm --prefix desktop run dist`. L'exe et l'installateur seront signés.

---

## Étape 8 — Distribuer & mettre à jour

1. **Distribution** : hébergez l'installateur (GitHub Releases, votre site, un bucket S3/R2) et
   partagez le lien d'achat/téléchargement.
2. **Mises à jour automatiques** (optionnel) : `electron-updater` + un flux de releases (GitHub
   Releases ou un serveur statique). Ajoutez la config `publish` dans `electron-builder.yml`.
3. **Annonces** : le panneau Admin → onglet Diffusion envoie déjà des messages en temps réel à
   tous les utilisateurs connectés (WebSocket) — idéal pour annoncer une nouvelle version.

---

## Récapitulatif (ordre d'exécution)

1. Domaine + hébergeur prêts.
2. Backend : variables d'env + rate-limiting + build.
3. Déployer le backend (volume persistant pour la base).
4. Sous-domaine `api.` + HTTPS + vérifier `/api/health`.
5. Pointer l'app desktop vers l'URL publique + CSP.
6. Récupérer la clé admin dans les logs prod, créer le compte admin, générer les clés.
7. `npm --prefix desktop run dist` → installateur.
8. Signer l'exe (certificat OV/EV).
9. Distribuer le `.exe` + activer les mises à jour auto si souhaité.

---

## Checklist sécurité avant ouverture au public

- [ ] `JWT_SECRET` long et secret (jamais dans le code/Git).
- [ ] Rate-limiting actif sur `/api/auth/*`.
- [ ] HTTPS/WSS partout (aucun trafic en clair).
- [ ] `server/data` (ou Postgres) sur stockage persistant + **sauvegardes** planifiées.
- [ ] Logs surveillés (tentatives de connexion, erreurs 500).
- [ ] Installateur signé (pas d'avertissement SmartScreen).
