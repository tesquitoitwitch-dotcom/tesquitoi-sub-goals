const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const BROADCASTER_LOGIN = process.env.TWITCH_BROADCASTER_LOGIN;
const EVENTSUB_SECRET = process.env.TWITCH_EVENTSUB_SECRET;
const CALLBACK_URL = "https://tesquitoi.duckdns.org/webhooks/twitch";

async function getAppToken() {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials" }),
  });
  return (await res.json()).access_token;
}

async function getBroadcasterId(token) {
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${BROADCASTER_LOGIN}`, {
    headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.data?.[0]) throw new Error("Broadcaster introuvable, vérifie TWITCH_BROADCASTER_LOGIN");
  return data.data[0].id;
}

async function createSubscription(token, broadcasterId, type) {
  const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type, version: "1",
      condition: { broadcaster_user_id: broadcasterId },
      transport: { method: "webhook", callback: CALLBACK_URL, secret: EVENTSUB_SECRET },
    }),
  });
  console.log(`--- ${type} ---`, JSON.stringify(await res.json(), null, 2));
}

async function main() {
  const token = await getAppToken();
  const broadcasterId = await getBroadcasterId(token);
  console.log(`Broadcaster ID: ${broadcasterId}`);
  await createSubscription(token, broadcasterId, "channel.subscribe");
  await createSubscription(token, broadcasterId, "channel.subscription.gift");
}

main().catch((e) => { console.error(e); process.exit(1); });
