export function computeFidelityFactor(ticketsBruts, dernierPalierActif, currentPalierOrdre, decayRate = 0.15) {
  const diff = Math.max(0, currentPalierOrdre - dernierPalierActif);
  return Math.pow(1 - decayRate, diff);
}

export function computeVictoryPenalty(derniereVictoirePalier, victoireStreak, currentPalierOrdre) {
  if (derniereVictoirePalier == null) return 1;
  const paliersEcoules = Math.max(0, currentPalierOrdre - derniereVictoirePalier);
  const base = Math.pow(0.5, victoireStreak);
  return Math.min(1, base + 0.25 * paliersEcoules);
}

export function computeEffectiveTickets(participant, currentPalierOrdre, decayRate = 0.15) {
  const fidelite = computeFidelityFactor(
    participant.tickets_bruts_total,
    participant.dernier_palier_actif,
    currentPalierOrdre,
    decayRate
  );
  const victoire = computeVictoryPenalty(
    participant.derniere_victoire_palier,
    participant.victoire_streak,
    currentPalierOrdre
  );
  return Math.round(participant.tickets_bruts_total * fidelite * victoire * 100) / 100;
}
