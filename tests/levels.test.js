import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels/index.js';
import { validateLevel, analyseJump } from '../src/game/levels/validate.js';

test('there are at least three levels with unique ids', () => {
  assert.ok(LEVELS.length >= 3);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
});

for (const level of LEVELS) {
  test(`level "${level.name}" passes static validation`, () => {
    const errors = validateLevel(level);
    assert.deepEqual(errors, [], errors.join('\n'));
  });

  test(`level "${level.name}" has a complete gameplay config`, () => {
    assert.ok(level.crystals.length >= 20, 'enough crystals');
    assert.ok(level.sunstones.length >= 1, 'has rare collectibles');
    assert.ok(level.checkpoints.length >= 1, 'has checkpoints');
    assert.ok(level.enemies.length >= 1, 'has enemies');
    assert.ok(level.portal, 'has a portal');
    assert.ok(level.parTime > 0, 'has a par time');
  });
}

test('the final level is marked final', () => {
  assert.equal(LEVELS[LEVELS.length - 1].final, true);
});

test('jump analysis rejects an impossible gap', () => {
  const a = { id: 'a', type: 'island', pos: [0, 0, 0], radius: 2 };
  const b = { id: 'b', type: 'island', pos: [0, 0, -20], radius: 2 };
  assert.equal(analyseJump(a, b).ok, false);
});

test('jump analysis rejects a ledge that is too high', () => {
  const a = { id: 'a', type: 'island', pos: [0, 0, 0], radius: 2 };
  const b = { id: 'b', type: 'island', pos: [0, 4, -5], radius: 2 };
  assert.equal(analyseJump(a, b).ok, false);
});

test('bounce pads extend jump height', () => {
  const a = { id: 'a', type: 'mushroom', pos: [0, 0, 0], radius: 1, bounce: 17 };
  const b = { id: 'b', type: 'island', pos: [0, 4, -5], radius: 2 };
  assert.equal(analyseJump(a, b).ok, true);
});
