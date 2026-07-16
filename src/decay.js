export function computeEffectiveTickets(ticketsBruts, dernierPalierActif, currentPalierOrdre, decayRate = 0.15) {
  const diff = Math.max(0, currentPalierOrdre - dernierPalierActif);
  const facteur = Math.pow(1 - decayRate, diff);
  return Math.round(ticketsBruts * facteur * 100) / 100;
}
