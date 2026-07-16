import express from "express";
import { db } from "./db.js";

const app = express();
const PORT = 3000;

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "tesquitoi-sub-goals" });
});

app.get("/api/paliers", (req, res) => {
  const paliers = db.prepare("SELECT * FROM paliers ORDER BY ordre").all();
  const campagne = db.prepare("SELECT * FROM campagne WHERE id = 1").get();
  res.json({ campagne, paliers });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
