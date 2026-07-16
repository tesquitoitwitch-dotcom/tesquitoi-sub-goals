import { db } from "./db.js";
import { computeEffectiveTickets, computeVictoryPenalty } from "./decay.js";

function getCurrentPalierOrdre() {
  const row = db.prepare(`SELECT MAX(ordre) as ordre FROM paliers WHERE atteint = 1`).get();
  return row.ordre || 0;
}

function getWinnersForPalier(ordre) {
  return db.prepare(`SELECT twitch_username FROM palier_gagnants WHERE palier_ordre = ?`).all(ordre).map(r => r.twitch_username);
}

export function getCandidates(excludeUsernames = []) {
  const currentPalier = getCurrentPalierOrdre();
  const participants = db.prepare("SELECT * FROM participants").all();
  const excludeSet = new Set(excludeUsernames);

  const pool = participants
    .filter(p => !excludeSet.has(p.twitch_username))
    .map(p => ({
      username: p.twitch_username,
      weight: computeEffectiveTickets(p, currentPalier),
    }))
    .filter(p => p.weight > 0);

  return { pool };
}

function weightedPick(pool) {
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

export function getPalierDrawStatus(ordre) {
  const palier = db.prepare("SELECT * FROM paliers WHERE ordre = ?").get(ordre);
  if (!palier) throw new Error("Palier introuvable");
  const winners = getWinnersForPalier(ordre);
  return {
    nombreGagnants: palier.nombre_gagnants,
    gagnantsDejaTires: winners,
    restants: palier.nombre_gagnants - winners.length,
  };
}

export function performDraw(ordre) {
  const palier = db.prepare("SELECT * FROM paliers WHERE ordre = ?").get(ordre);
  if (!palier) throw new Error("Palier introuvable");
  if (!palier.atteint) throw new Error("Ce palier n'est pas encore atteint");

  const winnersAlready = getWinnersForPalier(ordre);
  if (winnersAlready.length >= palier.nombre_gagnants) {
    throw new Error("Tous les gagnants de ce palier ont déjà été tirés");
  }

  // On exclut les gens qui ont déjà gagné CE palier précis, pour ne pas qu'ils gagnent deux fois le même lot
  const { pool } = getCandidates(winnersAlready);
  if (pool.length === 0) throw new Error("Aucun participant éligible pour ce tirage");

  const winner = weightedPick(pool);

  db.prepare(`
    INSERT INTO palier_gagnants (palier_ordre, twitch_username) VALUES (?, ?)
  `).run(ordre, winner.username);

  const totalWinnersNow = winnersAlready.length + 1;
  const isLastDraw = totalWinnersNow >= palier.nombre_gagnants;

  // Marque le palier avec le dernier tirage effectué (pour compat affichage), une fois tous les gagnants tirés
  if (isLastDraw) {
    const allWinners = [...winnersAlready, winner.username].join(", ");
    db.prepare(`UPDATE paliers SET gagnant = ?, date_tirage = datetime('now') WHERE ordre = ?`).run(allWinners, ordre);
  }

  // Mise à jour du streak de victoires du gagnant
  const winnerRow = db.prepare("SELECT * FROM participants WHERE twitch_username = ?").get(winner.username);
  const facteurAvantGain = computeVictoryPenalty(
    winnerRow.derniere_victoire_palier,
    winnerRow.victoire_streak,
    ordre
  );
  const nouveauStreak = facteurAvantGain >= 1 ? 1 : winnerRow.victoire_streak + 1;

  db.prepare(`
    UPDATE participants SET derniere_victoire_palier = ?, victoire_streak = ? WHERE twitch_username = ?
  `).run(ordre, nouveauStreak, winner.username);

  return {
    pool,
    winner: winner.username,
    restants: palier.nombre_gagnants - totalWinnersNow,
    isLastDraw,
  };
}
