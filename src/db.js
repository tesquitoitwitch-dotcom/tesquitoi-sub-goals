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

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`);

const campagneCols = db.prepare("PRAGMA table_info(campagne)").all();
if (!campagneCols.some(c => c.name === "total_abonnes_debut")) {
  db.exec("ALTER TABLE campagne ADD COLUMN total_abonnes_debut INTEGER NOT NULL DEFAULT 0");
  console.log("Colonne total_abonnes_debut ajoutée");
}

const participantsCols = db.prepare("PRAGMA table_info(participants)").all();
if (!participantsCols.some(c => c.name === "derniere_victoire_palier")) {
  db.exec("ALTER TABLE participants ADD COLUMN derniere_victoire_palier INTEGER");
  console.log("Colonne derniere_victoire_palier ajoutée");
}
if (!participantsCols.some(c => c.name === "victoire_streak")) {
  db.exec("ALTER TABLE participants ADD COLUMN victoire_streak INTEGER NOT NULL DEFAULT 0");
  console.log("Colonne victoire_streak ajoutée");
}

const campagneExists = db.prepare("SELECT 1 FROM campagne WHERE id = 1").get();
if (!campagneExists) {
  db.prepare("INSERT INTO campagne (id, date_debut, total_abonnes_actuel, total_abonnes_debut) VALUES (1, datetime('now'), 0, 0)").run();
}

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

const tokensExist = db.prepare("SELECT 1 FROM oauth_tokens WHERE id = 1").get();
if (!tokensExist && process.env.TWITCH_USER_ACCESS_TOKEN && process.env.TWITCH_USER_REFRESH_TOKEN) {
  db.prepare(`
    INSERT INTO oauth_tokens (id, access_token, refresh_token, expires_at)
    VALUES (1, ?, ?, '1970-01-01T00:00:00Z')
  `).run(process.env.TWITCH_USER_ACCESS_TOKEN, process.env.TWITCH_USER_REFRESH_TOKEN);
  console.log("Tokens OAuth migrés du .env vers la base");
}

export default db;
