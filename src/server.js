import express from "express";
import { db } from "./db.js";
import { twitchWebhookHandler } from "./webhook.js";
import { syncSubscriberCount, resetCampaign } from "./subscriberSync.js";
import { computeEffectiveTickets } from "./decay.js";

const app = express();
const PORT = 3000;

app.post("/webhooks/twitch", express.raw({ type: "*/*" }), (req, res, next) => {
  req.rawBody = req.body.toString("utf8");
  next();
}, twitchWebhookHandler);

app.use(express.static("public"));

app.get("/health", (req, res) => res.json({ status: "ok", service: "tesquitoi-sub-goals" }));

app.get("/api/paliers", (req, res) => {
  const paliers = db.prepare("SELECT * FROM paliers ORDER BY ordre").all();
  const campagne = db.prepare("SELECT * FROM campagne WHERE id = 1").get();
  res.json({ campagne, paliers });
});

app.get("/api/participants", (req, res) => {
  const currentPalier = db.prepare("SELECT MAX(ordre) as ordre FROM paliers WHERE atteint = 1").get().ordre || 0;
  const participants = db.prepare("SELECT * FROM participants ORDER BY tickets_bruts_total DESC").all();
  const enrichis = participants.map(p => ({
    twitch_username: p.twitch_username,
    tickets_bruts: p.tickets_bruts_total,
    tickets_effectifs: computeEffectiveTickets(p.tickets_bruts_total, p.dernier_palier_actif, currentPalier),
    dernier_palier_actif: p.dernier_palier_actif,
  }));
  res.json({ currentPalier, participants: enrichis });
});

app.post("/api/sync", async (req, res) => {
  const result = await syncSubscriberCount();
  res.json(result || { error: "sync failed, check logs" });
});

app.post("/api/campagne/reset", async (req, res) => {
  const result = await resetCampaign();
  res.json(result);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
