import { db } from "./db.js";
import { getValidUserToken } from "./twitchAuth.js";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const BROADCASTER_LOGIN = process.env.TWITCH_BROADCASTER_LOGIN;

let broadcasterIdCache = null;

async function getBroadcasterId(token) {
  if (broadcasterIdCache) return broadcasterIdCache;
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${BROADCASTER_LOGIN}`, {
    headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  broadcasterIdCache = data.data[0].id;
  return broadcasterIdCache;
}

export async function getTotalSubscriberCount() {
  const token = await getValidUserToken();
  const broadcasterId = await getBroadcasterId(token);
  const res = await fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`, {
    headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (typeof data.total !== "number") throw new Error("Réponse inattendue: " + JSON.stringify(data));
  return data.total;
}

// Conservé uniquement à titre informatif (afficher le vrai total d'abonnés Twitch quelque part si besoin),
// n'affecte plus la progression des paliers, qui dépend désormais de campagne.abonnements_comptabilises.
export async function syncSubscriberCount() {
  try {
    const total = await getTotalSubscriberCount();
    db.prepare(`UPDATE campagne SET total_abonnes_actuel = ? WHERE id = 1`).run(total);
    return { total };
  } catch (e) {
    console.error("Erreur sync abonnés:", e.message);
    return null;
  }
}

export async function resetCampaign() {
  const total = await getTotalSubscriberCount().catch(() => null);
  db.prepare(`
    UPDATE campagne
    SET date_debut = datetime('now'),
        total_abonnes_debut = COALESCE(?, total_abonnes_debut),
        total_abonnes_actuel = COALESCE(?, total_abonnes_actuel),
        abonnements_comptabilises = 0
    WHERE id = 1
  `).run(total, total);
  db.prepare(`UPDATE paliers SET atteint = 0, gagnant = NULL, date_tirage = NULL`).run();
  db.prepare(`DELETE FROM palier_gagnants`).run();
  console.log(`Campagne réinitialisée : compteur de progression remis à 0`);
  return { abonnements_comptabilises: 0 };
}
