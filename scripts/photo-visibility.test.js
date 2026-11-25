import test from 'node:test';
import assert from 'node:assert/strict';
import { updatePhotoSelection } from '../src/photoVisibility.js';

const box = (left, distance = 10) => ({
  left, right: left + 100, top: 0, bottom: 100, distance,
  entry: { selected: false, opacity: 0, selectionOrder: 0 },
});

test('distance jitter cannot exchange the priority of visible photos', () => {
  const a = box(0, 10), b = box(160, 11), state = { nextOrder: 0 };
  updatePhotoSelection([a, b], state, 12, 1);
  // Move close enough to start a gradual fade, while camera distance order flips.
  b.left = 130; b.right = 230;
  for (let i = 0; i < 120; i++) {
    a.distance = i % 2 ? 11 : 10;
    b.distance = i % 2 ? 10 : 11;
    updatePhotoSelection([b, a], state, 12, 1 / 60);
    assert(a.entry.selected && b.entry.selected);
    assert(a.entry.opacity > 0.99);
    assert(b.entry.opacity > 0 && b.entry.opacity < 0.7);
  }
});

test('a hidden photo requires extra space to return, preventing edge flicker', () => {
  const a = box(0), b = box(130, 20), state = { nextOrder: 0 };
  updatePhotoSelection([a, b], state, 12, 1);
  assert(!b.entry.selected);
  for (let i = 0; i < 120; i++) {
    b.left = 112 + (i % 2 ? 0.2 : -0.2); b.right = b.left + 100;
    updatePhotoSelection([a, b], state, 12, 1 / 60);
    assert.equal(b.entry.opacity, 0);
  }
  b.left = 150; b.right = 250;
  updatePhotoSelection([a, b], state, 12, 1 / 60);
  assert(b.entry.selected && b.entry.opacity > 0 && b.entry.opacity < 0.1);
});

test('a photo fades before contact and never stays visible over another photo', () => {
  const a = box(0), b = box(160, 20), state = { nextOrder: 0 };
  updatePhotoSelection([a, b], state, 12, 1);
  a.entry.opacity = b.entry.opacity = 1;
  let opacity = b.entry.opacity;
  for (let left = 159; left >= 95; left--) {
    b.left = left; b.right = left + 100;
    updatePhotoSelection([a, b], state, 12, 1 / 60);
    assert(b.entry.opacity <= opacity);
    opacity = b.entry.opacity;
    if (left <= 112) assert.equal(opacity, 0);
  }
});
