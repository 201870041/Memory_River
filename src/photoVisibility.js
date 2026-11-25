const smoothstep = (value, start, end) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

// Existing photos keep their priority. Hidden photos need extra clearance to
// re-enter, so small camera movements cannot repeatedly flip the selection.
export function updatePhotoSelection(candidates, state, gap, delta) {
  const fadeMargin = 32;
  candidates.sort((a, b) => {
    const aSelected = Boolean(a.entry.selected);
    const bSelected = Boolean(b.entry.selected);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    return aSelected ? a.entry.selectionOrder - b.entry.selectionOrder : a.distance - b.distance;
  });
  const occupied = [];
  for (const candidate of candidates) {
    const { entry, distance } = candidate;
    let clearance = Infinity;
    for (const box of occupied) {
      clearance = Math.min(clearance, Math.max(
        box.left - candidate.right, candidate.left - box.right,
        box.top - candidate.bottom, candidate.top - box.bottom
      ));
    }
    const requiredGap = entry.selected ? gap : gap + fadeMargin;
    if (clearance <= requiredGap) {
      entry.selected = false;
      entry.opacity = 0;
      continue;
    }
    if (!entry.selected) entry.selectionOrder = state.nextOrder++;
    entry.selected = true;
    occupied.push(candidate);
    const targetOpacity = smoothstep(clearance, gap, gap + fadeMargin)
      * (1 - smoothstep(distance, 48, 75));
    const alpha = 1 - Math.exp(-6 * delta);
    // Fade down with geometric clearance before boxes touch; fade in over time.
    entry.opacity = Math.min(targetOpacity, entry.opacity + (targetOpacity - entry.opacity) * alpha);
  }
}
