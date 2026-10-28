import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  capsuleSphere,
  capsuleAabb,
  capsuleCylinder,
  capsuleSegment,
  segmentSegmentDistSq,
  isStomp,
} from '../src/game/math/collision.js';

const cap = (x, y, z) => ({ x, y, z, hh: 0.42, r: 0.38 });

test('capsule vs sphere', () => {
  assert.equal(capsuleSphere(cap(0, 0, 0), 0, 0, 0.7, 0.4), true);
  assert.equal(capsuleSphere(cap(0, 0, 0), 0, 0, 0.8, 0.4), false);
  // sphere above the capsule's head
  assert.equal(capsuleSphere(cap(0, 0, 0), 0, 1.5, 0, 0.4), false);
  assert.equal(capsuleSphere(cap(0, 0, 0), 0, 1.1, 0, 0.4), true);
});

test('capsule vs aabb', () => {
  assert.equal(capsuleAabb(cap(0, 1, 0), -1, 0, -1, 1, 0.5, 1), true);
  assert.equal(capsuleAabb(cap(0, 2, 0), -1, 0, -1, 1, 0.5, 1), false);
  assert.equal(capsuleAabb(cap(1.3, 0.25, 0), -1, 0, -1, 1, 0.5, 1), true);
  assert.equal(capsuleAabb(cap(1.5, 0.25, 0), -1, 0, -1, 1, 0.5, 1), false);
});

test('capsule vs cylinder', () => {
  assert.equal(capsuleCylinder(cap(0, 1, 0), 0, 0, 1.2, 1, 2), true);
  assert.equal(capsuleCylinder(cap(0, 1, 0), 0, 0, 1.5, 1, 2), false);
});

test('segment distance', () => {
  // crossing segments
  assert.equal(segmentSegmentDistSq(-1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0), 0);
  // parallel segments 2 apart
  assert.ok(Math.abs(segmentSegmentDistSq(0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 2, 0) - 4) < 1e-9);
});

test('capsule vs sweeping bar', () => {
  // horizontal bar at knee height passing through the capsule
  assert.equal(capsuleSegment(cap(0, 0.8, 0), -2, 0.5, 0, 2, 0.5, 0, 0.15), true);
  // player jumped over the bar
  assert.equal(capsuleSegment(cap(0, 2.0, 0), -2, 0.5, 0, 2, 0.5, 0, 0.15), false);
});

test('stomp detection requires falling from above', () => {
  assert.equal(isStomp(cap(0, 1.6, 0), -3, 0.8), true);
  assert.equal(isStomp(cap(0, 1.6, 0), 4, 0.8), false);
  assert.equal(isStomp(cap(0, 0.6, 0), -3, 0.8), false);
});
