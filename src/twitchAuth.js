import { db } from "./db.js";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

async function refreshUserToken(refreshToken) {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Échec du refresh token: " + JSON.stringify(data));
  return data;
}

export async function getValidUserToken() {
  const row = db.prepare("SELECT * FROM oauth_tokens WHERE id = 1").get();
  if (!row) throw new Error("Aucun token OAuth utilisateur en base — refaire le flow OAuth manuel");

  const expiresAt = new Date(row.expires_at).getTime();
  const now = Date.now();
  const marginMs = 5 * 60 * 1000;

  if (now < expiresAt - marginMs) {
    return row.access_token;
  }

  console.log("Token utilisateur expiré ou proche expiration, refresh en cours...");
  const data = await refreshUserToken(row.refresh_token);
  const newExpiresAt = new Date(now + data.expires_in * 1000).toISOString();

  db.prepare(`
    UPDATE oauth_tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = 1
  `).run(data.access_token, data.refresh_token || row.refresh_token, newExpiresAt);

  return data.access_token;
}
