import { db } from "./db.js";
import { computeEffectiveTickets, computeVictoryPenalty } from "./decay.js";

function getCurrentPalierOrdre() {
  const row = db.prepare(`SELECT MAX(ordre) as ordre FROM paliers WHERE atteint = 1`).get();
  return row.ordre || 0;
}

export function getCandidates() {
  const currentPalier = getCurrentPalierOrdre();
  const participants = db.prepare("SELECT * FROM participants").all();

  const pool = participants
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

export function performDraw(ordre) {
  const palier = db.prepare("SELECT * FROM paliers WHERE ordre = ?").get(ordre);
  if (!palier) throw new Error("Palier introuvable");
  if (!palier.atteint) throw new Error("Ce palier n'est pas encore atteint");
  if (palier.gagnant) throw new Error("Ce palier a déjà un gagnant");

  const { pool } = getCandidates();
  if (pool.length === 0) throw new Error("Aucun participant éligible pour ce tirage");

  const winner = weightedPick(pool);

  db.prepare(`UPDATE paliers SET gagnant = ?, date_tirage = datetime('now') WHERE ordre = ?`)
    .run(winner.username, ordre);

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

  return { pool, winner: winner.username };
}
