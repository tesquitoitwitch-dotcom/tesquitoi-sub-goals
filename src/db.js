import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = "/app/data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "sub-goals.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS campagne (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  date_debut TEXT NOT NULL,
  total_abonnes_actuel INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS paliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ordre INTEGER UNIQUE NOT NULL,
  seuil_abonnes INTEGER NOT NULL,
  lot_description TEXT NOT NULL,
  cout_estime_eur REAL NOT NULL,
  atteint INTEGER NOT NULL DEFAULT 0,
  gagnant TEXT,
  date_tirage TEXT
);

CREATE TABLE IF NOT EXISTS participants (
  twitch_username TEXT PRIMARY KEY,
  tickets_bruts_total INTEGER NOT NULL DEFAULT 0,
  dernier_palier_actif INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twitch_username TEXT NOT NULL,
  twitch_event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  tickets_ajoutes INTEGER NOT NULL,
  palier_au_moment INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed de la campagne (date de début) — une seule fois
const campagneExists = db.prepare("SELECT 1 FROM campagne WHERE id = 1").get();
if (!campagneExists) {
  db.prepare("INSERT INTO campagne (id, date_debut, total_abonnes_actuel) VALUES (1, datetime('now'), 0)").run();
}

// Seed des 8 paliers — une seule fois, ne touche pas si déjà présents
const paliersExist = db.prepare("SELECT COUNT(*) as c FROM paliers").get();
if (paliersExist.c === 0) {
  const insert = db.prepare(`
    INSERT INTO paliers (ordre, seuil_abonnes, lot_description, cout_estime_eur)
    VALUES (?, ?, ?, ?)
  `);
  const seed = db.transaction((paliers) => {
    for (const p of paliers) insert.run(...p);
  });
  seed([
    [1, 15, "5€ crédit Battle.net", 5],
    [2, 25, "10€ crédit Battle.net", 10],
    [3, 40, "15€ crédit Battle.net", 15],
    [4, 60, "10€ crédit Battle.net x2 (2 gagnants)", 20],
    [5, 85, "25€ crédit Battle.net", 25],
    [6, 115, "35€ crédit Battle.net", 35],
    [7, 150, "Diablo IV standalone (~45€)", 45],
    [8, 200, "Diablo IV: Lord of Hatred - Ultimate Edition (~90€)", 90],
  ]);
  console.log("8 paliers initialisés");
}

export default db;
