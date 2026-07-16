import express from "express";
import { db } from "./db.js";
import { twitchWebhookHandler } from "./webhook.js";
import { syncSubscriberCount, resetCampaign } from "./subscriberSync.js";
import { computeEffectiveTickets } from "./decay.js";
import { getCandidates, performDraw, getPalierDrawStatus } from "./draw.js";

const app = express();
const PORT = 3000;

app.post("/webhooks/twitch", express.raw({ type: "*/*" }), (req, res, next) => {
  req.rawBody = req.body.toString("utf8");
  next();
}, twitchWebhookHandler);

app.use(express.static("public"));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", service: "tesquitoi-sub-goals" }));

app.get("/api/paliers", (req, res) => {
  const paliers = db.prepare("SELECT * FROM paliers ORDER BY ordre").all();
  const campagne = db.prepare("SELECT * FROM campagne WHERE id = 1").get();
  const paliersAvecGagnants = paliers.map(p => {
    const winners = db.prepare("SELECT twitch_username FROM palier_gagnants WHERE palier_ordre = ?").all(p.ordre).map(r => r.twitch_username);
    return { ...p, gagnants: winners };
  });
  res.json({ campagne, paliers: paliersAvecGagnants });
});

app.get("/api/paliers/pending", (req, res) => {
  // "En attente de tirage" = atteint, mais pas tous les gagnants tirés
  const paliers = db.prepare("SELECT * FROM paliers WHERE atteint = 1 ORDER BY ordre").all();
  const pending = paliers
    .map(p => ({ ...p, status: getPalierDrawStatus(p.ordre) }))
    .filter(p => p.status.restants > 0);
  res.json({ paliers: pending });
});

app.get("/api/participants", (req, res) => {
  const currentPalier = db.prepare("SELECT MAX(ordre) as ordre FROM paliers WHERE atteint = 1").get().ordre || 0;
  const participants = db.prepare("SELECT * FROM participants ORDER BY tickets_bruts_total DESC").all();
  const enrichis = participants.map(p => ({
    twitch_username: p.twitch_username,
    tickets_bruts: p.tickets_bruts_total,
    tickets_effectifs: computeEffectiveTickets(p, currentPalier),
    dernier_palier_actif: p.dernier_palier_actif,
    derniere_victoire_palier: p.derniere_victoire_palier,
  }));
  res.json({ currentPalier, participants: enrichis });
});

app.get("/api/candidates/:ordre", (req, res) => {
  const status = getPalierDrawStatus(Number(req.params.ordre));
  const { pool } = getCandidates(status.gagnantsDejaTires);
  const total = pool.reduce((s, p) => s + p.weight, 0);
  const withOdds = pool
    .map(p => ({ ...p, probabilite_pct: total > 0 ? Math.round((p.weight / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.weight - a.weight);
  res.json({ pool: withOdds, total, status });
});

app.post("/api/paliers/:ordre/draw", (req, res) => {
  try {
    const result = performDraw(Number(req.params.ordre));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
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
