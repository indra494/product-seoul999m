import assert from "node:assert/strict";
import test from "node:test";
import { BATTLE_MAPS, applyBattleMapLayout } from "../game/battleMaps.ts";
import { siegeResponse } from "../game/aiSiegeRules.ts";
import { buildPlacementCost, nearbyAttackFacilityCount } from "../game/buildRules.ts";
import { CORE_REGEN_DELAY_MS, coreRegenAmount, emergencyRepairAmount } from "../game/healingRules.ts";
import { decideHeroAction } from "../game/heroBrain.ts";
import { HERO_KITS } from "../game/heroKits.ts";
import { CAMPAIGN1_MAX_ACTIVE_INVADERS, CAMPAIGN1_REGROUP_AFTER_MS, CAMPAIGN1_RETREAT_AFTER_MS, CAMPAIGN1_WAVE_COUNTS, campaign1AdvanceWatch, campaign1BossShouldEnter, campaign1VictoryReady, shouldRemoveSpawnOrder, shouldUseCampaign1GuardGoal } from "../game/campaignRules.ts";
import { canDamageCore, exposedCoreDamage } from "../game/coreCombatRules.ts";
import { EMERGENCY_BREACH_DELAY_MS, canEmergencyBreach } from "../game/minionBreachRules.ts";

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

test("campaign 1 preserves queued invaders and requires its late boss before victory", () => {
  assert.deepEqual(CAMPAIGN1_WAVE_COUNTS, { 1: 36, 2: 48 });
  assert.equal(CAMPAIGN1_MAX_ACTIVE_INVADERS, 18);
  assert.equal(shouldRemoveSpawnOrder(false, -9000, true), false);
  assert.equal(shouldRemoveSpawnOrder(false, -5000, false), true);
  assert.equal(campaign1BossShouldEnter(2, true, 9), false);
  assert.equal(campaign1BossShouldEnter(2, true, 8), true);
  assert.equal(campaign1BossShouldEnter(1, true, 0), false);
  assert.equal(campaign1VictoryReady(2, false, 0, 0), false);
  assert.equal(campaign1VictoryReady(2, true, 0, 1), false);
  assert.equal(campaign1VictoryReady(2, true, 0, 0), true);
});

test("campaign 1 stragglers regroup and eventually leave the wave tally", () => {
  const advancing = campaign1AdvanceWatch(50, 49, 3200, 400);
  assert.deepEqual(advancing, { bestX: 49, stalledMs: 0, shouldRegroup: false, shouldRetreat: false });
  const regroup = campaign1AdvanceWatch(49, 49, CAMPAIGN1_REGROUP_AFTER_MS - 200, 250);
  assert.equal(regroup.shouldRegroup, true);
  assert.equal(regroup.shouldRetreat, false);
  const retreat = campaign1AdvanceWatch(49, 50, CAMPAIGN1_RETREAT_AFTER_MS - 100, 150);
  assert.equal(retreat.shouldRetreat, true);
});

test("campaign 1 guards by default but yields to an assigned march route", () => {
  assert.equal(shouldUseCampaign1GuardGoal(true, 1, false), true);
  assert.equal(shouldUseCampaign1GuardGoal(true, 1, true), false);
  assert.equal(shouldUseCampaign1GuardGoal(true, 2, false), false);
  assert.equal(shouldUseCampaign1GuardGoal(false, 1, false), false);
});

test("attack facilities can touch and pay a capped local density surcharge", () => {
  const wall = [{ x: 10, y: 10, isBlocker: true }];
  const attack = [{ x: 10, y: 10, isBlocker: false }];
  assert.equal(nearbyAttackFacilityCount(false, 11, 10, wall), 0);
  assert.equal(nearbyAttackFacilityCount(false, 11, 10, attack), 1);
  assert.equal(buildPlacementCost(100, false, 11, 10, attack), 120);
  assert.equal(buildPlacementCost(100, false, 11, 10, [...attack, { x: 12, y: 10, isBlocker: false }]), 140);
  assert.equal(buildPlacementCost(100, false, 11, 10, [...attack, { x: 12, y: 10, isBlocker: false }, { x: 11, y: 12, isBlocker: false }]), 140);
  assert.equal(buildPlacementCost(100, true, 11, 10, attack), 100);
});

test("repair pack restores ninety percent and core regeneration requires safety", () => {
  assert.equal(emergencyRepairAmount(200), 180);
  assert.equal(coreRegenAmount(200, 1000, 4, CORE_REGEN_DELAY_MS - 1), 0);
  assert.equal(coreRegenAmount(200, 1000, 5, CORE_REGEN_DELAY_MS), 0);
  assert.equal(coreRegenAmount(200, 1000, 4, CORE_REGEN_DELAY_MS), 12);
});

test("blocked attackers switch from routing to installation siege", () => {
  assert.equal(siegeResponse({ adjacentEnemyInstallation: true, pathBlockedByEnemyInstallation: true, reachableEnemyInstallation: true }), "attack");
  assert.equal(siegeResponse({ adjacentEnemyInstallation: false, pathBlockedByEnemyInstallation: false, reachableEnemyInstallation: true }), "approach");
  assert.equal(siegeResponse({ adjacentEnemyInstallation: false, pathBlockedByEnemyInstallation: false, reachableEnemyInstallation: false }), "continue");
});

test("only minions damage normal cores and exposed-core roles stay distinct", () => {
  assert.equal(canDamageCore({ role: "minion", isCampaign: false, campaignChapter: 0 }), true);
  assert.equal(canDamageCore({ role: "hero", isCampaign: false, campaignChapter: 0 }), false);
  assert.equal(canDamageCore({ role: "turret", isCampaign: false, campaignChapter: 0 }), false);
  assert.equal(canDamageCore({ role: "hero", isCampaign: true, campaignChapter: 4 }), true);
  assert.equal(exposedCoreDamage(100, { role: "minion", minionRole: "breaker" }), 312.5);
  assert.equal(exposedCoreDamage(100, { role: "minion", minionRole: "escort" }), 125);
  assert.equal(exposedCoreDamage(100, { role: "minion", minionRole: "shooter" }), 100);
});

test("emergency breaching only breaks enemy player-filled earth after a delay", () => {
  const base = { minionRole: "breaker", noPathMs: EMERGENCY_BREACH_DELAY_MS, team: "red" };
  assert.equal(canEmergencyBreach({ ...base, tile: { type: 5, filledBy: "blue" } }), true);
  assert.equal(canEmergencyBreach({ ...base, noPathMs: EMERGENCY_BREACH_DELAY_MS - 1, tile: { type: 5, filledBy: "blue" } }), false);
  assert.equal(canEmergencyBreach({ ...base, tile: { type: 5, filledBy: "red" } }), false);
  assert.equal(canEmergencyBreach({ ...base, tile: { type: 2 } }), false);
  assert.equal(canEmergencyBreach({ ...base, minionRole: "escort", tile: { type: 5, filledBy: "blue" } }), false);
});
