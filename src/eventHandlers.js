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

function addTickets(username, eventId, type, tickets) {
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
  return true;
}

export function handleEventSubEvent(subscriptionType, eventId, event) {
  switch (subscriptionType) {
    case "channel.subscribe":
      if (event.is_gift) {
        console.log(`Sub gift reçu par ${event.user_login} (déjà compté côté gifter)`);
        return;
      }
      addTickets(event.user_login, eventId, "sub", 1);
      break;
    case "channel.subscription.gift":
      if (event.is_anonymous) {
        console.log("Gift anonyme, impossible d'attribuer des tickets");
        return;
      }
      addTickets(event.user_login, eventId, `gift_x${event.total}`, computeGiftTickets(event.total));
      break;
    default:
      console.log(`Type d'événement non géré : ${subscriptionType}`);
  }
}
