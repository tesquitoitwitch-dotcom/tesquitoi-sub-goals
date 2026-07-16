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

export function checkPaliersFranchis(totalAbonnes) {
  const nouveaux = db.prepare(`
    SELECT * FROM paliers WHERE atteint = 0 AND seuil_abonnes <= ? ORDER BY ordre
  `).all(totalAbonnes);

  for (const p of nouveaux) {
    db.prepare(`UPDATE paliers SET atteint = 1 WHERE id = ?`).run(p.id);
    console.log(`🎉 Palier ${p.ordre} atteint ! (${p.seuil_abonnes} abonnés) - Lot: ${p.lot_description}`);
  }
  return nouveaux;
}

export async function syncSubscriberCount() {
  try {
    const total = await getTotalSubscriberCount();
    db.prepare(`UPDATE campagne SET total_abonnes_actuel = ? WHERE id = 1`).run(total);
    const nouveaux = checkPaliersFranchis(total);
    if (nouveaux.length > 0) {
      console.log(`Nouveaux paliers franchis: ${nouveaux.map(p => p.ordre).join(", ")}`);
    }
    return { total, nouveauxPaliers: nouveaux };
  } catch (e) {
    console.error("Erreur sync abonnés:", e.message);
    return null;
  }
}
