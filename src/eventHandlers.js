import { db } from "./db.js";
import { computeGiftTickets } from "./tickets.js";

function upsertParticipant(username) {
  db.prepare(`
    INSERT INTO participants (twitch_username, tickets_bruts_total)
    VALUES (?, 0)
    ON CONFLICT(twitch_username) DO NOTHING
  `).run(username);
}

function getCurrentPalierOrdre() {
  const row = db.prepare(`SELECT MAX(ordre) as ordre FROM paliers WHERE atteint = 1`).get();
  return row.ordre || 0;
}

function checkPaliersFranchis(abonnesComptabilises) {
  const nouveaux = db.prepare(`
    SELECT * FROM paliers WHERE atteint = 0 AND seuil_abonnes <= ? ORDER BY ordre
  `).all(abonnesComptabilises);

  for (const p of nouveaux) {
    db.prepare(`UPDATE paliers SET atteint = 1 WHERE id = ?`).run(p.id);
    console.log(`🎉 Palier ${p.ordre} atteint ! (${p.seuil_abonnes} contributions) - Lot: ${p.lot_description}`);
  }
  return nouveaux;
}

function addTickets(username, eventId, type, tickets, rawSubCount) {
  if (tickets <= 0) return false;
  upsertParticipant(username);
  const palier = getCurrentPalierOrdre();
  try {
    db.prepare(`
      INSERT INTO tickets_ledger (twitch_username, twitch_event_id, type, tickets_ajoutes, palier_au_moment)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, eventId, type, tickets, palier);
  } catch (e) {
    if (String(e.code).startsWith("SQLITE_CONSTRAINT")) {
      console.log(`Événement déjà traité, ignoré : ${eventId}`);
      return false;
    }
    throw e;
  }
  db.prepare(`
    UPDATE participants
    SET tickets_bruts_total = tickets_bruts_total + ?, dernier_palier_actif = ?, updated_at = datetime('now')
    WHERE twitch_username = ?
  `).run(tickets, palier, username);

  // Le compteur de progression avance du nombre RÉEL d'abonnements (1 pour un sub, N pour un gift x N),
  // jamais affecté par des désabonnements ailleurs sur la chaîne.
  db.prepare(`UPDATE campagne SET abonnements_comptabilises = abonnements_comptabilises + ? WHERE id = 1`).run(rawSubCount);
  const newTotal = db.prepare(`SELECT abonnements_comptabilises FROM campagne WHERE id = 1`).get().abonnements_comptabilises;
  checkPaliersFranchis(newTotal);

  return true;
}

export function handleEventSubEvent(subscriptionType, eventId, event) {
  switch (subscriptionType) {
    case "channel.subscribe":
      if (event.is_gift) {
        console.log(`Sub gift reçu par ${event.user_login} (déjà compté côté gifter)`);
        return;
      }
      addTickets(event.user_login, eventId, "sub", 1, 1);
      break;
    case "channel.subscription.gift":
      if (event.is_anonymous) {
        console.log("Gift anonyme, impossible d'attribuer des tickets");
        return;
      }
      addTickets(event.user_login, eventId, `gift_x${event.total}`, computeGiftTickets(event.total), event.total);
      break;
    default:
      console.log(`Type d'événement non géré : ${subscriptionType}`);
  }
}
