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

test("five tactical maps and five procedural music themes are wired into battle", async () => {
  const [maps, audio, app] = await Promise.all([source("game/battleMaps.ts"), source("game/combatAudio.ts"), source("app/Seoul999mBelow.tsx")]);
  for (const id of ["central-exchange", "flooded-pump", "root-lab", "freight-fork", "thermal-shaft"]) hasAll(maps + app + audio, [id]);
  assert.equal((audio.match(/bpm:\s*\d+/g) ?? []).length, 5);
  hasAll(audio, ["AudioContext", "class CombatAudio", "async start(", "async sfx("]);
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

test("battle UI includes health, talent, construction, utility, supply, and online room interfaces", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, ["hero-health", "talent-menu", "build-menu", "utilitybar", "supply-menu", "online-room"]);
  hasAll(css, [".hero-health", ".talent-menu", ".build-menu", ".utilitybar", ".supply-menu", ".online-room"]);
});
