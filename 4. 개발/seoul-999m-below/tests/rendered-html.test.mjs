import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { BROWSER_EXTENSION_ERROR_GUARD_SCRIPT } from "../game/browserExtensionErrorGuard.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const exists = (path) => access(new URL(path, root));
const hasAll = (text, values) => values.forEach((value) => assert.ok(text.includes(value), `missing: ${value}`));

test("main menu exposes campaign, computer battle, online play, and battle scale settings", async () => {
  const [app, layout, favicon] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("app/layout.tsx"),
    source("public/favicon.svg"),
  ]);
  hasAll(app, ["서울 지하 999M", "캠페인", "컴퓨터와 대전", "같이하기", "방 코드", "설정", "크게 보기", "도움말", "생존본부 현장 교본", "BATTLE_SCALE_STORAGE_KEY"]);
  hasAll(layout, ["/favicon.svg?v=2", "/favicon-32x32.png?v=2", "/apple-touch-icon.png?v=2"]);
  hasAll(favicon, ["서울 지하 999M", "#39d6dc", ">999M</text>"]);
  await Promise.all([exists("public/favicon-32x32.png"), exists("public/apple-touch-icon.png")]);
  assert.ok(!app.includes("codex-preview"));
});

test("browser extension failures cannot cover the game with the development error overlay", async () => {
  const layout = await source("app/layout.tsx"), listeners = new Map();
  const browserWindow = {
    addEventListener(type, listener, capture) {
      listeners.set(type, { listener, capture });
    },
  };
  runInNewContext(BROWSER_EXTENSION_ERROR_GUARD_SCRIPT, { window: browserWindow });

  const external = {
    reason: {
      message: "Failed to connect to MetaMask",
      stack: "Object.connect (chrome-extension://example/scripts/inpage.js:7:84292)",
    },
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  listeners.get("unhandledrejection").listener(external);
  assert.equal(listeners.get("unhandledrejection").capture, true);
  assert.equal(external.prevented, true);
  assert.equal(external.stopped, true);

  const application = {
    reason: { message: "game failed", stack: "http://localhost:3000/app/game.ts:10:2" },
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  listeners.get("unhandledrejection").listener(application);
  assert.equal(application.prevented, false, "real game errors must still reach the development overlay");
  assert.equal(application.stopped, false, "real game errors must remain visible during development");

  assert.ok(layout.indexOf("<head>") < layout.indexOf("<body"), "the guard must run before Vinext installs its overlay listeners");
  hasAll(layout, ["BROWSER_EXTENSION_ERROR_GUARD_SCRIPT", "dangerouslySetInnerHTML"]);
});

test("campaign prologue and chapter cinematics coexist with separate replay flows", async () => {
  const [app, progress, css] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/campaignProgress.ts"),
    source("app/globals.css"),
    exists("public/assets/opening/seoul-999m-opening-v12.mp4"),
    ...[1, 2, 3, 4, 5].map((chapter) => exists(`public/assets/campaign/cinematics/human_story_0${chapter}.mp4`)),
  ]);
  hasAll(app, [
    '"intro" | "prologue" | "chapters" | "briefing" | "cinematic" | "play"',
    "hasSeenCampaignPrologue(window.localStorage.getItem(CAMPAIGN_PROLOGUE_STORAGE_KEY))",
    "finishCampaignPrologue",
    "replayCampaignPrologue",
    "프롤로그 다시 보기",
    "SKIP · 작전지도로",
    "campaignChapterStatus(chapterNumber, completedCampaignChapters)",
    'disabled={status === "locked"}',
    "completeCampaignChapter(completed, campaignChapter)",
    "seenCampaignCinematics.includes(campaignChapter)",
    'showCampaignCinematic("replay")',
    "finishCampaignCinematic",
    "시네마틱 다시 보기",
    'type CampaignDifficulty = "easy" | "hard"',
  ]);
  hasAll(progress, ["CAMPAIGN_PROLOGUE_STORAGE_KEY", "CAMPAIGN_PROLOGUE_VIDEO", "CAMPAIGN_PROGRESS_STORAGE_KEY", "CAMPAIGN_CINEMATIC_STORAGE_KEY", "human_story_01.mp4", "human_story_05.mp4"]);
  hasAll(css, [".chapter-map-toolbar .prologue-replay", ".chapter-chain .available", ".chapter-chain .completed", ".chapter-chain .locked button", ".chapter-cinematic-actions"]);
  assert.ok(!app.includes("CAMPAIGN_PROLOGUE_CAPTIONS"));
  assert.ok(!app.includes('normal: { label: "보통"'));
});

test("fullscreen escape, pressure mine, illustrated roster, and help remain explicit", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, [
    "fullscreenExitGuardUntilRef",
    'document.addEventListener("fullscreenchange"',
    "performance.now() < fullscreenExitGuardUntilRef.current",
    "type GroundMine",
    "detonateAt: plantedAt + 3000",
    "Math.hypot(unit.x - mine.x, unit.y - mine.y) <= 0.72",
    "detonateGroundMine(mine, steppedOn)",
    'name: "압력 지뢰"',
    "drawGroundMines",
    "heroPortraitStyle",
    'menuPanel === "help"',
    'useState<"quick" | "detail">("quick")',
    'role="tablist"',
    'role="tab"',
    'role="tabpanel"',
    'aria-selected={helpTab === "quick"}',
    "처음 한 판은 이것만",
    "이 네 가지만 따라 하세요",
    "처음에는 이 조작만 쓰면 됩니다",
    "처음에는 A/B를 몰라도 됩니다",
    "상세 교본 보기",
    "게임 플레이 방법 · 생존본부 현장 교본",
    "처음 플레이는 이 순서만 따라 하세요",
    "30초 준비 + 4분 침공",
    "4분 종료",
    'className="help-card tactical"',
    "전술지원과 진군대 연구",
    "다섯 전술은 팀 공용",
    "영웅·현재 진군대를 8초간 매초 3% 회복",
    "컴퓨터 대전은 Q/R에 고른 아이템",
    "거점 안전 회복",
    "Ctrl+Z",
    "Ctrl+J",
    "정예병",
    "상시 지원 시설",
    "지역 제어 시설",
    '["3", "ultimate"',
    '["4", "drill"',
    '["Shift", "survival"',
  ]);
  hasAll(css, [".title-screen.help-open", ".help-tabs", ".help-tabs button.active", ".help-brief-hero", ".help-brief-steps", ".help-brief-controls", ".help-quickstart", ".help-goal-flow", ".help-key-grid", ".help-shortcut-groups", ".help-buff-preview", ".help-tactical-roles", "@keyframes help-buff-pulse", ".online-slot-portrait", ".hero-detail-portrait", ".roster-action-icons"]);
  assert.ok(!app.includes("벽 매설 폭탄"));
  assert.ok(!app.includes("3 · 필살"));
});

test("production worker config keeps the room durable object deployable", async () => {
  const [wranglerText, packageText, vite] = await Promise.all([
    source("wrangler.jsonc"),
    source("package.json"),
    source("vite.config.ts"),
  ]);
  const wrangler = JSON.parse(wranglerText), pkg = JSON.parse(packageText);
  assert.equal(wrangler.main, "./worker/index.ts");
  assert.equal(wrangler.assets.binding, "ASSETS");
  assert.deepEqual(wrangler.durable_objects.bindings, [{ name: "ROOMS", class_name: "RoomHub" }]);
  assert.deepEqual(wrangler.migrations[0].new_sqlite_classes, ["RoomHub"]);
  assert.equal(pkg.scripts.deploy, "npm run build && wrangler deploy");
  assert.ok(vite.includes('configPath: "./wrangler.jsonc"'));
});

test("large battle scale enlarges world actors and mobile tactics stay on a secondary layer", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, [
    "drawScaledWorldActor",
    "ctx.scale(battleScale, battleScale)",
    "mobileTacticsOpen",
    "모바일 전술 메뉴 펼치기",
    "가로 전체화면 시도",
  ]);
  hasAll(css, [
    ".mobile-tactics-toggle { display: none; }",
    ".combat-command-dock:not(.mobile-tactics-open) > .build-toggle",
    ".combat-command-dock:not(.mobile-tactics-open) > .route-hotkeys",
  ]);
});

test("all factions, heroes, minions, buildables, and reusable hero actions are registered", async () => {
  const [content, kits] = await Promise.all([source("game/content.ts"), source("game/heroKits.ts")]);
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(content + app, ["휴먼", "버그본", "기계지성"]);
  for (const name of ["유승천", "김씨", "안서나", "강력한", "철각", "산미", "회분", "매듭", "D-09 땅파", "G-77 야간반장", "R-486 땜빵", "C-999 국장"]) {
    assert.ok(content.includes(name), `hero missing: ${name}`);
  }
  assert.ok(!(content + app).includes(["강", "인", "함"].join("")), "retired human hero name must not return");
  assert.equal((content.match(/^\s*hero\(/gm) ?? []).length, 12);
  assert.equal((content.match(/^\s*minion\(/gm) ?? []).length, 12);
  assert.equal((content.match(/^\s*build\(/gm) ?? []).length, 15);
  for (const id of ["yoo-seungcheon", "kimssi", "ahn-seona", "kang-ryeokhan", "cheolgak", "sanmi", "hoebun", "maedeup", "d09", "g77", "r486", "c999"]) {
    assert.ok(kits.includes(id), `hero kit missing: ${id}`);
  }
  hasAll(kits, ["basic:", "skill1:", "skill2:", "drill:", "ultimate:"]);
});

test("campaign contains five distinct missions and their failure or victory rules", async () => {
  const [app, objectives, css] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/campaignObjectives.ts"),
    source("app/globals.css"),
  ]);
  hasAll(app, ["평택거점", "박사", "협곡", "군체장", "아레나", "천안", "터널"]);
  for (const chapter of [1, 2, 3, 4, 5]) assert.match(app, new RegExp(`${chapter}:\\s*\\{\\s*title:`), `campaign ${chapter} briefing missing`);
  hasAll(app, [
    'title: "열린 흙벽 너머"',
    'title: "표본을 평택으로"',
    'title: "먼저 칠 것인가"',
    'title: "첫 번째 둥지"',
    'title: "끊어진 천안선"',
    "거대 곤충의 DNA 표본",
    "작전권을 건 비살상 대련",
    "살아남은 무리는 알과 새끼를 품고 다른 서식지로 이동",
    "굴착기 부품과 터널 보강재를 공급하는 천안 산업도시",
  ]);
  hasAll(app, ["campaignChapter", "scientistImages", "campaignThreat", "campaignTimeLeft"]);
  hasAll(app, ["mission-conditions", "mission-objective-card", "현재 작전 승패 조건", "missionProgress", "승리", "패배"]);
  hasAll(css, [".mission-conditions", ".mission-objective-card", ".mission-progress"]);
  hasAll(objectives, ["CAMPAIGN_OBJECTIVES", "campaignObjectiveProgress", "철각", "박사 생존", "천안 연결점"]);
  hasAll(app, [
    'isCampaign\n        ? ["medKit", "medKit"]',
    'makeCampaignHero("cheolgak"',
    'makeCampaignHero("sanmi"',
    'makeCampaignHero("hoebun"',
    'makeCampaignHero("maedeup"',
    'fighter.campaignAi === "battle"',
  ]);
});

test("combat controls include movement, attacks, four skills, build, pause, minimap, and two routes", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, ["Escape", "Digit1", "Digit2", "Digit3", "Digit4", "KeyB", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyN", "KeyM", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "buildHotkey", "pointerdown", "basicAttackAtPointer", "drawMinimap", "RouteId", "setRouteTarget", "균등", "A 집중", "B 집중"]);
});

test("battle runtime uses shared factories, hero kits, smart brain, collision damage, and seeded randomness", async () => {
  const [app, entities, brain] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("game/runtimeEntities.ts"), source("game/heroBrain.ts")]);
  hasAll(app, ["heroKit(", "decideHeroAction", "createHeroUnit", "updateSlashes", "updateMeleeHits", "combatDamage", "random()"]);
  assert.ok(!app.includes("Math.random()"), "battle simulation must use the seeded match random source");
  hasAll(entities, ["createHeroUnit", "aiCooldowns", "onlinePlayerId", "networkController"]);
  hasAll(brain, ["retreat", "regroup", "support", "drill", "ultimate"]);
});

test("ten mode-specific maps, five organic BGM tracks, faction voices, and material combat samples are wired into battle", async () => {
  const [maps, audio, catalog, app, generator] = await Promise.all([source("game/battleMaps.ts"), source("game/combatAudio.ts"), source("game/audioCatalog.ts"), source("app/Seoul999mBelow.tsx"), source("tools/generate-game-audio.mjs")]);
  for (const id of ["secret-crossroads", "secret-reservoir", "secret-cache", "central-exchange", "flooded-pump", "root-lab", "freight-fork", "thermal-shaft", "sealed-bunker", "ore-catacomb"]) hasAll(maps + app + catalog, [id]);
  hasAll(maps + app, ["SECRET_TUNNEL_MAPS", "OPEN_FRONT_BATTLE_MAPS", "battleMapsForRuleset", "defaultBattleMapForRuleset"]);
  assert.equal((catalog.match(/file: "\/assets\/audio\/bgm\//g) ?? []).length, 5);
  assert.equal((catalog.match(/^\s{2}["a-z0-9-]+: voice\(/gm) ?? []).length, 12);
  hasAll(audio, ["AudioContext", "HTMLAudioElement", "line.playbackRate * 2", 'line.style !== "ai" && line.style !== "bugborn"', "duckMusic", "skillCue", "impact(material", "dig(material", "down(faction", "result(outcome", "preloadCombatSamples", "preloadVoiceLines", "prepareHeroVoice", "voiceCache", "voiceReady", "audio.load()", "export const gameAudio"]);
  hasAll(audio, ['* prominence * .5', '"swing"', '"item"', '"evade"']);
  hasAll(audio, ["musicVolume", 'id === "shelter-network" ? .22 : .32']);
  assert.ok(!audio.includes("* prominence * .5 * .7"), "combat samples must remain audible at the approved checkpoint mix");
  hasAll(catalog, ["COMBAT_SAMPLES", "?v=3", 'variants("impact/human", 3)', 'variants("impact/bugborn", 3)', 'variants("impact/ai", 3)', 'variants("impact/structure", 3)', 'variants("impact/critical", 3)', 'variants("dig/earth", 3)', 'variants("dig/rock", 3)', 'variants("dig/metal", 3)', 'variants("dig/ore", 3)', 'variants("dig/collapse", 3)', 'variants("down/human", 2)', 'result/victory.wav', 'result/defeat.wav']);
  hasAll(generator, ["addWarmPad", "addFeltPiano", "addPluckedString", "addFrameDrum", "addBrush", "addLoopRoom"]);
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

test("online room supports shared combat, local prediction, visual preload, and departure victory", async () => {
  const [room, client, worker, app, match] = await Promise.all([source("game/onlineRoom.ts"), source("game/onlineRoomClient.ts"), source("worker/index.ts"), source("app/Seoul999mBelow.tsx"), source("game/matchConfig.ts")]);
  const actionBody = worker.slice(worker.indexOf("type RoomActionBody"), worker.indexOf("const responseJson")),
    commandValidation = worker.slice(worker.indexOf('body.action === "command"'), worker.indexOf('body.action === "snapshot"'));
  hasAll(room, ["teamSize", "ready", "countdown", "playing", "token", "commands", "snapshot", "lastAppliedCommandSequence", "preparationEndsAt", "matchEndsAt", "teamMinionLevels", "teamCredits", "minions", "installations", "terrain", '"tactical"', '"research"', '"elite"', '"allocation"', "teamConnections", "teamRouteAllocations", "ONLINE_ROUTE_ALLOCATIONS", "isOnlineRouteAllocation", "opponentTeam", "shouldApplyAuthoritativeHeroPosition", '"player-left"']);
  hasAll(client, ["createOnlineRoom", "joinOnlineRoom", "connectOnlineRoomSocket", "onlineRoomSocketUrl", "WebSocket.OPEN"]);
  hasAll(worker, ["class RoomHub", "ROOMS", "RoomJoinRequest", "acceptWebSocket", "webSocketMessage", "webSocketClose", "alarm()", "ONLINE_ADJUDICATION_GRACE_MS", "ready", "start", "command", "snapshot", "finish", "rematch", '"tactical"', '"research"', '"elite"', "opponentTeam", 'finishReason = "player-left"', 'finishReason = "connection-failed"', 'finishReason = "timeout"', 'roomMatch[2] ?? ""']);
  hasAll(actionBody, ['"route" | "allocation"', "allocation?: OnlineRouteAllocation"]);
  hasAll(commandValidation, ['"route", "allocation"', "isOnlineRouteAllocation(command.allocation)", "잘못된 공격로 배분입니다."]);
  hasAll(match, ["canonicalLocalTeam: local.team", 'canonicalLocalTeam: "blue"']);
  hasAll(app, ["onlineRoom", "onlineIdentity", "processOnlineBattleCommands", "publishOnlineInput", "localTeamForCanonical", "onlineTerrainChanges", "snapshot.minions", "snapshot.installations", "snapshot.terrain", "applyTeamRouteTarget", "shouldApplyAuthoritativeHeroPosition", "setUnitMoveVisual(synced, state.x, state.y, ONLINE_REMOTE_INTERPOLATION_MS)", "ONLINE_SNAPSHOT_INTERVAL_MS", "lastAppliedCommandSequence", "mergedCommands", "newestOnlineRoomView", "initialCanvasRect", "preloadRuntimeVisuals().then"]);
  const updateBody = app.slice(app.indexOf("const update = (dt: number, now: number) =>"), app.indexOf("const draw =", app.indexOf("const update = (dt: number, now: number) =>")));
  assert.ok(
    updateBody.indexOf("syncOnlineBattleState(dt)") < updateBody.indexOf("if (isSecretTunnel)"),
    "online snapshot restore must run before secret-tunnel deadline adjudication",
  );
  assert.ok(
    updateBody.indexOf("syncOnlineBattleState(dt)") < updateBody.indexOf("processOnlineBattleCommands()"),
    "host reconnect must restore the authoritative snapshot before replaying queued commands",
  );
  assert.ok(app.includes("window.sessionStorage.getItem(`seoul999m-room-${roomCode}`)"), "room reconnect identity must stay isolated per browser tab");
  assert.ok(!app.includes("window.localStorage.getItem(`seoul999m-room-${roomCode}`)"), "a second tab must not inherit the host token");
  assert.ok(!app.includes("transformOnlinePoint"), "online clients must share canonical world coordinates");
  assert.ok(!worker.includes('if (room.status === "playing") member.aiControlled = true'), "a departed online player must end the match instead of becoming AI");
});

test("secret-tunnel online snapshots are filtered per team without changing open-front snapshots", async () => {
  const worker = await source("worker/index.ts"),
    snapshotFilter = worker.slice(worker.indexOf("const snapshotForTeam"), worker.indexOf("const publicRoom")),
    broadcast = worker.slice(worker.indexOf("private broadcast"), worker.indexOf("private socketError"));

  hasAll(worker, [
    "onlineRoomRuleset",
    "ruleset: onlineRoomRuleset({ ruleset: body.ruleset })",
    "ruleset: onlineRoomRuleset(room)",
    "snapshot: snapshotForTeam(room, viewer)",
    "publicRoom(room, player)",
    "publicRoom(room, reconnect)",
  ]);
  hasAll(snapshotFilter, [
    'onlineRoomRuleset(room) === "open-front"',
    'snapshot.phase !== "prepare"',
    "ownPlayerIds.has(hero.playerId)",
    "cell.accessMask === opponentAccessMask",
    "cell.accessMask === 3",
    "...snapshot",
  ]);
  hasAll(broadcast, [
    "socket.deserializeAttachment()",
    "viewer = room.players.find",
    "publicRoom(room, viewer)",
  ]);
  assert.ok(
    snapshotFilter.indexOf('onlineRoomRuleset(room) === "open-front"') < snapshotFilter.indexOf("return snapshot"),
    "open-front rooms must return their authoritative snapshot without redaction",
  );

  const executable = ts.transpileModule(`
    const onlineRoomRuleset = (room) => room.ruleset === "open-front" ? "open-front" : "secret-tunnel";
    const HEROES = [];
    ${snapshotFilter}
    globalThis.runSnapshotForTeam = snapshotForTeam;
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText,
    context = {};
  runInNewContext(executable, context);
  const snapshot = {
      sequence: 4,
      issuedAt: 10,
      phase: "prepare",
      phaseTimeLeftMs: 42_000,
      teamConnections: { blue: true, red: false },
      wave: 0,
      allyCore: { hp: 600, shield: 180 },
      enemyCore: { hp: 600, shield: 180 },
      heroes: [
        { playerId: "blue-player", x: 1, y: 2, alive: true },
        { playerId: "red-player", x: 3, y: 2, alive: true },
      ],
      minions: [],
      installations: [],
      terrain: [],
      tunnelAccess: [
        ...[0, 1, 2, 3].map((accessMask, x) => ({
          x,
          y: 2,
          accessMask,
          durability: { blue: 10 + x, red: 20 + x },
          maxDurability: { blue: 30 + x, red: 40 + x },
          excavatedBy: 3,
        })),
        {
          x: 4, y: 2, accessMask: 0,
          durability: { blue: 30, red: 25 }, maxDurability: { blue: 30, red: 40 }, excavatedBy: 0,
        },
        {
          x: 5, y: 2, accessMask: 0,
          durability: { blue: 15, red: 40 }, maxDurability: { blue: 30, red: 40 }, excavatedBy: 0,
        },
      ],
    },
    room = {
      ruleset: "secret-tunnel",
      hostId: "host-player",
      snapshot,
      players: [
        { id: "host-player", team: "blue" },
        { id: "blue-player", team: "blue" },
        { id: "red-player", team: "red" },
      ],
    },
    blueViewer = { id: "blue-player", team: "blue" },
    redViewer = { id: "red-player", team: "red" },
    blueView = context.runSnapshotForTeam(room, blueViewer),
    redView = context.runSnapshotForTeam(room, redViewer);
  assert.deepEqual(Array.from(blueView.heroes, (hero) => hero.playerId), ["blue-player"]);
  assert.deepEqual(Array.from(redView.heroes, (hero) => hero.playerId), ["red-player"]);
  assert.deepEqual(Object.keys(blueView.teamConnections), ["blue"]);
  assert.equal(blueView.teamConnections.blue, true);
  assert.deepEqual(Object.keys(redView.teamConnections), ["red"]);
  assert.equal(redView.teamConnections.red, false);
  assert.deepEqual(Array.from(blueView.tunnelAccess, (cell) => cell.x), [0, 1, 2, 3, 5]);
  assert.deepEqual(Array.from(redView.tunnelAccess, (cell) => cell.x), [0, 1, 2, 3, 4]);
  assert.equal(blueView.tunnelAccess.find((cell) => cell.x === 2).accessMask, 0, "enemy geometry stays hidden in prepare");
  assert.equal(redView.tunnelAccess.find((cell) => cell.x === 1).accessMask, 0, "enemy geometry stays hidden in prepare");
  for (const cell of blueView.tunnelAccess) {
    assert.deepEqual(Object.keys(cell.durability), ["blue"]);
    assert.deepEqual(Object.keys(cell.maxDurability), ["blue"]);
    assert.equal(cell.excavatedBy & 2, 0);
  }
  for (const cell of redView.tunnelAccess) {
    assert.deepEqual(Object.keys(cell.durability), ["red"]);
    assert.deepEqual(Object.keys(cell.maxDurability), ["red"]);
    assert.equal(cell.excavatedBy & 1, 0);
  }
  assert.equal(blueView.allyCore, snapshot.allyCore);
  assert.equal(blueView.enemyCore, snapshot.enemyCore);
  assert.equal(blueView.phaseTimeLeftMs, 42_000);
  assert.equal(
    context.runSnapshotForTeam({ ...room, ruleset: "open-front" }, blueViewer),
    snapshot,
    "open-front must keep the original snapshot object",
  );
  const assault = context.runSnapshotForTeam(
    { ...room, snapshot: { ...snapshot, phase: "assault" } },
    blueViewer,
  );
  assert.equal(assault.heroes.length, 2, "assault reveals heroes for the normal client LOS pipeline");
  assert.deepEqual(Array.from(assault.tunnelAccess, (cell) => cell.x), [0, 1, 2, 3, 5]);
  assert.equal(assault.tunnelAccess.find((cell) => cell.x === 2).accessMask, 2, "assault reveals enemy tunnel geometry");
  assert.equal(assault.tunnelAccess.find((cell) => cell.x === 2).durability.blue, 12, "only own dig durability remains visible");

  const anonymous = context.runSnapshotForTeam(room);
  assert.deepEqual(Array.from(anonymous.tunnelAccess, (cell) => cell.accessMask), [3]);
  assert.equal(anonymous.tunnelAccess[0].durability, undefined);
  assert.equal(anonymous.tunnelAccess[0].maxDurability, undefined);
  assert.equal(anonymous.tunnelAccess[0].excavatedBy, undefined);
  assert.equal(anonymous.teamConnections, undefined);

  const commandFilter = worker.slice(worker.indexOf("const commandsForViewer"), worker.indexOf("const publicRoom")),
    commandExecutable = ts.transpileModule(`
      const onlineRoomRuleset = (room) => room.ruleset === "open-front" ? "open-front" : "secret-tunnel";
      ${commandFilter}
      globalThis.runCommandsForViewer = commandsForViewer;
    `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText,
    commandContext = {};
  runInNewContext(commandExecutable, commandContext);
  const commands = [
      { sequence: 1, playerId: "blue-player", type: "drill", x: 1, y: 2 },
      { sequence: 2, playerId: "red-player", type: "drill", x: 8, y: 9 },
    ],
    commandRoom = { ...room, hostId: "blue-player", commands };
  assert.equal(
    commandContext.runCommandsForViewer(commandRoom, { id: "blue-player", team: "blue" }),
    commands,
    "the authoritative host must receive every command",
  );
  assert.deepEqual(
    Array.from(
      commandContext.runCommandsForViewer(commandRoom, { id: "red-player", team: "red" }),
      (command) => command.playerId,
    ),
    ["red-player"],
    "a non-host secret-tunnel viewer must not receive opponent coordinates",
  );
  assert.equal(
    commandContext.runCommandsForViewer({ ...commandRoom, ruleset: "open-front" }, { id: "red-player", team: "red" }),
    commands,
    "open-front keeps the existing shared command stream",
  );
});

test("campaign replay, briefing cards, and roster kit icons use live game data", async () => {
  const [app, css, presentation] = await Promise.all([
    source("app/Seoul999mBelow.tsx"), source("app/globals.css"), source("game/heroPresentation.ts"),
  ]);
  hasAll(app, [
    "battleRunId", "launchCampaignMission()", "mission-brief-overview", "briefing-visual-card", "mission-story-record", "SURVIVAL RECORD",
    "HeroKitIcon", "heroActionIconFamily", "heroId={hero.id}", "slot=\"ultimate\"",
  ]);
  hasAll(css, [".mission-brief-overview", ".briefing-visual-card", ".mission-story-record", ".hero-kit-icon"]);
  hasAll(presentation, ['"ahn-seona": [-1, -1, -1, 1, 1, -1]', '"kang-ryeokhan": [3, 3]']);
  assert.ok(!app.includes("로그인 없이 게스트 접속</span>"), "obsolete title footer copy must be removed");
});

test("critical raster assets exist and have a PNG signature", async () => {
  const assets = [
    "public/assets/bases/human/seoul/human-seoul-base-v1-alpha.png",
    "public/assets/characters/sprites/yoo-seungcheon/yoo-locomotion-v1-alpha.png",
    "public/assets/characters/sprites/yoo-seungcheon/yoo-hurt-down-v1-alpha.png",
    "public/assets/characters/sprites/roster-v1/human-roster-actions-v1.png",
    "public/assets/characters/sprites/roster-v1/bugborn-roster-actions-v1.png",
    "public/assets/characters/sprites/roster-v1/ai-roster-actions-v1.png",
    "public/assets/minions/human/human-minion-actions-v1.png",
    "public/assets/minions/bugborn/bugborn-minion-actions-v1.png",
    "public/assets/minions/ai/ai-minion-actions-v1.png",
    "public/assets/minions/human/elite/human-waste-heavy-v1-alpha.png",
    "public/assets/minions/bugborn/elite/bugborn-hive-devourer-v1-alpha.png",
    "public/assets/minions/ai/elite/ai-demolition-enforcer-808-v1-alpha.png",
    "public/assets/buildables/human/human-departure-supply-v1-alpha.png",
    "public/assets/buildables/bugborn/bugborn-pheromone-guide-v1-alpha.png",
    "public/assets/buildables/ai/ai-target-relay-v1-alpha.png",
    "public/assets/buildables/human/human-high-voltage-trap-v1-alpha.png",
    "public/assets/buildables/bugborn/bugborn-acid-spore-sac-v1-alpha.png",
    "public/assets/buildables/ai/ai-restraint-electrode-t3-v1-alpha.png",
  ];
  for (const asset of assets) {
    await exists(asset);
    const bytes = await readFile(new URL(asset, root));
    assert.deepEqual([...bytes.subarray(1, 4)], [80, 78, 71], `invalid PNG: ${asset}`);
  }
});

test("battle UI keeps persistent controls in a separate dock and has no purchase surface", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, ["hero-health", "talent-drawer", "talent-ready", "build-menu", "utilitybar", "loadout-select", "online-room", "combat-command-dock", "battle-stage"]);
  hasAll(css, [".hero-health", ".talent-drawer", ".talent-ready", ".build-menu", ".utilitybar", ".loadout-select", ".online-room", ".combat-command-dock", ".battle-stage"]);
  assert.ok(!app.includes('className="supply-toggle"'));
  assert.ok(!app.includes("구매 없이"));
  assert.ok(!app.includes('cmd.startsWith("buy:")'));
});

test("tactical support uses readable two-column desktop rows and one-column mobile rows", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.tactical-support-menu > div\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.combat-command-dock \.tactical-support-menu > div\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.combat-command-dock > \.build-menu\s*\{[^}]*width:\s*min\(560px, calc\(100vw - 224px\)\)/s);
  hasAll(css, ["word-break: keep-all", ".tactical-support-menu button i", "max-height: calc(100vh - 128px)"]);
  hasAll(css, ["@media (max-width: 760px), (max-height: 680px)", "position: fixed", "inset: 52px 8px 86px 8px !important"]);
});

test("active tactical support renders a pulsing body glow, foot ring, sparks, and role badge", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "drawTacticalBuffAura",
    "tacticalBuffVisual(u.faction, role)",
    "ctx.createRadialGradient",
    "ctx.setLineDash",
    'visual.badge === "shield"',
    "drawTacticalBuffAura(u, x, y, now)",
  ]);
});

test("roster owns viewport scrolling and keeps the start action reachable", async () => {
  const css = await source("app/globals.css");
  hasAll(css, [".title-screen.roster-open .roster-panel", "overflow-y: auto", ".title-screen.roster-open .skirmish-start", "position: fixed"]);
});

test("all grid actors share visual interpolation and minions recover from occupied first steps", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  const actorRender = app.slice(app.indexOf("render = () =>"), app.indexOf("const drawMinimap ="));
  const fogRender = app.slice(app.indexOf("drawFog ="), app.indexOf("drawAimGuide ="));
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
  assert.ok(actorRender.includes("const world = interpolatedUnitWorld(u, renderNow)"), "scaled actors must pivot around their interpolated position");
  assert.ok(!actorRender.includes("const world = unitWorld(u)"), "scaled actors must not pivot around the next logical grid cell");
  assert.ok(fogRender.includes("const visualWorld = interpolatedUnitWorld(u)"), "moving vision sources must not snap their light mask by grid cell");
});

test("player, allied AI, and enemy AI heroes share readable glow treatment", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "drawHeroReadabilityGlow",
    "heroSpriteFilter",
    "drawHeroReadabilityGlow(u, playerDef, x, y, true)",
    "drawHeroReadabilityGlow(u, campaignHeroDefinition, x, y)",
    "ctx.filter = heroSpriteFilter(u, campaignHeroDefinition)",
    'u.team === "blue" ? "#54dfef" : "#ff6658"',
  ]);
});

test("online opponents render Yoo Seung-cheon's dedicated sprite instead of the rectangle fallback", async () => {
  const app = await source("app/Seoul999mBelow.tsx"),
    yooRenderer = app.slice(app.indexOf("const drawYoo ="), app.indexOf("const drawSlash =")),
    remoteHeroRenderer = app.slice(app.indexOf("const campaignHeroDefinition ="), app.indexOf("if (u.alive) {", app.indexOf("const campaignHeroDefinition =")));
  hasAll(yooRenderer, [
    "localYoo = u === hero",
    "remoteActionActive = now < (u.arenaActionUntil ?? 0)",
    "u.arenaActionSlot === 1",
    "now < (localYoo ? heroMoveUntil : (u.arenaMoveUntil ?? 0))",
    "const img = atlases[sheet]",
    "return true",
  ]);
  hasAll(remoteHeroRenderer, [
    'campaignHeroDefinition.id === "yoo-seungcheon"',
    "? drawYoo(u, x, y)",
    ": drawUnifiedCampaignHero(u, x, y, campaignHeroDefinition)",
  ]);
  assert.ok(
    remoteHeroRenderer.indexOf("drawYoo(u, x, y)") < remoteHeroRenderer.indexOf("if (!renderedHero)"),
    "the dedicated Yoo sprite must be attempted before any geometric fallback",
  );
});

test("combat dock uses compact icon commands with keyboard-accessible explanations", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, ["CommandIcon", 'className="command-icon"', "data-tooltip", "title=", "command-state", "hero-resources"]);
  hasAll(css, [
    ".icon-command:hover::after",
    ".icon-command:focus-visible::after",
    'grid-template-areas: "status build routes utility skills"',
    "grid-template-columns: 200px 52px 236px 194px 194px",
    "grid-template-rows: 27px 24px",
    "transform: translateX(-50%)",
  ]);
  assert.ok(!app.includes("<small>{hud.money}₡</small>"), "build toggle must not duplicate credits");
  assert.ok(!app.includes("<b>{hud.money} 크레딧</b>"), "resources must remain inside the hero card");
});

test("strategic squads keep exact Ctrl targets while the last edited lane avoids its sibling", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "route.points = [{ x, y }]",
    "diverseRouteToGoal(base, target, (px, py) => openForTeam(px, py, team), avoidedCells, {",
    "hardAvoidRadius: 2",
    "oppositeSidePenalty: 18",
    'preferredVerticalDirection: id === "A" ? -1 : 1',
    "route.plannedCells = plan.cells.slice(1)",
    "const routePoints = routeTravelPoints(route)",
    "assaultContinues = last && stanceBehavior.continuesToCore && knowsEnemyBase",
    'marchStanceBehavior("assault")',
    "if (unit.routeId !== assignedRouteId)",
    "assignedRouteProgress = advanceRouteCursor(",
    "Treat this as traffic, not as a broken A/B tunnel",
    "별도 우회로 없음 · 공용 병목 사용",
  ]);
  assert.ok(!app.includes("canHoldLane"), "route target must not inject an automatic enemy gate");
  const minionRuntime = app.slice(app.indexOf("const stepMinion ="), app.indexOf("const drawMarchRoutes"));
  assert.ok(!/\bstance\s*===/.test(minionRuntime), "the unified assault runtime must not reference a removed stance variable");
});

test("all modes expose badge-based detailed A/B routing, Ctrl quick aim, and allocation without rewinding active waves", async () => {
  const [app, navigation, runtime, room, worker, css, movement] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/gridNavigation.ts"),
    source("game/runtimeEntities.ts"),
    source("game/onlineRoom.ts"),
    source("worker/index.ts"),
    source("app/globals.css"),
    source("game/movementRules.ts"),
  ]);
  hasAll(app, [
    'onClick={() => command(`route:${id}`)}',
    'e.code !== "Digit1" && e.code !== "Digit2"',
    "routeApply",
    "routeReset",
    "{id} 설정",
    'className="route-section-label"',
    'allocation.replace(":", "/")',
    "빠른 지정",
    "마지막 지점이 최종 목적지",
    "다음 웨이브부터 진군 배분",
    'chooseSecretTunnelRoute(index + wave * 4, tunnelAllocations[team])',
    'publishOnlineInput({ type: "route", route: id, points })',
    "forwardRouteRejoin(",
    "routeReverseLockUntil",
    "if (!teamMarchRoutes.blue.A.points.length)",
    "if (!teamMarchRoutes.blue.B.points.length)",
  ]);
  hasAll(navigation, ["export const forwardRouteRejoin", "forwardCells = cells.slice(firstForwardIndex)"]);
  hasAll(runtime, ["routePreviousX?: number", "routePreviousY?: number", "routeReverseLockUntil?: number"]);
  hasAll(room, ["points?: Array<{ x: number; y: number }>"]);
  hasAll(worker, ["command.points.length > 64", "command.points.some"]);
  hasAll(css, [".route-command-panel", ".route-edit-toolbar", ".route-hotkeys > .route-lanes", ".route-allocation", ".route-section-label", ".allocation-routes", "grid-template-columns: 55px minmax(0, 1fr) minmax(0, 1fr)"]);
  hasAll(movement, ["GLOBAL_UNIT_MOVEMENT_MULTIPLIER = 1.3", "unitMovementSpeed", "unitMovementDuration"]);
  const localAllocation = app.slice(app.indexOf('if (cmd.startsWith("allocation:"))'), app.indexOf('if (cmd === "route:off")'));
  const onlineAllocation = app.slice(app.indexOf('command.type === "allocation"'), app.indexOf('command.type === "build"'));
  assert.ok(!localAllocation.includes("routePointIndex = 0"), "allocation must not rewind an active local wave");
  assert.ok(!onlineAllocation.includes("routePointIndex = 0"), "allocation must not rewind an active online wave");
  assert.ok(!app.includes("이전 포인트로 후퇴"), "temporary blockage must not turn a route into a retreat loop");
  assert.ok(!app.includes("route-row-actions"), "separate edit and stance buttons must stay removed");
  assert.ok(!app.includes('command(`stance:'), "all routes must share the assault behavior");
});

test("route editing keeps a visible draft guide, right-drag panning, faster movement, and hero congestion recovery", async () => {
  const [app, css] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("app/globals.css"),
  ]);
  const routeOverlay = app.slice(app.indexOf("drawMarchRoutes ="), app.indexOf("heroBrainRole =")),
    pointerDown = app.slice(app.indexOf("pointerdown ="), app.indexOf("pointermove =")),
    heroStep = app.slice(app.indexOf("stepBattleHero ="), app.indexOf("const arenaFighters"));
  hasAll(routeOverlay, [
    'ctx.strokeStyle = "#ffe071"',
    "routeDraftPoints.forEach",
    "String(index + 1)",
    "`${routeEdit} 최종`",
  ]);
  assert.ok(!pointerDown.includes("if (routeEdit || routeQuickAim) return"), "right drag must stay available while editing a route");
  hasAll(heroStep, [
    "targetRecovery = DIRS",
    "aiAvoidTargetId",
    "공격 위치가 막혀 측면 칸으로 이동",
    "공세 경로를 다시 탐색",
  ]);
  hasAll(app, [
    "unitMovementSpeed(playerDef.stats.moveSpeed)",
    "unitMovementSpeed(u.moveSpeed)",
    "unitMovementDuration(1000 / scientist.moveSpeed)",
  ]);
  assert.ok(css.includes("width: 236px"), "desktop route panel must fit the original compact dock width");
  assert.ok(!css.includes("min-width: 350px"), "the expanded route cards must not return");
});

test("minion path selection cannot reserve and then reject its own next cell", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  const nextPath = app.slice(app.indexOf("pathPlanToGoals ="), app.indexOf("const nextHeroPath ="));
  const commitMove = app.slice(app.indexOf("commitGridMove ="), app.indexOf("segmentMetric ="));
  const minionStep = app.slice(app.indexOf("const stepMinion ="), app.indexOf("const drawMarchRoutes ="));
  const update = app.slice(app.indexOf("const update ="), app.indexOf("const draw ="));
  assert.ok(!nextPath.includes("marchReservations.add"), "path selection must remain free of reservation side effects");
  assert.ok(nextPath.includes("if (blocked) return null"), "occupied route cells must be rejected before choosing a detour");
  assert.ok(nextPath.includes("distance >= currentDistance"), "a detour must still make real BFS progress");
  assert.ok(commitMove.includes("marchReservations.add(`${x},${y}`)"), "successful grid movement must own the reservation");
  assert.ok(!minionStep.includes("marchReservations.clear()"), "reservation lifetime must not depend on a minion being alive");
  assert.ok(update.includes("marchReservations.clear()"), "every simulation frame must release the previous movement reservations");
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
    'preserveUntilSpawned = order.role === "elite"',
    'isCampaign && order.team === "red"',
    "chapter1Defender ? 1.8 : 1",
    'campaignGuard: "pyeongtaek"',
    "Math.hypot(unit.x - fighter.x, unit.y - fighter.y) <= 6",
    "campaignIntroClock < 5900",
    "unit.team !== fighter.team",
    '(unit === hero || unit.campaignAi === "companion")',
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
    "knowsEnemyBase = campaign1Invader || !isCampaign || teamKnowsEnemyCore(u.team)",
    "isCampaign && campaignChapter === 1 ? [] : [",
    "!(isCampaign && campaignChapter === 1)",
    '"BUGBORN INVASION"',
    '`현재 침입체 ${hud.enemies}기`',
    'ctx.textBaseline = "alphabetic"',
    'u.role === "hero" ? `${u.name} · LV.${u.level}` : u.name',
    "campaign1AdvanceWatch",
    "CAMPAIGN1_RETREAT_AFTER_MS",
    "priorityEnemy = retainedEnemy ?? (campaign1Invader",
    "u.campaignWaveId === 1",
    "CAMPAIGN1_VENT_DELAY_MS",
    "drawCampaignVent",
    'ctx.globalCompositeOperation = "source-over"',
    "ctx.lineWidth = 1",
    'ctx.fillStyle = "#090d0f"',
  ]);
  const aiStep = app.slice(app.indexOf("stepBattleHero ="), app.indexOf("const arenaFighters"));
  assert.ok(!aiStep.includes("aiHero.hp = Math.min"), "AI retreat must not receive extra healing outside the shared core regeneration rule");
  assert.ok(aiStep.includes("const alternatives = DIRS"), "AI hero must sidestep permanent walls while exploring");
});

test("campaign replay fixes keep waves, escorts, companions, predeployed rooms, and talent UI live", async () => {
  const [app, rules, runtime, navigation, css] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/campaignRules.ts"),
    source("game/runtimeEntities.ts"),
    source("game/gridNavigation.ts"),
    source("app/globals.css"),
  ]);
  hasAll(app, [
    "const CAMPAIGN1_VENT = { x: 21, y: 18 }",
    "preloadRuntimeVisuals()",
    'void gameAudio.prepareHeroVoice("yoo-seungcheon").catch(() => undefined)',
    "Promise.race([",
    "campaign visual timeout",
    'role="alert"',
    "runtimeImage(src)",
    "원본 전투 자료 불러오는 중…",
    "campaign1ShouldForceExit",
    "? { x: ALLY.x + 6, y: ALLY.y + index - 1 }",
    'makeCampaignHero("kimssi", "blue", hero.x - 2, hero.y - 1, "arena", 0)',
    "const arenaRoster = [hero, kimAlly, ...arenaOpponents]",
    "fighter.campaignPotionUsed = true",
    "stepBattleHero(fighter)",
    "김씨 저들을 무력화하고 우리가 거대곤충 거점을 처들어간다,",
    "mode = campaignCompanionMode(",
    "campaignCompanionMoveDuration(",
    "campaignCompanionGoalOffsets(",
    "companionSidestepStepToGoals",
    "김씨가 막힌 전투 목표를 포기하고 열린 길로 돌아오는 중이다",
    "김씨가 플레이어 전선에 자연스럽게 합류했다",
    "김씨의 자연 경로 복구가 장시간 실패해 최후 안전 재합류를 실행했다",
    "CAMPAIGN_COMPANION_AGGRO_DISTANCE",
    "CAMPAIGN_ASSIST_RADIUS",
    "CAMPAIGN_SENTRY_AGGRO_DISTANCE",
    "unit.id === aiHero.aiTargetId",
    "decision.action === \"drill\"",
    "companionHasLocalCore",
    "const coreApproachPlan = !target && coreAssault",
    "localInstallation = forcedRejoin",
    'fighter.assistReason = "local-threat"',
    "campaignShouldEngageLocalObjective(",
    'melee(u, { x: enemyBase.x - u.x, y: enemyBase.y - u.y }, 0, "coreSiege")',
    "const followerHasStrategicRoute",
    "campaignFollower: true",
    "평택 거점 입구로 이동 · 호송 목적지는 공격하지 않음",
    'makeCampaignHero("sanmi", "red", ENEMY.x - 2, ENEMY.y + 1, "battle", 1)',
    "isCampaignSentryChapter(campaignChapter)",
    "campaignSentry:",
    "campaignGuardX:",
    "u.campaignSentry",
    "delay: index * 80",
    "campaignChapter === 4 ? 300000",
    "sentry",
    "aiHero.campaignGuardX",
    "waveFront ?? CAMPAIGN1_VENT",
    'score: 999, reason: "동행 영웅이 사거리 안의 적을 즉시 공격한다"',
    "availableFollowGoals = (radius: 1 | 2)",
    "companionLastProgressAt",
    "companionRejoinMode",
    "stationaryMs",
    "const reachable = pathDistanceMap(fighter)",
    "순간이동하지 않고 연결 가능한 가장 가까운 경계에서 새 통로를 기다린다",
    "campaignCompanionShouldHardRejoin(",
    "const heroReachable = pathDistanceMap(hero)",
    "combatApproachPlan(fighter, unit, basicRange)",
    '["escort", "breaker", "shooter", "escort", "breaker", "shooter"]',
    '{ x: 10, y: 17 }',
    'makeCampaignHero("maedeup", "red", 38, 16, "battle", 3)',
    "talentTierOpen && !outcome",
    'aria-modal="false"',
    "campaign1Boss: true",
    "서울 거점까지 실제 경로",
    "pendingTalentTiersRef.current",
    "heroTalentChoices(activeHeroDef.id, talentTierOpen)",
  ]);
  const campaignMinionStep = app.slice(app.indexOf("const stepMinion ="), app.indexOf("const drawMarchRoutes"));
  assert.ok(
    campaignMinionStep.indexOf("const priorityInstallation") < campaignMinionStep.indexOf("const followerHasStrategicRoute"),
    "campaign followers must scan nearby installations before returning to follow formation",
  );
  assert.ok(
    campaignMinionStep.indexOf("const localCorePlan") < campaignMinionStep.indexOf("const followerHasStrategicRoute"),
    "campaign followers must approach and siege a nearby visible core before following the player",
  );
  hasAll(runtime, ["companionLastX", "companionLastY", "companionLastProgressAt", "companionRejoinMode"]);
  hasAll(rules, ["CAMPAIGN_COMPANION_STALL_RECOVERY_MS", "CAMPAIGN_COMPANION_HARD_RECOVERY_MS", "campaignCompanionShouldHardRejoin"]);
  const companionRecovery = app.slice(app.indexOf("const companionNow = performance.now()"), app.indexOf("const target = nearestEnemy(fighter, 30)"));
  assert.ok(companionRecovery.includes("commitGridMove(fighter, nx, ny, moveDuration)"), "companion recovery must walk along the open route");
  const forcedFollowAt = companionRecovery.indexOf("fighter.companionRejoinMode = true"),
    hardFallbackAt = companionRecovery.indexOf("if (hardRecovery)"),
    teleportAt = companionRecovery.indexOf("fighter.x = emergencyGoal.x");
  assert.ok(forcedFollowAt >= 0 && hardFallbackAt > forcedFollowAt && teleportAt > hardFallbackAt, "teleport must remain behind the prolonged hard-recovery guard");
  hasAll(app, [
    '? ["medKit", "medKit"]',
    "grid[18][14] = { type: 0, hp: 0, max: 0 }",
    "[[17, 16], [25, 25]",
    "sourceInstallation: t",
    'kind: "installation", id: attackingInstallation.id',
    "ally.assistTargetKind = target.kind",
    "ally.assistTargetId = target.id",
    "Math.max(1.5, definition?.stats.range",
    "stitchRoutePoints(ALLY, route.points, open)",
    "unit.team !== fighter.team",
    "target.team === attacker.team",
  ]);
  const playerControl = app.slice(app.indexOf("const m = mobileMove.current"), app.indexOf("if (isCampaign) {", app.indexOf("const m = mobileMove.current")));
  assert.ok(!playerControl.includes("recentAssistThreat"), "the directly controlled hero must not invent an automatic retaliation target");
  assert.ok(!app.includes("campaign5FirstGateReady("), "chapter 5 first gate must start open without a rally check");
  const campaignHeroLoop = app.slice(app.indexOf("if (isCampaign && !(campaignChapter === 3"), app.indexOf("for (const u of units) if (u.role === \"minion\""));
  assert.ok(
    campaignHeroLoop.indexOf('fighter.campaignGuard === "pyeongtaek"') < campaignHeroLoop.indexOf("fighter.campaignActivated === false"),
    "the dormant Pyeongtaek guard must be allowed to detect the arriving doctors before the inactive guard skip",
  );
  const minionStep = app.slice(app.indexOf("stepMinion ="), app.indexOf("const drawMarchRoutes"));
  hasAll(minionStep, ["hasStrategicRoute ? undefined : recentAssistThreat(u)", "campaignSentryTarget(u)", "assistInstallation", "u.campaignGuardX", "!u.campaignSentry && Math.abs(enemyBase.x"]);
  hasAll(rules, ["CAMPAIGN1_WAVE_COUNTS = { 1: 18, 2: 24 }", "CAMPAIGN1_MAX_ACTIVE_INVADERS = 9", "CAMPAIGN2_SCIENTIST_START_DELAY_MS = 5000", "CAMPAIGN_ASSIST_RADIUS = 20", "CAMPAIGN_COMPANION_AGGRO_DISTANCE = 24", "CAMPAIGN_COMPANION_ASSIST_DISTANCE = 160", "CAMPAIGN_COMPANION_ASSIST_MEMORY_MS = 20000", "CAMPAIGN_SENTRY_AGGRO_DISTANCE = 9", "campaignCompanionGoalOffsets", "campaignCompanionMoveDuration", "regroupCount >= 2", "now - lastProgressAt >= CAMPAIGN1_RETREAT_AFTER_MS", "arrivedScientists >= 1"]);
  hasAll(runtime, ["campaignSentry?: boolean", "campaignGuardX?: number", 'assistTargetKind?: "unit" | "installation"', "assistTargetId?: number", "assistReason?:", "campaignPotionUsed?: boolean"]);
  hasAll(navigation, ["shortestRouteToAny", "attackPositionCandidates", "stitchRoutePoints"]);
  assert.ok(css.includes("background: #02040470"), "talent choice should leave the running battle visible");
  const levelUp = app.slice(app.indexOf("applyHeroLevel ="), app.indexOf("gainHeroXp ="));
  assert.ok(!levelUp.includes("pausedRef.current = true"), "talent level-up must not pause simulation");
  assert.ok(!levelUp.includes("setPaused(true)"), "talent level-up must not open the pause state");
});

test("the first input starts persistent menu audio without a dedicated button", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, ["gameAudio.unlock()", 'screen !== "play"', "gameAudio.startMenu()", 'tone("swing")', 'tone("item")', 'tone("evade")']);
  assert.ok(!app.includes("BGM 시작"));
});

test("both route panels remain visible and the minimap stays aligned for collapse and drag", async () => {
  const [app, css] = await Promise.all([source("app/Seoul999mBelow.tsx"), source("app/globals.css")]);
  hasAll(app, ["minimapCollapsed", "minimapCollapsedRef", "toggleMinimap", "syncMinimapOverlay", 'stage.style.setProperty("--minimap-left"', 'stage.style.setProperty("--minimap-top"', "미니맵 펼치기", "미니맵 접기"]);
  hasAll(css, ["grid-template-columns: repeat(2, minmax(0, 1fr))", ".minimap-toggle.collapsed", ".battle-stage .minimap-hit[hidden]", ".battle-stage.minimap-layout-ready .minimap-hit", "left: var(--minimap-left", "top: var(--minimap-top"]);
});

test("growth, blockers, campaign defenders, healing, and terrain combat rules stay explicit", async () => {
  const app = await source("app/Seoul999mBelow.tsx");
  hasAll(app, [
    "const applyTeamMinionLevel =",
    "unit.level = next",
    "unit.hp = unit.maxHp * hpRatio",
    "applyTeamMinionLevel(\"blue\", nextMinionLevel)",
    "snapshot.teamMinionLevels[ownCanonical]",
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
    "ENERGY_DRINK_HEAL_RATIO",
    "에너지 드링크 · 체력 60% 회복 + 5초 가속",
    "itemCharges[slot] = Math.max(0, itemCharges[slot] - 1)",
    'itemCharges: [number, number] = isCampaign',
    '(unit.role === "hero" || unit.role === "minion")',
    'u.campaignThreat === "boss"',
    "gainHeroXp(8)",
    "clearRay(hero.x, hero.y, u.x, u.y)",
    'new Set(["acidShot", "glide", "overclock"])',
  ]);
  const damageBase = app.slice(app.indexOf("damageBase ="), app.indexOf("const breakTile"));
  assert.ok(damageBase.includes("canDamageCore"), "cores must reject installation damage");
  assert.ok(damageBase.includes("canDamageShield"), "shields must reject non-unit damage");
  assert.ok(damageBase.includes("exposedCoreDamage"), "exposed core damage must use role scaling");
  const minionStep = app.slice(app.indexOf("const stepMinion ="), app.indexOf("const drawMarchRoutes"));
  assert.ok(minionStep.includes('melee(u, { x: enemyBase.x - u.x, y: enemyBase.y - u.y }, 0, "coreSiege")'), "minions adjacent to a core must attack it directly");
});

test("core siege AI, fourteen build shortcuts, computer restart, coordinate bombardment, and slower talents stay wired to runtime", async () => {
  const app = await source("app/Seoul999mBelow.tsx"),
    heroStep = app.slice(app.indexOf("stepBattleHero ="), app.indexOf("const arenaFighters")),
    meleeResolver = app.slice(app.indexOf("const resolveMelee ="), app.indexOf("const updateMeleeHits")),
    tacticalDraw = app.slice(app.indexOf("const drawTacticalAreas ="), app.indexOf("const drawFields"));
  hasAll(app, [
    '<kbd>B</kbd>',
    'if (e.code === "KeyB")',
    '"KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"',
    '"KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ"',
    '"build:upgrade"',
    '"build:demolish"',
    '"tactical:defense"',
    '"tactical:reinforce"',
    '"research:minion"',
    '"elite:reserve"',
    "e.stopImmediatePropagation()",
    'e.ctrlKey && (e.code === "ShiftLeft" || e.code === "ShiftRight")',
    'className="build-shortcut"',
    'className="tactical-shortcut"',
    'setBuildMenuOpen((open) => !open)',
    "const restartComputerBattle = () =>",
    "setBattleRunId((run) => run + 1)",
    "onClick={restartComputerBattle}",
    'attackTarget.kind === "base" ? "coreSiege" : undefined',
    'event.impactAt = now',
    'event.expiresAt = now + 520',
    'selectedTalentIds.length}/${TALENT_LEVELS.length}',
    'className="talent-selected-card"',
    'disabled={!pendingTalentTiers.includes(level) && !chosen}',
    'inAllyCoreVision(x, y) || visionSources().some',
    'cutVisionHole(',
  ]);
  assert.ok(!app.includes("Ctrl+Shift+"), "all fourteen direct commands must use only Ctrl plus one letter");
  assert.ok(!app.includes("location.reload()"), "computer rematch must restart the battle effect instead of reloading to the title");
  hasAll(heroStep, [
    "coreAssault = !sentry",
    'unit.id === aiHero.aiTargetId || unit === assistTarget',
    'reason: "교전 대상이 없으면 기지에 머물지 않고 적 거점 공세를 재개한다"',
    '"coreSiege"',
    'aiHero.aiPreviousAction = "attack-core"',
  ]);
  hasAll(meleeResolver, ['hit.variant === "coreSiege"', "damageBase(u.team, u.attack + hit.bonus, u)"]);
  hasAll(tacticalDraw, ["impactProgress", "createLinearGradient", "fillRect(-radius, -viewHeight", "strokeRect(-size"]);
});

test("persistent support auras and all three control installations stay wired to combat", async () => {
  const [app, content, entities] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("game/content.ts"),
    source("game/runtimeEntities.ts"),
  ]);
  hasAll(content, [
    'build("highVoltageTrap"',
    'build("acidSporeSac"',
    'build("restraintT3"',
    'supportAura:{kind:"attack",value:.08,upgradedValue:.12}',
    'supportAura:{kind:"speed",value:.08,upgradedValue:.12}',
    'supportAura:{kind:"range",value:.5,upgradedValue:.75}',
  ]);
  hasAll(app, [
    "activeSupportAura = (team: Team)",
    "supportAuraForUnit = (unit: Unit)",
    't.kind === "highVoltageTrap"',
    't.kind === "acidSporeSac"',
    '? "spore"',
    'sourceInstallation: s.sourceInstallation',
    "def.control?.stunMs",
  ]);
  assert.ok(!app.includes("launchBuffUntil"));
  assert.ok(!entities.includes("launchBuffUntil"));
});

test("player can select the full enemy core sprite and Ctrl-click it into a persistent siege order", async () => {
  const app = await source("app/Seoul999mBelow.tsx"),
    pointerOrders = app.slice(app.indexOf("basicAttackAtPointer ="), app.indexOf("beginSkillAim ="));
  hasAll(app, [
    "baseTargetAtWorld =",
    "wx >= cx - width / 2 - 5",
    "baseAt(x, y) ?? baseTargetAtWorld(w.x, w.y)",
    "attackCommandAtPointer()",
  ]);
  hasAll(pointerOrders, [
    "attackCommandAtPointer =",
    "issuePointerOrder()",
    'attackTarget = { kind: "base", x: ENEMY.x, y: ENEMY.y }',
    "wx: ENEMY.x * S + S / 2",
    "적 ${FACTION_BASES[enemyFaction].name} 공격 명령",
  ]);
  hasAll(app, [
    "Math.max(1.5, playerDef.stats.range) * S * 0.92",
    'attackTarget.kind === "base" ? "coreSiege" : undefined',
  ]);
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
    "enemyBuildCredits = SKIRMISH_STARTING_CREDITS",
    "awardCredits",
  ]);
  assert.ok(!app.includes("money += 2"), "player credits must not rise from idle time");
  assert.ok(!app.includes("enemyBuildCredits += 3"), "computer credits must follow combat and ore rewards");
  assert.ok(!app.includes('units.push(makeCampaignHero("sanmi", "red", 45, 20, "battle", 1))'), "campaign 1 must not spawn an early Sanmi boss");
  assert.ok(presentation.includes("c999: [-1, 1, -1, -1, 1, -1]"), "C-999 moving frame source direction must be independent from idle");
});

test("secret tunnel contacts, hidden public rooms, access-safe attacks, and region markings stay wired to runtime", async () => {
  const [app, css, tunnelRules, battleMaps] = await Promise.all([
    source("app/Seoul999mBelow.tsx"),
    source("app/globals.css"),
    source("game/secretTunnelRules.ts"),
    source("game/battleMaps.ts"),
  ]);
  hasAll(app, [
    "blueCoreArea",
    "redCoreArea",
    "preopenedPublicSpace",
    "pickTeamSpawnCell",
    "공동 접촉 터널 개통 · 맞닿은 양 팀 터널 공동화",
    'hud.battlePhase !== "prepare"',
    'className="tunnel-zone-legend"',
    "아군 전용",
    "적군 전용",
    'B: { id: "B", color: "#ff78c8"',
    "30초 초고속 굴착 · 4분 침공",
    "secretTunnelRushDigDamage(",
    "SECRET_TUNNEL_PREPARE_SPEED_MULTIPLIER",
    "SECRET_TUNNEL_DRILL_COOLDOWN_MULTIPLIER",
    "secretTunnelPrepareDuration(95)",
    "expandedDrillReach(spec.length)",
    "DRILL_ACTION_LOCK_MS",
    "targetAccessible: canEngageAt(aiHero.team",
    "컴퓨터 공세 영웅은 후퇴하지 않고 적 코어로 전진한다",
    "setSelectedMapId(defaultBattleMapForRuleset(ruleset));",
    "secretTunnelCoreEntryGoal(opposingCore, teamHeroSlot)",
    "executeBattleHeroDrill(aiHero, goal, { direction: step })",
  ]);
  hasAll(css, [
    ".tunnel-zone-legend",
    ".secret-phase-announcement",
    ".tunnel-zone-legend .opponent i",
  ]);
  assert.ok(!css.includes(".tunnel-zone-legend .shared"), "shared spaces must not have a legend style");
  assert.ok(!css.includes(".tunnel-zone-legend .routes"), "A/B routes must remain independent from the ownership legend");
  assert.ok(!app.includes("setSelectedMapId(defaultBattleMapForRuleset(ruleset).id)"), "open-front selection must keep its map id string");
  hasAll(tunnelRules, [
    "return phase !== \"finished\"",
    "shareAdjacentSecretTunnelContacts",
    "revealOpponent && opponentPrivate",
  ]);
  for (const retiredConcept of [
    "secretTunnelCombatApronPoints",
    "shareSecretTunnelCombatAprons",
    "secretCombatApronKeys",
    "combatApron",
    "코어 전실",
    "공용 전실",
    "공용 전투구역",
  ]) assert.ok(!app.includes(retiredConcept), `${retiredConcept} must be retired from runtime`);
  assert.ok(!css.includes(".tunnel-zone-legend .apron"), "the retired apron legend style must be absent");
  assert.ok(!tunnelRules.includes("CombatApron"), "the rules module must not retain a special core-apron type");
  hasAll(battleMaps, ["seedSecretOreVeins", 'id.startsWith("secret-")', "ore: 26 +"]);

  const overlayStart = app.indexOf("secretTunnelOverlay = createSecretTunnelOverlay({");
  const overlayInit = app.slice(overlayStart, app.indexOf("if (isCampaign) {", overlayStart));
  hasAll(overlayInit, [
    "blueCoreArea",
    "redCoreArea",
    "Math.abs(x - ALLY.x)",
    "Math.abs(x - ENEMY.x)",
    "<= 4",
    "TUNNEL_ACCESS.shared",
  ]);
  assert.ok(!overlayInit.includes("seen[y][x] = true"), "pre-opened shared rooms must stay fogged until explored");
  assert.ok(!overlayInit.includes("* 5"), "secret-tunnel walls must keep the original terrain durability");
  const secretDig = app.slice(app.indexOf("result = digSecretTunnelTileAndShareContacts("), app.indexOf("secretTunnelOverlay = result.overlay"));
  assert.ok(secretDig.includes("u.team,\n              rushPower,"), "secret-tunnel preparation must clear the remaining team durability in one hit");
  assert.ok(!secretDig.includes("power * 1.6"), "secret-tunnel preparation must not use a partial damage multiplier");
  hasAll(app, [
    'announceSecretPhase("터널 뚫기 시작"',
    'announceSecretPhase("거점 공격 시작"',
    "resetSecretTunnelHeroesToCores",
    "영웅 전원 기지 복귀",
    'useState<BattleMapId>("secret-crossroads")',
  ]);
  const accessOverlay = app.slice(app.indexOf("drawTunnelAccessOverlay ="), app.indexOf("render =", app.indexOf("drawTunnelAccessOverlay =")));
  hasAll(accessOverlay, [
    'battlePhase === "prepare"',
    "TUNNEL_ACCESS.blue",
    "TUNNEL_ACCESS.red",
    "ctx.fillRect(px - 1, py - 1, S + 2, S + 2)",
    "accessAt(x - 1, y) !== tile.access",
    "accessAt(x + 1, y) !== tile.access",
    "accessAt(x, y - 1) !== tile.access",
    "accessAt(x, y + 1) !== tile.access",
    "if (!own)",
    "ctx.setLineDash([3, 4])",
    'ctx.strokeStyle = "#ffaca7"',
  ]);
  for (const retiredSharedMark of ["TUNNEL_ACCESS.shared", "sharedContact", "sharedBackbone", "strokeRect"])
    assert.ok(!accessOverlay.includes(retiredSharedMark), `${retiredSharedMark} must not be rendered in the ownership overlay`);
  assert.ok(!accessOverlay.includes("contactBulkhead"), "the retired X contact bulkhead must not be rendered");
  const routeOverlay = app.slice(app.indexOf("drawMarchRoutes ="), app.indexOf("heroBrainRole ="));
  assert.ok(routeOverlay.includes('battlePhase === "prepare"'), "A/B route markings must stay hidden during digging");
  assert.ok(!routeOverlay.includes("secretCombatApronKeys"), "A/B routes must not depend on a retired apron concept");

  const spawnSelection = app.slice(app.indexOf("const pickTeamSpawnCell ="), app.indexOf("spawnMinion ="));
  hasAll(spawnSelection, [
    "openForTeam(cell.x, cell.y, team)",
    "return candidates.find(available)",
  ]);
  const protectedAttackSlices = [
    ["spec.mode === \"acidMark\"", "spec.mode === \"silkPull\""],
    ["spec.mode === \"silkPull\"", "spec.mode === \"nightPatrol\""],
    ["spec.mode === \"microwave\"", "spec.mode === \"acidCone\""],
    ["spec.mode === \"overclock\"", "spec.mode === \"lockdown\""],
  ];
  for (const [start, end] of protectedAttackSlices) {
    const section = app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start) + start.length));
    assert.ok(section.includes("canEngageAt"), `${start} must respect secret-tunnel access`);
  }
  for (const [start, end] of protectedAttackSlices.slice(0, 3)) {
    const section = app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start) + start.length));
    assert.ok(!section.includes("clearRay("), `${start} must keep its existing wall-piercing targeting in other modes`);
  }
  const fillGuard = app.slice(app.indexOf("fillPlacementError ="), app.indexOf("toggleFillMode ="));
  hasAll(fillGuard, ["TUNNEL_ACCESS.shared", "공동 터널은 메울 수 없다"]);
  const rejectStart = app.indexOf('f.kind === "reject"');
  const rejectField = app.slice(rejectStart, app.indexOf('if (f.kind === "repair")', rejectStart));
  assert.ok(rejectField.includes("canEngageAt"), "the moving reject wall must not damage through a private tunnel");
  assert.ok(
    rejectField.includes('canEngageAt(f.team ?? "blue", Math.floor(sx), Math.floor(sy))'),
    "the moving reject wall must not reflect projectiles through a private tunnel",
  );
  const eliteSweepAction = app.indexOf('action: "포식 휩쓸기"');
  const eliteSweep = app.slice(
    app.lastIndexOf('if (u.minionRole === "elite" && u.faction === "bugborn"', eliteSweepAction),
    app.indexOf("u.act = attackDelay", eliteSweepAction),
  );
  assert.ok(eliteSweep.includes("canEngageAt"), "the Bugborn elite sweep must not damage through a private tunnel");
});
