import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const exists = (path) => access(new URL(path, root));
const hasAll = (text, values) => values.forEach((value) => assert.ok(text.includes(value), `missing: ${value}`));

test("main menu exposes campaign, computer battle, and online play", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, ["서울 지하 999M", "캠페인", "컴퓨터와 대전", "같이하기", "방 코드"]);
  assert.ok(!app.includes("codex-preview"));
});

test("all factions, heroes, minions, buildables, and reusable hero actions are registered", async () => {
  const [content, kits] = await Promise.all([source("game/content.ts"), source("game/heroKits.ts")]);
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(content + app, ["휴먼", "버그본", "기계지성"]);
  for (const name of ["유승천", "김씨", "안서나", "강인함", "철각", "산미", "회분", "매듭", "D-09 땅파", "G-77 야간반장", "R-486 땜빵", "C-999 국장"]) {
    assert.ok(content.includes(name), `hero missing: ${name}`);
  }
  assert.equal((content.match(/^\s*hero\(/gm) ?? []).length, 12);
  assert.equal((content.match(/^\s*minion\(/gm) ?? []).length, 9);
  assert.equal((content.match(/^\s*build\(/gm) ?? []).length, 9);
  for (const id of ["yoo-seungcheon", "kimssi", "ahn-seona", "kang-ryeokhan", "cheolgak", "sanmi", "hoebun", "maedeup", "d09", "g77", "r486", "c999"]) {
    assert.ok(kits.includes(id), `hero kit missing: ${id}`);
  }
  hasAll(kits, ["basic:", "skill1:", "skill2:", "drill:", "ultimate:"]);
});

test("campaign contains five distinct missions and their failure or victory rules", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, ["평택거점", "박사", "협곡", "군체장", "아레나", "천안", "터널"]);
  for (const chapter of [1, 2, 3, 4, 5]) assert.ok(app.includes(`${chapter}: { title:`), `campaign ${chapter} briefing missing`);
  hasAll(app, ["campaignChapter", "scientistImages", "campaignThreat", "campaignTimeLeft"]);
  hasAll(app, [
    'isCampaign\n        ? ["medKit", "armorPlate"]',
    'makeCampaignHero("cheolgak"',
    'makeCampaignHero("sanmi"',
    'makeCampaignHero("hoebun"',
    'makeCampaignHero("maedeup"',
    'fighter.campaignAi === "battle"',
  ]);
});

test("combat controls include movement, attacks, four skills, build, pause, minimap, and two routes", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, ["Escape", "Digit1", "Digit2", "Digit3", "Digit4", "KeyB", "pointerdown", "basicAttackAtPointer", "drawMinimap", "RouteId", "setRouteTarget", "돌격", "경계", "점령"]);
});

test("battle runtime uses shared factories, hero kits, smart brain, collision damage, and seeded randomness", async () => {
  const [app, entities, brain] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("game/runtimeEntities.ts"), source("game/heroBrain.ts")]);
  hasAll(app, ["heroKit(", "decideHeroAction", "createHeroUnit", "updateSlashes", "updateMeleeHits", "combatDamage", "random()"]);
  assert.ok(!app.includes("Math.random()"), "battle simulation must use the seeded match random source");
  hasAll(entities, ["createHeroUnit", "aiCooldowns", "onlinePlayerId", "networkController"]);
  hasAll(brain, ["retreat", "regroup", "support", "drill", "ultimate"]);
});

test("seven maps, five real BGM tracks, faction voices, and material combat samples are wired into battle", async () => {
  const [maps, audio, catalog, app] = await Promise.all([source("game/battleMaps.ts"), source("game/combatAudio.ts"), source("game/audioCatalog.ts"), source("app/Seoul999mBelow.tsx")]);
  for (const id of ["central-exchange", "flooded-pump", "root-lab", "freight-fork", "thermal-shaft", "sealed-bunker", "ore-catacomb"]) hasAll(maps + app + catalog, [id]);
  assert.equal((catalog.match(/file: "\/assets\/audio\/bgm\//g) ?? []).length, 5);
  assert.equal((catalog.match(/^\s{2}["a-z0-9-]+: voice\(/gm) ?? []).length, 12);
  hasAll(audio, ["AudioContext", "HTMLAudioElement", "line.playbackRate * 2", 'line.style !== "ai" && line.style !== "bugborn"', "duckMusic", "skillCue", "impact(material", "dig(material", "down(faction", "result(outcome", "preloadCombatSamples", "export const gameAudio"]);
  hasAll(audio, ['* prominence * .5', '"swing"', '"item"', '"evade"']);
  hasAll(catalog, ["COMBAT_SAMPLES", 'variants("impact/human", 3)', 'variants("impact/bugborn", 3)', 'variants("impact/ai", 3)', 'variants("impact/structure", 3)', 'variants("impact/critical", 3)', 'variants("dig/earth", 3)', 'variants("dig/rock", 3)', 'variants("dig/metal", 3)', 'variants("dig/ore", 3)', 'variants("dig/collapse", 3)', 'variants("down/human", 2)', 'result/victory.wav', 'result/defeat.wav']);
  hasAll(app, ["combatAudio.impact(u.faction", 'combatAudio.impact(\n          "structure"', "combatAudio.dig(digMaterial", "combatAudio.down(u.faction", "gameAudio.result(outcome)"]);
  assert.ok(!audio.includes("SpeechSynthesisUtterance"), "runtime browser TTS must not change character voices by device");
  for (const index of [1, 2, 3, 4, 5]) await exists(`public/assets/audio/bgm/0${index}-${["shelter-network", "rust-rail-assault", "flooded-pressure", "root-signal", "redline-siege"][index - 1]}.wav`);
  for (const heroId of ["yoo-seungcheon", "kimssi", "ahn-seona", "kang-ryeokhan", "d09", "g77", "r486", "c999"])
    for (const slot of [1, 2, 3, 4]) await exists(`public/assets/audio/voices/${heroId}/skill-${slot}.mp3`);
  for (const material of ["human", "bugborn", "ai", "structure", "critical"])
    for (const variant of [1, 2, 3]) await exists(`public/assets/audio/sfx/impact/${material}-${variant}.wav`);
  for (const material of ["earth", "rock", "metal", "ore", "collapse"])
    for (const variant of [1, 2, 3]) await exists(`public/assets/audio/sfx/dig/${material}-${variant}.wav`);
  for (const faction of ["human", "bugborn", "ai"])
    for (const variant of [1, 2]) await exists(`public/assets/audio/sfx/down/${faction}-${variant}.wav`);
  for (const result of ["victory", "defeat"]) await exists(`public/assets/audio/sfx/result/${result}.wav`);
});

test("online room supports 1v1, 2v2, readiness, countdown, commands, reconnect, and AI takeover", async () => {
  const [room, client, worker, app] = await Promise.all([source("game/onlineRoom.ts"), source("game/onlineRoomClient.ts"), source("worker/index.ts"), source("app/Seoul999mBelow.tsx")]);
  hasAll(room, ["teamSize", "ready", "countdown", "playing", "token", "aiControlled", "commands", "snapshot"]);
  hasAll(client, ["createOnlineRoom", "joinOnlineRoom", "readOnlineRoom", "sendOnlineBattleCommand"]);
  hasAll(worker, ["class RoomHub", "ROOMS", "RoomJoinRequest", "ready", "start", "command", "snapshot", "finish", "rematch"]);
  hasAll(app, ["onlineRoom", "onlineIdentity", "processOnlineBattleCommands", "publishOnlineInput"]);
});

test("critical raster assets exist and have a PNG signature", async () => {
  const assets = [
    "public/assets/bases/human/seoul/human-seoul-base-v1-alpha.png",
    "public/assets/characters/sprites/roster-v1/human-roster-actions-v1.png",
    "public/assets/characters/sprites/roster-v1/bugborn-roster-actions-v1.png",
    "public/assets/characters/sprites/roster-v1/ai-roster-actions-v1.png",
    "public/assets/minions/human/human-minion-actions-v1.png",
    "public/assets/minions/bugborn/bugborn-minion-actions-v1.png",
    "public/assets/minions/ai/ai-minion-actions-v1.png",
  ];
  for (const asset of assets) {
    await exists(asset);
    const bytes = await readFile(new URL(asset, root));
    assert.deepEqual([...bytes.subarray(1, 4)], [80, 78, 71], `invalid PNG: ${asset}`);
  }
});

test("battle UI keeps persistent controls in a separate dock and has no purchase surface", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, ["hero-health", "talent-menu", "build-menu", "utilitybar", "loadout-select", "online-room", "combat-command-dock", "battle-stage"]);
  hasAll(css, [".hero-health", ".talent-menu", ".build-menu", ".utilitybar", ".loadout-select", ".online-room", ".combat-command-dock", ".battle-stage"]);
  assert.ok(!app.includes('className="supply-toggle"'));
  assert.ok(!app.includes("구매 없이"));
  assert.ok(!app.includes('cmd.startsWith("buy:")'));
});

test("roster owns viewport scrolling and keeps the start action reachable", async () => {
  const css = await source("app/globals.css");
  hasAll(css, [".title-screen.roster-open .roster-panel", "overflow-y: auto", ".title-screen.roster-open .skirmish-start", "position: fixed"]);
});

test("all grid actors share visual interpolation and minions recover from occupied first steps", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "interpolatedUnitWorld",
    "setUnitMoveVisual",
    "commitGridMove",
    "tryMinionSidestep",
    "moveMinionStep",
    "marchReservations.has",
    "u.aiSearchGoal = undefined",
  ]);
  assert.ok(app.includes("commitGridMove(scientist"), "escort NPC movement must use shared interpolation");
});

test("combat dock uses compact icon commands with keyboard-accessible explanations", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, ["CommandIcon", 'className="command-icon"', "data-tooltip", "title=", "command-state", "hero-resources"]);
  hasAll(css, [
    ".icon-command:hover::after",
    ".icon-command:focus-visible::after",
    'grid-template-areas: "status build routes utility skills"',
    "grid-template-columns: 200px 52px 236px 194px 194px",
    "grid-template-rows: repeat(2, 25px)",
    "transform: translateX(-50%)",
  ]);
  assert.ok(!app.includes("<small>{hud.money}₡</small>"), "build toggle must not duplicate credits");
  assert.ok(!app.includes("<b>{hud.money} 크레딧</b>"), "resources must remain inside the hero card");
});

test("strategic squads keep the exact Ctrl targets instead of wandering to injected gates", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "route.points = [{ x, y }]",
    "objective = last ? rallyGoal(u, point) : point",
    "분대가 이 위치를 최종 집결점으로 사용한다",
  ]);
  assert.ok(!app.includes("canHoldLane"), "route target must not inject an automatic enemy gate");
});

test("minion path selection cannot reserve and then reject its own next cell", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  const nextPath = app.slice(app.indexOf("const nextPath ="), app.indexOf("const nextHeroPath ="));
  const commitMove = app.slice(app.indexOf("commitGridMove ="), app.indexOf("segmentMetric ="));
  assert.ok(!nextPath.includes("marchReservations.add"), "path selection must remain free of reservation side effects");
  assert.ok(nextPath.includes("blocked ? 10000 : 0"), "occupied route cells must lose to every open detour");
  assert.ok(commitMove.includes("marchReservations.add(`${x},${y}`)"), "successful grid movement must own the reservation");
});

test("AI hero skills land on impact frames, respect combo recovery, and explain campaign defeat", async () => {
  const [app, runtime, css] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/runtimeEntities.ts"),
    source("app/globals.css"),
  ]);
  const executeSkill = app.slice(app.indexOf("executeBattleHeroSkill ="), app.indexOf("executeBattleHeroDrill ="));
  hasAll(app, [
    "pendingBattleHeroImpacts.push",
    "delay: slot === 4 ? 620 : 390",
    "duration + (slot === 4 ? 1200 : 700)",
    "updateBattleHeroImpacts(dt)",
    'window.setTimeout(() => setOutcome("lose"), 5000)',
    'className="defeat-recap"',
    "최근 피해 기록",
  ]);
  hasAll(runtime, ["aiComboLockUntil?: number"]);
  hasAll(css, [".result .defeat-recap"]);
  assert.ok(!executeSkill.includes("damageFromBattleHero(attacker, target"), "skill decision must not deal damage before its impact frame");
});

test("all combat targets show damage and campaign 1-3 staging prevents surprise attacks", async () => {
  const [app, runtime] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/runtimeEntities.ts"),
  ]);
  hasAll(app, [
    "pushDamagePopup",
    'critical ? "치명타 "',
    '"방어막"',
    "campaign1CheolgakReserve",
    "campaign1BossShouldEnter",
    "campaign1VictoryReady",
    "1차 방어 성공 · 3초 후 강화 군체 접근",
    'isCampaign && campaignChapter === 1 && order.team === "red"',
    "chapter1Defender ? 1.8 : 1",
    'campaignGuard: "pyeongtaek"',
    "Math.hypot(unit.x - fighter.x, unit.y - fighter.y) <= 6",
    "campaignIntroClock < 6900",
    "random() < 0.6",
    "playerAttackers < 2",
    "arenaPushImmuneUntil = now + 900",
    "Math.min(1, cells)",
  ]);
  hasAll(runtime, ["arenaPushImmuneUntil?: number", 'campaignGuard?: "pyeongtaek"', "campaignActivated?: boolean"]);
});

test("campaign 1 invaders push Seoul without a red base and all hero labels own their baseline and level", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "CAMPAIGN1_MAX_ACTIVE_INVADERS",
    "CAMPAIGN1_WAVE_COUNTS[phase]",
    'campaign1Invader = isCampaign && campaignChapter === 1 && u.team === "red"',
    "const installation = campaign1Invader ? undefined",
    "isCampaign && campaignChapter === 1 ? [] : [",
    "!(isCampaign && campaignChapter === 1)",
    '"BUGBORN INVASION"',
    '`현재 침입체 ${hud.enemies}기`',
    'ctx.textBaseline = "alphabetic"',
    'u.role === "hero" ? `${u.name} · LV.${u.level}` : u.name',
    "campaign1AdvanceWatch",
    "CAMPAIGN1_RETREAT_AFTER_MS",
    "campaign1Invader || stance === \"guard\"",
    '&& !u.campaignScout).length',
    'ctx.globalCompositeOperation = "source-over"',
    "ctx.lineWidth = 1",
    'ctx.fillStyle = "#090d0f"',
  ]);
  const aiStep = app.slice(app.indexOf("stepBattleHero ="), app.indexOf("const arenaFighters"));
  assert.ok(!aiStep.includes("aiHero.hp = Math.min"), "AI retreat must not receive extra healing outside the shared core regeneration rule");
  assert.ok(aiStep.includes("const alternatives = DIRS"), "AI hero must sidestep permanent walls while exploring");
});

test("menu audio unlock and missing action cues are explicit", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, ["audioReady", "BGM 시작", "BGM 재생 중", 'tone("swing")', 'tone("item")', 'tone("evade")']);
});

test("both route panels remain visible and the minimap can be collapsed without an active hit layer", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, ["minimapCollapsed", "minimapCollapsedRef", "toggleMinimap", "미니맵 펼치기", "미니맵 접기"]);
  hasAll(css, ["grid-template-columns: repeat(2, minmax(0, 1fr))", ".minimap-toggle.collapsed", ".battle-stage .minimap-hit[hidden]"]);
});

test("growth, blockers, campaign defenders, healing, and terrain combat rules stay explicit", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "const applyMinionLevel =",
    "unit.level = next",
    "unit.hp = unit.maxHp * hpRatio",
    "applyMinionLevel(nextMinionLevel)",
    "applyMinionLevel(snapshot.minionLevel)",
    "ctx.fillText(`LV.${u.level}`",
    "unit !== hero && unit.role === \"hero\" && unit.team === \"blue\"",
    "ally.level = next",
    "reachableEnemyInstallation",
    'buildDef(turret.kind).category === "blocker"',
    "const adjacentInstallation = nearestEnemyTurret(u, 1)",
    "objective = obstruction.approach",
    "isCampaign && campaignChapter === 1",
    "objective = guardGoal(u)",
    'window.setTimeout(() => setOutcome("lose"), 5000)',
    "emergencyRepairAmount(hero.maxHp)",
    "coreRegenAmount(",
    "hero.maxHp * 0.2",
    'u.campaignThreat === "boss"',
    "gainHeroXp(8)",
    "clearRay(hero.x, hero.y, u.x, u.y)",
    'new Set(["acidShot", "glide", "overclock"])',
  ]);
  const damageBase = app.slice(app.indexOf("damageBase ="), app.indexOf("const breakTile"));
  assert.ok(damageBase.includes("canDamageCore"), "normal cores must reject hero and installation damage");
  assert.ok(damageBase.includes("exposedCoreDamage"), "exposed core damage must use minion role scaling");
  const minionStep = app.slice(app.indexOf("const stepMinion ="), app.indexOf("const drawMarchRoutes"));
  assert.ok(minionStep.includes("melee(u, { x: enemyBase.x - u.x, y: enemyBase.y - u.y })"), "minions adjacent to a core must attack it");
});

test("campaign runners and AI heroes siege installations that block every route", async () => {
  const app = await source("app/Seoul999mBelow.tsx"),
    minionStep = app.slice(app.indexOf("const stepMinion ="), app.indexOf("const drawMarchRoutes")),
    heroStep = app.slice(app.indexOf("stepBattleHero ="), app.indexOf("const arenaFighters"));
  hasAll(minionStep, [
    'u.campaignThreat === "runner"',
    "nearestEnemyTurret(u, 1)",
    "reachableEnemyInstallation(u)",
    "siegeResponse",
  ]);
  hasAll(heroStep, [
    "blockingInstallation",
    "reachableEnemyInstallation(aiHero)",
    "executeBattleHeroSiegeSkill",
    "siegeResponse",
  ]);
});

test("campaign difficulty buffs allies only and computer AI builds tactical installations", async () => {
  const [app, presentation] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/heroPresentation.ts"),
  ]);
  hasAll(app, [
    "CAMPAIGN_DIFFICULTIES",
    'useState<CampaignDifficulty>("easy")',
    'aria-label="캠페인 난이도 선택"',
    'isCampaign && team === "red" ? 1 : minionLevel',
    "campaignBalance.allyHp",
    "campaignBalance.allyDamage",
    "campaignBalance.incomingDamage",
    "campaignBalance.xpGain",
    "runEnemyConstruction",
    'activeMatchConfig?.kind !== "computer"',
    "preservesEnemyExitPath",
    "enemyBuildCredits = 120",
    "awardCredits",
  ]);
  assert.ok(!app.includes("money += 2"), "player credits must not rise from idle time");
  assert.ok(!app.includes("enemyBuildCredits += 3"), "computer credits must follow combat and ore rewards");
  assert.ok(!app.includes('units.push(makeCampaignHero("sanmi", "red", 45, 20, "battle", 1))'), "campaign 1 must not spawn an early Sanmi boss");
  assert.ok(presentation.includes("c999: [-1, 1, -1, -1, 1, -1]"), "C-999 moving frame source direction must be independent from idle");
});
