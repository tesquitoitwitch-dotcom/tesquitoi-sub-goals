export function computeGiftTickets(total) {
  if (!total || total < 1) return 0;
  return Math.max(1, Math.round(total * 0.55));
}
