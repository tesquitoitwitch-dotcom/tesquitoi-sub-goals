# Tesquitoi Sub Goals

Systeme de sub-goals Twitch avec paliers cumulatifs, tirage au sort pondere en direct, et overlay OBS.

## Stack
Node.js/Express + better-sqlite3, Docker, Traefik existant (HTTPS via DuckDNS), App Twitch dediee.

## Structure
- src/ : logique backend (db, server, webhook, tickets, decay, draw, twitchAuth, subscriberSync)
- scripts/ : subscribe.js (creation EventSub), seedTestData.js/resetTestData.js (tests generaux), seedTestPalier4.js/resetTestPalier4.js (test multi-gagnants), qaTests.js (14 tests automatises)
- public/ : overlay.html (OBS), paliers.html (page publique), rotator.html (rotation OBS), wheel.html (roue de tirage)
- docs/ : reglement-giveaway.md, discord-post-final.md

## Regles metier
- 1 sub = 1 ticket. Gift = nombre offert x 0.55 arrondi, minimum 1.
- Decroissance fidelite : -15%/palier sans contribution.
- Penalite de victoire : reduite temporairement apres un gain, jamais totalement exclu.
- Palier 4 = 2 gagnants, les autres = 1.
- Progression basee sur les NOUVEAUX abonnes depuis le debut de la campagne.

## Commandes utiles
Deployer : docker compose up -d --build
Tests QA : docker compose exec sub-goals node scripts/qaTests.js
Resync abonnes : curl -X POST https://tesquitoi.duckdns.org/api/sync

## Lecons apprises
- EventSub necessite un token d'app pour la creation, mais un flow OAuth utilisateur prealable pour autoriser l'app.
- DuckDNS + Traefik existant = HTTPS gratuit sans certbot manuel.
- Toujours verifier l'infra existante avant d'installer un nouvel outil.
- Prevoir les paliers multi-gagnants des la conception (table dediee, pas juste un champ "gagnant").
- Toujours resync apres un nettoyage de donnees de test.
