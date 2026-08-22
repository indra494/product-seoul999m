import assert from "node:assert/strict";
import test from "node:test";
import { BATTLE_MAPS, applyBattleMapLayout } from "../game/battleMaps.ts";
import { decideHeroAction } from "../game/heroBrain.ts";
import { HERO_KITS } from "../game/heroKits.ts";

const blankGrid = () =>
  Array.from({ length: 36 }, (_, y) =>
    Array.from({ length: 56 }, (_, x) =>
      x === 0 || y === 0 || x === 55 || y === 35
        ? { type: 4, hp: 99, max: 99, obstacle: "ledge" }
        : { type: 2, hp: 3, max: 3 },
    ),
  );

const reachableWithDigging = (grid, start, goal) => {
  const queue = [start], seen = new Set([`${start.x},${start.y}`]);
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`, tile = grid[y]?.[x];
      if (
        !tile || seen.has(key) ||
        tile.obstacle === "ledge" || tile.obstacle === "root" || tile.obstacle === "deepWater"
      ) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen.has(`${goal.x},${goal.y}`);
};

test("all seven maps stay symmetric in spawn distance and remain dig-connectable", () => {
  for (const map of BATTLE_MAPS) {
    const grid = blankGrid();
    applyBattleMapLayout(grid, map.id);
    assert.equal(map.spawns.blue.y, map.spawns.red.y, `${map.id} spawn row`);
    assert.equal(map.spawns.blue.x + map.spawns.red.x, 55, `${map.id} rotational spawn pair`);
    assert.equal(reachableWithDigging(grid, map.spawns.blue, map.spawns.red), true, `${map.id} connectivity`);
  }
});

test("each tactical map owns a distinct terrain signature", () => {
  const signatures = BATTLE_MAPS.map((map) => {
    const grid = blankGrid();
    applyBattleMapLayout(grid, map.id);
    const tiles = grid.flat();
    return [
      tiles.filter((tile) => tile.type === 0).length,
      tiles.filter((tile) => tile.surface === "shallowWater").length,
      tiles.filter((tile) => tile.hazard === "steam").length,
      tiles.filter((tile) => tile.obstacle === "root" || tile.type === 7).length,
      tiles.filter((tile) => tile.obstacle === "ledge").length,
    ].join(":");
  });
  assert.equal(new Set(signatures).size, BATTLE_MAPS.length);
});

const context = (overrides = {}) => ({
  hpRatio: 1,
  allyHpRatio: 1,
  coreDanger: 0,
  targetDistance: 8,
  enemiesInBasic: 0,
  enemiesInArea: 0,
  targetHpRatio: 1,
  routeBlocked: false,
  allyNearby: false,
  cooldowns: [1, 1, 1, 1],
  role: "assault",
  ...overrides,
});

test("hero brain retreats, defends, supports and drills for the right emergencies", () => {
  assert.equal(decideHeroAction(context({ hpRatio: 0.12 })).action, "retreat");
  assert.equal(decideHeroAction(context({ coreDanger: 1 })).action, "regroup");
  assert.equal(
    decideHeroAction(context({ role: "support", allyHpRatio: 0.1, cooldowns: [1, 0, 1, 1] })).action,
    "skill2",
  );
  assert.equal(decideHeroAction(context({ routeBlocked: true, cooldowns: [1, 1, 0, 1] })).action, "drill");
});

test("all twelve heroes expose a complete distinct action kit to the shared AI", () => {
  const kits = Object.entries(HERO_KITS);
  assert.equal(kits.length, 12);
  for (const [heroId, kit] of kits) {
    assert.ok(kit.basic.mode, `${heroId} basic`);
    assert.ok(kit.skill1.mode && kit.skill1.cooldown > 0, `${heroId} skill1`);
    assert.ok(kit.skill2.mode && kit.skill2.cooldown > 0, `${heroId} skill2`);
    assert.ok(kit.drill.mode && kit.drill.cooldown > 0, `${heroId} drill`);
    assert.ok(kit.ultimate.mode && kit.ultimate.cooldown > 0, `${heroId} ultimate`);
  }
  assert.equal(new Set(kits.map(([, kit]) => kit.basic.mode)).size, 12);
  assert.equal(new Set(kits.map(([, kit]) => kit.ultimate.mode)).size, 12);
});
