# SafeMarket Optimiseur

Optimiseur de PC Windows moderne et complet — application desktop **Electron + React + Tailwind**,
backend **Node.js + SQLite + WebSocket**, accès protégé par **comptes + clés d'activation** et
**verrou matériel à 1 appareil (HWID)**, avec **panneau d'administration** et **notifications de
diffusion en temps réel**.

Design sombre premium avec accent émeraude (inspiration Linear / Vercel / Raycast), mode clair
complet, télémétrie rendue en police monospace.

---

## Architecture

```
Optimiseur.SafeMarket/
├── server/         Backend sécurisé (Express + better-sqlite3 + ws)
│   └── src/
│       ├── index.ts          Bootstrap HTTP + WebSocket
│       ├── db/                Schéma SQLite + seed clé admin
│       ├── routes/            auth · admin · messages
│       ├── middleware/auth.ts JWT + vérif HWID + rôle (côté serveur)
│       ├── ws/hub.ts          Hub WebSocket (présence + broadcast)
│       └── utils/keys.ts      Génération de clés XXXX-XXXX-XXXX-XXXX
└── desktop/        Application Electron
    ├── electron.vite.config.ts
    ├── electron-builder.yml   Empaquetage .exe (NSIS) + icône
    ├── build/                 Icônes générées (icon.ico / icon.png)
    ├── scripts/generate-icons.mjs
    └── src/
        ├── main/              Process principal Electron
        │   ├── index.ts       Fenêtre · instance unique · cycle de vie
        │   ├── window.ts      Fenêtre frameless + tray + close-to-tray
        │   ├── ipc.ts         Tous les handlers IPC
        │   ├── settings.ts    Réglages persistés (tray, démarrage, thème)
        │   └── system/        Interactions système RÉELLES
        │       ├── metrics.ts     CPU/RAM/GPU/temps + score de santé
        │       ├── clean.ts       Scan + suppression fichiers temp/cache
        │       ├── optimize.ts    Libération mémoire + Mode Jeu
        │       ├── boost.ts       Optimisation en 1 clic
        │       ├── processes.ts   Liste + arrêt de processus
        │       ├── startup.ts     Programmes au démarrage (registre)
        │       ├── disks.ts       État des disques
        │       ├── software.ts    Logiciels installés + désinstallation
        │       ├── network.ts     Débit, DNS, ping, Wi-Fi, TCP, reset
        │       ├── benchmark.ts   Bench CPU / mémoire / disque
        │       └── hwid.ts        Identifiant matériel stable
        ├── preload/index.ts   Pont contextBridge (window.api)
        ├── shared/types.ts    Types partagés main ↔ renderer
        └── renderer/src/      Interface React + Tailwind
            ├── pages/         15 écrans (auth, accueil, dashboard, …)
            ├── components/     ui/ (primitives, charts, modal, toaster), layout/
            ├── store/          auth · theme · toast (zustand)
            └── lib/            api · ws · format · hooks
```

## Sécurité

- Mots de passe hachés avec **bcrypt** (coût 12).
- Sessions par **JWT** signé (le token embarque le HWID).
- **Toutes** les vérifications (clé valide, appareil autorisé, rôle admin) sont faites **côté
  serveur** — jamais en local.
- **Verrou 1 appareil** : à la première connexion, le HWID de la machine est enregistré sur le
  compte. Toute connexion depuis un autre appareil est refusée (`HWID_LOCKED`).
- Une clé d'activation est **liée définitivement** au compte qui l'utilise (non réutilisable).

## Prérequis

- Windows 10/11
- Node.js ≥ 20 (testé sur Node 24)

## Démarrage (développement)

```bash
# À la racine : installe le backend ET l'application desktop
npm install

# Lance le backend (API + WebSocket) et l'app Electron en parallèle
npm run dev
```

Au **premier lancement du serveur**, une **clé admin** est générée et affichée dans la console :

```
========================================================
  CLÉ ADMIN INITIALE — utilisez-la pour créer le compte admin
  ABCD-EFGH-JKLM-NPQR
========================================================
```

1. Dans l'app, cliquez sur **« Activer une licence »**.
2. Renseignez e-mail + mot de passe + cette clé admin.
3. Connectez-vous : cet appareil est désormais lié au compte.
4. Le **Panneau admin** apparaît dans la barre latérale : générez-y des clés utilisateur.

> Le backend peut tourner sur la même machine ou être hébergé. L'app pointe sur
> `http://127.0.0.1:4317` (configurable dans `desktop/src/preload/index.ts`).

## Build & installateur Windows

```bash
# Génère les icônes (déjà présentes, à relancer si modifiées)
npm --prefix desktop run dist   # crée desktop/release/SafeMarket Optimiseur-Setup-x.y.z.exe
```

L'installateur NSIS propose le choix du dossier, crée les raccourcis bureau + menu Démarrer, et
installe l'icône émeraude de l'application.

## Fonctionnalités

| Écran | Contenu |
|------|---------|
| **Accueil** | Score de santé /100 + **Optimisation en 1 clic** (nettoyage + mémoire + DNS) |
| **Tableau de bord** | Monitoring temps réel CPU / RAM / GPU / réseau / disque / températures |
| **Benchmark** | Tests CPU mono/multi, mémoire, disque + comparaison |
| **Nettoyage** | Temp, caches navigateurs, miniatures, corbeille, plantages, MàJ Windows |
| **Optimisation** | Libération mémoire, Mode Jeu, réglages rapides |
| **Processus** | Liste live CPU/RAM, recherche, arrêt |
| **Démarrage** | Activation/désactivation des programmes au démarrage + impact estimé |
| **Réseau** | Débit live, stabilité (ping/jitter/perte), analyse Wi-Fi |
| **Connexion** | Test de vitesse + historique, benchmark DNS, TCP/IP, reset pile réseau |
| **Disques** | Capacité, usage, alertes espace faible |
| **Logiciels** | Liste installée + désinstallation propre |
| **Profil** | Compte, clé, appareil lié, préférences (démarrage, tray) |
| **Admin** | Génération de clés, comptes, déliage HWID, révocation, diffusion |

## Notes sur les actions système

Certaines opérations (nettoyage système, optimisation TCP/IP, changement de DNS, réinitialisation
réseau) nécessitent des **droits administrateur**. L'app gère ces cas proprement (les fichiers
verrouillés sont ignorés, les actions refusées affichent un message clair). Lancez l'app en tant
qu'administrateur pour en bénéficier pleinement.

---

© 2026 SafeMarket — Optimisation Windows premium.
