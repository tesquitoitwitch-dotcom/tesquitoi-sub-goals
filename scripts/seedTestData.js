import { db } from "../src/db.js";

const fakeParticipants = [
  { username: "test_alice", tickets: 1, type: "sub" },
  { username: "test_bob", tickets: 1, type: "sub" },
  { username: "test_carl", tickets: 1, type: "sub" },
  { username: "test_dave", tickets: 1, type: "sub" },
  { username: "test_eve", tickets: 1, type: "sub" },
  { username: "test_frank", tickets: 6, type: "gift_x10" },
  { username: "test_grace", tickets: 3, type: "gift_x5" },
];

const insertParticipant = db.prepare(`
  INSERT INTO participants (twitch_username, tickets_bruts_total, dernier_palier_actif)
  VALUES (?, ?, 0)
  ON CONFLICT(twitch_username) DO UPDATE SET tickets_bruts_total = tickets_bruts_total + excluded.tickets_bruts_total
`);

const insertLedger = db.prepare(`
  INSERT INTO tickets_ledger (twitch_username, twitch_event_id, type, tickets_ajoutes, palier_au_moment)
  VALUES (?, ?, ?, ?, 0)
`);

const seed = db.transaction((participants) => {
  for (const p of participants) {
    insertParticipant.run(p.username, p.tickets);
    insertLedger.run(p.username, `test_event_${p.username}_${Date.now()}`, p.type, p.tickets);
  }
});

seed(fakeParticipants);

db.prepare(`
  UPDATE campagne
  SET total_abonnes_actuel = total_abonnes_debut + 15
  WHERE id = 1
`).run();

db.prepare(`UPDATE paliers SET atteint = 1 WHERE ordre = 1`).run();

console.log("✅ Données de test injectées : 7 participants fictifs, +15 abonnés simulés, palier 1 marqué comme atteint");
console.log("👉 Regarde l'overlay maintenant : la barre devrait monter à 15/200 et le rond du palier 1 s'allumer");
