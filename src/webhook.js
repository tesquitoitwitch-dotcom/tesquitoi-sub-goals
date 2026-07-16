import crypto from "crypto";
import { handleEventSubEvent } from "./eventHandlers.js";
import { syncSubscriberCount } from "./subscriberSync.js";

function verifySignature(req, secret) {
  const messageId = req.header("Twitch-Eventsub-Message-Id");
  const timestamp = req.header("Twitch-Eventsub-Message-Timestamp");
  const signature = req.header("Twitch-Eventsub-Message-Signature");
  if (!messageId || !timestamp || !signature) return false;

  const computed = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(messageId + timestamp + req.rawBody)
    .digest("hex");

  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function twitchWebhookHandler(req, res) {
  if (!verifySignature(req, process.env.TWITCH_EVENTSUB_SECRET)) {
    console.warn("Signature invalide, requête rejetée");
    return res.status(403).send("invalid signature");
  }

  const messageType = req.header("Twitch-Eventsub-Message-Type");
  const body = JSON.parse(req.rawBody);

  if (messageType === "webhook_callback_verification") {
    return res.status(200).type("text/plain").send(body.challenge);
  }
  if (messageType === "revocation") {
    console.warn("Abonnement EventSub révoqué :", body.subscription);
    return res.status(200).end();
  }
  if (messageType === "notification") {
    try {
      handleEventSubEvent(body.subscription.type, req.header("Twitch-Eventsub-Message-Id"), body.event);
    } catch (e) {
      console.error("Erreur traitement événement:", e);
    }
    res.status(200).end();
    // Sync + détection de palier après avoir répondu à Twitch (pas besoin de le faire attendre)
    syncSubscriberCount();
    return;
  }
  res.status(400).end();
}
