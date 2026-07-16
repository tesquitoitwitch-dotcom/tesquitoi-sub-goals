import { db } from "../src/db.js";

const deleted = db.prepare(`DELETE FROM participants WHERE twitch_username LIKE 'test_%'`).run();
const deletedLedger = db.prepare(`DELETE FROM tickets_ledger WHERE twitch_username LIKE 'test_%'`).run();

// Remet le palier 1 à zéro (non atteint, pas de gagnant) pour repartir sur une vraie campagne
db.prepare(`UPDATE paliers SET atteint = 0, gagnant = NULL, date_tirage = NULL WHERE ordre = 1`).run();

console.log(`✅ Nettoyage terminé : ${deleted.changes} participants test supprimés, ${deletedLedger.changes} entrées de ledger supprimées, palier 1 réinitialisé`);
