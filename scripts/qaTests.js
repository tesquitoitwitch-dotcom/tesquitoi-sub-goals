import { db } from "../src/db.js";
import { computeGiftTickets } from "../src/tickets.js";
import { computeFidelityFactor, computeVictoryPenalty, computeEffectiveTickets } from "../src/decay.js";
import { handleEventSubEvent } from "../src/eventHandlers.js";
import { performDraw } from "../src/draw.js";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`✅ ${label}`);
    passed++;
  } else {
    console.log(`❌ ÉCHEC : ${label}`);
    failed++;
  }
}

console.log("=== TEST 1 : Formule des tickets gift (jamais négatif, minimum 1) ===");
check("gift x0 → 0 ticket (pas de division absurde)", computeGiftTickets(0) === 0);
check("gift x1 → 1 ticket", computeGiftTickets(1) === 1);
check("gift x5 → 3 tickets", computeGiftTickets(5) === 3);
check("gift x10 → 6 tickets", computeGiftTickets(10) === 6);
check("gift x-5 (valeur absurde) → 0, jamais négatif", computeGiftTickets(-5) === 0);

console.log("\n=== TEST 2 : Facteurs de décroissance et pénalité (toujours entre 0 et 1) ===");
const fideliteExtreme = computeFidelityFactor(100, 0, 50); // 50 paliers d'écart, cas extrême
check("Décroissance fidélité jamais négative même sur un écart énorme", fideliteExtreme >= 0);
check("Décroissance fidélité jamais > 1", fideliteExtreme <= 1);

const penaliteExtreme = computeVictoryPenalty(1, 10, 1); // streak de 10 victoires d'affilée
check("Pénalité de victoire jamais négative même avec un streak énorme", penaliteExtreme >= 0);
check("Pénalité de victoire jamais > 1", penaliteExtreme <= 1);

const penaliteAucuneVictoire = computeVictoryPenalty(null, 0, 5);
check("Pas de victoire enregistrée → pénalité = 1 (aucun malus)", penaliteAucuneVictoire === 1);

console.log("\n=== TEST 3 : Anti-doublon d'événement Twitch (même event_id envoyé deux fois) ===");
const fakeEventId = `qa_test_duplicate_${Date.now()}`;
db.prepare(`DELETE FROM participants WHERE twitch_username = 'qa_test_dup_user'`).run();
db.prepare(`DELETE FROM tickets_ledger WHERE twitch_username = 'qa_test_dup_user'`).run();

handleEventSubEvent("channel.subscribe", fakeEventId, { user_login: "qa_test_dup_user", is_gift: false });
handleEventSubEvent("channel.subscribe", fakeEventId, { user_login: "qa_test_dup_user", is_gift: false }); // même event_id, doit être ignoré

const dupParticipant = db.prepare("SELECT * FROM participants WHERE twitch_username = 'qa_test_dup_user'").get();
check("Même événement envoyé 2x → un seul ticket compté, pas deux", dupParticipant.tickets_bruts_total === 1);

// Nettoyage
db.prepare(`DELETE FROM participants WHERE twitch_username = 'qa_test_dup_user'`).run();
db.prepare(`DELETE FROM tickets_ledger WHERE twitch_username = 'qa_test_dup_user'`).run();

console.log("\n=== TEST 4 : Tirage avec 0 participant éligible (doit échouer proprement, pas planter) ===");
db.prepare(`UPDATE paliers SET atteint = 1, gagnant = NULL WHERE ordre = 7`).run();
let test4Error = null;
try {
  performDraw(7);
} catch (e) {
  test4Error = e.message;
}
check("Tirage avec 0 participant lève une erreur propre (pas de crash)", test4Error === "Aucun participant éligible pour ce tirage");
db.prepare(`UPDATE paliers SET atteint = 0, gagnant = NULL WHERE ordre = 7`).run();

console.log("\n=== TEST 5 : Tirage avec exactement 1 participant éligible (doit réussir, pas planter) ===");
db.prepare(`DELETE FROM participants WHERE twitch_username = 'qa_test_solo_user'`).run();
db.prepare(`
  INSERT INTO participants (twitch_username, tickets_bruts_total, dernier_palier_actif)
  VALUES ('qa_test_solo_user', 3, 7)
`).run();
db.prepare(`UPDATE paliers SET atteint = 1, gagnant = NULL WHERE ordre = 7`).run();

let test5Result = null;
try {
  test5Result = performDraw(7);
} catch (e) {
  test5Result = { error: e.message };
}
check("Tirage à 1 seul participant désigne bien ce participant", test5Result.winner === "qa_test_solo_user");

// Nettoyage
db.prepare(`UPDATE paliers SET atteint = 0, gagnant = NULL, date_tirage = NULL WHERE ordre = 7`).run();
db.prepare(`DELETE FROM participants WHERE twitch_username = 'qa_test_solo_user'`).run();

console.log("\n=== TEST 6 : Double tirage sur le même palier (doit être bloqué la 2e fois) ===");
db.prepare(`DELETE FROM participants WHERE twitch_username = 'qa_test_double_user'`).run();
db.prepare(`
  INSERT INTO participants (twitch_username, tickets_bruts_total, dernier_palier_actif)
  VALUES ('qa_test_double_user', 2, 6)
`).run();
db.prepare(`UPDATE paliers SET atteint = 1, gagnant = NULL WHERE ordre = 6`).run();

performDraw(6); // premier tirage, doit réussir
let test6SecondError = null;
try {
  performDraw(6); // deuxième tirage sur le même palier, doit échouer
} catch (e) {
  test6SecondError = e.message;
}
check("Deuxième tirage sur un palier déjà tiré est bloqué", test6SecondError === "Ce palier a déjà un gagnant");

// Nettoyage
db.prepare(`UPDATE paliers SET atteint = 0, gagnant = NULL, date_tirage = NULL WHERE ordre = 6`).run();
db.prepare(`DELETE FROM participants WHERE twitch_username = 'qa_test_double_user'`).run();

console.log("\n=== RÉSUMÉ ===");
console.log(`${passed} test(s) réussi(s), ${failed} test(s) échoué(s)`);
if (failed > 0) {
  console.log("⚠️  Des tests ont échoué, à corriger avant le lancement public.");
  process.exit(1);
} else {
  console.log("🎉 Tous les tests QA sont passés.");
}
