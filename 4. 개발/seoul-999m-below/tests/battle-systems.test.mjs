import assert from "node:assert/strict";
import test from "node:test";
import { BATTLE_MAPS, OPEN_FRONT_BATTLE_MAPS, SECRET_TUNNEL_MAPS, applyBattleMapLayout, battleExplorationSectors, battleMapsForRuleset, defaultBattleMapForRuleset, resolveBattleSpawns, resolveLocalBattleSpawns } from "../game/battleMaps.ts";
import { siegeResponse } from "../game/aiSiegeRules.ts";
import { buildPlacementCost, nearbyAttackFacilityCount } from "../game/buildRules.ts";
import { CORE_REGEN_DELAY_MS, coreRegenAmount, emergencyRepairAmount } from "../game/healingRules.ts";
import { decideHeroAction } from "../game/heroBrain.ts";
import { DRILL_ACTION_LOCK_MS, DRILL_RANGE_MULTIPLIER, expandedDrillReach, radialDrillOffsets } from "../game/drillRules.ts";
import { BUILDABLES, HERO_LEVELS, MINIONS, MINION_LEVELS, minionLevelForWave, supportAuraAppliesToRole, supportAuraValue } from "../game/content.ts";
import { HERO_KITS } from "../game/heroKits.ts";
import { HERO_TALENT_TREES, TALENT_LEVELS, combineHeroTalentEffects, heroTalentChoices } from "../game/heroTalents.ts";
import { CAMPAIGN1_MAX_ACTIVE_INVADERS, CAMPAIGN1_REGROUP_AFTER_MS, CAMPAIGN1_RETREAT_AFTER_MS, CAMPAIGN1_SCOUT_EXIT_MS, CAMPAIGN1_VENT_DELAY_MS, CAMPAIGN1_WAVE_COUNTS, CAMPAIGN2_SCIENTIST_START_DELAY_MS, CAMPAIGN_ASSIST_RADIUS, CAMPAIGN_COMPANION_AGGRO_DISTANCE, CAMPAIGN_COMPANION_ASSIST_DISTANCE, CAMPAIGN_COMPANION_ASSIST_MEMORY_MS, CAMPAIGN_COMPANION_BLOCKED_RECOVERY_MS, CAMPAIGN_COMPANION_DISCONNECTED_RECOVERY_MS, CAMPAIGN_COMPANION_HARD_RECOVERY_MS, CAMPAIGN_COMPANION_LEASH_DISTANCE, CAMPAIGN_COMPANION_RECOVERY_DISTANCE, CAMPAIGN_COMPANION_STALL_RECOVERY_MS, CAMPAIGN_SENTRY_AGGRO_DISTANCE, campaign1AdvanceWatch, campaign1BossShouldEnter, campaign1ShouldForceExit, campaign1VictoryReady, campaign2EscortOutcome, campaign3ArenaHeal, campaignCompanionGoalOffsets, campaignCompanionMode, campaignCompanionMoveDuration, campaignCompanionShouldEmergencyRejoin, campaignCompanionShouldHardRejoin, campaignShouldEngageLocalObjective, campaign5FirstGateReady, campaignStageIsActive, isCampaignSentryChapter, shouldRemoveSpawnOrder, shouldUseCampaign1GuardGoal } from "../game/campaignRules.ts";
import { canDamageCore, canDamageShield, exposedCoreDamage } from "../game/coreCombatRules.ts";
import { CAMPAIGN_OBJECTIVES, campaignObjectiveProgress } from "../game/campaignObjectives.ts";
import { CAMPAIGN_CINEMATICS, CAMPAIGN_PROLOGUE_STORAGE_KEY, CAMPAIGN_PROLOGUE_VIDEO, campaignChapterStatus, completeCampaignChapter, hasSeenCampaignPrologue, parseCampaignChapterList, unlockedCampaignChapter } from "../game/campaignProgress.ts";
import { advanceRouteCursor, attackPositionCandidates, diverseRouteToGoal, forwardRouteRejoin, reachableFrontierGoal, shortestRouteToAny, stitchRoutePoints } from "../game/gridNavigation.ts";
import { EMERGENCY_BREACH_DELAY_MS, canEmergencyBreach } from "../game/minionBreachRules.ts";
import { MINION_COMBAT_SLOT_MEMORY_MS, MINION_FLANK_REPLAN_MS, chooseCombatApproachSlot, minionCombatDetourAllowance } from "../game/minionCoordination.ts";
import { ONLINE_REMOTE_INTERPOLATION_MS, ONLINE_SNAPSHOT_INTERVAL_MS, ONLINE_SOCKET_HEARTBEAT_MS, ONLINE_SOCKET_RECONNECT_MAX_MS, newestOnlineRoomView, opponentTeam, shouldApplyAuthoritativeHeroPosition } from "../game/onlineRoom.ts";
import { guaranteedMinionLevelForWave, minionResearchReady, minionResearchUnlockWave, nextMinionResearch, teamMinionLevels } from "../game/minionResearch.ts";
import { ELITE_RECOVERY_SCALE, ELITE_TACTICAL_EFFECT_SCALE, TACTICAL_RECOVERY_FRACTION, TACTICAL_SHARED_COOLDOWN_MS, tacticalBuffVisual, tacticalDefinition } from "../game/tacticalSupport.ts";
import { AUTONOMOUS_FRONTIER_REPLAN_MS, MINION_ENGAGEMENT_RADIUS, MINION_PURSUIT_DISTANCE, MINION_TARGET_MEMORY_MS, computerWaveFormation, frontLineScreenGoal, marchStanceBehavior, minionExplorationCohort, retainCoreDiscovery, secretTunnelCoreEntryGoal, skirmishHeroAggroRadius, skirmishHeroShouldPursue, teamHasSpottedCore, triangulateCoreAfterTimeout } from "../game/skirmishAi.ts";
import { ELITE_RESERVATION_COST, ELITE_UNLOCK_WAVE, REINFORCEMENT_MINION_CAP, canReserveElite, createEliteDeploymentState, reinforcementFormation, withReservedElite } from "../game/eliteMinions.ts";
import { COMPUTER_CREDIT_MULTIPLIER, ELITE_KILL_CREDITS, HERO_KILL_CREDITS, INSTALLATION_REWARD_RATE, MINION_KILL_CREDITS, SKIRMISH_STARTING_CREDITS, creditedAmount, installationKillCredits } from "../game/skirmishEconomy.ts";
import { SECRET_TUNNEL_ASSAULT_SECONDS, SECRET_TUNNEL_DRILL_COOLDOWN_MULTIPLIER, SECRET_TUNNEL_MATCH_MS, SECRET_TUNNEL_PREPARE_MS, SECRET_TUNNEL_PREPARE_SECONDS, SECRET_TUNNEL_PREPARE_SPEED_MULTIPLIER, TUNNEL_ACCESS, allocateSecretTunnelWave, canTraverseSecretTunnel, canTraverseSecretTunnelInPhase, chooseSecretTunnelRoute, createSecretTunnelOverlay, digSecretTunnelTile, digSecretTunnelTileAndShareContacts, evaluateSecretTunnelConnections, resolveSecretTunnelPreparation, resolveSecretTunnelTimeout, sealSecretTunnelTileForTeam, secretTunnelPhaseAt, secretTunnelPrepareDuration, secretTunnelRushDigDamage, secretTunnelTileAt, secretTunnelTileViewForTeam, selectSecretTunnelContact, shareAdjacentSecretTunnelContacts, shareSecretTunnelBackbone } from "../game/secretTunnelRules.ts";

const blankGrid = () =>
  Array.from({ length: 36 }, (_, y) =>
    Array.from({ length: 56 }, (_, x) =>
      x === 0 || y === 0 || x === 55 || y === 35
        ? { type: 4, hp: 99, max: 99, obstacle: "ledge" }
        : { type: 2, hp: 3, max: 3 },
    ),
  );

test("campaign chapters unlock in order and keep completed missions replayable", () => {
  assert.equal(hasSeenCampaignPrologue(null), false);
  assert.equal(hasSeenCampaignPrologue("0"), false);
  assert.equal(hasSeenCampaignPrologue("1"), true);
  assert.equal(CAMPAIGN_PROLOGUE_STORAGE_KEY, "seoul999m.prologueSeen");
  assert.equal(CAMPAIGN_PROLOGUE_VIDEO, "/assets/opening/seoul-999m-opening-v12.mp4");
  assert.deepEqual(parseCampaignChapterList(null), []);
  assert.deepEqual(parseCampaignChapterList('[3,1,1,9,"2"]'), [1, 3]);
  assert.equal(unlockedCampaignChapter([]), 1);
  assert.equal(campaignChapterStatus(1, []), "available");
  assert.equal(campaignChapterStatus(2, []), "locked");

  const afterOne = completeCampaignChapter([], 1);
  assert.deepEqual(afterOne, [1]);
  assert.equal(campaignChapterStatus(1, afterOne), "completed");
  assert.equal(campaignChapterStatus(2, afterOne), "available");
  assert.equal(campaignChapterStatus(3, afterOne), "locked");

  const all = [1, 2, 3, 4, 5];
  assert.equal(unlockedCampaignChapter(all), 5);
  assert.equal(campaignChapterStatus(5, all), "completed");
  assert.equal(CAMPAIGN_CINEMATICS[4], "/assets/campaign/cinematics/human_story_04.mp4");
});

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

const reachableWithoutDigging = (grid, start, goal) => {
  const queue = [start], seen = new Set([`${start.x},${start.y}`]);
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`, tile = grid[y]?.[x];
      if (!tile || seen.has(key) || tile.type !== 0) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen.has(`${goal.x},${goal.y}`);
};

test("all twelve heroes have two meaningful choices at the slower levels 3, 6, and 9", () => {
  assert.deepEqual(TALENT_LEVELS, [3, 6, 9]);
  assert.equal(HERO_LEVELS.at(-1)?.level, 9);
  assert.ok(HERO_LEVELS[1].xp >= 140, "early levels must no longer finish after one brief fight");
  assert.equal(Object.keys(HERO_TALENT_TREES).length, 12);
  for (const [heroId, tree] of Object.entries(HERO_TALENT_TREES)) {
    assert.equal(tree.length, 6, `${heroId} must have three two-branch tiers`);
    for (const level of TALENT_LEVELS)
      assert.equal(heroTalentChoices(heroId, level).length, 2, `${heroId} level ${level}`);
    assert.equal(new Set(tree.map((talent) => talent.id)).size, 6, `${heroId} talent ids`);
    assert.ok(tree.every((talent) => talent.name && talent.description && talent.icon && Object.keys(talent.effect).length), `${heroId} talent presentation/effects`);
  }
  const tripleSlash = combineHeroTalentEffects("yoo-seungcheon", ["yoo-triple-delivery"]);
  assert.equal(tripleSlash.basicCount, 3);
  assert.equal(tripleSlash.basicDamageMultiplier, .58);
  const layered = combineHeroTalentEffects("yoo-seungcheon", ["yoo-blue-overdrive", "yoo-drill-warranty", "yoo-unlimited"]);
  assert.equal(layered.moveSpeedMultiplier, 1.12);
  assert.equal(layered.drillWidthBonus, 1);
  assert.equal(layered.ultimateCooldownMultiplier, .6);
});

test("all campaign chapters explain exact victory, defeat, and live progress", () => {
  assert.equal(Object.keys(CAMPAIGN_OBJECTIVES).length, 5);
  for (const chapter of [1, 2, 3, 4, 5]) {
    assert.ok(CAMPAIGN_OBJECTIVES[chapter].victory, `chapter ${chapter} victory`);
    assert.ok(CAMPAIGN_OBJECTIVES[chapter].defeat, `chapter ${chapter} defeat`);
  }
  assert.match(
    campaignObjectiveProgress(1, { phase: 2, enemies: 4, subjectsAlive: 0, subjectsCompleted: 0, enemyCoreHp: 0, missionTime: 0 }),
    /철각.*4기/,
  );
  assert.equal(
    campaignObjectiveProgress(2, { phase: 0, enemies: 9, subjectsAlive: 2, subjectsCompleted: 0, enemyCoreHp: 0, missionTime: 0 }),
    "박사 생존 2/3 · 평택 도착 0/1",
  );
  assert.equal(
    campaignObjectiveProgress(5, { phase: 2, enemies: 5, subjectsAlive: 0, subjectsCompleted: 0, enemyCoreHp: 0, missionTime: 128 }),
    "2/3단계 · 군체장 격파 · 남은 시간 2:08",
  );
});

test("all ten maps stay symmetric in spawn distance and remain dig-connectable", () => {
  assert.equal(SECRET_TUNNEL_MAPS.length, 3);
  assert.equal(OPEN_FRONT_BATTLE_MAPS.length, 7);
  assert.equal(BATTLE_MAPS.length, 10);
  assert.deepEqual(battleMapsForRuleset("secret-tunnel"), SECRET_TUNNEL_MAPS);
  assert.deepEqual(battleMapsForRuleset("open-front"), OPEN_FRONT_BATTLE_MAPS);
  assert.equal(defaultBattleMapForRuleset("secret-tunnel"), "secret-crossroads");
  assert.equal(defaultBattleMapForRuleset("open-front"), "central-exchange");
  for (const map of BATTLE_MAPS) {
    const grid = blankGrid();
    applyBattleMapLayout(grid, map.id);
    assert.equal(map.spawns.blue.y, map.spawns.red.y, `${map.id} spawn row`);
    assert.equal(map.spawns.blue.x + map.spawns.red.x, 55, `${map.id} rotational spawn pair`);
    assert.equal(reachableWithDigging(grid, map.spawns.blue, map.spawns.red), true, `${map.id} connectivity`);
  }
});

test("secret-tunnel maps provide public rooms without pre-opening a complete core route", () => {
  for (const map of SECRET_TUNNEL_MAPS) {
    const grid = blankGrid();
    applyBattleMapLayout(grid, map.id);
    const publicCells = grid.flat().filter((tile) => tile.type === 0).length - 9 * 9 * 2;
    const oreCells = grid.flat().filter((tile) => tile.ore).length;
    assert.ok(publicCells >= 30, `${map.id} needs meaningful pre-opened public space`);
    assert.ok(oreCells >= 24, `${map.id} needs at least 24 ore-bearing walls`);
    for (let y = 0; y < grid.length; y++)
      for (let x = 0; x < grid[y].length; x++)
        if (grid[y][x].ore)
          assert.ok(grid[grid.length - 1 - y][grid[y].length - 1 - x].ore, `${map.id} ore field must be rotationally symmetric`);
    assert.equal(
      reachableWithoutDigging(grid, map.spawns.blue, map.spawns.red),
      false,
      `${map.id} must still require a secret tunnel`,
    );
    assert.equal(map.spawnPairs.length, 1, `${map.id} uses the readable horizontal core layout`);
  }
});

test("battle seeds randomize every legal base pair while online clients keep one canonical world", () => {
  for (const map of BATTLE_MAPS) {
    const layouts = new Set();
    for (let seed = 0; seed < 256; seed++) {
      const resolved = resolveBattleSpawns(map, seed);
      assert.notDeepEqual(resolved.blue, resolved.red, `${map.id} bases must not overlap`);
      layouts.add(`${resolved.blue.x},${resolved.blue.y}>${resolved.red.x},${resolved.red.y}`);
    }
    assert.ok(layouts.size >= map.spawnPairs.length, `${map.id} must use all random spawn pairs`);
  }

  const map = BATTLE_MAPS[0],
    seed = 98321,
    blueSpawns = resolveLocalBattleSpawns(map, seed, "blue"),
    redSpawns = resolveLocalBattleSpawns(map, seed, "red");
  assert.deepEqual(blueSpawns.canonical, redSpawns.canonical);
  assert.deepEqual(blueSpawns.ally, redSpawns.enemy);
  assert.deepEqual(blueSpawns.enemy, redSpawns.ally);
});

test("computer scouts retain core intel and switch later waves to coordinated pressure", () => {
  const core = { x: 49, y: 18 },
    farScout = { alive: true, team: "red", x: 30, y: 18 },
    nearScout = { alive: true, team: "red", x: 44, y: 18 };
  assert.equal(teamHasSpottedCore([farScout], "red", core), false);
  let known = retainCoreDiscovery(false, teamHasSpottedCore([nearScout], "red", core));
  assert.equal(known, true);
  known = retainCoreDiscovery(known, teamHasSpottedCore([], "red", core));
  assert.equal(known, true, "team knowledge must survive the scout being destroyed");
  assert.deepEqual(computerWaveFormation({ coreDiscovered: true, ownCoreDanger: false, wave: 2 }), [
    "escort", "breaker", "breaker", "breaker",
  ]);
  assert.deepEqual(computerWaveFormation({ coreDiscovered: true, ownCoreDanger: true, wave: 2 }), [
    "escort", "escort", "breaker", "shooter",
  ]);
  assert.deepEqual(frontLineScreenGoal({ x: 40, y: 18 }, { x: 49, y: 18 }, "artillery"), { x: 43, y: 18 });
  const sectors = battleExplorationSectors(OPEN_FRONT_BATTLE_MAPS[0], { x: 6, y: 18 });
  assert.ok(sectors.some((point) => point.x === 45 && point.y === 29));
  assert.ok(sectors.some((point) => point.x === 28 && point.y === 30));
});

test("uncommanded squads advance to the reachable frontier and heroes keep a real pursuit", () => {
  const sealedOpen = new Set(["1,1", "2,1", "1,2", "2,2"]),
    sealedFrontier = reachableFrontierGoal(
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      (x, y) => sealedOpen.has(`${x},${y}`),
    );
  assert.deepEqual(sealedFrontier?.goal, { x: 2, y: 1 });
  assert.equal(sealedFrontier?.reachedDesired, false);

  const detourOpen = new Set([
      "1,1", "1,2", "1,3", "1,4", "2,4", "3,4", "4,4", "5,4", "5,3", "5,2", "5,1",
    ]),
    detourFrontier = reachableFrontierGoal(
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      (x, y) => detourOpen.has(`${x},${y}`),
    );
  assert.deepEqual(detourFrontier?.goal, { x: 5, y: 1 });
  assert.equal(detourFrontier?.reachedDesired, true);
  assert.equal(detourFrontier?.travelDistance, 10);

  const aggroRadius = skirmishHeroAggroRadius(7);
  assert.equal(aggroRadius, 12);
  assert.equal(skirmishHeroShouldPursue({ directDistance: 11, routeDistance: null, aggroRadius, locked: false }), true);
  assert.equal(skirmishHeroShouldPursue({ directDistance: 20, routeDistance: 26, aggroRadius, locked: true }), true);
  assert.equal(skirmishHeroShouldPursue({ directDistance: 20, routeDistance: 26, aggroRadius, locked: false }), false);
  assert.equal(skirmishHeroShouldPursue({ directDistance: 20, routeDistance: 29, aggroRadius, locked: true }), false);
  assert.equal(skirmishHeroShouldPursue({
    directDistance: 4,
    routeDistance: null,
    aggroRadius,
    locked: true,
    forced: true,
    targetAccessible: false,
  }), false);
  assert.equal(triangulateCoreAfterTimeout(false, 23_999), false);
  assert.equal(triangulateCoreAfterTimeout(false, 24_000), true);
  assert.equal(triangulateCoreAfterTimeout(true, 0), true);
  assert.equal(AUTONOMOUS_FRONTIER_REPLAN_MS, 3500);
});

test("route cursor, tunnel core goals, and open-front stances preserve an offensive objective", () => {
  const cells = [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }];
  assert.deepEqual(advanceRouteCursor({ x: 2, y: 3 }, cells, 0), {
    index: 2,
    goal: { x: 4, y: 3 },
    atEnd: false,
  });
  assert.deepEqual(advanceRouteCursor({ x: 4, y: 3 }, cells, 1), {
    index: 2,
    goal: { x: 4, y: 3 },
    atEnd: true,
  });
  const longRoute = Array.from({ length: 12 }, (_, x) => ({ x, y: 4 }));
  assert.deepEqual(advanceRouteCursor({ x: 8, y: 4 }, longRoute, 1), {
    index: 10,
    goal: { x: 10, y: 4 },
    atEnd: false,
  });
  const rejoin = forwardRouteRejoin(
    { x: 8, y: 5 },
    longRoute,
    5,
    (x, y) => x >= 0 && x < 12 && y >= 4 && y <= 5,
  );
  assert.ok(rejoin.index >= 8, "a sidestepped minion must rejoin only ahead of its cursor");
  assert.deepEqual(rejoin.plan?.goal, { x: rejoin.index, y: 4 });

  const core = { x: 48, y: 18 },
    upperEntry = secretTunnelCoreEntryGoal(core, 0),
    lowerEntry = secretTunnelCoreEntryGoal(core, 1);
  assert.deepEqual(upperEntry, { x: 48, y: 16 });
  assert.deepEqual(lowerEntry, { x: 48, y: 20 });
  assert.ok(Math.max(Math.abs(upperEntry.x - core.x), Math.abs(upperEntry.y - core.y)) <= 4);
  assert.ok(Math.max(Math.abs(lowerEntry.x - core.x), Math.abs(lowerEntry.y - core.y)) <= 4);

  assert.deepEqual(marchStanceBehavior("assault"), {
    pursuitRadius: 7,
    captureLeashRadius: 0,
    continuesToCore: true,
    holdsAtRally: false,
  });
  assert.deepEqual(marchStanceBehavior("guard"), {
    pursuitRadius: 0,
    captureLeashRadius: 0,
    continuesToCore: false,
    holdsAtRally: true,
  });
  assert.deepEqual(marchStanceBehavior("capture"), {
    pursuitRadius: 6,
    captureLeashRadius: 5,
    continuesToCore: false,
    holdsAtRally: true,
  });
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
    decideHeroAction(context({ role: "support", allyHpRatio: 0.1, targetDistance: 4, cooldowns: [1, 0, 1, 1] })).action,
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

test("campaign 1 deploys its boss with wave 2 and requires that boss before victory", () => {
  assert.deepEqual(CAMPAIGN1_WAVE_COUNTS, { 1: 18, 2: 24 });
  assert.equal(CAMPAIGN1_MAX_ACTIVE_INVADERS, 9);
  assert.equal(CAMPAIGN1_SCOUT_EXIT_MS + CAMPAIGN1_VENT_DELAY_MS, 8200);
  assert.equal(shouldRemoveSpawnOrder(false, -9000, true), false);
  assert.equal(shouldRemoveSpawnOrder(false, -5000, false), true);
  assert.equal(campaign1BossShouldEnter(2, true, 24), true);
  assert.equal(campaign1BossShouldEnter(2, true, 9), true);
  assert.equal(campaign1BossShouldEnter(2, true, 25), false);
  assert.equal(campaign1BossShouldEnter(1, true, 0), false);
  assert.equal(campaign1VictoryReady(2, false, 0, 0), false);
  assert.equal(campaign1VictoryReady(2, true, 0, 1), false);
  assert.equal(campaign1VictoryReady(2, true, 0, 0), true);
});

test("campaign 2 succeeds with any survivors and fails only when every scientist dies", () => {
  assert.equal(CAMPAIGN2_SCIENTIST_START_DELAY_MS, 5000);
  assert.deepEqual(campaign2EscortOutcome(3, 2, 2), { failed: false, won: true });
  assert.deepEqual(campaign2EscortOutcome(3, 2, 1), { failed: false, won: true });
  assert.deepEqual(campaign2EscortOutcome(3, 1, 1), { failed: false, won: true });
  assert.deepEqual(campaign2EscortOutcome(3, 0, 0), { failed: true, won: false });
});

test("campaign companion stays close but commits to reachable local enemies", () => {
  assert.equal(CAMPAIGN_COMPANION_LEASH_DISTANCE, 8);
  assert.equal(CAMPAIGN_COMPANION_AGGRO_DISTANCE, 24);
  assert.equal(CAMPAIGN_COMPANION_ASSIST_DISTANCE, 160);
  assert.equal(CAMPAIGN_COMPANION_ASSIST_MEMORY_MS, 20000);
  assert.equal(campaignCompanionMode(7, 3, true), "engage");
  assert.equal(campaignCompanionMode(9, 3, true), "follow");
  assert.equal(campaignCompanionMode(2, 25, true), "follow");
  assert.equal(campaignCompanionMode(2, 7, false), "follow");
  assert.equal(campaignCompanionMode(8, 12, true), "engage");
  assert.equal(campaignCompanionMode(2, 13, true), "engage");
  assert.equal(campaignCompanionMode(20, 20, true, true), "engage");
  assert.equal(campaignCompanionMode(20, 159, true, true), "engage");
  assert.equal(campaignCompanionMode(20, 161, true, true), "follow");
  assert.equal(campaignCompanionMoveDuration(2), 260);
  assert.equal(campaignCompanionMoveDuration(6), 148);
  assert.equal(campaignCompanionMoveDuration(20), 120);
  assert.equal(campaignCompanionMoveDuration(20, 0.5), 120 / 0.55);
  assert.equal(campaignShouldEngageLocalObjective(0), true);
  assert.equal(campaignShouldEngageLocalObjective(24), true);
  assert.equal(campaignShouldEngageLocalObjective(25), false);
  assert.equal(campaignShouldEngageLocalObjective(3, true), false);
  assert.equal(campaignShouldEngageLocalObjective(Infinity), false);
  const adjacentFormation = campaignCompanionGoalOffsets(1),
    recoveryFormation = campaignCompanionGoalOffsets(2);
  assert.equal(adjacentFormation.length, 8);
  assert.equal(recoveryFormation.length, 24);
  assert.ok(recoveryFormation.slice(0, 8).every(({ x, y }) => Math.max(Math.abs(x), Math.abs(y)) === 1));
  assert.ok(recoveryFormation.slice(8).every(({ x, y }) => Math.max(Math.abs(x), Math.abs(y)) === 2));
});

test("campaign 4 companion recovers from occupied corridors before becoming permanently idle", () => {
  assert.equal(CAMPAIGN_COMPANION_BLOCKED_RECOVERY_MS, 1800);
  assert.equal(CAMPAIGN_COMPANION_DISCONNECTED_RECOVERY_MS, 2600);
  assert.equal(CAMPAIGN_COMPANION_STALL_RECOVERY_MS, 2200);
  assert.equal(CAMPAIGN_COMPANION_HARD_RECOVERY_MS, 10000);
  assert.equal(CAMPAIGN_COMPANION_RECOVERY_DISTANCE, 5);
  assert.equal(campaignCompanionShouldEmergencyRejoin(true, false, 1799, 0, 8), false);
  assert.equal(campaignCompanionShouldEmergencyRejoin(true, false, 1800, 0, 8), true);
  assert.equal(campaignCompanionShouldEmergencyRejoin(true, true, 3000, 0, 8), false);
  assert.equal(campaignCompanionShouldEmergencyRejoin(false, false, 0, 2599, 8), false);
  assert.equal(campaignCompanionShouldEmergencyRejoin(false, false, 0, 2600, 8), true);
  assert.equal(campaignCompanionShouldEmergencyRejoin(false, false, 0, 5000, 4), false);
  assert.equal(campaignCompanionShouldEmergencyRejoin(true, true, 0, 0, 8, 2199, false), false);
  assert.equal(campaignCompanionShouldEmergencyRejoin(true, true, 0, 0, 8, 2200, false), true);
  assert.equal(campaignCompanionShouldEmergencyRejoin(true, true, 0, 0, 8, 5000, true), false);
  assert.equal(campaignCompanionShouldEmergencyRejoin(true, true, 0, 0, 4, 5000, false), false);
  assert.equal(campaignCompanionShouldHardRejoin(true, 9999, 8, false), false);
  assert.equal(campaignCompanionShouldHardRejoin(true, 10000, 4, false), false);
  assert.equal(campaignCompanionShouldHardRejoin(true, 10000, 8, true), false);
  assert.equal(campaignCompanionShouldHardRejoin(false, 10000, 8, false), false);
  assert.equal(campaignCompanionShouldHardRejoin(true, 10000, 8, false), true);
});

test("Yoo Seung-cheon radial drill breaks all eight neighboring cells", () => {
  const basic = radialDrillOffsets(1), expanded = radialDrillOffsets(2);
  assert.equal(DRILL_RANGE_MULTIPLIER, 1.5);
  assert.equal(DRILL_ACTION_LOCK_MS, 120);
  assert.equal(expandedDrillReach(1), 2);
  assert.equal(expandedDrillReach(4), 6);
  assert.equal(expandedDrillReach(5), 8);
  assert.equal(expandedDrillReach(9), 14);
  assert.throws(() => expandedDrillReach(-1), RangeError);
  assert.equal(basic.length, 8);
  assert.equal(new Set(basic.map(({ x, y }) => `${x},${y}`)).size, 8);
  assert.ok(basic.some(({ x, y }) => x === 1 && y === 1));
  assert.ok(basic.some(({ x, y }) => x === -1 && y === -1));
  assert.equal(expanded.length, 24);
  assert.ok(expanded.every(({ x, y }) => Math.max(Math.abs(x), Math.abs(y)) <= 2));
});

test("campaign 2, 4, and 5 enemies use local sentry behavior", () => {
  assert.equal(CAMPAIGN_ASSIST_RADIUS, 20);
  assert.equal(CAMPAIGN_SENTRY_AGGRO_DISTANCE, 9);
  assert.equal(isCampaignSentryChapter(1), false);
  assert.equal(isCampaignSentryChapter(2), true);
  assert.equal(isCampaignSentryChapter(4), true);
  assert.equal(isCampaignSentryChapter(5), true);
});

test("grid navigation uses the real detour distance instead of distance through a wall", () => {
  const blocked = new Set(["2,0", "2,1", "2,2", "2,3"]),
    isOpen = (x, y) => x >= 0 && y >= 0 && x < 5 && y < 5 && !blocked.has(`${x},${y}`),
    route = shortestRouteToAny({ x: 1, y: 2 }, [{ x: 3, y: 2 }], isOpen);
  assert.ok(route);
  assert.equal(Math.hypot(3 - 1, 2 - 2), 2);
  assert.equal(route.distance, 6);
  assert.deepEqual(route.step, { x: 0, y: 1 });
});

test("combat routing stops on a free attack cell instead of the occupied target cell", () => {
  const target = { x: 3, y: 2 },
    candidates = attackPositionCandidates(
      target,
      1.5,
      (x, y) => x >= 0 && y >= 0 && x < 6 && y < 5 && (x !== target.x || y !== target.y),
      () => true,
    ),
    route = shortestRouteToAny({ x: 1, y: 2 }, candidates, () => true);
  assert.ok(route);
  assert.equal(candidates.some((point) => point.x === target.x && point.y === target.y), false);
  assert.deepEqual(route.goal, { x: 2, y: 2 });
  assert.equal(route.distance, 1);
});

test("strategy guidance stitches every waypoint in order", () => {
  const guide = stitchRoutePoints(
    { x: 1, y: 1 },
    [{ x: 3, y: 1 }, { x: 3, y: 3 }],
    (x, y) => x >= 0 && y >= 0 && x < 5 && y < 5,
  );
  assert.equal(guide.complete, true);
  assert.deepEqual(guide.cells[0], { x: 1, y: 1 });
  assert.deepEqual(guide.cells.at(-1), { x: 3, y: 3 });
  assert.equal(guide.cells.length, 5);
});

test("the last edited march route avoids the other route in either A/B order", () => {
  const openCells = new Set([
    "1,3", "2,3", "3,3", "7,3", "8,3", "9,3",
    "3,2", "3,1", "4,1", "5,1", "6,1", "7,1", "7,2",
    "3,4", "3,5", "4,5", "5,5", "6,5", "7,5", "7,4",
  ]);
  const isOpen = (x, y) => openCells.has(`${x},${y}`),
    start = { x: 1, y: 3 },
    goal = { x: 9, y: 3 },
    routeA = diverseRouteToGoal(start, goal, isOpen, [], {
      preferredVerticalDirection: -1,
    }),
    routeB = diverseRouteToGoal(start, goal, isOpen, routeA.cells, {
      sharedStartRadius: 1,
      sharedGoalRadius: 1,
    }),
    editedA = diverseRouteToGoal(start, goal, isOpen, routeB.cells, {
      sharedStartRadius: 1,
      sharedGoalRadius: 1,
    });

  assert.ok(routeA);
  assert.ok(routeB);
  assert.ok(editedA);
  assert.equal(routeB.pathMode, "flank");
  assert.equal(editedA.pathMode, "flank");
  assert.notDeepEqual(routeB.cells, routeA.cells);
  assert.notDeepEqual(editedA.cells, routeB.cells);
  assert.deepEqual(editedA.cells, routeA.cells);
});

test("a single unavoidable corridor remains usable and reports a shared bottleneck", () => {
  const isOpen = (x, y) => y === 2 && x >= 1 && x <= 8,
    start = { x: 1, y: 2 },
    goal = { x: 8, y: 2 },
    routeA = diverseRouteToGoal(start, goal, isOpen, [], {
      sharedStartRadius: 1,
      sharedGoalRadius: 1,
    }),
    routeB = diverseRouteToGoal(start, goal, isOpen, routeA.cells, {
      sharedStartRadius: 1,
      sharedGoalRadius: 1,
    });

  assert.ok(routeA);
  assert.ok(routeB);
  assert.equal(routeB.pathMode, "shared");
  assert.deepEqual(routeB.cells, routeA.cells);
});

test("a newly edited route prefers the far opposite side over a nearby parallel lane", () => {
  const openCells = new Set(["1,5", "2,5", "10,5", "11,5"]);
  for (let x = 2; x <= 10; x++) {
    openCells.add(`${x},4`);
    openCells.add(`${x},2`);
    openCells.add(`${x},8`);
  }
  for (const y of [3, 6, 7]) {
    openCells.add(`2,${y}`);
    openCells.add(`10,${y}`);
  }
  const start = { x: 1, y: 5 }, goal = { x: 11, y: 5 },
    isOpen = (x, y) => openCells.has(`${x},${y}`),
    existing = [start, { x: 2, y: 5 }, ...Array.from({ length: 9 }, (_, index) => ({ x: index + 2, y: 4 })), { x: 10, y: 5 }, goal],
    route = diverseRouteToGoal(start, goal, isOpen, existing, {
      sharedStartRadius: 1,
      sharedGoalRadius: 1,
    });
  assert.ok(route);
  assert.equal(route.pathMode, "flank");
  assert.ok(route.cells.some(({ y }) => y === 8), "route should enter from the opposite lower side");
  assert.ok(!route.cells.some(({ y }) => y === 2), "nearby same-side lane must not win");
  assert.ok(route.separationDistance >= 3);
});

test("B uses the lower corridor when A and B share the exact destination", () => {
  const openCells = new Set(["1,5", "2,5", "10,5", "11,5"]);
  for (let x = 2; x <= 10; x++) {
    openCells.add(`${x},2`);
    openCells.add(`${x},8`);
  }
  for (const y of [2, 3, 4, 6, 7, 8]) {
    openCells.add(`2,${y}`);
    openCells.add(`10,${y}`);
  }
  const start = { x: 1, y: 5 },
    goal = { x: 11, y: 5 },
    isOpen = (x, y) => openCells.has(`${x},${y}`),
    routeA = diverseRouteToGoal(start, goal, isOpen, [], {
      preferredVerticalDirection: -1,
    }),
    routeB = diverseRouteToGoal(start, goal, isOpen, routeA.cells, {
      sharedStartRadius: 1,
      sharedGoalRadius: 1,
      hardAvoidRadius: 2,
      preferredVerticalDirection: 1,
    });
  assert.ok(routeA);
  assert.ok(routeB);
  assert.equal(routeB.pathMode, "flank");
  assert.ok(routeB.cells.some(({ y }) => y === 8), "B must prefer the lower screen corridor");
  assert.ok(!routeB.cells.some(({ y }) => y === 2), "B must not mirror A through the upper corridor");
});

test("campaign 3 arena healing is capped at two reduced uses", () => {
  assert.equal(campaign3ArenaHeal(0, 350), 35);
  assert.equal(campaign3ArenaHeal(1, 350), 35);
  assert.equal(campaign3ArenaHeal(2, 350), 0);
});

test("campaign room stage helper still gates objective transitions", () => {
  assert.equal(campaignStageIsActive(2, 1), false);
  assert.equal(campaignStageIsActive(2, 2), true);
  assert.equal(campaign5FirstGateReady(4, 2, 2), true);
  assert.equal(campaign5FirstGateReady(4, 2, 1), false);
  assert.equal(campaign5FirstGateReady(5, 2, 2), false);
});

test("campaign 1 stragglers regroup and eventually leave the wave tally", () => {
  const advancing = campaign1AdvanceWatch(50, 49, 3200, 400);
  assert.deepEqual(advancing, { bestX: 49, stalledMs: 0, shouldRegroup: false, shouldRetreat: false });
  const regroup = campaign1AdvanceWatch(49, 49, CAMPAIGN1_REGROUP_AFTER_MS - 200, 250);
  assert.equal(regroup.shouldRegroup, true);
  assert.equal(regroup.shouldRetreat, false);
  const retreat = campaign1AdvanceWatch(49, 50, CAMPAIGN1_RETREAT_AFTER_MS - 100, 150);
  assert.equal(retreat.shouldRetreat, true);
  assert.equal(campaign1ShouldForceExit(2, 1000, 2000), true);
  assert.equal(campaign1ShouldForceExit(1, 1000, 1000 + CAMPAIGN1_RETREAT_AFTER_MS), true);
  assert.equal(campaign1ShouldForceExit(1, 1000, 1000 + CAMPAIGN1_RETREAT_AFTER_MS - 1), false);
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

test("repair pack fully restores health and core regeneration requires safety", () => {
  assert.equal(emergencyRepairAmount(200), 200);
  assert.equal(coreRegenAmount(200, 1000, 4, CORE_REGEN_DELAY_MS - 1), 0);
  assert.equal(coreRegenAmount(200, 1000, 5, CORE_REGEN_DELAY_MS), 0);
  assert.equal(coreRegenAmount(200, 1000, 4, CORE_REGEN_DELAY_MS), 12);
});

test("blocked attackers switch from routing to installation siege", () => {
  assert.equal(siegeResponse({ adjacentEnemyInstallation: true, pathBlockedByEnemyInstallation: true, reachableEnemyInstallation: true }), "attack");
  assert.equal(siegeResponse({ adjacentEnemyInstallation: false, pathBlockedByEnemyInstallation: false, reachableEnemyInstallation: true }), "approach");
  assert.equal(siegeResponse({ adjacentEnemyInstallation: false, pathBlockedByEnemyInstallation: false, reachableEnemyInstallation: false }), "continue");
});

test("heroes and minions can break shields while installations remain unable to damage cores", () => {
  assert.equal(canDamageCore({ role: "minion", isCampaign: false, campaignChapter: 0 }), true);
  assert.equal(canDamageCore({ role: "hero", isCampaign: false, campaignChapter: 0 }), true);
  assert.equal(canDamageCore({ role: "turret", isCampaign: false, campaignChapter: 0 }), false);
  assert.equal(canDamageCore({ role: "hero", isCampaign: true, campaignChapter: 4 }), true);
  assert.equal(canDamageShield({ role: "hero" }), true);
  assert.equal(canDamageShield({ role: "minion" }), true);
  assert.equal(exposedCoreDamage(100, { role: "hero" }), 35);
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

test("online guests predict their own hero locally while the host remains authoritative for everyone else", () => {
  assert.equal(opponentTeam("blue"), "red");
  assert.equal(opponentTeam("red"), "blue");
  assert.equal(shouldApplyAuthoritativeHeroPosition(false, "local-player", "local-player"), false);
  assert.equal(shouldApplyAuthoritativeHeroPosition(false, "remote-player", "local-player"), true);
  assert.equal(shouldApplyAuthoritativeHeroPosition(true, "local-player", "local-player"), true);
});

test("online friendly matches use WebSocket heartbeat, host snapshots, and reject stale room revisions", () => {
  assert.equal(ONLINE_SOCKET_HEARTBEAT_MS, 8000);
  assert.equal(ONLINE_SOCKET_RECONNECT_MAX_MS, 5000);
  assert.equal(ONLINE_SNAPSHOT_INTERVAL_MS, 250);
  assert.equal(ONLINE_REMOTE_INTERPOLATION_MS, 300);
  const current = { code: "ABC123", revision: 8 }, stale = { code: "ABC123", revision: 7 }, fresh = { code: "ABC123", revision: 9 };
  assert.equal(newestOnlineRoomView(current, stale), current);
  assert.equal(newestOnlineRoomView(current, fresh), fresh);
});

test("team minion research reaches level five while waves only guarantee a minimum", () => {
  assert.deepEqual(nextMinionResearch(1), { level: 2, cost: 90 });
  assert.deepEqual(nextMinionResearch(4), { level: 5, cost: 300 });
  assert.equal(nextMinionResearch(5), null);
  assert.deepEqual([0, 7, 15, 23, 31].map(guaranteedMinionLevelForWave), [1, 2, 3, 4, 5]);
  assert.deepEqual(teamMinionLevels(3, 1), { blue: 3, red: 1 });
  assert.deepEqual([2, 3, 4, 5].map(minionResearchUnlockWave), [3, 9, 17, 25]);
  assert.equal(minionResearchReady(3, 8), false);
  assert.equal(minionResearchReady(3, 9), true);
});

test("all factions share tactical costs and cooldown but keep distinct support behavior", () => {
  assert.equal(TACTICAL_SHARED_COOLDOWN_MS, 45000);
  for (const faction of ["human", "bugborn", "ai"]) {
    assert.equal(tacticalDefinition(faction, "defense").cost, 100);
    assert.equal(tacticalDefinition(faction, "offense").cost, 120);
    assert.equal(tacticalDefinition(faction, "area").cost, 150);
    assert.equal(tacticalDefinition(faction, "recovery").cost, 130);
    assert.equal(tacticalDefinition(faction, "reinforce").cost, 180);
    assert.match(tacticalDefinition(faction, "recovery").description, /영웅·현재 진군대/);
  }
  assert.equal(TACTICAL_RECOVERY_FRACTION, 0.03);
  assert.equal(ELITE_TACTICAL_EFFECT_SCALE, 0.7);
  assert.equal(ELITE_RECOVERY_SCALE, 0.5);
  assert.notEqual(tacticalDefinition("human", "area").name, tacticalDefinition("bugborn", "area").name);
  assert.notEqual(tacticalDefinition("bugborn", "area").name, tacticalDefinition("ai", "area").name);
});

test("active tactical buffs expose readable faction light and role badges", () => {
  for (const faction of ["human", "bugborn", "ai"]) {
    const defense = tacticalBuffVisual(faction, "defense"), offense = tacticalBuffVisual(faction, "offense"), recovery = tacticalBuffVisual(faction, "recovery");
    assert.match(defense.auraColor, /^#[0-9a-f]{6}$/i);
    assert.match(offense.sparkColor, /^#[0-9a-f]{6}$/i);
    assert.equal(defense.badge, "shield");
    assert.equal(offense.badge, "surge");
    assert.equal(recovery.badge, "plus");
    assert.notDeepEqual(defense, offense);
  }
  assert.notEqual(tacticalBuffVisual("human", "defense").auraColor, tacticalBuffVisual("bugborn", "defense").auraColor);
});

test("skirmish economy slows spam while preserving fair computer combat stats", () => {
  assert.equal(SKIRMISH_STARTING_CREDITS, 120);
  assert.deepEqual([MINION_KILL_CREDITS, ELITE_KILL_CREDITS, HERO_KILL_CREDITS], [8, 30, 35]);
  assert.equal(INSTALLATION_REWARD_RATE, 0.25);
  assert.equal(installationKillCredits(40), 10);
  assert.equal(installationKillCredits(200), 50);
  assert.equal(COMPUTER_CREDIT_MULTIPLIER, 1.08);
  assert.equal(creditedAmount(35, true), 38);
});

test("each faction owns one rare elite, one persistent support, and three attack choices", () => {
  const expectedControl = { human: "shock", bugborn: "acid", ai: "tether" };
  for (const faction of ["human", "bugborn", "ai"]) {
    const elite = MINIONS.find((unit) => unit.faction === faction && unit.role === "elite"),
      factionBuildings = BUILDABLES.filter((building) => building.faction === faction),
      support = factionBuildings.find((building) => building.category === "support"),
      attacks = factionBuildings.filter((building) => building.category === "multi" || building.category === "ranged"),
      control = attacks.find((building) => building.control);
    assert.ok(elite);
    assert.ok(elite.stats.maxHp >= 200);
    assert.ok(support?.supportAura);
    assert.equal(supportAuraValue(support.supportAura, 1), support.supportAura.value);
    assert.equal(supportAuraValue(support.supportAura, 2), support.supportAura.upgradedValue);
    assert.equal(attacks.length, 3);
    assert.equal(control?.control?.kind, expectedControl[faction]);
  }
  const aiAura = BUILDABLES.find((building) => building.id === "targetRelay")?.supportAura;
  assert.equal(supportAuraAppliesToRole(aiAura, "breaker"), false);
  assert.equal(supportAuraAppliesToRole(aiAura, "shooter"), true);
});

test("elite reservation replaces one regular slot and emergency support adds five regulars", () => {
  const state = createEliteDeploymentState();
  assert.equal(ELITE_UNLOCK_WAVE, 6);
  assert.equal(ELITE_RESERVATION_COST, 150);
  assert.equal(canReserveElite({ wave: 5, credits: 999, activeElites: 0, state }), false);
  assert.equal(canReserveElite({ wave: 6, credits: 150, activeElites: 0, state }), true);
  const formation = withReservedElite(["escort", "breaker", "breaker", "shooter"], true);
  assert.equal(formation.length, 4);
  assert.equal(formation.filter((role) => role === "elite").length, 1);
  assert.deepEqual(reinforcementFormation(), ["escort", "breaker", "breaker", "shooter", "shooter"]);
  assert.equal(REINFORCEMENT_MINION_CAP, 17);
});

test("uncommanded minions share a wave cohort and hold targets long enough to fight", () => {
  assert.equal(minionExplorationCohort(6, 99), 6);
  assert.equal(minionExplorationCohort(undefined, 8), 2);
  assert.equal(minionExplorationCohort(undefined, 11), 2);
  assert.equal(MINION_ENGAGEMENT_RADIUS, 8);
  assert.equal(MINION_PURSUIT_DISTANCE, 12);
  assert.equal(MINION_TARGET_MEMORY_MS, 4200);
});

test("minion squads spread across combat slots instead of queueing behind one ally", () => {
  const target = { x: 10, y: 10 },
    baseCandidates = [
      { x: 9, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 9 },
      { x: 10, y: 11 },
      { x: 9, y: 9 },
      { x: 11, y: 9 },
      { x: 9, y: 11 },
      { x: 11, y: 11 },
    ].map((point) => ({
      ...point,
      routeDistance: 4,
      targetDistance: Math.hypot(point.x - target.x, point.y - target.y),
      crowd: 0,
      occupied: false,
      reserved: false,
    })),
    reserved = new Set(),
    selected = [];
  for (let attackerId = 1; attackerId <= 6; attackerId++) {
    const slot = chooseCombatApproachSlot(
      attackerId,
      attackerId % 3 === 0 ? "escort" : "breaker",
      1.5,
      target,
      baseCandidates.map((candidate) => ({
        ...candidate,
        reserved: reserved.has(`${candidate.x},${candidate.y}`),
      })),
    );
    assert.ok(slot);
    const key = `${slot.x},${slot.y}`;
    assert.equal(reserved.has(key), false, `attacker ${attackerId} reused ${key}`);
    reserved.add(key);
    selected.push(key);
  }
  assert.equal(new Set(selected).size, 6);

  const shooterSlot = chooseCombatApproachSlot(3, "shooter", 5, target, [
    { x: 9, y: 10, routeDistance: 4, targetDistance: 1, crowd: 0, occupied: false, reserved: false },
    { x: 14, y: 10, routeDistance: 4, targetDistance: 4, crowd: 0, occupied: false, reserved: false },
  ]);
  assert.equal(shooterSlot?.targetDistance, 4, "shooters should preserve an outer firing ring");
  assert.equal(MINION_COMBAT_SLOT_MEMORY_MS, 2200);
  assert.equal(MINION_FLANK_REPLAN_MS, 420);
  assert.equal(minionCombatDetourAllowance("breaker", 419), 0);
  assert.equal(minionCombatDetourAllowance("breaker", 420), 1);
});

test("minion progression reaches level five without changing both teams' parity", () => {
  assert.equal(MINION_LEVELS.length, 5);
  assert.deepEqual(
    [1, 7, 15, 23, 31].map(minionLevelForWave),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    [2, 4, 6, 14, 22, 30].map(minionLevelForWave),
    [1, 1, 1, 2, 3, 4],
  );
  assert.equal(MINION_LEVELS[4].hp, 1.75);
  assert.equal(MINION_LEVELS[4].damage, 1.55);
  assert.equal(MINION_LEVELS[4].speed, 1.12);
});

test("secret tunnel overlays keep each team's excavation, passage, and visibility private", () => {
  let overlay = createSecretTunnelOverlay({
    width: 3,
    height: 1,
    durability: 3,
    initialAccessAt: ({ x }) =>
      x === 0 ? TUNNEL_ACCESS.blue : x === 2 ? TUNNEL_ACCESS.red : TUNNEL_ACCESS.none,
  });

  let dig = digSecretTunnelTile(overlay, { x: 1, y: 0 }, "blue", 2);
  overlay = dig.overlay;
  assert.equal(dig.opened, false);
  assert.equal(dig.remainingDurability, 1);
  assert.equal(secretTunnelTileAt(overlay, { x: 1, y: 0 })?.durability.red, 3);
  assert.deepEqual(secretTunnelTileViewForTeam(overlay, { x: 1, y: 0 }, "blue"), {
    visibility: "digging",
    visibleAccess: TUNNEL_ACCESS.none,
    durability: 1,
    maxDurability: 3,
    canTraverse: false,
  });
  assert.equal(secretTunnelTileViewForTeam(overlay, { x: 1, y: 0 }, "red").visibility, "hidden");

  dig = digSecretTunnelTile(overlay, { x: 1, y: 0 }, "red", 3);
  overlay = dig.overlay;
  assert.equal(dig.opened, true);
  assert.equal(dig.becameShared, false);
  assert.equal(canTraverseSecretTunnel(overlay, { x: 1, y: 0 }, "red"), true);
  assert.equal(canTraverseSecretTunnel(overlay, { x: 1, y: 0 }, "blue"), false);
  assert.equal(secretTunnelTileViewForTeam(overlay, { x: 1, y: 0 }, "red").visibility, "private");
  assert.equal(secretTunnelTileViewForTeam(overlay, { x: 1, y: 0 }, "blue").visibility, "digging");

  dig = digSecretTunnelTile(overlay, { x: 1, y: 0 }, "blue", 1);
  overlay = dig.overlay;
  assert.equal(dig.opened, true);
  assert.equal(dig.becameShared, true);
  assert.equal(dig.tile.access, TUNNEL_ACCESS.shared);
  assert.equal(dig.tile.excavatedBy, TUNNEL_ACCESS.shared);
  assert.equal(canTraverseSecretTunnel(overlay, { x: 1, y: 0 }, "blue"), true);
  assert.equal(canTraverseSecretTunnel(overlay, { x: 1, y: 0 }, "red"), true);
  assert.equal(canTraverseSecretTunnelInPhase(overlay, { x: 1, y: 0 }, "blue", "prepare"), true);
  assert.equal(canTraverseSecretTunnelInPhase(overlay, { x: 1, y: 0 }, "red", "prepare"), true);
  assert.equal(canTraverseSecretTunnelInPhase(overlay, { x: 1, y: 0 }, "blue", "assault"), true);
  assert.equal(canTraverseSecretTunnelInPhase(overlay, { x: 1, y: 0 }, "red", "assault"), true);
  assert.equal(canTraverseSecretTunnelInPhase(overlay, { x: 1, y: 0 }, "blue", "finished"), false);
  assert.equal(canTraverseSecretTunnelInPhase(overlay, { x: 1, y: 0 }, "red", "finished"), false);
  assert.equal(dig.tile.sharedBackbone, false, "a raw contact is shared without becoming the selected backbone");
  assert.equal(secretTunnelTileViewForTeam(overlay, { x: 1, y: 0 }, "blue").visibility, "shared");
});

test("completed orthogonal enemy tunnels become shared while diagonal or partial contact stays private", () => {
  let overlay = createSecretTunnelOverlay({
    width: 3,
    height: 3,
    initialAccessAt: ({ x, y }) =>
      x === 0 && y === 1 ? TUNNEL_ACCESS.blue :
        x === 1 && y === 1 ? TUNNEL_ACCESS.red : TUNNEL_ACCESS.none,
  });
  const adjacent = shareAdjacentSecretTunnelContacts(overlay, { x: 0, y: 1 });
  assert.deepEqual(adjacent.changed, [{ x: 0, y: 1 }, { x: 1, y: 1 }]);
  assert.equal(secretTunnelTileAt(adjacent.overlay, { x: 0, y: 1 })?.access, TUNNEL_ACCESS.shared);
  assert.equal(secretTunnelTileAt(adjacent.overlay, { x: 1, y: 1 })?.access, TUNNEL_ACCESS.shared);

  overlay = createSecretTunnelOverlay({
    width: 3,
    height: 3,
    initialAccessAt: ({ x, y }) =>
      x === 0 && y === 0 ? TUNNEL_ACCESS.blue :
        x === 1 && y === 1 ? TUNNEL_ACCESS.red : TUNNEL_ACCESS.none,
  });
  assert.equal(shareAdjacentSecretTunnelContacts(overlay, { x: 0, y: 0 }).changed.length, 0);

  overlay = createSecretTunnelOverlay({
    width: 4,
    height: 1,
    durability: 2,
    initialAccessAt: ({ x }) =>
      x === 0 ? TUNNEL_ACCESS.blue : x === 2 ? TUNNEL_ACCESS.red : TUNNEL_ACCESS.none,
  });
  const contact = digSecretTunnelTileAndShareContacts(overlay, { x: 1, y: 0 }, "blue", 2);
  assert.equal(contact.becameShared, true);
  assert.equal(contact.tile.access, TUNNEL_ACCESS.shared);
  assert.equal(secretTunnelTileAt(contact.overlay, { x: 2, y: 0 })?.access, TUNNEL_ACCESS.shared);
  assert.equal(canTraverseSecretTunnel(contact.overlay, { x: 2, y: 0 }, "blue"), true);

  const hidden = secretTunnelTileViewForTeam(overlay, { x: 2, y: 0 }, "blue"),
    revealed = secretTunnelTileViewForTeam(overlay, { x: 2, y: 0 }, "blue", true);
  assert.equal(hidden.visibility, "hidden");
  assert.deepEqual(revealed, {
    visibility: "opponent",
    visibleAccess: TUNNEL_ACCESS.red,
    durability: null,
    maxDurability: null,
    canTraverse: false,
  });

  const partial = digSecretTunnelTile(overlay, { x: 3, y: 0 }, "red", 1);
  assert.equal(partial.opened, false);
  assert.equal(shareAdjacentSecretTunnelContacts(partial.overlay, { x: 3, y: 0 }).changed.length, 0);
});

test("secret tunnel contact shares only the deterministic core-to-contact backbone", () => {
  const cores = { blue: { x: 0, y: 1 }, red: { x: 6, y: 1 } },
    overlay = createSecretTunnelOverlay({
      width: 7,
      height: 3,
      initialAccessAt: ({ x, y }) => {
        if (x === 3 && y === 1) return TUNNEL_ACCESS.shared;
        if (y === 1 && x <= 2 || x === 1 && y === 0) return TUNNEL_ACCESS.blue;
        if (y === 1 && x >= 4 || x === 5 && y === 2) return TUNNEL_ACCESS.red;
        return TUNNEL_ACCESS.none;
      },
      initialExcavatedByAt: ({ x, y }) => {
        if (x === 3 && y === 1) return TUNNEL_ACCESS.shared;
        if (y === 1 && x > 0 && x <= 2 || x === 1 && y === 0) return TUNNEL_ACCESS.blue;
        if (y === 1 && x >= 4 && x < 6 || x === 5 && y === 2) return TUNNEL_ACCESS.red;
        return TUNNEL_ACCESS.none;
      },
    }),
    result = shareSecretTunnelBackbone(overlay, cores, { x: 3, y: 1 });

  assert.equal(result.connected, true);
  assert.deepEqual(result.backbone.map(({ x, y }) => `${x},${y}`), [
    "0,1", "1,1", "2,1", "3,1", "4,1", "5,1", "6,1",
  ]);
  assert.equal(result.changed.length, 7);
  for (let x = 0; x <= 6; x++) {
    assert.equal(secretTunnelTileAt(result.overlay, { x, y: 1 })?.access, TUNNEL_ACCESS.shared);
    assert.equal(secretTunnelTileAt(result.overlay, { x, y: 1 })?.sharedBackbone, true);
    assert.equal(canTraverseSecretTunnelInPhase(result.overlay, { x, y: 1 }, "blue", "assault"), true);
    assert.equal(canTraverseSecretTunnelInPhase(result.overlay, { x, y: 1 }, "red", "assault"), true);
  }
  assert.equal(secretTunnelTileAt(result.overlay, { x: 1, y: 0 })?.access, TUNNEL_ACCESS.blue);
  assert.equal(secretTunnelTileAt(result.overlay, { x: 5, y: 2 })?.access, TUNNEL_ACCESS.red);
});

test("secret tunnel contact selection is deterministic and defers backbone sharing", () => {
  const cores = { blue: { x: 0, y: 1 }, red: { x: 6, y: 1 } },
    overlay = createSecretTunnelOverlay({
      width: 7,
      height: 3,
      initialAccessAt: ({ x, y }) => {
        if (x === 3 && (y === 0 || y === 2)) return TUNNEL_ACCESS.shared;
        if (y === 1 && x <= 2 || x === 2 && (y === 0 || y === 2))
          return TUNNEL_ACCESS.blue;
        if (y === 1 && x >= 4 || x === 4 && (y === 0 || y === 2))
          return TUNNEL_ACCESS.red;
        return TUNNEL_ACCESS.none;
      },
      initialExcavatedByAt: ({ x, y }) => {
        if (x === 3 && (y === 0 || y === 2)) return TUNNEL_ACCESS.shared;
        if (y === 1 && x > 0 && x <= 2 || x === 2 && (y === 0 || y === 2))
          return TUNNEL_ACCESS.blue;
        if (y === 1 && x >= 4 && x < 6 || x === 4 && (y === 0 || y === 2))
          return TUNNEL_ACCESS.red;
        return TUNNEL_ACCESS.none;
      },
    }),
    before = JSON.stringify(overlay),
    selection = selectSecretTunnelContact(overlay, cores);

  assert.deepEqual(selection?.contact, { x: 3, y: 0 }, "equal routes use y then x tie-breaking");
  assert.equal(selection?.totalDistance, 8);
  assert.deepEqual(selection?.bluePath.at(0), cores.blue);
  assert.deepEqual(selection?.redPath.at(0), cores.red);
  assert.equal(JSON.stringify(overlay), before, "selection must not promote a backbone during preparation");
  assert.equal(secretTunnelTileAt(overlay, { x: 1, y: 1 })?.access, TUNNEL_ACCESS.blue);
  assert.equal(secretTunnelTileAt(overlay, { x: 5, y: 1 })?.access, TUNNEL_ACCESS.red);

  const shared = shareSecretTunnelBackbone(overlay, cores, selection.contact);
  assert.equal(shared.connected, true);
  assert.equal(secretTunnelTileAt(shared.overlay, { x: 1, y: 1 })?.access, TUNNEL_ACCESS.shared);
  assert.equal(secretTunnelTileAt(shared.overlay, { x: 3, y: 2 })?.access, TUNNEL_ACCESS.shared,
    "an independent contact remains shared without joining the selected backbone");
  assert.equal(secretTunnelTileAt(shared.overlay, { x: 3, y: 2 })?.sharedBackbone, false);
  assert.equal(canTraverseSecretTunnelInPhase(shared.overlay, { x: 3, y: 2 }, "blue", "assault"), true);
  assert.equal(canTraverseSecretTunnelInPhase(shared.overlay, { x: 3, y: 2 }, "red", "assault"), true);
  assert.equal(secretTunnelTileAt(shared.overlay, { x: 2, y: 2 })?.access, TUNNEL_ACCESS.blue);
  assert.equal(secretTunnelTileAt(shared.overlay, { x: 4, y: 2 })?.access, TUNNEL_ACCESS.red);

  const grantedOnly = createSecretTunnelOverlay({
    width: 3,
    height: 1,
    initialAccessAt: () => TUNNEL_ACCESS.shared,
  });
  assert.equal(selectSecretTunnelContact(grantedOnly, {
    blue: { x: 0, y: 0 },
    red: { x: 2, y: 0 },
  }), null, "shared access without two-sided excavation is not a contact");
});

test("secret tunnel core surroundings keep the full 9x9 open footprint on every dedicated map", () => {
  for (const map of SECRET_TUNNEL_MAPS) {
    const grid = blankGrid();
    applyBattleMapLayout(grid, map.id);
    for (const core of [map.spawns.blue, map.spawns.red])
      for (let y = core.y - 4; y <= core.y + 4; y++)
        for (let x = core.x - 4; x <= core.x + 4; x++)
          assert.equal(grid[y]?.[x]?.type, 0, `${map.id} opens core area ${x},${y}`);
  }
});

test("a shared core area is traversable by both teams without becoming a special backbone", () => {
  const overlay = createSecretTunnelOverlay({
    width: 9,
    height: 9,
    initialAccessAt: () => TUNNEL_ACCESS.shared,
  });
  for (const point of [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 8, y: 8 }]) {
    assert.equal(canTraverseSecretTunnelInPhase(overlay, point, "blue", "prepare"), true);
    assert.equal(canTraverseSecretTunnelInPhase(overlay, point, "red", "prepare"), true);
    assert.equal(secretTunnelTileAt(overlay, point)?.sharedBackbone, false);
  }
});

test("secret tunnel sealing preserves permanent shared infrastructure and protects both cores", () => {
  const cores = { blue: { x: 0, y: 0 }, red: { x: 3, y: 0 } };
  let overlay = createSecretTunnelOverlay({
    width: 4,
    height: 1,
    durability: 3,
    initialAccessAt: ({ x }) =>
      x === 0 ? TUNNEL_ACCESS.blue :
        x === 1 ? TUNNEL_ACCESS.shared :
          x === 3 ? TUNNEL_ACCESS.red : TUNNEL_ACCESS.none,
    initialExcavatedByAt: ({ x }) => x === 1 ? TUNNEL_ACCESS.shared : TUNNEL_ACCESS.none,
  });

  const sharedSeal = sealSecretTunnelTileForTeam(overlay, { x: 1, y: 0 }, "blue", cores);
  assert.equal(sharedSeal.overlay, overlay, "shared infrastructure remains immutable");
  assert.equal(sharedSeal.sealed, false);
  assert.equal(sharedSeal.blockedReason, "shared");
  assert.equal(sharedSeal.previousAccess, TUNNEL_ACCESS.shared);
  assert.equal(sharedSeal.remainingAccess, TUNNEL_ACCESS.shared);
  assert.equal(sharedSeal.tile.excavatedBy, TUNNEL_ACCESS.shared);
  assert.equal(sharedSeal.tile.durability.blue, 0);
  assert.equal(sharedSeal.tile.durability.red, 0, "opponent opening stays intact");
  assert.equal(canTraverseSecretTunnel(overlay, { x: 1, y: 0 }, "blue"), true);
  assert.equal(canTraverseSecretTunnel(overlay, { x: 1, y: 0 }, "red"), true);
  assert.equal(secretTunnelTileViewForTeam(overlay, { x: 1, y: 0 }, "red").visibility, "shared");

  overlay = digSecretTunnelTile(overlay, { x: 2, y: 0 }, "blue", 1).overlay;
  overlay = digSecretTunnelTile(overlay, { x: 2, y: 0 }, "red", 1).overlay;
  const partialSeal = sealSecretTunnelTileForTeam(overlay, { x: 2, y: 0 }, "blue", cores);
  overlay = partialSeal.overlay;
  assert.equal(partialSeal.sealed, true, "partial dig progress can be filled before opening");
  assert.equal(partialSeal.tile.durability.blue, 3);
  assert.equal(partialSeal.tile.durability.red, 2, "opponent partial dig progress is preserved");

  const coreSeal = sealSecretTunnelTileForTeam(overlay, cores.blue, "blue", cores);
  assert.equal(coreSeal.sealed, false);
  assert.equal(coreSeal.blockedReason, "core");
  assert.equal(coreSeal.overlay, overlay);
  assert.equal(coreSeal.remainingAccess, TUNNEL_ACCESS.blue);
});

test("secret tunnel preparation accepts direct or shared contact routes and isolates non-builders", () => {
  const cores = { blue: { x: 0, y: 1 }, red: { x: 6, y: 1 } },
    contactOverlay = createSecretTunnelOverlay({
      width: 7,
      height: 3,
      initialAccessAt: ({ x, y }) => {
        if (y !== 1) return TUNNEL_ACCESS.none;
        if (x === 3) return TUNNEL_ACCESS.shared;
        return x < 3 ? TUNNEL_ACCESS.blue : TUNNEL_ACCESS.red;
      },
      initialExcavatedByAt: ({ x, y }) => {
        if (y !== 1 || x === 0 || x === 6) return TUNNEL_ACCESS.none;
        if (x === 3) return TUNNEL_ACCESS.shared;
        return x < 3 ? TUNNEL_ACCESS.blue : TUNNEL_ACCESS.red;
      },
    }),
    contactConnections = evaluateSecretTunnelConnections(contactOverlay, cores);
  assert.equal(contactConnections.blue.valid, true);
  assert.equal(contactConnections.blue.kind, "shared-contact");
  assert.equal(contactConnections.red.valid, true);
  assert.equal(contactConnections.red.kind, "shared-contact");
  assert.deepEqual(resolveSecretTunnelPreparation(contactConnections), {
    phase: "assault",
    winner: null,
    reason: "both-connected",
  });

  const directCores = { blue: { x: 0, y: 0 }, red: { x: 4, y: 0 } },
    oneBuilderOverlay = createSecretTunnelOverlay({
      width: 5,
      height: 1,
      initialAccessAt: ({ x }) =>
        x === 4 ? TUNNEL_ACCESS.shared : TUNNEL_ACCESS.blue,
      initialExcavatedByAt: ({ x }) =>
        x > 0 ? TUNNEL_ACCESS.blue : TUNNEL_ACCESS.none,
    }),
    oneBuilderConnections = evaluateSecretTunnelConnections(oneBuilderOverlay, directCores);
  assert.equal(oneBuilderConnections.blue.valid, true);
  assert.equal(oneBuilderConnections.blue.kind, "direct-core");
  assert.equal(oneBuilderConnections.red.valid, false, "shared access without red excavation cannot avoid isolation");
  assert.deepEqual(resolveSecretTunnelPreparation(oneBuilderConnections), {
    phase: "finished",
    winner: "blue",
    reason: "red-isolated",
  });

  assert.deepEqual(resolveSecretTunnelPreparation({ blue: false, red: false }), {
    phase: "finished",
    winner: null,
    reason: "both-isolated",
  });
});

test("secret tunnel match timing, timeout judgment, and A/B allocations are deterministic", () => {
  assert.equal(SECRET_TUNNEL_PREPARE_SECONDS, 30);
  assert.equal(SECRET_TUNNEL_ASSAULT_SECONDS, 240);
  assert.equal(SECRET_TUNNEL_PREPARE_MS, 30000);
  assert.equal(SECRET_TUNNEL_MATCH_MS, 270000);
  assert.equal(SECRET_TUNNEL_PREPARE_SPEED_MULTIPLIER, 2.25);
  assert.equal(SECRET_TUNNEL_DRILL_COOLDOWN_MULTIPLIER, 0.25);
  assert.equal(secretTunnelPrepareDuration(95), 42);
  assert.equal(secretTunnelPrepareDuration(135), 60);
  assert.equal(secretTunnelPrepareDuration(90), 40);
  assert.throws(() => secretTunnelPrepareDuration(-1), RangeError);
  assert.equal(secretTunnelPhaseAt(29999), "prepare");
  assert.equal(secretTunnelPhaseAt(30000), "assault");
  assert.equal(secretTunnelPhaseAt(269999), "assault");
  assert.equal(secretTunnelPhaseAt(270000), "finished");
  assert.equal(secretTunnelRushDigDamage(6, 1), 6);
  assert.equal(secretTunnelRushDigDamage(0, 4), 4);
  assert.throws(() => secretTunnelRushDigDamage(-1, 1), RangeError);

  assert.deepEqual(resolveSecretTunnelTimeout({
    blue: { coreHp: 1, shieldHp: 0 },
    red: { coreHp: 0, shieldHp: 999 },
  }), { phase: "finished", winner: "blue", reason: "core-hp" });
  assert.deepEqual(resolveSecretTunnelTimeout({
    blue: { coreHp: 100, shieldHp: 40 },
    red: { coreHp: 100, shieldHp: 60 },
  }), { phase: "finished", winner: "red", reason: "shield-hp" });
  assert.deepEqual(resolveSecretTunnelTimeout({
    blue: { coreHp: 100, shieldHp: 60 },
    red: { coreHp: 100, shieldHp: 60 },
  }), { phase: "finished", winner: null, reason: "draw" });

  assert.equal(Array.from({ length: 8 }, (_, index) => chooseSecretTunnelRoute(index, "50:50")).join(""), "ABABABAB");
  assert.equal(Array.from({ length: 8 }, (_, index) => chooseSecretTunnelRoute(index, "75:25")).join(""), "AAABAAAB");
  assert.equal(Array.from({ length: 8 }, (_, index) => chooseSecretTunnelRoute(index, "25:75")).join(""), "ABBBABBB");
  assert.deepEqual(allocateSecretTunnelWave([0, 1, 2, 3, 4], "75:25"), {
    A: [0, 1, 2, 4],
    B: [3],
  });
});
