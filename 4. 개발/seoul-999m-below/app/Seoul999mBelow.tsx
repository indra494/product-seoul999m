"use client";
/* Canvas simulation callbacks intentionally own mutable refs and imperative frame state. */
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/purity, prefer-const */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BUILDABLES,
  FACTION_BASES,
  FACTIONS,
  HEROES,
  HERO_LEVELS,
  MINION_LEVELS,
  factionBuildables,
  minionDefinition,
  supportAuraAppliesToRole,
  supportAuraValue,
  type BuildableDefinition,
  type FactionId,
  type HeroDefinition,
  type MinionRole,
} from "../game/content";
import { heroKit } from "../game/heroKits";
import {
  TALENT_LEVELS,
  combineHeroTalentEffects,
  heroTalentById,
  heroTalentChoices,
  type TalentIcon as TalentIconKind,
  type TalentTier,
} from "../game/heroTalents";
import { heroAction } from "../game/heroActions";
import {
  DRILL_ACTION_LOCK_MS,
  expandedDrillReach,
  radialDrillOffsets,
} from "../game/drillRules";
import { heroFramePlan } from "../game/heroPresentation";
import { decideHeroAction, type HeroBrainRole } from "../game/heroBrain";
import { unitMovementDuration, unitMovementSpeed } from "../game/movementRules";
import { siegeResponse } from "../game/aiSiegeRules";
import { applyBattleMapLayout, battleExplorationSectors, battleMap, battleMapsForRuleset, defaultBattleMapForRuleset, resolveLocalBattleSpawns } from "../game/battleMaps";
import { buildPlacementCost } from "../game/buildRules";
import {
  ENERGY_DRINK_HEAL_RATIO,
  coreRegenAmount,
  emergencyRepairAmount,
} from "../game/healingRules";
import { gameAudio, type CombatSfx } from "../game/combatAudio";
import { canDamageCore, canDamageShield, exposedCoreDamage } from "../game/coreCombatRules";
import {
  CAMPAIGN_OBJECTIVES,
  campaignObjectiveProgress,
} from "../game/campaignObjectives";
import {
  CAMPAIGN_CINEMATICS,
  CAMPAIGN_CINEMATIC_STORAGE_KEY,
  CAMPAIGN_PROLOGUE_STORAGE_KEY,
  CAMPAIGN_PROLOGUE_VIDEO,
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  campaignChapterStatus,
  completeCampaignChapter,
  hasSeenCampaignPrologue,
  parseCampaignChapterList,
  type CampaignChapter,
} from "../game/campaignProgress";
import { canEmergencyBreach } from "../game/minionBreachRules";
import {
  chooseCombatApproachSlot,
  minionCombatDetourAllowance,
  MINION_COMBAT_SLOT_MEMORY_MS,
} from "../game/minionCoordination";
import { guaranteedMinionLevelForWave, minionResearchReady, minionResearchUnlockWave, nextMinionResearch, teamMinionLevels, type MinionLevel } from "../game/minionResearch";
import { ELITE_RECOVERY_SCALE, ELITE_TACTICAL_EFFECT_SCALE, TACTICAL_RECOVERY_FRACTION, TACTICAL_RECOVERY_TICK_MS, TACTICAL_SHARED_COOLDOWN_MS, TACTICAL_SUPPORT, tacticalBuffVisual, tacticalDefinition, type TacticalBuffRole, type TacticalRole } from "../game/tacticalSupport";
import { AUTONOMOUS_FRONTIER_REPLAN_MS, computerWaveFormation, frontLineScreenGoal, marchStanceBehavior, minionExplorationCohort, MINION_ENGAGEMENT_RADIUS, MINION_PURSUIT_DISTANCE, MINION_TARGET_MEMORY_MS, retainCoreDiscovery, secretTunnelCoreEntryGoal, skirmishHeroAggroRadius, skirmishHeroShouldPursue, SKIRMISH_HERO_PURSUIT_DISTANCE, teamHasSpottedCore, triangulateCoreAfterTimeout } from "../game/skirmishAi";
import { canReserveElite, createEliteDeploymentState, ELITE_RESERVATION_COST, ELITE_UNLOCK_WAVE, eliteReadyInWaves, REGULAR_MINION_CAP, REINFORCEMENT_MINION_CAP, reinforcementFormation, withReservedElite } from "../game/eliteMinions";
import { creditedAmount, ELITE_KILL_CREDITS, HERO_KILL_CREDITS, installationKillCredits, MINION_KILL_CREDITS, SKIRMISH_STARTING_CREDITS } from "../game/skirmishEconomy";
import {
  SKIRMISH_DIFFICULTIES,
  skirmishDifficultyBalance,
  type SkirmishDifficulty,
} from "../game/skirmishDifficulty";
import {
  SECRET_TUNNEL_ASSAULT_MS,
  SECRET_TUNNEL_DRILL_COOLDOWN_MULTIPLIER,
  SECRET_TUNNEL_PREPARE_MS,
  SECRET_TUNNEL_PREPARE_SPEED_MULTIPLIER,
  TUNNEL_ACCESS,
  canTraverseSecretTunnelInPhase,
  chooseSecretTunnelRoute,
  createSecretTunnelOverlay,
  digSecretTunnelTileAndShareContacts,
  evaluateSecretTunnelConnections,
  resolveSecretTunnelPreparation,
  resolveSecretTunnelTimeout,
  sealSecretTunnelTileForTeam,
  secretTunnelPrepareDuration,
  secretTunnelRushDigDamage,
  secretTunnelTileAt,
  secretTunnelTileViewForTeam,
  selectSecretTunnelContact,
  shareSecretTunnelBackbone,
  type BattlePhase,
  type SecretTunnelOverlay,
  type SecretTunnelTileOverlay,
  type TunnelRouteAllocation,
} from "../game/secretTunnelRules";
import {
  advanceRouteCursor,
  attackPositionCandidates,
  diverseRouteToGoal,
  forwardRouteRejoin,
  reachableFrontierGoal,
  shortestRouteToAny,
  stitchRoutePoints,
  type GridPoint,
} from "../game/gridNavigation";
import {
  CAMPAIGN1_MAX_ACTIVE_INVADERS,
  CAMPAIGN1_RETREAT_AFTER_MS,
  CAMPAIGN1_SCOUT_EXIT_MS,
  CAMPAIGN1_VENT_DELAY_MS,
  CAMPAIGN1_WAVE_COUNTS,
  CAMPAIGN2_SCIENTIST_START_DELAY_MS,
  CAMPAIGN_ASSIST_MEMORY_MS,
  CAMPAIGN_ASSIST_RADIUS,
  CAMPAIGN_COMPANION_ASSIST_DISTANCE,
  CAMPAIGN_COMPANION_ASSIST_MEMORY_MS,
  CAMPAIGN_COMPANION_AGGRO_DISTANCE,
  campaignCompanionGoalOffsets,
  CAMPAIGN_SENTRY_AGGRO_DISTANCE,
  campaign1AdvanceWatch,
  campaign1BossShouldEnter,
  campaign1ShouldForceExit,
  campaign1VictoryReady,
  campaign2EscortOutcome,
  campaign3ArenaHeal,
  campaignCompanionMode,
  campaignCompanionMoveDuration,
  campaignShouldEngageLocalObjective,
  campaignCompanionShouldHardRejoin,
  campaignCompanionShouldEmergencyRejoin,
  campaignStageIsActive,
  isCampaignSentryChapter,
  shouldRemoveSpawnOrder,
  shouldUseCampaign1GuardGoal,
} from "../game/campaignRules";
import {
  createComputerMatch,
  createOnlineMatch,
  type BattleMapId,
  type BattleRuleset,
  type MatchConfig,
  type TeamSize,
} from "../game/matchConfig";
import { minimapDragAnchor, minimapDragTarget, type RatioPoint } from "../game/minimapCamera";
import {
  ONLINE_REMOTE_INTERPOLATION_MS,
  ONLINE_SNAPSHOT_INTERVAL_MS,
  newestOnlineRoomView,
  onlineRoomRuleset,
  roomCanStart,
  shouldApplyAuthoritativeHeroPosition,
  shouldPreserveOnlineTerrainPrediction,
  type OnlineRoomView,
  type RoomClientIdentity,
} from "../game/onlineRoom";
import type { OnlineBattleCommand, OnlineBattleSnapshot } from "../game/onlineRoom";
import { connectOnlineRoomSocket, createOnlineRoom, joinOnlineRoom, sendOnlineBattleCommand, sendOnlineBattleSnapshot, updateOnlineRoom, type OnlineRoomSocket } from "../game/onlineRoomClient";
import {
  createBuildableUnit,
  createCivilianUnit,
  createHeroUnit,
  createMinionUnit,
  type RouteId,
  type Team,
  type Turret,
  type Unit,
} from "../game/runtimeEntities";

type GameMode = "skirmish" | "campaign1";
type BattleOutcome = "win" | "lose" | "draw";
type CampaignDifficulty = "easy" | "hard";
type CampaignCinematicMode = "missionStart" | "replay";
type BattleScale = 1 | 1.5;
type Tile = {
  type: number;
  hp: number;
  max: number;
  ore?: number;
  freshUntil?: number;
  filledBy?: Team;
  surface?: "shallowWater" | "platform" | "ramp";
  obstacle?: "root" | "deepWater" | "ledge";
  hazard?: "steam";
};
type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: Team;
  damage: number;
  life: number;
  kind:
    | "arrow"
    | "blast"
    | "turret"
    | "rock"
    | "can"
    | "minion"
    | "root"
    | "venom"
    | "laser"
    | "missile"
    | "shock"
    | "spore"
    | "tether"
    | "acid"
    | "spray"
    | "disc"
    | "web"
    | "ampoule"
    | "receipt";
  critChance: number;
  critMultiplier: number;
  splash?: number;
  stun?: number;
  pierce?: boolean;
  hitIds?: number[];
  source?: Unit;
  sourceInstallation?: Turret;
  hitBase?: boolean;
  ignoresTerrain?: boolean;
};
type SlashFx = {
  x: number;
  y: number;
  dir: { x: number; y: number };
  life: number;
  maxLife: number;
  kind: "toy" | "spin" | "thrust" | "drill" | "ultimate" | "signature";
  variant?: string;
  color?: string;
  radius?: number;
  damage?: number;
  resolved?: boolean;
  hitIds?: number[];
};
type PendingMelee = {
  attacker: Unit;
  dir: { x: number; y: number };
  bonus: number;
  delay: number;
  variant?: string;
  stun?: number;
};
type DamageRecord = { attacker: string; action: string; amount: number; critical: boolean };
type DefeatSummary = { killer: string; action: string; amount: number; recent: DamageRecord[] };
type GroundMine = {
  x: number;
  y: number;
  team: Team;
  armedAt: number;
  detonateAt: number;
};
type ItemId = "wallBomb" | "energyDrink" | "medKit" | "armorPlate" | "scanner" | "phaseBoots";
type JumpVisual = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
};
type TacticalAreaEvent = {
  team: Team;
  faction: FactionId;
  x: number;
  y: number;
  startedAt: number;
  nextAt: number;
  expiresAt: number;
  hits: number;
  impactAt?: number;
};
type TacticalTeamState = {
  cooldownUntil: number;
  defenseUntil: number;
  offenseUntil: number;
  recoveryUntil: number;
  recoveryNextAt: number;
};
type FieldFx = {
  x: number;
  y: number;
  kind: "electric" | "acid" | "web" | "molt" | "lockdown" | "repair" | "reject";
  radius: number;
  life: number;
  maxLife: number;
  tick: number;
  damage: number;
  color: string;
  hitIds: number[];
  team?: Team;
  sourceInstallation?: Turret;
  dir?: { x: number; y: number };
  speed?: number;
};
type YooAnim =
  | "locomotion"
  | "basic"
  | "whirlwind"
  | "thrust"
  | "drill"
  | "ultimate"
  | "hurt"
  | "down"
  | "revive";
type BuildKind = string;
type BuildMode = BuildKind | "upgrade" | "demolish" | "none";
type Skill = 0 | 1 | 2 | 3;
type MarchRoute = {
  id: RouteId;
  color: string;
  points: Array<{ x: number; y: number }>;
  plannedCells: GridPoint[];
  pathMode: "direct" | "flank" | "shared";
  overlapRatio: number;
  revision: number;
};
const COLS = 56,
  ROWS = 36,
  BASE_TILE_SIZE = 40,
  VW = 760,
  VH = 500,
  DIRS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
const WALKABLE_TERRAIN = new Set([0, 9, 10, 11]);
const ROUTE_DRAFT_SAFETY_LIMIT = 64;
const BATTLE_SCALE_STORAGE_KEY = "seoul999m-battle-scale";
const SKIRMISH_ITEM_CHARGES = 2;
const ITEM_SHARED_COOLDOWN_MS = 1_000;
const BUILD_HOTKEY_CODES = [
  "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM",
  "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ",
] as const;
const BUILD_HOTKEY_LABELS = [
  "Z", "X", "C", "V", "B", "N", "M",
  "A", "S", "D", "F", "G", "H", "J",
] as const;
const buildHotkeyLabel = (index: number) =>
  `Ctrl+${BUILD_HOTKEY_LABELS[index] ?? "?"}`;
const CAMPAIGN_DIFFICULTIES: Record<CampaignDifficulty, {
  label: string;
  callout: string;
  heroLevel: 1 | 2;
  minionLevel: 1 | 2 | 3;
  allyHp: number;
  allyDamage: number;
  incomingDamage: number;
  xpGain: number;
}> = {
  easy: { label: "쉬움", callout: "영웅 LV.2 · 진군대 LV.2 · 피해 30% 감소 · 빠른 성장", heroLevel: 2, minionLevel: 2, allyHp: 1.35, allyDamage: 1.1, incomingDamage: 0.7, xpGain: 1.4 },
  hard: { label: "어려움", callout: "영웅·진군대 LV.1 · 피해 12% 감소 · 성장 보정", heroLevel: 1, minionLevel: 1, allyHp: 1.15, allyDamage: 1.04, incomingDamage: 0.88, xpGain: 1.1 },
};
const BUILD_BY_ID = Object.fromEntries(
  BUILDABLES.map((def) => [def.id, def]),
) as Record<string, BuildableDefinition>;
const SUPPLY_ITEMS: Record<
  ItemId,
  { name: string; effect: string; icon: string }
> = {
  wallBomb: {
    name: "압력 지뢰",
    effect: "발밑 설치 · 3초 또는 적 접촉 시 광역 폭발",
    icon: "✹",
  },
  energyDrink: {
    name: "에너지 드링크",
    effect: "체력 60% 회복 · 5초 가속",
    icon: "▥",
  },
  medKit: { name: "응급 수복팩", effect: "체력 100% 즉시 회복", icon: "+" },
  armorPlate: { name: "복합 장갑판", effect: "8초간 방어력 강화", icon: "▰" },
  scanner: { name: "진동 탐지기", effect: "주변 8칸 지형과 위협 탐지", icon: "◎" },
  phaseBoots: { name: "위상 장화", effect: "10초 가속 · 1초 회피", icon: "≫" },
};
const MENU_SCENES = [
  "scene-01-dead-seoul.png", "scene-02-descent.png", "scene-03-air-purification-layer.png",
  "scene-04-underground-seoul.png", "scene-05-scrap-rebuilding.png", "scene-06-secret-tunnels.png",
  "scene-07-tunnel-threats.png", "scene-08-discovery.png",
];
const RUNTIME_VISUAL_SOURCES = [
  "/assets/characters/sprites/yoo-seungcheon/yoo-locomotion-v1-alpha.png",
  "/assets/characters/sprites/yoo-seungcheon/yoo-hurt-down-v1-alpha.png",
  "/assets/characters/sprites/roster-v1/human-roster-actions-v1.png",
  "/assets/characters/sprites/roster-v1/bugborn-roster-actions-v1.png",
  "/assets/characters/sprites/roster-v1/ai-roster-actions-v1.png",
  "/assets/characters/sprites/roster-v2/human-roster-vertical-v2.png",
  "/assets/characters/sprites/roster-v2/bugborn-roster-vertical-v2.png",
  "/assets/characters/sprites/roster-v2/ai-roster-vertical-v2.png",
  "/assets/characters/sprites/roster-v3/human-roster-skill-poses-v3.png",
  "/assets/characters/sprites/roster-v3/bugborn-roster-skill-poses-v3.png",
  "/assets/characters/sprites/roster-v3/ai-roster-skill-poses-v3.png",
  "/assets/characters/sprites/roster-v4/human-roster-vertical-combat-v4.png",
  "/assets/characters/sprites/roster-v4/bugborn-roster-vertical-combat-v4.png",
  "/assets/characters/sprites/roster-v4/ai-roster-vertical-combat-v4.png",
  "/assets/characters/sprites/roster-v1/ai-c999-director-actions-v2.png",
  "/assets/minions/human/human-minion-actions-v1.png",
  "/assets/minions/bugborn/bugborn-minion-actions-v1.png",
  "/assets/minions/ai/ai-minion-actions-v1.png",
  ...["han", "yoon", "min"].map((id) => `/assets/campaign/scientists/scientist-${id}-v2.png`),
  ...Object.values(FACTION_BASES).map((definition) => definition.asset),
  ...BUILDABLES.flatMap((definition) => definition.asset ? [definition.asset] : []),
] as const;
const runtimeImageCache = new Map<string, HTMLImageElement>();
const runtimeImage = (src: string) => {
  const cached = runtimeImageCache.get(src);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  runtimeImageCache.set(src, image);
  return image;
};
const waitForRuntimeImage = (src: string) => {
  const image = runtimeImage(src);
  if (image.complete && image.naturalWidth > 0) return Promise.resolve(image);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const loaded = () => {
        image.removeEventListener("error", failed);
        resolve(image);
      },
      failed = () => {
        image.removeEventListener("load", loaded);
        runtimeImageCache.delete(src);
        reject(new Error(`runtime visual failed: ${src}`));
      };
    image.addEventListener("load", loaded, { once: true });
    image.addEventListener("error", failed, { once: true });
  });
};
const preloadRuntimeVisuals = () =>
  Promise.all(RUNTIME_VISUAL_SOURCES.map(waitForRuntimeImage));
const MenuSceneBackdrop = () => (
  <div className="menu-scene-backdrop" aria-hidden="true">
    {MENU_SCENES.map((scene, index) => (
      <img key={scene} src={`/assets/opening/scenes-v12/${scene}`} style={{ animationDelay: `${index * 5}s` }} alt="" />
    ))}
  </div>
);
const heroPortraitStyle = (hero: HeroDefinition): CSSProperties => {
  if (hero.id === "yoo-seungcheon")
    return {
      backgroundImage: "url(/assets/characters/sprites/yoo-seungcheon/yoo-locomotion-v1-alpha.png)",
      backgroundSize: "600% 400%",
      backgroundPositionX: "-14px",
      backgroundPositionY: "0%",
    };
  if (hero.id === "c999")
    return {
      backgroundImage: "url(/assets/characters/sprites/roster-v1/ai-c999-director-actions-v2.png)",
      backgroundSize: "600% 100%",
      backgroundPosition: "0% 50%",
    };
  const factionHeroes = HEROES.filter((candidate) => candidate.faction === hero.faction),
    rows = hero.faction === "human" ? 3 : 4,
    rawRow = factionHeroes.findIndex((candidate) => candidate.id === hero.id),
    row = hero.faction === "human" ? Math.max(0, rawRow - 1) : Math.max(0, rawRow),
    sheet = hero.faction === "human"
      ? "/assets/characters/sprites/roster-v1/human-roster-actions-v1.png"
      : hero.faction === "bugborn"
        ? "/assets/characters/sprites/roster-v1/bugborn-roster-actions-v1.png"
        : "/assets/characters/sprites/roster-v1/ai-roster-actions-v1.png";
  return {
    backgroundImage: `url(${sheet})`,
    backgroundSize: `600% ${rows * 100}%`,
    backgroundPositionX: hero.id === "kimssi" ? "-5px" : "0%",
    backgroundPositionY: `${rows === 1 ? 0 : (row / (rows - 1)) * 100}%`,
  };
};
const heroSurvivalPresentation = (heroId: string) =>
  ["yoo-seungcheon", "hoebun"].includes(heroId)
    ? { name: "도약 회피", description: "커서 방향의 열린 땅으로 뛰어 짧게 공격을 피한다." }
    : ["ahn-seona", "r486"].includes(heroId)
      ? { name: "긴급 회복", description: "자신의 체력을 즉시 회복하고 전선을 재정비한다." }
      : ["kang-ryeokhan", "cheolgak", "g77", "c999"].includes(heroId)
        ? { name: "방어 전개", description: "4.5초 동안 피해를 줄여 버티는 생존 행동이다." }
        : { name: "순간 회피", description: "진행 방향으로 짧게 빠지며 잠시 공격을 피한다." };
type CommandIconKind = "basic" | "survival" | "fill" | "skill1" | "skill2" | "ultimate" | "drill" | ItemId;
const CommandIcon = ({ kind }: { kind: CommandIconKind }) => {
  const item = kind in SUPPLY_ITEMS ? SUPPLY_ITEMS[kind as ItemId] : null;
  return (
    <svg className="command-icon" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`command-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#76e4e3" />
          <stop offset="1" stopColor={kind === "ultimate" ? "#f3b83f" : "#267b82"} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="8" fill="#0d1718" stroke="#49615d" />
      {kind === "basic" && <><path d="m10 34 22-22 7 7-22 22z" fill={`url(#command-${kind})`}/><path d="m31 12 8 8M9 39l8-8" stroke="#f2dc8c" strokeWidth="3"/><path d="M12 12h11M12 12v11" stroke="#76e4e3" strokeWidth="3"/></>}
      {kind === "survival" && <><path d="M24 8 38 14v10c0 9-6 14-14 17C16 38 10 33 10 24V14Z" fill="none" stroke="url(#command-survival)" strokeWidth="3"/><path d="m17 25 6 6 10-14" fill="none" stroke="#e9d88a" strokeWidth="3"/></>}
      {kind === "fill" && <><path d="M9 29h30v10H9zM13 20h10v9H13zM25 12h10v17H25z" fill={`url(#command-${kind})`}/><path d="M8 39h32" stroke="#f0ce69" strokeWidth="3"/></>}
      {kind === "skill1" && <><circle cx="24" cy="24" r="14" fill="none" stroke={`url(#command-${kind})`} strokeWidth="4"/><path d="M24 10v12l9 7" fill="none" stroke="#f1df9a" strokeWidth="4" strokeLinecap="round"/></>}
      {kind === "skill2" && <><path d="M8 31 28 11l9 9-20 20-9 1z" fill={`url(#command-${kind})`}/><path d="m28 11 9 9M12 35l5 5" stroke="#f2dc8c" strokeWidth="3"/></>}
      {kind === "ultimate" && <path d="m24 5 5 11 12-2-7 10 8 9-12-1-6 11-5-11-12 2 7-10-8-9 12 1z" fill="url(#command-ultimate)" stroke="#ffe59a" strokeWidth="2"/>}
      {kind === "drill" && <><path d="m10 34 18-22 10 9-22 18z" fill={`url(#command-${kind})`}/><path d="m29 11 9 9M10 35l5 5" stroke="#f2d782" strokeWidth="3"/><path d="M34 28v12M29 34h10" stroke="#73d8dd" strokeWidth="3"/></>}
      {item && <text x="24" y="31" textAnchor="middle" fill="#e9d88a" fontSize="23" fontWeight="900">{item.icon}</text>}
    </svg>
  );
};
type HeroKitActionSlot = "basic" | "skill1" | "skill2" | "ultimate" | "drill";
type HeroActionIconFamily = "melee" | "ranged" | "area" | "support" | "mobility" | "control" | "drill";
const heroActionIconFamily = (slot: HeroKitActionSlot, mode: string): HeroActionIconFamily => {
  if (["groupHeal", "armorOrder", "repairPulse", "repairBolt", "weldCone", "massRepair"].includes(mode)) return "support";
  if (["dash", "shellRush", "glide", "trackShift", "relocate", "moltRam", "overclock"].includes(mode)) return "mobility";
  if (["electricAura", "blindDust", "nightPatrol", "acidPool", "frenzy", "lockdown", "webLock"].includes(mode)) return "area";
  if (["stunSpray", "shieldSweep", "acidMark", "webTrap", "silkPull", "batonSweep", "rejectLaser"].includes(mode)) return "control";
  if (slot === "drill") return ["radial", "sealRing", "sonicCross", "blueprint"].includes(mode) ? "area" : ["widePush", "shieldLane"].includes(mode) ? "control" : "drill";
  if (["chemicalSpray", "acidSpit", "dustNeedle", "silkNeedle", "stampLaser", "acidShot", "acidCone", "lidDisc", "auditBeam", "slash"].includes(mode)) return "ranged";
  return "melee";
};
const HERO_ACTION_SLOT_LABEL: Record<HeroKitActionSlot, string> = {
  basic: "기본 공격", skill1: "1번 기술", skill2: "2번 기술", ultimate: "3번 고유기", drill: "4번 굴착기",
};
const HeroKitIcon = ({ heroId, slot }: { heroId: string; slot: HeroKitActionSlot }) => {
  const kit = heroKit(heroId), action = kit[slot], family = heroActionIconFamily(slot, action.mode),
    title = `${HERO_ACTION_SLOT_LABEL[slot]} · ${action.caption}`;
  return (
    <svg className={`hero-kit-icon ${family}`} viewBox="0 0 48 48" role="img" aria-label={title}>
      <title>{title}</title>
      <rect x="2" y="2" width="44" height="44" rx="8" fill="#091213" stroke={kit.color} strokeWidth="1.5" />
      <path d="M7 39h34" stroke={kit.accent} strokeWidth="2" opacity=".72" />
      {family === "melee" && <><path d="m11 35 20-23 7 6-21 22z" fill={kit.color}/><path d="m29 12 9 8M10 38l8-8" stroke={kit.accent} strokeWidth="3"/></>}
      {family === "ranged" && <><circle cx="27" cy="22" r="10" fill="none" stroke={kit.color} strokeWidth="3"/><path d="M7 22h28M27 14v16M36 22l6-4v8z" fill={kit.accent} stroke={kit.accent} strokeWidth="2"/></>}
      {family === "area" && <><circle cx="24" cy="23" r="5" fill={kit.accent}/><circle cx="24" cy="23" r="11" fill="none" stroke={kit.color} strokeWidth="3"/><circle cx="24" cy="23" r="17" fill="none" stroke={kit.color} strokeWidth="2" opacity=".55"/></>}
      {family === "support" && <><path d="M19 9h10v10h10v10H29v10H19V29H9V19h10z" fill={kit.color}/><path d="M14 34c6-4 14-4 20 0" fill="none" stroke={kit.accent} strokeWidth="3" strokeLinecap="round"/></>}
      {family === "mobility" && <><path d="m9 13 13 11L9 35V25l8-1-8-2zM24 13l14 11-14 11V25l8-1-8-2z" fill={kit.color}/><path d="M8 40h32" stroke={kit.accent} strokeWidth="3" strokeLinecap="round"/></>}
      {family === "control" && <><path d="M11 11h26v26H11z" fill="none" stroke={kit.color} strokeWidth="3"/><path d="M11 20h26M11 29h26M20 11v26M29 11v26" stroke={kit.accent} strokeWidth="2"/><circle cx="24" cy="24" r="5" fill="#091213" stroke={kit.color} strokeWidth="2"/></>}
      {family === "drill" && <><path d="m9 32 19-20 11 10-20 19z" fill={kit.color}/><path d="m28 12 11 10M10 33l9 8M33 29v11M28 35h11" stroke={kit.accent} strokeWidth="3"/></>}
    </svg>
  );
};
const TalentIcon = ({ kind, accent }: { kind: TalentIconKind; accent: string }) => (
  <svg className="talent-icon" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="28" fill="#081011" stroke={accent} strokeWidth="2" />
    <circle cx="32" cy="32" r="23" fill={`${accent}22`} stroke={`${accent}77`} />
    {kind === "blades" && <><path d="m13 46 26-29 7 3-21 34z" fill={accent}/><path d="m19 15 29 28-5 7-32-25z" fill="#f5e7a8" opacity=".8"/></>}
    {kind === "burst" && <path d="m32 8 6 15 16-5-9 14 12 10-17 1-4 16-8-14-16 7 7-15L7 29l16-4z" fill={accent} stroke="#fff1a8" strokeWidth="2"/>}
    {kind === "shield" && <><path d="M32 9 52 18v15c0 13-8 20-20 24-12-4-20-11-20-24V18z" fill={accent}/><path d="M32 17v31c7-3 12-8 12-16V23z" fill="#fff" opacity=".28"/></>}
    {kind === "heart" && <path d="M32 54 12 35C2 23 18 10 32 22c14-12 30 1 20 13z" fill={accent} stroke="#ffe6df" strokeWidth="2"/>}
    {kind === "boots" && <><path d="M18 13h17v22l17 8-4 10H16l-6-8 9-10z" fill={accent}/><path d="M13 44h36" stroke="#fff0a1" strokeWidth="4"/></>}
    {kind === "field" && <><ellipse cx="32" cy="42" rx="23" ry="10" fill={`${accent}55`} stroke={accent} strokeWidth="3"/><ellipse cx="32" cy="35" rx="15" ry="7" fill="none" stroke="#fff0a1" strokeWidth="2"/><path d="M32 9v19M21 16l7 12M43 16l-7 12" stroke={accent} strokeWidth="4" strokeLinecap="round"/></>}
    {kind === "drill" && <><path d="m8 45 35-31 13 13-34 30z" fill={accent}/><path d="m41 15 14 13M13 42l12 12" stroke="#fff0a1" strokeWidth="4"/><path d="M38 36h17M47 28v18" stroke="#b9fbff" strokeWidth="3"/></>}
    {kind === "ultimate" && <><path d="m32 6 7 17 18-5-10 15 12 13-19 1-8 16-7-16-19 1 12-14L7 19l18 4z" fill={accent}/><circle cx="32" cy="34" r="8" fill="#fff4b2"/></>}
  </svg>
);
export default function Seoul999mBelow() {
  const [screen, setScreen] = useState<
      "intro" | "prologue" | "chapters" | "briefing" | "cinematic" | "play"
    >("intro"),
    [gameMode, setGameMode] = useState<GameMode>("skirmish"),
    [campaignChapter, setCampaignChapter] = useState<CampaignChapter>(1),
    [campaignDifficulty, setCampaignDifficulty] = useState<CampaignDifficulty>("easy"),
    [completedCampaignChapters, setCompletedCampaignChapters] = useState<CampaignChapter[]>([]),
    [seenCampaignCinematics, setSeenCampaignCinematics] = useState<CampaignChapter[]>([]),
    [campaignCinematicMode, setCampaignCinematicMode] = useState<CampaignCinematicMode>("missionStart"),
    [campaignPrologueError, setCampaignPrologueError] = useState<string | null>(null),
    [campaignCinematicError, setCampaignCinematicError] = useState<string | null>(null),
    [outcome, setOutcome] = useState<BattleOutcome | null>(null),
    [defeatSummary, setDefeatSummary] = useState<DefeatSummary | null>(null),
    [selected, setSelected] = useState<Skill>(0),
    [buildChoice, setBuildChoice] = useState<BuildMode>("none"),
    [buildMenuOpen, setBuildMenuOpen] = useState(false),
    [, setSupplyMenuOpen] = useState(false),
    [, setRouteMenuOpen] = useState(false),
    [routeChoice, setRouteChoice] = useState<RouteId | "none">("none"),
    [quickRouteChoice, setQuickRouteChoice] = useState<RouteId | "none">("none"),
    [routeDraftCount, setRouteDraftCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [menuPanel, setMenuPanel] = useState<"main" | "together" | "roster" | "settings" | "help">(
      "main",
    ),
    [nickname, setNickname] = useState("굴착자"),
    [roomCode, setRoomCode] = useState(""),
    [lobbyNotice, setLobbyNotice] = useState(
      "게스트 통신망 · 로그인 없이 참가",
    );
  const [helpTab, setHelpTab] = useState<"quick" | "detail">("quick");
  const [rosterFaction, setRosterFaction] = useState<FactionId>("human"),
    [selectedHeroId, setSelectedHeroId] = useState("yoo-seungcheon"),
    [selectedAllyHeroId, setSelectedAllyHeroId] = useState("kimssi"),
    [skirmishTeamSize, setSkirmishTeamSize] = useState<TeamSize>(1),
    [skirmishDifficulty, setSkirmishDifficulty] = useState<SkirmishDifficulty>("easy"),
    [selectedRuleset, setSelectedRuleset] = useState<BattleRuleset>("secret-tunnel"),
    [selectedMapId, setSelectedMapId] = useState<BattleMapId>("secret-crossroads"),
    [selectedLoadout, setSelectedLoadout] = useState<[ItemId | null, ItemId | null]>([
      "wallBomb",
      "energyDrink",
    ]),
    [activeMatchConfig, setActiveMatchConfig] = useState<MatchConfig | null>(null),
    [onlineRoom, setOnlineRoom] = useState<OnlineRoomView | null>(null),
    [onlineIdentity, setOnlineIdentity] = useState<RoomClientIdentity | null>(null),
    [onlineBusy, setOnlineBusy] = useState(false),
    [battleRunId, setBattleRunId] = useState(0),
    [talentTierOpen, setTalentTierOpen] = useState<TalentTier | null>(null),
    [pendingTalentTiers, setPendingTalentTiers] = useState<TalentTier[]>([]),
    [selectedTalentIds, setSelectedTalentIds] = useState<string[]>([]),
    [battleScale, setBattleScale] = useState<BattleScale>(1),
    [campaignAssetsLoading, setCampaignAssetsLoading] = useState(false),
    [campaignLoadError, setCampaignLoadError] = useState<string | null>(null),
    [minimapCollapsed, setMinimapCollapsed] = useState(false),
    [missionGuideCollapsed, setMissionGuideCollapsed] = useState(false),
    [mobileTacticsOpen, setMobileTacticsOpen] = useState(false),
    [secretPhaseAnnouncement, setSecretPhaseAnnouncement] = useState<{
      key: number;
      title: string;
      subtitle: string;
    } | null>(null);
  const [hud, setHud] = useState({
      ally: 600,
      enemy: 600,
      allyShield: 180,
      enemyShield: 180,
      hp: 180,
      maxHp: 180,
      money: SKIRMISH_STARTING_CREDITS,
      wave: 0,
      allies: 0,
      enemies: 0,
      explored: 1,
      level: 1,
      xp: 0,
      nextXp: 140,
      minionLevel: 1,
      tacticalCd: 0,
      eliteReserved: false,
      eliteActive: false,
      eliteReadyIn: 0,
      cd1: 0,
      cd2: 0,
      cd3: 0,
      cd4: 0,
      fillCd: 0,
      fillMode: false,
      survivalCd: 0,
      item1: null as ItemId | null,
      item2: null as ItemId | null,
      item1Charges: 0,
      item2Charges: 0,
      itemCd: 0,
      missionTime: 0,
      missionStage: 0,
      missionSubjectsAlive: 0,
      missionSubjectsCompleted: 0,
      battlePhase: "open-front" as "open-front" | "prepare" | "assault" | "finished",
      battleTime: 0,
      battleConnected: true,
      routeAllocation: "50:50" as TunnelRouteAllocation,
    }),
    [message, setMessage] = useState("유승천의 파란 드릴로 땅굴을 열어라.");
  useEffect(() => {
    const unlock = () => void gameAudio.unlock();
    const storedScale = window.localStorage.getItem(BATTLE_SCALE_STORAGE_KEY);
    if (storedScale === "1.5") setBattleScale(1.5);
    setCompletedCampaignChapters(parseCampaignChapterList(window.localStorage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY)));
    setSeenCampaignCinematics(parseCampaignChapterList(window.localStorage.getItem(CAMPAIGN_CINEMATIC_STORAGE_KEY)));
    void preloadRuntimeVisuals().catch(() => undefined);
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);
  useEffect(() => {
    if (screen === "prologue" || screen === "cinematic") gameAudio.stopMusic();
    else if (screen !== "play") void gameAudio.startMenu();
  }, [screen]);
  useEffect(() => {
    if (screen === "play" && outcome && outcome !== "draw") void gameAudio.result(outcome);
  }, [outcome, screen]);
  useEffect(() => {
    if (screen !== "play" || gameMode !== "campaign1" || outcome !== "win") return;
    setCompletedCampaignChapters((completed) => {
      const next = completeCampaignChapter(completed, campaignChapter);
      window.localStorage.setItem(CAMPAIGN_PROGRESS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [campaignChapter, gameMode, outcome, screen]);
  const canvasRef = useRef<HTMLCanvasElement>(null),
    commands = useRef<string[]>([]),
    mobileMove = useRef<{ x: number; y: number } | null>(null),
    mobileOnlineMoveTimerRef = useRef<number | null>(null),
    pausedRef = useRef(false),
    onlineMenuOpenRef = useRef(false),
    minimapCollapsedRef = useRef(false),
    pendingTalentTiersRef = useRef<TalentTier[]>([]),
    talentTierOpenRef = useRef<TalentTier | null>(null),
    onlineStartedRef = useRef(false),
    onlineCommandInboxRef = useRef<OnlineBattleCommand[]>([]),
    lastOnlineCommandRef = useRef(0),
    lastOnlineSnapshotRef = useRef(0),
    onlineSnapshotRef = useRef<OnlineBattleSnapshot | null>(null),
    onlineSocketRef = useRef<OnlineRoomSocket | null>(null),
    onlineAiPlayersRef = useRef<Set<string>>(new Set()),
    onlineClientCommandSequenceRef = useRef(0),
    lastOnlineMoveCommandAtRef = useRef(0),
    fullscreenExitGuardUntilRef = useRef(0),
    isCampaign = gameMode === "campaign1",
    isSecretBattleUi = !isCampaign && activeMatchConfig?.ruleset === "secret-tunnel";
  useEffect(() => () => {
    if (mobileOnlineMoveTimerRef.current !== null)
      window.clearInterval(mobileOnlineMoveTimerRef.current);
  }, []);
  useEffect(() => {
    let wasFullscreen = Boolean(document.fullscreenElement);
    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      if (wasFullscreen && !isFullscreen)
        fullscreenExitGuardUntilRef.current = performance.now() + 400;
      wasFullscreen = isFullscreen;
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  useEffect(() => {
    if (screen !== "play") return;
    const compactViewport = window.matchMedia(
      "(pointer: coarse), (max-width: 960px) and (max-height: 600px)",
    ).matches;
    minimapCollapsedRef.current = compactViewport;
    setMinimapCollapsed(compactViewport);
  }, [screen]);
  useEffect(() => {
    if (!outcome) return;
    talentTierOpenRef.current = null;
    setTalentTierOpen(null);
  }, [outcome]);
  const command = (v: string) => {
      if (!pausedRef.current && !onlineMenuOpenRef.current) {
        commands.current.push(v);
        if (v === "skill1") publishOnlineInput({ type: "skill", slot: 1 });
        else if (v === "release2") publishOnlineInput({ type: "skill", slot: 2 });
        else if (v === "release3") publishOnlineInput({ type: "skill", slot: 4 });
        else if (v === "tactical:defense") publishOnlineInput({ type: "tactical", tacticalRole: "defense" });
        else if (v === "tactical:offense") publishOnlineInput({ type: "tactical", tacticalRole: "offense" });
        else if (v === "tactical:recovery") publishOnlineInput({ type: "tactical", tacticalRole: "recovery" });
        else if (v === "tactical:reinforce") publishOnlineInput({ type: "tactical", tacticalRole: "reinforce" });
        else if (v === "research:minion") publishOnlineInput({ type: "research" });
        else if (v === "elite:reserve") publishOnlineInput({ type: "elite" });
        else if (v.startsWith("allocation:")) {
          const allocation = v.slice(11) as TunnelRouteAllocation;
          if (["50:50", "75:25", "25:75"].includes(allocation))
            publishOnlineInput({ type: "allocation", allocation });
        }
      }
    },
    chooseTalent = (id: string) => {
      commands.current.push(`talent:${id}`);
    },
    openTalentTier = (level: TalentTier | null) => {
      talentTierOpenRef.current = level;
      setTalentTierOpen(level);
    },
    queueAimPointer = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect(),
        x = ((clientX - r.left) / r.width) * canvas.width,
        y = ((clientY - r.top) / r.height) * canvas.height;
      commands.current.push(`cursor:${x}:${y}`);
    },
    skillHoldStart =
      (skill: 2 | 3) => (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        command(`aim${skill}`);
        queueAimPointer(e.clientX, e.clientY);
      },
    skillHoldMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        queueAimPointer(e.clientX, e.clientY);
    },
    skillHoldEnd =
      (skill: 2 | 3) => (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        queueAimPointer(e.clientX, e.clientY);
        command(`release${skill}`);
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
    skillHoldCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
      command("cancelAim");
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    };
  const minimapPointer = (
      e: ReactPointerEvent<HTMLButtonElement>,
      phase: "start" | "move",
    ) => {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect(),
        x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      command(`camera:${phase}:${x}:${y}`);
    },
    minimapDragStart = (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      minimapPointer(e, "start");
    },
    minimapDragMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) minimapPointer(e, "move");
    },
    minimapDragEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        minimapPointer(e, "move");
        command("camera:end");
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    minimapDragCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
      command("camera:end");
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    },
    toggleMinimap = () => {
      minimapCollapsedRef.current = !minimapCollapsedRef.current;
      setMinimapCollapsed(minimapCollapsedRef.current);
    };
  const togglePause = () => {
    if (screen !== "play" || outcome) return;
    openTalentTier(null);
    mobileMove.current = null;
    if (mobileOnlineMoveTimerRef.current !== null) {
      window.clearInterval(mobileOnlineMoveTimerRef.current);
      mobileOnlineMoveTimerRef.current = null;
    }
    if (activeMatchConfig?.kind === "online") {
      onlineMenuOpenRef.current = !onlineMenuOpenRef.current;
      setPaused(onlineMenuOpenRef.current);
      setMessage(onlineMenuOpenRef.current ? "온라인 전투 메뉴 · 경기는 계속 진행 중" : "온라인 전투 복귀");
      return;
    }
    onlineMenuOpenRef.current = false;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };
  const restartComputerBattle = () => {
    if (activeMatchConfig?.kind !== "computer") return;
    pausedRef.current = false;
    onlineMenuOpenRef.current = false;
    pendingTalentTiersRef.current = [];
    mobileMove.current = null;
    commands.current = [];
    setPaused(false);
    setOutcome(null);
    setDefeatSummary(null);
    setSelected(0);
    setBuildChoice("none");
    setBuildMenuOpen(false);
    setSupplyMenuOpen(false);
    setRouteMenuOpen(false);
    setRouteChoice("none");
    setQuickRouteChoice("none");
    setRouteDraftCount(0);
    openTalentTier(null);
    setPendingTalentTiers([]);
    setSelectedTalentIds([]);
    setMessage("같은 편성으로 컴퓨터 대전을 다시 시작한다");
    setBattleRunId((run) => run + 1);
  };
  const exitToMenu = () => {
    if (activeMatchConfig?.kind === "online" && onlineRoom && onlineIdentity) {
      if (onlineRoom.status === "playing")
        if (!onlineSocketRef.current?.send("leave"))
          void updateOnlineRoom(onlineRoom.code, onlineIdentity, "leave").catch(() => undefined);
      window.sessionStorage.removeItem(`seoul999m-room-${onlineRoom.code}`);
      onlineStartedRef.current = false;
      setOnlineRoom(null);
      setOnlineIdentity(null);
    }
    pausedRef.current = false;
    onlineMenuOpenRef.current = false;
    pendingTalentTiersRef.current = [];
    mobileMove.current = null;
    commands.current = [];
    setPaused(false);
    setOutcome(null);
    setSelected(0);
    setBuildChoice("none");
    setBuildMenuOpen(false);
    setSupplyMenuOpen(false);
    setRouteMenuOpen(false);
    setRouteChoice("none");
    setQuickRouteChoice("none");
    setRouteDraftCount(0);
    openTalentTier(null);
    setPendingTalentTiers([]);
    setSelectedTalentIds([]);
    setGameMode("skirmish");
    setMenuPanel("main");
    setScreen("intro");
  };
  const activeHeroDef =
    HEROES.find((hero) => hero.id === selectedHeroId) ?? HEROES[0];
  const campaignChapterInfo = {
    1: {
      title: "열린 흙벽 너머",
      subtitle: "첫 접촉 방어전",
      description: "굴착으로 열린 통로에서 밀려든 거대 곤충을 막고 서울 생존 코어를 지켜라.",
      story: [
        "서울의 터널망을 확장하던 유승천과 굴착대는 지도에 없던 공동을 열고, 그 안에서 거대 곤충 무리를 발견한다.",
        "굴착 소음과 불빛에 반응한 개체들이 작업대를 덮친 뒤 열린 통로를 따라 서울 거점으로 밀려들자, 유승천은 그 길목을 막아선다.",
      ],
      asset: "/assets/opening/scenes-v12/scene-08-discovery.png",
      assetAlt: "굴착 중 열린 공동에서 거대 곤충과 마주친 유승천",
    },
    2: {
      title: "표본을 평택으로",
      subtitle: "평택 연구소 호송",
      description: "박사 3명 중 한 명 이상과 DNA 표본을 평택 연구소 입구까지 호송하라.",
      story: [
        "서울을 가까스로 지킨 박사들은 전투 현장에서 거대 곤충의 DNA 표본을 채취하고, 정밀 분석 장비가 있는 평택 연구소로 긴급 이송을 결정한다.",
        "지상 복귀 연구를 이어 가면서 새로운 위협의 방어책까지 찾아야 하기에, 유승천은 박사와 표본을 평택까지 반드시 호송해야 한다.",
      ],
      asset: "/assets/campaign/scientists/scientists-v1.png",
      assetAlt: "거대 곤충의 DNA 표본을 평택 연구소로 옮기는 박사들",
    },
    3: {
      title: "먼저 칠 것인가",
      subtitle: "선제공격 작전권",
      description: "김씨와 함께 안서나·강력한을 제압해 선제공격 작전권을 확보하라.",
      story: [
        "‘다시 공격받은 뒤에는 이미 늦다.’ 유승천과 김씨는 거대 곤충의 거점을 먼저 찾아 무너뜨려야 한다고 주장한다.",
        "서울 방어를 우선해야 한다는 안서나와 강력한이 맞서면서, 갈라진 의견은 작전권을 건 비살상 대련으로 번진다.",
      ],
      asset: "/assets/opening/scenes-v12/scene-05-scrap-rebuilding.png",
      assetAlt: "선제공격 작전권을 두고 대치하는 네 동료",
    },
    4: {
      title: "첫 번째 둥지",
      subtitle: "선제 거점 공략",
      description: "김씨와 진군대를 이끌고 제한 시간 안에 거대 곤충의 중심 거점을 파괴하라.",
      story: [
        "흔적을 추적한 유승천과 김씨는 마침내 거대 곤충의 중심 거점을 찾아내고, 진군대를 이끌어 선제공격을 감행한다.",
        "격렬한 방어선을 돌파해 중심 구조물을 파괴한 원정대는 서울의 위협을 제거했다고 믿지만, 살아남은 무리는 알과 새끼를 품고 다른 서식지로 이동하기 시작한다.",
      ],
      asset: "/assets/opening/scenes-v12/scene-07-tunnel-threats.png",
      assetAlt: "유승천과 김씨가 찾아낸 거대 곤충의 중심 거점",
    },
    5: {
      title: "끊어진 천안선",
      subtitle: "산업 연결로 복구",
      description: "두 전투실을 정리하고 천안 산업도시까지 새 연결 터널을 확보하라.",
      story: [
        "집을 잃은 거대 곤충들이 알과 새끼, 남은 먹이를 품고 대이동하면서 지층이 흔들렸고, 천안으로 이어지던 주 연결 터널이 무너졌다.",
        "굴착기 부품과 터널 보강재를 공급하는 천안 산업도시의 생존을 확인하고 고립을 끝내기 위해, 유승천은 이동 행렬의 뒤편을 지나 새로운 연결로를 뚫는다.",
      ],
      asset: "/assets/opening/scenes-v12/scene-06-secret-tunnels.png",
      assetAlt: "거대 곤충의 대이동으로 무너진 천안 주 연결 터널",
    },
  } as const;
  const selectedCampaignInfo = campaignChapterInfo[campaignChapter];
  const selectedCampaignObjective = CAMPAIGN_OBJECTIVES[campaignChapter];
  const requestLandscapeFullscreen = async () => {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
    } catch {
      // iOS Safari 등 전체화면 API를 허용하지 않는 환경에서는 안내만 유지한다.
    }
    try {
      const orientation = window.screen.orientation as ScreenOrientation & {
        lock?: (orientation: "landscape") => Promise<void>;
      };
      await orientation.lock?.("landscape");
    } catch {
      // 가로 잠금은 Android/PWA 중심 기능이다. 실패해도 수동 회전으로 계속 플레이할 수 있다.
    }
  };
  const missionProgress = campaignObjectiveProgress(campaignChapter, {
    phase: hud.missionStage,
    enemies: hud.enemies,
    subjectsAlive: hud.missionSubjectsAlive,
    subjectsCompleted: hud.missionSubjectsCompleted,
    enemyCoreHp: hud.enemy,
    missionTime: hud.missionTime,
  });
  const activeBuildables = factionBuildables(activeHeroDef.faction),
    activeBuildMap = Object.fromEntries(
      activeBuildables.map((def) => [def.id, def]),
    ) as Record<string, BuildableDefinition>,
    displayedTalent = talentTierOpen
      ? selectedTalentIds
          .map((id) => heroTalentById(activeHeroDef.id, id))
          .find((talent) => talent?.level === talentTierOpen)
      : undefined,
    activeTacticalSupport = (["defense", "offense", "area", "recovery", "reinforce"] as TacticalRole[]).map((role) => tacticalDefinition(activeHeroDef.faction, role)),
    upcomingMinionResearch = nextMinionResearch(hud.minionLevel as MinionLevel);
  const selectBattleRuleset = (ruleset: BattleRuleset) => {
    setSelectedRuleset(ruleset);
    setSelectedMapId(defaultBattleMapForRuleset(ruleset));
  };
  const startSkirmish = async (heroId: string) => {
    const hero = HEROES.find((candidate) => candidate.id === heroId),
      fallbackAlly = HEROES.find((candidate) => candidate.faction === hero?.faction && candidate.id !== heroId),
      allyId = HEROES.some((candidate) => candidate.id === selectedAllyHeroId && candidate.faction === hero?.faction && candidate.id !== heroId)
        ? selectedAllyHeroId
        : fallbackAlly?.id;
    try {
      await preloadRuntimeVisuals();
    } catch {
      setLobbyNotice("전투 원본 이미지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setActiveMatchConfig(createComputerMatch({
      ruleset: selectedRuleset,
      difficulty: skirmishDifficulty,
      teamSize: skirmishTeamSize,
      mapId: selectedMapId,
      playerHeroId: heroId,
      allyHeroId: allyId,
    }));
    setGameMode("skirmish");
    setSelectedHeroId(heroId);
    pausedRef.current = false;
    setPaused(false);
    setOutcome(null);
    setSelected(0);
    setBuildChoice("none");
    setBuildMenuOpen(false);
    setSupplyMenuOpen(false);
    setRouteMenuOpen(false);
    setRouteChoice("none");
    setQuickRouteChoice("none");
    setRouteDraftCount(0);
    setMessage(
      `${HEROES.find((hero) => hero.id === heroId)?.name ?? "대원"} 지하 투입`,
    );
    setScreen("play");
  };
  const roomHero = HEROES.find((hero) => hero.id === selectedHeroId) ?? HEROES[0];
  const createRoom = async () => {
    if (onlineBusy) return;
    setOnlineBusy(true);
    try {
      const result = await createOnlineRoom({
        nickname, heroId: roomHero.id, faction: roomHero.faction,
        ruleset: selectedRuleset, teamSize: skirmishTeamSize, mapId: selectedMapId,
      });
      setOnlineRoom(result.room);
      setOnlineIdentity(result.identity);
      setRoomCode(result.room.code);
      window.sessionStorage.setItem(`seoul999m-room-${result.room.code}`, JSON.stringify({ ...result.identity, nickname }));
      setLobbyNotice(`방 ${result.room.code} 생성 · 참가자를 기다리는 중`);
      onlineStartedRef.current = false;
    } catch (error) {
      setLobbyNotice(error instanceof Error ? error.message : "방 생성 실패");
    } finally { setOnlineBusy(false); }
  };
  const joinRoom = async () => {
    if (onlineBusy || roomCode.length !== 6) {
      if (roomCode.length !== 6) setLobbyNotice("방 코드 6자리를 입력하세요");
      return;
    }
    setOnlineBusy(true);
    try {
      // 방 인증은 탭별 sessionStorage에 둔다. 같은 브라우저의 두 탭이 기본 호출명을
      // 함께 써도 참가 탭이 방장 토큰을 재사용해 B TEAM을 비워 두지 않게 한다.
      const stored = window.sessionStorage.getItem(`seoul999m-room-${roomCode}`);
      let reconnectToken: string | undefined;
      if (stored) try {
        const saved = JSON.parse(stored) as RoomClientIdentity & { nickname?: string };
        reconnectToken = saved.nickname === nickname ? saved.token : undefined;
      } catch { reconnectToken = undefined; }
      const result = await joinOnlineRoom(roomCode, {
        nickname, heroId: roomHero.id, faction: roomHero.faction, token: reconnectToken,
      });
      setOnlineRoom(result.room);
      setOnlineIdentity(result.identity);
      window.sessionStorage.setItem(`seoul999m-room-${result.room.code}`, JSON.stringify({ ...result.identity, nickname }));
      setLobbyNotice(`방 ${result.room.code} 참가 완료`);
      onlineStartedRef.current = false;
    } catch (error) {
      setLobbyNotice(error instanceof Error ? error.message : "방 참가 실패");
    } finally { setOnlineBusy(false); }
  };
  const roomAction = async (action: "ready" | "unready" | "start" | "leave" | "rematch") => {
    if (!onlineRoom || !onlineIdentity || onlineBusy) return;
    const sentBySocket = onlineSocketRef.current?.send(action) ?? false;
    if (sentBySocket) {
      if (action === "rematch") {
        onlineStartedRef.current = false;
        onlineSnapshotRef.current = null;
        lastOnlineSnapshotRef.current = 0;
        setLobbyNotice("재대전 준비 · 전 대원이 다시 준비해야 합니다.");
      }
      if (action === "leave") {
        window.setTimeout(() => onlineSocketRef.current?.close(), 80);
        window.sessionStorage.removeItem(`seoul999m-room-${onlineRoom.code}`);
        setOnlineRoom(null);
        setOnlineIdentity(null);
        setLobbyNotice("방에서 나왔습니다.");
      }
      return;
    }
    setOnlineBusy(true);
    try {
      const result = await updateOnlineRoom(onlineRoom.code, onlineIdentity, action);
      setOnlineRoom((current) => newestOnlineRoomView(current, result.room));
      if (action === "rematch") {
        onlineStartedRef.current = false;
        onlineSnapshotRef.current = null;
        lastOnlineSnapshotRef.current = 0;
        setLobbyNotice("재대전 준비 · 전 대원이 다시 준비해야 합니다.");
      }
      if (action === "leave") {
        window.sessionStorage.removeItem(`seoul999m-room-${onlineRoom.code}`);
        setOnlineRoom(null);
        setOnlineIdentity(null);
        setLobbyNotice("방에서 나왔습니다.");
      }
    } catch (error) {
      setLobbyNotice(error instanceof Error ? error.message : "방 명령 실패");
    } finally { setOnlineBusy(false); }
  };
  const publishOnlineInput = (
    input: Omit<OnlineBattleCommand, "sequence" | "playerId" | "issuedAt" | "clientSequence">,
  ) => {
    if (!onlineRoom || !onlineIdentity || onlineRoom.status !== "playing") return null;
    const clientSequence = ++onlineClientCommandSequenceRef.current,
      command = { ...input, clientSequence };
    if (onlineSocketRef.current?.send("command", { command })) return clientSequence;
    void sendOnlineBattleCommand(onlineRoom.code, onlineIdentity, command).catch((error) =>
      setLobbyNotice(error instanceof Error ? error.message : "전투 명령 전송 실패"),
    );
    return clientSequence;
  };
  useEffect(() => {
    if (!onlineRoom || !onlineIdentity) return;
    const receiveOnlineCommand = (command: OnlineBattleCommand, commandSequence: number) => {
        if (
          command.sequence > lastOnlineCommandRef.current &&
          command.playerId !== onlineIdentity.playerId
        ) onlineCommandInboxRef.current.push(command);
        lastOnlineCommandRef.current = Math.max(lastOnlineCommandRef.current, commandSequence);
      },
      receiveOnlineSnapshot = (snapshot: OnlineBattleSnapshot, commandSequence: number) => {
        lastOnlineCommandRef.current = Math.max(lastOnlineCommandRef.current, commandSequence);
        if (snapshot.sequence <= lastOnlineSnapshotRef.current) return;
        onlineSnapshotRef.current = snapshot;
        lastOnlineSnapshotRef.current = snapshot.sequence;
        onlineClientCommandSequenceRef.current = Math.max(
          onlineClientCommandSequenceRef.current,
          snapshot.lastAppliedClientSequences?.[onlineIdentity.playerId] ?? 0,
        );
      };
    const socket = connectOnlineRoomSocket({
      code: onlineRoom.code,
      identity: onlineIdentity,
      onRoom: (incoming) => {
        const unseen = incoming.commands.filter(
          (command) =>
            command.sequence > lastOnlineCommandRef.current &&
            command.playerId !== onlineIdentity.playerId,
        );
        if (unseen.length) onlineCommandInboxRef.current.push(...unseen);
        lastOnlineCommandRef.current = Math.max(
          lastOnlineCommandRef.current,
          incoming.commandSequence,
        );
        onlineAiPlayersRef.current = new Set(
          incoming.players.filter((player) => player.aiControlled).map((player) => player.id),
        );
        if (incoming.snapshot)
          receiveOnlineSnapshot(incoming.snapshot, incoming.commandSequence);
        setOnlineRoom((current) => {
          const next = newestOnlineRoomView(current, incoming);
          if (!current || current.status !== "playing" || next.status !== "playing") return next;
          const playerPresentationChanged = current.players.length !== next.players.length ||
            current.players.some((player, index) => {
              const candidate = next.players[index];
              return !candidate ||
                player.id !== candidate.id ||
                player.ready !== candidate.ready ||
                player.connected !== candidate.connected ||
                player.aiControlled !== candidate.aiControlled ||
                player.heroId !== candidate.heroId;
            });
          return playerPresentationChanged ? next : current;
        });
      },
      onCommand: receiveOnlineCommand,
      onSnapshot: receiveOnlineSnapshot,
      onStatus: (status) => setLobbyNotice(status === "connected" ? `방 ${onlineRoom.code} 실시간 연결` : "통신 재연결 중…"),
      onError: setLobbyNotice,
    });
    onlineSocketRef.current = socket;
    return () => {
      socket.close();
      if (onlineSocketRef.current === socket) onlineSocketRef.current = null;
    };
  }, [onlineRoom?.code, onlineIdentity?.playerId, onlineIdentity?.token]);
  useEffect(() => {
    if (!onlineRoom || !onlineIdentity || onlineRoom.status !== "playing" || onlineStartedRef.current) return;
    const local = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId);
    if (!local) return;
    let cancelled = false, launched = false;
    onlineStartedRef.current = true;
    void preloadRuntimeVisuals().then(() => {
      if (cancelled) return;
      const config = createOnlineMatch({
        ruleset: onlineRoomRuleset(onlineRoom), teamSize: onlineRoom.teamSize, mapId: onlineRoom.mapId, seed: onlineRoom.seed,
        localPlayerId: local.id, players: onlineRoom.players,
      });
      const capturedSnapshot = onlineRoom.snapshot,
        currentSnapshot = onlineSnapshotRef.current,
        latestSnapshot = !capturedSnapshot || (
          currentSnapshot && currentSnapshot.sequence > capturedSnapshot.sequence
        )
          ? currentSnapshot
          : capturedSnapshot,
        recoveredThrough = latestSnapshot?.lastAppliedCommandSequence ?? 0,
        replayable = local.id === onlineRoom.hostId
          ? onlineRoom.commands.filter((candidate) =>
              candidate.playerId !== local.id && candidate.sequence > recoveredThrough,
            )
          : [],
        mergedCommands = new Map<number, OnlineBattleCommand>();
      for (const candidate of [...onlineCommandInboxRef.current, ...replayable])
        if (candidate.sequence > recoveredThrough && candidate.playerId !== local.id)
          mergedCommands.set(candidate.sequence, candidate);
      onlineCommandInboxRef.current = [...mergedCommands.values()].sort(
        (left, right) => left.sequence - right.sequence,
      );
      lastOnlineCommandRef.current = Math.max(
        lastOnlineCommandRef.current,
        onlineRoom.commandSequence,
      );
      onlineSnapshotRef.current = latestSnapshot ?? null;
      lastOnlineSnapshotRef.current = Math.max(
        lastOnlineSnapshotRef.current,
        latestSnapshot?.sequence ?? 0,
      );
      setActiveMatchConfig(config);
      setSelectedHeroId(local.heroId);
      setGameMode("skirmish");
      pausedRef.current = false;
      onlineMenuOpenRef.current = false;
      setPaused(false);
      setOutcome(null);
      setMessage(
        `온라인 방 ${onlineRoom.code} · ${local.nickname} 투입 · 공용 전장 #${onlineRoom.seed
          .toString(16)
          .toUpperCase()}`,
      );
      launched = true;
      setScreen("play");
    }).catch(() => {
      onlineStartedRef.current = false;
      setLobbyNotice("상대 영웅 원본 이미지를 불러오지 못했습니다. 전투 시작을 다시 시도해 주세요.");
    });
    return () => {
      cancelled = true;
      if (!launched) onlineStartedRef.current = false;
    };
  }, [onlineRoom?.status, onlineIdentity?.playerId]);
  useEffect(() => {
    if (!outcome || !onlineRoom || !onlineIdentity || onlineRoom.status !== "playing" || onlineRoom.hostId !== onlineIdentity.playerId) return;
    const local = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId);
    if (!local) return;
    const winner = outcome === "draw" ? "draw" : outcome === "win" ? local.team : local.team === "blue" ? "red" : "blue";
    if (onlineSocketRef.current?.send("finish", { winner })) return;
    void updateOnlineRoom(onlineRoom.code, onlineIdentity, "finish", { winner }).then((result) => setOnlineRoom(result.room)).catch((error) =>
      setLobbyNotice(error instanceof Error ? error.message : "전투 결과 확정 실패"),
    );
  }, [outcome, onlineRoom?.status, onlineIdentity?.playerId]);
  useEffect(() => {
    if (outcome || screen !== "play" || onlineRoom?.status !== "finished" || !onlineRoom.winner || !onlineIdentity) return;
    const local = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId);
    if (local) {
      const localOutcome = onlineRoom.winner === "draw"
        ? "draw"
        : local.team === onlineRoom.winner
          ? "win"
          : "lose";
      onlineMenuOpenRef.current = false;
      setPaused(false);
      setOutcome(localOutcome);
      if (onlineRoom.finishReason === "player-left")
        setMessage(local.id === onlineRoom.departedPlayerId ? "방 이탈 · 온라인 경기 종료" : "상대 이탈 · 온라인 경기 승리");
      else if (onlineRoomRuleset(onlineRoom) === "secret-tunnel")
        setMessage(
          localOutcome === "draw"
            ? "비밀 굴착전 최종 판정 · 무승부"
            : localOutcome === "win"
              ? "비밀 굴착전 최종 판정 · 아군 승리"
              : "비밀 굴착전 최종 판정 · 아군 패배",
        );
    }
  }, [onlineRoom?.status, onlineRoom?.winner, onlineIdentity?.playerId, outcome, screen]);
  const returnToOnlineRoom = () => {
    pausedRef.current = false;
    onlineMenuOpenRef.current = false;
    onlineStartedRef.current = false;
    setPaused(false);
    setOutcome(null);
    setActiveMatchConfig(null);
    setMenuPanel("together");
    setScreen("intro");
  };
  const launchCampaignMission = async () => {
    if (campaignAssetsLoading) return;
    setCampaignAssetsLoading(true);
    setCampaignLoadError(null);
    void gameAudio.unlock();
    void gameAudio.prepareHeroVoice("yoo-seungcheon").catch(() => undefined);
    try {
      await Promise.race([
        preloadRuntimeVisuals(),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("campaign visual timeout")), 5000),
        ),
      ]);
    } catch {
      setCampaignLoadError("전투 원본 이미지를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      setCampaignAssetsLoading(false);
      setScreen("briefing");
      return;
    }
    setGameMode("campaign1");
    setActiveMatchConfig(null);
    setSelectedHeroId("yoo-seungcheon");
    pausedRef.current = false;
    setPaused(false);
    setOutcome(null);
    setSelected(0);
    setBuildChoice("none");
    setBuildMenuOpen(false);
    setSupplyMenuOpen(false);
    setRouteMenuOpen(false);
    setRouteChoice("none");
    setQuickRouteChoice("none");
    setRouteDraftCount(0);
    setDefeatSummary(null);
    setMissionGuideCollapsed(false);
    setMessage(`제${campaignChapter}장 작전 개시`);
    setCampaignAssetsLoading(false);
    setBattleRunId((run) => run + 1);
    setScreen("play");
  };
  const showCampaignCinematic = (mode: CampaignCinematicMode) => {
      if (campaignAssetsLoading) return;
      setCampaignCinematicMode(mode);
      setCampaignCinematicError(null);
      setCampaignLoadError(null);
      setScreen("cinematic");
    },
    rememberCampaignCinematic = () => {
      setSeenCampaignCinematics((seen) => {
        const next = completeCampaignChapter(seen, campaignChapter);
        window.localStorage.setItem(CAMPAIGN_CINEMATIC_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    finishCampaignCinematic = () => {
      if (campaignAssetsLoading) return;
      rememberCampaignCinematic();
      if (campaignCinematicMode === "replay") {
        setScreen("briefing");
        return;
      }
      void launchCampaignMission();
    },
    startCampaignMission = () => {
      if (campaignAssetsLoading) return;
      if (seenCampaignCinematics.includes(campaignChapter)) void launchCampaignMission();
      else showCampaignCinematic("missionStart");
    };
  useEffect(() => {
    if (screen !== "play" || !canvasRef.current) return;
    const S = BASE_TILE_SIZE * battleScale,
      W = COLS * S,
      H = ROWS * S,
      canvas = canvasRef.current,
      ctx = canvas.getContext("2d")!;
    const initialCanvasRect = canvas.getBoundingClientRect();
    let viewWidth = Math.max(320, Math.round(initialCanvasRect.width || VW)),
      viewHeight = Math.max(240, Math.round(initialCanvasRect.height || VH)),
      minimap = { x: viewWidth - 180, y: viewHeight - 124, w: 168, h: 108 };
    canvas.width = viewWidth;
    canvas.height = viewHeight;
    ctx.imageSmoothingEnabled = false;
    const fog = document.createElement("canvas"),
      fctx = fog.getContext("2d")!;
    fog.width = viewWidth;
    fog.height = viewHeight;
    const heroLayer = document.createElement("canvas"),
      heroCtx = heroLayer.getContext("2d")!;
    heroLayer.width = 80;
    heroLayer.height = 80;
    heroCtx.imageSmoothingEnabled = true;
    heroCtx.imageSmoothingQuality = "high";
    const rosterFrameLayer = document.createElement("canvas"),
      rosterFrameCtx = rosterFrameLayer.getContext("2d")!,
      minionFrameLayer = document.createElement("canvas"),
      minionFrameCtx = minionFrameLayer.getContext("2d")!;
    // 스킬 원화의 외곽 효과가 프레임 경계에서 잘리지 않도록 투명 여백을 확보한다.
    rosterFrameLayer.width = 160;
    rosterFrameLayer.height = 160;
    rosterFrameCtx.imageSmoothingEnabled = false;
    minionFrameLayer.width = 128;
    minionFrameLayer.height = 128;
    minionFrameCtx.imageSmoothingEnabled = false;
    const playerDef = activeHeroDef,
      atlasFiles: Record<string, string> = {
        locomotion:
          "/assets/characters/sprites/yoo-seungcheon/yoo-locomotion-v1-alpha.png",
        states:
          "/assets/characters/sprites/yoo-seungcheon/yoo-hurt-down-v1-alpha.png",
      },
      atlases = {} as Record<string, HTMLImageElement>;
    for (const [name, src] of Object.entries(atlasFiles)) {
      atlases[name] = runtimeImage(src);
    }
    const heroRosterSheets = {} as Partial<Record<FactionId, HTMLImageElement>>;
    for (const [faction, src] of Object.entries({
      human: "/assets/characters/sprites/roster-v1/human-roster-actions-v1.png",
      bugborn:
        "/assets/characters/sprites/roster-v1/bugborn-roster-actions-v1.png",
      ai: "/assets/characters/sprites/roster-v1/ai-roster-actions-v1.png",
    }) as Array<[FactionId, string]>) {
      heroRosterSheets[faction] = runtimeImage(src);
    }
    const heroVerticalSheets = {} as Partial<
      Record<FactionId, HTMLImageElement>
    >;
    for (const [faction, src] of Object.entries({
      human:
        "/assets/characters/sprites/roster-v2/human-roster-vertical-v2.png",
      bugborn:
        "/assets/characters/sprites/roster-v2/bugborn-roster-vertical-v2.png",
      ai: "/assets/characters/sprites/roster-v2/ai-roster-vertical-v2.png",
    }) as Array<[FactionId, string]>) {
      heroVerticalSheets[faction] = runtimeImage(src);
    }
    const heroVerticalCombatSheets = {} as Partial<Record<FactionId, HTMLImageElement>>;
    const verticalCombatSources: Record<FactionId, string> = {
      human: "/assets/characters/sprites/roster-v4/human-roster-vertical-combat-v4.png",
      bugborn: "/assets/characters/sprites/roster-v4/bugborn-roster-vertical-combat-v4.png",
      ai: "/assets/characters/sprites/roster-v4/ai-roster-vertical-combat-v4.png",
    };
    for (const faction of Object.keys(verticalCombatSources) as FactionId[]) {
      heroVerticalCombatSheets[faction] = runtimeImage(verticalCombatSources[faction]);
    }
    const heroSkillSheets = {} as Partial<Record<FactionId, HTMLImageElement>>;
    for (const [faction, src] of Object.entries({
      human:
        "/assets/characters/sprites/roster-v3/human-roster-skill-poses-v3.png",
      bugborn:
        "/assets/characters/sprites/roster-v3/bugborn-roster-skill-poses-v3.png",
      ai: "/assets/characters/sprites/roster-v3/ai-roster-skill-poses-v3.png",
    }) as Array<[FactionId, string]>) {
      heroSkillSheets[faction] = runtimeImage(src);
    }
    const c999Sheet = runtimeImage(
      "/assets/characters/sprites/roster-v1/ai-c999-director-actions-v2.png",
    );
    const scientistImages = ["han", "yoon", "min"].map((id) =>
      runtimeImage(`/assets/campaign/scientists/scientist-${id}-v2.png`),
    );
    const baseImages = {} as Record<FactionId, HTMLImageElement>;
    for (const [faction, def] of Object.entries(FACTION_BASES) as Array<
      [FactionId, (typeof FACTION_BASES)[FactionId]]
    >) {
      baseImages[faction] = runtimeImage(def.asset);
    }
    const buildImages = {} as Record<BuildKind, HTMLImageElement>;
    for (const def of BUILDABLES) {
      if (!def.asset) continue;
      buildImages[def.id] = runtimeImage(def.asset);
    }
    const eliteImages = {} as Record<FactionId, HTMLImageElement>;
    for (const [faction, src] of Object.entries({
      human: "/assets/minions/human/elite/human-waste-heavy-v1-alpha.png",
      bugborn: "/assets/minions/bugborn/elite/bugborn-hive-devourer-v1-alpha.png",
      ai: "/assets/minions/ai/elite/ai-demolition-enforcer-808-v1-alpha.png",
    }) as Array<[FactionId, string]>) eliteImages[faction] = runtimeImage(src);
    const minionSheets = {} as Partial<Record<FactionId, HTMLCanvasElement>>,
      prepareMinionSheet = (faction: FactionId, src: string) => {
        const img = runtimeImage(src),
          prepare = () => {
          const sheet = document.createElement("canvas"),
            sheetCtx = sheet.getContext("2d")!;
          sheet.width = img.naturalWidth;
          sheet.height = img.naturalHeight;
          sheetCtx.drawImage(img, 0, 0);
          minionSheets[faction] = sheet;
          };
        if (img.complete && img.naturalWidth > 0) prepare();
        else img.addEventListener("load", prepare, { once: true });
      };
    prepareMinionSheet(
      "human",
      "/assets/minions/human/human-minion-actions-v1.png",
    );
    prepareMinionSheet(
      "bugborn",
      "/assets/minions/bugborn/bugborn-minion-actions-v1.png",
    );
    prepareMinionSheet("ai", "/assets/minions/ai/ai-minion-actions-v1.png");
    const campaignBalance = CAMPAIGN_DIFFICULTIES[campaignDifficulty];
    let raf = 0,
      last = performance.now(),
      lastHud = 0,
      onlineSnapshotClock = 0,
      appliedOnlineSnapshot = 0,
      appliedOnlineCommandSequence =
        activeMatchConfig?.kind === "online" &&
        onlineRoom?.hostId === onlineIdentity?.playerId
          ? onlineRoom.snapshot?.lastAppliedCommandSequence ?? 0
          : 0,
      appliedOnlineClientSequences: Record<string, number> =
        activeMatchConfig?.kind === "online" &&
        onlineRoom?.hostId === onlineIdentity?.playerId
          ? { ...onlineRoom.snapshot?.lastAppliedClientSequences }
          : {},
      hostRestoreSnapshotSequence =
        activeMatchConfig?.kind === "online" &&
        onlineRoom?.hostId === onlineIdentity?.playerId
          ? onlineRoom.snapshot?.sequence ?? 0
          : 0,
      lastMarchReservationFrame = -1,
      unitId = 1,
      buildId = 1,
      allyHp = 600,
      enemyHp = 600,
      allyShield = 180,
      enemyShield = 180,
      money = SKIRMISH_STARTING_CREDITS,
      wave = 0,
      spawnClock =
        activeMatchConfig?.kind === "online" && onlineRoom?.countdownAt
          ? Math.max(0, 1600 - Math.max(0, Date.now() - onlineRoom.countdownAt))
          : 1600,
      enemyBuildCredits = SKIRMISH_STARTING_CREDITS,
      enemyBuildClock = 5200,
      steamDamageClock = 0,
      heroXp = isCampaign ? HERO_LEVELS[campaignBalance.heroLevel - 1].xp : 0,
      heroLevel: number = isCampaign ? campaignBalance.heroLevel : 1,
      minionLevels = teamMinionLevels((isCampaign ? campaignBalance.minionLevel : 1) as MinionLevel, 1),
      eliteDeployments = {
        blue: createEliteDeploymentState(),
        red: createEliteDeploymentState(),
      } as Record<Team, ReturnType<typeof createEliteDeploymentState>>,
      drillArmorUntil = 0,
      hasteUntil = 0,
      evadeUntil = 0,
      ended = false,
      cam = { x: 0, y: 0 },
      cameraFree = false,
      minimapGrabAnchor: RatioPoint | null = null,
      cameraDrag: {
        pointerId: number;
        x: number;
        y: number;
        camX: number;
        camY: number;
        moved: boolean;
      } | null = null,
      cd1 = 0,
      cd2 = 0,
      cd3 = 0,
      cd4 = 0,
      fillCd = 0,
      fillMode = false,
      survivalCd = 0,
      coreRegenFxClock = 0,
      heroCoreRegenActive = false,
      jumpVisual: JumpVisual | null = null,
      itemSlots: [ItemId | null, ItemId | null] = isCampaign
        ? ["medKit", "medKit"]
        : [...selectedLoadout],
      itemCharges: [number, number] = isCampaign
        ? [1, 1]
        : itemSlots.map((item) => (item ? SKIRMISH_ITEM_CHARGES : 0)) as [number, number],
      itemCooldownUntil = 0,
      combatAudio = gameAudio,
      aimingSkill: Skill = 0,
      buildMode: BuildMode = "none",
      tacticalAim: TacticalRole | null = null,
      routeEdit: RouteId | null = null,
      routeQuickAim: RouteId | null = null,
      routeDraftPoints: GridPoint[] = [],
      routeDraftCells: GridPoint[] = [],
      routePointerGesture: {
        pointerId: number;
        routeId: RouteId;
        mode: "quick" | "detail";
        x: number;
        y: number;
        camX: number;
        camY: number;
        tile: GridPoint;
        moved: boolean;
      } | null = null,
      pointerHeld = false,
      cursorScreen = { x: viewWidth / 2, y: viewHeight / 2 },
        moveTarget: { x: number; y: number; wx: number; wy: number } | null =
        null,
      attackTarget: {
        kind: "unit" | "turret" | "base";
        id?: number;
        x: number;
        y: number;
      } | null = null;
    let deterministicSeed = (activeMatchConfig?.seed ?? (campaignChapter * 0x9e3779b9)) >>> 0;
    const random = () => {
        deterministicSeed = (deterministicSeed + 0x6d2b79f5) | 0;
        let mixed = Math.imul(deterministicSeed ^ (deterministicSeed >>> 15), 1 | deterministicSeed);
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
      },
      selectedBattleMap = battleMap(activeMatchConfig?.mapId ?? selectedMapId),
      computerBalance = skirmishDifficultyBalance(
        activeMatchConfig?.kind === "computer" ? activeMatchConfig.difficulty : "hard",
      ),
      resolvedBattleSpawns = resolveLocalBattleSpawns(
        selectedBattleMap,
        activeMatchConfig?.seed ?? deterministicSeed,
        activeMatchConfig?.canonicalLocalTeam ?? "blue",
      ),
      kit = heroKit(playerDef.id),
      enemyChoices = (Object.keys(FACTIONS) as FactionId[]).filter(
        (id) => id !== playerDef.faction,
      ),
      enemyFaction: FactionId = isCampaign
        ? "bugborn"
        : activeMatchConfig?.teams[1].faction ?? enemyChoices[Math.floor(random() * enemyChoices.length)],
      talents = new Set<string>(),
      keys = new Set<string>(),
      shots: Shot[] = [],
      slashes: SlashFx[] = [],
      fields: FieldFx[] = [],
      meleeHits: PendingMelee[] = [],
      pendingBattleHeroImpacts: Array<{
        attacker: Unit;
        targetId: number;
        slot: 1 | 2 | 4;
        action: ReturnType<typeof heroAction>;
        actionName: string;
        radius: number;
        delay: number;
      }> = [],
      groundMines: GroundMine[] = [],
      tacticalAreas: TacticalAreaEvent[] = [],
      tacticalStates: Record<Team, TacticalTeamState> = {
        blue: { cooldownUntil: 0, defenseUntil: 0, offenseUntil: 0, recoveryUntil: 0, recoveryNextAt: 0 },
        red: { cooldownUntil: 0, defenseUntil: 0, offenseUntil: 0, recoveryUntil: 0, recoveryNextAt: 0 },
      },
      dust: Array<{ x: number; y: number; life: number; color: string }> = [],
      damagePopups: Array<{
        x: number;
        y: number;
        text: string;
        life: number;
        maxLife: number;
        critical: boolean;
        color: string;
        team: Team;
      }> = [],
      heroDamageHistory: DamageRecord[] = [],
       spawnQueue: Array<{
         team: Team;
         role: MinionRole;
         index: number;
         delay: number;
         campaignThreat?: "runner" | "vanguard" | "boss";
         campaignPower?: 1 | 2;
         campaignName?: string;
         campaignWaveId?: 1 | 2;
         campaignEscort?: boolean;
         campaignFollower?: boolean;
         campaignZone?: 1 | 2 | 3;
         emergencyReinforcement?: boolean;
        }> = [],
       marchRoutes: Record<RouteId, MarchRoute> = {
        A: { id: "A", color: "#58e5ef", points: [], plannedCells: [], pathMode: "direct", overlapRatio: 0, revision: 0 },
        B: { id: "B", color: "#ff78c8", points: [], plannedCells: [], pathMode: "direct", overlapRatio: 0, revision: 0 },
       },
       enemyMarchRoutes: Record<RouteId, MarchRoute> = {
        A: { id: "A", color: "#e96558", points: [], plannedCells: [], pathMode: "direct", overlapRatio: 0, revision: 0 },
        B: { id: "B", color: "#c58558", points: [], plannedCells: [], pathMode: "direct", overlapRatio: 0, revision: 0 },
       },
       teamMarchRoutes: Record<Team, Record<RouteId, MarchRoute>> = {
        blue: marchRoutes,
        red: enemyMarchRoutes,
       },
       enemyCoreIntel: Record<Team, boolean> = { blue: false, red: false },
       skirmishStartedAt = performance.now(),
       searchedBattleSectors: Record<Team, Set<string>> = {
        blue: new Set<string>(),
        red: new Set<string>(),
       },
        marchReservations = new Set<string>(),
        combatSlotReservations = new Set<string>();
    const talentBonuses = () => combineHeroTalentEffects(playerDef.id, talents),
      rotateDirection = (dir: { x: number; y: number }, radians: number) => ({
        x: dir.x * Math.cos(radians) - dir.y * Math.sin(radians),
        y: dir.x * Math.sin(radians) + dir.y * Math.cos(radians),
      });
    let defeatTimer: number | null = null,
      phaseAnnouncementTimer: number | null = null;
    let campaignPhase = campaignChapter === 4 ? 3 : 0,
      campaign5GatePhase = campaignChapter === 5 ? 1 : 0,
      campaignWaveQueued = false,
      campaignWaveBreak = -1,
      campaignIntroClock = 0,
      campaignSpeech = "",
      campaign1VentOpen = false,
      campaignTimeLeft = campaignChapter === 4 ? 300000 : campaignChapter === 5 ? 210000 : 0;
    const drawShotFx = () => {
      for (const s of shots) {
        const tx = Math.floor(s.x / S),
          ty = Math.floor(s.y / S);
        if (
          s.team !== "blue" &&
          (
            battlePhase === "prepare" ||
            !visible(tx, ty) ||
            (isSecretTunnel && !openForTeam(tx, ty, "blue"))
          )
        ) continue;
        const x = s.x - cam.x,
          y = s.y - cam.y,
          angle = Math.atan2(s.vy, s.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        if (s.kind === "rock") {
          ctx.fillStyle = "#c5b081";
          ctx.strokeStyle = "#3d3427";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (s.kind === "can" || s.kind === "missile") {
          ctx.fillStyle = s.kind === "missile" ? "#d84c39" : "#d7c2a0";
          ctx.fillRect(-9, -4, 14, 8);
          ctx.fillStyle = s.team === "blue" ? "#4fc5d3" : "#dc5b48";
          ctx.fillRect(-5, -3, 7, 6);
          ctx.fillStyle = "#ef9c45";
          ctx.fillRect(-13, -2, 5, 4);
        } else if (s.kind === "root") {
          ctx.strokeStyle = "#8fb84d";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(-15, 0);
          ctx.quadraticCurveTo(-3, -8, 10, 0);
          ctx.stroke();
        } else if (s.kind === "shock") {
          ctx.globalCompositeOperation = "screen";
          ctx.strokeStyle = "#7df5ff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-12, 3);
          ctx.lineTo(-5, -4);
          ctx.lineTo(1, 3);
          ctx.lineTo(8, -3);
          ctx.stroke();
        } else if (s.kind === "spore") {
          ctx.fillStyle = "#b8ed36";
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#efff8c";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (s.kind === "tether") {
          ctx.globalCompositeOperation = "screen";
          ctx.strokeStyle = "#6de9ff";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-18, 0);
          ctx.lineTo(8, 0);
          ctx.stroke();
          ctx.strokeStyle = "#ff9a45";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (s.kind === "venom" || s.kind === "acid") {
          ctx.fillStyle = s.kind === "acid" ? "#c9fa3f" : "#9ed84a";
          ctx.beginPath();
          ctx.arc(0, 0, s.kind === "acid" ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.kind === "laser") {
          ctx.globalCompositeOperation = "screen";
          ctx.strokeStyle = "#ff6a3f";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(-24, 0);
          ctx.lineTo(8, 0);
          ctx.stroke();
          ctx.strokeStyle = "#fff2b0";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (s.kind === "spray") {
          ctx.fillStyle = "#8df0d7";
          for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = 0.9 - i * 0.25;
            ctx.beginPath();
            ctx.arc(-i * 7, (i - 1) * 3, 4 - i, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (s.kind === "ampoule") {
          ctx.fillStyle = "#b9f6dd";
          ctx.strokeStyle = "#f5fff8";
          ctx.lineWidth = 2;
          ctx.fillRect(-7, -5, 12, 10);
          ctx.strokeRect(-7, -5, 12, 10);
          ctx.fillStyle = "#ef6e9f";
          ctx.fillRect(5, -2, 4, 4);
        } else if (s.kind === "receipt") {
          ctx.fillStyle = "#f2ead3";
          ctx.strokeStyle = "#47cbd4";
          ctx.lineWidth = 1;
          ctx.fillRect(-10, -5, 18, 10);
          ctx.strokeRect(-10, -5, 18, 10);
          ctx.fillStyle = "#273638";
          for (let i = -6; i <= 3; i += 3) ctx.fillRect(i, -2, 2, 1);
        } else if (s.kind === "disc") {
          ctx.strokeStyle = "#9bb7c1";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "#e7c96b";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (s.kind === "web") {
          ctx.strokeStyle = "#e8e3cd";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-7, -7);
          ctx.lineTo(7, 7);
          ctx.moveTo(-7, 7);
          ctx.lineTo(7, -7);
          ctx.stroke();
        }
        ctx.restore();
      }
    };
    const drawBuildGuide = () => {
      if (buildMode === "none" && !fillMode) return;
      if (fillMode) {
        const tile = cursorTile(),
          error = fillPlacementError(tile.x, tile.y),
          x = tile.x * S - cam.x,
          y = tile.y * S - cam.y;
        ctx.save();
        ctx.fillStyle = error ? "#e15b4b55" : "#56d4c755";
        ctx.strokeStyle = error ? "#ff6b58" : "#74eee0";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
        ctx.strokeRect(x + 2, y + 2, S - 4, S - 4);
        ctx.setLineDash([]);
        ctx.fillStyle = "#071012dd";
        ctx.fillRect(x - 18, y - 18, 76, 15);
        ctx.fillStyle = error ? "#ff8a78" : "#bdf9ef";
        ctx.font = "bold 7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(error ? "설치 불가" : "클릭해 메우기", x + 20, y - 8);
        ctx.restore();
        return;
      }
      const coreX = ALLY.x * S + S / 2 - cam.x,
        coreY = ALLY.y * S + S / 2 - cam.y,
        tile = cursorTile(),
        target = turretAt(tile.x, tile.y),
        management = buildMode === "demolish" || buildMode === "upgrade",
        valid = management
          ? !!target &&
            target.team === "blue" &&
            (buildMode === "upgrade"
              ? target.level < 2 && !target.upgrade
              : !target.starter)
          : !placementError(buildMode as BuildKind, tile.x, tile.y),
        x = tile.x * S - cam.x,
        y = tile.y * S - cam.y;
      ctx.save();
      ctx.setLineDash([9, 7]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#e14f43cc";
      ctx.beginPath();
      ctx.arc(coreX, coreY, 6 * S, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#8f342c99";
      ctx.beginPath();
      ctx.arc(coreX, coreY, 2 * S, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = valid ? "#56d4c744" : "#e15b4b55";
      ctx.strokeStyle = valid ? "#74eee0" : "#ff6b58";
      ctx.lineWidth = 3;
      ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
      ctx.strokeRect(x + 2, y + 2, S - 4, S - 4);
      if (!management) {
        const kind = buildMode as BuildKind,
          def = BUILD_BY_ID[kind],
          img = buildImages[kind],
          cx = x + S / 2,
          cy = y + S / 2;
        if (def?.range) {
          ctx.strokeStyle = valid ? "#f0c75c88" : "#dc5b4866";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, def.range * S, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (def && img?.complete && img.naturalWidth) {
          const size =
              def.category === "blocker"
                ? 48
                : def.faction === "bugborn"
                  ? 54
                  : 50,
            dw = def.category === "blocker" ? 60 : size;
          ctx.globalAlpha = valid ? 0.68 : 0.35;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, cx - dw / 2, cy - size + 18, dw, size);
        }
        if (def) {
          const cost = placementCost(kind, tile.x, tile.y);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#071012e8";
          ctx.fillRect(cx - 31, y - 19, 62, 16);
          ctx.fillStyle = valid ? "#ffe28a" : "#ff8a78";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${cost}₡${cost > def.cost ? " 밀집" : ""}`, cx, y - 8);
        }
      }
      ctx.restore();
    };
    const CAMPAIGN1_VENT = { x: 21, y: 18 },
      ALLY = isCampaign
        ? { x: 7, y: 18 }
        : { ...resolvedBattleSpawns.ally },
      ENEMY = isCampaign
        ? campaignChapter === 4
          ? ([{ x: 43, y: 8 }, { x: 44, y: 28 }, { x: 29, y: 7 }, { x: 30, y: 29 }][
              (activeMatchConfig?.seed ?? Date.now()) % 4
            ])
          : { x: 50, y: campaignChapter === 5 ? 10 : 18 }
        : { ...resolvedBattleSpawns.enemy },
      canonicalLocalTeam = activeMatchConfig?.canonicalLocalTeam ?? "blue",
      oppositeTeam = (team: Team): Team => team === "blue" ? "red" : "blue",
      canonicalTeamFor = (team: Team): Team =>
        canonicalLocalTeam === "blue" ? team : oppositeTeam(team),
      localTeamForCanonical = (team: Team): Team =>
        canonicalLocalTeam === "blue" ? team : oppositeTeam(team),
      swapTunnelAccess = (access: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 =>
        access === 1 ? 2 : access === 2 ? 1 : access,
      canonicalTunnelAccess = (access: 0 | 1 | 2 | 3) =>
        canonicalLocalTeam === "blue" ? access : swapTunnelAccess(access),
      localTunnelAccess = (access: 0 | 1 | 2 | 3) =>
        canonicalLocalTeam === "blue" ? access : swapTunnelAccess(access);
    const isSecretTunnel = !isCampaign && activeMatchConfig?.ruleset === "secret-tunnel",
      initialSecretPhaseEndsAt = isSecretTunnel && activeMatchConfig?.kind === "online"
        ? onlineRoom?.preparationEndsAt ?? Date.now() + SECRET_TUNNEL_PREPARE_MS
        : 0;
    let battlePhase: BattlePhase = isSecretTunnel ? "prepare" : "assault",
      battlePhaseTimeLeft = isSecretTunnel
        ? activeMatchConfig?.kind === "online"
          ? Math.max(0, initialSecretPhaseEndsAt - Date.now())
          : SECRET_TUNNEL_PREPARE_MS
        : 0,
      battlePhaseEndsAt = initialSecretPhaseEndsAt,
      tunnelAllocations: Record<Team, TunnelRouteAllocation> = {
        blue: "50:50",
        red: activeMatchConfig?.kind === "computer" ? "75:25" : "50:50",
      },
      secretWarning15Shown = false,
      secretWarning5Shown = false,
      secretBlueConnected = false,
      secretRedConnected = false,
      secretOreClaims = new Set<string>(),
      secretTunnelOverlay: SecretTunnelOverlay | null = null;
    const grid: Tile[][] = Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: COLS }, (_, x) => {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1)
          return { type: 4, hp: 99, max: 99 };
        const seed = (x * 37 + y * 71 + x * y * 3) % 31,
          type = seed % 13 === 0 ? 3 : seed % 4 === 0 ? 1 : 2,
          max = type === 1 ? 2 : type === 3 ? 5 : 3;
        return {
          type,
          hp: max,
          max,
          ...(seed % 11 === 0 ? { ore: 12 + (seed % 4) * 4 } : {}),
        };
      }),
    );
    const protectedTerrain = (x: number, y: number) =>
        Math.hypot(x - ALLY.x, y - ALLY.y) < 7 ||
        Math.hypot(x - ENEMY.x, y - ENEMY.y) < 7,
      setTerrain = (x: number, y: number, type: number, hp = 0) => {
        if (
          x <= 1 ||
          y <= 1 ||
          x >= COLS - 2 ||
          y >= ROWS - 2 ||
          protectedTerrain(x, y)
        )
          return;
        if (type === 6)
          grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "root" };
        else if (type === 8)
          grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "deepWater" };
        else if (type === 9)
          grid[y][x] = { type: 0, hp: 0, max: 0, surface: "shallowWater" };
        else if (type === 10)
          grid[y][x] = { type: 0, hp: 0, max: 0, surface: "platform" };
        else if (type === 11)
          grid[y][x] = { type: 0, hp: 0, max: 0, surface: "ramp" };
        else
          grid[y][x] = {
            type,
            hp,
            max: hp,
            ...(type === 4 ? { obstacle: "ledge" as const } : {}),
          };
      },
      buildPlatform = (
        left: number,
        top: number,
        width: number,
        height: number,
        rampSide: "top" | "bottom",
      ) => {
        for (let y = top; y < top + height; y++)
          for (let x = left; x < left + width; x++) {
            const edge =
              x === left ||
              x === left + width - 1 ||
              y === top ||
              y === top + height - 1;
            setTerrain(x, y, edge ? 4 : 10, edge ? 99 : 0);
          }
        const rampX = left + Math.floor(width / 2) - 1,
          rampY = rampSide === "top" ? top : top + height - 1;
        for (let x = rampX; x < rampX + 2; x++) setTerrain(x, rampY, 11);
      };
    if (isCampaign) {
      buildPlatform(14, 6, 9, 8, "bottom");
      buildPlatform(35, 22, 9, 8, "top");
      for (let y = 4; y < ROWS - 4; y++)
        if (y < 15 || y > 19) {
          const cx = Math.round(COLS / 2 + Math.sin(y * 0.43) * 3);
          for (let w = 0; w < 2; w++) setTerrain(cx + w, y, 8);
          setTerrain(cx - 1, y, 9);
          setTerrain(cx + 2, y, 9);
        }
      for (const side of [-1, 1])
        for (let n = 0; n < 13; n++) {
          const x = side < 0 ? 8 + n : 35 + n,
            y = Math.round(
              (side < 0 ? 26 : 10) + Math.sin(n * 0.48) * (side < 0 ? 2 : 3),
            );
          setTerrain(x, y, 6, 99);
          if (n % 3 === 1) {
            setTerrain(x, y + side, 7, 4);
            setTerrain(x + 1, y + side, 7, 4);
          }
        }
      for (const [x, y] of [
        [10, 9], [11, 9], [10, 10], [45, 25],
        [46, 25], [45, 26], [22, 27], [23, 27],
      ]) setTerrain(x, y, 7, 4);
    } else applyBattleMapLayout(grid, selectedBattleMap.id);
    const seen: boolean[][] = Array.from({ length: ROWS }, () =>
        Array(COLS).fill(false),
      ),
      memory: Tile[][] = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => ({ type: 4, hp: 99, max: 99 })),
      );
    const openRoom = (c: { x: number; y: number }) => {
      for (let y = c.y - 3; y <= c.y + 3; y++)
        for (let x = c.x - 3; x <= c.x + 3; x++)
          if (grid[y]?.[x]) grid[y][x] = { type: 0, hp: 0, max: 0 };
    };
    openRoom(ALLY);
    if (!(isCampaign && campaignChapter === 1)) openRoom(ENEMY);
    if (isSecretTunnel) {
      secretTunnelOverlay = createSecretTunnelOverlay({
        width: COLS,
        height: ROWS,
        durabilityAt: ({ x, y }) => {
          const tile = grid[y]?.[x];
          return tile?.type === 4 ? 99 : Math.max(1, tile?.hp || tile?.max || 2);
        },
        initialAccessAt: ({ x, y }) => {
          const openTile = grid[y]?.[x]?.type === 0,
            blueCoreArea = openTile &&
              Math.max(Math.abs(x - ALLY.x), Math.abs(y - ALLY.y)) <= 4,
            redCoreArea = openTile &&
              Math.max(Math.abs(x - ENEMY.x), Math.abs(y - ENEMY.y)) <= 4,
            preopenedPublicSpace = openTile && selectedBattleMap.id.startsWith("secret-");
          return blueCoreArea || redCoreArea || preopenedPublicSpace
            ? TUNNEL_ACCESS.shared
            : TUNNEL_ACCESS.none;
        },
      });
    }
    if (isCampaign) {
      const carve = (x0: number, y0: number, x1: number, y1: number) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
          if (grid[y]?.[x]) grid[y][x] = { type: 0, hp: 0, max: 0 };
      };
      if (campaignChapter === 1) {
        carve(3, 15, 52, 21);
        for (let x = 26; x <= 29; x++) for (let y = 16; y <= 20; y++) grid[y][x] = { type: 1, hp: 2, max: 2 };
      } else if (campaignChapter === 2) {
        // 박사 행렬이 빠져나갈 수 없는 굴착 불가 절벽을 먼저 만들고,
        // 폭 3칸의 단일 S자 협곡 호송로만 다시 연다.
        for (let y = 6; y <= 30; y++)
          for (let x = 10; x <= 47; x++)
            grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "ledge" };
        carve(3, 15, 12, 21);
        carve(10, 17, 21, 19);
        carve(19, 17, 21, 28);
        carve(19, 26, 35, 28);
        carve(33, 8, 35, 28);
        carve(33, 8, 43, 10);
        carve(41, 8, 43, 28);
        carve(41, 26, 47, 28);
        carve(45, 17, 47, 28);
        carve(45, 16, 52, 21);
      } else if (campaignChapter === 3) {
        // 연구소 내부의 13×13 격리실. 바깥을 굴착 불가 벽으로 닫아
        // 네 사람이 서로 피할 공간이 거의 없는 근접 난투를 만든다.
        for (let y = 10; y <= 26; y++)
          for (let x = 20; x <= 36; x++)
            grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "ledge" };
        carve(22, 12, 34, 24);
        for (const [x, y] of [[23, 13], [33, 13], [23, 23], [33, 23]])
          setTerrain(x, y, 6, 99);
      } else if (campaignChapter === 4) {
        // 군체는 개방형 통로가 아니라 굴착으로 찾아내는 분산 방 구조다.
        carve(3, 15, 12, 21);
        for (const [x, y, w, h] of [
          [17, 8, 7, 6], [18, 23, 8, 6], [31, 14, 8, 7],
          [41, 5, 7, 7], [42, 24, 8, 7], [27, 4, 7, 6], [27, 26, 8, 6],
        ] as const) carve(x, y, x + w, y + h);
        // 방 사이에는 얇은 흙벽과 단단한 암반이 섞여 정찰 방향 선택이 필요하다.
        for (const [x, y] of [[14, 18], [27, 11], [28, 25], [39, 17], [39, 27]])
          for (let dy = -2; dy <= 2; dy++) grid[y + dy][x] = { type: dy === 0 ? 3 : 1, hp: dy === 0 ? 6 : 3, max: dy === 0 ? 6 : 3 };
      } else {
        // 천안까지 이어진 길은 붕괴했다. 시작방·두 전투실·천안 접속실만 열려 있다.
        carve(3, 15, 12, 21);
        carve(16, 22, 26, 30);
        carve(30, 8, 41, 19);
        carve(46, 7, 52, 13);
        // 반드시 우회할 수 없는 암반 띠. 첫 문은 작전 시작과 함께 열고 이후 문만 구역 전투로 제어한다.
        for (const x of [14, 28, 42])
          for (let y = 2; y < ROWS - 2; y++)
            grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "ledge" };
        for (const [x, y] of [[14, 18], [28, 26], [42, 13]])
          grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "ledge" };
        grid[18][14] = { type: 0, hp: 0, max: 0 };
      }
      if (campaignChapter === 5) {
        for (let y = ENEMY.y - 4; y <= ENEMY.y + 4; y++)
          for (let x = ENEMY.x - 4; x <= ENEMY.x + 4; x++)
            if (grid[y]?.[x]) {
              seen[y][x] = true;
              memory[y][x] = { ...grid[y][x] };
            }
      }
    }
    const pendingOnlineDigPredictions = new Map<
        string,
        {
          clientSequence: number;
          createdAt: number;
          gridTile: Tile;
          tunnelTile?: SecretTunnelTileOverlay;
        }
      >(),
      onlineTerrainChanges = new Map<
        string,
        OnlineBattleSnapshot["terrain"][number]
      >(),
      recordTerrainChange = (x: number, y: number) => {
        if (activeMatchConfig?.kind !== "online") return;
        if (onlineRoom?.hostId !== onlineIdentity?.playerId) return;
        const tile = grid[y]?.[x];
        if (!tile) return;
        onlineTerrainChanges.set(`${x},${y}`, {
          x,
          y,
          type: tile.type,
          hp: tile.hp,
          max: tile.max,
          ...(tile.ore === undefined ? {} : { ore: tile.ore }),
          ...(tile.filledBy === undefined
            ? {}
            : { filledBy: canonicalTeamFor(tile.filledBy) }),
          ...(tile.surface === undefined ? {} : { surface: tile.surface }),
          ...(tile.obstacle === undefined ? {} : { obstacle: tile.obstacle }),
          ...(tile.hazard === undefined ? {} : { hazard: tile.hazard }),
        });
      };
    const campaign2EscortRoute = [
      { x: 11, y: 18 },
      { x: 20, y: 18 },
      { x: 20, y: 27 },
      { x: 34, y: 27 },
      { x: 34, y: 9 },
      { x: 42, y: 9 },
      { x: 42, y: 27 },
      { x: 46, y: 27 },
      { x: 46, y: 18 },
      { x: 49, y: 18 },
    ];
    const enemyHeroId = activeMatchConfig?.teams[1].slots[0]?.heroId ?? (enemyFaction === "human" ? "kimssi" : enemyFaction === "bugborn" ? "cheolgak" : "d09"),
      earlyCampaignScale = isCampaign && (campaignChapter === 1 || campaignChapter === 2),
      heroBaseHp = Math.round((180 * playerDef.stats.maxHp) / 820 * (earlyCampaignScale ? 1.3 : 1)),
      heroBaseAttack = Math.round((34 * playerDef.stats.damage) / 42 * (earlyCampaignScale ? 1.08 : 1)),
      hero: Unit = createHeroUnit({
        id: unitId++,
        heroId: playerDef.id,
        x: isCampaign && campaignChapter === 3 ? 27 : ALLY.x + 1,
        y: isCampaign && campaignChapter === 3 ? 18 : ALLY.y + 1,
        team: "blue",
        hp: heroBaseHp,
        act: isCampaign && campaignChapter === 3 ? 5900 : 0,
        attack: heroBaseAttack,
        armor: earlyCampaignScale ? Math.max(18, playerDef.stats.armor) : playerDef.stats.armor,
        onlinePlayerId: activeMatchConfig?.kind === "online" ? activeMatchConfig.teams[0].slots[0]?.id : undefined,
      }),
      enemyHero: Unit = createHeroUnit({
        id: unitId++,
        heroId: enemyHeroId,
        x: ENEMY.x - 1,
        y: ENEMY.y + 1,
        team: "red",
        hp: 190,
        attack: 38,
        armor: enemyFaction === "ai" ? 22 : 18,
        onlinePlayerId: activeMatchConfig?.kind === "online" ? activeMatchConfig.teams[1].slots[0]?.id : undefined,
        networkController: activeMatchConfig?.kind === "online" ? activeMatchConfig.teams[1].slots[0]?.controller === "ai" ? "ai" : "remote" : "ai",
      }),
      allySlot = !isCampaign ? activeMatchConfig?.teams[0].slots[1] : undefined,
      enemySecondSlot = !isCampaign ? activeMatchConfig?.teams[1].slots[1] : undefined,
      allyHero = allySlot ? createHeroUnit({
        id: unitId++, heroId: allySlot.heroId, x: ALLY.x + 1, y: ALLY.y + 2, team: "blue",
        onlinePlayerId: activeMatchConfig?.kind === "online" ? allySlot.id : undefined,
        networkController: activeMatchConfig?.kind === "online" ? allySlot.controller === "ai" ? "ai" : "remote" : "ai",
      }) : null,
      enemySecondHero = enemySecondSlot ? createHeroUnit({
        id: unitId++, heroId: enemySecondSlot.heroId, x: ENEMY.x - 1, y: ENEMY.y + 2, team: "red",
        onlinePlayerId: activeMatchConfig?.kind === "online" ? enemySecondSlot.id : undefined,
        networkController: activeMatchConfig?.kind === "online" ? enemySecondSlot.controller === "ai" ? "ai" : "remote" : "ai",
      }) : null,
      battleAiHeroes = [allyHero, enemyHero, enemySecondHero].filter((unit): unit is Unit => Boolean(unit));
    const playerStarter = factionBuildables(playerDef.faction).find(
        (def) => def.category === "multi" || def.category === "ranged",
      )!,
      enemyStarter = factionBuildables(enemyFaction).find(
        (def) => def.category === "multi" || def.category === "ranged",
      )!,
      units: Unit[] = [hero, ...(isCampaign ? [] : battleAiHeroes)],
      turrets: Turret[] = isCampaign && campaignChapter === 1 ? [] : [
        createBuildableUnit({
          id: buildId++,
          kind: playerStarter.id,
          x: ALLY.x + Math.sign(COLS / 2 - ALLY.x) * 2,
          y: ALLY.y - 1,
          team: "blue",
          starter: true,
          cost: 0,
        }),
        createBuildableUnit({
          id: buildId++,
          kind: enemyStarter.id,
          x: ENEMY.x + Math.sign(COLS / 2 - ENEMY.x) * 2,
          y: ENEMY.y - 1,
          team: "red",
          starter: true,
          cost: 0,
        }),
      ],
      heroWorld = { x: hero.x * S + S / 2, y: hero.y * S + S / 2 };
    if (isCampaign && campaignChapter === 2)
      ["한 박사", "윤 박사", "민 박사"].forEach((name, index) =>
        units.push(createCivilianUnit({ id: unitId++, x: ALLY.x + 2, y: ALLY.y + index - 1, name, scientistIndex: index as 0 | 1 | 2, act: CAMPAIGN2_SCIENTIST_START_DELAY_MS + index * 280 })),
      );
    if (isCampaign && campaignChapter === 2) {
      for (const [x, y] of [[17, 16], [25, 25], [32, 20], [36, 13], [44, 23]])
        turrets.push(createBuildableUnit({ id: buildId++, x, y, team: "red", kind: "venomTree", hp: 125, cool: 300, cost: 0, level: 2 }));
    }
    if (isCampaign && campaignChapter === 1) {
      units.push(createMinionUnit({
        id: unitId++, x: ALLY.x + 5, y: ALLY.y, team: "red",
        name: "버그본 정찰충", hp: 120, maxHp: 120,
        dir: { x: -1, y: 0 }, act: 0, attack: 0, attackInterval: 1,
        armor: 80, critChance: 0, critMultiplier: 1, moveSpeed: 4.5,
        faction: "bugborn", minionRole: "shooter", level: 1,
        minionVisual: "idle", minionVisualUntil: 0, campaignScout: true,
      }));
      setMessage("미확인 버그본이 서울 거점을 관찰하고 있다");
    }
    const makeCampaignHero = (
      heroId: string,
      team: Team,
      x: number,
      y: number,
      campaignAi: "arena" | "companion" | "battle",
      index = 0,
    ): Unit => createHeroUnit({
      id: unitId++,
      heroId,
      x,
      y,
      team,
      controller: campaignAi,
      hp: campaignAi === "arena" ? 150 + index * 15 : campaignAi === "battle" ? 300 + index * 25 : 260,
      attack: campaignAi === "arena" ? 25 + index * 3 : campaignAi === "battle" ? 34 + index * 3 : 32,
      armor: 12 + index * 2,
      act: 350 + index * 120,
    });
    let campaign1CheolgakReserve: Unit | null = null;
    if (isCampaign && campaignChapter === 3) {
      turrets.length = 0;
      hero.campaignHeroId = "yoo-seungcheon";
      hero.hp = hero.maxHp = 420;
      hero.armor = 12;
      const kimAlly = makeCampaignHero("kimssi", "blue", hero.x - 2, hero.y - 1, "arena", 0);
      const arenaOpponents = [
        makeCampaignHero("ahn-seona", "red", 29, 17, "arena", 1),
        makeCampaignHero("kang-ryeokhan", "red", 29, 19, "arena", 2),
      ];
      Object.assign(kimAlly, { hp: 430, maxHp: 430, attack: 24, armor: 18 });
      Object.assign(arenaOpponents[0], { hp: 350, maxHp: 350, attack: 20, armor: 10 });
      Object.assign(arenaOpponents[1], { hp: 480, maxHp: 480, attack: 23, armor: 25 });
      units.push(kimAlly, ...arenaOpponents);
      const arenaRoster = [hero, kimAlly, ...arenaOpponents], now = performance.now();
      arenaRoster.forEach((fighter, index) => {
        fighter.arenaTargetId = fighter.team === "blue" ? arenaOpponents[index % arenaOpponents.length].id : undefined;
        fighter.arenaTargetUntil = fighter.team === "blue" ? now + 5200 : 0;
        fighter.arenaSkillReadyAt = now + 700 + index * 320;
        fighter.arenaUltimateReadyAt = now + 3600 + index * 520;
      });
    }
    if (isCampaign && campaignChapter === 4)
      units.push(makeCampaignHero("kimssi", "blue", ALLY.x + 2, ALLY.y - 1, "companion"));
    if (isCampaign && campaignChapter === 1) {
      campaign1CheolgakReserve = makeCampaignHero("cheolgak", "red", 38, 17, "battle", 0);
      Object.assign(campaign1CheolgakReserve, {
        hp: 220,
        maxHp: 220,
        attack: 22,
        armor: 8,
        campaign1Boss: true,
      });
    }
    if (isCampaign && campaignChapter === 2) {
      const pyeongtaekGuard = makeCampaignHero("cheolgak", "red", ENEMY.x - 2, ENEMY.y, "battle", 0);
      Object.assign(pyeongtaekGuard, {
        hp: 260,
        maxHp: 260,
        attack: 26,
        armor: 10,
        campaignGuard: "pyeongtaek",
        campaignActivated: false,
        campaignSentry: true,
        campaignGuardX: pyeongtaekGuard.x,
        campaignGuardY: pyeongtaekGuard.y,
      });
      const canyonGuard = makeCampaignHero("sanmi", "red", 42, 10, "battle", 1);
      Object.assign(canyonGuard, {
        campaignSentry: true,
        campaignGuardX: canyonGuard.x,
        campaignGuardY: canyonGuard.y,
      });
      units.push(pyeongtaekGuard, canyonGuard);
    }
    if (isCampaign && campaignChapter === 4) {
      const chamberHeroes = [
        makeCampaignHero("cheolgak", "red", 34, 17, "battle", 0),
        makeCampaignHero("sanmi", "red", ENEMY.x - 2, ENEMY.y + 1, "battle", 1),
      ];
      chamberHeroes.forEach((fighter, index) =>
        Object.assign(fighter, {
          campaignZone: (index + 2) as 2 | 3,
          campaignActivated: true,
          campaignSentry: true,
          campaignGuardX: fighter.x,
          campaignGuardY: fighter.y,
        }),
      );
      units.push(...chamberHeroes);
    }
    if (isCampaign && campaignChapter === 5) {
      const chapter5Heroes = [
        { fighter: makeCampaignHero("cheolgak", "red", 20, 25, "battle", 0), zone: 1 as const },
        { fighter: makeCampaignHero("sanmi", "red", 23, 28, "battle", 2), zone: 1 as const },
        { fighter: makeCampaignHero("hoebun", "red", 34, 12, "battle", 1), zone: 2 as const },
        { fighter: makeCampaignHero("maedeup", "red", 38, 16, "battle", 3), zone: 2 as const },
      ];
      chapter5Heroes.forEach(({ fighter, zone }, index) => {
        fighter.campaignPower = index < 2 ? 1 : 2;
        fighter.campaignZone = zone;
        fighter.campaignActivated = true;
        fighter.campaignSentry = true;
        fighter.campaignGuardX = fighter.x;
        fighter.campaignGuardY = fighter.y;
      });
      units.push(...chapter5Heroes.map(({ fighter }) => fighter));
    }
    if (isCampaign && campaignChapter === 4) {
      for (const [index, [x, y]] of [[20, 10], [23, 26], [37, 17], [46, 28], [ENEMY.x - 2, ENEMY.y + 1]].entries()) {
        const installation = createBuildableUnit({ id: buildId++, x, y, team: "red", kind: "venomTree", hp: 155, cool: 250, cost: 0, level: 2 });
        Object.assign(installation, { campaignZone: (Math.min(3, Math.floor(index / 2) + 1)) as 1 | 2 | 3, campaignActivated: true });
        turrets.push(installation);
      }
    }
    if (isCampaign && campaignChapter === 5) {
      for (const [index, [x, y]] of [[19, 24], [24, 28], [33, 11], [38, 16], [47, 9], [51, 12]].entries()) {
        const installation = createBuildableUnit({ id: buildId++, x, y, team: "red", kind: "venomTree", hp: 175, cool: 220, cost: 0, level: 2 });
        Object.assign(installation, { campaignZone: (Math.floor(index / 2) + 1) as 1 | 2 | 3, campaignActivated: true });
        turrets.push(installation);
      }
    }
    if (isCampaign) {
      const growth = HERO_LEVELS[heroLevel - 1];
      for (const ally of units.filter((unit) => unit.team === "blue" && unit.role === "hero")) {
        ally.level = heroLevel;
        ally.maxHp *= growth.hp * campaignBalance.allyHp;
        ally.hp = ally.maxHp;
        ally.attack *= growth.damage * campaignBalance.allyDamage;
        ally.armor += growth.armor;
      }
    }
    const initialTalentTiers = TALENT_LEVELS.filter((level) => level <= heroLevel);
    pendingTalentTiersRef.current = [...initialTalentTiers];
    setPendingTalentTiers([...initialTalentTiers]);
    setSelectedTalentIds([]);
    talentTierOpenRef.current = null;
    setTalentTierOpen(null);
    let heroAnim: YooAnim = "locomotion",
      heroAnimStart = performance.now(),
      heroAnimDuration = 0,
      heroActionPose: 0 | 1 | 2 | 3 | 4 = 0,
      heroMoveUntil = 0,
      heroVisualAnchorX = 0,
      heroVisualAnchorAt = performance.now();
    const playHeroAnim = (name: YooAnim, duration: number, actionPose: 0 | 1 | 2 | 3 | 4 = 0) => {
        heroAnim = name;
        heroAnimStart = performance.now();
        heroAnimDuration = duration;
        heroActionPose = actionPose;
      },
      smoothHeroAnchor = (target: number, now: number) => {
        const dt = Math.min(50, Math.max(0, now - heroVisualAnchorAt));
        heroVisualAnchorAt = now;
        heroVisualAnchorX +=
          (target - heroVisualAnchorX) * (1 - Math.exp(-dt / 75));
        return heroVisualAnchorX;
      };
    const startAmbient = () => {
      if (isCampaign) void combatAudio.startCampaign(campaignChapter);
      else void combatAudio.start(selectedBattleMap.id);
    };
    startAmbient();
    if (isSecretTunnel)
      setMessage("비밀 굴착 0:30 · 적 거점 확인 → 터널 연결 → 광석·우회로 선택");
    const tone = (kind: CombatSfx) => {
      void combatAudio.sfx(kind);
    };
    const kindTone = (kind: BuildKind): "shot" | "blast" =>
      kind === "missileM2" || kind === "rootAmbusher" || kind === "acidSporeSac" ? "blast" : "shot";
    const burst = (x: number, y: number, color: string, n = 8) => {
        for (let i = 0; i < n; i++)
          dust.push({
            x: x * S + S / 2 + (random() - 0.5) * S,
            y: y * S + S / 2 + (random() - 0.5) * S,
            life: 240 + random() * 330,
            color,
          });
      },
      occupied = (x: number, y: number, ignore?: Unit, movingTeam: Team = ignore?.team ?? "blue") =>
        units.find((u) =>
          u !== ignore &&
          u.alive &&
          u.networkVisible !== false &&
          u.campaignActivated !== false &&
          u.x === x &&
          u.y === y &&
          !(isSecretTunnel && battlePhase === "prepare" && u.team !== movingTeam),
        ),
      turretAt = (x: number, y: number, movingTeam: Team = "blue") =>
        turrets.find((t) =>
          t.hp > 0 &&
          t.campaignActivated !== false &&
          t.x === x &&
          t.y === y &&
          !(isSecretTunnel && battlePhase === "prepare" && t.team !== movingTeam),
        ),
      baseAt = (x: number, y: number) =>
        x === ALLY.x && y === ALLY.y
          ? "blue"
          : !(isCampaign && campaignChapter === 1) && x === ENEMY.x && y === ENEMY.y
            ? "red"
            : null,
      baseTargetAtWorld = (wx: number, wy: number) => {
        const hit = (
          base: { x: number; y: number },
          faction: FactionId,
        ) => {
          const width = faction === "bugborn" ? 112 : 106,
            height = faction === "bugborn" ? 82 : 74,
            cx = base.x * S + S / 2,
            cy = base.y * S + S / 2,
            top = cy - height + 25;
          return (
            wx >= cx - width / 2 - 5 &&
            wx <= cx + width / 2 + 5 &&
            wy >= top - 18 &&
            wy <= top + height + 6
          );
        };
        if (hit(ALLY, playerDef.faction)) return "blue" as const;
        if (
          !(isCampaign && campaignChapter === 1) &&
          hit(
            ENEMY,
            isCampaign && (campaignChapter === 2 || campaignChapter === 5)
              ? "human"
              : enemyFaction,
          )
        ) return "red" as const;
        return null;
      },
      openForTeam = (x: number, y: number, team: Team) =>
        isSecretTunnel && secretTunnelOverlay
          ? canTraverseSecretTunnelInPhase(secretTunnelOverlay, { x, y }, team, battlePhase)
          : !!grid[y]?.[x] && WALKABLE_TERRAIN.has(grid[y][x].type),
      canEngageAt = (team: Team, x: number, y: number) =>
        !isSecretTunnel || (battlePhase === "assault" && openForTeam(x, y, team)),
      open = (x: number, y: number) => openForTeam(x, y, "blue"),
      tileForLocalTunnelView = (x: number, y: number): Tile => {
        const source = grid[y]?.[x] ?? { type: 4, hp: 99, max: 99 };
        if (!isSecretTunnel || !secretTunnelOverlay) return source;
        const view = secretTunnelTileViewForTeam(
          secretTunnelOverlay,
          { x, y },
          "blue",
          battlePhase === "assault" || battlePhase === "finished",
        );
        if (view.canTraverse || view.visibility === "opponent")
          return { ...source, type: 0, hp: 0, max: 0 };
        if (source.type === 4) return source;
        const hp = Math.max(1, view.durability ?? (source.hp || source.max || 2)),
          max = Math.max(hp, view.maxDurability ?? (source.max || hp));
        return { ...source, type: source.type === 0 ? 2 : source.type, hp, max };
      },
      terrainMoveFactor = (x: number, y: number) =>
        grid[y]?.[x]?.surface === "shallowWater" ? 0.58 : 1,
      resolveUnitOverlaps = () => {
        const claimed = new Set<string>(),
          claimKey = (unit: Unit, x: number, y: number) =>
            isSecretTunnel && battlePhase === "prepare"
              ? `${unit.team}:${x},${y}`
              : `${x},${y}`,
          actors = units
            .filter((u) => u.alive)
            .sort(
              (a, b) =>
                (b === hero ? 2 : b.role === "hero" ? 1 : 0) -
                (a === hero ? 2 : a.role === "hero" ? 1 : 0),
            ),
          offsets = [
            ...DIRS,
            { x: 1, y: 1 },
            { x: 1, y: -1 },
            { x: -1, y: 1 },
            { x: -1, y: -1 },
            { x: 2, y: 0 },
            { x: -2, y: 0 },
            { x: 0, y: 2 },
            { x: 0, y: -2 },
          ];
        for (const u of actors) {
          let key = claimKey(u, u.x, u.y);
          if (!claimed.has(key)) {
            claimed.add(key);
            continue;
          }
          const escape = offsets
            .map((d) => ({ x: u.x + d.x, y: u.y + d.y }))
            .find(
              (p) =>
                openForTeam(p.x, p.y, u.team) &&
                !claimed.has(claimKey(u, p.x, p.y)) &&
                !turretAt(p.x, p.y, u.team) &&
                !baseAt(p.x, p.y),
            );
          if (!escape) continue;
          u.x = escape.x;
          u.y = escape.y;
          if (u === hero) {
            heroWorld.x = u.x * S + S / 2;
            heroWorld.y = u.y * S + S / 2;
            moveTarget = null;
            attackTarget = null;
          }
          key = claimKey(u, u.x, u.y);
          claimed.add(key);
          u.act = Math.max(u.act, 180);
        }
      };
    const unitWorld = (u: Unit) =>
        u === hero ? heroWorld : { x: u.x * S + S / 2, y: u.y * S + S / 2 },
      interpolatedUnitWorld = (u: Unit, now = performance.now()) => {
        if (u === hero) return { ...heroWorld };
        const duration = u.arenaMoveDuration ?? 0,
          elapsed = duration && u.arenaMoveStartedAt !== undefined
            ? Math.max(0, Math.min(1, (now - u.arenaMoveStartedAt) / duration))
            : 1;
        if (
          elapsed < 1 &&
          u.arenaMoveFromX !== undefined &&
          u.arenaMoveFromY !== undefined &&
          u.arenaMoveToX !== undefined &&
          u.arenaMoveToY !== undefined
        ) {
          const eased = elapsed;
          return {
            x: u.arenaMoveFromX + (u.arenaMoveToX - u.arenaMoveFromX) * eased,
            y: u.arenaMoveFromY + (u.arenaMoveToY - u.arenaMoveFromY) * eased,
          };
        }
        return { x: u.x * S + S / 2, y: u.y * S + S / 2 };
      },
      setUnitMoveVisual = (u: Unit, toX: number, toY: number, duration = 280) => {
        if (u === hero) return;
        const now = performance.now(), from = interpolatedUnitWorld(u, now);
        u.arenaMoveFromX = from.x;
        u.arenaMoveFromY = from.y;
        u.arenaMoveToX = toX * S + S / 2;
        u.arenaMoveToY = toY * S + S / 2;
        u.arenaMoveStartedAt = now;
        u.arenaMoveDuration = Math.max(120, Math.min(760, duration));
        u.arenaMoveUntil = now + u.arenaMoveDuration;
      },
      commitGridMove = (u: Unit, x: number, y: number, duration = 280) => {
        const fromX = u.x,
          fromY = u.y;
        setUnitMoveVisual(u, x, y, duration);
        u.x = x;
        u.y = y;
        if (u.role === "minion") {
          u.routePreviousX = fromX;
          u.routePreviousY = fromY;
          u.routeReverseLockUntil = performance.now() + Math.max(520, duration * 1.6);
          marchReservations.add(`${x},${y}`);
        }
      },
      segmentMetric = (
        px: number,
        py: number,
        ax: number,
        ay: number,
        bx: number,
        by: number,
      ) => {
        const vx = bx - ax,
          vy = by - ay,
          len2 = vx * vx + vy * vy,
          t = len2
            ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2))
            : 0,
          cx = ax + vx * t,
          cy = ay + vy * t;
        return { distance: Math.hypot(px - cx, py - cy), t };
      };
    const allyCoreVisionRadius = 5.5,
      inAllyCoreVision = (x: number, y: number) =>
        (ALLY.x - x) ** 2 + (ALLY.y - y) ** 2 <= allyCoreVisionRadius ** 2,
      visionSources = () => [
        ...units.filter((u) => u.alive && u.networkVisible !== false && u.team === "blue"),
        ...turrets.filter((t) => t.hp > 0 && t.team === "blue"),
      ],
      visionRadius = (u: Unit | Turret) =>
        "role" in u && u === hero
          ? playerDef.stats.vision
          : "role" in u && u.role === "minion"
            ? 4
            : 7,
      visible = (x: number, y: number) =>
        inAllyCoreVision(x, y) || visionSources().some(
          (u) => (u.x - x) ** 2 + (u.y - y) ** 2 <= visionRadius(u) ** 2,
        ),
      markVision = () => {
        resolveUnitOverlaps();
        recoverEmbeddedHero();
        for (let y = Math.max(0, Math.floor(ALLY.y - allyCoreVisionRadius)); y <= Math.min(ROWS - 1, Math.ceil(ALLY.y + allyCoreVisionRadius)); y++)
          for (let x = Math.max(0, Math.floor(ALLY.x - allyCoreVisionRadius)); x <= Math.min(COLS - 1, Math.ceil(ALLY.x + allyCoreVisionRadius)); x++)
            if (inAllyCoreVision(x, y)) {
              seen[y][x] = true;
              memory[y][x] = { ...tileForLocalTunnelView(x, y) };
            }
        for (const u of visionSources()) {
          const r = visionRadius(u),
            minY = Math.max(0, Math.floor(u.y - r)),
            maxY = Math.min(ROWS - 1, Math.ceil(u.y + r)),
            minX = Math.max(0, Math.floor(u.x - r)),
            maxX = Math.min(COLS - 1, Math.ceil(u.x + r));
          for (let y = minY; y <= maxY; y++)
            for (let x = minX; x <= maxX; x++)
              if ((u.x - x) ** 2 + (u.y - y) ** 2 <= r * r) {
                seen[y][x] = true;
                memory[y][x] = { ...tileForLocalTunnelView(x, y) };
              }
        }
      };
    const awardCredits = (team: Team, amount: number) => {
        const adjusted = creditedAmount(
          amount,
          team === "red" && activeMatchConfig?.kind === "computer",
          computerBalance.enemyCreditMultiplier,
        );
        if (team === "blue") money += adjusted;
        else if (!isCampaign) enemyBuildCredits += adjusted;
      },
      teamCredits = (team: Team) => team === "blue" ? money : enemyBuildCredits,
      spendTeamCredits = (team: Team, amount: number) => {
        if (teamCredits(team) < amount) return false;
        if (team === "blue") money -= amount;
        else enemyBuildCredits -= amount;
        return true;
      },
      reward = (amount: number, label: string, team: Team = "blue") => {
        awardCredits(team, amount);
        if (team !== "blue") return;
        tone("coin");
        setMessage(`${label} +${amount} 크레딧`);
      },
      critMeter: Record<Team, number> = { blue: 0, red: 0 },
      combatDamage = (
        base: number,
        armor: number,
        team: Team,
        canCrit = true,
        chance = 0.07,
        mult = 1.5,
      ) => {
        let crit = false;
        if (canCrit && chance > 0) {
          critMeter[team] = Math.min(0.8, critMeter[team] + chance);
          if (random() < critMeter[team]) {
            crit = true;
            critMeter[team] = 0;
          } else
            critMeter[team] = Math.min(0.8, critMeter[team] + chance * 0.2);
        }
        const raw = base * (crit ? mult : 1),
          final = Math.max(1, (raw * 100) / (100 + Math.max(0, armor)));
        return { amount: final, crit };
      },
      pushCombatPopup = (
        x: number,
        y: number,
        text: string,
        color: string,
        team: Team,
        critical = false,
        life = 780,
      ) => {
        damagePopups.push({ x, y, text, life, maxLife: life, critical, color, team });
      },
      pushDamagePopup = (
        x: number,
        y: number,
        amount: number,
        critical: boolean,
        team: Team,
        label = "",
      ) => {
        const rounded = Math.max(1, Math.round(amount));
        pushCombatPopup(
          x,
          y,
          `${critical ? "치명타 " : ""}${label}${label ? " " : ""}-${rounded}`,
          critical ? "#ffe071" : team === "blue" ? "#ff7668" : "#d8f7ff",
          team,
          critical,
        );
      },
      applyHeroLevel = (next: number) => {
        const previousLevel = heroLevel,
          before = HERO_LEVELS[Math.max(0, hero.level - 1)],
          after = HERO_LEVELS[next - 1],
          ratio = hero.hp / hero.maxHp,
          baseHp = hero.maxHp / before.hp,
          baseAttack = hero.attack / before.damage,
          baseArmor = hero.armor - before.armor;
        heroLevel = next;
        hero.level = next;
        hero.maxHp = baseHp * after.hp;
        hero.hp = hero.maxHp * ratio;
        hero.attack = baseAttack * after.damage;
        hero.armor = baseArmor + after.armor;
        for (const ally of units.filter(
          (unit) => unit !== hero && unit.role === "hero" && unit.team === "blue",
        )) {
          const before = HERO_LEVELS[Math.max(0, ally.level - 1)],
            allyRatio = ally.maxHp > 0 ? ally.hp / ally.maxHp : 0,
            baseHp = ally.maxHp / before.hp,
            baseAttack = ally.attack / before.damage,
            baseArmor = ally.armor - before.armor;
          ally.level = next;
          ally.maxHp = baseHp * after.hp;
          ally.hp = ally.maxHp * allyRatio;
          ally.attack = baseAttack * after.damage;
          ally.armor = baseArmor + after.armor;
        }
        if (isCampaign) {
          const nextMinionLevel = Math.max(
            minionLevels.blue,
            Math.min(5, Math.max(1, next - 1)),
          ) as MinionLevel;
          if (nextMinionLevel > minionLevels.blue) applyTeamMinionLevel("blue", nextMinionLevel);
        }
        const unlockedTiers = TALENT_LEVELS.filter(
          (level) =>
            level > previousLevel &&
            level <= next &&
            !pendingTalentTiersRef.current.includes(level) &&
            ![...talents].some((id) => heroTalentById(playerDef.id, id)?.level === level),
        );
        if (unlockedTiers.length) {
          pendingTalentTiersRef.current = [...pendingTalentTiersRef.current, ...unlockedTiers].sort(
            (a, b) => a - b,
          );
          setPendingTalentTiers([...pendingTalentTiersRef.current]);
        }
        tone("build");
        setMessage(
          unlockedTiers.length
            ? `${playerDef.name} ${next}레벨 · 특성 해금 · HUD의 특성 버튼에서 선택`
            : `${playerDef.name} ${next}레벨 · 지하 적응 완료`,
        );
      },
      gainHeroXp = (amount: number) => {
        heroXp += Math.round(amount * (isCampaign ? campaignBalance.xpGain : 1));
        let next = heroLevel;
        for (const row of HERO_LEVELS) if (heroXp >= row.xp) next = row.level;
        if (next > heroLevel) applyHeroLevel(next);
      },
      hurt = (
        u: Unit,
        d: number,
        from: Team,
        canCrit = true,
        chance = 0.07,
        mult = 1.5,
        forceHostile = false,
        source?: { attacker: string; action: string; unit?: Unit; installation?: Turret },
      ) => {
        if (!u.alive || u.networkVisible === false || (u.team === from && !forceHostile)) return 0;
        if (isSecretTunnel && battlePhase === "prepare" && u.team !== from) return 0;
        const tacticalNow = performance.now(),
          tacticalDefenseActive = u.role === "minion" && tacticalNow < tacticalStates[u.team].defenseUntil,
          tacticalOffenseActive = source?.unit?.role === "minion" && tacticalNow < tacticalStates[source.unit.team].offenseUntil;
        if (tacticalDefenseActive && u.faction === "ai" && (u.tacticalBlocks ?? 0) > 0) {
          u.tacticalBlocks = (u.tacticalBlocks ?? 0) - 1;
          const blockedAt = unitWorld(u);
          pushCombatPopup(blockedAt.x, blockedAt.y - 30, "차단", "#75e6ff", u.team, false, 520);
          return 0;
        }
        if (
          (u === hero && performance.now() < evadeUntil) ||
          performance.now() < (u.networkSurvivalEvadeUntil ?? 0)
        ) {
          if (u === hero) {
            burst(hero.x, hero.y, "#d7fbff", 10);
            setMessage("회피 성공 · 피해 무효");
          }
          return 0;
        }
        const weakened = (u.vulnerableUntil ?? 0) > performance.now() ? 18 : 0,
          activeArmor =
            Math.max(0, u.armor - weakened) +
            (u === hero && performance.now() < drillArmorUntil ? 10 : 0) +
            (performance.now() < (u.networkSurvivalArmorUntil ?? 0) ? 10 : 0),
          arenaScale =
            isCampaign &&
            campaignChapter === 3 &&
            (u === hero || u.campaignAi === "arena" || u.campaignAi === "companion")
              ? 0.62
              : 1,
          campaignDamageScale = isCampaign && u.team === "blue" ? campaignBalance.incomingDamage : 1,
          computerAttackScale = !isCampaign && activeMatchConfig?.kind === "computer" && from === "red"
            ? computerBalance.enemyDamage
            : 1,
          sourceTacticalScale = source?.unit?.minionRole === "elite" ? ELITE_TACTICAL_EFFECT_SCALE : 1,
          targetTacticalScale = u.minionRole === "elite" ? ELITE_TACTICAL_EFFECT_SCALE : 1,
          supportAttackScale = source?.unit?.role === "minion" && supportAuraForUnit(source.unit)?.aura.kind === "attack"
            ? 1 + (supportAuraForUnit(source.unit)?.value ?? 0)
            : 1,
          offenseScale = tacticalOffenseActive && source?.unit?.faction === "human"
            ? 1 + 0.35 * sourceTacticalScale
            : 1,
          defenseScale = tacticalDefenseActive && u.faction === "human"
            ? 1 - 0.65 * targetTacticalScale
            : 1,
          result = combatDamage(d * arenaScale * campaignDamageScale * computerAttackScale * offenseScale * defenseScale * supportAttackScale, activeArmor, from, canCrit, chance, mult);
        if (tacticalDefenseActive && u.faction === "bugborn" && (u.tacticalShield ?? 0) > 0) {
          const absorbed = Math.min(result.amount, u.tacticalShield ?? 0);
          u.tacticalShield = Math.max(0, (u.tacticalShield ?? 0) - absorbed);
          result.amount -= absorbed;
          if (absorbed > 0) {
            const shieldAt = unitWorld(u);
            pushCombatPopup(shieldAt.x, shieldAt.y - 30, `갑피 ${Math.round(absorbed)}`, "#b7e35a", u.team, false, 520);
          }
          if (result.amount <= 0) return 0;
        }
        const popupPosition = unitWorld(u);
        pushDamagePopup(
          popupPosition.x,
          popupPosition.y - (u.role === "hero" ? 44 : 30),
          result.amount,
          result.crit,
          u.team,
        );
        if (u === hero) {
          const record: DamageRecord = {
            attacker: source?.attacker ?? "적 전투원",
            action: source?.action ?? "공격",
            amount: Math.round(result.amount),
            critical: result.crit,
          };
          heroDamageHistory.push(record);
          if (heroDamageHistory.length > 3) heroDamageHistory.shift();
        }
        u.lastDamagedAt = performance.now();
        const attackingUnit = source?.unit?.alive && source.unit.team !== u.team
            ? source.unit
            : undefined,
          attackingInstallation = source?.installation &&
              source.installation.hp > 0 &&
              source.installation.team !== u.team
            ? source.installation
            : undefined;
        if (attackingUnit || attackingInstallation) {
          const shareTeamTarget = (
            team: Team,
            anchor: Unit,
            target: { kind: "unit" | "installation"; id: number },
            reason: NonNullable<Unit["assistReason"]>,
          ) => {
            const routeDistances = pathDistanceMap(anchor, team);
            for (const ally of units) {
              if (
                !ally.alive ||
                ally.team !== team ||
                (ally.role !== "hero" && ally.role !== "minion")
              ) continue;
              const routeDistance = routeDistances.get(`${ally.x},${ally.y}`),
                assistDistance = ally.campaignAi === "companion"
                  ? CAMPAIGN_COMPANION_ASSIST_DISTANCE
                  : ally.campaignSentry
                    ? CAMPAIGN_SENTRY_AGGRO_DISTANCE
                    : CAMPAIGN_ASSIST_RADIUS;
              if (routeDistance === undefined || routeDistance > assistDistance) continue;
              ally.assistTargetKind = target.kind;
              ally.assistTargetId = target.id;
              ally.assistUntil = performance.now() + (
                ally.campaignAi === "companion"
                  ? CAMPAIGN_COMPANION_ASSIST_MEMORY_MS
                  : CAMPAIGN_ASSIST_MEMORY_MS
              );
              ally.assistReason = reason;
            }
          };
          // 방어 팀은 실제 공격 유닛 또는 설치물을 공유한다. 유닛 공격은 공격 팀에도 집중 표적을 공유한다.
          if (attackingUnit) {
            shareTeamTarget(u.team, u, { kind: "unit", id: attackingUnit.id }, "ally-attacked");
            shareTeamTarget(
              attackingUnit.team,
              attackingUnit,
              { kind: "unit", id: u.id },
              "ally-focused",
            );
          } else if (attackingInstallation) {
            shareTeamTarget(
              u.team,
              u,
              { kind: "installation", id: attackingInstallation.id },
              "ally-attacked",
            );
          }
        }
        u.hp -= result.amount;
        if (source?.unit === hero && from === "blue") {
          const lifesteal = talentBonuses().lifesteal;
          if (lifesteal > 0)
            hero.hp = Math.min(hero.maxHp, hero.hp + result.amount * lifesteal);
        }
        if (tacticalOffenseActive && source?.unit?.faction === "bugborn" && source.unit.alive)
          source.unit.hp = Math.min(
            source.unit.maxHp,
            source.unit.hp + result.amount * 0.2 * (source.unit.minionRole === "elite" ? ELITE_TACTICAL_EFFECT_SCALE : 1),
          );
        if (u === hero) playHeroAnim("hurt", 280);
        else if (u.role === "minion") {
          u.minionVisual = "hurt";
          u.minionVisualUntil = performance.now() + 240;
        }
        burst(
          u.x,
          u.y,
          result.crit ? "#fff0a0" : u.team === "blue" ? "#55d8e9" : "#ef6651",
          result.crit ? 16 : 7,
        );
        const soundProminence = u === hero
          ? 1
          : Math.max(.22, 1 - Math.hypot(u.x - hero.x, u.y - hero.y) / 14);
        void combatAudio.impact(u.faction, result.crit, soundProminence);
        if (result.crit)
          setMessage(`치명타! ${Math.round(result.amount)} 피해`);
        if (u.hp <= 0) {
          u.hp = 0;
          u.alive = false;
          u.respawn = u.role === "hero" ? 8000 : 1800;
          if (u === hero) {
            playHeroAnim("down", 650);
            if (isCampaign && !ended) {
              ended = true;
              const lastHit = heroDamageHistory.at(-1) ?? {
                attacker: "적 전투원",
                action: "공격",
                amount: Math.round(result.amount),
                critical: result.crit,
              };
              setDefeatSummary({
                killer: lastHit.attacker,
                action: lastHit.action,
                amount: lastHit.amount,
                recent: [...heroDamageHistory],
              });
              if (defeatTimer !== null) window.clearTimeout(defeatTimer);
              defeatTimer = window.setTimeout(() => setOutcome("lose"), 5000);
              setMessage(
                campaignChapter === 3
                  ? "유승천이 먼저 기권했다 · 의견 조율 실패"
                  : `유승천 전투불능 · ${lastHit.attacker}의 ${lastHit.action} · ${lastHit.amount} 피해`,
              );
            }
          }
          else if (u.role === "minion") {
            u.minionVisual = "down";
            u.minionVisualUntil = performance.now() + 1800;
          }
          if (from !== u.team) {
            awardCredits(
              from,
              u.role === "hero"
                ? HERO_KILL_CREDITS
                : u.minionRole === "elite"
                  ? ELITE_KILL_CREDITS
                  : MINION_KILL_CREDITS,
            );
          }
          if (from === "blue" && u.team === "red") {
            gainHeroXp(
              u.role === "hero"
                ? 55
                : u.campaignThreat === "boss"
                  ? 90
                  : u.campaignThreat === "vanguard"
                    ? 40
                    : u.campaignThreat === "runner"
                      ? 30
                      : 22,
            );
          }
          void combatAudio.down(u.faction, u.role === "hero", soundProminence);
          setMessage(
            isCampaign && campaignChapter === 3
              ? `${u.name} 기권 · 대련 이탈`
              : `${u.name} 전투불능`,
          );
        }
        return result.amount;
      };
    const hurtTurret = (
        t: Turret,
        d: number,
        from?: Team,
        canCrit = true,
        chance = 0.06,
        mult = 1.5,
      ) => {
        if (from && t.team === from) return 0;
        if (isSecretTunnel && battlePhase === "prepare" && from && t.team !== from) return 0;
        if (from && !canEngageAt(from, t.x, t.y)) return 0;
        if (t.upgrade) {
          if (t.team === "blue") money += t.upgrade.cost;
          t.upgrade = undefined;
          setMessage("강화 취소 · 비용 전액 반환");
        }
        t.demolish = undefined;
        const def = BUILD_BY_ID[t.kind],
          result = combatDamage(
            d * (!isCampaign && activeMatchConfig?.kind === "computer" && from === "red"
              ? computerBalance.enemyDamage
              : 1),
            0,
            from ?? (t.team === "blue" ? "red" : "blue"),
            canCrit,
            chance,
            mult,
          );
        t.hp = Math.max(0, t.hp - result.amount);
        pushDamagePopup(
          t.x * S + S / 2,
          t.y * S - 8,
          result.amount,
          result.crit,
          t.team,
        );
        burst(
          t.x,
          t.y,
          def?.category === "blocker"
            ? "#b68558"
            : result.crit
              ? "#fff0a0"
              : "#f0b24d",
          result.crit ? 18 : 9,
        );
        void combatAudio.impact(
          "structure",
          result.crit,
          Math.max(.22, 1 - Math.hypot(t.x + .5 - hero.x, t.y + .5 - hero.y) / 14),
        );
        if (t.hp <= 0) {
          if (from && from !== t.team) {
            awardCredits(from, installationKillCredits(def?.cost ?? 0));
            if (from === "blue" && t.team === "red") gainHeroXp(45);
          }
          tone("blast");
          setMessage(
            t.team === "blue"
              ? `${def?.name ?? "설치물"} 파괴!`
              : `적 ${def?.name ?? "설치물"} 파괴!`,
          );
        }
        return result.amount;
      },
      activateTacticalSupport = (team: Team, role: TacticalRole, target?: { x: number; y: number }) => {
        if (isCampaign) return false;
        const now = performance.now(), faction = team === "blue" ? playerDef.faction : enemyFaction,
          definition = tacticalDefinition(faction, role), state = tacticalStates[team];
        if (now < state.cooldownUntil || !spendTeamCredits(team, definition.cost)) return false;
        if (role === "area") {
          if (!target || !openForTeam(target.x, target.y, team)) {
            awardCredits(team, definition.cost);
            return false;
          }
          tacticalAreas.push({
            team, faction, x: target.x, y: target.y, startedAt: now,
            nextAt: now + (definition.warningMs ?? 0),
            expiresAt: now + definition.durationMs,
            hits: 0,
          });
        } else if (role === "reinforce") {
          reinforcementFormation().forEach((minionRole, index) =>
            spawnQueue.push({
              team,
              role: minionRole,
              index: 100 + index,
              delay: index * 625,
              emergencyReinforcement: true,
            }),
          );
        } else {
          const until = now + definition.durationMs;
          if (role === "defense") {
            state.defenseUntil = until;
            for (const minion of units.filter((unit) => unit.alive && unit.role === "minion" && unit.team === team)) {
              const scale = minion.minionRole === "elite" ? ELITE_TACTICAL_EFFECT_SCALE : 1;
              if (faction === "bugborn") minion.tacticalShield = minion.maxHp * 0.25 * scale;
              if (faction === "ai") minion.tacticalBlocks = Math.max(1, Math.round(2 * scale));
            }
          } else if (role === "recovery") {
            state.recoveryUntil = until;
            state.recoveryNextAt = now + TACTICAL_RECOVERY_TICK_MS;
            for (const combatant of units.filter(
              (unit) => unit.alive && (unit.role === "hero" || unit.role === "minion") && unit.team === team,
            ))
              combatant.tacticalRecoveryUntil = until;
          } else state.offenseUntil = until;
        }
        state.cooldownUntil = now + TACTICAL_SHARED_COOLDOWN_MS;
        if (team === "blue") {
          tone(role === "area" ? "warning" : "build");
          setMessage(`${definition.name} 발동 · ${definition.description}`);
        }
        return true;
      },
      updateTacticalSupport = () => {
        const now = performance.now();
        for (const team of ["blue", "red"] as Team[]) {
          if (now >= tacticalStates[team].defenseUntil)
            for (const minion of units.filter((unit) => unit.role === "minion" && unit.team === team)) {
              minion.tacticalShield = 0;
              minion.tacticalBlocks = 0;
            }
          const state = tacticalStates[team];
          if (now <= state.recoveryUntil && now >= state.recoveryNextAt) {
            state.recoveryNextAt += TACTICAL_RECOVERY_TICK_MS;
            for (const combatant of units.filter(
              (unit) =>
                unit.alive &&
                (unit.role === "hero" || unit.role === "minion") &&
                unit.team === team &&
                now <= (unit.tacticalRecoveryUntil ?? 0),
            )) {
              const scale = combatant.role === "minion" && combatant.minionRole === "elite"
                  ? ELITE_RECOVERY_SCALE
                  : 1,
                amount = combatant.maxHp * TACTICAL_RECOVERY_FRACTION * scale,
                before = combatant.hp;
              combatant.hp = Math.min(combatant.maxHp, combatant.hp + amount);
              if (
                combatant.hp > before &&
                (combatant.role === "hero" || Math.round(now / TACTICAL_RECOVERY_TICK_MS + combatant.id) % 2 === 0)
              ) {
                const at = unitWorld(combatant);
                pushCombatPopup(
                  at.x,
                  at.y - (combatant.role === "hero" ? 46 : 28),
                  `+${Math.round(combatant.hp - before)}`,
                  "#72f4dc",
                  team,
                  false,
                  460,
                );
                if (combatant.role === "hero")
                  spawnField("repair", combatant.x, combatant.y, 1.1, 620, 0, "#72f4dc");
              }
            }
          }
          if (now > state.recoveryUntil)
            for (const combatant of units.filter(
              (unit) => (unit.role === "hero" || unit.role === "minion") && unit.team === team,
            ))
              combatant.tacticalRecoveryUntil = 0;
        }
        for (let index = tacticalAreas.length - 1; index >= 0; index--) {
          const event = tacticalAreas[index], definition = tacticalDefinition(event.faction, "area"),
            radius = definition.radius ?? 2;
          if (event.faction === "ai" && event.hits > 0) {
            if (now >= event.expiresAt) tacticalAreas.splice(index, 1);
            continue;
          }
          if (now < event.nextAt) continue;
          const damage = event.faction === "human" ? 32 : event.faction === "bugborn" ? 10 : 105,
            targets = units.filter((unit) =>
              unit.alive &&
              unit.team !== event.team &&
              canEngageAt(event.team, unit.x, unit.y) &&
              Math.hypot(unit.x - event.x, unit.y - event.y) <= radius,
            );
          for (const target of targets) {
            hurt(target, damage, event.team, false, 0, 1, false, { attacker: definition.name, action: "전술 타격" });
            if (event.faction === "bugborn") target.vulnerableUntil = now + 1500;
          }
          for (const installation of turrets)
            if (
              installation.hp > 0 &&
              installation.team !== event.team &&
              canEngageAt(event.team, installation.x, installation.y) &&
              Math.hypot(installation.x - event.x, installation.y - event.y) <= radius
            )
              hurtTurret(installation, damage, event.team, false, 0, 1);
          burst(event.x, event.y, definition.color, event.faction === "ai" ? 24 : 14);
          event.hits++;
          if (event.faction === "human" && event.hits < 3) event.nextAt = now + 350;
          else if (event.faction === "bugborn" && now + 1000 < event.expiresAt) event.nextAt = now + 1000;
          else if (event.faction === "ai") {
            event.impactAt = now;
            event.nextAt = Number.POSITIVE_INFINITY;
            event.expiresAt = now + 520;
          }
          else tacticalAreas.splice(index, 1);
        }
      },
      detonateGroundMine = (mine: GroundMine, triggeredByEnemy: boolean) => {
        const mineIndex = groundMines.indexOf(mine);
        if (mineIndex < 0) return;
        groundMines.splice(mineIndex, 1);
        const owner = units.find((unit) => unit.alive && unit.team === mine.team && unit.role === "hero");
        for (const target of units)
          if (
            target.alive &&
            target.team !== mine.team &&
            canEngageAt(mine.team, target.x, target.y) &&
            Math.hypot(target.x - mine.x, target.y - mine.y) <= 1.9
          ) {
            hurt(
              target,
              82,
              mine.team,
              false,
              0,
              1,
              false,
              owner
                ? { attacker: owner.name, action: "압력 지뢰", unit: owner }
                : undefined,
            );
            target.act = Math.max(target.act, 650);
          }
        for (const installation of turrets)
          if (
            installation.hp > 0 &&
            installation.team !== mine.team &&
            canEngageAt(mine.team, installation.x, installation.y) &&
            Math.hypot(installation.x - mine.x, installation.y - mine.y) <= 1.9
          )
            hurtTurret(installation, 70, mine.team, false);
        burst(mine.x, mine.y, "#ffb43b", 34);
        spawnField("lockdown", mine.x, mine.y, 1.9, 520, 0, "#ff9a43");
        tone("blast");
        if (mine.team === "blue")
          setMessage(triggeredByEnemy ? "압력 지뢰 접촉 폭발 · 광역 피해" : "압력 지뢰 3초 신관 폭발 · 광역 피해");
      },
      damageBase = (attacker: Team, d: number, source?: Unit) => {
        if (isSecretTunnel && battlePhase === "prepare") return;
        const computerAttackScale = !isCampaign && activeMatchConfig?.kind === "computer" && attacker === "red"
            ? computerBalance.enemyDamage
            : 1,
          adjustedDamage = d * computerAttackScale;
        const campaign1BossSiege = Boolean(
          isCampaign &&
            campaignChapter === 1 &&
            attacker === "red" &&
            source?.campaign1Boss,
        );
        if (isCampaign && attacker === "blue" && campaignChapter !== 4) {
          setMessage(campaignChapter === 1 ? "목표는 침입체 전멸이다" : "이번 작전의 목표는 적 거점 파괴가 아니다");
          return;
        }
        if (!campaign1BossSiege && !canDamageCore({
          role: source?.role,
          minionRole: source?.minionRole,
          isCampaign,
          campaignChapter,
        })) {
          setMessage("설치물은 코어를 파괴할 수 없다 · 진군대나 영웅을 진입시켜라");
          return;
        }
        let shield = attacker === "blue" ? enemyShield : allyShield;
        if (shield > 0) {
          if (!campaign1BossSiege && (!source || !canDamageShield({ role: source.role }))) {
            setMessage("생존 코어 방어막 · 진군대나 영웅으로 파쇄해야 함");
            return;
          }
          const shieldDamage = campaign1BossSiege
            ? Math.max(1, adjustedDamage * 0.65)
            : (source?.shieldDamage ?? Math.max(1, d * 0.2)) * computerAttackScale;
          const appliedShieldDamage = Math.min(shield, shieldDamage);
          if (attacker === "blue")
            enemyShield = Math.max(0, enemyShield - shieldDamage);
          else allyShield = Math.max(0, allyShield - shieldDamage);
          const targetBase = attacker === "blue" ? ENEMY : ALLY;
          pushDamagePopup(
            targetBase.x * S + S / 2,
            targetBase.y * S - 22,
            appliedShieldDamage,
            false,
            attacker === "blue" ? "red" : "blue",
            "방어막",
          );
          void combatAudio.impact("structure", false, .88);
          if (attacker === "blue")
            gainHeroXp(Math.max(1, Math.floor(shieldDamage * 0.2)));
          return;
        }
        const coreDamage = exposedCoreDamage(adjustedDamage, {
            role: source?.role,
            minionRole: source?.minionRole,
          }),
          targetBase = attacker === "blue" ? ENEMY : ALLY,
          targetHp = attacker === "blue" ? enemyHp : allyHp,
          appliedDamage = Math.min(targetHp, coreDamage);
        if (attacker === "blue") enemyHp = Math.max(0, enemyHp - coreDamage);
        else allyHp = Math.max(0, allyHp - coreDamage);
        pushDamagePopup(
          targetBase.x * S + S / 2,
          targetBase.y * S - 22,
          appliedDamage,
          false,
          attacker === "blue" ? "red" : "blue",
        );
        void combatAudio.impact("structure", false, .92);
        if (!ended && (enemyHp <= 0 || allyHp <= 0)) {
          ended = true;
          if (isSecretTunnel)
            setMessage(
              enemyHp <= 0
                ? "적 코어 파괴 · 비밀 굴착 작전 승리"
                : "아군 코어 파괴 · 비밀 굴착 작전 패배",
            );
          setOutcome(enemyHp <= 0 ? "win" : "lose");
        }
      };
    const cloneSecretTunnelTile = (
        tile: SecretTunnelTileOverlay,
      ): SecretTunnelTileOverlay => ({
        ...tile,
        durability: { ...tile.durability },
        maxDurability: { ...tile.maxDurability },
      }),
      publishOnlineDigPrediction = (
        x: number,
        y: number,
        sourceX: number,
        sourceY: number,
      ) => {
        if (
          activeMatchConfig?.kind !== "online" ||
          !onlineRoom ||
          !onlineIdentity ||
          onlineRoom.hostId === onlineIdentity.playerId
        ) return;
        const tile = grid[y]?.[x];
        if (!tile) return;
        const clientSequence = publishOnlineInput({ type: "dig", x, y, sourceX, sourceY });
        if (clientSequence === null) return;
        const tunnelTile = secretTunnelOverlay
          ? secretTunnelTileAt(secretTunnelOverlay, { x, y })
          : undefined;
        pendingOnlineDigPredictions.set(`${x},${y}`, {
          clientSequence,
          createdAt: performance.now(),
          gridTile: { ...tile },
          ...(tunnelTile ? { tunnelTile: cloneSecretTunnelTile(tunnelTile) } : {}),
        });
      };
    const breakTile = (u: Unit, x: number, y: number, power = 1) => {
        const t = grid[y]?.[x];
        if (!t || t.type === 4 || (!isSecretTunnel && t.type === 0)) return false;
        if (isSecretTunnel && secretTunnelOverlay) {
          if (battlePhase !== "prepare") {
            if (u === hero) setMessage("지반 고정 · 침공 중에는 더 파거나 메울 수 없다");
            return false;
          }
          const tunnelTile = secretTunnelTileAt(secretTunnelOverlay, { x, y }),
            rushPower = secretTunnelRushDigDamage(
              tunnelTile?.durability[u.team] ?? 0,
              power,
            ),
            result = digSecretTunnelTileAndShareContacts(
              secretTunnelOverlay,
              { x, y },
              u.team,
              rushPower,
            );
          secretTunnelOverlay = result.overlay;
          if (!result.didDamage) return false;
          const digMaterial = t.ore
              ? "ore"
              : t.type === 3
                ? "rock"
                : [8, 9, 10, 11].includes(t.type)
                  ? "metal"
                  : "earth",
            soundProminence = u === hero
              ? 1
              : Math.max(.2, 1 - Math.hypot(u.x - hero.x, u.y - hero.y) / 13);
          const locallyObservableDig = u.team === "blue" || result.becameShared;
          if (locallyObservableDig) {
            burst(
              x,
              y,
              result.becameShared ? "#ffe071" : t.type === 3 ? "#aaa293" : "#966846",
              result.becameShared ? 16 : 5,
            );
            if (u.team === "blue")
              void combatAudio.dig(digMaterial, result.opened, soundProminence);
          }
          if (result.opened) {
            const oreKey = `${u.team}:${x},${y}`;
            if (t.ore && !secretOreClaims.has(oreKey)) {
              secretOreClaims.add(oreKey);
              reward(t.ore, "광석 발견", u.team);
              if (u.team === "blue") gainHeroXp(8);
            }
            if (result.becameShared) {
              tone("warning");
              setMessage("공동 접촉 터널 개통 · 맞닿은 양 팀 터널 공동화 · 전투는 침공 때 시작");
            }
            const connections = evaluateSecretTunnelConnections(
              secretTunnelOverlay,
              { blue: ALLY, red: ENEMY },
            );
            const newlyConnected = !secretBlueConnected && connections.blue.valid;
            secretBlueConnected = connections.blue.valid;
            secretRedConnected = connections.red.valid;
            if (newlyConnected) {
              tone("victory");
              setMessage("유효 전선 연결 완료 · 남은 시간은 광석·우회로·방어에 투자");
            }
          }
          return true;
        }
        const digMaterial = t.ore
              ? "ore"
              : t.type === 3
                ? "rock"
                : [8, 9, 10, 11].includes(t.type)
                  ? "metal"
                  : "earth",
            soundProminence = u === hero
              ? 1
              : Math.max(.2, 1 - Math.hypot(u.x - hero.x, u.y - hero.y) / 13);
        t.hp -= power;
        burst(x, y, t.type === 3 ? "#aaa293" : "#966846", 5);
        void combatAudio.dig(digMaterial, t.hp <= 0, soundProminence);
        if (t.hp <= 0) {
          const ore = t.ore;
          t.type = 0;
          t.hp = 0;
          t.max = 0;
          delete t.ore;
          if (ore) {
            reward(ore, "광석 발견", u.team);
            if (u.team === "blue") gainHeroXp(8);
          }
          recordTerrainChange(x, y);
          return true;
        }
        recordTerrainChange(x, y);
        return false;
      },
      moveOrDig = (u: Unit, dx: number, dy: number, duration = unitMovementDuration(280)) => {
        if (!u.alive) return false;
        u.dir = { x: dx, y: dy };
        if (u === hero) heroMoveUntil = performance.now() + unitMovementDuration(220);
        const x = u.x + dx,
          y = u.y + dy,
          t = grid[y]?.[x];
        if (
          !t ||
          t.type === 4 ||
          occupied(x, y, u) ||
          turretAt(x, y, u.team) ||
          baseAt(x, y)
        )
          return false;
        if (!openForTeam(x, y, u.team)) {
          if (u.role !== "hero" || !breakTile(u, x, y)) return false;
          if (
            isSecretTunnel &&
            battlePhase === "prepare" &&
            openForTeam(x, y, u.team) &&
            !occupied(x, y, u) &&
            !turretAt(x, y, u.team) &&
            !baseAt(x, y)
          ) commitGridMove(u, x, y, Math.min(duration, unitMovementDuration(secretTunnelPrepareDuration(95))));
          return true;
        }
        commitGridMove(
          u,
          x,
          y,
          isSecretTunnel && battlePhase === "prepare"
            ? Math.min(duration, unitMovementDuration(secretTunnelPrepareDuration(95)))
            : duration,
        );
        return true;
      },
      cardinal = (dx: number, dy: number) =>
        Math.abs(dx) >= Math.abs(dy)
          ? { x: Math.sign(dx) || 1, y: 0 }
          : { x: 0, y: Math.sign(dy) || 1 },
      unitVector = (dx: number, dy: number) => {
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
      },
      gridStep = (dx: number, dy: number) => ({
        x: Math.sign(dx),
        y: Math.sign(dy),
      }),
      directionRow = (d: { x: number; y: number }) =>
        Math.abs(d.y) >= Math.abs(d.x) ? (d.y > 0 ? 0 : 3) : d.x < 0 ? 1 : 2,
      heroFxPos = () => ({
        x: heroWorld.x / S - 0.5,
        y: heroWorld.y / S - 0.5,
      });
    const applyHeroDrillPattern = (
      attacker: Unit,
      direction: { x: number; y: number },
      drillWidthBonus = 0,
    ) => {
      const spec = heroKit(attacker.heroId ?? "yoo-seungcheon").drill,
        bonus = drillWidthBonus > 0 ? 1 : 0,
        drillWidth = spec.width + bonus,
        drillLength = expandedDrillReach(spec.length),
        radialRadius = expandedDrillReach(1 + bonus),
        d = gridStep(direction.x, direction.y),
        safeDirection = d.x || d.y ? d : { x: 1, y: 0 },
        side = { x: -safeDirection.y, y: safeDirection.x },
        dig = (x: number, y: number) => {
          if (grid[y]?.[x]?.type !== 4) breakTile(attacker, x, y, 99);
        };
      if (spec.mode === "sealRing" && !isSecretTunnel) {
        for (const offset of radialDrillOffsets(radialRadius)) {
          if (Math.max(Math.abs(offset.x), Math.abs(offset.y)) !== radialRadius) continue;
          const x = attacker.x + offset.x,
            y = attacker.y + offset.y;
          if (
            openForTeam(x, y, attacker.team) &&
            !occupied(x, y, attacker) &&
            !turretAt(x, y, attacker.team) &&
            !baseAt(x, y)
          ) {
            grid[y][x] = {
              type: 5,
              hp: 3,
              max: 3,
              freshUntil: performance.now() + 1500,
              filledBy: attacker.team,
            };
            recordTerrainChange(x, y);
          }
        }
      } else if (spec.mode === "radial" || spec.mode === "sealRing") {
        for (const offset of radialDrillOffsets(radialRadius))
          dig(attacker.x + offset.x, attacker.y + offset.y);
      } else if (spec.mode === "sonicCross") {
        for (const axis of DIRS)
          for (let n = 1; n <= drillLength; n++)
            dig(attacker.x + axis.x * n, attacker.y + axis.y * n);
      } else if (spec.mode === "pipeFork") {
        for (let n = 1; n <= drillLength; n++) {
          dig(attacker.x + safeDirection.x * n, attacker.y + safeDirection.y * n);
          if (n > 2) {
            dig(attacker.x + safeDirection.x * n + side.x * (n - 2), attacker.y + safeDirection.y * n + side.y * (n - 2));
            dig(attacker.x + safeDirection.x * n - side.x * (n - 2), attacker.y + safeDirection.y * n - side.y * (n - 2));
          }
        }
      } else if (spec.mode === "blueprint") {
        for (let n = 1; n <= drillLength; n++) {
          dig(attacker.x + safeDirection.x * n + side.x * drillWidth, attacker.y + safeDirection.y * n + side.y * drillWidth);
          dig(attacker.x + safeDirection.x * n - side.x * drillWidth, attacker.y + safeDirection.y * n - side.y * drillWidth);
        }
        for (let width = -drillWidth; width <= drillWidth; width++)
          dig(attacker.x + safeDirection.x * drillLength + side.x * width, attacker.y + safeDirection.y * drillLength + side.y * width);
      } else if (spec.mode === "sawLine") {
        let lastX = attacker.x, lastY = attacker.y;
        for (let n = 1; n <= drillLength; n++) {
          const offset = n % 2 ? 1 : -1,
            x = attacker.x + safeDirection.x * n + side.x * offset,
            y = attacker.y + safeDirection.y * n + side.y * offset;
          dig(attacker.x + safeDirection.x * n, attacker.y + safeDirection.y * n);
          dig(x, y);
          if (Math.abs(x - lastX) + Math.abs(y - lastY) > 1)
            dig(
              attacker.x + safeDirection.x * n + side.x * (n % 2 ? 0 : -1),
              attacker.y + safeDirection.y * n + side.y * (n % 2 ? 0 : -1),
            );
          lastX = x;
          lastY = y;
        }
      } else {
        for (let n = 1; n <= drillLength; n++)
          for (let width = -drillWidth; width <= drillWidth; width++)
            dig(attacker.x + safeDirection.x * n + side.x * width, attacker.y + safeDirection.y * n + side.y * width);
      }
    };
    const heroTerrainClear = (px: number, py: number) => {
      const radius = 8;
      for (const ox of [-radius, radius])
        for (const oy of [-radius, radius]) {
          const tx = Math.floor((px + ox) / S),
            ty = Math.floor((py + oy) / S);
          if (!openForTeam(tx, ty, "blue")) return false;
        }
      return true;
    };
    const heroWorldClear = (px: number, py: number) => {
      if (!heroTerrainClear(px, py)) return false;
      for (const u of units)
        if (u !== hero && u.alive) {
          if (isSecretTunnel && battlePhase === "prepare" && u.team !== hero.team) continue;
          const p = unitWorld(u);
          if (Math.hypot(p.x - px, p.y - py) < 20) return false;
        }
      for (const t of turrets)
        if (
          t.hp > 0 &&
          !(isSecretTunnel && battlePhase === "prepare" && t.team !== hero.team) &&
          Math.hypot(t.x * S + S / 2 - px, t.y * S + S / 2 - py) < 22
        )
          return false;
      for (const b of [ALLY, ENEMY])
        if (Math.hypot(b.x * S + S / 2 - px, b.y * S + S / 2 - py) < 22)
          return false;
      return true;
    };
    const commitHeroMove = (px: number, py: number) => {
      const vx = px - heroWorld.x,
        vy = py - heroWorld.y;
      if (!vx && !vy) return false;
      hero.dir = unitVector(vx, vy);
      heroWorld.x = px;
      heroWorld.y = py;
      hero.x = Math.max(1, Math.min(COLS - 2, Math.floor(heroWorld.x / S)));
      hero.y = Math.max(1, Math.min(ROWS - 2, Math.floor(heroWorld.y / S)));
      heroMoveUntil = performance.now() + 180;
      return true;
    };
    function recoverEmbeddedHero() {
      if (!hero.alive || heroTerrainClear(heroWorld.x, heroWorld.y))
        return false;
      let safe: { x: number; y: number; distance: number } | null = null;
      for (let radius = 0; radius <= 4 && !safe; radius++)
        for (let oy = -radius; oy <= radius; oy++)
          for (let ox = -radius; ox <= radius; ox++) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
            const tx = hero.x + ox,
              ty = hero.y + oy,
              px = tx * S + S / 2,
              py = ty * S + S / 2;
            if (heroWorldClear(px, py)) {
              const distance = Math.hypot(px - heroWorld.x, py - heroWorld.y);
              if (!safe || distance < safe.distance)
                safe = { x: px, y: py, distance };
            }
          }
      if (!safe) return false;
      commitHeroMove(safe.x, safe.y);
      moveTarget = null;
      attackTarget = null;
      hero.act = Math.max(hero.act, 180);
      burst(hero.x, hero.y, "#d7fbff", 18);
      setMessage("벽 끼임 자동 복구 · 가까운 안전 지점으로 이동");
      return true;
    }
    const adjacentDrillTile = (tx: number, ty: number) => {
      const tile = grid[ty]?.[tx];
      return (
        !!tile &&
        Math.max(Math.abs(tx - hero.x), Math.abs(ty - hero.y)) === 1 &&
        !openForTeam(tx, ty, "blue") &&
        tile.type !== 4
      );
    };
    const drillBlockedTile = (
      blocked: { x: number; y: number },
      d: { x: number; y: number },
    ) => {
      hero.dir = d;
      const beforeTile = grid[blocked.y]?.[blocked.x],
        beforeType = beforeTile?.type,
        beforeHp = beforeTile?.hp,
        beforeTunnel = secretTunnelOverlay
          ? secretTunnelTileAt(secretTunnelOverlay, blocked)
          : undefined,
        beforeTunnelDurability = beforeTunnel?.durability.blue,
        beforeTunnelAccess = beforeTunnel?.access;
      breakTile(hero, blocked.x, blocked.y, playerDef.stats.digPower);
      const afterTile = grid[blocked.y]?.[blocked.x],
        afterTunnel = secretTunnelOverlay
          ? secretTunnelTileAt(secretTunnelOverlay, blocked)
          : undefined;
      if (
        afterTile &&
        (
          afterTile.type !== beforeType ||
          afterTile.hp !== beforeHp ||
          afterTunnel?.durability.blue !== beforeTunnelDurability ||
          afterTunnel?.access !== beforeTunnelAccess
        )
      ) publishOnlineDigPrediction(blocked.x, blocked.y, hero.x, hero.y);
      hero.act = isSecretTunnel && battlePhase === "prepare"
        ? secretTunnelPrepareDuration(135)
        : 135;
      heroMoveUntil = performance.now() + (
        isSecretTunnel && battlePhase === "prepare"
          ? secretTunnelPrepareDuration(220)
          : 220
      );
      return false;
    };
    const directDrillTarget = (d: { x: number; y: number }) => {
      for (let dist = 9; dist <= S * 0.9; dist += 3) {
        const tx = Math.floor((heroWorld.x + d.x * dist) / S),
          ty = Math.floor((heroWorld.y + d.y * dist) / S);
        if (adjacentDrillTile(tx, ty)) return { x: tx, y: ty, distance: dist };
      }
      return null;
    };
    const moveHeroStep = (dx: number, dy: number, dt: number) => {
      const d = unitVector(dx, dy);
      if (!dx && !dy) return false;
      const speedBoost = performance.now() < hasteUntil ? 1.55 : 1,
        preparationSpeed = isSecretTunnel && battlePhase === "prepare"
          ? SECRET_TUNNEL_PREPARE_SPEED_MULTIPLIER
          : 1,
        terrainFactor = terrainMoveFactor(hero.x, hero.y),
        advance = ((unitMovementSpeed(playerDef.stats.moveSpeed) * speedBoost * preparationSpeed * terrainFactor * S) / 1000) * dt,
        px = heroWorld.x + d.x * advance,
        py = heroWorld.y + d.y * advance;
      if (heroWorldClear(px, py)) return commitHeroMove(px, py);
      const directDrill = directDrillTarget(d);
      if (directDrill) return drillBlockedTile(directDrill, d);
      const slides = [
        { x: px, y: heroWorld.y, progress: Math.abs(d.x) },
        { x: heroWorld.x, y: py, progress: Math.abs(d.y) },
      ]
        .filter((p) => p.progress > 0.01 && heroWorldClear(p.x, p.y))
        .sort((a, b) => b.progress - a.progress);
      if (slides[0]) return commitHeroMove(slides[0].x, slides[0].y);
      const side = { x: -d.y, y: d.x };
      let blocked: { x: number; y: number; distance: number } | null = null;
      for (const offset of [-8, 0, 8])
        for (let dist = 9; dist <= S * 0.9; dist += 3) {
          const tx = Math.floor(
              (heroWorld.x + d.x * dist + side.x * offset) / S,
            ),
            ty = Math.floor((heroWorld.y + d.y * dist + side.y * offset) / S);
          if (
            adjacentDrillTile(tx, ty) &&
            (!blocked || dist < blocked.distance)
          )
            blocked = { x: tx, y: ty, distance: dist };
        }
      if (blocked) return drillBlockedTile(blocked, d);
      return false;
    };
    const settleHeroAtPointer = (
      target: { x: number; y: number; wx: number; wy: number },
      dt: number,
    ) => {
      const tx = Math.max(
          target.x * S + 9,
          Math.min((target.x + 1) * S - 9, target.wx),
        ),
        ty = Math.max(
          target.y * S + 9,
          Math.min((target.y + 1) * S - 9, target.wy),
        ),
        vx = tx - heroWorld.x,
        vy = ty - heroWorld.y,
        dist = Math.hypot(vx, vy);
      if (dist < 1.5) return true;
      const speedBoost = performance.now() < hasteUntil ? 1.55 : 1,
        terrainFactor = terrainMoveFactor(hero.x, hero.y),
        advance = Math.min(
          dist,
          ((unitMovementSpeed(hero.moveSpeed) * speedBoost * terrainFactor * S) / 1000) * dt,
        ),
        px = heroWorld.x + (vx / dist) * advance,
        py = heroWorld.y + (vy / dist) * advance;
      if (!heroWorldClear(px, py)) return true;
      commitHeroMove(px, py);
      return dist <= advance + 1.5;
    };
    const openRayReach = (d: { x: number; y: number }, rangeTiles: number) => {
        if (aimingSkill === 3) return rangeTiles * S;
        let reach = rangeTiles * S;
        for (let dist = 6; dist <= reach; dist += 6) {
          const tx = Math.floor((heroWorld.x + d.x * dist) / S),
            ty = Math.floor((heroWorld.y + d.y * dist) / S);
          if (
            isSecretTunnel
              ? !openForTeam(tx, ty, "blue")
              : grid[ty]?.[tx]?.type !== 0
          ) {
            reach = Math.max(0, dist - 6);
            break;
          }
        }
        return reach;
      };
    const melee = (
      u: Unit,
      dir: { x: number; y: number },
      bonus = 0,
      variant?: string,
      stun = 0,
    ) => {
      if (!u.alive || u.act > 0) return;
      const facing = unitVector(dir.x, dir.y);
      u.dir = facing;
      meleeHits.push({
        attacker: u,
        dir: facing,
        bonus,
        delay: u === hero ? 210 : 260,
        variant,
        stun,
      });
      if (u === hero) {
        tone("swing");
        playHeroAnim("basic", 520);
        slashes.push({
          ...heroFxPos(),
          dir: facing,
          life: 360,
          maxLife: 360,
          kind: variant === "toySword" ? "toy" : "signature",
          variant,
          color: kit.color,
          radius: 1,
        });
      } else if (u.role === "hero") {
        u.arenaActionStartedAt = performance.now();
        u.arenaActionDuration = 520;
        u.arenaActionSlot = 0;
        u.arenaActionUntil = u.arenaActionStartedAt + u.arenaActionDuration;
      } else {
        u.minionVisual = "attack";
        u.minionVisualUntil =
          performance.now() + Math.max(420, u.attackInterval * 1000);
      }
      u.act = u.role === "hero" ? 520 : 650;
    };
    const resolveMelee = (hit: PendingMelee) => {
      const u = hit.attacker;
      if (!u.alive) return;
      const origin = unitWorld(u),
        range = u === hero
          ? Math.max(1.5, playerDef.stats.range) * S
          : (hit.variant === "coreSiege" ? Math.max(1.5, combatRangeFor(u)) : 1.5) * S,
        candidates = units
          .filter((v) =>
            v.alive &&
            v.networkVisible !== false &&
            v.campaignActivated !== false &&
            v.team !== u.team &&
            canEngageAt(u.team, v.x, v.y),
          )
          .map((v) => {
            const p = unitWorld(v),
              dx = p.x - origin.x,
              dy = p.y - origin.y,
              dist = Math.hypot(dx, dy),
              facing = dist
                ? (dx / dist) * hit.dir.x + (dy / dist) * hit.dir.y
                : 1;
            return { unit: v, dist, facing };
          })
          .filter((v) => v.dist <= range && v.facing >= 0.35)
          .sort((a, b) => a.dist - b.dist);
      if (hit.variant === "coreSiege") {
        const siegeCore = u.team === "blue" ? ENEMY : ALLY,
          dx = siegeCore.x * S + S / 2 - origin.x,
          dy = siegeCore.y * S + S / 2 - origin.y,
          dist = Math.hypot(dx, dy),
          facing = dist ? (dx / dist) * hit.dir.x + (dy / dist) * hit.dir.y : 1;
        if (dist <= range && facing >= 0.25) {
          damageBase(u.team, u.attack + hit.bonus, u);
          burst(siegeCore.x, siegeCore.y, u.team === "blue" ? "#69e7ef" : "#ff755f", 14);
          return;
        }
      }
      const target = candidates[0]?.unit;
      if (target) {
        const dealt = hurt(
          target,
          u.attack + hit.bonus,
          u.team,
          true,
          u.critChance,
          u.critMultiplier,
          false,
          { attacker: u.name, action: u.role === "hero" ? "기본 공격" : "일반 공격", unit: u },
        );
        if (hit.variant === "microwaveBash")
          target.act = Math.max(target.act, 360);
        if (hit.variant === "baton") target.act = Math.max(target.act, 520);
        if (hit.stun) target.act = Math.max(target.act, hit.stun);
        if (hit.variant === "mandible")
          hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(3, dealt * 0.28));
        if (hit.variant === "shieldBash") {
          const nx = target.x + Math.sign(target.x - u.x),
            ny = target.y + Math.sign(target.y - u.y);
          if (
            openForTeam(nx, ny, target.team) &&
            !occupied(nx, ny, target) &&
            !turretAt(nx, ny, target.team) &&
            !baseAt(nx, ny)
          ) {
            target.x = nx;
            target.y = ny;
          }
        }
        burst(
          target.x,
          target.y,
          u === hero ? kit.accent : "#e7c45f",
          u === hero ? 12 : 7,
        );
        return;
      }
      for (const t of turrets)
        if (t.hp > 0 && t.team !== u.team && canEngageAt(u.team, t.x, t.y)) {
          const dx = t.x * S + S / 2 - origin.x,
            dy = t.y * S + S / 2 - origin.y,
            dist = Math.hypot(dx, dy),
            facing = dist
              ? (dx / dist) * hit.dir.x + (dy / dist) * hit.dir.y
              : 1;
          if (dist <= range && facing >= 0.35) {
            hurtTurret(
              t,
              (u.attack + hit.bonus) *
                (hit.variant === "drillPunch" ? 1.65 : 1),
              u.team,
              true,
              u.critChance,
              u.critMultiplier,
            );
            return;
          }
        }
      const enemyBase = u.team === "blue" ? ENEMY : ALLY,
        dx = enemyBase.x * S + S / 2 - origin.x,
        dy = enemyBase.y * S + S / 2 - origin.y,
        dist = Math.hypot(dx, dy),
        facing = dist ? (dx / dist) * hit.dir.x + (dy / dist) * hit.dir.y : 1;
      if (dist <= range && facing >= 0.35 && canEngageAt(u.team, enemyBase.x, enemyBase.y))
        damageBase(u.team, u.attack + hit.bonus, u);
    };
    const updateMeleeHits = (dt: number) => {
      for (const hit of meleeHits) hit.delay -= dt;
      for (let i = meleeHits.length - 1; i >= 0; i--)
        if (meleeHits[i].delay <= 0) {
          resolveMelee(meleeHits[i]);
          meleeHits.splice(i, 1);
        }
    };
    const fire = (
        u: Unit,
        dx: number,
        dy: number,
        kind: Shot["kind"] = "arrow",
        damage?: number,
        opts: Partial<Pick<Shot, "splash" | "pierce" | "stun">> = {},
      ) => {
        if (!u.alive || u.shot > 0) return;
        const len = Math.hypot(dx, dy) || 1,
          start = unitWorld(u),
          speed = kind === "turret" || kind === "minion" ? 7 : 9;
        shots.push({
          x: start.x,
          y: start.y,
          vx: (dx / len) * speed,
          vy: (dy / len) * speed,
          team: u.team,
          damage:
            damage ??
            (kind === "blast"
              ? 40
              : kind === "turret"
                ? 13
                : kind === "minion"
                  ? u.attack
                  : 18),
          life: kind === "blast" ? 1250 : 1500,
          kind,
          critChance: u.critChance,
          critMultiplier: u.critMultiplier,
          ...opts,
          source: u,
        });
        u.shot =
          kind === "blast"
            ? 900
            : kind === "minion"
              ? u.attackInterval * 1000
              : 620;
        if (u.role === "minion") {
          u.minionVisual = "attack";
          u.minionVisualUntil =
            performance.now() + Math.max(420, u.attackInterval * 1000);
        } else if (u.role === "hero" && u !== hero) {
          u.arenaActionStartedAt = performance.now();
          u.arenaActionDuration = 520;
          u.arenaActionSlot = 0;
          u.arenaActionUntil = u.arenaActionStartedAt + u.arenaActionDuration;
        }
        tone("shot");
      },
      explode = (s: Shot, tx: number, ty: number) => {
        tone("blast");
        burst(tx, ty, "#ffb43b", 22);
        const radius = s.splash ?? 1.7,
          cx = tx * S + S / 2,
          cy = ty * S + S / 2;
        for (const u of units)
          if (u.alive && u.team !== s.team) {
            const p = unitWorld(u);
            if (
              Math.hypot(p.x - cx, p.y - cy) <= radius * S &&
              clearRay(tx, ty, u.x, u.y, s.team)
            ) {
              hurt(
                u,
                s.damage,
                s.team,
                false,
                0,
                1,
                false,
                s.source
                  ? { attacker: s.source.name, action: "범위 공격", unit: s.source }
                  : s.sourceInstallation
                    ? {
                        attacker: buildDef(s.sourceInstallation.kind).name,
                        action: "설치물 범위 공격",
                        installation: s.sourceInstallation,
                      }
                    : undefined,
              );
              if (s.stun) u.act = Math.max(u.act, s.stun);
            }
          }
        for (const t of turrets)
          if (
            t.hp > 0 &&
            t.team !== s.team &&
            Math.hypot(t.x - tx, t.y - ty) <= radius &&
            clearRay(tx, ty, t.x, t.y, s.team)
          )
            hurtTurret(t, s.damage, s.team, false);
        if (s.kind === "spore" && s.sourceInstallation) {
          const control = buildDef(s.sourceInstallation.kind)?.control;
          if (control?.kind === "acid") {
            const life = control.fieldDurationMs ?? 2200;
            fields.push({
              kind: "acid",
              x: tx,
              y: ty,
              radius: control.splash ?? radius,
              life,
              maxLife: life,
              tick: 0,
              damage: control.fieldDamage ?? 2,
              color: "#b8ed36",
              hitIds: [],
              team: s.team,
              sourceInstallation: s.sourceInstallation,
            });
          }
        }
      };
    const heroDamageSource = (action = "기술") => ({ attacker: hero.name, action, unit: hero }),
      enemyActors = () => units.filter((u) => u.alive && u.networkVisible !== false && u.team === "red"),
      healArea = (radius: number, amount: number) => {
        amount *= talentBonuses().healMultiplier;
        hero.hp = Math.min(hero.maxHp, hero.hp + amount);
        for (const u of units)
          if (
            u.alive &&
            u.team === "blue" &&
            Math.hypot(u.x - hero.x, u.y - hero.y) <= radius
          )
            u.hp = Math.min(u.maxHp, u.hp + amount);
      },
      areaDamage = (radius: number, damage: number, stun = 0) => {
        for (const u of enemyActors())
          if (
            Math.hypot(u.x - hero.x, u.y - hero.y) <= radius &&
            clearRay(hero.x, hero.y, u.x, u.y)
          ) {
            hurt(
              u,
              damage,
              "blue",
              true,
              hero.critChance,
              hero.critMultiplier,
              false,
              heroDamageSource("범위 기술"),
            );
            if (stun) u.act = Math.max(u.act, stun);
          }
        for (const t of turrets)
          if (
            t.hp > 0 &&
            t.team === "red" &&
            Math.hypot(t.x - hero.x, t.y - hero.y) <= radius &&
            clearRay(hero.x, hero.y, t.x, t.y)
          )
            hurtTurret(
              t,
              damage,
              "blue",
              true,
              hero.critChance,
              hero.critMultiplier,
            );
      },
      coneDamage = (
        dir: { x: number; y: number },
        range: number,
        damage: number,
        half = 0.45,
        stun = 0,
        push = 0,
      ) => {
        if (isSecretTunnel && battlePhase === "prepare") return;
        for (const u of enemyActors()) {
          const dx = u.x - hero.x,
            dy = u.y - hero.y,
            dist = Math.hypot(dx, dy),
            facing = dist ? (dx / dist) * dir.x + (dy / dist) * dir.y : 1;
          if (
            dist <= range &&
            facing >= half &&
            clearRay(hero.x, hero.y, u.x, u.y)
          ) {
            hurt(
              u,
              damage,
              "blue",
              true,
              hero.critChance,
              hero.critMultiplier,
              false,
              heroDamageSource("부채꼴 기술"),
            );
            if (stun) u.act = Math.max(u.act, stun);
            if (push) {
              const nx = Math.max(1, Math.min(COLS - 2, u.x + Math.sign(dx))),
                ny = Math.max(1, Math.min(ROWS - 2, u.y + Math.sign(dy)));
              if (
                openForTeam(nx, ny, u.team) &&
                !occupied(nx, ny, u) &&
                !turretAt(nx, ny, u.team) &&
                !baseAt(nx, ny)
              ) {
                u.x = nx;
                u.y = ny;
              }
            }
          }
        }
        for (const t of turrets)
          if (t.hp > 0 && t.team === "red") {
            const dx = t.x - hero.x,
              dy = t.y - hero.y,
              dist = Math.hypot(dx, dy),
              facing = dist ? (dx / dist) * dir.x + (dy / dist) * dir.y : 1;
            if (
              dist <= range &&
              facing >= half &&
              clearRay(hero.x, hero.y, t.x, t.y)
            )
              hurtTurret(
                t,
                damage,
                "blue",
                true,
                hero.critChance,
                hero.critMultiplier,
              );
          }
      },
      skillShot = (
        dir: { x: number; y: number },
        kind: Shot["kind"],
        damage: number,
        opts: Partial<Pick<Shot, "splash" | "stun" | "pierce">> = {},
      ) => {
        const start = unitWorld(hero),
          speed = kind === "laser" ? 15 : kind === "disc" ? 10 : 9;
        shots.push({
          x: start.x,
          y: start.y,
          vx: dir.x * speed,
          vy: dir.y * speed,
          team: "blue",
          damage,
          life: 1500,
          kind,
          critChance: hero.critChance,
          critMultiplier: hero.critMultiplier,
          hitIds: [],
          source: hero,
          ...opts,
        });
        hero.shot = 520;
        tone(kind === "acid" || kind === "disc" ? "blast" : "shot");
      },
      signatureFx = (
        variant: string,
        dir = hero.dir,
        radius = kit.skill1.radius,
        duration = 720,
      ) =>
        slashes.push({
          ...heroFxPos(),
          dir: { ...dir },
          life: duration,
          maxLife: duration,
          kind: "signature",
          variant,
          color: kit.color,
          radius,
        });
    const spawnField = (
        kind: FieldFx["kind"],
        x: number,
        y: number,
        radius: number,
        life: number,
        damage: number,
        color = kit.color,
      ) => {
        const bonuses = talentBonuses(),
          enhancedRadius = radius * bonuses.fieldRadiusMultiplier,
          enhancedLife = life * bonuses.fieldDurationMultiplier;
        fields.push({
          kind,
          x,
          y,
          radius: enhancedRadius,
          life: enhancedLife,
          maxLife: enhancedLife,
          tick: 0,
          damage,
          color,
          hitIds: [],
        });
      },
      repairStructures = (radius: number, amount: number) => {
        for (const t of turrets)
          if (
            t.hp > 0 &&
            t.team === "blue" &&
            Math.hypot(t.x - hero.x, t.y - hero.y) <= radius
          )
            t.hp = Math.min(t.maxHp, t.hp + amount);
      },
      repairAt = (x: number, y: number, amount: number) => {
        for (const u of units)
          if (u.alive && u.team === "blue" && Math.hypot(u.x - x, u.y - y) <= 2)
            u.hp = Math.min(u.maxHp, u.hp + amount);
        for (const t of turrets)
          if (
            t.hp > 0 &&
            t.team === "blue" &&
            Math.hypot(t.x - x, t.y - y) <= 2
          )
            t.hp = Math.min(t.maxHp, t.hp + amount);
      },
      updateFields = (dt: number) => {
        for (const f of fields) {
          f.life -= dt;
          if (f.kind === "reject") {
            const d = f.dir ?? { x: 1, y: 0 },
              speed = f.speed ?? 2,
              nx = f.x + (d.x * speed * dt) / 1000,
              ny = f.y + (d.y * speed * dt) / 1000,
              tileX = Math.floor(nx),
              tileY = Math.floor(ny),
              passable = isSecretTunnel
                ? openForTeam(tileX, tileY, f.team ?? "blue")
                : grid[tileY]?.[tileX]?.type === 0;
            if (!passable) {
              f.life = 0;
              continue;
            }
            f.x = nx;
            f.y = ny;
            for (const s of shots)
              if (s.team === "red") {
                const sx = s.x / S - 0.5,
                  sy = s.y / S - 0.5,
                  rx = sx - f.x,
                  ry = sy - f.y,
                  along = rx * d.x + ry * d.y,
                  side = Math.abs(rx * d.y - ry * d.x);
                if (!canEngageAt(f.team ?? "blue", Math.floor(sx), Math.floor(sy))) continue;
                if (Math.abs(along) < 0.65 && side < f.radius) {
                  s.team = "blue";
                  s.vx *= -1;
                  s.vy *= -1;
                  s.damage *= 0.7;
                  s.hitIds = [];
                  burst(Math.floor(sx), Math.floor(sy), kit.accent, 10);
                }
              }
            f.tick -= dt;
            if (f.tick <= 0) {
              f.tick = 180;
              for (const u of enemyActors()) {
                if (!canEngageAt(f.team ?? "blue", u.x, u.y)) continue;
                const rx = u.x - f.x,
                  ry = u.y - f.y,
                  along = rx * d.x + ry * d.y,
                  side = Math.abs(rx * d.y - ry * d.x);
                if (Math.abs(along) > 0.8 || side > f.radius) continue;
                if (!f.hitIds.includes(u.id)) {
                  hurt(u, f.damage, "blue", false, 0, 1, false, heroDamageSource("지속 기술"));
                  f.hitIds.push(u.id);
                }
                const ux = u.x + Math.sign(d.x),
                  uy = u.y + Math.sign(d.y);
                if (
                  openForTeam(ux, uy, u.team) &&
                  !occupied(ux, uy, u) &&
                  !turretAt(ux, uy, u.team) &&
                  !baseAt(ux, uy)
                ) {
                  u.x = ux;
                  u.y = uy;
                }
                u.act = Math.max(u.act, 260);
              }
            }
            continue;
          }
          f.tick -= dt;
          if (f.tick > 0) continue;
          f.tick = f.kind === "web" ? 300 : 500;
          if (f.kind === "repair") {
            hero.hp = Math.min(hero.maxHp, hero.hp + f.damage);
            for (const u of units)
              if (
                u.alive &&
                u.team === "blue" &&
                Math.hypot(u.x - f.x, u.y - f.y) <= f.radius
              )
                u.hp = Math.min(u.maxHp, u.hp + f.damage);
            for (const t of turrets)
              if (
                t.hp > 0 &&
                t.team === "blue" &&
                Math.hypot(t.x - f.x, t.y - f.y) <= f.radius
              )
                t.hp = Math.min(t.maxHp, t.hp + f.damage);
            continue;
          }
          const fieldTeam = f.team ?? "blue",
            fieldDamageSource = (action: string) => f.sourceInstallation
              ? {
                  attacker: buildDef(f.sourceInstallation.kind).name,
                  action,
                  installation: f.sourceInstallation,
                }
              : heroDamageSource(action);
          for (const u of units.filter((unit) =>
            unit.alive && unit.team !== fieldTeam && canEngageAt(fieldTeam, unit.x, unit.y),
          ))
            if (Math.hypot(u.x - f.x, u.y - f.y) <= f.radius) {
              if (f.kind === "web") {
                u.act = Math.max(u.act, 460);
                if (!f.hitIds.includes(u.id)) {
                  hurt(u, f.damage, fieldTeam, false, 0, 1, false, fieldDamageSource("거미줄 덫"));
                  f.hitIds.push(u.id);
                }
              } else if (f.kind === "lockdown") {
                u.act = Math.max(u.act, 620);
                if (!f.hitIds.includes(u.id)) {
                  hurt(u, f.damage, fieldTeam, false, 0, 1, false, fieldDamageSource("봉쇄장"));
                  f.hitIds.push(u.id);
                }
              } else if (f.kind === "molt") {
                if (!f.hitIds.includes(u.id)) {
                  hurt(
                    u,
                    f.damage,
                    fieldTeam,
                    true,
                    hero.critChance,
                    hero.critMultiplier,
                    false,
                    fieldDamageSource("탈피 돌진"),
                  );
                  u.act = Math.max(u.act, 850);
                  f.hitIds.push(u.id);
                }
              } else {
                hurt(u, f.damage, fieldTeam, false, 0, 1, false, fieldDamageSource(f.sourceInstallation ? "산성 지대" : "지속 기술"));
                if (f.kind === "acid")
                  u.vulnerableUntil = Math.max(
                    u.vulnerableUntil ?? 0,
                    performance.now() + 1600,
                  );
                else u.act = Math.max(u.act, 300);
              }
            }
        }
        for (let i = fields.length - 1; i >= 0; i--)
          if (fields[i].life <= 0) fields.splice(i, 1);
      };
    const whirlwind = () => {
      if (cd1 > 0 || !hero.alive) return;
      const spec = kit.skill1,
        bonuses = talentBonuses(),
        damage = hero.attack * spec.damage * bonuses.skill1DamageMultiplier,
        effectRadius = spec.radius * bonuses.skill1RadiusMultiplier,
        dir = { ...hero.dir };
      if (spec.mode === "spin")
        areaDamage(effectRadius, damage);
      else if (spec.mode === "smash")
        coneDamage(dir, spec.range, damage, 0.65, 250);
      else if (spec.mode === "stunSpray")
        skillShot(dir, "ampoule", damage, { stun: 950, splash: 0.9 });
      else if (spec.mode === "shieldSweep")
        coneDamage(dir, spec.range, damage, 0.2, 250, 1);
      else if (spec.mode === "biteCone") {
        for (const turn of [-0.38, 0.38]) {
          const q = {
            x: dir.x * Math.cos(turn) - dir.y * Math.sin(turn),
            y: dir.x * Math.sin(turn) + dir.y * Math.cos(turn),
          };
          coneDamage(q, spec.range, damage * 0.68, 0.28, 220);
        }
      } else if (spec.mode === "acidShot")
        skillShot(dir, "acid", damage, { splash: 0.75 });
      else if (spec.mode === "blindDust") areaDamage(effectRadius, damage, 1450);
      else if (spec.mode === "webTrap") {
        const p = heroFxPos();
        spawnField(
          "web",
          p.x + dir.x * 3,
          p.y + dir.y * 3,
          effectRadius,
          4000,
          damage,
          kit.color,
        );
      } else if (spec.mode === "drillJab")
        coneDamage(dir, spec.range, damage, 0.75, 320);
      else if (spec.mode === "batonSweep") {
        const reach = openRayReach(dir, 1),
          travel = Math.max(0, reach - 10);
        heroWorld.x += dir.x * travel;
        heroWorld.y += dir.y * travel;
        hero.x = Math.floor(heroWorld.x / S);
        hero.y = Math.floor(heroWorld.y / S);
        coneDamage(dir, spec.range, damage, 0.05, 1050, 1);
      } else if (spec.mode === "repairBolt")
        skillShot(dir, "receipt", damage, { stun: 250, pierce: true });
      else if (spec.mode === "rejectLaser") {
        const p = heroFxPos();
        fields.push({
          kind: "reject",
          x: p.x + dir.x * 0.8,
          y: p.y + dir.y * 0.8,
          radius: 1.7,
          life: 2200,
          maxLife: 2200,
          tick: 0,
          damage: damage * 0.35,
          color: kit.color,
          hitIds: [],
          dir: { ...dir },
          speed: 2.2,
        });
      } else skillShot(dir, "laser", damage, { pierce: true });
      for (let index = 0; index < bonuses.skill1Echo; index++) {
        const echoDirection = rotateDirection(
          dir,
          (index - (bonuses.skill1Echo - 1) / 2) * 0.28,
        );
        if (spec.mode === "stunSpray")
          skillShot(echoDirection, "ampoule", damage * 0.62, { stun: 700, splash: 0.75 });
        else if (spec.mode === "acidShot")
          skillShot(echoDirection, "acid", damage * 0.62, { splash: 0.65 });
        else if (spec.mode === "repairBolt")
          skillShot(echoDirection, "receipt", damage * 0.62, { stun: 180, pierce: true });
        else if (spec.mode === "rejectLaser")
          skillShot(echoDirection, "laser", damage * 0.62, { pierce: true });
        else areaDamage(Math.max(1.1, effectRadius * 0.78), damage * 0.45, 180);
        signatureFx(`${spec.mode}-echo`, echoDirection, effectRadius * 0.82, 620 + index * 90);
      }
      playHeroAnim(spec.mode === "spin" ? "whirlwind" : "basic", 760, 1);
      signatureFx(spec.mode, dir, effectRadius, 760);
      burst(hero.x, hero.y, kit.color, 20);
      hero.act = 760;
      cd1 = spec.cooldown * bonuses.skill1CooldownMultiplier;
      void combatAudio.skillCue(playerDef.id, 1, 1, 4);
      tone(
        spec.mode === "stunSpray" ||
          spec.mode === "repairBolt" ||
          spec.mode === "rejectLaser"
          ? "shot"
          : "blast",
      );
      setMessage(`${playerDef.skills[0]} · ${spec.caption}`);
    };
    const thrustDash = (dx: number, dy: number) => {
      if (cd2 > 0 || !hero.alive) return;
      const spec = kit.skill2,
        bonuses = talentBonuses(),
        d = unitVector(dx, dy),
        startFx = heroFxPos(),
        damage = hero.attack * spec.damage * bonuses.skill2DamageMultiplier,
        skillRange = spec.range + bonuses.skill2RangeBonus;
      hero.dir = d;
      const dash = (range: number, impact = true) => {
        const reach = openRayReach(d, range),
          travel = Math.max(0, reach - (impact ? 12 : 0));
        heroWorld.x += d.x * travel;
        heroWorld.y += d.y * travel;
        hero.x = Math.max(1, Math.min(COLS - 2, Math.floor(heroWorld.x / S)));
        hero.y = Math.max(1, Math.min(ROWS - 2, Math.floor(heroWorld.y / S)));
        moveTarget = null;
        attackTarget = null;
        if (impact) areaDamage(1.2, damage, 180);
      };
      if (spec.mode === "electricAura") {
        const p = heroFxPos();
        spawnField("electric", p.x, p.y, 2.4, 3200, damage * 0.28, kit.color);
      } else if (spec.mode === "groupHeal")
        healArea(skillRange, Math.round(hero.maxHp * 0.22));
      else if (spec.mode === "armorOrder") {
        drillArmorUntil = performance.now() + 5000;
        healArea(3.5, 28);
      } else if (spec.mode === "acidMark") {
        const target = enemyActors()
          .filter((u) => {
            const dx = u.x - hero.x,
              dy = u.y - hero.y,
              dist = Math.hypot(dx, dy);
            return (
              canEngageAt("blue", u.x, u.y) &&
              dist <= skillRange &&
              dist > 0 &&
              (dx / dist) * d.x + (dy / dist) * d.y > 0.72
            );
          })
          .sort(
            (a, b) =>
              Math.hypot(a.x - hero.x, a.y - hero.y) -
              Math.hypot(b.x - hero.x, b.y - hero.y),
          )[0];
        if (target) {
          hurt(
            target,
            damage * 0.45,
            "blue",
            false,
            0,
            1,
            false,
            heroDamageSource("산성 표식"),
          );
          target.vulnerableUntil = performance.now() + 6000;
        }
      } else if (spec.mode === "silkPull") {
        const target = enemyActors()
          .filter((u) => {
            const dx = u.x - hero.x,
              dy = u.y - hero.y,
              dist = Math.hypot(dx, dy);
            return (
              canEngageAt("blue", u.x, u.y) &&
              dist <= skillRange &&
              dist > 0 &&
              (dx / dist) * d.x + (dy / dist) * d.y > 0.6
            );
          })
          .sort(
            (a, b) =>
              Math.hypot(a.x - hero.x, a.y - hero.y) -
              Math.hypot(b.x - hero.x, b.y - hero.y),
          )[0];
        if (target) {
          hurt(
            target,
            damage,
            "blue",
            true,
            hero.critChance,
            hero.critMultiplier,
            false,
            heroDamageSource("거미줄 끌기"),
          );
          const nx = hero.x + Math.sign(target.x - hero.x),
            ny = hero.y + Math.sign(target.y - hero.y);
          if (openForTeam(nx, ny, target.team) && !occupied(nx, ny, target)) {
            target.x = nx;
            target.y = ny;
          }
          target.act = Math.max(target.act, 900);
        }
      } else if (spec.mode === "nightPatrol") {
        drillArmorUntil = performance.now() + 6500;
        areaDamage(2.6, hero.attack * 0.35, 650);
      } else if (spec.mode === "weldCone") {
        coneDamage(d, skillRange, damage, 0.15, 450);
        healArea(3.5, Math.round(hero.maxHp * 0.12));
        repairStructures(3.5, 36);
      } else if (spec.mode === "relocate") {
        dash(skillRange, false);
        hero.hp = Math.min(hero.maxHp, hero.hp + 12);
        burst(hero.x, hero.y, kit.accent, 26);
      } else if (spec.mode === "glide") {
        let landed = false;
        for (let r = skillRange; r >= 1 && !landed; r -= 0.5) {
          const px = heroWorld.x + d.x * r * S,
            py = heroWorld.y + d.y * r * S;
          if (heroWorldClear(px, py)) {
            heroWorld.x = px;
            heroWorld.y = py;
            hero.x = Math.floor(px / S);
            hero.y = Math.floor(py / S);
            landed = true;
          }
        }
        moveTarget = null;
        attackTarget = null;
        hasteUntil = performance.now() + 1200;
      } else
        dash(skillRange, true);
      playHeroAnim(
        [
          "electricAura",
          "groupHeal",
          "armorOrder",
          "nightPatrol",
          "weldCone",
        ].includes(spec.mode)
          ? "whirlwind"
          : "thrust",
        720,
        2,
      );
      signatureFx(spec.mode, d, Math.max(1.2, skillRange * 0.45), 720);
      slashes.push({
        ...startFx,
        dir: d,
        life: 560,
        maxLife: 560,
        kind: "thrust",
        color: kit.color,
      });
      hero.act = 720;
      cd2 = spec.cooldown * bonuses.skill2CooldownMultiplier;
      void combatAudio.skillCue(playerDef.id, 2, 1, 4);
      tone(
        ["groupHeal", "armorOrder", "nightPatrol"].includes(spec.mode)
          ? "build"
          : "hit",
      );
      setMessage(`${playerDef.skills[1]} · ${spec.caption}`);
    };
    const blueDrillBurst = () => {
      if (cd3 > 0 || !hero.alive) return;
      if (isSecretTunnel && battlePhase !== "prepare") {
        setMessage("지반 고정 · 4번 굴착은 준비 단계에서만 사용 가능");
        return;
      }
      const spec = kit.drill,
        bonuses = talentBonuses(),
        d = gridStep(hero.dir.x, hero.dir.y);
      applyHeroDrillPattern(hero, d, bonuses.drillWidthBonus);
      if (spec.mode === "spikeLine")
        coneDamage(hero.dir, 3.8, hero.attack * 0.7, 0.35, 450);
      if (spec.mode === "acidLine")
        coneDamage(hero.dir, 4.8, hero.attack * 0.55, 0.5, 300);
      playHeroAnim("drill", 620, 3);
      slashes.push({
        ...heroFxPos(),
        dir: { ...hero.dir },
        life: 620,
        maxLife: 620,
        kind: "drill",
        variant: spec.mode,
        color: kit.color,
      });
      signatureFx(spec.mode, hero.dir, 2.1, 620);
      hero.act = DRILL_ACTION_LOCK_MS;
      cd3 = spec.cooldown * bonuses.drillCooldownMultiplier * (
        isSecretTunnel ? SECRET_TUNNEL_DRILL_COOLDOWN_MULTIPLIER : 1
      );
      const onlineDrillDirection = d.x || d.y ? d : hero.dir.x || hero.dir.y ? hero.dir : { x: 1, y: 0 };
      publishOnlineInput({
        type: "drill",
        dx: onlineDrillDirection.x,
        dy: onlineDrillDirection.y,
        drillWidthBonus: bonuses.drillWidthBonus > 0 ? 1 : 0,
        drillCooldownMultiplier: bonuses.drillCooldownMultiplier === 0.68 ? 0.68 : 1,
      });
      void combatAudio.skillCue(playerDef.id, 3, 1, 4);
      tone("blast");
      burst(hero.x, hero.y, kit.color, 32);
      setMessage(`${playerDef.skills[2]} · ${spec.caption}`);
    };
    const ultimateTravel = (s: SlashFx, life = s.life) => {
      const t = 1 - Math.max(0, life) / s.maxLife,
        flight = Math.max(0, Math.min(1, (t - 0.42) / 0.58));
      return flight <= 0 ? 0 : 16 + flight * (6 * S - 16);
    };
    const ultimateSlash = (dx: number, dy: number) => {
      if (cd4 > 0 || !hero.alive) return;
      const spec = kit.ultimate,
        bonuses = talentBonuses(),
        d = unitVector(dx, dy),
        damage = hero.attack * spec.damage * bonuses.ultimateDamageMultiplier,
        ultimateRadius = spec.radius * bonuses.ultimateRadiusMultiplier,
        ultimateRange = spec.range;
      hero.dir = d;
      if (spec.mode === "slash") {
        for (let index = 0; index <= bonuses.ultimateEcho; index++) {
          const slashDirection = rotateDirection(
            d,
            (index - bonuses.ultimateEcho / 2) * 0.24,
          );
          slashes.push({
            ...heroFxPos(),
            dir: slashDirection,
            life: 560 + index * 45,
            maxLife: 560 + index * 45,
            kind: "ultimate",
            damage,
            resolved: false,
            hitIds: [],
          });
        }
      } else if (spec.mode === "microwave") {
        const target = enemyActors()
          .filter((u) => {
            const dx = u.x - hero.x,
              dy = u.y - hero.y,
              dist = Math.hypot(dx, dy);
            return (
              canEngageAt("blue", u.x, u.y) &&
              dist <= ultimateRange &&
              dist > 0 &&
              (dx / dist) * d.x + (dy / dist) * d.y > 0.72
            );
          })
          .sort(
            (a, b) =>
              Math.hypot(a.x - hero.x, a.y - hero.y) -
              Math.hypot(b.x - hero.x, b.y - hero.y),
          )[0];
        if (target) {
          hurt(
            target,
            damage,
            "blue",
            true,
            hero.critChance,
            hero.critMultiplier,
            false,
            heroDamageSource("강제 조리"),
          );
          target.act = Math.max(target.act, 2500);
          spawnField(
            "electric",
            target.x,
            target.y,
            0.9,
            2500,
            hero.attack * 0.12,
            kit.color,
          );
        }
      } else if (spec.mode === "acidCone") {
        coneDamage(d, ultimateRange, damage, 0.05, 900);
        healArea(3.5, Math.round(hero.maxHp * 0.28));
      } else if (spec.mode === "lidDisc") {
        for (let index = 0; index <= bonuses.ultimateEcho; index++)
          skillShot(
            rotateDirection(d, (index - bonuses.ultimateEcho / 2) * 0.24),
            "disc",
            damage,
            { splash: ultimateRadius, pierce: true },
          );
      }
      else if (spec.mode === "moltRam") {
        const origin = heroFxPos();
        spawnField(
          "molt",
          origin.x,
          origin.y,
          1.15,
          6500,
          hero.attack * 0.75,
          kit.accent,
        );
        const reach = openRayReach(d, ultimateRange);
        heroWorld.x += d.x * Math.max(0, reach - 10);
        heroWorld.y += d.y * Math.max(0, reach - 10);
        hero.x = Math.floor(heroWorld.x / S);
        hero.y = Math.floor(heroWorld.y / S);
        areaDamage(ultimateRadius, damage, 900);
      } else if (spec.mode === "acidPool") {
        const reach = Math.min(ultimateRange * S, openRayReach(d, ultimateRange)),
          p = heroFxPos();
        spawnField(
          "acid",
          p.x + (d.x * reach) / S,
          p.y + (d.y * reach) / S,
          ultimateRadius,
          5200,
          hero.attack * 0.32,
          kit.color,
        );
      } else if (spec.mode === "frenzy") {
        areaDamage(ultimateRadius, damage, 650);
        hasteUntil = performance.now() + 4500;
        drillArmorUntil = performance.now() + 2500;
      } else if (spec.mode === "webLock") {
        const p = heroFxPos();
        spawnField(
          "web",
          p.x + d.x * 2.2,
          p.y + d.y * 2.2,
          ultimateRadius,
          6200,
          damage * 0.35,
          kit.color,
        );
      } else if (spec.mode === "overclock") {
        const ax = heroWorld.x,
          ay = heroWorld.y;
        let travel = 0;
        for (let dist = 8; dist <= ultimateRange * S; dist += 8) {
          const px = ax + d.x * dist,
            py = ay + d.y * dist,
            tx = Math.floor(px / S),
            ty = Math.floor(py / S),
            tile = grid[ty]?.[tx];
          if (!tile || tile.type === 4) break;
          if (isSecretTunnel) {
            if (!openForTeam(tx, ty, hero.team)) break;
            travel = dist;
            continue;
          }
          if (tile.type !== 0) breakTile(hero, tx, ty, 99);
          travel = dist;
        }
        const bx = ax + d.x * travel,
          by = ay + d.y * travel;
        for (const u of enemyActors()) {
          const p = unitWorld(u);
          if (
            canEngageAt("blue", u.x, u.y) &&
            segmentMetric(p.x, p.y, ax, ay, bx, by).distance <= 25
          ) {
            hurt(
              u,
              damage,
              "blue",
              true,
              hero.critChance,
              hero.critMultiplier,
              false,
              heroDamageSource("관통 기술"),
            );
            u.act = Math.max(u.act, 650);
          }
        }
        for (const t of turrets)
          if (
            t.hp > 0 &&
            t.team === "red" &&
            canEngageAt("blue", t.x, t.y) &&
            segmentMetric(t.x * S + S / 2, t.y * S + S / 2, ax, ay, bx, by)
              .distance <= 27
          )
            hurtTurret(
              t,
              damage * 1.25,
              "blue",
              true,
              hero.critChance,
              hero.critMultiplier,
            );
        if (
          canEngageAt("blue", ENEMY.x, ENEMY.y) &&
          segmentMetric(
            ENEMY.x * S + S / 2,
            ENEMY.y * S + S / 2,
            ax,
            ay,
            bx,
            by,
          ).distance <= 28
        )
          damageBase("blue", damage * 0.85, hero);
        heroWorld.x = bx;
        heroWorld.y = by;
        hero.x = Math.floor(bx / S);
        hero.y = Math.floor(by / S);
        moveTarget = null;
        attackTarget = null;
        drillArmorUntil = performance.now() + 3500;
        slashes.push({
          ...heroFxPos(),
          dir: { x: -d.x, y: -d.y },
          life: 720,
          maxLife: 720,
          kind: "drill",
          variant: "overclock",
          color: kit.color,
        });
      } else if (spec.mode === "lockdown") {
        const p = heroFxPos();
        spawnField(
          "lockdown",
          p.x,
          p.y,
          ultimateRadius,
          5200,
          damage * 0.35,
          kit.color,
        );
        drillArmorUntil = performance.now() + 5200;
      } else if (spec.mode === "massRepair") {
        const p = heroFxPos();
        spawnField(
          "repair",
          p.x,
          p.y,
          ultimateRadius,
          6200,
          Math.max(4, hero.maxHp * 0.035),
          kit.color,
        );
        healArea(ultimateRadius, Math.round(hero.maxHp * 0.18));
        repairStructures(ultimateRadius, 60);
        areaDamage(ultimateRadius, damage * 0.35, 700);
      } else {
        for (let index = 0; index <= bonuses.ultimateEcho; index++)
          skillShot(
            rotateDirection(d, (index - bonuses.ultimateEcho / 2) * 0.2),
            "laser",
            damage,
            { pierce: true, stun: 900 },
          );
      }
      if (bonuses.ultimateEcho > 0 && !["slash", "lidDisc"].includes(spec.mode)) {
        const p = heroFxPos(),
          echoKind: FieldFx["kind"] = spec.mode === "massRepair" ? "repair" : "electric";
        spawnField(
          echoKind,
          p.x + d.x * 2,
          p.y + d.y * 2,
          Math.max(1.2, ultimateRadius * 0.72),
          1500 + bonuses.ultimateEcho * 450,
          damage * 0.16 * bonuses.ultimateEcho,
          kit.accent,
        );
      }
      hero.ultimateLabelUntil = performance.now() + 1150;
      playHeroAnim("ultimate", 820, 4);
      signatureFx(spec.mode, d, ultimateRadius, 900);
      hero.act = 820;
      cd4 =
        spec.cooldown *
        HERO_LEVELS[heroLevel - 1].ultimateCooldown *
        bonuses.ultimateCooldownMultiplier;
      void combatAudio.skillCue(playerDef.id, 4, 1, 6);
      tone("blast");
      setMessage(`3번 고유기 · ${playerDef.skills[3]} · ${spec.caption}`);
    };
    const survivalType = () =>
        ["yoo-seungcheon", "hoebun"].includes(playerDef.id)
          ? "점프"
          : ["ahn-seona", "r486"].includes(playerDef.id)
            ? "회복"
            : ["kang-ryeokhan", "cheolgak", "g77", "c999"].includes(
                  playerDef.id,
                )
              ? "방어"
              : "회피",
      activateSurvival = () => {
        if (!hero.alive || survivalCd > 0) return;
        const type = survivalType(),
          now = performance.now(),
          onlineTarget = cursorWorld(),
          startWorld = { x: heroWorld.x, y: heroWorld.y },
          start = { ...heroFxPos() };
        if (type === "회복") {
          const amount = Math.round(hero.maxHp * 0.24);
          hero.hp = Math.min(hero.maxHp, hero.hp + amount);
          spawnField(
            "repair",
            start.x,
            start.y,
            1.5,
            900,
            amount * 0.08,
            kit.color,
          );
          playHeroAnim("whirlwind", 520, 2);
        } else if (type === "방어") {
          drillArmorUntil = Math.max(drillArmorUntil, now + 4500);
          spawnField("repair", start.x, start.y, 1.35, 800, 0, kit.color);
          playHeroAnim("whirlwind", 480, 2);
        } else if (type === "점프") {
          const d = unitVector(onlineTarget.x - heroWorld.x, onlineTarget.y - heroWorld.y),
            maxDistance = Math.min(
              3 * S,
              Math.hypot(onlineTarget.x - heroWorld.x, onlineTarget.y - heroWorld.y),
            );
          let landing: { x: number; y: number } | null = null;
          for (
            let distance = maxDistance;
            distance >= 1.15 * S && !landing;
            distance -= 0.15 * S
          ) {
            const px = heroWorld.x + d.x * distance,
              py = heroWorld.y + d.y * distance;
            if (heroWorldClear(px, py)) landing = { x: px, y: py };
          }
          if (!landing) {
            setMessage("점프 착지 가능한 열린 땅이 없다");
            tone("hit");
            return;
          }
          commitHeroMove(landing.x, landing.y);
          moveTarget = null;
          attackTarget = null;
          jumpVisual = {
            fromX: startWorld.x,
            fromY: startWorld.y,
            toX: landing.x,
            toY: landing.y,
            start: now,
            duration: 520,
          };
          evadeUntil = now + 560;
          playHeroAnim("thrust", 520, 2);
          slashes.push({
            ...start,
            dir: d,
            life: 560,
            maxLife: 560,
            kind: "signature",
            variant: "jump",
            color: kit.accent,
            radius: 3,
          });
          burst(Math.floor(start.x), Math.floor(start.y), "#d7fbff", 10);
          burst(hero.x, hero.y, kit.accent, 20);
        } else {
          const d = unitVector(hero.dir.x, hero.dir.y);
          let moved = false;
          for (
            let distance = 1.65 * S;
            distance >= 0.25 * S && !moved;
            distance -= 0.2 * S
          ) {
            const px = heroWorld.x + d.x * distance,
              py = heroWorld.y + d.y * distance;
            if (heroWorldClear(px, py)) {
              commitHeroMove(px, py);
              moved = true;
            }
          }
          evadeUntil = now + 520;
          hasteUntil = Math.max(hasteUntil, now + 1200);
          playHeroAnim("thrust", 380, 2);
          slashes.push({
            ...start,
            dir: d,
            life: 420,
            maxLife: 420,
            kind: "signature",
            variant: "dash",
            color: "#d7fbff",
            radius: 1.25,
          });
          burst(Math.floor(start.x), Math.floor(start.y), "#d7fbff", 14);
          burst(hero.x, hero.y, kit.accent, 18);
        }
        survivalCd = type === "점프" ? 12000 : 15000;
        hero.act = Math.max(
          hero.act,
          type === "점프" ? 520 : type === "회피" ? 360 : 500,
        );
        if (type === "회복") tone("item");
        else if (type === "방어") tone("shield");
        else tone("evade");
        publishOnlineInput({
          type: "survival",
          x: Math.floor(onlineTarget.x / S),
          y: Math.floor(onlineTarget.y / S),
        });
        setMessage(`${playerDef.name} 생존기 · ${type}`);
      },
      fillPlacementError = (x: number, y: number) => {
        if (isSecretTunnel && battlePhase !== "prepare")
          return "지반 고정 · 침공 중에는 땅을 메울 수 없다";
        if (Math.hypot(x - hero.x, y - hero.y) > 2.25)
          return "영웅 반경 2칸 안만 메울 수 있다";
        if (!visible(x, y)) return "현재 시야 안의 땅만 메울 수 있다";
        if (Math.hypot(x - ENEMY.x, y - ENEMY.y) < 3)
          return "적 코어 근처에서는 땅을 메울 수 없다";
        if (
          isSecretTunnel &&
          secretTunnelOverlay?.tiles[y]?.[x]?.access === TUNNEL_ACCESS.shared
        ) return "공동 터널은 메울 수 없다";
        if (!openForTeam(x, y, "blue")) return "열린 땅만 메울 수 있다";
        if (occupied(x, y) || turretAt(x, y) || baseAt(x, y))
          return "다른 대상이 있는 칸은 메울 수 없다";
        if (money < 15) return "땅 메우기 · 15 크레딧 필요";
        return "";
      },
      toggleFillMode = () => {
        if (!hero.alive) return;
        if (isSecretTunnel && battlePhase !== "prepare") {
          setMessage("지반 고정 · 침공 중에는 땅을 메울 수 없다");
          return;
        }
        if (buildMode !== "none") selectBuildMode("none");
        aimingSkill = 0;
        setSelected(0);
        fillMode = false;
        moveTarget = null;
        attackTarget = null;
        const target = cursorTile();
        placeFillAt(target.x, target.y);
      },
      placeFillAt = (x: number, y: number) => {
        if (!hero.alive) return;
        if (fillCd > 0) {
          setMessage(
            `땅 메우기 재사용 대기 ${Math.max(1, Math.ceil(fillCd / 1000))}초`,
          );
          return;
        }
        const error = fillPlacementError(x, y);
        if (error) {
          setMessage(error);
          tone("hit");
          return;
        }
        money -= 15;
        if (isSecretTunnel && secretTunnelOverlay) {
          const sealed = sealSecretTunnelTileForTeam(
            secretTunnelOverlay,
            { x, y },
            hero.team,
            { blue: ALLY, red: ENEMY },
          );
          if (!sealed.sealed) {
            money += 15;
            setMessage(
              sealed.blockedReason === "core"
                ? "코어 지반은 메울 수 없다"
                : sealed.blockedReason === "shared"
                  ? "공동 터널은 메울 수 없다"
                  : "메울 굴착 흔적이 없다",
            );
            return;
          }
          secretTunnelOverlay = sealed.overlay;
          const connections = evaluateSecretTunnelConnections(
            secretTunnelOverlay,
            { blue: ALLY, red: ENEMY },
          );
          secretBlueConnected = connections.blue.valid;
          secretRedConnected = connections.red.valid;
        }
        grid[y][x] = {
          type: 5,
          hp: 2,
          max: 2,
          freshUntil: performance.now() + 1500,
          filledBy: hero.team,
        };
        recordTerrainChange(x, y);
        publishOnlineInput({ type: "fill", x, y });
        fillCd = 1000;
        fillMode = false;
        hero.dir = unitVector(
          x * S + S / 2 - heroWorld.x,
          y * S + S / 2 - heroWorld.y,
        );
        hero.act = Math.max(hero.act, 180);
        playHeroAnim("drill", 240, 3);
        slashes.push({
          x,
          y,
          dir: { x: 0, y: -1 },
          life: 300,
          maxLife: 300,
          kind: "signature",
          variant: "fill",
          color: "#b47a50",
          radius: 1,
        });
        burst(x, y, "#b47a50", 24);
        tone("build");
        setMessage("땅 메우기 즉시 완료 · 커서 위치에 바로 시전");
      },
      consumeItemCharge = (slot: number) => {
        itemCharges[slot] = Math.max(0, itemCharges[slot] - 1);
        if (itemCharges[slot] === 0) itemSlots[slot] = null;
        itemCooldownUntil = performance.now() + ITEM_SHARED_COOLDOWN_MS;
      },
      showItemUseFx = (
        item: ItemId,
        color: string,
        detail: string,
      ) => {
        const position = heroFxPos(),
          world = unitWorld(hero);
        spawnField("repair", position.x, position.y, 1.7, 1_050, 0, color);
        spawnField("repair", position.x, position.y, 0.95, 680, 0, "#f5fff9");
        burst(hero.x, hero.y, color, 34);
        pushCombatPopup(
          world.x,
          world.y - 50,
          `${SUPPLY_ITEMS[item].icon} ${detail}`,
          color,
          hero.team,
          false,
          900,
        );
      },
      activateItem = (slot: number) => {
        if (!hero.alive) return;
        if (activeMatchConfig?.kind === "online") {
          setMessage("온라인 동기화 대전에서는 개인 소비 아이템을 사용할 수 없다");
          return;
        }
        const cooldownLeft = itemCooldownUntil - performance.now();
        if (cooldownLeft > 0) {
          setMessage(`아이템 재사용 대기 · ${Math.ceil(cooldownLeft / 100) / 10}초`);
          return;
        }
        const item = itemSlots[slot];
        if (!item || itemCharges[slot] <= 0) {
          setMessage("빈 아이템 슬롯 · 전투 편성에서 장착 가능");
          return;
        }
        if (item === "wallBomb") {
          const x = hero.x,
            y = hero.y,
            t = grid[y]?.[x];
          if (
            !t ||
            !openForTeam(x, y, hero.team) ||
            groundMines.some((mine) => mine.x === x && mine.y === y)
          ) {
            setMessage("열린 땅의 현재 발밑에만 지뢰를 설치할 수 있다");
            return;
          }
          const plantedAt = performance.now();
          groundMines.push({
            x,
            y,
            team: "blue",
            armedAt: plantedAt + 350,
            detonateAt: plantedAt + 3000,
          });
          hero.act = 520;
          playHeroAnim("drill", 520, 3);
          slashes.push({
            x,
            y,
            dir: { ...hero.dir },
            life: 520,
            maxLife: 520,
            kind: "signature",
            variant: "bombPlant",
            color: "#f0b04c",
            radius: 0.8,
          });
          tone("item");
          tone("build");
          setMessage("압력 지뢰 설치 · 3초 뒤 또는 적이 밟으면 광역 폭발");
        } else if (item === "energyDrink") {
          const now = performance.now(),
            before = hero.hp;
          hero.hp = Math.min(
            hero.maxHp,
            hero.hp + Math.round(hero.maxHp * ENERGY_DRINK_HEAL_RATIO),
          );
          hasteUntil = Math.max(hasteUntil, now + 5000);
          playHeroAnim("whirlwind", 480, 2);
          showItemUseFx(item, "#f1dc62", `드링크 +${Math.round(hero.hp - before)}`);
          tone("item");
          tone("heal");
          setMessage("에너지 드링크 · 체력 60% 회복 + 5초 가속");
        } else if (item === "medKit") {
          const before = hero.hp;
          hero.hp = Math.min(hero.maxHp, hero.hp + emergencyRepairAmount(hero.maxHp));
          showItemUseFx(item, "#75f0a0", `완전 수복 +${Math.round(hero.hp - before)}`);
          playHeroAnim("whirlwind", 520, 2);
          tone("item");
          tone("heal");
          setMessage("응급 수복팩 · 체력 100% 완전 회복");
        } else if (item === "armorPlate") {
          drillArmorUntil = Math.max(drillArmorUntil, performance.now() + 8000);
          showItemUseFx(item, "#8fc5ff", "장갑 전개 · 8초");
          tone("item");
          tone("shield");
          setMessage("복합 장갑판 · 8초 방어 강화");
        } else if (item === "scanner") {
          for (let y = hero.y - 8; y <= hero.y + 8; y++)
            for (let x = hero.x - 8; x <= hero.x + 8; x++)
              if (seen[y]?.[x] !== undefined && Math.hypot(x - hero.x, y - hero.y) <= 8) {
                seen[y][x] = true;
                memory[y][x] = { ...tileForLocalTunnelView(x, y) };
              }
          showItemUseFx(item, "#74e8ff", "주변 8칸 탐지");
          tone("item");
          tone("warning");
          setMessage("진동 탐지기 · 주변 8칸 탐사 완료");
        } else {
          hasteUntil = Math.max(hasteUntil, performance.now() + 10000);
          evadeUntil = Math.max(evadeUntil, performance.now() + 1000);
          showItemUseFx(item, "#d59cff", "위상 가속 · 10초");
          tone("item");
          tone("coin");
          setMessage("위상 장화 · 10초 가속 + 1초 회피");
        }
        consumeItemCharge(slot);
      };
    const spawnCells = [
        { x: ALLY.x - 1, y: ALLY.y + 2 },
        { x: ALLY.x, y: ALLY.y + 2 },
        { x: ALLY.x + 1, y: ALLY.y + 2 },
      ],
      buildDef = (kind: BuildKind) => BUILD_BY_ID[kind],
      activeSupportAura = (team: Team) => {
        const support = turrets.find((turret) =>
            turret.hp > 0 &&
            turret.built &&
            turret.team === team &&
            buildDef(turret.kind)?.category === "support"),
          aura = support ? buildDef(support.kind)?.supportAura : undefined;
        return support && aura
          ? { turret: support, aura, value: supportAuraValue(aura, support.level) }
          : null;
      },
      supportAuraForUnit = (unit: Unit) => {
        if (unit.role !== "minion") return null;
        const active = activeSupportAura(unit.team);
        return active && supportAuraAppliesToRole(active.aura, unit.minionRole) ? active : null;
      },
      isBlocker = (kind: BuildKind) => buildDef(kind)?.category === "blocker",
      isSupport = (kind: BuildKind) => buildDef(kind)?.category === "support",
      isAttackBuild = (kind: BuildKind) => {
        const category = buildDef(kind)?.category;
        return category === "multi" || category === "ranged";
      },
      ownBuilds = () =>
        turrets.filter(
          (t) => t.team === "blue" && t.built && !t.starter && t.hp > 0,
        ),
      placementCost = (kind: BuildKind, x: number, y: number, builds = ownBuilds()) => {
        const def = buildDef(kind);
        return buildPlacementCost(
          def.cost,
          isBlocker(kind) || isSupport(kind),
          x,
          y,
          builds.map((t) => ({ x: t.x, y: t.y, isBlocker: isBlocker(t.kind) || isSupport(t.kind) })),
        );
      },
      turretStats = (t: Turret) => {
        const def = buildDef(t.kind),
          level2 = t.level >= 2;
        return {
          range: def.range + (level2 && def.category !== "blocker" ? 0.25 : 0),
          cooldown: def.cooldown * (level2 ? 0.95 : 1),
          damage: def.damage * (level2 ? 1.18 : 1),
          critChance: def.critChance,
          critMultiplier: def.critMultiplier,
          targets: def.targets,
        };
      },
      preservesExitPath = (blockX: number, blockY: number) => {
        const starts = spawnCells.filter(
          (p) => openForTeam(p.x, p.y, "blue") && !(p.x === blockX && p.y === blockY),
        );
        if (!starts.length) return false;
        const q = [...starts],
          seenPath = new Set(q.map((p) => `${p.x},${p.y}`));
        for (let i = 0; i < q.length; i++) {
          const p = q[i];
          if (Math.hypot(p.x - ALLY.x, p.y - ALLY.y) >= 3.5) return true;
          for (const d of DIRS) {
            const x = p.x + d.x,
              y = p.y + d.y,
              k = `${x},${y}`;
            if (
              seenPath.has(k) ||
              !openForTeam(x, y, "blue") ||
              (x === blockX && y === blockY) ||
              turretAt(x, y) ||
              baseAt(x, y)
            )
              continue;
            seenPath.add(k);
            q.push({ x, y });
          }
        }
        return false;
      },
      placementError = (kind: BuildKind, x: number, y: number) => {
        const def = buildDef(kind);
        if (!def || def.faction !== playerDef.faction)
          return "현재 종족이 건설할 수 없는 시설";
        const dist = Math.hypot(x - ALLY.x, y - ALLY.y),
          all = ownBuilds(),
          attacks = all.filter((t) => isAttackBuild(t.kind)).length,
          walls = all.filter((t) => isBlocker(t.kind)).length,
          supports = all.filter((t) => isSupport(t.kind)).length;
        if (dist < 2 || dist > 6) return "붉은 설치 한계선 안쪽만 가능";
        if (!visible(x, y)) return "현재 시야 안에서만 건설 가능";
        if (!openForTeam(x, y, "blue")) return "열린 땅굴에만 건설 가능";
        if (baseAt(x, y) || turretAt(x, y) || occupied(x, y))
          return "다른 대상과 겹쳐 건설할 수 없음";
        if (spawnCells.some((p) => p.x === x && p.y === y))
          return "굴착대 출전 칸은 비워야 함";
        if (all.length >= 6) return "추가 설치물은 최대 6개";
        if (isBlocker(kind) && walls >= 4) return "방어벽은 최대 4개";
        if (isAttackBuild(kind) && attacks >= 3) return "공격 설치물은 최대 3개";
        if (isSupport(kind) && supports >= 1) return "상시 지원 시설은 팀당 최대 1개";
        if ((isBlocker(kind) || isSupport(kind)) && !preservesExitPath(x, y))
          return "최소 한 개의 출전 경로를 남겨야 함";
        const cost = placementCost(kind, x, y, all);
        if (money < cost) return `${cost} 크레딧 필요${cost > def.cost ? " · 밀집 건설 할증" : ""}`;
        return "";
      },
      enemyOwnBuilds = () =>
        turrets.filter((t) => t.team === "red" && t.built && !t.starter && t.hp > 0),
      preservesEnemyExitPath = (blockX: number, blockY: number) => {
        const starts = DIRS.map((d) => ({ x: ENEMY.x + d.x, y: ENEMY.y + d.y }))
          .filter((p) => openForTeam(p.x, p.y, "red") && !(p.x === blockX && p.y === blockY));
        if (!starts.length) return false;
        const q = [...starts], visited = new Set(q.map((p) => `${p.x},${p.y}`));
        for (let i = 0; i < q.length; i++) {
          const p = q[i];
          if (Math.hypot(p.x - ENEMY.x, p.y - ENEMY.y) >= 4.5) return true;
          for (const d of DIRS) {
            const x = p.x + d.x, y = p.y + d.y, key = `${x},${y}`;
            if (visited.has(key) || !openForTeam(x, y, "red") || (x === blockX && y === blockY) || turretAt(x, y) || baseAt(x, y)) continue;
            visited.add(key);
            q.push({ x, y });
          }
        }
        return false;
      },
      runEnemyConstruction = () => {
        if (activeMatchConfig?.kind !== "computer" || enemyBuildClock > 0) return;
        const research = nextMinionResearch(minionLevels.red);
        if (research && minionResearchReady(research.level, wave) && enemyBuildCredits >= research.cost + 70 && researchMinionTeam("red")) {
          enemyBuildClock = 1800;
          return;
        }
        if (
          wave >= ELITE_UNLOCK_WAVE && teamKnowsEnemyCore("red") &&
          enemyBuildCredits >= ELITE_RESERVATION_COST + 100 && reserveEliteTeam("red")
        ) {
          enemyBuildClock = 2200;
          return;
        }
        const builds = enemyOwnBuilds(),
          attackCount = builds.filter((t) => isAttackBuild(t.kind)).length,
          wallCount = builds.filter((t) => isBlocker(t.kind)).length,
          supportCount = builds.filter((t) => isSupport(t.kind)).length,
          buildCapped = builds.length >= 6 || (attackCount >= 3 && wallCount >= 3 && supportCount >= 1);
        const threats = units
            .filter((u) =>
              u.alive &&
              u.team === "blue" &&
              !(isSecretTunnel && battlePhase === "prepare"),
            )
            .map((u) => ({ unit: u, dist: Math.hypot(u.x - ENEMY.x, u.y - ENEMY.y) }))
            .sort((a, b) => a.dist - b.dist),
          nearest = threats[0],
          urgent = Boolean(nearest && nearest.dist <= 10),
          defs = factionBuildables(enemyFaction),
          wantsWall = wallCount < 3 && (urgent || attackCount >= 2),
          supportChoice = wave >= 4 && supportCount === 0
            ? defs.find((candidate) => candidate.category === "support" && candidate.cost + 50 <= enemyBuildCredits)
            : undefined,
          affordable = defs
            .filter((def) => def.cost <= enemyBuildCredits)
            .filter((def) => def.category !== "support" || supportCount === 0)
            .filter((def) => wantsWall ? def.category === "blocker" : def.category !== "blocker")
            .sort((a, b) => b.cost - a.cost),
          def = supportChoice ?? affordable[0] ?? defs
            .filter((candidate) => candidate.cost <= enemyBuildCredits)
            .sort((a, b) => b.cost - a.cost)[0];
        if (
          !(isSecretTunnel && battlePhase === "prepare") &&
          performance.now() >= tacticalStates.red.cooldownUntil
        ) {
          const redFront = units.filter((unit) => unit.alive && unit.team === "red" && unit.role === "minion"),
            blueCluster = nearest ? threats.filter((entry) => Math.hypot(entry.unit.x - nearest.unit.x, entry.unit.y - nearest.unit.y) <= 2.5).length : 0,
            engaged = redFront.filter((unit) => units.some((target) => target.alive && target.team === "blue" && Math.hypot(target.x - unit.x, target.y - unit.y) <= 4)).length,
            wounded = redFront.filter((unit) => unit.hp / unit.maxHp < 0.72);
          if (urgent && activateTacticalSupport("red", "defense")) { enemyBuildClock = 3500; return; }
          if (nearest && blueCluster >= 3 && activateTacticalSupport("red", "area", { x: nearest.unit.x, y: nearest.unit.y })) { enemyBuildClock = 3500; return; }
          if (wounded.length >= 3 && activateTacticalSupport("red", "recovery")) { enemyBuildClock = 3500; return; }
          if (redFront.length <= 5 && threats.length >= redFront.length + 2 && activateTacticalSupport("red", "reinforce")) { enemyBuildClock = 3500; return; }
          if (engaged >= 3 && activateTacticalSupport("red", "offense")) { enemyBuildClock = 3500; return; }
        }
        if (buildCapped) { enemyBuildClock = 4200; return; }
        if (!def) {
          enemyBuildClock = 2500;
          return;
        }
        const toward = nearest
            ? unitVector(nearest.unit.x - ENEMY.x, nearest.unit.y - ENEMY.y)
            : unitVector(COLS / 2 - ENEMY.x, ROWS / 2 - ENEMY.y),
          anchorDistance = def.category === "blocker" ? 3.2 : 2.5,
          anchor = { x: ENEMY.x + toward.x * anchorDistance, y: ENEMY.y + toward.y * anchorDistance },
          candidates: Array<{ x: number; y: number; score: number; cost: number }> = [];
        for (let y = ENEMY.y - 6; y <= ENEMY.y + 6; y++)
          for (let x = ENEMY.x - 6; x <= ENEMY.x + 6; x++) {
            const distance = Math.hypot(x - ENEMY.x, y - ENEMY.y),
              cost = buildPlacementCost(
                def.cost,
                def.category === "blocker" || def.category === "support",
                x,
                y,
                builds.map((t) => ({ x: t.x, y: t.y, isBlocker: isBlocker(t.kind) || isSupport(t.kind) })),
              );
            if (distance < 2 || distance > 6 || !openForTeam(x, y, "red") || baseAt(x, y) || turretAt(x, y, "red") || occupied(x, y, undefined, "red") || cost > enemyBuildCredits) continue;
            if ((def.category === "blocker" || def.category === "support") && !preservesEnemyExitPath(x, y)) continue;
            const openSides = DIRS.filter((d) => openForTeam(x + d.x, y + d.y, "red")).length,
              coverage = threats.filter((entry) => Math.hypot(entry.unit.x - x, entry.unit.y - y) <= def.range).length,
              chokeBonus = def.category === "blocker" ? (openSides === 2 ? 5 : openSides === 3 ? 2 : 0) : coverage * 4;
            candidates.push({ x, y, cost, score: 20 - Math.hypot(x - anchor.x, y - anchor.y) * 3 + chokeBonus - (cost - def.cost) * 0.08 });
          }
        const spot = candidates.sort((a, b) => b.score - a.score)[0];
        if (!spot) {
          enemyBuildClock = 3000;
          return;
        }
        turrets.push(createBuildableUnit({ id: buildId++, x: spot.x, y: spot.y, team: "red", kind: def.id, cool: 300, cost: spot.cost }));
        enemyBuildCredits -= spot.cost;
        enemyBuildClock = urgent ? 5200 : 7800;
        if (!(isSecretTunnel && battlePhase === "prepare") && visible(spot.x, spot.y)) {
          setMessage(`적 건설 감지 · ${def.name} · ${urgent ? "이 길목을 차단한다" : "이 전선을 엄호한다"}`);
          tone("warning");
          burst(spot.x, spot.y, FACTIONS[enemyFaction].color, 18);
        }
      },
      selectBuildMode = (mode: BuildMode) => {
        fillMode = false;
        tacticalAim = null;
        buildMode = buildMode === mode ? "none" : mode;
        setBuildChoice(buildMode);
        moveTarget = null;
        attackTarget = null;
        aimingSkill = 0;
        setSelected(0);
        setMessage(
          buildMode === "none"
            ? "건설 모드 종료"
            : buildMode === "demolish"
              ? "철거할 아군 설치물을 선택"
              : buildMode === "upgrade"
                ? "강화할 1레벨 설치물을 선택"
                : "붉은 원 안의 열린 땅굴을 선택",
        );
      },
      placeBuildableAt = (x: number, y: number) => {
        if (
          buildMode === "none" ||
          buildMode === "demolish" ||
          buildMode === "upgrade"
        )
          return;
        const kind = buildMode,
          error = placementError(kind, x, y);
        if (error) {
          setMessage(error);
          tone("hit");
          return;
        }
        const def = buildDef(kind), cost = placementCost(kind, x, y);
        money -= cost;
        turrets.push(createBuildableUnit({
          id: buildId++,
          x,
          y,
          team: "blue",
          kind,
          cool: 250,
          cost,
        }));
        publishOnlineInput({ type: "build", x, y, kind });
        tone("build");
        burst(
          x,
          y,
          isBlocker(kind) ? "#b8865d" : FACTIONS[playerDef.faction].color,
          20,
        );
        setMessage(`${def.name} 건설 완료 · ${cost} 크레딧${cost > def.cost ? " · 밀집 할증 적용" : ""}`);
      },
      startUpgradeAt = (x: number, y: number) => {
        const target = turretAt(x, y);
        if (!target || target.team !== "blue") {
          setMessage("강화할 아군 설치물을 선택");
          return;
        }
        if (target.level >= 2) {
          setMessage("현재 제출판의 최대 강화 단계입니다");
          return;
        }
        if (target.upgrade) {
          setMessage("이미 강화 작업 중입니다");
          return;
        }
        const def = buildDef(target.kind),
          cost = Math.ceil(def.cost * 0.65);
        if (money < cost) {
          setMessage(`강화에 ${cost} 크레딧 필요`);
          return;
        }
        money -= cost;
        target.upgrade = { remaining: 1500, cost };
        publishOnlineInput({ type: "upgrade", x, y });
        setMessage(`${def.short} 2레벨 강화 시작 · 피격 시 취소`);
      },
      startDemolitionAt = (x: number, y: number) => {
        const target = turretAt(x, y);
        if (!target || target.team !== "blue") {
          setMessage("철거할 아군 설치물을 선택");
          return;
        }
        if (target.starter) {
          setMessage("기본 방어 시설은 철거할 수 없음");
          return;
        }
        target.demolish = 1000;
        publishOnlineInput({ type: "demolish", x, y });
        setMessage(`${buildDef(target.kind).name} 해체 시작 · 피격 시 취소`);
      },
      updateBuildWork = (dt: number) => {
        for (let i = turrets.length - 1; i >= 0; i--) {
          const t = turrets[i];
          if (t.upgrade) {
            t.upgrade.remaining -= dt;
            if (t.upgrade.remaining <= 0) {
              const def = buildDef(t.kind),
                ratio = t.hp / t.maxHp,
                mult = isBlocker(t.kind) ? 1.45 : 1.25;
              t.level = 2;
              t.invested += t.upgrade.cost;
              t.maxHp = def.hp * mult;
              t.hp = t.maxHp * ratio;
              t.upgrade = undefined;
              tone("build");
              burst(t.x, t.y, "#f1d16a", 22);
              setMessage(`${def.short} 2레벨 강화 완료`);
            }
          }
          if (t.demolish === undefined) continue;
          t.demolish -= dt;
          if (t.demolish <= 0) {
            const refund = Math.floor((t.invested * 0.5 * t.hp) / t.maxHp);
            money += refund;
            tone("coin");
            burst(t.x, t.y, "#a98f68", 14);
            turrets.splice(i, 1);
            setMessage(`철거 완료 · ${refund} 크레딧 환급`);
          }
        }
      };
    const nearestEnemy = (u: Unit, range = 99) =>
        isSecretTunnel && battlePhase === "prepare"
          ? undefined
          : units
          .filter((v) =>
            v.alive &&
            v.networkVisible !== false &&
            v.campaignActivated !== false &&
            v.team !== u.team &&
            canEngageAt(u.team, v.x, v.y),
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - u.x, a.y - u.y) -
              Math.hypot(b.x - u.x, b.y - u.y),
          )
          .find((v) => Math.hypot(v.x - u.x, v.y - u.y) <= range),
      nearestEnemyTurret = (u: Unit, range = 99) =>
        isSecretTunnel && battlePhase === "prepare"
          ? undefined
          : turrets
          .filter((t) =>
            t.hp > 0 &&
            t.campaignActivated !== false &&
            t.team !== u.team &&
            canEngageAt(u.team, t.x, t.y),
          )
          .sort(
            (a, b) =>
              Math.abs(a.x - u.x) +
              Math.abs(a.y - u.y) -
              (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)),
          )
          .find((t) => Math.abs(t.x - u.x) + Math.abs(t.y - u.y) <= range),
      clearRay = (ax: number, ay: number, bx: number, by: number, team: Team = "blue") => {
        if (isSecretTunnel && (!openForTeam(ax, ay, team) || !openForTeam(bx, by, team)))
          return false;
        const dist = Math.hypot(bx - ax, by - ay),
          steps = Math.ceil(dist * 4);
        for (let i = 1; i < steps; i++) {
          const x = Math.floor(ax + ((bx - ax) * i) / steps),
            y = Math.floor(ay + ((by - ay) * i) / steps);
          if ((x === ax && y === ay) || (x === bx && y === by)) continue;
          if (!openForTeam(x, y, team)) return false;
        }
        return true;
      };
    const routePathCells = (
      start: { x: number; y: number },
      goal: { x: number; y: number },
      team: Team = "blue",
    ) => shortestRouteToAny(start, [goal], (x, y) => openForTeam(x, y, team))?.cells ?? [];
    const routeTravelPoints = (route: MarchRoute) =>
        route.plannedCells.length ? route.plannedCells : route.points,
      activeRouteIds = (team: Team = "blue") =>
        (["A", "B"] as RouteId[]).filter((id) => teamMarchRoutes[team][id].points.length),
      chooseSpawnRoute = (team: Team, index: number) => {
        const active = activeRouteIds(team);
        if (active.length !== 2) return active[0];
        return chooseSecretTunnelRoute(index + wave * 4, tunnelAllocations[team]);
      },
      assignAvailableRoute = (u: Unit) => {
        const active = activeRouteIds(u.team);
        if (!active.length) {
          u.routeId = undefined;
          return;
        }
        const counts = (id: RouteId) =>
          units.filter(
            (v) =>
              v.alive &&
              v.team === u.team &&
              v.role === "minion" &&
              v.routeId === id,
          ).length;
        u.routeId = [...active].sort((a, b) => counts(a) - counts(b))[0];
        u.routePointIndex = 0;
        u.routeWaitMs = 0;
        u.routeRetreating = false;
        u.routeResumeIndex = undefined;
      };
    const remapRouteProgress = (
      team: Team,
      id: RouteId,
      previousCellCount: number,
      nextCellCount: number,
    ) => {
      const previousEnd = Math.max(1, previousCellCount - 1),
        nextEnd = Math.max(0, nextCellCount - 1);
      for (const unit of units)
        if (unit.alive && unit.team === team && unit.role === "minion" && unit.routeId === id) {
          const ratio = previousCellCount > 1
            ? Math.max(0, Math.min(1, (unit.routePointIndex ?? 0) / previousEnd))
            : 0;
          unit.routePointIndex = Math.round(ratio * nextEnd);
          unit.routeRetreating = false;
          unit.routeResumeIndex = undefined;
        }
    };
    const rebalanceRoutes = (team: Team = "blue") => {
      const active = activeRouteIds(team);
      if (!active.length) return;
      const minions = units.filter((u) => u.alive && u.team === team && u.role === "minion"),
        routeCounts = (id: RouteId) => minions.filter((unit) => unit.routeId === id).length,
        needsInitialSplit = active.length === 2 && active.some((id) => routeCounts(id) === 0);
      minions.forEach((u, index) => {
        const previousRouteId = u.routeId;
        if (needsInitialSplit || !u.routeId || !active.includes(u.routeId))
          u.routeId = active[index % active.length];
        const route = teamMarchRoutes[team][u.routeId],
          routePoints = routeTravelPoints(route),
          rejoin = forwardRouteRejoin(
            u,
            routePoints,
            previousRouteId === u.routeId ? u.routePointIndex ?? 0 : 0,
            (x, y) => openForTeam(x, y, team),
          );
        u.routePointIndex = rejoin.index;
        u.routeRetreating = false;
        u.routeResumeIndex = undefined;
        u.routeWaitMs = 0;
        u.noPathMs = 0;
        u.aiTargetId = undefined;
        u.aiTargetUntil = 0;
        u.assistTargetKind = undefined;
        u.assistTargetId = undefined;
        u.assistUntil = 0;
      });
    };
    const addRoutePoint = (id: RouteId, x: number, y: number) => {
        if (routeEdit !== id) return;
        if (routeDraftPoints.length >= ROUTE_DRAFT_SAFETY_LIMIT) {
          setMessage(`${id} 경로가 너무 복잡하다 · 적용하거나 초기화한 뒤 다시 지정`);
          tone("hit");
          return;
        }
        if (!seen[y]?.[x] || !open(x, y)) {
          setMessage("탐사한 열린 땅굴에만 진군 포인트를 지정할 수 있다");
          tone("hit");
          return;
        }
        const from = routeDraftPoints.at(-1) ?? { x: ALLY.x, y: ALLY.y };
        if (from.x === x && from.y === y) return;
        if (!routePathCells(from, { x, y }).length) {
          setMessage(`${id} 노선 단절 · 현재 열린 땅굴로 연결되지 않는다`);
          tone("hit");
          return;
        }
        routeDraftPoints.push({ x, y });
        const guide = stitchRoutePoints(ALLY, routeDraftPoints, open);
        routeDraftCells = guide.complete ? guide.cells.slice(1) : [];
        setRouteDraftCount(routeDraftPoints.length);
        tone("coin");
        setMessage(
          `${id} 상세 경로 ${routeDraftPoints.length}번째 지점 · 마지막 지점이 최종 목적지`,
        );
      },
      beginRouteEdit = (id: RouteId) => {
        routeEdit = id;
        routeQuickAim = null;
        routeDraftPoints = [];
        routeDraftCells = [];
        fillMode = false;
        buildMode = "none";
        setBuildChoice("none");
        aimingSkill = 0;
        moveTarget = null;
        attackTarget = null;
        setSelected(0);
        setQuickRouteChoice("none");
        setRouteChoice(id);
        setRouteDraftCount(0);
        setMessage(`${id} 상세 경로 · 열린 땅굴을 원하는 만큼 순서대로 클릭`);
      },
      beginQuickRouteAim = (id: RouteId) => {
        cancelRouteEdit();
        routeQuickAim = id;
        setQuickRouteChoice(id);
        setMessage(`${id} 빠른 지정 · 열린 땅굴 한 곳을 클릭`);
      },
      resetRouteDraft = () => {
        if (!routeEdit) return;
        routeDraftPoints = [];
        routeDraftCells = [];
        setRouteDraftCount(0);
        setMessage(`${routeEdit} 상세 경로 초기화 · 첫 지점부터 다시 클릭`);
      },
      clearMarchRoute = (id: RouteId) => {
        marchRoutes[id].points = [];
        marchRoutes[id].plannedCells = [];
        marchRoutes[id].pathMode = "direct";
        marchRoutes[id].overlapRatio = 0;
        marchRoutes[id].revision++;
        for (const u of units)
          if (u.team === "blue" && u.routeId === id) {
            u.routeId = undefined;
            assignAvailableRoute(u);
          }
        setMessage(`${id} 노선 초기화`);
      },
      applyTeamRouteTarget = (team: Team, id: RouteId, x: number, y: number) => {
        const base = team === "blue" ? ALLY : ENEMY,
          target = { x, y },
          routes = teamMarchRoutes[team],
          otherId: RouteId = id === "A" ? "B" : "A",
          otherRoute = routes[otherId],
          avoidedCells = otherRoute.points.length
            ? [{ ...base }, ...routeTravelPoints(otherRoute)]
            : [],
          plan = openForTeam(x, y, team)
            ? diverseRouteToGoal(base, target, (px, py) => openForTeam(px, py, team), avoidedCells, {
                sharedStartRadius: 1,
                sharedGoalRadius: 1,
                hardAvoidRadius: 2,
                exactPenalty: 60,
                adjacentPenalty: 24,
                nearPenalty: 10,
                 oppositeSidePenalty: 18,
                 maxDetourRatio: 3.4,
                 detourSlack: 18,
                 preferredVerticalDirection: id === "A" ? -1 : 1,
               })
            : null;
        if (!plan) return false;
        const route = routes[id],
          previousCellCount = routeTravelPoints(route).length;
        route.points = [{ x, y }];
        route.plannedCells = plan.cells.slice(1);
        route.pathMode = plan.pathMode;
        route.overlapRatio = plan.overlapRatio;
        route.revision++;
        remapRouteProgress(team, id, previousCellCount, route.plannedCells.length);
        rebalanceRoutes(team);
        return route;
      },
      applyTeamRoutePoints = (team: Team, id: RouteId, points: readonly GridPoint[]) => {
        const base = team === "blue" ? ALLY : ENEMY,
          safePoints = points
            .slice(0, ROUTE_DRAFT_SAFETY_LIMIT)
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            .map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));
        if (!safePoints.length || safePoints.some((point) => !openForTeam(point.x, point.y, team)))
          return false;
        const guide = stitchRoutePoints(
          base,
          safePoints,
          (x, y) => openForTeam(x, y, team),
        );
        if (!guide.complete) return false;
        const route = teamMarchRoutes[team][id],
          previousCellCount = routeTravelPoints(route).length;
        route.points = safePoints;
        route.plannedCells = guide.cells.slice(1);
        route.pathMode = "direct";
        route.overlapRatio = 0;
        route.revision++;
        remapRouteProgress(team, id, previousCellCount, route.plannedCells.length);
        rebalanceRoutes(team);
        return route;
      },
      applyRouteDraft = () => {
        if (!routeEdit || !routeDraftPoints.length) {
          setMessage("상세 경로 지점을 하나 이상 지정해야 한다");
          tone("hit");
          return;
        }
        const id = routeEdit,
          points = routeDraftPoints.map((point) => ({ ...point })),
          route = applyTeamRoutePoints("blue", id, points);
        if (!route) {
          setMessage(`${id} 상세 경로가 현재 열린 땅굴로 이어지지 않는다`);
          tone("hit");
          return;
        }
        publishOnlineInput({ type: "route", route: id, points });
        tone("coin");
        cancelRouteEdit();
        setMessage(`${id} 상세 경로 적용 · ${points.length}개 지점 · 마지막 지점까지 전진`);
      },
      setRouteTarget = (id: RouteId, x: number, y: number) => {
        if (!seen[y]?.[x] || !open(x, y)) {
          setMessage(`${id} 전략 지점은 탐사한 열린 땅굴에만 지정할 수 있다`);
          tone("hit");
          return;
        }
        if (!routePathCells(ALLY, { x, y }).length) {
          setMessage(`${id} 전략 지점까지 연결된 땅굴이 없다`);
          tone("hit");
          return;
        }
        const route = applyTeamRouteTarget("blue", id, x, y);
        if (!route) return;
        tone("coin");
        const routeLabel = route.pathMode === "flank"
          ? `반대 노선과 ${Math.round((1 - route.overlapRatio) * 100)}% 분리된 우회로`
          : route.pathMode === "shared"
            ? "별도 우회로 없음 · 공용 병목 사용"
            : "직접 진입로";
        setMessage(`${id} 전략 지점 갱신 · ${routeLabel}`);
      },
      ensureComputerAttackRoutes = (team: Team) => {
        if (isCampaign || activeMatchConfig?.kind !== "computer" || team !== "red") return;
        if (activeRouteIds(team).length < 2) {
          const target = ALLY;
          if (!teamMarchRoutes[team].A.points.length)
            applyTeamRouteTarget(team, "A", target.x, target.y);
          if (!teamMarchRoutes[team].B.points.length)
            applyTeamRouteTarget(team, "B", target.x, target.y);
        }
        units
          .filter((unit) => unit.alive && unit.team === team && unit.role === "hero")
          .forEach((unit, index) => {
            const assignedRouteId: RouteId = index % 2 === 0 ? "A" : "B";
            if (unit.routeId !== assignedRouteId) {
              unit.routeId = assignedRouteId;
              unit.routePointIndex = 0;
            }
          });
      };
    const announceSecretPhase = (title: string, subtitle: string) => {
        if (phaseAnnouncementTimer !== null) window.clearTimeout(phaseAnnouncementTimer);
        setSecretPhaseAnnouncement({ key: Date.now(), title, subtitle });
        phaseAnnouncementTimer = window.setTimeout(() => {
          setSecretPhaseAnnouncement(null);
          phaseAnnouncementTimer = null;
        }, 2600);
      },
      resetSecretTunnelHeroesToCores = () => {
        const reserved = new Set<string>(),
          livingNonHeroes = units.filter((unit) => unit.alive && unit.role !== "hero");
        for (const team of ["blue", "red"] as Team[]) {
          const core = team === "blue" ? ALLY : ENEMY,
            opponent = team === "blue" ? ENEMY : ALLY,
            forward = cardinal(opponent.x - core.x, opponent.y - core.y),
            safeAnchor = { x: core.x - forward.x, y: core.y - forward.y },
            candidates: GridPoint[] = [];
          for (let radius = 1; radius <= 3; radius++)
            for (let oy = -radius; oy <= radius; oy++)
              for (let ox = -radius; ox <= radius; ox++) {
                if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
                candidates.push({ x: core.x + ox, y: core.y + oy });
              }
          candidates.sort((a, b) =>
            Math.abs(a.x - safeAnchor.x) + Math.abs(a.y - safeAnchor.y) -
              (Math.abs(b.x - safeAnchor.x) + Math.abs(b.y - safeAnchor.y)) ||
            Math.abs(a.y - core.y) - Math.abs(b.y - core.y),
          );
          const teamHeroes = units
            .filter((unit) => unit.alive && unit.role === "hero" && unit.team === team)
            .sort((a, b) => a.id - b.id);
          for (const unit of teamHeroes) {
            const spawn = candidates.find((cell) => {
              const key = `${cell.x},${cell.y}`;
              return !reserved.has(key) &&
                openForTeam(cell.x, cell.y, team) &&
                !baseAt(cell.x, cell.y) &&
                !turretAt(cell.x, cell.y, team) &&
                !livingNonHeroes.some((other) => other.x === cell.x && other.y === cell.y);
            });
            if (!spawn) continue;
            reserved.add(`${spawn.x},${spawn.y}`);
            unit.x = spawn.x;
            unit.y = spawn.y;
            unit.dir = { ...forward };
            unit.act = Math.max(unit.act, 650);
            unit.remoteGoal = undefined;
            unit.routePointIndex = 0;
            unit.routeWaitMs = 0;
            unit.aiTargetId = undefined;
            unit.aiPreviousAction = undefined;
            unit.noPathMs = 0;
            unit.arenaMoveUntil = 0;
            if (unit === hero) {
              heroWorld.x = spawn.x * S + S / 2;
              heroWorld.y = spawn.y * S + S / 2;
              moveTarget = null;
              attackTarget = null;
              cameraFree = false;
            }
          }
        }
      },
      finishSecretTunnelBattle = (
        winner: Team | null,
        messageText: string,
      ) => {
        if (ended) return;
        battlePhase = "finished";
        battlePhaseTimeLeft = 0;
        battlePhaseEndsAt = 0;
        ended = true;
        setOutcome(winner === null ? "draw" : winner === "blue" ? "win" : "lose");
        setMessage(messageText);
      },
      enterSecretTunnelAssault = () => {
        if (!secretTunnelOverlay || battlePhase !== "prepare") return;
        const connections = evaluateSecretTunnelConnections(
            secretTunnelOverlay,
            { blue: ALLY, red: ENEMY },
          ),
          resolution = resolveSecretTunnelPreparation(connections);
        secretBlueConnected = connections.blue.valid;
        secretRedConnected = connections.red.valid;
        if (resolution.phase === "finished") {
          finishSecretTunnelBattle(
            resolution.winner,
            resolution.reason === "blue-isolated"
              ? "굴착 작전 실패 · 아군 고립 패배"
              : resolution.reason === "red-isolated"
                ? "적 굴착망 고립 · 준비 단계 승리"
                : "쌍방 작전 실패 · 무승부",
          );
          return;
        }
        const contact = selectSecretTunnelContact(
          secretTunnelOverlay,
          { blue: ALLY, red: ENEMY },
        )?.contact ?? connections.blue.contact ?? connections.red.contact;
        if (contact) {
          const shared = shareSecretTunnelBackbone(
            secretTunnelOverlay,
            { blue: ALLY, red: ENEMY },
            contact,
          );
          if (shared.connected) {
            secretTunnelOverlay = shared.overlay;
            burst(contact.x, contact.y, "#ffe071", 26);
          }
        }
        battlePhase = "assault";
        battlePhaseEndsAt = activeMatchConfig?.kind === "online"
          ? onlineRoom?.matchEndsAt ?? Date.now() + SECRET_TUNNEL_ASSAULT_MS
          : 0;
        battlePhaseTimeLeft = activeMatchConfig?.kind === "online"
          ? Math.max(0, battlePhaseEndsAt - Date.now())
          : SECRET_TUNNEL_ASSAULT_MS;
        resetSecretTunnelHeroesToCores();
        spawnClock = 900;
        fillMode = false;
        cancelRouteEdit();
        cancelQuickRouteAim();
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++)
            if (secretTunnelOverlay.tiles[y]?.[x]?.access !== TUNNEL_ACCESS.none) {
              seen[y][x] = true;
              memory[y][x] = { ...tileForLocalTunnelView(x, y) };
            }
        if (!teamMarchRoutes.blue.A.points.length)
          applyTeamRouteTarget("blue", "A", ENEMY.x, ENEMY.y);
        if (!teamMarchRoutes.blue.B.points.length)
          applyTeamRouteTarget("blue", "B", ENEMY.x, ENEMY.y);
        if (!teamMarchRoutes.red.A.points.length)
          applyTeamRouteTarget("red", "A", ALLY.x, ALLY.y);
        if (!teamMarchRoutes.red.B.points.length)
          applyTeamRouteTarget("red", "B", ALLY.x, ALLY.y);
        tone("warning");
        burst(ALLY.x, ALLY.y, "#58e5ef", 34);
        announceSecretPhase("거점 공격 시작", "영웅 전원 귀환 · 4분 침공");
        setMessage("영웅 전원 기지 복귀 · 지반 고정 · A/B 공격로 스캔 완료");
      };
    const pathDistanceMapToGoals = (goals: readonly GridPoint[], team: Team = "blue") => {
      const distances = new Map<string, number>(),
        queue = goals.filter((goal, index) =>
          openForTeam(goal.x, goal.y, team) &&
          goals.findIndex((candidate) => candidate.x === goal.x && candidate.y === goal.y) === index,
        );
      for (const goal of queue) distances.set(`${goal.x},${goal.y}`, 0);
      for (let head = 0; head < queue.length && head < 2000; head++) {
        const p = queue[head],
          distance = distances.get(`${p.x},${p.y}`)!;
        for (const d of DIRS) {
          const x = p.x + d.x,
            y = p.y + d.y,
            key = `${x},${y}`;
          if (distances.has(key) || !openForTeam(x, y, team)) continue;
          distances.set(key, distance + 1);
          queue.push({ x, y });
        }
      }
      return distances;
    },
      pathDistanceMap = (goal: { x: number; y: number }, team: Team = "blue") => pathDistanceMapToGoals([goal], team),
      pathPlanToGoals = (u: Unit, goals: readonly GridPoint[]) => {
      const route = shortestRouteToAny(u, goals, (x, y) => openForTeam(x, y, u.team));
      if (!route) return null;
      if (route.distance === 0)
        return { distance: 0, step: null as GridPoint | null, goal: route.goal };
      const distances = pathDistanceMapToGoals(goals, u.team),
        currentDistance = distances.get(`${u.x},${u.y}`),
        detourAllowance = minionCombatDetourAllowance(
          u.role === "minion" ? u.minionRole : undefined,
          u.blockedMs ?? 0,
        );
      if (currentDistance === undefined) return null;
      const toward = { x: route.goal.x - u.x, y: route.goal.y - u.y },
        candidates = DIRS.map((d) => {
          const x = u.x + d.x,
            y = u.y + d.y,
            distance = distances.get(`${x},${y}`);
          if (
            distance === undefined ||
            (detourAllowance === 0
              ? distance >= currentDistance
              : distance > currentDistance + detourAllowance)
          ) return null;
          const crowd = units.filter(
              (v) =>
                v !== u &&
                v.alive &&
                v.team === u.team &&
                Math.abs(v.x - x) + Math.abs(v.y - y) <= 1,
            ).length,
            reserved = marchReservations.has(`${x},${y}`),
            space = DIRS.filter((n) => openForTeam(x + n.x, y + n.y, u.team)).length,
            cross = toward.x * d.y - toward.y * d.x,
            sideBias = (u.formationSide ?? 0) * Math.sign(cross),
            blocked = occupied(x, y, u) || turretAt(x, y, u.team) || baseAt(x, y) || reserved;
          if (blocked) return null;
          return {
            d,
            x,
            y,
            score:
              distance * 40 +
              crowd * 24 -
              space * 4 -
              sideBias * 7,
          };
        }).filter(Boolean) as Array<{
          d: { x: number; y: number };
          x: number;
          y: number;
          score: number;
        }>;
      candidates.sort(
        (a, b) => a.score - b.score || (u.id % 2 ? a.y - b.y : a.x - b.x),
      );
      const chosen = candidates[0];
      return {
        distance: currentDistance,
        step: chosen?.d ?? null,
        goal: route.goal,
      };
    },
      companionSidestepStepToGoals = (u: Unit, goals: readonly GridPoint[]) => {
        const distances = pathDistanceMapToGoals(goals, u.team),
          currentDistance = distances.get(`${u.x},${u.y}`);
        if (currentDistance === undefined) return null;
        const candidates = DIRS.map((direction) => {
          const x = u.x + direction.x,
            y = u.y + direction.y,
            distance = distances.get(`${x},${y}`);
          if (
            distance === undefined || distance > currentDistance + 1 || !openForTeam(x, y, u.team) ||
            occupied(x, y, u) || turretAt(x, y, u.team) || baseAt(x, y) ||
            marchReservations.has(`${x},${y}`)
          ) return null;
          const crowd = units.filter(
              (ally) =>
                ally !== u && ally.alive && ally.team === u.team &&
                Math.abs(ally.x - x) + Math.abs(ally.y - y) <= 1,
            ).length,
            exits = DIRS.filter((exit) => openForTeam(x + exit.x, y + exit.y, u.team)).length;
          return {
            direction,
            score: distance * 30 + crowd * 18 - exits * 4 + ((u.id + x * 7 + y * 11) % 5),
          };
        }).filter(Boolean) as Array<{ direction: GridPoint; score: number }>;
        candidates.sort((a, b) => a.score - b.score);
        return candidates[0]?.direction ?? null;
      },
      nextPath = (u: Unit, goal: { x: number; y: number }) =>
        pathPlanToGoals(u, [goal])?.step ?? null,
      combatRangeFor = (unit: Unit) =>
        unit.role === "minion" && (unit.minionRole === "shooter" || unit.minionRole === "elite")
          ? Math.ceil(minionDefinition(unit.faction, unit.minionRole).stats.range) +
            (unit.faction === "ai" && performance.now() < tacticalStates[unit.team].offenseUntil
              ? unit.minionRole === "elite" ? ELITE_TACTICAL_EFFECT_SCALE : 1
              : 0) +
            (supportAuraForUnit(unit)?.aura.kind === "range"
              ? supportAuraForUnit(unit)?.value ?? 0
              : 0)
          : unit.role === "hero"
            ? Math.max(1.5, HEROES.find((definition) => definition.id === unit.heroId)?.stats.range ?? 1.5)
            : 1.5,
      combatApproachPlan = (
        attacker: Unit,
        target: { x: number; y: number },
        range = combatRangeFor(attacker),
      ) => {
        const goals = attackPositionCandidates(
          target,
          range,
          (x, y) =>
            openForTeam(x, y, attacker.team) &&
            (!occupied(x, y, attacker) || (x === attacker.x && y === attacker.y)) &&
            !turretAt(x, y, attacker.team) &&
            !baseAt(x, y),
          (from, to) => clearRay(from.x, from.y, to.x, to.y, attacker.team),
        );
        return pathPlanToGoals(attacker, goals);
      },
      coordinatedMinionApproachPlan = (attacker: Unit, target: Unit) => {
        const range = combatRangeFor(attacker),
          now = performance.now(),
          goals = attackPositionCandidates(
            target,
            range,
            (x, y) => openForTeam(x, y, attacker.team) && !turretAt(x, y, attacker.team) && !baseAt(x, y),
            (from, to) => clearRay(from.x, from.y, to.x, to.y, attacker.team),
          ),
          approachDistances = pathDistanceMap(attacker, attacker.team),
          candidates = goals.flatMap((goal) => {
            const routeDistance = approachDistances.get(`${goal.x},${goal.y}`);
            if (routeDistance === undefined) return [];
            const occupant = units.some(
                (unit) =>
                  unit !== attacker && unit.alive && unit.team === attacker.team &&
                  unit.x === goal.x && unit.y === goal.y,
              ),
              crowd = units.filter(
                (unit) =>
                  unit !== attacker && unit.alive && unit.team === attacker.team &&
                  Math.abs(unit.x - goal.x) + Math.abs(unit.y - goal.y) <= 1,
              ).length,
              reservedByAlly = units.some(
                (unit) =>
                  unit !== attacker && unit.alive && unit.team === attacker.team &&
                  unit.aiApproachTargetId === target.id &&
                  unit.aiApproachX === goal.x && unit.aiApproachY === goal.y &&
                  (unit.aiApproachUntil ?? 0) >= now,
              );
            return [{
              x: goal.x,
              y: goal.y,
              routeDistance,
              targetDistance: Math.hypot(goal.x - target.x, goal.y - target.y),
              crowd,
              occupied: occupant,
              reserved:
                combatSlotReservations.has(`${target.id}:${goal.x},${goal.y}`) ||
                reservedByAlly,
            }];
          }),
          remembered = (attacker.aiApproachUntil ?? 0) >= now &&
              attacker.aiApproachTargetId === target.id
            ? candidates.find(
                (candidate) =>
                  candidate.x === attacker.aiApproachX &&
                  candidate.y === attacker.aiApproachY &&
                  !candidate.occupied && !candidate.reserved,
              )
            : undefined,
          available = candidates.some((candidate) => !candidate.occupied)
            ? candidates.filter((candidate) => !candidate.occupied)
            : candidates,
          slot = remembered ?? chooseCombatApproachSlot(
            attacker.id,
            attacker.minionRole ?? "breaker",
            range,
            target,
            available,
          );
        if (!slot) return combatApproachPlan(attacker, target, range);
        attacker.aiApproachTargetId = target.id;
        attacker.aiApproachX = slot.x;
        attacker.aiApproachY = slot.y;
        attacker.aiApproachUntil = now + MINION_COMBAT_SLOT_MEMORY_MS;
        combatSlotReservations.add(`${target.id}:${slot.x},${slot.y}`);
        return pathPlanToGoals(attacker, [slot]);
      };
    const reachableEnemyInstallation = (
      u: Unit,
      blockersOnly = false,
    ) => {
      const startKey = `${u.x},${u.y}`,
        queue = [{ x: u.x, y: u.y }],
        distances = new Map<string, number>([[startKey, 0]]);
      for (let head = 0; head < queue.length && head < 2000; head++) {
        const current = queue[head],
          distance = distances.get(`${current.x},${current.y}`)!;
        for (const direction of DIRS) {
          const x = current.x + direction.x,
            y = current.y + direction.y,
            key = `${x},${y}`;
          if (
            distances.has(key) ||
            !openForTeam(x, y, u.team) ||
            turretAt(x, y) ||
            baseAt(x, y)
          )
            continue;
          distances.set(key, distance + 1);
          queue.push({ x, y });
        }
      }
      const candidates = turrets
        .filter(
          (turret) =>
            turret.hp > 0 &&
            turret.campaignActivated !== false &&
            turret.team !== u.team &&
            (!blockersOnly || buildDef(turret.kind).category === "blocker"),
        )
        .flatMap((turret) =>
          DIRS.flatMap((direction) => {
            const approach = {
                x: turret.x + direction.x,
                y: turret.y + direction.y,
              },
              distance = distances.get(`${approach.x},${approach.y}`);
            return distance === undefined
              ? []
              : [{ turret, approach, distance }];
          }),
        )
        .sort(
          (a, b) =>
            a.distance - b.distance ||
            (buildDef(a.turret.kind).category === "blocker" ? -1 : 1),
        );
      return candidates[0];
    };
    const nextHeroPath = (
      goal: { x: number; y: number },
      stopAdjacent = false,
    ) => {
      if (
        stopAdjacent &&
        Math.max(Math.abs(hero.x - goal.x), Math.abs(hero.y - goal.y)) === 1
      )
        return null;
      const direct = {
          x: goal.x * S + S / 2 - heroWorld.x,
          y: goal.y * S + S / 2 - heroWorld.y,
        },
        d = unitVector(direct.x, direct.y),
        probe = Math.min(14, Math.hypot(direct.x, direct.y));
      if (
        heroWorldClear(heroWorld.x + d.x * probe, heroWorld.y + d.y * probe) ||
        directDrillTarget(d)
      )
        return direct;
      const targets =
          stopAdjacent || !open(goal.x, goal.y)
            ? DIRS.map((step) => ({
                x: goal.x + step.x,
                y: goal.y + step.y,
              })).filter((p) => open(p.x, p.y))
            : [goal],
        targetKeys = new Set(targets.map((p) => `${p.x},${p.y}`)),
        startKey = `${hero.x},${hero.y}`,
        queue = [{ x: hero.x, y: hero.y }],
        parents = new Map<string, string | null>([[startKey, null]]);
      let found: string | null = targetKeys.has(startKey) ? startKey : null;
      for (let head = 0; head < queue.length && !found; head++) {
        const current = queue[head];
        for (const step of DIRS) {
          const nx = current.x + step.x,
            ny = current.y + step.y,
            key = `${nx},${ny}`;
          if (
            parents.has(key) ||
            !open(nx, ny) ||
            turretAt(nx, ny) ||
            baseAt(nx, ny)
          )
            continue;
          parents.set(key, `${current.x},${current.y}`);
          queue.push({ x: nx, y: ny });
          if (targetKeys.has(key)) {
            found = key;
            break;
          }
        }
      }
      if (!found) {
        // 열린 길이 아직 없으면 명령을 취소하지 않고 목표 방향의 굴착 가능한 경계를 고른다.
        const digStep = DIRS.map((step) => {
          const x = hero.x + step.x,
            y = hero.y + step.y,
            tile = grid[y]?.[x];
          if (!tile || tile.type === 4 || turretAt(x, y) || baseAt(x, y)) return null;
          return {
            step,
            score:
              Math.abs(goal.x - x) + Math.abs(goal.y - y) +
              (open(x, y) ? 0 : 0.35) +
              (occupied(x, y, hero) ? 20 : 0),
          };
        }).filter(Boolean) as Array<{ step: { x: number; y: number }; score: number }>;
        digStep.sort((a, b) => a.score - b.score);
        return digStep[0]
          ? { x: digStep[0].step.x * S, y: digStep[0].step.y * S }
          : null;
      }
      let nextKey = found,
        parent = parents.get(nextKey);
      while (parent && parent !== startKey) {
        nextKey = parent;
        parent = parents.get(nextKey);
      }
      if (nextKey === startKey) return direct;
      const [nx, ny] = nextKey.split(",").map(Number);
      return {
        x: nx * S + S / 2 - heroWorld.x,
        y: ny * S + S / 2 - heroWorld.y,
      };
    };
    const pickTeamSpawnCell = (
        team: Team,
        candidates: readonly GridPoint[],
        ignore?: Unit,
      ) => {
        const available = (cell: GridPoint) =>
          openForTeam(cell.x, cell.y, team) &&
          !occupied(cell.x, cell.y, ignore, team) &&
          !turretAt(cell.x, cell.y, team) &&
          !baseAt(cell.x, cell.y);
        return candidates.find(available);
      },
      spawnMinion = (
      team: Team,
      index: number,
      role: MinionRole,
      campaignThreat?: "runner" | "vanguard" | "boss",
      campaignPower: 1 | 2 = 1,
      campaignName?: string,
      campaignWaveId?: 1 | 2,
      campaignEscort = false,
      campaignFollower = false,
      campaignZone?: 1 | 2 | 3,
      emergencyReinforcement = false,
    ) => {
      if (role === "elite" && units.some(
        (unit) => unit.alive && unit.team === team && unit.role === "minion" && unit.minionRole === "elite",
      )) return false;
      const activeLimit = isCampaign && campaignChapter === 1 && team === "red"
        ? CAMPAIGN1_MAX_ACTIVE_INVADERS
        : isCampaign && (campaignChapter === 4 || campaignChapter === 5) && team === "red"
          ? 24
          : emergencyReinforcement ? REINFORCEMENT_MINION_CAP : REGULAR_MINION_CAP;
      if (
        units.filter((u) => u.alive && u.team === team && u.role === "minion")
          .length >= activeLimit
      )
        return false;
      const campaignZones = campaignChapter === 1
          ? [CAMPAIGN1_VENT]
          : campaignChapter === 2
          ? [{ x: 20, y: 18 }, { x: 25, y: 27 }, { x: 34, y: 18 }, { x: 42, y: 22 }, { x: 47, y: 18 }]
          : campaignChapter === 4
            ? [{ x: 20, y: 10 }, { x: 22, y: 26 }, { x: 35, y: 17 }, { x: 45, y: 27 }, ENEMY]
            : campaignChapter === 5
              ? campaignZone === 1
                ? [{ x: 10, y: 17 }, { x: 19, y: 24 }, { x: 24, y: 28 }]
                : campaignZone === 2
                  ? [{ x: 32, y: 11 }, { x: 36, y: 15 }, { x: 39, y: 17 }]
                  : [{ x: 47, y: 9 }, { x: 50, y: 12 }]
              : [ENEMY],
        b = team === "blue" && campaignEscort
          ? { x: ALLY.x + 6, y: ALLY.y + index - 1 }
          : team === "red" && isCampaign
            ? campaignZones[index % campaignZones.length]
            : team === "blue" ? ALLY : ENEMY,
        spawnCandidates = [
          { x: b.x, y: b.y }, { x: b.x - 1, y: b.y }, { x: b.x + 1, y: b.y },
          { x: b.x, y: b.y + 1 }, { x: b.x, y: b.y - 1 }, { x: b.x - 2, y: b.y },
          { x: b.x + 2, y: b.y }, { x: b.x - 1, y: b.y + 1 }, { x: b.x + 1, y: b.y + 1 },
          { x: b.x, y: b.y - 2 }, { x: b.x, y: b.y + 2 }, { x: b.x - 1, y: b.y - 1 },
          { x: b.x + 1, y: b.y - 1 }, { x: b.x - 2, y: b.y + 1 }, { x: b.x + 2, y: b.y + 1 },
        ],
        spawn = pickTeamSpawnCell(team, spawnCandidates),
        x = spawn?.x ?? b.x,
        y = spawn?.y ?? b.y,
        dir = team === "blue" ? 1 : -1;
      if (!spawn) return false;
      const faction: FactionId =
          team === "blue" ? playerDef.faction : enemyFaction,
        def = minionDefinition(faction, role),
        unitMinionLevel = isCampaign && team === "red" ? 1 : minionLevels[team],
        growth = MINION_LEVELS[unitMinionLevel - 1],
        campaignAllyHp = isCampaign && team === "blue" ? campaignBalance.allyHp : 1,
        campaignAllyDamage = isCampaign && team === "blue" ? campaignBalance.allyDamage : 1,
        threatHp = campaignThreat === "runner" ? 0.7 : campaignThreat === "boss" ? 5.2 : campaignThreat === "vanguard" ? 2.7 : 1,
        threatDamage = campaignThreat === "runner" ? 3 : campaignThreat === "boss" ? 1.9 : campaignThreat === "vanguard" ? 1.35 : 1,
        threatSpeed = campaignThreat === "runner" ? 1.8 : campaignThreat === "boss" ? 0.68 : campaignThreat === "vanguard" ? 0.78 : 1,
        phaseHp = campaignPower === 2 ? 1.75 : 1,
        phaseDamage = campaignPower === 2 ? 1.7 : 1,
        phaseSpeed = campaignPower === 2 ? 1.12 : 1,
        chapter1Defender = isCampaign && campaignChapter === 1 && team === "blue",
        maxHp = def.stats.maxHp * growth.hp * threatHp * phaseHp * (chapter1Defender ? 1.8 : 1) * campaignAllyHp,
        routeId = team === "blue" || activeMatchConfig?.kind === "online"
          ? chooseSpawnRoute(team, index)
          : undefined,
        formationSide: -1 | 0 | 1 = role === "escort" || role === "elite" ? 0 : index % 2 ? -1 : 1;
      const spawnedMinion = createMinionUnit({
        id: unitId++,
        x,
        y,
        team,
        name: campaignName ?? (campaignThreat === "runner" ? "환풍구 침투충" : campaignThreat === "boss" ? "버그본 군체장" : campaignThreat === "vanguard" ? "군체 선두" : campaignPower === 2 ? `강화 ${def.name}` : def.name),
        hp: maxHp,
        maxHp,
        dir: { x: dir, y: 0 },
        act: 200,
        attack: def.stats.damage * growth.damage * threatDamage * phaseDamage * (chapter1Defender ? 1.25 : 1) * campaignAllyDamage,
        attackInterval: campaignThreat === "runner" ? def.stats.attackInterval * 0.72 : def.stats.attackInterval,
        armor: def.stats.armor + (campaignThreat === "boss" ? 13 : campaignThreat === "vanguard" ? 7 : 0) + (campaignPower === 2 ? 5 : 0) + (chapter1Defender ? 10 : 0),
        critChance: def.stats.critChance + growth.critBonus,
        critMultiplier: def.stats.critMultiplier,
        moveSpeed: def.stats.moveSpeed * growth.speed * threatSpeed * phaseSpeed,
        faction,
        minionRole: role,
        level: unitMinionLevel,
        shieldDamage: (def.shieldDamage ?? 0) * (campaignThreat === "runner" ? 3 : campaignThreat === "boss" ? 2 : campaignThreat === "vanguard" ? 1.4 : 1) * phaseDamage,
        campaignThreat,
        campaignPower,
        minionVisual: "idle",
        minionVisualUntil: 0,
        blockedMs: 0,
        noPathMs: 0,
        congestionDigCd: 0,
        aiCohort: wave,
        routeId,
        onlineSyncId: activeMatchConfig?.kind === "online"
          ? `${canonicalTeamFor(team)}:${wave}:${index}`
          : undefined,
        routePointIndex: 0,
        routeWaitMs: 0,
        routeRetreating: false,
        formationSide,
        campaignAdvanceX: isCampaign && campaignChapter === 1 && team === "red" ? x : undefined,
        campaignAdvanceStallMs: 0,
        campaignRegroups: 0,
        campaignWaveId,
        campaignLastProgressAt: performance.now(),
        campaignEscort,
        campaignFollower,
        campaignSentry: isCampaign && team === "red" && isCampaignSentryChapter(campaignChapter),
        campaignGuardX: isCampaign && team === "red" && isCampaignSentryChapter(campaignChapter) ? x : undefined,
        campaignGuardY: isCampaign && team === "red" && isCampaignSentryChapter(campaignChapter) ? y : undefined,
        campaignZone,
      });
      if (performance.now() < tacticalStates[team].defenseUntil) {
        const scale = role === "elite" ? ELITE_TACTICAL_EFFECT_SCALE : 1;
        if (faction === "bugborn") spawnedMinion.tacticalShield = spawnedMinion.maxHp * 0.25 * scale;
        if (faction === "ai") spawnedMinion.tacticalBlocks = Math.max(1, Math.round(2 * scale));
      }
      const supportEffect = supportAuraForUnit(spawnedMinion),
        support = supportEffect?.turret;
      if (supportEffect && support) {
        const signalColor = faction === "human" ? "#63e9ff" : faction === "bugborn" ? "#b7ef61" : "#ff9b55";
        for (let signal = 1; signal <= 6; signal++) {
          const progress = signal / 7;
          dust.push({
            x: (support.x + (spawnedMinion.x - support.x) * progress) * S + S / 2,
            y: (support.y + (spawnedMinion.y - support.y) * progress) * S + S / 2,
            life: 380 + signal * 28,
            color: signalColor,
          });
        }
        burst(spawnedMinion.x, spawnedMinion.y, signalColor, 9);
      }
      units.push(spawnedMinion);
      return true;
    };
    const applyTeamMinionLevel = (team: Team, next: MinionLevel) => {
      minionLevels[team] = next;
      const growth = MINION_LEVELS[next - 1];
      for (const unit of units.filter(
        (candidate) => candidate.alive && candidate.role === "minion" && candidate.team === team,
      )) {
        const definition = minionDefinition(
            unit.faction,
            unit.minionRole ?? "breaker",
          ),
          hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
        unit.level = next;
        unit.maxHp = definition.stats.maxHp * growth.hp;
        unit.hp = unit.maxHp * hpRatio;
        unit.attack = definition.stats.damage * growth.damage;
        unit.moveSpeed = definition.stats.moveSpeed * growth.speed;
        unit.critChance = definition.stats.critChance + growth.critBonus;
      }
    },
      researchMinionTeam = (team: Team) => {
        if (isCampaign) return false;
        const research = nextMinionResearch(minionLevels[team]);
        if (!research || !minionResearchReady(research.level, wave) || !spendTeamCredits(team, research.cost)) return false;
        applyTeamMinionLevel(team, research.level);
        if (team === "blue") {
          tone("build");
          setMessage(`진군대 연구 완료 · LV.${research.level} · 출전 중 병력에도 즉시 적용`);
        }
        return true;
      },
      reserveEliteTeam = (team: Team) => {
        if (isCampaign) return false;
        const state = eliteDeployments[team],
          activeElites = units.filter((unit) => unit.alive && unit.team === team && unit.role === "minion" && unit.minionRole === "elite").length;
        if (!canReserveElite({ wave, credits: teamCredits(team), state, activeElites })) return false;
        if (!spendTeamCredits(team, ELITE_RESERVATION_COST)) return false;
        state.reserved = true;
        if (team === "blue") {
          tone("build");
          setMessage(`정예병 예약 완료 · 제 ${wave + 1} 진군대 한 자리를 대체해 출전`);
        }
        return true;
      };
    if (isCampaign && campaignChapter === 1) {
      (
        ["escort", "breaker", "shooter"] as MinionRole[]
      ).forEach((role, index) =>
        spawnQueue.push({ team: "blue", role, index, delay: index * 140 }),
      );
    }
    if (isCampaign && campaignChapter === 2) {
      (["escort", "breaker", "shooter"] as MinionRole[]).forEach((role, index) =>
        spawnQueue.push({ team: "blue", role, index, delay: index * 120, campaignEscort: true }),
      );
      (["escort", "breaker", "shooter", "breaker", "escort", "shooter", "breaker", "shooter", "breaker", "escort", "shooter", "breaker", "escort", "shooter"] as MinionRole[]).forEach((role, index) =>
        spawnQueue.push({ team: "red", role, index, delay: 900 + index * 560, campaignPower: index >= 7 ? 2 : 1 }),
      );
      spawnQueue.push({ team: "red", role: "breaker", index: 13, delay: 4600, campaignThreat: "boss", campaignPower: 2, campaignName: "협곡 포식자" });
    }
    if (isCampaign && campaignChapter === 4) {
      enemyShield = 0;
      enemyHp = 900;
      (["escort", "breaker"] as MinionRole[]).forEach((role, index) =>
        spawnQueue.push({ team: "blue", role, index, delay: index * 180, campaignFollower: true }),
      );
      for (let index = 0; index < 18; index++)
        spawnQueue.push({
          team: "red",
          role: index % 3 === 0 ? "shooter" : index % 3 === 1 ? "breaker" : "escort",
          index,
          delay: index * 80,
          campaignThreat: index === 9 ? "vanguard" : undefined,
          campaignPower: index >= 8 ? 2 : 1,
          campaignZone: index < 6 ? 1 : index < 13 ? 2 : 3,
        });
    }
    if (isCampaign && campaignChapter === 5) {
      (["escort", "breaker", "shooter", "escort", "breaker", "shooter"] as MinionRole[]).forEach((role, index) =>
        spawnQueue.push({ team: "blue", role, index, delay: index * 180, campaignFollower: true }),
      );
      for (let index = 0; index < 20; index++)
        spawnQueue.push({
          team: "red",
          role: index % 4 === 0 ? "shooter" : "breaker",
          index: index % 3,
          delay: index * 80,
          campaignThreat: index === 5 || index === 14 ? "boss" : index % 7 === 6 ? "vanguard" : undefined,
          campaignPower: index >= 8 ? 2 : 1,
          campaignZone: index < 8 ? 1 : index < 15 ? 2 : 3,
          campaignName: index === 5 ? "굴착군체장 갈퀴" : index === 14 ? "굴착군체장 독니" : undefined,
        });
    }
    const queueCampaignWave = (phase: 1 | 2) => {
      const count = CAMPAIGN1_WAVE_COUNTS[phase],
        runnerEvery = phase === 1 ? 6 : 4,
        vanguardEvery = phase === 1 ? 10 : 7;
      for (let index = 0; index < count; index++) {
        const campaignThreat = index % runnerEvery === runnerEvery - 1 ? "runner" : index % vanguardEvery === vanguardEvery - 1 ? "vanguard" : undefined;
        spawnQueue.push({
          team: "red",
          role: campaignThreat ? "breaker" : index % 4 === 0 ? "escort" : index % 4 === 1 ? "shooter" : "breaker",
          index: index % 3,
          delay: index * 120,
          campaignThreat,
          campaignPower: phase,
          campaignWaveId: phase,
        });
      }
      campaignPhase = phase;
      campaignWaveQueued = true;
      wave = phase;
      setMessage(phase === 1 ? "1차 침입 시작 · 환풍구가 열린다!" : "2차 침입 시작 · 강화 군체가 밀려온다!");
    };
    const nearbyAllies = (u: Unit, radius = 2) =>
        units.filter(
          (v) =>
            v.alive &&
            v.role === "minion" &&
            v.team === u.team &&
            Math.abs(v.x - u.x) + Math.abs(v.y - u.y) <= radius,
        ).length,
      tryCongestionDig = (u: Unit, step: { x: number; y: number }) => {
        if (
          u.minionRole !== "breaker" ||
          (u.blockedMs ?? 0) < 1000 ||
          (u.congestionDigCd ?? 0) > 0 ||
          nearbyAllies(u) < 3
        )
          return false;
        const sides = step.x
          ? [
              { x: 0, y: -1 },
              { x: 0, y: 1 },
            ]
          : [
              { x: -1, y: 0 },
              { x: 1, y: 0 },
            ];
        sides.sort((a, b) => {
          const ga =
              Math.abs(
                u.x + a.x + step.x - (u.team === "blue" ? ENEMY : ALLY).x,
              ) +
              Math.abs(
                u.y + a.y + step.y - (u.team === "blue" ? ENEMY : ALLY).y,
              ),
            gb =
              Math.abs(
                u.x + b.x + step.x - (u.team === "blue" ? ENEMY : ALLY).x,
              ) +
              Math.abs(
                u.y + b.y + step.y - (u.team === "blue" ? ENEMY : ALLY).y,
              );
          return ga - gb;
        });
        for (const side of sides) {
          const cells = [
            { x: u.x + side.x, y: u.y + side.y },
            { x: u.x + side.x + step.x, y: u.y + side.y + step.y },
          ];
          if (
            cells.some(
              (p) =>
                !grid[p.y]?.[p.x] ||
                grid[p.y][p.x].type === 4 ||
                baseAt(p.x, p.y) ||
                turretAt(p.x, p.y, u.team),
            )
          )
            continue;
          for (const p of cells)
            if (!openForTeam(p.x, p.y, u.team)) breakTile(u, p.x, p.y, 99);
          const first = cells[0];
          if (openForTeam(first.x, first.y, u.team) && !occupied(first.x, first.y, u)) {
            commitGridMove(u, first.x, first.y, 360);
            u.dir = step;
            u.minionVisual = "move";
            u.minionVisualUntil = performance.now() + 420;
            u.blockedMs = 0;
            u.congestionDigCd = 5000;
            burst(first.x, first.y, "#d39a62", 16);
            setMessage(`${u.name} 혼잡 굴착 · 교전 통로 확장`);
            return true;
          }
        }
        return false;
      },
      tryMinionSidestep = (
        u: Unit,
        objective: { x: number; y: number },
        preferred: { x: number; y: number },
        tick: number,
        allowYield = false,
      ) => {
        const now = performance.now(),
          currentDistance = Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y),
          candidates = DIRS.map((direction) => {
            const x = u.x + direction.x, y = u.y + direction.y,
              tile = grid[y]?.[x];
            if (
              !tile || !openForTeam(x, y, u.team) || occupied(x, y, u) || turretAt(x, y, u.team) ||
              baseAt(x, y) || marchReservations.has(`${x},${y}`) ||
              (
                now < (u.routeReverseLockUntil ?? 0) &&
                x === u.routePreviousX &&
                y === u.routePreviousY
              )
            ) return null;
            const distance = Math.abs(objective.x - x) + Math.abs(objective.y - y);
            if (distance > currentDistance + (allowYield ? 1 : 0)) return null;
            const crowd = units.filter(
              (ally) => ally.alive && ally.team === u.team && ally !== u && Math.abs(ally.x - x) + Math.abs(ally.y - y) <= 1,
            ).length,
              reversePenalty = direction.x === -preferred.x && direction.y === -preferred.y ? 9 : 0,
              forwardBonus = direction.x === preferred.x && direction.y === preferred.y ? -0.7 : 0,
              stableBias = ((u.id * 17 + x * 7 + y * 11) % 9) * 0.035;
            return { direction, x, y, score: distance * 1.8 + crowd * 2.2 + reversePenalty + forwardBonus + stableBias };
          }).filter(Boolean) as Array<{
            direction: { x: number; y: number };
            x: number;
            y: number;
            score: number;
          }>;
        candidates.sort((a, b) => a.score - b.score);
        const choice = candidates[0];
        if (!choice) return false;
        u.dir = choice.direction;
        commitGridMove(u, choice.x, choice.y, Math.max(160, tick * 0.96));
        u.minionVisual = "move";
        u.minionVisualUntil = performance.now() + Math.max(180, tick);
        u.blockedMs = 0;
        return true;
      },
      moveMinionStep = (u: Unit, step: { x: number; y: number }, tick: number) => {
        const nx = u.x + step.x, ny = u.y + step.y,
          reversesRecentStep =
            performance.now() < (u.routeReverseLockUntil ?? 0) &&
            nx === u.routePreviousX &&
            ny === u.routePreviousY;
        u.dir = step;
        if (reversesRecentStep || occupied(nx, ny, u) || turretAt(nx, ny, u.team) || baseAt(nx, ny) || marchReservations.has(`${nx},${ny}`))
          return false;
        commitGridMove(u, nx, ny, Math.max(160, tick * 0.96));
        u.minionVisual = "move";
        u.minionVisualUntil = performance.now() + Math.max(180, tick);
        u.blockedMs = 0;
        return true;
      };
    const guardGoal = (u: Unit) => {
        const slots = [
            { x: -2, y: 2 },
            { x: 0, y: 3 },
            { x: 2, y: 2 },
            { x: -3, y: 1 },
            { x: 3, y: 1 },
          ],
          slot = slots[u.id % slots.length],
          ownCore = u.team === "blue" ? ALLY : ENEMY,
          goal = { x: ownCore.x + slot.x, y: ownCore.y + slot.y };
        return openForTeam(goal.x, goal.y, u.team) && !turretAt(goal.x, goal.y, u.team)
          ? goal
          : { x: ownCore.x, y: ownCore.y + 2 };
      },
      rallyGoal = (u: Unit, point: { x: number; y: number }) => {
        const side = u.formationSide ?? 0,
          back = u.minionRole === "shooter" ? 1 : 0,
          slots = [
            { x: side, y: back },
            { x: -side, y: back },
            { x: 0, y: back },
            { x: side, y: -1 },
            { x: -side, y: -1 },
          ],
          goal = slots
            .map((offset) => ({ x: point.x + offset.x, y: point.y + offset.y }))
            .find(
              (p) => openForTeam(p.x, p.y, u.team) && !turretAt(p.x, p.y, u.team) && !baseAt(p.x, p.y),
            );
        return goal ?? point;
      },
      recallMinion = (u: Unit, label: string) => {
        u.alive = false;
        u.respawn = 650;
        u.minionVisual = "down";
        u.minionVisualUntil = performance.now() + 650;
        burst(u.x, u.y, u.team === "blue" ? "#55d8e9" : "#ef6651", 8);
        if (u.team === "blue") setMessage(label);
      };
    const teamKnowsEnemyCore = (team: Team) => {
        if (enemyCoreIntel[team]) {
          ensureComputerAttackRoutes(team);
          return true;
        }
        const core = team === "blue" ? ENEMY : ALLY,
          spotted = teamHasSpottedCore(units, team, core),
          triangulated = !isCampaign && activeMatchConfig?.kind === "computer" &&
            triangulateCoreAfterTimeout(false, performance.now() - skirmishStartedAt);
        enemyCoreIntel[team] = retainCoreDiscovery(
          enemyCoreIntel[team],
          spotted || triangulated,
        );
        if (enemyCoreIntel[team]) {
          ensureComputerAttackRoutes(team);
          if (triangulated)
            setMessage("전선 소음 분석 완료 · 양 팀이 상대 코어 방향을 특정했다");
          else if (team === "blue") setMessage("상대 코어 발견 · 팀 전술망에 좌표가 영구 공유됐다");
          else if (activeMatchConfig?.kind === "computer")
            setMessage("경고 · 적 정찰대가 우리 코어를 발견해 후속 웨이브가 접근한다");
        }
        return enemyCoreIntel[team];
      },
      clearAssistTarget = (unit: Unit) => {
        unit.assistTargetKind = undefined;
        unit.assistTargetId = undefined;
        unit.assistReason = undefined;
      },
      recentAssistThreat = (unit: Unit, radius = CAMPAIGN_ASSIST_RADIUS) => {
        if ((unit.assistUntil ?? 0) < performance.now() || unit.assistTargetId === undefined) {
          clearAssistTarget(unit);
          return undefined;
        }
        const kind = unit.assistTargetKind ?? "unit",
          routeLimit = unit.campaignSentry ? CAMPAIGN_SENTRY_AGGRO_DISTANCE : radius;
        if (kind === "installation") {
          const installation = turrets.find(
              (candidate) =>
                candidate.id === unit.assistTargetId &&
                candidate.hp > 0 &&
                candidate.team !== unit.team &&
                candidate.campaignActivated !== false,
            ),
            plan = installation ? combatApproachPlan(unit, installation) : null;
          if (!installation || !plan) {
            clearAssistTarget(unit);
            return undefined;
          }
          if (plan.distance > routeLimit) return undefined;
          return { kind: "installation" as const, installation, plan };
        }
        const target = units.find(
            (candidate) =>
              candidate.id === unit.assistTargetId &&
              candidate.alive &&
              candidate.team !== unit.team &&
              candidate.campaignActivated !== false,
          ),
          plan = target ? combatApproachPlan(unit, target) : null;
        if (!target || !plan) {
          clearAssistTarget(unit);
          return undefined;
        }
        if (plan.distance > routeLimit) return undefined;
        return { kind: "unit" as const, unit: target, plan };
      },
      campaignSentryTarget = (unit: Unit) => {
        if (!unit.campaignSentry) return undefined;
        const guard = {
            x: unit.campaignGuardX ?? unit.x,
            y: unit.campaignGuardY ?? unit.y,
          },
          guardDistances = pathDistanceMap(guard, unit.team);
        return units
          .filter(
            (candidate) =>
              candidate.alive &&
              candidate.team !== unit.team &&
              candidate.campaignActivated !== false &&
              (guardDistances.get(`${candidate.x},${candidate.y}`) ?? Infinity) <= CAMPAIGN_SENTRY_AGGRO_DISTANCE,
          )
          .map((candidate) => ({ candidate, plan: combatApproachPlan(unit, candidate) }))
          .filter(({ plan }) => plan && plan.distance <= CAMPAIGN_SENTRY_AGGRO_DISTANCE)
          .sort((a, b) => {
            const scientistPriority = isCampaign && campaignChapter === 2
              ? (a.candidate.role === "scientist" ? -20 : 0) - (b.candidate.role === "scientist" ? -20 : 0)
              : 0;
            return scientistPriority || a.plan!.distance - b.plan!.distance;
          })[0]?.candidate;
      },
      explorationGoal = (unit: Unit) => {
        const now = performance.now(), own = unit.team === "blue" ? ALLY : ENEMY,
          reached = unit.aiSearchGoal && Math.hypot(unit.x - unit.aiSearchGoal.x, unit.y - unit.aiSearchGoal.y) <= 2;
        if (reached && unit.aiSearchGoal)
          searchedBattleSectors[unit.team].add(`${unit.aiSearchGoal.x},${unit.aiSearchGoal.y}`);
        if (!unit.aiSearchGoal || reached || (unit.aiSearchUntil ?? 0) < now) {
          const candidates = battleExplorationSectors(selectedBattleMap, own).filter(
            (point) => grid[point.y]?.[point.x]?.type !== 4,
          ),
            unvisited = candidates.filter(
              (point) => !searchedBattleSectors[unit.team].has(`${point.x},${point.y}`),
            ),
            nearbyFallbacks = DIRS
              .map((direction) => ({ x: own.x + direction.x * 8, y: own.y + direction.y * 8 }))
              .filter((point) => grid[point.y]?.[point.x]?.type !== 4),
            mapFallback = grid.flatMap((row, y) => row.map((tile, x) => ({ tile, x, y })))
              .find(({ tile, x, y }) => tile.type !== 4 && Math.hypot(x - own.x, y - own.y) > 10),
            preferred = unvisited.length ? unvisited : candidates,
            sectors = preferred.length
              ? preferred
              : nearbyFallbacks.length
                ? nearbyFallbacks
                : mapFallback
                  ? [{ x: mapFallback.x, y: mapFallback.y }]
                  : [{ x: own.x, y: own.y }];
          const phase = Math.floor(now / 9000),
            cohort = minionExplorationCohort(unit.aiCohort, unit.id),
            index = Math.abs(cohort * 5 + phase * 3) % sectors.length;
          unit.aiSearchGoal = { ...sectors[index] };
          unit.aiSearchUntil = now + 12000;
        }
        return unit.aiSearchGoal;
      },
      autonomousAdvanceGoal = (unit: Unit, desired: { x: number; y: number }) =>
        reachableFrontierGoal(
          unit,
          desired,
          (x, y) =>
            openForTeam(x, y, unit.team) &&
            ((x === unit.x && y === unit.y) || (!baseAt(x, y) && !turretAt(x, y, unit.team))),
        )?.goal ?? { x: unit.x, y: unit.y },
      tryEmergencyBreach = (unit: Unit, objective: { x: number; y: number }) => {
        const candidates = DIRS
          .map((direction) => ({
            direction,
            tile: grid[unit.y + direction.y]?.[unit.x + direction.x],
          }))
          .sort((a, b) =>
            Math.hypot(unit.x + a.direction.x - objective.x, unit.y + a.direction.y - objective.y) -
            Math.hypot(unit.x + b.direction.x - objective.x, unit.y + b.direction.y - objective.y));
        const breach = candidates.find(({ tile }) => canEmergencyBreach({
          minionRole: unit.minionRole,
          campaignThreat: unit.campaignThreat,
          noPathMs: unit.noPathMs ?? 0,
          team: unit.team,
          tile,
        }));
        if (!breach) return false;
        unit.dir = breach.direction;
        unit.minionVisual = "attack";
        unit.minionVisualUntil = performance.now() + 420;
        breakTile(unit, unit.x + breach.direction.x, unit.y + breach.direction.y, 1);
        unit.act = Math.max(520, unit.attackInterval * 1000);
        return true;
      };
    const stepMinion = (u: Unit) => {
      if (!u.alive || u.act > 0) return;
      const now = performance.now(),
        tacticalOffense = now < tacticalStates[u.team].offenseUntil,
        tacticalScale = u.minionRole === "elite" ? ELITE_TACTICAL_EFFECT_SCALE : 1,
        tacticalMoveBoost = tacticalOffense && u.faction === "human" ? 1 + 0.15 * tacticalScale : 1,
        supportMoveBoost = supportAuraForUnit(u)?.aura.kind === "speed" ? 1 + (supportAuraForUnit(u)?.value ?? 0) : 1,
        moveBoost = tacticalMoveBoost * supportMoveBoost,
        attackDelay = u.attackInterval * 1000 * (
          tacticalOffense && u.faction === "bugborn"
            ? 1 - 0.3 * tacticalScale
            : tacticalOffense && u.faction === "ai"
              ? 1 - 0.25 * tacticalScale
              : 1
        ),
        tick = 1000 / (unitMovementSpeed(u.moveSpeed) * moveBoost * terrainMoveFactor(u.x, u.y));
      const campaign1Invader = isCampaign && campaignChapter === 1 && u.team === "red" && !u.campaignScout;
      if (!isCampaign && u.team === "red") ensureComputerAttackRoutes("red");
      if (campaign1Invader) {
        const watch = campaign1AdvanceWatch(u.campaignAdvanceX, u.x, u.campaignAdvanceStallMs, tick);
        if (watch.bestX !== u.campaignAdvanceX) u.campaignLastProgressAt = performance.now();
        u.campaignAdvanceX = watch.bestX;
        u.campaignAdvanceStallMs = watch.stalledMs;
        if (watch.shouldRegroup) {
          const now = performance.now();
          if (campaign1ShouldForceExit(
            u.campaignRegroups ?? 0,
            u.campaignLastProgressAt ?? now,
            now,
          )) {
            u.alive = false;
            u.hp = 0;
            u.respawn = 0;
            return;
          }
          const coreDistances = pathDistanceMap(ALLY),
            candidates: { x: number; y: number; distance: number }[] = [];
          for (let forward = 4; forward >= 1; forward--)
            for (const offsetY of [0, -1, 1, -2, 2, -3, 3]) {
              const x = u.x - forward,
                y = u.y + offsetY,
                distance = coreDistances.get(`${x},${y}`);
              if (distance === undefined || !openForTeam(x, y, u.team) || occupied(x, y, undefined, u.team) || turretAt(x, y, u.team) || baseAt(x, y)) continue;
              candidates.push({ x, y, distance });
            }
          candidates.sort((a, b) => a.distance - b.distance || a.x - b.x || Math.abs(a.y - ALLY.y) - Math.abs(b.y - ALLY.y));
          const regroup = candidates[0];
          if (regroup) {
            const regroupDuration = unitMovementDuration(520);
            commitGridMove(u, regroup.x, regroup.y, regroupDuration);
            u.campaignAdvanceX = regroup.x;
            u.campaignAdvanceStallMs = 0;
            u.campaignRegroups = (u.campaignRegroups ?? 0) + 1;
            u.blockedMs = 0;
            u.noPathMs = 0;
            u.act = regroupDuration;
            return;
          }
          if (watch.stalledMs >= CAMPAIGN1_RETREAT_AFTER_MS) {
            u.alive = false;
            u.hp = 0;
            u.respawn = 0;
            return;
          }
        }
      }
      if (u.campaignThreat === "runner") {
        const core = u.team === "blue" ? ENEMY : ALLY;
        const adjacentInstallation = nearestEnemyTurret(u, 1);
        if (adjacentInstallation) {
          melee(u, {
            x: adjacentInstallation.x - u.x,
            y: adjacentInstallation.y - u.y,
          });
          u.blockedMs = 0;
          u.noPathMs = 0;
          u.act = attackDelay;
          return;
        }
        if (Math.abs(core.x - u.x) + Math.abs(core.y - u.y) === 1) {
          melee(u, { x: core.x - u.x, y: core.y - u.y }, 0, "coreSiege");
          u.act = attackDelay;
          return;
        }
        let step = nextPath(u, core),
          immediateInstallation = step ? turretAt(u.x + step.x, u.y + step.y) : undefined,
          obstruction = immediateInstallation?.team !== u.team
            ? { turret: immediateInstallation, approach: { x: u.x, y: u.y }, distance: 0 }
            : !step
              ? reachableEnemyInstallation(u)
              : undefined;
        const response = siegeResponse({
          adjacentEnemyInstallation: Boolean(adjacentInstallation),
          pathBlockedByEnemyInstallation: Boolean(immediateInstallation && immediateInstallation.team !== u.team),
          reachableEnemyInstallation: Boolean(obstruction),
        });
        if (response === "attack" && obstruction?.turret) {
          melee(u, {
            x: obstruction.turret.x - u.x,
            y: obstruction.turret.y - u.y,
          });
          u.blockedMs = 0;
          u.noPathMs = 0;
          u.act = attackDelay;
          return;
        }
        if (response === "approach" && obstruction)
          step = nextPath(u, obstruction.approach);
        if (step) {
          u.noPathMs = 0;
          if (!moveMinionStep(u, step, tick)) {
            u.blockedMs = (u.blockedMs ?? 0) + tick;
            if ((u.blockedMs ?? 0) >= 420)
              tryMinionSidestep(u, core, step, tick, (u.blockedMs ?? 0) >= 1700);
          }
        } else {
          u.noPathMs = (u.noPathMs ?? 0) + tick;
          if (tryEmergencyBreach(u, core)) return;
        }
        u.act = tick;
        return;
      }
      u.congestionDigCd = Math.max(0, (u.congestionDigCd ?? 0) - tick);
      const enemyBase = u.team === "blue" ? ENEMY : ALLY,
        knowsEnemyBase = campaign1Invader || !isCampaign || teamKnowsEnemyCore(u.team);
      if (!u.campaignSentry && Math.abs(enemyBase.x - u.x) + Math.abs(enemyBase.y - u.y) === 1) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        melee(u, { x: enemyBase.x - u.x, y: enemyBase.y - u.y }, 0, "coreSiege");
        u.act = attackDelay;
        return;
      }
      const unitRoutes = teamMarchRoutes[u.team];
      if (
        activeRouteIds(u.team).length &&
        (!u.routeId || !unitRoutes[u.routeId].points.length)
      ) assignAvailableRoute(u);
      const currentRoute = u.routeId ? unitRoutes[u.routeId] : undefined,
        hasStrategicRoute = Boolean(currentRoute?.points.length),
        shooterRange = combatRangeFor(u),
        assistThreat = hasStrategicRoute ? undefined : recentAssistThreat(u),
        assistTarget = assistThreat?.kind === "unit" ? assistThreat.unit : undefined,
        assistInstallation = assistThreat?.kind === "installation"
          ? assistThreat.installation
          : undefined,
        sentryTarget = campaignSentryTarget(u),
        escortTarget = isCampaign && campaignChapter === 2 && u.team === "red" && sentryTarget?.role === "scientist"
          ? sentryTarget
          : undefined,
        ranged =
          (u.minionRole === "shooter" || (u.minionRole === "elite" && shooterRange > 2))
            ? assistTarget && Math.hypot(assistTarget.x - u.x, assistTarget.y - u.y) <= shooterRange
              ? assistTarget
              : sentryTarget && Math.hypot(sentryTarget.x - u.x, sentryTarget.y - u.y) <= shooterRange
                ? sentryTarget
                : escortTarget && Math.hypot(escortTarget.x - u.x, escortTarget.y - u.y) <= shooterRange
                  ? escortTarget
              : nearestEnemy(u, shooterRange)
            : undefined,
        rangedTurret =
          (u.minionRole === "shooter" || (u.minionRole === "elite" && shooterRange > 2))
            ? assistInstallation &&
                Math.hypot(assistInstallation.x - u.x, assistInstallation.y - u.y) <= shooterRange
              ? assistInstallation
              : nearestEnemyTurret(u, shooterRange)
            : undefined;
      if (ranged && clearRay(u.x, u.y, ranged.x, ranged.y, u.team)) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        u.dir = cardinal(ranged.x - u.x, ranged.y - u.y);
        fire(
          u,
          ranged.x - u.x,
          ranged.y - u.y,
          "minion",
          u.attack,
          u.minionRole === "elite"
            ? u.faction === "human"
              ? { splash: 0.85 }
              : u.faction === "ai"
                ? { pierce: true }
                : {}
            : {},
        );
        u.act = attackDelay;
        return;
      }
      if (rangedTurret && clearRay(u.x, u.y, rangedTurret.x, rangedTurret.y, u.team)) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        u.dir = cardinal(rangedTurret.x - u.x, rangedTurret.y - u.y);
        fire(
          u,
          rangedTurret.x - u.x,
          rangedTurret.y - u.y,
          "minion",
          u.attack,
          u.minionRole === "elite"
            ? u.faction === "human"
              ? { splash: 0.85 }
              : u.faction === "ai"
                ? { pierce: true }
                : {}
            : {},
        );
        u.act = attackDelay;
        return;
      }
      const close = nearestEnemy(u, 1.5);
      if (close) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        melee(u, { x: close.x - u.x, y: close.y - u.y });
        if (u.minionRole === "elite" && u.faction === "bugborn")
          for (const nearby of units
            .filter((unit) =>
              unit.alive &&
              unit.team !== u.team &&
              unit !== close &&
              canEngageAt(u.team, unit.x, unit.y) &&
              Math.hypot(unit.x - close.x, unit.y - close.y) <= 1.35,
            )
            .slice(0, 2))
            hurt(nearby, u.attack * 0.65, u.team, true, u.critChance, u.critMultiplier, false, {
              attacker: u.name,
              action: "포식 휩쓸기",
              unit: u,
            });
        u.act = attackDelay;
        return;
      }
      const adjacentInstallation = nearestEnemyTurret(u, 1);
      if (adjacentInstallation) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        melee(u, {
          x: adjacentInstallation.x - u.x,
          y: adjacentInstallation.y - u.y,
        });
        u.act = attackDelay;
        return;
      }
      if (assistThreat?.kind === "installation") {
        const installation = assistThreat.installation;
        const installationDistance = Math.hypot(
          installation.x - u.x,
          installation.y - u.y,
        );
        if (installationDistance <= combatRangeFor(u) &&
          clearRay(u.x, u.y, installation.x, installation.y, u.team)) {
          u.blockedMs = 0;
          u.noPathMs = 0;
          melee(u, {
            x: installation.x - u.x,
            y: installation.y - u.y,
          });
          u.act = attackDelay;
          return;
        }
        const chaseStep = assistThreat.plan.step;
        if (chaseStep) {
          u.noPathMs = 0;
          if (!moveMinionStep(u, chaseStep, tick))
            tryMinionSidestep(u, installation, chaseStep, tick, true);
        }
        u.act = tick;
        return;
      }
      const reactionTarget = assistTarget ?? sentryTarget;
      if (reactionTarget) {
        const chaseStep = coordinatedMinionApproachPlan(u, reactionTarget)?.step;
        if (chaseStep) {
          u.noPathMs = 0;
          if (!moveMinionStep(u, chaseStep, tick))
            tryMinionSidestep(u, reactionTarget, chaseStep, tick, true);
        }
        u.act = tick;
        return;
      }
      if (escortTarget) {
        const chaseStep = coordinatedMinionApproachPlan(u, escortTarget)?.step;
        if (chaseStep) {
          if (!moveMinionStep(u, chaseStep, tick)) {
            u.blockedMs = (u.blockedMs ?? 0) + tick;
            if ((u.blockedMs ?? 0) >= 420)
              tryMinionSidestep(u, escortTarget, chaseStep, tick, (u.blockedMs ?? 0) >= 1700);
          }
        }
        u.act = tick;
        return;
      }
      if (u.team === "blue" && u.campaignEscort) {
        const leadScientist = units
          .filter((candidate) => candidate.alive && candidate.role === "scientist")
          .sort((a, b) => (b.escortPointIndex ?? 0) - (a.escortPointIndex ?? 0))[0];
        if (leadScientist) {
          const routeGoal = campaign2EscortRoute[Math.min(
              leadScientist.escortPointIndex ?? 0,
              campaign2EscortRoute.length - 1,
            )],
            direction = cardinal(routeGoal.x - leadScientist.x, routeGoal.y - leadScientist.y),
            ahead = { x: leadScientist.x + direction.x * 4, y: leadScientist.y + direction.y * 4 },
            objective = openForTeam(ahead.x, ahead.y, u.team) ? ahead : routeGoal,
            escortStep = nextPath(u, objective);
          if (escortStep) moveMinionStep(u, escortStep, tick);
          u.act = tick;
          return;
        }
      }
      const stanceBehavior = marchStanceBehavior("assault"),
        capturePoint = currentRoute?.points[currentRoute.points.length - 1],
        priorityRange = hasStrategicRoute
          ? stanceBehavior.pursuitRadius
          : MINION_ENGAGEMENT_RADIUS,
        rememberedEnemy = u.aiTargetId === undefined || (u.aiTargetUntil ?? 0) < now
          ? undefined
          : units.find((candidate) =>
              candidate.id === u.aiTargetId &&
              candidate.alive &&
              candidate.team !== u.team &&
              candidate.campaignActivated !== false
            ),
        rememberedPlan = rememberedEnemy ? combatApproachPlan(u, rememberedEnemy) : null,
        retainedEnemy = rememberedEnemy && rememberedPlan &&
          rememberedPlan.distance <= (hasStrategicRoute ? priorityRange : MINION_PURSUIT_DISTANCE)
          ? rememberedEnemy
          : undefined,
        priorityEnemy = retainedEnemy ?? (campaign1Invader
          ? undefined
          : units
            .filter((candidate) =>
              candidate.alive &&
              candidate.team !== u.team &&
              candidate.campaignActivated !== false &&
              Math.hypot(candidate.x - u.x, candidate.y - u.y) <= priorityRange &&
              !(
                stanceBehavior.captureLeashRadius > 0 &&
                capturePoint &&
                Math.hypot(candidate.x - capturePoint.x, candidate.y - capturePoint.y) >
                  stanceBehavior.captureLeashRadius
              ),
            )
            .map((candidate) => ({ candidate, plan: combatApproachPlan(u, candidate) }))
            .filter(({ plan }) => plan && plan.distance <= priorityRange)
            .sort((a, b) => a.plan!.distance - b.plan!.distance)[0]?.candidate);
      if (priorityEnemy) {
        u.aiTargetId = priorityEnemy.id;
        u.aiTargetUntil = now + MINION_TARGET_MEMORY_MS;
        const chaseStep = coordinatedMinionApproachPlan(u, priorityEnemy)?.step;
        if (chaseStep) {
          u.noPathMs = 0;
          u.routeWaitMs = 0;
          if (!moveMinionStep(u, chaseStep, tick)) {
            u.blockedMs = (u.blockedMs ?? 0) + tick;
            if ((u.blockedMs ?? 0) >= 420)
              tryMinionSidestep(u, priorityEnemy, chaseStep, tick, (u.blockedMs ?? 0) >= 1700);
          }
        }
        u.act = tick;
        return;
      }
      const priorityInstallation = turrets
          .filter((installation) =>
            installation.hp > 0 &&
            installation.team !== u.team &&
            installation.campaignActivated !== false,
          )
          .map((installation) => ({
            installation,
            plan: combatApproachPlan(u, installation),
            directDistance: Math.hypot(installation.x - u.x, installation.y - u.y),
          }))
          .filter((entry) => campaignShouldEngageLocalObjective(
            entry.plan?.distance ?? Infinity,
            false,
            priorityRange,
          ))
          .sort((a, b) => (a.plan?.distance ?? Infinity) - (b.plan?.distance ?? Infinity))[0];
      if (priorityInstallation?.plan) {
        const installation = priorityInstallation.installation;
        if (
          priorityInstallation.directDistance <= combatRangeFor(u) &&
          clearRay(u.x, u.y, installation.x, installation.y, u.team)
        ) {
          u.dir = cardinal(installation.x - u.x, installation.y - u.y);
          melee(u, { x: installation.x - u.x, y: installation.y - u.y });
          u.blockedMs = 0;
        } else if (priorityInstallation.plan.step) {
          const installationStep = priorityInstallation.plan.step;
          if (!moveMinionStep(u, installationStep, tick))
            tryMinionSidestep(u, installation, installationStep, tick, true);
        }
        u.noPathMs = 0;
        u.act = priorityInstallation.directDistance <= combatRangeFor(u) ? attackDelay : tick;
        return;
      }
      const localCorePlan = u.campaignFollower && knowsEnemyBase
          ? combatApproachPlan(u, enemyBase)
          : null,
        localCoreDistance = Math.hypot(enemyBase.x - u.x, enemyBase.y - u.y);
      if (
        u.campaignFollower &&
        campaignShouldEngageLocalObjective(
          localCorePlan?.distance ?? Infinity,
          false,
          priorityRange,
        )
      ) {
        if (
          localCoreDistance <= combatRangeFor(u) &&
          clearRay(u.x, u.y, enemyBase.x, enemyBase.y, u.team)
        ) {
          u.blockedMs = 0;
          u.noPathMs = 0;
          melee(u, { x: enemyBase.x - u.x, y: enemyBase.y - u.y }, 0, "coreSiege");
          u.act = attackDelay;
          return;
        }
        const coreStep = localCorePlan?.step;
        if (coreStep) {
          u.noPathMs = 0;
          if (!moveMinionStep(u, coreStep, tick))
            tryMinionSidestep(u, enemyBase, coreStep, tick, true);
          u.act = tick;
          return;
        }
      }
      const followerHasStrategicRoute = Boolean(
        u.routeId && marchRoutes[u.routeId].points.length,
      );
      if (u.team === "blue" && u.campaignFollower && !followerHasStrategicRoute) {
        const followSlots = [
            { x: -2, y: 1 }, { x: -3, y: -1 }, { x: -3, y: 2 },
            { x: -4, y: 0 }, { x: -3, y: -2 }, { x: -4, y: 2 },
          ],
          followGoals = followSlots
            .map((slot) => ({ x: hero.x + slot.x, y: hero.y + slot.y }))
            .filter((goal) =>
              openForTeam(goal.x, goal.y, u.team) &&
              (!occupied(goal.x, goal.y, u) || (goal.x === u.x && goal.y === u.y)) &&
              !turretAt(goal.x, goal.y, u.team) &&
              !baseAt(goal.x, goal.y),
            ),
          followerStep = pathPlanToGoals(u, followGoals)?.step;
        if (followerStep) moveMinionStep(u, followerStep, tick);
        else {
          u.minionVisual = "idle";
          u.noPathMs = 0;
        }
        u.act = tick;
        return;
      }
      if ((u.aiTargetUntil ?? 0) < now) {
        u.aiTargetId = undefined;
        u.aiTargetUntil = 0;
        u.aiApproachTargetId = undefined;
        u.aiApproachX = undefined;
        u.aiApproachY = undefined;
        u.aiApproachUntil = 0;
      }
      let objective: { x: number; y: number }, route: MarchRoute | undefined;
      if (
        u.team === "blue" ||
        (!isCampaign && activeRouteIds(u.team).length > 0)
      ) {
        const hasAssignedRoute = Boolean(u.routeId && unitRoutes[u.routeId].points.length);
        if (shouldUseCampaign1GuardGoal(isCampaign, campaignChapter, hasAssignedRoute)) {
          objective = guardGoal(u);
          if (Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y) <= 1) {
            u.noPathMs = 0;
            u.blockedMs = 0;
            u.minionVisual = "idle";
            u.act = tick;
            return;
          }
        } else {
          if (!u.routeId || !unitRoutes[u.routeId].points.length)
            assignAvailableRoute(u);
           route = u.routeId ? unitRoutes[u.routeId] : undefined;
           if (route?.points.length) {
            const routePoints = routeTravelPoints(route),
              progress = advanceRouteCursor(
                u,
                routePoints,
                Math.max(0, u.routePointIndex ?? 0),
              ),
              point = progress.goal ?? routePoints.at(-1)!;
            u.routePointIndex = progress.index;
            u.routeRetreating = false;
            u.routeResumeIndex = undefined;
            const last = progress.atEnd,
              assaultContinues = last && stanceBehavior.continuesToCore && knowsEnemyBase;
            objective = assaultContinues ? enemyBase : last ? rallyGoal(u, point) : point;
            if (
              last &&
              !assaultContinues &&
              Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y) <= 1
            ) {
              u.noPathMs = 0;
              u.blockedMs = 0;
              u.minionVisual = "idle";
              u.act = tick;
              return;
            }
          } else {
            // 지시가 없으면 후보 구역을 정찰하고, 코어를 발견한 뒤에는
            // 새 웨이브도 같은 팀 정보를 사용해 자동 공세로 전환한다.
            const desiredObjective = knowsEnemyBase ? enemyBase : explorationGoal(u);
            objective = isCampaign
              ? desiredObjective
              : autonomousAdvanceGoal(u, desiredObjective);
            if (Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y) <= 1) {
              if (
                !isCampaign &&
                !knowsEnemyBase &&
                Math.hypot(desiredObjective.x - u.x, desiredObjective.y - u.y) > 2
              ) {
                u.noPathMs = (u.noPathMs ?? 0) + tick;
                if (u.noPathMs >= AUTONOMOUS_FRONTIER_REPLAN_MS) {
                  searchedBattleSectors[u.team].add(`${desiredObjective.x},${desiredObjective.y}`);
                  u.aiSearchGoal = undefined;
                  u.aiSearchUntil = 0;
                  u.noPathMs = 0;
                }
              }
              u.minionVisual = "idle";
              u.act = tick;
              return;
            }
          }
        }
      } else if (u.campaignSentry) {
        objective = {
          x: u.campaignGuardX ?? u.x,
          y: u.campaignGuardY ?? u.y,
        };
        if (Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y) <= 1) {
          u.noPathMs = 0;
          u.blockedMs = 0;
          u.minionVisual = "idle";
          u.act = tick;
          return;
        }
      } else {
        const desiredObjective = knowsEnemyBase ? enemyBase : explorationGoal(u);
        objective = isCampaign
          ? desiredObjective
          : autonomousAdvanceGoal(u, desiredObjective);
        if (
          !isCampaign &&
          !knowsEnemyBase &&
          Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y) <= 1 &&
          Math.hypot(desiredObjective.x - u.x, desiredObjective.y - u.y) > 2
        ) {
          u.noPathMs = (u.noPathMs ?? 0) + tick;
          if (u.noPathMs >= AUTONOMOUS_FRONTIER_REPLAN_MS) {
            searchedBattleSectors[u.team].add(`${desiredObjective.x},${desiredObjective.y}`);
            u.aiSearchGoal = undefined;
            u.aiSearchUntil = 0;
            u.noPathMs = 0;
          }
          u.minionVisual = "idle";
          u.act = tick;
          return;
        }
      }
      let movementPlan = pathPlanToGoals(u, [objective]),
        step = movementPlan?.step ?? null;
      if (!step) {
        const obstruction = reachableEnemyInstallation(u, true);
        if (obstruction) {
          objective = obstruction.approach;
          movementPlan = pathPlanToGoals(u, [objective]);
          step = movementPlan?.step ?? null;
        }
      }
      if (step) {
        u.noPathMs = 0;
        u.routeWaitMs = 0;
        u.dir = step;
        if (!moveMinionStep(u, step, tick)) {
          u.blockedMs = (u.blockedMs ?? 0) + tick;
          const recovered = (u.blockedMs ?? 0) >= 420 &&
            tryMinionSidestep(u, objective, step, tick, (u.blockedMs ?? 0) >= 1700);
          if (!recovered) tryCongestionDig(u, step);
          if ((u.blockedMs ?? 0) >= 3200) {
            u.aiSearchGoal = undefined;
            u.aiSearchUntil = 0;
            u.routeWaitMs = (u.routeWaitMs ?? 0) + tick;
          }
        }
      } else if (movementPlan && movementPlan.distance > 0) {
        // The route still exists, but every immediate candidate is occupied or
        // reserved. Treat this as traffic, not as a broken A/B tunnel.
        u.noPathMs = 0;
        u.routeWaitMs = 0;
        u.blockedMs = (u.blockedMs ?? 0) + tick;
        const preferred = cardinal(objective.x - u.x, objective.y - u.y),
          recovered = tryMinionSidestep(u, objective, preferred, tick, true);
        if (!recovered) tryCongestionDig(u, preferred);
      } else {
        u.blockedMs = 0;
        u.noPathMs = (u.noPathMs ?? 0) + tick;
        if (tryEmergencyBreach(u, objective)) return;
        if (!isCampaign && !route) {
          if (!knowsEnemyBase && u.noPathMs >= 1800) {
            u.aiSearchGoal = undefined;
            u.aiSearchUntil = 0;
            u.noPathMs = 0;
          }
          u.minionVisual = "idle";
          u.act = tick;
          return;
        }
        if (u.campaignSentry || u.campaignFollower) {
          u.noPathMs = 0;
          u.aiSearchGoal = undefined;
          u.aiSearchUntil = 0;
          u.act = 600;
          return;
        }
        if (route && u.noPathMs >= 3000 && u.noPathMs < 7000) {
          const routePoints = routeTravelPoints(route),
            currentIndex = Math.max(0, u.routePointIndex ?? 0),
            rejoin = forwardRouteRejoin(
              u,
              routePoints,
              currentIndex,
              (x, y) => openForTeam(x, y, u.team),
            );
          if (rejoin.plan && (rejoin.plan.distance > 0 || rejoin.index > currentIndex)) {
            u.routePointIndex = rejoin.index;
            u.routeRetreating = false;
            u.routeResumeIndex = undefined;
            u.routeWaitMs = 0;
            u.noPathMs = 0;
          }
        }
        if ((!route && u.noPathMs >= 5000) || (route && u.noPathMs >= 7000))
          recallMinion(
            u,
            route
              ? `${route.id} 전방 경로 복구 불가 · ${u.name} 회수`
              : `${u.name} 경로 상실 · 회수`,
          );
      }
      u.act = tick;
    };
    const drawMarchRoutes = (onMinimap = false) => {
      if (isSecretTunnel && battlePhase === "prepare" && !routeEdit) return;
      for (const id of ["A", "B"] as RouteId[]) {
        if (isSecretTunnel && battlePhase === "prepare") continue;
        const route = marchRoutes[id],
          target = route.points.at(-1);
        if (!target) continue;
        const plannedCells = routeTravelPoints(route),
          guide = route.plannedCells.length
            ? {
                cells: [{ ...ALLY }, ...plannedCells],
                complete: plannedCells.every((cell) => open(cell.x, cell.y)),
              }
            : stitchRoutePoints(ALLY, route.points, open),
          cells = guide.cells,
          scaleX = onMinimap ? minimap.w / COLS : S,
          scaleY = onMinimap ? minimap.h / ROWS : S,
          originX = onMinimap ? minimap.x : -cam.x,
          originY = onMinimap ? minimap.y : -cam.y,
          broken = !guide.complete;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = routeEdit
          ? onMinimap ? 0.16 : id === routeEdit ? 0.13 : 0.2
          : onMinimap ? 0.48 : 0.38;
        ctx.fillStyle = broken ? "#ff7668" : route.color;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = onMinimap ? 1 : 2;
        const stride = onMinimap ? 5 : 2;
        for (let i = 1; i < cells.length; i += stride) {
          const prev = cells[Math.max(0, i - 1)],
            cell = cells[i];
          if (!seen[prev.y]?.[prev.x] || !seen[cell.y]?.[cell.x]) continue;
          const dx = cell.x - prev.x,
            dy = cell.y - prev.y,
            x = originX + (cell.x + 0.5) * scaleX,
            y = originY + (cell.y + 0.5) * scaleY,
            angle = Math.atan2(dy * scaleY, dx * scaleX);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(onMinimap ? 3 : 8, 0);
          ctx.lineTo(onMinimap ? -2 : -7, onMinimap ? -2 : -6);
          ctx.lineTo(onMinimap ? 0 : -3, 0);
          ctx.lineTo(onMinimap ? -2 : -7, onMinimap ? 2 : 6);
          ctx.closePath();
          if (id === "A") ctx.fill();
          else ctx.stroke();
          ctx.restore();
        }
        if (!onMinimap && seen[target.y]?.[target.x]) {
          const x = target.x * S + S / 2 - cam.x,
            y = target.y * S + S / 2 - cam.y;
          ctx.globalAlpha = 0.82;
          ctx.fillStyle = "#071012d9";
          ctx.strokeStyle = broken ? "#ff7163" : route.color;
          ctx.lineWidth = 2;
          ctx.fillRect(x - 20, y - 18, 40, 14);
          ctx.strokeRect(x - 20, y - 18, 40, 14);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          const label = broken
            ? `${id} 단절`
            : route.pathMode === "flank"
              ? `${id} 우회`
              : route.pathMode === "shared"
                ? `${id} 공용`
                : `${id} 전략`;
          ctx.fillText(label, x, y - 8);
        }
        ctx.restore();
      }
      if (!routeEdit || !routeDraftCells.length) return;
      const scaleX = onMinimap ? minimap.w / COLS : S,
        scaleY = onMinimap ? minimap.h / ROWS : S,
        originX = onMinimap ? minimap.x : -cam.x,
        originY = onMinimap ? minimap.y : -cam.y,
        draftCells = [{ ...ALLY }, ...routeDraftCells];
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "#ffe071";
      ctx.fillStyle = "#ffe071";
      ctx.lineWidth = onMinimap ? 2 : 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(onMinimap ? [3, 2] : [12, 7]);
      if (!onMinimap) {
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 7;
      }
      ctx.beginPath();
      let drawing = false;
      for (const cell of draftCells) {
        if (!seen[cell.y]?.[cell.x]) {
          drawing = false;
          continue;
        }
        const x = originX + (cell.x + 0.5) * scaleX,
          y = originY + (cell.y + 0.5) * scaleY;
        if (!drawing) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        drawing = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (!onMinimap)
        routeDraftPoints.forEach((point, index) => {
          if (!seen[point.y]?.[point.x]) return;
          const x = point.x * S + S / 2 - cam.x,
            y = point.y * S + S / 2 - cam.y,
            finalPoint = index === routeDraftPoints.length - 1;
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = finalPoint ? "#fff0a6" : "#13201f";
          ctx.strokeStyle = "#ffe071";
          ctx.lineWidth = finalPoint ? 4 : 3;
          ctx.beginPath();
          ctx.arc(x, y, finalPoint ? 14 : 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = finalPoint ? "#251b06" : "#fff0a6";
          ctx.font = "900 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(index + 1), x, y);
          if (finalPoint) {
            ctx.fillStyle = "#090d0ddf";
            ctx.fillRect(x - 27, y - 29, 54, 13);
            ctx.fillStyle = "#ffe071";
            ctx.font = "900 8px sans-serif";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`${routeEdit} 최종`, x, y - 19);
          }
        });
      ctx.restore();
    };
    const heroBrainRole = (unit: Unit): HeroBrainRole => {
        const role = HEROES.find((definition) => definition.id === unit.heroId)?.role ?? "";
        if (/지원|수리/.test(role)) return "support";
        if (/탱커|중장갑/.test(role)) return "tank";
        if (/원거리|지속|제어/.test(role)) return "artillery";
        if (/고속|정찰|스피드/.test(role)) return "skirmisher";
        return "assault";
      },
       setBattleHeroAction = (
         unit: Unit,
         slot: 0 | 1 | 2 | 3 | 4,
         duration: number,
         actionLockDuration = duration,
       ) => {
        if (slot === 4) unit.ultimateLabelUntil = performance.now() + 1150;
        unit.arenaActionSlot = slot;
        unit.arenaActionStartedAt = performance.now();
        unit.arenaActionDuration = duration;
        unit.arenaActionUntil = performance.now() + duration;
        unit.act = actionLockDuration;
      },
      battleHeroTargets = (
        attacker: Unit,
        radius: number,
        ignoresTerrain = false,
      ) =>
        units.filter(
          (target) =>
            target.alive &&
            target.networkVisible !== false &&
            target.team !== attacker.team &&
            canEngageAt(attacker.team, target.x, target.y) &&
            Math.hypot(target.x - attacker.x, target.y - attacker.y) <= radius &&
            (ignoresTerrain || clearRay(attacker.x, attacker.y, target.x, target.y, attacker.team)),
        ),
      damageFromBattleHero = (attacker: Unit, target: Unit, multiplier: number, stun = 0, actionName = "기본 공격") => {
        if (!canEngageAt(attacker.team, target.x, target.y)) return 0;
        const dealt = hurt(
          target,
          attacker.attack * Math.max(0.35, multiplier),
          attacker.team,
          true,
          attacker.critChance,
          attacker.critMultiplier,
          false,
          { attacker: attacker.name, action: actionName, unit: attacker },
        );
        if (dealt > 0 && stun) target.act = Math.max(target.act, stun);
        if (dealt > 0 && attacker.heroId === "cheolgak")
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + dealt * 0.16);
        if (dealt > 0 && attacker.heroId === "r486")
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + dealt * 0.1);
        return dealt;
      },
      battleHeroFx = (attacker: Unit, target: { x: number; y: number } | null, variant: string, radius: number, duration: number) => {
        const definition = heroKit(attacker.heroId ?? "yoo-seungcheon"),
          direction = target
            ? unitVector(target.x - attacker.x, target.y - attacker.y)
            : attacker.dir;
        attacker.dir = direction;
        slashes.push({
          x: attacker.x,
          y: attacker.y,
          dir: { ...direction },
          life: duration,
          maxLife: duration,
          kind: "signature",
          variant,
          color: definition.color,
          radius,
        });
      },
      canObserveBattleHeroFx = (attacker: Unit) =>
        !isSecretTunnel ||
        attacker.team === "blue" ||
        (
          battlePhase === "assault" &&
          openForTeam(attacker.x, attacker.y, "blue") &&
          visible(attacker.x, attacker.y)
        ),
      resolveBattleHeroImpact = (impact: (typeof pendingBattleHeroImpacts)[number]) => {
        const { attacker, targetId, slot, action, actionName, radius } = impact;
        if (!attacker.alive) return;
        const now = performance.now(), target = units.find((unit) => unit.id === targetId), mode = action.mode,
          areaModes = new Set([
            "spin", "shieldSweep", "biteCone", "blindDust", "batonSweep",
            "acidCone", "lidDisc", "frenzy", "lockdown", "massRepair",
          ]),
          stunModes = new Set(["stunSpray", "smash", "microwave", "batonSweep", "lockdown"]),
          pushModes = new Set(["shieldSweep", "shellRush", "lidDisc", "moltRam", "trackShift", "overclock"]),
          supportModes = new Set(["groupHeal", "armorOrder", "nightPatrol", "weldCone", "massRepair"]);
        if (supportModes.has(mode)) {
          const allies = units.filter(
            (unit) => unit.alive && unit.team === attacker.team && Math.hypot(unit.x - attacker.x, unit.y - attacker.y) <= Math.max(3.5, action.range),
          );
          if (mode === "groupHeal" || mode === "weldCone" || mode === "massRepair")
            for (const ally of allies)
              ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * (slot === 4 ? 0.24 : 0.14));
          if (mode === "armorOrder" || mode === "nightPatrol")
            for (const ally of allies) ally.armor += 4;
          if (mode === "massRepair")
            for (const enemy of battleHeroTargets(attacker, radius))
              damageFromBattleHero(attacker, enemy, action.damage, 220, actionName);
          return;
        }
        if (areaModes.has(mode)) {
          for (const enemy of battleHeroTargets(attacker, radius))
            damageFromBattleHero(attacker, enemy, action.damage, stunModes.has(mode) ? 650 : 0, actionName);
          return;
        }
        if (!target?.alive || target.team === attacker.team) return;
        if (!canEngageAt(attacker.team, target.x, target.y)) return;
        if (Math.hypot(target.x - attacker.x, target.y - attacker.y) > Math.max(2.2, action.range + 1.25)) return;
        if (
          !new Set(["acidShot", "glide", "overclock"]).has(mode) &&
          !clearRay(attacker.x, attacker.y, target.x, target.y, attacker.team)
        )
          return;
        damageFromBattleHero(attacker, target, action.damage, stunModes.has(mode) ? 720 : 0, actionName);
        if (["acidMark", "acidShot"].includes(mode)) target.vulnerableUntil = now + 5200;
        if (["webTrap", "silkPull", "webLock"].includes(mode)) target.act = Math.max(target.act, 950);
        if (pushModes.has(mode) && target.alive) {
          const direction = cardinal(target.x - attacker.x, target.y - attacker.y),
            nx = target.x + direction.x,
            ny = target.y + direction.y;
          if (openForTeam(nx, ny, target.team) && !occupied(nx, ny, target) && !turretAt(nx, ny, target.team) && !baseAt(nx, ny)) {
            commitGridMove(target, nx, ny, 220);
            target.dir = direction;
          }
        }
      },
      updateBattleHeroImpacts = (dt: number) => {
        for (const impact of pendingBattleHeroImpacts) impact.delay -= dt;
        for (let index = pendingBattleHeroImpacts.length - 1; index >= 0; index--)
          if (pendingBattleHeroImpacts[index].delay <= 0) {
            resolveBattleHeroImpact(pendingBattleHeroImpacts[index]);
            pendingBattleHeroImpacts.splice(index, 1);
          }
      },
      executeBattleHeroSkill = (attacker: Unit, target: Unit, slot: 1 | 2 | 4) => {
        const now = performance.now(), action = heroAction(attacker.heroId ?? "yoo-seungcheon", slot),
          mode = action.mode,
          radius = Math.max(1.2, action.radius || action.range * 0.34),
          duration = slot === 4 ? 960 : 720,
          definition = HEROES.find((heroDefinition) => heroDefinition.id === attacker.heroId),
          actionName = definition?.skills[slot === 4 ? 3 : slot - 1] ?? action.caption;
        const observable = canObserveBattleHeroFx(attacker);
        if (observable) battleHeroFx(attacker, target, mode, radius, duration);
        setBattleHeroAction(attacker, slot, duration);
        if (observable)
          void combatAudio.skillCue(attacker.heroId ?? "yoo-seungcheon", slot, attacker.team === "blue" ? .76 : .58);
        attacker.aiComboLockUntil = now + duration + (slot === 4 ? 1200 : 700);
        pendingBattleHeroImpacts.push({
          attacker,
          targetId: target.id,
          slot,
          action,
          actionName,
          radius,
          delay: slot === 4 ? 620 : 390,
        });
        const cooldowns = attacker.aiCooldowns ?? [0, 0, 0, 0];
        cooldowns[slot === 1 ? 0 : slot === 2 ? 1 : 3] = now + action.cooldown;
        attacker.aiCooldowns = cooldowns;
        attacker.aiPreviousAction = slot === 1 ? "skill1" : slot === 2 ? "skill2" : "ultimate";
        if (observable)
          setMessage(`${attacker.name} · ${actionName}${attacker.team === "red" ? " 준비 · 타격을 피하라" : ""}`);
      },
      executeBattleHeroSiegeSkill = (attacker: Unit, target: Turret, slot: 1 | 2 | 4) => {
        const action = heroAction(attacker.heroId ?? "yoo-seungcheon", slot);
        if (action.damage <= 0) return false;
        const now = performance.now(),
          duration = slot === 4 ? 960 : 720,
          definition = HEROES.find((heroDefinition) => heroDefinition.id === attacker.heroId),
          actionName = definition?.skills[slot === 4 ? 3 : slot - 1] ?? action.caption;
        attacker.dir = cardinal(target.x - attacker.x, target.y - attacker.y);
        const observable = canObserveBattleHeroFx(attacker);
        if (observable)
          battleHeroFx(attacker, target, action.mode, Math.max(1.2, action.radius), duration);
        setBattleHeroAction(attacker, slot, duration);
        if (observable)
          void combatAudio.skillCue(attacker.heroId ?? "yoo-seungcheon", slot, attacker.team === "blue" ? .76 : .58);
        attacker.aiComboLockUntil = now + duration + (slot === 4 ? 1200 : 700);
        hurtTurret(
          target,
          attacker.attack * action.damage * 0.85,
          attacker.team,
          true,
          attacker.critChance,
          attacker.critMultiplier,
        );
        const cooldowns = attacker.aiCooldowns ?? [0, 0, 0, 0];
        cooldowns[slot === 1 ? 0 : slot === 2 ? 1 : 3] = now + action.cooldown;
        attacker.aiCooldowns = cooldowns;
        attacker.aiPreviousAction = slot === 1 ? "skill1" : slot === 2 ? "skill2" : "ultimate";
        setMessage(`${attacker.name} 공성 · ${actionName}으로 ${buildDef(target.kind).name} 타격`);
        return true;
      },
      executeBattleHeroDrill = (
        attacker: Unit,
        goal: { x: number; y: number },
        options?: { direction?: { x: number; y: number }; drillWidthBonus?: number; drillCooldownMultiplier?: number },
      ) => {
        const now = performance.now(), action = heroAction(attacker.heroId ?? "yoo-seungcheon", 3),
          direction = options?.direction ?? cardinal(goal.x - attacker.x, goal.y - attacker.y),
          drillWidthBonus = options?.drillWidthBonus ?? 0;
        applyHeroDrillPattern(attacker, direction, drillWidthBonus);
        const observable = canObserveBattleHeroFx(attacker);
        if (observable) battleHeroFx(attacker, null, action.mode, 2.4, 620);
        setBattleHeroAction(attacker, 3, 620, DRILL_ACTION_LOCK_MS);
        if (observable)
          void combatAudio.skillCue(attacker.heroId ?? "yoo-seungcheon", 3, attacker.team === "blue" ? .76 : .58);
        const cooldowns = attacker.aiCooldowns ?? [0, 0, 0, 0];
        cooldowns[2] = now + action.cooldown * (
          isSecretTunnel ? SECRET_TUNNEL_DRILL_COOLDOWN_MULTIPLIER : 1
        ) * (options?.drillCooldownMultiplier ?? 1);
        attacker.aiCooldowns = cooldowns;
        attacker.aiPreviousAction = "drill";
      },
      processOnlineBattleCommands = () => {
        while (onlineCommandInboxRef.current.length) {
          const command = onlineCommandInboxRef.current.shift()!,
            unit = battleAiHeroes.find((candidate) => candidate.onlinePlayerId === command.playerId);
          appliedOnlineCommandSequence = Math.max(appliedOnlineCommandSequence, command.sequence);
          if (command.clientSequence !== undefined)
            appliedOnlineClientSequences[command.playerId] = Math.max(
              appliedOnlineClientSequences[command.playerId] ?? 0,
              command.clientSequence,
            );
          if (!unit || !unit.alive) continue;
          if (
            isSecretTunnel &&
            battlePhase === "prepare" &&
            (command.type === "attack" || command.type === "skill" || command.type === "tactical")
          ) continue;
          if (
            isSecretTunnel &&
            battlePhase !== "prepare" &&
            (command.type === "drill" || command.type === "fill")
          ) continue;
          const commandPoint = command.x === undefined || command.y === undefined
              ? undefined
              : { x: command.x, y: command.y },
            target = commandPoint
              ? units
                .filter((candidate) => candidate.alive && candidate.team !== unit.team)
                .sort((a, b) =>
                  Math.hypot(a.x - commandPoint.x, a.y - commandPoint.y) -
                  Math.hypot(b.x - commandPoint.x, b.y - commandPoint.y),
                )[0] ?? nearestEnemy(unit, 9)
              : nearestEnemy(unit, 9);
          if (command.type === "move") {
            if (command.x !== undefined && command.y !== undefined)
              unit.remoteGoal = { x: command.x, y: command.y };
            else if (
              command.dx !== undefined &&
              command.dy !== undefined &&
              (command.dx !== 0 || command.dy !== 0)
            )
              unit.remoteGoal = {
                x: unit.x + command.dx * 2,
                y: unit.y + command.dy * 2,
              };
          } else if (
            command.type === "dig" &&
            command.x !== undefined &&
            command.y !== undefined &&
            command.sourceX !== undefined &&
            command.sourceY !== undefined &&
            (!isSecretTunnel || battlePhase === "prepare") &&
            Math.max(
              Math.abs(command.x - command.sourceX),
              Math.abs(command.y - command.sourceY),
            ) === 1 &&
            openForTeam(command.sourceX, command.sourceY, unit.team) &&
            !baseAt(command.sourceX, command.sourceY) &&
            !turretAt(command.sourceX, command.sourceY, unit.team)
          ) {
            unit.x = command.sourceX;
            unit.y = command.sourceY;
            unit.dir = cardinal(command.x - command.sourceX, command.y - command.sourceY);
            unit.remoteGoal = { x: command.x, y: command.y };
            const definition = HEROES.find((candidate) => candidate.id === unit.heroId);
            breakTile(unit, command.x, command.y, definition?.stats.digPower ?? 1);
            if (
              openForTeam(command.x, command.y, unit.team) &&
              !occupied(command.x, command.y, unit, unit.team) &&
              !baseAt(command.x, command.y) &&
              !turretAt(command.x, command.y, unit.team)
            ) commitGridMove(
              unit,
              command.x,
              command.y,
              unitMovementDuration(isSecretTunnel ? secretTunnelPrepareDuration(95) : 180),
            );
          } else if (command.type === "attack" && target) {
            const range = HEROES.find((definition) => definition.id === unit.heroId)?.stats.range ?? 1.2;
            unit.dir = cardinal(target.x - unit.x, target.y - unit.y);
            if (range > 2) fire(unit, target.x - unit.x, target.y - unit.y, "arrow", unit.attack);
            else melee(unit, { x: target.x - unit.x, y: target.y - unit.y }, 4);
            setBattleHeroAction(unit, 0, Math.max(380, unit.attackInterval * 720));
          } else if (command.type === "skill" && command.slot && target) {
            const ready = unit.aiCooldowns ?? [0, 0, 0, 0], index = command.slot === 1 ? 0 : command.slot === 2 ? 1 : 3;
            if (ready[index] <= performance.now()) executeBattleHeroSkill(unit, target, command.slot);
          } else if (command.type === "drill") {
            const ready = unit.aiCooldowns ?? [0, 0, 0, 0];
            if (ready[2] <= performance.now())
              executeBattleHeroDrill(
                unit,
                commandPoint ?? unit.remoteGoal ?? (unit.team === "blue" ? ENEMY : ALLY),
                {
                  direction: command.dx === undefined || command.dy === undefined
                    ? undefined
                    : { x: command.dx, y: command.dy },
                  drillWidthBonus: command.drillWidthBonus,
                  drillCooldownMultiplier: command.drillCooldownMultiplier,
                },
              );
          } else if (command.type === "survival") {
            const now = performance.now();
            if (now < (unit.networkSurvivalCooldownUntil ?? 0)) continue;
            const type = ["yoo-seungcheon", "hoebun"].includes(unit.heroId ?? "")
                ? "jump"
                : ["ahn-seona", "r486"].includes(unit.heroId ?? "")
                  ? "heal"
                  : ["kang-ryeokhan", "cheolgak", "g77", "c999"].includes(unit.heroId ?? "")
                    ? "defense"
                    : "dodge",
              direction = commandPoint
                ? cardinal(commandPoint.x - unit.x, commandPoint.y - unit.y)
                : cardinal(unit.dir.x, unit.dir.y);
            if (type === "heal")
              unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * 0.24));
            else if (type === "defense")
              unit.networkSurvivalArmorUntil = now + 4500;
            else {
              const maximumDistance = type === "jump" ? 3 : 1;
              for (let distance = maximumDistance; distance >= 1; distance--) {
                const x = unit.x + direction.x * distance,
                  y = unit.y + direction.y * distance;
                if (
                  openForTeam(x, y, unit.team) &&
                  !occupied(x, y, unit, unit.team) &&
                  !turretAt(x, y, unit.team) &&
                  !baseAt(x, y)
                ) {
                  commitGridMove(unit, x, y, type === "jump" ? 520 : 360);
                  break;
                }
              }
              unit.networkSurvivalEvadeUntil = now + (type === "jump" ? 560 : 520);
            }
            unit.act = Math.max(unit.act, type === "jump" ? 520 : type === "dodge" ? 360 : 500);
            unit.networkSurvivalCooldownUntil = now + (type === "jump" ? 12000 : 15000);
          } else if (
            command.type === "route" &&
            command.route
          ) {
            if (command.points?.length)
              applyTeamRoutePoints(unit.team, command.route, command.points);
            else if (command.x !== undefined && command.y !== undefined)
              applyTeamRouteTarget(unit.team, command.route, command.x, command.y);
          } else if (command.type === "allocation" && command.allocation) {
            tunnelAllocations[unit.team] = command.allocation;
          } else if (
            command.type === "build" &&
            command.kind &&
            command.x !== undefined &&
            command.y !== undefined
          ) {
            const definition = BUILD_BY_ID[command.kind],
              ownCore = unit.team === "blue" ? ALLY : ENEMY,
              teamBuilds = turrets.filter((turret) => turret.team === unit.team && turret.built && !turret.starter && turret.hp > 0),
              attackCount = teamBuilds.filter((turret) => isAttackBuild(turret.kind)).length,
              wallCount = teamBuilds.filter((turret) => isBlocker(turret.kind)).length,
              supportCount = teamBuilds.filter((turret) => isSupport(turret.kind)).length,
              placementPrice = definition
                ? buildPlacementCost(
                    definition.cost,
                    definition.category === "blocker" || definition.category === "support",
                    command.x,
                    command.y,
                    teamBuilds.map((turret) => ({
                      x: turret.x,
                      y: turret.y,
                      isBlocker: isBlocker(turret.kind) || isSupport(turret.kind),
                    })),
                  )
                : 0,
              preservesDeployment = definition?.category !== "blocker" && definition?.category !== "support"
                ? true
                : unit.team === "blue"
                  ? preservesExitPath(command.x, command.y)
                  : preservesEnemyExitPath(command.x, command.y);
            if (
              definition &&
              definition.faction === unit.faction &&
              teamBuilds.length < 6 &&
              (definition.category !== "support" || supportCount < 1) &&
              (!isAttackBuild(command.kind) || attackCount < 3) &&
              (!isBlocker(command.kind) || wallCount < 4) &&
              Math.hypot(command.x - ownCore.x, command.y - ownCore.y) >= 2 &&
              Math.hypot(command.x - ownCore.x, command.y - ownCore.y) <= 6 &&
              openForTeam(command.x, command.y, unit.team) &&
              !baseAt(command.x, command.y) &&
              !turretAt(command.x, command.y) &&
              !occupied(command.x, command.y, unit) &&
              preservesDeployment &&
              spendTeamCredits(unit.team, placementPrice)
            )
              turrets.push(createBuildableUnit({
                id: buildId++,
                x: command.x,
                y: command.y,
                team: unit.team,
                kind: command.kind,
                cool: 250,
              }));
          } else if (
            (command.type === "upgrade" || command.type === "demolish") &&
            command.x !== undefined &&
            command.y !== undefined
          ) {
            const installation = turrets.find((candidate) =>
              candidate.hp > 0 &&
              candidate.team === unit.team &&
              candidate.x === command.x &&
              candidate.y === command.y,
            );
            if (!installation) continue;
            if (command.type === "upgrade") {
              if (installation.level >= 2 || installation.upgrade) continue;
              const cost = Math.ceil(buildDef(installation.kind).cost * 0.65);
              if (!spendTeamCredits(unit.team, cost)) continue;
              installation.upgrade = { remaining: 1500, cost };
            } else {
              if (installation.starter) continue;
              installation.demolish = 1000;
            }
          } else if (
            command.type === "fill" &&
            command.x !== undefined &&
            command.y !== undefined &&
            Math.hypot(command.x - unit.x, command.y - unit.y) <= 2.25 &&
            Math.hypot(command.x - ALLY.x, command.y - ALLY.y) >= 3 &&
            Math.hypot(command.x - ENEMY.x, command.y - ENEMY.y) >= 3 &&
            openForTeam(command.x, command.y, unit.team) &&
            !baseAt(command.x, command.y) &&
            !turretAt(command.x, command.y) &&
            !occupied(command.x, command.y, unit)
          ) {
            let sealedOverlay: SecretTunnelOverlay | null = null;
            if (isSecretTunnel && secretTunnelOverlay) {
              const sealed = sealSecretTunnelTileForTeam(
                secretTunnelOverlay,
                { x: command.x, y: command.y },
                unit.team,
                { blue: ALLY, red: ENEMY },
              );
              if (!sealed.sealed) continue;
              sealedOverlay = sealed.overlay;
            }
            if (!spendTeamCredits(unit.team, 15)) continue;
            if (sealedOverlay) {
              secretTunnelOverlay = sealedOverlay;
              const connections = evaluateSecretTunnelConnections(
                secretTunnelOverlay,
                { blue: ALLY, red: ENEMY },
              );
              secretBlueConnected = connections.blue.valid;
              secretRedConnected = connections.red.valid;
            }
            grid[command.y][command.x] = {
              type: 5,
              hp: 2,
              max: 2,
              freshUntil: performance.now() + 1500,
              filledBy: unit.team,
            };
            recordTerrainChange(command.x, command.y);
          } else if (command.type === "research") {
            researchMinionTeam(unit.team);
          } else if (command.type === "elite") {
            reserveEliteTeam(unit.team);
          } else if (command.type === "tactical" && command.tacticalRole) {
            const tacticalTarget = command.x === undefined || command.y === undefined
              ? undefined
              : Math.hypot(command.x - unit.x, command.y - unit.y) <= 12 && openForTeam(command.x, command.y, unit.team)
                ? { x: command.x, y: command.y }
                : undefined;
            if (command.tacticalRole === "area" && !tacticalTarget) continue;
            activateTacticalSupport(
              unit.team,
              command.tacticalRole,
              tacticalTarget,
            );
          }
        }
      },
      syncOnlineBattleState = (dt: number) => {
        if (activeMatchConfig?.kind !== "online" || !onlineRoom || !onlineIdentity) return;
        const localRoomPlayer = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId),
          isHost = onlineRoom.hostId === onlineIdentity.playerId;
        if (!localRoomPlayer) return;
        const snapshot = onlineSnapshotRef.current;
        if (
          snapshot &&
          snapshot.sequence > appliedOnlineSnapshot &&
          (!isHost || (
            hostRestoreSnapshotSequence > 0 &&
            snapshot.sequence === hostRestoreSnapshotSequence
          ))
        ) {
          appliedOnlineSnapshot = snapshot.sequence;
          wave = snapshot.wave;
          const mirrored = localRoomPlayer.team === "red";
          const ownCanonical = localRoomPlayer.team,
            enemyCanonical = ownCanonical === "blue" ? "red" : "blue";
          const lastAppliedClientSequence = snapshot.lastAppliedClientSequences?.[onlineIdentity.playerId] ?? 0,
            predictionNow = performance.now();
          for (const [key, prediction] of pendingOnlineDigPredictions)
            if (
              !shouldPreserveOnlineTerrainPrediction(
                prediction.clientSequence,
                lastAppliedClientSequence,
              ) ||
              predictionNow - prediction.createdAt > 3000
            ) pendingOnlineDigPredictions.delete(key);
          if (isSecretTunnel) {
            const phaseChanged = Boolean(snapshot.phase && snapshot.phase !== battlePhase);
            if (snapshot.phase) battlePhase = snapshot.phase;
            if (isHost && snapshot.phaseEndsAt !== undefined && Number.isFinite(snapshot.phaseEndsAt)) {
              battlePhaseEndsAt = snapshot.phaseEndsAt;
              battlePhaseTimeLeft = Math.max(0, snapshot.phaseEndsAt - Date.now());
            } else if (snapshot.phaseTimeLeftMs !== undefined && Number.isFinite(snapshot.phaseTimeLeftMs)) {
              battlePhaseTimeLeft = Math.max(0, snapshot.phaseTimeLeftMs);
              battlePhaseEndsAt = Date.now() + battlePhaseTimeLeft;
            } else if (snapshot.phaseEndsAt !== undefined && Number.isFinite(snapshot.phaseEndsAt)) {
              battlePhaseEndsAt = snapshot.phaseEndsAt;
              battlePhaseTimeLeft = Math.max(0, snapshot.phaseEndsAt - Date.now());
            }
            if (snapshot.teamRouteAllocations) {
              const ownAllocation = snapshot.teamRouteAllocations[ownCanonical];
              if (ownAllocation) tunnelAllocations.blue = ownAllocation;
              const enemyAllocation = snapshot.teamRouteAllocations[enemyCanonical];
              if (isHost && enemyAllocation) tunnelAllocations.red = enemyAllocation;
            }
            if (snapshot.teamConnections?.[ownCanonical] !== undefined)
              secretBlueConnected = snapshot.teamConnections[ownCanonical]!;
            if (isHost && snapshot.teamConnections?.[enemyCanonical] !== undefined)
              secretRedConnected = snapshot.teamConnections[enemyCanonical]!;
            if (secretTunnelOverlay && snapshot.tunnelAccess) {
              const resetTiles = secretTunnelOverlay.tiles.map((row) => row.map((tile) => isHost
                ? {
                    ...tile,
                    durability: { ...tile.maxDurability },
                    access: TUNNEL_ACCESS.none,
                    excavatedBy: TUNNEL_ACCESS.none,
                    owner: null,
                    sharedBackbone: false,
                  }
                : {
                    ...tile,
                    durability: { ...tile.durability, blue: tile.maxDurability.blue },
                    access: (tile.access & TUNNEL_ACCESS.red) as 0 | 1 | 2 | 3,
                    excavatedBy: (tile.excavatedBy & TUNNEL_ACCESS.red) as 0 | 1 | 2 | 3,
                  }));
              for (const state of snapshot.tunnelAccess) {
                const current = resetTiles[state.y]?.[state.x];
                if (!current) continue;
                const visibleAccess = localTunnelAccess(state.accessMask),
                  localDurability = state.durability?.[ownCanonical],
                  localMaximum = state.maxDurability?.[ownCanonical],
                  opponentDurability = state.durability?.[enemyCanonical],
                  opponentMaximum = state.maxDurability?.[enemyCanonical],
                  restoredOwner = state.owner ? localTeamForCanonical(state.owner) : null,
                  ownAccess = visibleAccess & TUNNEL_ACCESS.blue,
                  revealedOpponentAccess = visibleAccess & TUNNEL_ACCESS.red,
                  ownExcavation = localTunnelAccess(state.excavatedBy ?? 0) & TUNNEL_ACCESS.blue;
                resetTiles[state.y][state.x] = isHost
                  ? {
                      ...current,
                      durability: {
                        blue: localDurability ?? current.durability.blue,
                        red: opponentDurability ?? current.durability.red,
                      },
                      maxDurability: {
                        blue: localMaximum ?? current.maxDurability.blue,
                        red: opponentMaximum ?? current.maxDurability.red,
                      },
                      access: visibleAccess,
                      excavatedBy: localTunnelAccess(state.excavatedBy ?? 0),
                      owner: restoredOwner,
                      sharedBackbone: Boolean(state.sharedBackbone),
                    }
                  : {
                      ...current,
                      durability: {
                        ...current.durability,
                        blue: localDurability ?? current.durability.blue,
                      },
                      maxDurability: {
                        ...current.maxDurability,
                        blue: localMaximum ?? current.maxDurability.blue,
                      },
                      access: (
                        (current.access & TUNNEL_ACCESS.red) |
                        ownAccess |
                        revealedOpponentAccess
                      ) as 0 | 1 | 2 | 3,
                      excavatedBy: (
                        (current.excavatedBy & TUNNEL_ACCESS.red) |
                        ownExcavation
                      ) as 0 | 1 | 2 | 3,
                      owner: restoredOwner === "blue" ? "blue" : current.owner,
                      sharedBackbone: Boolean(state.sharedBackbone),
                    };
              }
              for (const [key, prediction] of pendingOnlineDigPredictions) {
                if (!prediction.tunnelTile) continue;
                const [x, y] = key.split(",").map(Number);
                if (resetTiles[y]?.[x])
                  resetTiles[y][x] = cloneSecretTunnelTile(prediction.tunnelTile);
              }
              secretTunnelOverlay = { ...secretTunnelOverlay, tiles: resetTiles };
              for (const state of snapshot.tunnelAccess) {
                if (!seen[state.y] || !grid[state.y]?.[state.x]) continue;
                seen[state.y][state.x] = true;
                memory[state.y][state.x] = { ...tileForLocalTunnelView(state.x, state.y) };
              }
            }
            if (phaseChanged && battlePhase === "assault") {
              cancelRouteEdit();
              cancelQuickRouteAim();
              if (!teamMarchRoutes.blue.A.points.length)
                applyTeamRouteTarget("blue", "A", ENEMY.x, ENEMY.y);
              if (!teamMarchRoutes.blue.B.points.length)
                applyTeamRouteTarget("blue", "B", ENEMY.x, ENEMY.y);
              if (!teamMarchRoutes.red.A.points.length)
                applyTeamRouteTarget("red", "A", ALLY.x, ALLY.y);
              if (!teamMarchRoutes.red.B.points.length)
                applyTeamRouteTarget("red", "B", ALLY.x, ALLY.y);
              announceSecretPhase("거점 공격 시작", "영웅 전원 귀환 · 4분 침공");
            }
          }
          if (snapshot.teamMinionLevels[ownCanonical] !== minionLevels.blue)
            applyTeamMinionLevel("blue", snapshot.teamMinionLevels[ownCanonical]);
          if (snapshot.teamMinionLevels[enemyCanonical] !== minionLevels.red)
            applyTeamMinionLevel("red", snapshot.teamMinionLevels[enemyCanonical]);
          money = snapshot.teamCredits[ownCanonical];
          enemyBuildCredits = snapshot.teamCredits[enemyCanonical];
          allyHp = mirrored ? snapshot.enemyCore.hp : snapshot.allyCore.hp;
          allyShield = mirrored ? snapshot.enemyCore.shield : snapshot.allyCore.shield;
          enemyHp = mirrored ? snapshot.allyCore.hp : snapshot.enemyCore.hp;
          enemyShield = mirrored ? snapshot.allyCore.shield : snapshot.enemyCore.shield;
          const snapshotHeroIds = new Set(snapshot.heroes.map((state) => state.playerId));
          if (!isHost)
            for (const unit of units)
              if (unit.role === "hero" && unit.onlinePlayerId && unit.team === "red")
                unit.networkVisible = snapshotHeroIds.has(unit.onlinePlayerId);
          for (const state of snapshot.heroes) {
            const unit = units.find((candidate) => candidate.onlinePlayerId === state.playerId);
            if (!unit) continue;
            unit.networkVisible = true;
            const applyPosition = shouldApplyAuthoritativeHeroPosition(
              isHost,
              state.playerId,
              onlineIdentity.playerId,
            );
            if (applyPosition) {
              if (unit.x !== state.x || unit.y !== state.y)
                setUnitMoveVisual(unit, state.x, state.y, ONLINE_REMOTE_INTERPOLATION_MS);
              unit.x = state.x;
              unit.y = state.y;
              unit.dir = state.dir;
            }
            unit.hp = state.hp;
            unit.maxHp = state.maxHp;
            unit.alive = state.alive;
            if (applyPosition && unit === hero) {
              heroWorld.x = unit.x * S + S / 2;
              heroWorld.y = unit.y * S + S / 2;
            }
          }
          const snapshotMinions = new Set(snapshot.minions.map((state) => state.syncId));
          for (const state of snapshot.minions) {
            const internalTeam = localTeamForCanonical(state.team),
              existing = units.find(
                (candidate) => candidate.role === "minion" && candidate.onlineSyncId === state.syncId,
              ),
              synced = existing ?? createMinionUnit({
                id: unitId++,
                onlineSyncId: state.syncId,
                x: state.x,
                y: state.y,
                team: internalTeam,
                name: state.name,
                hp: state.hp,
                maxHp: state.maxHp,
                dir: state.dir,
                act: 120,
                attack: state.attack,
                attackInterval: state.attackInterval,
                armor: state.armor,
                critChance: state.critChance,
                critMultiplier: state.critMultiplier,
                moveSpeed: state.moveSpeed,
                faction: state.faction,
                minionRole: state.minionRole,
                level: state.level,
                shieldDamage: state.shieldDamage,
                minionVisual: "idle",
                minionVisualUntil: 0,
                formationSide: state.minionRole === "escort" ? 0 : state.syncId.length % 2 ? -1 : 1,
              });
            if (!existing) units.push(synced);
            if (existing && (synced.x !== state.x || synced.y !== state.y))
              setUnitMoveVisual(synced, state.x, state.y, ONLINE_REMOTE_INTERPOLATION_MS);
            synced.team = internalTeam;
            synced.x = state.x;
            synced.y = state.y;
            synced.name = state.name;
            synced.hp = state.hp;
            synced.maxHp = state.maxHp;
            synced.alive = state.alive;
            synced.dir = state.dir;
            synced.attack = state.attack;
            synced.attackInterval = state.attackInterval;
            synced.armor = state.armor;
            synced.critChance = state.critChance;
            synced.critMultiplier = state.critMultiplier;
            synced.moveSpeed = state.moveSpeed;
            synced.faction = state.faction;
            synced.minionRole = state.minionRole;
            synced.level = state.level;
            synced.shieldDamage = state.shieldDamage;
          }
          for (let index = units.length - 1; index >= 0; index--)
            if (
              units[index].role === "minion" &&
              units[index].onlineSyncId &&
              !snapshotMinions.has(units[index].onlineSyncId!)
            ) units.splice(index, 1);

          const snapshotInstallations = new Set<string>();
          for (const state of snapshot.installations) {
            const internalTeam = localTeamForCanonical(state.team),
              key = `${internalTeam}:${state.kind}:${state.x},${state.y}`;
            snapshotInstallations.add(key);
            const existing = turrets.find(
                (candidate) => `${candidate.team}:${candidate.kind}:${candidate.x},${candidate.y}` === key,
              ),
              synced = existing ?? createBuildableUnit({
                id: buildId++,
                x: state.x,
                y: state.y,
                team: internalTeam,
                kind: state.kind,
                hp: state.maxHp,
                cool: state.cool,
                cost: state.cost,
                level: state.level,
                starter: state.starter,
              });
            if (!existing) turrets.push(synced);
            synced.hp = state.hp;
            synced.maxHp = state.maxHp;
            synced.cool = state.cool;
            synced.starter = state.starter;
            synced.cost = state.cost;
            synced.invested = state.invested;
            synced.level = state.level;
          }
          for (let index = turrets.length - 1; index >= 0; index--) {
            const turret = turrets[index],
              key = `${turret.team}:${turret.kind}:${turret.x},${turret.y}`;
            if (!snapshotInstallations.has(key)) turrets.splice(index, 1);
          }
          for (const state of snapshot.terrain)
            if (grid[state.y]?.[state.x]) {
              if (pendingOnlineDigPredictions.has(`${state.x},${state.y}`)) continue;
              grid[state.y][state.x] = {
                type: state.type,
                hp: state.hp,
                max: state.max,
                ...(state.ore === undefined ? {} : { ore: state.ore }),
                ...(state.filledBy === undefined
                  ? {}
                  : { filledBy: localTeamForCanonical(state.filledBy) }),
                ...(state.surface === undefined ? {} : { surface: state.surface }),
                ...(state.obstacle === undefined ? {} : { obstacle: state.obstacle }),
                ...(state.hazard === undefined ? {} : { hazard: state.hazard }),
              };
              if (isHost) onlineTerrainChanges.set(`${state.x},${state.y}`, state);
            }
          if (!isHost) return;
        }
        if (!isHost) return;
        onlineSnapshotClock -= dt;
        if (onlineSnapshotClock > 0) return;
        onlineSnapshotClock = ONLINE_SNAPSHOT_INTERVAL_MS;
        const snapshotPayload: Omit<OnlineBattleSnapshot, "sequence" | "issuedAt"> = {
          lastAppliedCommandSequence: appliedOnlineCommandSequence,
          lastAppliedClientSequences: { ...appliedOnlineClientSequences },
          ...(isSecretTunnel
            ? {
                phase: battlePhase,
                phaseTimeLeftMs: Math.max(0, battlePhaseTimeLeft),
                phaseEndsAt: battlePhaseEndsAt,
                teamConnections: {
                  [canonicalTeamFor("blue")]: secretBlueConnected,
                  [canonicalTeamFor("red")]: secretRedConnected,
                },
                teamRouteAllocations: {
                  blue: tunnelAllocations[localTeamForCanonical("blue")],
                  red: tunnelAllocations[localTeamForCanonical("red")],
                },
                tunnelAccess: secretTunnelOverlay
                  ? secretTunnelOverlay.tiles.flatMap((row, y) =>
                      row.flatMap((tile, x) => {
                        const hasProgress = tile.durability.blue < tile.maxDurability.blue ||
                          tile.durability.red < tile.maxDurability.red;
                        if (tile.access === TUNNEL_ACCESS.none && !hasProgress && tile.excavatedBy === TUNNEL_ACCESS.none)
                          return [];
                        const canonicalBlue = canonicalTeamFor("blue"),
                          canonicalRed = canonicalTeamFor("red");
                        return [{
                          x,
                          y,
                          accessMask: canonicalTunnelAccess(tile.access),
                          sharedBackbone: tile.sharedBackbone,
                          ...(tile.owner ? { owner: canonicalTeamFor(tile.owner) } : {}),
                          durability: {
                            [canonicalBlue]: tile.durability.blue,
                            [canonicalRed]: tile.durability.red,
                          },
                          maxDurability: {
                            [canonicalBlue]: tile.maxDurability.blue,
                            [canonicalRed]: tile.maxDurability.red,
                          },
                          excavatedBy: canonicalTunnelAccess(tile.excavatedBy),
                        }];
                      }),
                    )
                  : [],
              }
            : {}),
          wave,
          teamMinionLevels: {
            blue: minionLevels[localTeamForCanonical("blue")],
            red: minionLevels[localTeamForCanonical("red")],
          },
          teamCredits: {
            blue: teamCredits(localTeamForCanonical("blue")),
            red: teamCredits(localTeamForCanonical("red")),
          },
          allyCore: canonicalLocalTeam === "blue"
            ? { hp: allyHp, shield: allyShield }
            : { hp: enemyHp, shield: enemyShield },
          enemyCore: canonicalLocalTeam === "blue"
            ? { hp: enemyHp, shield: enemyShield }
            : { hp: allyHp, shield: allyShield },
          heroes: units.filter((unit) => unit.role === "hero" && unit.onlinePlayerId).map((unit) => ({
            playerId: unit.onlinePlayerId!, x: unit.x, y: unit.y, hp: unit.hp, maxHp: unit.maxHp,
            alive: unit.alive, dir: unit.dir,
          })),
          minions: units
            .filter((unit) => unit.role === "minion" && unit.alive && unit.onlineSyncId)
            .map((unit) => ({
              syncId: unit.onlineSyncId!,
              team: canonicalTeamFor(unit.team),
              x: unit.x,
              y: unit.y,
              name: unit.name,
              hp: unit.hp,
              maxHp: unit.maxHp,
              alive: unit.alive,
              dir: unit.dir,
              attack: unit.attack,
              attackInterval: unit.attackInterval,
              armor: unit.armor,
              critChance: unit.critChance,
              critMultiplier: unit.critMultiplier,
              moveSpeed: unit.moveSpeed,
              faction: unit.faction,
              minionRole: unit.minionRole ?? "breaker",
              level: unit.level,
              shieldDamage: unit.shieldDamage,
            })),
          installations: turrets.filter((turret) => turret.hp > 0).map((turret) => ({
            team: canonicalTeamFor(turret.team),
            x: turret.x,
            y: turret.y,
            kind: turret.kind,
            hp: turret.hp,
            maxHp: turret.maxHp,
            cool: turret.cool,
            starter: turret.starter,
            cost: turret.cost,
            invested: turret.invested,
            level: turret.level,
          })),
          terrain: [...onlineTerrainChanges.values()],
        };
        if (!onlineSocketRef.current?.send("snapshot", { snapshot: snapshotPayload }))
          void sendOnlineBattleSnapshot(onlineRoom.code, onlineIdentity, snapshotPayload).catch(() => undefined);
      },
      stepBattleHero = (aiHero: Unit) => {
        if (!aiHero.alive || aiHero.act > 0) return;
        if (
          activeMatchConfig?.kind === "online" &&
          aiHero.networkController === "remote" &&
          aiHero.onlinePlayerId &&
          !onlineAiPlayersRef.current.has(aiHero.onlinePlayerId)
        ) {
          if (aiHero.remoteGoal) {
            if (Math.abs(aiHero.x - aiHero.remoteGoal.x) + Math.abs(aiHero.y - aiHero.remoteGoal.y) <= 1)
              aiHero.remoteGoal = undefined;
            else {
              const remoteStep = nextPath(aiHero, aiHero.remoteGoal) ?? cardinal(aiHero.remoteGoal.x - aiHero.x, aiHero.remoteGoal.y - aiHero.y);
              const remoteX = aiHero.x + remoteStep.x,
                remoteY = aiHero.y + remoteStep.y;
              if (
                openForTeam(remoteX, remoteY, aiHero.team) &&
                !occupied(remoteX, remoteY, aiHero, aiHero.team) &&
                !baseAt(remoteX, remoteY) &&
                !turretAt(remoteX, remoteY, aiHero.team)
              ) commitGridMove(
                aiHero,
                remoteX,
                remoteY,
                unitMovementDuration(260 / terrainMoveFactor(aiHero.x, aiHero.y)),
              );
              else aiHero.act = 90;
            }
          } else aiHero.act = 120;
          return;
        }
        if (isSecretTunnel && battlePhase === "prepare") {
          const teamConnected = aiHero.team === "blue" ? secretBlueConnected : secretRedConnected;
          const opposingCore = aiHero.team === "blue" ? ENEMY : ALLY,
            teamHeroSlot = Math.max(0, battleAiHeroes
              .filter((unit) => unit.alive && unit.team === aiHero.team)
              .sort((a, b) => a.id - b.id)
              .findIndex((unit) => unit === aiHero)),
            oreGoals: GridPoint[] = [];
          if (teamConnected)
            for (let y = 3; y < ROWS - 3; y++)
              for (let x = 3; x < COLS - 3; x++)
                if (grid[y]?.[x]?.ore && !openForTeam(x, y, aiHero.team)) oreGoals.push({ x, y });
          oreGoals.sort((a, b) =>
            Math.abs(a.x - aiHero.x) + Math.abs(a.y - aiHero.y) -
            (Math.abs(b.x - aiHero.x) + Math.abs(b.y - aiHero.y)),
          );
          const goal = oreGoals[0] ?? secretTunnelCoreEntryGoal(opposingCore, teamHeroSlot),
            route = shortestRouteToAny(
              aiHero,
              [goal],
              (x, y) => Boolean(grid[y]?.[x] && grid[y][x].type !== 4),
            ),
            next = route?.cells[1],
            step = next
              ? { x: next.x - aiHero.x, y: next.y - aiHero.y }
              : cardinal(goal.x - aiHero.x, goal.y - aiHero.y);
          const nextTileClosed = !openForTeam(aiHero.x + step.x, aiHero.y + step.y, aiHero.team),
            cooldowns = aiHero.aiCooldowns ?? [0, 0, 0, 0];
          if (nextTileClosed && cooldowns[2] <= performance.now()) {
            executeBattleHeroDrill(aiHero, goal, { direction: step });
            aiHero.aiDecisionReason = teamConnected
              ? "유효 전선 확보 · 굴착기로 광맥·우회로 개척"
              : "비밀 굴착 준비 · 굴착기로 적 코어 공동 구역 연결";
            return;
          }
          const progressed = moveOrDig(aiHero, step.x, step.y, unitMovementDuration(secretTunnelPrepareDuration(180)));
          if (!progressed) {
            const alternative = DIRS
              .filter((direction) => {
                const x = aiHero.x + direction.x,
                  y = aiHero.y + direction.y,
                  tile = grid[y]?.[x];
                return tile && tile.type !== 4 && !baseAt(x, y) &&
                  !turretAt(x, y, aiHero.team) && !occupied(x, y, aiHero, aiHero.team);
              })
              .sort((a, b) =>
                Math.abs(aiHero.x + a.x - goal.x) + Math.abs(aiHero.y + a.y - goal.y) -
                (Math.abs(aiHero.x + b.x - goal.x) + Math.abs(aiHero.y + b.y - goal.y)),
              )[0];
            if (alternative)
              moveOrDig(aiHero, alternative.x, alternative.y, unitMovementDuration(secretTunnelPrepareDuration(180)));
          }
          aiHero.act = unitMovementDuration(secretTunnelPrepareDuration(90) / terrainMoveFactor(aiHero.x, aiHero.y));
          aiHero.aiDecisionReason = teamConnected
            ? oreGoals[0]
              ? "유효 전선 확보 · 광석 굴착"
              : "유효 전선 확보 · 우회 공격로 굴착"
            : "비밀 굴착 준비 · 상대 코어 방향 전선 확보";
          return;
        }
        const computerInvader = !isCampaign &&
          activeMatchConfig?.kind === "computer" &&
          aiHero.team === "red";
        if (computerInvader) {
          enemyCoreIntel.red = true;
          ensureComputerAttackRoutes("red");
        }
        if (aiHero.campaign1Boss) {
          const nearbyDefender = units
            .filter(
              (unit) =>
                unit.alive &&
                unit.team === "blue" &&
                unit.campaignActivated !== false &&
                Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y) <= 8,
            )
            .map((unit) => ({
              unit,
              plan: combatApproachPlan(aiHero, unit, combatRangeFor(aiHero)),
            }))
            .filter((entry) => Boolean(entry.plan))
            .sort((a, b) => (a.plan?.distance ?? 99) - (b.plan?.distance ?? 99))[0];
          if (!nearbyDefender) {
            const coreDistance = Math.abs(ALLY.x - aiHero.x) + Math.abs(ALLY.y - aiHero.y);
            if (coreDistance === 1) {
              melee(aiHero, { x: ALLY.x - aiHero.x, y: ALLY.y - aiHero.y }, 8, "mandible");
              aiHero.aiDecisionReason = "서울 거점을 직접 파쇄한다";
              return;
            }
            const coreApproaches = DIRS.map((direction) => ({
                x: ALLY.x + direction.x,
                y: ALLY.y + direction.y,
              })).filter(
                (goal) =>
                  openForTeam(goal.x, goal.y, aiHero.team) &&
                  (!occupied(goal.x, goal.y, aiHero) ||
                    (goal.x === aiHero.x && goal.y === aiHero.y)) &&
                  !turretAt(goal.x, goal.y, aiHero.team),
              ),
              corePlan = pathPlanToGoals(aiHero, coreApproaches),
              step = corePlan?.step ?? cardinal(ALLY.x - aiHero.x, ALLY.y - aiHero.y),
              blockingInstallation = turretAt(aiHero.x + step.x, aiHero.y + step.y, aiHero.team);
            if (blockingInstallation && blockingInstallation.team === "blue") {
              melee(aiHero, step, 8, "mandible");
              aiHero.aiDecisionReason = "서울 거점 진입로의 설치물을 부순다";
              return;
            }
            const moveDuration = unitMovementDuration(230 / terrainMoveFactor(aiHero.x, aiHero.y));
            moveOrDig(aiHero, step.x, step.y, moveDuration);
            aiHero.act = moveDuration;
            aiHero.aiDecisionReason = corePlan
              ? `서울 거점까지 실제 경로 ${corePlan.distance}칸으로 공성 진입한다`
              : "막힌 지형을 파내며 서울 거점으로 공성 진입한다";
            return;
          }
          aiHero.aiTargetId = nearbyDefender.unit.id;
        }
        const now = performance.now(),
          companion = aiHero.campaignAi === "companion",
          sentry = Boolean(aiHero.campaignSentry),
          campaign1InvadingHero = isCampaign && campaignChapter === 1 && aiHero.team === "red",
          definition = HEROES.find((candidate) => candidate.id === aiHero.heroId),
          basicRange = Math.max(1.5, definition?.stats.range ?? 1.5),
          aggroRadius = skirmishHeroAggroRadius(definition?.stats.vision ?? 7),
          ownCore = aiHero.team === "blue" ? ALLY : ENEMY,
          opposingCore = aiHero.team === "blue" ? ENEMY : ALLY,
          assignedRoute = !isCampaign && aiHero.routeId
            ? teamMarchRoutes[aiHero.team][aiHero.routeId]
            : undefined,
          assignedRouteProgress = advanceRouteCursor(
            aiHero,
            assignedRoute ? routeTravelPoints(assignedRoute) : [],
            aiHero.routePointIndex ?? 0,
          ),
          assignedRouteGoal = assignedRouteProgress.atEnd
            ? null
            : assignedRouteProgress.goal,
          allies = units.filter((unit) => unit.alive && unit.team === aiHero.team && unit !== aiHero),
          laneScouts = allies
            .filter(
              (unit) =>
                unit.role === "minion" &&
                (!aiHero.routeId || unit.routeId === aiHero.routeId),
            ),
          frontScout = (laneScouts.length
            ? laneScouts
            : allies.filter((unit) => unit.role === "minion"))
            .filter((unit) => unit.role === "minion")
            .sort(
              (a, b) =>
                Math.hypot(b.x - ownCore.x, b.y - ownCore.y) -
                Math.hypot(a.x - ownCore.x, a.y - ownCore.y),
            )[0],
          assistThreat = recentAssistThreat(
            aiHero,
            companion ? CAMPAIGN_COMPANION_ASSIST_DISTANCE : CAMPAIGN_ASSIST_RADIUS,
          ),
          assistTarget = assistThreat?.kind === "unit" ? assistThreat.unit : undefined,
          assistInstallation = assistThreat?.kind === "installation"
            ? assistThreat.installation
            : undefined,
          companionHasLocalCore = companion && teamHasSpottedCore(
            [aiHero],
            aiHero.team,
            opposingCore,
            CAMPAIGN_COMPANION_AGGRO_DISTANCE,
          ),
          coreAssault = !sentry && (
            campaign1InvadingHero ||
            !isCampaign ||
            companionHasLocalCore
          ),
          sentryTarget = sentry ? campaignSentryTarget(aiHero) : undefined,
          // 동료는 stepCampaignHero가 접근 가능성을 확인해 지정한 적만 상대한다.
          enemies = units.filter(
            (unit) =>
              unit.alive && unit.team !== aiHero.team &&
              !(
                unit.id === aiHero.aiAvoidTargetId &&
                (aiHero.aiAvoidTargetUntil ?? 0) > now
              ) &&
              unit.campaignActivated !== false &&
              (companion
                ? unit.id === aiHero.aiTargetId || unit === assistTarget
                : sentry
                  ? unit === assistTarget || unit === sentryTarget
                  : unit === assistTarget ||
                  Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y) <= aggroRadius ||
                  (
                    unit.id === aiHero.aiTargetId &&
                    Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y) <=
                      SKIRMISH_HERO_PURSUIT_DISTANCE
                  ) ||
                  (!sentry && Math.hypot(unit.x - ownCore.x, unit.y - ownCore.y) <= 8)),
          ),
          targetEntry = enemies
            .map((unit) => {
              const plan = combatApproachPlan(aiHero, unit, basicRange),
                directDistance = Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y),
                forced = unit === assistTarget || Math.hypot(unit.x - ownCore.x, unit.y - ownCore.y) <= 8;
              return {
                unit,
                plan,
                directDistance,
                forced,
                score:
                 (plan?.distance ?? directDistance + 4) * 3 +
                  unit.hp / unit.maxHp * 2 -
                  (unit === assistTarget ? 18 : 0) -
                 (unit.role === "hero" ? 5 : 0) -
                 (Math.hypot(unit.x - ownCore.x, unit.y - ownCore.y) < 8 ? 5 : 0),
              };
            })
            .filter((entry) =>
              companion || sentry
                ? Boolean(entry.plan)
                : skirmishHeroShouldPursue({
                    directDistance: entry.directDistance,
                    routeDistance: entry.plan?.distance ?? null,
                    aggroRadius,
                    locked: entry.unit.id === aiHero.aiTargetId,
                    forced: entry.forced,
                    targetAccessible: canEngageAt(aiHero.team, entry.unit.x, entry.unit.y),
                  }),
            )
            .sort((a, b) => a.score - b.score)[0],
          target = targetEntry?.unit,
          targetPlan = targetEntry?.plan,
          targetDistance = targetEntry?.directDistance ?? 99,
          coreDanger = Math.min(1, enemies.filter((unit) => Math.hypot(unit.x - ownCore.x, unit.y - ownCore.y) < 9).length / 4),
          strategicGoal = companion
            ? target ?? (coreAssault ? opposingCore : { x: hero.x - 1, y: hero.y + 1 })
            : sentry
              ? { x: aiHero.campaignGuardX ?? aiHero.x, y: aiHero.campaignGuardY ?? aiHero.y }
              : assignedRouteGoal ?? (coreAssault || teamKnowsEnemyCore(aiHero.team)
                ? opposingCore
                : frontScout?.aiSearchGoal ?? explorationGoal(aiHero)),
          engagementGoal = target ?? strategicGoal,
          routeStep = cardinal(engagementGoal.x - aiHero.x, engagementGoal.y - aiHero.y),
          routeBlocked = !openForTeam(aiHero.x + routeStep.x, aiHero.y + routeStep.y, aiHero.team),
          cooldowns = aiHero.aiCooldowns ?? [0, 0, 0, 0],
          brainDecision = decideHeroAction({
            hpRatio: aiHero.hp / aiHero.maxHp,
            allyHpRatio: allies.length ? Math.min(...allies.map((unit) => unit.hp / unit.maxHp)) : 1,
            coreDanger,
            targetDistance,
            enemiesInBasic: target && targetDistance <= basicRange ? 1 : 0,
            enemiesInArea: enemies.filter((unit) => Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y) <= 3).length,
            targetHpRatio: target ? target.hp / target.maxHp : 1,
            routeBlocked,
            allyNearby: allies.some((unit) => Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y) <= 4),
            cooldowns: cooldowns.map((readyAt) => readyAt - now) as [number, number, number, number],
            role: heroBrainRole(aiHero),
            previousAction: aiHero.aiPreviousAction as Parameters<typeof decideHeroAction>[0]["previousAction"],
          }),
          // 캠페인 동료는 적에게 붙은 뒤 공용 "전진" 점수 때문에 점유 칸을 향해
          // 왕복하지 않는다. 사거리 안이면 반드시 공격하고, 그 밖에서만 공용 판단을 쓴다.
          decision = companion && target && targetDistance <= basicRange
            ? { action: "attack" as const, score: 999, reason: "동행 영웅이 사거리 안의 적을 즉시 공격한다" }
            : campaign1InvadingHero &&
                target &&
                (brainDecision.action === "retreat" || brainDecision.action === "regroup")
              ? {
                  action: "attack" as const,
                  score: 998,
                  reason: "철각은 후퇴하지 않고 서울 거점 앞 방어자를 돌파한다",
                }
            : computerInvader &&
                (brainDecision.action === "retreat" || brainDecision.action === "regroup")
              ? {
                  action: target ? "attack" as const : "push" as const,
                  score: 999,
                  reason: target
                    ? "컴퓨터 공세 영웅은 교전을 끝내고 적 코어 압박을 계속한다"
                    : "컴퓨터 공세 영웅은 후퇴하지 않고 적 코어로 전진한다",
                }
            : coreAssault &&
                !target &&
                (brainDecision.action === "retreat" || brainDecision.action === "regroup")
              ? {
                  action: "push" as const,
                  score: 997,
                  reason: "교전 대상이 없으면 기지에 머물지 않고 적 거점 공세를 재개한다",
                }
            : brainDecision;
        if (assignedRoute) aiHero.routePointIndex = assignedRouteProgress.index;
        aiHero.aiDecisionReason = decision.reason;
        aiHero.aiTargetId = target?.id;
        if (assistThreat?.kind === "installation" && assistInstallation) {
          const installationDistance = Math.hypot(
            assistInstallation.x - aiHero.x,
            assistInstallation.y - aiHero.y,
          );
          aiHero.aiTargetId = undefined;
          aiHero.aiDecisionReason = installationDistance <= basicRange
            ? `아군을 공격한 ${buildDef(assistInstallation.kind).name}에 즉시 반격한다`
            : `아군을 공격한 ${buildDef(assistInstallation.kind).name}까지 실제 경로 ${assistThreat.plan.distance}칸으로 지원한다`;
          if (
            installationDistance <= basicRange &&
            clearRay(aiHero.x, aiHero.y, assistInstallation.x, assistInstallation.y, aiHero.team)
          ) {
            aiHero.dir = cardinal(
              assistInstallation.x - aiHero.x,
              assistInstallation.y - aiHero.y,
            );
            if (basicRange > 2)
              fire(
                aiHero,
                assistInstallation.x - aiHero.x,
                assistInstallation.y - aiHero.y,
                "arrow",
                aiHero.attack,
              );
            else
              melee(
                aiHero,
                {
                  x: assistInstallation.x - aiHero.x,
                  y: assistInstallation.y - aiHero.y,
                },
                4,
              );
            setBattleHeroAction(aiHero, 0, Math.max(380, aiHero.attackInterval * 720));
            aiHero.aiPreviousAction = "attack-installation";
            return;
          }
          const installationStep = assistThreat.plan.step;
          if (installationStep) {
            const moveDuration = companion
              ? unitMovementDuration(campaignCompanionMoveDuration(
                  assistThreat.plan.distance,
                  terrainMoveFactor(
                    aiHero.x + installationStep.x,
                    aiHero.y + installationStep.y,
                  ),
                ))
              : unitMovementDuration(
                  (240 + (aiHero.id % 4) * 24) /
                    terrainMoveFactor(aiHero.x + installationStep.x, aiHero.y + installationStep.y),
                );
            moveOrDig(aiHero, installationStep.x, installationStep.y, moveDuration);
            aiHero.dir = installationStep;
            aiHero.act = moveDuration;
          } else aiHero.act = unitMovementDuration(120);
          aiHero.aiPreviousAction = "assist-installation";
          return;
        }
        if (!target && coreAssault && !assignedRouteGoal) {
          const coreDistance = Math.hypot(
            opposingCore.x - aiHero.x,
            opposingCore.y - aiHero.y,
          );
          if (
            coreDistance <= basicRange &&
            clearRay(aiHero.x, aiHero.y, opposingCore.x, opposingCore.y, aiHero.team)
          ) {
            aiHero.dir = cardinal(
              opposingCore.x - aiHero.x,
              opposingCore.y - aiHero.y,
            );
            melee(
              aiHero,
              {
                x: opposingCore.x - aiHero.x,
                y: opposingCore.y - aiHero.y,
              },
              4,
              "coreSiege",
            );
            setBattleHeroAction(
              aiHero,
              0,
              Math.max(380, aiHero.attackInterval * 720),
            );
            aiHero.aiDecisionReason = "다른 설치물이 남아 있어도 적 거점을 직접 공격한다";
            aiHero.aiPreviousAction = "attack-core";
            return;
          }
        }
        if (
          sentry &&
          !target &&
          Math.hypot(
            aiHero.x - (aiHero.campaignGuardX ?? aiHero.x),
            aiHero.y - (aiHero.campaignGuardY ?? aiHero.y),
          ) <= 1
        ) {
          aiHero.aiPreviousAction = "guard";
          aiHero.act = 320;
          return;
        }
        const skillChainReady = (aiHero.aiComboLockUntil ?? 0) <= now,
          targetInSkillRange = (slot: 1 | 2 | 4) => {
            if (!target) return false;
            const action = heroAction(aiHero.heroId ?? "yoo-seungcheon", slot),
              effectiveRange = Math.max(2.5, action.range + action.radius);
            return targetDistance <= effectiveRange && clearRay(aiHero.x, aiHero.y, target.x, target.y, aiHero.team);
          };
        if (target && targetInSkillRange(4) && skillChainReady && decision.action === "ultimate" && cooldowns[3] <= now) return executeBattleHeroSkill(aiHero, target, 4);
        if (target && targetInSkillRange(2) && skillChainReady && decision.action === "skill2" && cooldowns[1] <= now) return executeBattleHeroSkill(aiHero, target, 2);
        if (target && targetInSkillRange(1) && skillChainReady && decision.action === "skill1" && cooldowns[0] <= now) return executeBattleHeroSkill(aiHero, target, 1);
        if (
          !companion &&
          !sentry &&
          (!isSecretTunnel || battlePhase === "prepare") &&
          decision.action === "drill" &&
          cooldowns[2] <= now
        ) return executeBattleHeroDrill(aiHero, engagementGoal);
        if (target && targetDistance <= basicRange && clearRay(aiHero.x, aiHero.y, target.x, target.y, aiHero.team)) {
          aiHero.dir = cardinal(target.x - aiHero.x, target.y - aiHero.y);
          if (basicRange > 2) fire(aiHero, target.x - aiHero.x, target.y - aiHero.y, "arrow", aiHero.attack);
          else melee(aiHero, { x: target.x - aiHero.x, y: target.y - aiHero.y }, 4);
          setBattleHeroAction(aiHero, 0, Math.max(380, aiHero.attackInterval * 720));
          aiHero.aiPreviousAction = "attack";
          return;
        }
        // A campaign companion must finish a reachable fight even if the player backs away.
        // stepCampaignHero returns it to formation only after the target is gone or unreachable.
        const retreating = !companion && (decision.action === "retreat" || decision.action === "regroup"),
          role = heroBrainRole(aiHero),
          screenMinion = units
             .filter((unit) => unit.alive && unit.team === aiHero.team && unit.role === "minion")
             .sort((a, b) => Math.hypot(a.x - strategicGoal.x, a.y - strategicGoal.y) - Math.hypot(b.x - strategicGoal.x, b.y - strategicGoal.y))[0],
          formationGoal = !coreAssault && (role === "support" || role === "artillery") && screenMinion
            ? frontLineScreenGoal(screenMinion, ownCore, role)
            : strategicGoal,
          goal = retreating
            ? companion ? { x: hero.x - 1, y: hero.y + 1 } : ownCore
            : companion && target
              ? target
              : target && targetDistance < 9 ? target : formationGoal;
        if (retreating && Math.hypot(aiHero.x - ownCore.x, aiHero.y - ownCore.y) <= 2.5) {
          aiHero.act = 480;
          return;
        }
        const coreApproachPlan = !target && coreAssault && !assignedRouteGoal
          ? combatApproachPlan(aiHero, opposingCore, basicRange)
          : null;
        let step = target
          ? targetPlan?.step ?? null
          : coreApproachPlan?.step ?? nextPath(aiHero, goal);
        if (!step && target && !targetPlan)
          step = cardinal(target.x - aiHero.x, target.y - aiHero.y);
        let blockingInstallation = step ? turretAt(aiHero.x + step.x, aiHero.y + step.y, aiHero.team) : undefined,
          obstruction = blockingInstallation?.team !== aiHero.team
            ? { turret: blockingInstallation, approach: { x: aiHero.x, y: aiHero.y }, distance: 0 }
            : !step && !target
              ? reachableEnemyInstallation(aiHero)
              : undefined;
        const response = siegeResponse({
          adjacentEnemyInstallation: Boolean(blockingInstallation && blockingInstallation.team !== aiHero.team),
          pathBlockedByEnemyInstallation: Boolean(blockingInstallation && blockingInstallation.team !== aiHero.team),
          reachableEnemyInstallation: Boolean(obstruction),
        });
        if (response === "attack" && obstruction?.turret) {
          const siegeTarget = obstruction.turret,
            siegeDistance = Math.hypot(siegeTarget.x - aiHero.x, siegeTarget.y - aiHero.y);
          if (skillChainReady && decision.action === "ultimate" && cooldowns[3] <= now && executeBattleHeroSiegeSkill(aiHero, siegeTarget, 4)) return;
          if (skillChainReady && decision.action === "skill2" && cooldowns[1] <= now && executeBattleHeroSiegeSkill(aiHero, siegeTarget, 2)) return;
          if (skillChainReady && decision.action === "skill1" && cooldowns[0] <= now && executeBattleHeroSiegeSkill(aiHero, siegeTarget, 1)) return;
          aiHero.dir = cardinal(siegeTarget.x - aiHero.x, siegeTarget.y - aiHero.y);
          if (basicRange > 2 && siegeDistance <= basicRange && clearRay(aiHero.x, aiHero.y, siegeTarget.x, siegeTarget.y, aiHero.team))
            fire(aiHero, siegeTarget.x - aiHero.x, siegeTarget.y - aiHero.y, "arrow", aiHero.attack);
          else melee(aiHero, { x: siegeTarget.x - aiHero.x, y: siegeTarget.y - aiHero.y }, 4);
          setBattleHeroAction(aiHero, 0, Math.max(380, aiHero.attackInterval * 720));
          aiHero.aiPreviousAction = "attack";
          return;
        }
        if (response === "approach" && obstruction)
          step = nextPath(aiHero, obstruction.approach);
        if (!step && target) {
          const targetRecovery = DIRS
            .map((direction) => {
              const x = aiHero.x + direction.x,
                y = aiHero.y + direction.y;
              if (
                !openForTeam(x, y, aiHero.team) ||
                baseAt(x, y) ||
                turretAt(x, y, aiHero.team) ||
                occupied(x, y, aiHero, aiHero.team)
              ) return null;
              const distance = Math.hypot(target.x - x, target.y - y),
                hasLine = distance <= basicRange &&
                  clearRay(x, y, target.x, target.y, aiHero.team),
                crowd = DIRS.filter((nearby) =>
                  occupied(x + nearby.x, y + nearby.y, aiHero, aiHero.team),
                ).length;
              return {
                direction,
                score: (hasLine ? -50 : 0) + distance * 3 + crowd * 2,
              };
            })
            .filter(Boolean)
            .sort((a, b) => a!.score - b!.score)[0];
          step = targetRecovery?.direction ?? null;
          if (step)
            aiHero.aiDecisionReason = "공격 위치가 막혀 측면 칸으로 이동해 사선을 다시 만든다";
        }
        if (!step && (target || companion || sentry)) {
          aiHero.noPathMs = (aiHero.noPathMs ?? 0) + 180;
          if (target && !companion && !sentry && aiHero.noPathMs >= 900) {
            aiHero.aiAvoidTargetId = target.id;
            aiHero.aiAvoidTargetUntil = now + 1200;
            aiHero.aiTargetId = undefined;
            aiHero.noPathMs = 0;
            aiHero.aiDecisionReason = "막힌 교전 표적을 잠시 넘기고 A/B 공세 경로를 다시 탐색한다";
            aiHero.aiPreviousAction = "repath";
          } else aiHero.aiPreviousAction = target ? "wait-path" : "guard";
          aiHero.act = unitMovementDuration(120);
          return;
        }
        step ??= cardinal(goal.x - aiHero.x, goal.y - aiHero.y);
        if (
          grid[aiHero.y + step.y]?.[aiHero.x + step.x]?.type === 4 ||
          baseAt(aiHero.x + step.x, aiHero.y + step.y) ||
          turretAt(aiHero.x + step.x, aiHero.y + step.y, aiHero.team)?.team === aiHero.team ||
          occupied(aiHero.x + step.x, aiHero.y + step.y, aiHero)
        ) {
          const alternatives = DIRS
            .filter((direction) => {
              const x = aiHero.x + direction.x, y = aiHero.y + direction.y, tile = grid[y]?.[x];
              return tile &&
                (isSecretTunnel && battlePhase === "assault"
                  ? openForTeam(x, y, aiHero.team)
                  : tile.type !== 4) &&
                !baseAt(x, y) && !turretAt(x, y, aiHero.team) && !occupied(x, y, aiHero);
            })
            .sort((a, b) => {
              const distanceA = Math.hypot(aiHero.x + a.x - goal.x, aiHero.y + a.y - goal.y),
                distanceB = Math.hypot(aiHero.x + b.x - goal.x, aiHero.y + b.y - goal.y);
              return distanceA - distanceB || ((aiHero.id % 2 ? a.y - b.y : a.x - b.x));
            });
          if (alternatives[0]) step = alternatives[0];
        }
        const heroMoveDuration = companion
          ? unitMovementDuration(campaignCompanionMoveDuration(
            targetPlan?.distance ?? CAMPAIGN_COMPANION_AGGRO_DISTANCE,
            terrainMoveFactor(aiHero.x + step.x, aiHero.y + step.y),
          ))
          : unitMovementDuration(
              (240 + (aiHero.id % 4) * 24) /
                terrainMoveFactor(aiHero.x + step.x, aiHero.y + step.y),
            );
        let moved = false;
        if (grid[aiHero.y]?.[aiHero.x]?.hazard === "steam" && selectedBattleMap.hazard === "steam") {
          const safe = DIRS.find((direction) => openForTeam(aiHero.x + direction.x, aiHero.y + direction.y, aiHero.team) && grid[aiHero.y + direction.y]?.[aiHero.x + direction.x]?.hazard !== "steam");
          moved = safe
            ? moveOrDig(aiHero, safe.x, safe.y, heroMoveDuration)
            : moveOrDig(aiHero, step.x, step.y, heroMoveDuration);
        } else moved = moveOrDig(aiHero, step.x, step.y, heroMoveDuration);
        aiHero.noPathMs = moved ? 0 : (aiHero.noPathMs ?? 0) + heroMoveDuration;
        if (!moved && aiHero.noPathMs >= 780) {
          const escape = DIRS
            .filter((direction) => {
              const x = aiHero.x + direction.x,
                y = aiHero.y + direction.y;
              return openForTeam(x, y, aiHero.team) && !baseAt(x, y) &&
                !turretAt(x, y, aiHero.team) && !occupied(x, y, aiHero, aiHero.team);
            })
            .sort((a, b) =>
              Math.hypot(aiHero.x + a.x - goal.x, aiHero.y + a.y - goal.y) -
              Math.hypot(aiHero.x + b.x - goal.x, aiHero.y + b.y - goal.y),
            )[0];
          if (escape) moved = moveOrDig(aiHero, escape.x, escape.y, heroMoveDuration);
          if (moved) aiHero.noPathMs = 0;
        }
        if (!moved && target && !companion && !sentry && aiHero.noPathMs >= 1040) {
          aiHero.aiAvoidTargetId = target.id;
          aiHero.aiAvoidTargetUntil = now + 1200;
          aiHero.aiTargetId = undefined;
          aiHero.noPathMs = 0;
          aiHero.aiDecisionReason = "혼잡으로 전진하지 못해 표적을 잠시 건너뛰고 공세 경로를 복구한다";
        }
        aiHero.aiPreviousAction = decision.action;
        aiHero.act = heroMoveDuration;
      };
    const arenaFighters = () =>
        units.filter(
          (unit) =>
            unit.alive &&
            (unit.campaignAi === "arena" ||
              (isCampaign &&
                campaignChapter === 3 &&
                (unit === hero || unit.campaignAi === "companion"))),
        ),
      arenaDamage = (attacker: Unit, target: Unit, damage: number, actionName = "기본 공격") => {
        target.arenaLastAttackerId = attacker.id;
        target.arenaThreatUntil = performance.now() + 2600;
        return hurt(
          target,
          damage,
          attacker.team,
          true,
          attacker.critChance,
          attacker.critMultiplier,
          true,
          { attacker: attacker.name, action: actionName, unit: attacker },
        );
      },
      arenaFx = (
        fighter: Unit,
        target: Unit,
        _variant: string,
        _radius = 1.2,
        _duration = 620,
      ) => {
        void _radius;
        void _duration;
        const d = unitVector(target.x - fighter.x, target.y - fighter.y);
        fighter.dir = d;
      },
      setArenaAction = (fighter: Unit, slot: 0 | 1 | 2 | 4, duration: number) => {
        if (slot === 4) fighter.ultimateLabelUntil = performance.now() + 1150;
        fighter.arenaActionStartedAt = performance.now();
        fighter.arenaActionDuration = duration;
        fighter.arenaActionSlot = slot;
        fighter.arenaActionUntil = performance.now() + duration;
        fighter.act = duration;
        if (fighter === hero)
          playHeroAnim(
            slot === 0 ? "basic" : slot === 1 ? "whirlwind" : slot === 2 ? "thrust" : "ultimate",
            duration,
            slot,
          );
      },
      setArenaMoveVisual = (
        fighter: Unit,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        duration = 280,
      ) => {
        fighter.arenaMoveFromX = fromX;
        fighter.arenaMoveFromY = fromY;
        fighter.arenaMoveToX = toX;
        fighter.arenaMoveToY = toY;
        fighter.arenaMoveStartedAt = performance.now();
        fighter.arenaMoveDuration = duration;
        fighter.arenaMoveUntil = performance.now() + duration;
      },
      pushArenaTarget = (fighter: Unit, target: Unit, cells = 1, actionName = "밀치기") => {
        const now = performance.now();
        if (now < (target.arenaPushImmuneUntil ?? 0)) return;
        const d = cardinal(target.x - fighter.x, target.y - fighter.y),
          start = unitWorld(target);
        for (let i = 0; i < Math.min(1, cells); i++) {
          const nx = target.x + d.x, ny = target.y + d.y;
          if (!openForTeam(nx, ny, target.team) || occupied(nx, ny, target) || turretAt(nx, ny, target.team) || baseAt(nx, ny)) break;
          target.x = nx;
          target.y = ny;
          if (target === hero) {
            heroWorld.x = hero.x * S + S / 2;
            heroWorld.y = hero.y * S + S / 2;
          }
        }
        const end = unitWorld(target);
        if (start.x !== end.x || start.y !== end.y) {
          setArenaMoveVisual(target, start.x, start.y, end.x, end.y, 240 + cells * 70);
          target.arenaPushImmuneUntil = now + 900;
          pushCombatPopup(
            end.x,
            end.y - 48,
            `${actionName} · 밀려남`,
            "#ffd66b",
            target.team,
            false,
            950,
          );
        }
      },
      arenaAreaDamage = (attacker: Unit, radius: number, damage: number, stun = 0, actionName = "범위 기술") => {
        for (const target of arenaFighters()) {
          if (
            target === attacker ||
            target.team === attacker.team ||
            Math.hypot(target.x - attacker.x, target.y - attacker.y) > radius
          ) continue;
          arenaDamage(attacker, target, damage, actionName);
          if (target.alive && stun) target.act = Math.max(target.act, stun);
        }
      },
      chooseArenaTarget = (fighter: Unit) => {
        const now = performance.now(),
          candidates = arenaFighters().filter(
            (unit) => unit !== fighter && unit.team !== fighter.team,
          ),
          current = candidates.find((unit) => unit.id === fighter.arenaTargetId);
        if (!candidates.length) return null;
        if (current && now < (fighter.arenaTargetUntil ?? 0)) return current;
        const sharedTarget = candidates.find(
            (unit) =>
              unit.id === fighter.assistTargetId &&
              now < (fighter.assistUntil ?? 0),
          ),
          id = fighter.campaignHeroId ?? "yoo-seungcheon",
          ranked = candidates
          .map((unit) => ({
            unit,
            score:
              Math.hypot(unit.x - fighter.x, unit.y - fighter.y) * (id === "ahn-seona" ? 0.18 : 0.55) +
              (unit.hp / unit.maxHp) * (id === "kimssi" ? 1.8 : 0.9) +
              arenaFighters().filter(
                (other) =>
                  other !== fighter &&
                  other.team === fighter.team &&
                  other.arenaTargetId === unit.id,
              ).length * -0.65 -
              (unit === sharedTarget ? 4.5 : 0) +
              (unit.id === fighter.arenaLastAttackerId && now < (fighter.arenaThreatUntil ?? 0) ? -2.4 : 0) +
              (unit.hp / unit.maxHp < 0.28 ? -1.6 : 0) +
              random() * 2.2,
          }))
          .sort((a, b) => a.score - b.score);
        const pool = ranked.slice(0, Math.min(2, ranked.length)), chosen = pool[Math.floor(random() * pool.length)].unit;
        fighter.arenaTargetId = chosen.id;
        fighter.arenaTargetUntil = now + 1300 + random() * 900;
        return chosen;
      },
      arenaBasicAttack = (fighter: Unit, target: Unit) => {
        const id = fighter.heroId ?? fighter.campaignHeroId ?? "yoo-seungcheon",
          action = heroAction(id, 0),
          duration = Math.max(430, fighter.attackInterval * 720);
        arenaDamage(fighter, target, fighter.attack * action.damage, action.caption);
        if (action.mode === "microwaveBash")
          target.act = Math.max(target.act, 300);
        if (action.mode === "shieldBash")
          pushArenaTarget(fighter, target, 1, action.caption);
        arenaFx(fighter, target, action.mode, action.mode === "chemicalSpray" ? 1.8 : 1.25, duration);
        setArenaAction(fighter, 0, duration);
      },
      arenaUseSkill = (fighter: Unit, target: Unit, ultimate: boolean, preferredSlot?: 1 | 2) => {
        const now = performance.now(), id = fighter.heroId ?? fighter.campaignHeroId ?? "yoo-seungcheon",
          def = HEROES.find((heroDef) => heroDef.id === id), slot: 1 | 2 | 4 = ultimate ? 4 : preferredSlot ?? (random() < 0.5 ? 1 : 2),
          action = heroAction(id, slot),
          radius = Math.max(1.2, action.radius || action.range * 0.35),
          duration = ultimate ? 920 : 760,
          actionName = def?.skills[slot === 4 ? 3 : slot - 1] ?? action.caption;
        if (["spin", "electricAura"].includes(action.mode))
          arenaAreaDamage(fighter, radius, fighter.attack * action.damage, action.mode === "electricAura" ? 280 : 0, actionName);
        else if (action.mode === "groupHeal") {
          const heal = campaign3ArenaHeal(fighter.campaignHealUses ?? 0, fighter.maxHp);
          if (heal > 0) {
            fighter.hp = Math.min(fighter.maxHp, fighter.hp + heal);
            fighter.campaignHealUses = (fighter.campaignHealUses ?? 0) + 1;
          }
        }
        else if (action.mode === "armorOrder") {
          fighter.armor += 6;
          setTimeout(() => { fighter.armor = Math.max(0, fighter.armor - 6); }, 3000);
        } else {
          arenaDamage(fighter, target, fighter.attack * action.damage, actionName);
          if (["microwave", "smash", "stunSpray"].includes(action.mode))
            target.act = Math.max(target.act, action.mode === "microwave" ? 1300 : action.mode === "stunSpray" ? 900 : 520);
          if (["dash", "shieldSweep", "lidDisc"].includes(action.mode))
            pushArenaTarget(fighter, target, 1, actionName);
        }
        arenaFx(fighter, target, action.mode, radius, duration);
        setArenaAction(fighter, slot, duration);
        void combatAudio.skillCue(id, slot, fighter === hero ? 1 : .68, fighter === hero ? 4 : slot === 4 ? 5 : 2);
        if (ultimate) fighter.arenaUltimateReadyAt = now + 7200 + random() * 1800;
        else fighter.arenaSkillReadyAt = now + 3200 + random() * 1200;
        if (def) setMessage(`${fighter.name} · ${actionName}`);
      },
      stepArenaHero = (fighter: Unit) => {
        if (!fighter.alive || fighter.act > 0) return;
        const target = chooseArenaTarget(fighter);
        if (!target) return;
        const now = performance.now(), id = fighter.campaignHeroId ?? "yoo-seungcheon",
          metricDistance = Math.hypot(target.x - fighter.x, target.y - fighter.y),
          combatDistance = Math.max(Math.abs(target.x - fighter.x), Math.abs(target.y - fighter.y)),
          basicRange = id === "ahn-seona" ? 5.2 : 1.45,
          skillRange = id === "ahn-seona" || id === "kang-ryeokhan" ? 6 : id === "yoo-seungcheon" ? 3.8 : 2.3,
          nearby = arenaFighters().filter((unit) => unit !== fighter && Math.hypot(unit.x - fighter.x, unit.y - fighter.y) <= 2.2).length,
          targetTired = target.hp / target.maxHp < 0.46,
          ultimateOpportunity = targetTired || (id === "kang-ryeokhan" && metricDistance > 2.4) || (id === "ahn-seona" && metricDistance > 3.2);
        if (combatDistance <= skillRange && now >= (fighter.arenaUltimateReadyAt ?? 0) && ultimateOpportunity && random() < 0.84) {
          arenaUseSkill(fighter, target, true);
          return;
        }
        if (combatDistance <= skillRange && now >= (fighter.arenaSkillReadyAt ?? 0)) {
          const preferredSlot: 1 | 2 =
            id === "ahn-seona"
              ? fighter.hp / fighter.maxHp < 0.72 && (fighter.campaignHealUses ?? 0) < 2 ? 2 : 1
              : id === "kimssi"
                ? nearby >= 2 ? 2 : 1
                : id === "kang-ryeokhan"
                  ? fighter.hp / fighter.maxHp < 0.58 ? 2 : 1
                  : nearby >= 2 ? 1 : 2;
          arenaUseSkill(fighter, target, false, preferredSlot);
          return;
        }
        if (combatDistance <= basicRange && !(id === "ahn-seona" && metricDistance < 2.4)) {
          arenaBasicAttack(fighter, target);
          return;
        }
        const desiredDistance = id === "ahn-seona" ? 4.1 : id === "kimssi" ? 1.05 : 1.35,
          movementChoices = DIRS.map((d) => {
            const x = fighter.x + d.x, y = fighter.y + d.y;
            if (!openForTeam(x, y, fighter.team) || occupied(x, y, fighter) || turretAt(x, y) || baseAt(x, y)) return null;
            const nextDistance = Math.hypot(target.x - x, target.y - y),
              crowd = arenaFighters().filter((unit) => unit !== fighter && Math.hypot(unit.x - x, unit.y - y) <= 1.2).length,
              exits = DIRS.filter((exit) => openForTeam(x + exit.x, y + exit.y, fighter.team)).length;
            return { d, score: Math.abs(nextDistance - desiredDistance) * 3.2 + crowd * 1.6 - exits * 0.35 + random() * 0.8 };
          }).filter(Boolean) as Array<{ d: { x: number; y: number }; score: number }>;
        movementChoices.sort((a, b) => a.score - b.score);
        let step: { x: number; y: number } | null = movementChoices[0]?.d ?? null;
        if (!step) step = nextPath(fighter, { x: target.x, y: target.y });
        if (step) {
          const arenaMoveDuration = unitMovementDuration(300);
          moveOrDig(fighter, step.x, step.y, arenaMoveDuration);
          if (fighter === hero) {
            heroWorld.x = hero.x * S + S / 2;
            heroWorld.y = hero.y * S + S / 2;
            heroMoveUntil = now + unitMovementDuration(320);
          }
        }
        fighter.act = unitMovementDuration(300 + random() * 90);
      };
    const stepCampaignHero = (fighter: Unit) => {
      if (!fighter.alive || fighter.act > 0) return;
      if (fighter.campaignAi === "arena") {
        stepArenaHero(fighter);
        return;
      }
      if (fighter.campaignAi === "battle") {
        stepBattleHero(fighter);
        return;
      }
      if (fighter.campaignAi === "companion") {
        if (!fighter.campaignPotionUsed && fighter.hp / fighter.maxHp < 0.32) {
          const recovered = Math.min(fighter.maxHp - fighter.hp, fighter.maxHp * 0.55);
          fighter.hp += recovered;
          fighter.campaignPotionUsed = true;
          burst(fighter.x, fighter.y, "#75e5c3", 16);
          pushCombatPopup(fighter.x, fighter.y, `자동 물약 +${Math.round(recovered)}`, "#82f0c9", fighter.team, false);
          fighter.act = 480;
          return;
        }
        const companionNow = performance.now(),
          companionAdvanced = fighter.companionLastX !== fighter.x || fighter.companionLastY !== fighter.y;
        if (fighter.companionLastProgressAt === undefined || companionAdvanced) {
          fighter.companionLastX = fighter.x;
          fighter.companionLastY = fighter.y;
          fighter.companionLastProgressAt = companionNow;
        }
        const stationaryMs = companionNow - (fighter.companionLastProgressAt ?? companionNow),
          availableFollowGoals = (radius: 1 | 2) =>
          campaignCompanionGoalOffsets(radius)
            .map((offset) => ({ x: hero.x + offset.x, y: hero.y + offset.y }))
            .filter((goal) =>
              openForTeam(goal.x, goal.y, fighter.team) &&
              (!occupied(goal.x, goal.y, fighter) || (goal.x === fighter.x && goal.y === fighter.y)) &&
              !turretAt(goal.x, goal.y) &&
              !baseAt(goal.x, goal.y),
            );
        let followGoals = availableFollowGoals(1),
          followPlan = pathPlanToGoals(fighter, followGoals),
          recoveryFormation = false;
        if (!followPlan) {
          followGoals = availableFollowGoals(2);
          followPlan = pathPlanToGoals(fighter, followGoals);
          recoveryFormation = Boolean(followPlan);
        }
        if (!followPlan) {
          // 플레이어 주변이 아군으로 가득 차도 플레이어가 지나온 열린 길 자체는 계속 추적한다.
          followGoals = [{ x: hero.x, y: hero.y }];
          followPlan = pathPlanToGoals(fighter, followGoals);
          recoveryFormation = Boolean(followPlan);
        }
        let playerRouteGap = followPlan?.distance ?? Infinity,
          forcedRejoin = fighter.companionRejoinMode === true,
          waitingAtFrontier = false;
        if (forcedRejoin && followPlan?.distance === 0) {
          fighter.companionRejoinMode = undefined;
          forcedRejoin = false;
          setMessage("김씨가 플레이어 전선에 자연스럽게 합류했다");
        }
        if (forcedRejoin && !followPlan) {
          // 길이 완전히 끊긴 상태에서는 순간이동하지 않고, 김씨가 갈 수 있는 열린 칸 중
          // 플레이어와 가장 가까운 경계까지 이동한 뒤 새 통로가 생기기를 기다린다.
          const reachable = pathDistanceMap(fighter);
          let frontierGoal: GridPoint | null = null,
            frontierScore = Infinity;
          for (let y = 0; y < ROWS; y++)
            for (let x = 0; x < COLS; x++) {
              const routeDistance = reachable.get(`${x},${y}`);
              if (
                routeDistance === undefined ||
                !openForTeam(x, y, fighter.team) ||
                occupied(x, y, fighter) ||
                turretAt(x, y) ||
                baseAt(x, y)
              ) continue;
              const score = Math.hypot(x - hero.x, y - hero.y) * 100 + routeDistance;
              if (score < frontierScore) {
                frontierScore = score;
                frontierGoal = { x, y };
              }
            }
          if (frontierGoal) {
            followGoals = [frontierGoal];
            followPlan = pathPlanToGoals(fighter, followGoals);
            recoveryFormation = true;
            waitingAtFrontier = followPlan?.distance === 0;
          }
        }
        const distanceToHero = followPlan?.distance ?? Infinity,
          assistThreat = forcedRejoin
            ? undefined
            : recentAssistThreat(
              fighter,
              CAMPAIGN_COMPANION_ASSIST_DISTANCE,
            ),
          assistTarget = assistThreat?.kind === "unit" ? assistThreat.unit : undefined,
          basicRange = combatRangeFor(fighter),
          lockedEnemy = fighter.aiTargetId === undefined
            ? undefined
            : units.find((unit) => unit.id === fighter.aiTargetId && unit.alive && unit.team !== fighter.team),
          enemyCandidates = units
            .filter(
              (unit) =>
                !forcedRejoin &&
                unit.alive &&
                unit.team !== fighter.team &&
                unit.campaignActivated !== false,
            )
            .map((unit) => {
              const plan = combatApproachPlan(fighter, unit, basicRange),
                distance = plan?.distance ?? Infinity,
                sharedThreat = unit === assistTarget,
                committed = unit === lockedEnemy || sharedThreat,
                reachable = Boolean(plan) && distance <= (
                  committed
                    ? CAMPAIGN_COMPANION_ASSIST_DISTANCE
                    : CAMPAIGN_COMPANION_AGGRO_DISTANCE
                );
                // Keep a valid target until it dies or becomes unreachable. This prevents
                // companions from flickering between follow and combat goals every tick.
                return {
                  unit,
                  plan,
                  distance,
                  reachable,
                  sharedThreat,
                  committed,
                  score: distance - (unit === lockedEnemy ? 12 : 0) - (sharedThreat ? 24 : 0),
                };
            })
            .filter((candidate) => candidate.reachable)
            .sort((a, b) => a.score - b.score),
          enemy = enemyCandidates[0],
          localInstallation = forcedRejoin
            ? undefined
            : turrets
              .filter((installation) =>
                installation.hp > 0 &&
                installation.team !== fighter.team &&
                installation.campaignActivated !== false,
              )
              .map((installation) => ({
                installation,
                plan: combatApproachPlan(fighter, installation, basicRange),
                directDistance: Math.hypot(installation.x - fighter.x, installation.y - fighter.y),
              }))
              .filter((candidate) => campaignShouldEngageLocalObjective(
                candidate.plan?.distance ?? Infinity,
                false,
                CAMPAIGN_COMPANION_AGGRO_DISTANCE,
              ))
              .sort((a, b) => (a.plan?.distance ?? Infinity) - (b.plan?.distance ?? Infinity))[0],
          opposingCore = fighter.team === "blue" ? ENEMY : ALLY,
          localCorePlan = !forcedRejoin && teamHasSpottedCore(
              [fighter],
              fighter.team,
              opposingCore,
              CAMPAIGN_COMPANION_AGGRO_DISTANCE,
            )
            ? combatApproachPlan(fighter, opposingCore, basicRange)
            : null,
          mode = campaignCompanionMode(
            distanceToHero,
            enemy?.distance ?? Infinity,
            enemy?.reachable ?? false,
            enemy?.committed ?? false,
          );
        let followStep = followPlan?.step ?? null;
        if (!followStep && followPlan && followPlan.distance > 0) {
          fighter.blockedMs = (fighter.blockedMs ?? 0) + 180;
          if ((fighter.blockedMs ?? 0) >= 360)
            followStep = companionSidestepStepToGoals(fighter, followGoals);
        } else if (followStep || followPlan?.distance === 0) fighter.blockedMs = 0;
        fighter.noPathMs = followPlan ? 0 : (fighter.noPathMs ?? 0) + 180;
        const routeGap = playerRouteGap,
          enemyInActiveCombat = Boolean(
            enemy &&
            Math.hypot(enemy.unit.x - fighter.x, enemy.unit.y - fighter.y) <= Math.max(3.5, basicRange + 1) &&
            clearRay(fighter.x, fighter.y, enemy.unit.x, enemy.unit.y, fighter.team),
          ),
          installationInActiveCombat = Boolean(
            (assistThreat?.kind === "installation" || localInstallation) &&
            (() => {
              const installation = assistThreat?.kind === "installation"
                ? assistThreat.installation
                : localInstallation?.installation;
              return Boolean(
                installation &&
                Math.hypot(installation.x - fighter.x, installation.y - fighter.y) <= Math.max(3.5, basicRange + 1) &&
                clearRay(fighter.x, fighter.y, installation.x, installation.y, fighter.team)
              );
            })(),
          ),
          coreInActiveCombat = Boolean(
            localCorePlan &&
            Math.hypot(opposingCore.x - fighter.x, opposingCore.y - fighter.y) <= Math.max(3.5, basicRange + 1) &&
            clearRay(fighter.x, fighter.y, opposingCore.x, opposingCore.y, fighter.team),
          ),
          emergencyRejoin = !forcedRejoin && campaignCompanionShouldEmergencyRejoin(
            Boolean(followPlan),
            Boolean(followStep),
            fighter.blockedMs ?? 0,
            fighter.noPathMs ?? 0,
            routeGap,
            stationaryMs,
            enemyInActiveCombat || installationInActiveCombat || coreInActiveCombat,
          );
        if (emergencyRejoin) {
          forcedRejoin = true;
          fighter.companionRejoinMode = true;
          fighter.companionLastProgressAt = companionNow;
          fighter.aiTargetId = undefined;
          fighter.aiTargetUntil = 0;
          clearAssistTarget(fighter);
          setMessage("김씨가 막힌 전투 목표를 포기하고 열린 길로 돌아오는 중이다");
        }
        const followDestination = followStep
            ? { x: fighter.x + followStep.x, y: fighter.y + followStep.y }
            : null,
          canAdvanceNow = Boolean(
            followDestination &&
            !occupied(followDestination.x, followDestination.y, fighter) &&
            !turretAt(followDestination.x, followDestination.y) &&
            !baseAt(followDestination.x, followDestination.y),
          ),
          hardRecovery = campaignCompanionShouldHardRejoin(
            forcedRejoin,
            stationaryMs,
            playerRouteGap,
            canAdvanceNow,
          );
        if (hardRecovery) {
          const heroReachable = pathDistanceMap(hero),
            emergencyGoal = availableFollowGoals(2).find((goal) => heroReachable.has(`${goal.x},${goal.y}`));
          if (emergencyGoal) {
            burst(fighter.x, fighter.y, "#7fe6e2", 18);
            fighter.x = emergencyGoal.x;
            fighter.y = emergencyGoal.y;
            fighter.arenaMoveUntil = undefined;
            fighter.arenaMoveFromX = undefined;
            fighter.arenaMoveFromY = undefined;
            fighter.arenaMoveToX = undefined;
            fighter.arenaMoveToY = undefined;
            fighter.noPathMs = 0;
            fighter.blockedMs = 0;
            fighter.companionLastX = emergencyGoal.x;
            fighter.companionLastY = emergencyGoal.y;
            fighter.companionLastProgressAt = companionNow;
            fighter.companionRejoinMode = undefined;
            fighter.aiTargetId = undefined;
            fighter.aiTargetUntil = 0;
            clearAssistTarget(fighter);
            fighter.act = 520;
            burst(fighter.x, fighter.y, "#d9b761", 22);
            setMessage("김씨의 자연 경로 복구가 장시간 실패해 최후 안전 재합류를 실행했다");
            fighter.aiDecisionReason = "강제 추종 중 10초 이상 실제 이동과 열린 다음 칸이 없어 예외 순간이동한다";
            return;
          }
        }
        if (
          !forcedRejoin &&
          localInstallation?.plan &&
          (!enemy || (localInstallation.plan.distance ?? Infinity) <= enemy.distance)
        ) {
          fighter.aiTargetId = undefined;
          fighter.assistTargetKind = "installation";
          fighter.assistTargetId = localInstallation.installation.id;
          fighter.assistUntil = companionNow + CAMPAIGN_COMPANION_ASSIST_MEMORY_MS;
          fighter.assistReason = "local-threat";
          stepBattleHero(fighter);
          return;
        }
        if (
          !forcedRejoin &&
          !enemy &&
          campaignShouldEngageLocalObjective(
            localCorePlan?.distance ?? Infinity,
            false,
            CAMPAIGN_COMPANION_AGGRO_DISTANCE,
          )
        ) {
          fighter.aiTargetId = undefined;
          clearAssistTarget(fighter);
          stepBattleHero(fighter);
          return;
        }
        if (!forcedRejoin && assistThreat?.kind === "installation") {
          fighter.aiTargetId = undefined;
          stepBattleHero(fighter);
          return;
        }
        if (!forcedRejoin && mode === "engage" && enemy) {
          fighter.aiTargetId = enemy.unit.id;
          stepBattleHero(fighter);
          return;
        }
        fighter.aiTargetId = undefined;
        let followMoved = false;
        if (followStep && followDestination) {
          const { x: nx, y: ny } = followDestination;
          if (canAdvanceNow) {
            const moveDuration = unitMovementDuration(campaignCompanionMoveDuration(
              distanceToHero,
              terrainMoveFactor(nx, ny),
            ));
            commitGridMove(fighter, nx, ny, moveDuration);
            fighter.dir = followStep;
            fighter.act = moveDuration;
            fighter.blockedMs = 0;
            fighter.noPathMs = 0;
            followMoved = true;
          }
        }
        fighter.aiDecisionReason = forcedRejoin
          ? followStep
            ? `막힌 장거리 목표를 포기하고 실제 열린 경로 ${followPlan?.distance ?? 0}칸을 빠르게 따라간다`
            : waitingAtFrontier
              ? "순간이동하지 않고 연결 가능한 가장 가까운 경계에서 새 통로를 기다린다"
              : "플레이어까지 이어지는 실제 열린 길을 다시 탐색한다"
          : followStep
            ? `${(fighter.blockedMs ?? 0) > 0 ? "아군 정체를 옆칸으로 우회" : `실제 경로 ${followPlan?.distance ?? 0}칸`} · 플레이어 ${recoveryFormation ? "근접" : "인접"} 위치로 합류한다`
            : followPlan
              ? "플레이어 바로 옆 전투 위치를 유지한다"
              : "플레이어까지 열린 우회로를 다시 탐색한다";
        if (!followMoved) fighter.act = 180;
        return;
      }
      const target = nearestEnemy(fighter, 30);
      if (target) {
        // 동료도 대전 영웅과 같은 판단·기술·기본 공격 모듈을 사용한다.
        stepBattleHero(fighter);
        return;
      }
      fighter.act = 320;
    };
    const stepTurrets = (dt: number) => {
        if (isSecretTunnel && battlePhase === "prepare") return;
        for (const t of turrets) {
          const def = buildDef(t.kind);
          if (
            t.hp <= 0 ||
            t.campaignActivated === false ||
            (def.category === "blocker" || def.category === "support") ||
            t.demolish !== undefined ||
            t.upgrade
          )
            continue;
          t.cool -= dt;
          if (t.cool > 0) continue;
          const stats = turretStats(t),
              targetCount =
                t.kind === "laserL1" || t.kind === "missileM2"
                ? 1
                : Math.max(1, stats.targets),
            targets = units
              .filter(
                (u) =>
                  u.alive &&
                  u.team !== t.team &&
                  Math.hypot(u.x - t.x, u.y - t.y) <= stats.range &&
                  ((isCampaign && campaignChapter === 2 && t.team === "red") || clearRay(t.x, t.y, u.x, u.y, t.team)),
              )
              .sort((a, b) => {
                const escortPriority = isCampaign && campaignChapter === 2
                  ? (a.role === "scientist" ? -100 : 0) - (b.role === "scientist" ? -100 : 0)
                  : 0;
                return escortPriority || Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y);
              })
              .slice(0, targetCount);
          if (!targets.length) continue;
          for (const target of targets) {
            const len = Math.max(1, Math.hypot(target.x - t.x, target.y - t.y)),
              kind: Shot["kind"] =
                t.kind === "rockBunker"
                  ? "rock"
                  : t.kind === "canMissile"
                    ? "can"
                    : t.kind === "rootAmbusher"
                      ? "root"
                      : t.kind === "venomTree"
                        ? "venom"
                        : t.kind === "laserL1"
                          ? "laser"
                          : t.kind === "missileM2"
                            ? "missile"
                            : t.kind === "highVoltageTrap"
                              ? "shock"
                              : t.kind === "acidSporeSac"
                                ? "spore"
                                : "tether",
              speed =
                kind === "root"
                  ? 6
                  : kind === "missile"
                    ? 7
                    : kind === "laser"
                      ? 14
                      : kind === "shock"
                        ? 12
                        : kind === "spore"
                          ? 8
                          : kind === "tether"
                            ? 15
                            : 10,
              count = kind === "missile" ? 2 : 1;
            for (let i = 0; i < count; i++) {
              const spread = count === 2 ? (i ? 1 : -1) * 0.08 : 0,
                dx = (target.x - t.x) / len,
                dy = (target.y - t.y) / len;
              shots.push({
                x: t.x * S + S / 2 - dy * spread * S,
                y: t.y * S + S / 2 - 8 + dx * spread * S,
                vx: (dx - dy * spread) * speed,
                vy: (dy + dx * spread) * speed,
                team: t.team,
                damage: stats.damage / count,
                life: kind === "root" ? 650 : 1300,
                kind,
                critChance: stats.critChance,
                critMultiplier: stats.critMultiplier,
                splash: kind === "missile" ? 1.35 : def.control?.splash ?? 0,
                stun: def.control?.stunMs,
                pierce: kind === "laser",
                hitIds: [],
                ignoresTerrain: isCampaign && campaignChapter === 2 && t.team === "red",
                sourceInstallation: t,
              });
            }
          }
          t.cool = stats.cooldown;
          tone(kindTone(t.kind));
        }
      },
      updateShots = (dt: number) => {
        for (const s of shots) {
          const ox = s.x,
            oy = s.y;
          s.x += (s.vx * dt) / 16;
          s.y += (s.vy * dt) / 16;
          s.life -= dt;
          const tx = Math.floor(s.x / S),
            ty = Math.floor(s.y / S);
          if (
            tx < 0 ||
            ty < 0 ||
            tx >= COLS ||
            ty >= ROWS ||
            ((isSecretTunnel
              ? !openForTeam(tx, ty, s.team)
              : grid[ty][tx].type !== 0) &&
              s.kind !== "acid" &&
              !s.ignoresTerrain)
          ) {
            if (
              (s.kind === "blast" || s.splash) &&
              tx >= 0 &&
              ty >= 0 &&
              tx < COLS &&
              ty < ROWS
            )
              explode(s, tx, ty);
            s.life = 0;
            continue;
          }
          let hit = false;
          for (const u of units)
            if (
              u.alive &&
              u.networkVisible !== false &&
              u.team !== s.team &&
              !s.hitIds?.includes(u.id) &&
              canEngageAt(s.team, u.x, u.y)
            ) {
              const p = unitWorld(u),
                m = segmentMetric(p.x, p.y, ox, oy, s.x, s.y);
              if (m.distance < 13) {
                if (s.kind === "blast" || s.splash) explode(s, u.x, u.y);
                else {
                  hurt(
                    u,
                    s.damage,
                    s.team,
                    true,
                    s.critChance,
                    s.critMultiplier,
                    false,
                    s.source
                      ? { attacker: s.source.name, action: "투사체 공격", unit: s.source }
                      : s.sourceInstallation
                        ? {
                            attacker: buildDef(s.sourceInstallation.kind).name,
                            action: "설치물 공격",
                            installation: s.sourceInstallation,
                          }
                        : undefined,
                  );
                  if (s.kind === "receipt")
                    repairAt(
                      u.x,
                      u.y,
                      Math.max(4, Math.round(hero.maxHp * 0.045)),
                    );
                }
                if (s.stun)
                  u.act = Math.max(u.act, s.stun * (u.minionRole === "elite" ? 0.45 : 1));
                if (s.pierce) {
                  s.hitIds?.push(u.id);
                } else {
                  s.life = 0;
                  hit = true;
                  break;
                }
              }
            }
          if (hit) continue;
          for (const t of turrets)
            if (t.hp > 0 && t.team !== s.team && canEngageAt(s.team, t.x, t.y)) {
              const m = segmentMetric(
                t.x * S + S / 2,
                t.y * S + S / 2,
                ox,
                oy,
                s.x,
                s.y,
              );
              if (m.distance < 17) {
                if (s.kind === "blast" || s.splash) explode(s, t.x, t.y);
                else {
                  hurtTurret(
                    t,
                    s.damage,
                    s.team,
                    true,
                    s.critChance,
                    s.critMultiplier,
                  );
                  if (s.kind === "receipt")
                    repairAt(
                      t.x,
                      t.y,
                      Math.max(4, Math.round(hero.maxHp * 0.045)),
                    );
                }
                if (!s.pierce) s.life = 0;
                break;
              }
            }
          if (s.life > 0 && !s.hitBase) {
            const b = s.team === "blue" ? ENEMY : ALLY,
              m = segmentMetric(
                b.x * S + S / 2,
                b.y * S + S / 2,
                ox,
                oy,
                s.x,
                s.y,
              );
            if (m.distance < 24 && canEngageAt(s.team, b.x, b.y)) {
              damageBase(s.team, s.damage, s.source);
              s.hitBase = true;
              burst(b.x, b.y, s.team === "blue" ? "#ff705e" : "#65e4ef", 12);
              if (!s.pierce) s.life = 0;
            }
          }
        }
        for (let i = shots.length - 1; i >= 0; i--)
          if (shots[i].life <= 0) shots.splice(i, 1);
      };
    const updateSlashes = (dt: number) => {
      for (const s of slashes) {
        if (s.kind === "ultimate" && !s.resolved) {
          const slashDamage = s.damage ?? 125,
            startX = s.x * S + S / 2,
            startY = s.y * S + S / 2,
            from = ultimateTravel(s, s.life),
            to = ultimateTravel(s, Math.max(0, s.life - dt));
          if (to > from) {
            const ax = startX + s.dir.x * from,
              ay = startY + s.dir.y * from,
              bx = startX + s.dir.x * to,
              by = startY + s.dir.y * to;
            let nearest: {
              kind: "unit" | "turret" | "base";
              at: number;
              unit?: Unit;
              turret?: Turret;
            } | null = null;
            const consider = (candidate: typeof nearest) => {
              if (candidate && (!nearest || candidate.at < nearest.at))
                nearest = candidate;
            };
            for (const u of units)
              if (
                u.alive &&
                u.networkVisible !== false &&
                u.team === "red" &&
                !s.hitIds?.includes(u.id) &&
                canEngageAt("blue", u.x, u.y)
              ) {
                const p = unitWorld(u),
                  m = segmentMetric(p.x, p.y, ax, ay, bx, by);
                if (m.distance <= 26)
                  consider({ kind: "unit", at: m.t, unit: u });
              }
            for (const t of turrets)
              if (t.hp > 0 && t.team === "red" && canEngageAt("blue", t.x, t.y)) {
                const m = segmentMetric(
                  t.x * S + S / 2,
                  t.y * S + S / 2,
                  ax,
                  ay,
                  bx,
                  by,
                );
                if (m.distance <= 27)
                  consider({ kind: "turret", at: m.t, turret: t });
              }
            const bm = segmentMetric(
              ENEMY.x * S + S / 2,
              ENEMY.y * S + S / 2,
              ax,
              ay,
              bx,
              by,
            );
            if (enemyHp > 0 && bm.distance <= 29 && canEngageAt("blue", ENEMY.x, ENEMY.y))
              consider({ kind: "base", at: bm.t });
            if (nearest) {
              const chosen = nearest as {
                kind: "unit" | "turret" | "base";
                at: number;
                unit?: Unit;
                turret?: Turret;
              };
              if (chosen.kind === "unit" && chosen.unit) {
                hurt(
                  chosen.unit,
                  slashDamage,
                  "blue",
                  false,
                  0,
                  1,
                  false,
                  heroDamageSource("참격"),
                );
                burst(chosen.unit.x, chosen.unit.y, "#fff0a0", 34);
                s.hitIds?.push(chosen.unit.id);
                const delivery =
                  talents.has("slash-delivery") &&
                  chosen.unit.role === "minion" &&
                  s.hitIds?.length === 1;
                s.resolved = !delivery;
                setMessage(
                  delivery
                    ? "참격 배달 · 첫 진군대를 관통"
                    : `참격 적중 · ${Math.round(slashDamage)} 피해`,
                );
              } else if (chosen.kind === "turret" && chosen.turret) {
                s.resolved = true;
                hurtTurret(chosen.turret, slashDamage * 0.88, "blue", false);
                setMessage("참격 적중 · 포탑 파쇄");
              } else {
                s.resolved = true;
                damageBase("blue", slashDamage * 0.72, hero);
                setMessage("참격 적중 · 코어 타격");
              }
            }
          }
        }
        s.life -= dt;
      }
      for (let i = slashes.length - 1; i >= 0; i--)
        if (slashes[i].life <= 0) slashes.splice(i, 1);
    };
    const clampCamera = () => {
        cam.x = Math.max(0, Math.min(W - viewWidth, cam.x));
        cam.y = Math.max(0, Math.min(H - viewHeight, cam.y));
      },
      focusCameraAt = (wx: number, wy: number) => {
        cameraFree = true;
        cam.x = wx - viewWidth / 2;
        cam.y = wy - viewHeight / 2;
        clampCamera();
      },
      minimapPoint = (x: number, y: number) =>
        !minimapCollapsedRef.current &&
        x >= minimap.x &&
        x <= minimap.x + minimap.w &&
        y >= minimap.y &&
        y <= minimap.y + minimap.h,
      minimapFocus = (x: number, y: number) => {
        focusCameraAt(
          ((x - minimap.x) / minimap.w) * W,
          ((y - minimap.y) / minimap.h) * H,
        );
        setMessage(`미니맵 관측 위치 · Space로 ${playerDef.name} 복귀`);
      };
    const cancelRouteEdit = () => {
        routeEdit = null;
        if (routePointerGesture?.mode === "detail") routePointerGesture = null;
        routeDraftPoints = [];
        routeDraftCells = [];
        setRouteChoice("none");
        setRouteDraftCount(0);
      },
      cancelQuickRouteAim = () => {
        routeQuickAim = null;
        if (routePointerGesture?.mode === "quick") routePointerGesture = null;
        setQuickRouteChoice("none");
      },
      cursorWorld = () => ({
        x: cursorScreen.x + cam.x,
        y: cursorScreen.y + cam.y,
      }),
      cursorTile = () => {
        const w = cursorWorld();
        return {
          x: Math.max(1, Math.min(COLS - 2, Math.floor(w.x / S))),
          y: Math.max(1, Math.min(ROWS - 2, Math.floor(w.y / S))),
        };
      },
      updateCursor = (x: number, y: number) => {
        cursorScreen.x = Math.max(0, Math.min(viewWidth, x));
        cursorScreen.y = Math.max(0, Math.min(viewHeight, y));
      },
      basicAttackAtPointer = () => {
        if (
          ended ||
          !hero.alive ||
          hero.act > 0 ||
          hero.shot > 0 ||
          aimingSkill ||
          buildMode !== "none" ||
          fillMode ||
          routeEdit
        )
          return;
        const w = cursorWorld(),
          dir = unitVector(w.x - heroWorld.x, w.y - heroWorld.y),
          mode = kit.basic.mode,
          bonuses = talentBonuses(),
          attackDirections = Array.from({ length: bonuses.basicCount }, (_, index) =>
            rotateDirection(
              dir,
              (index - (bonuses.basicCount - 1) / 2) * bonuses.basicSpread,
            ),
          );
        moveTarget = null;
        attackTarget = null;
        hero.dir = dir;
        if (
          [
            "chemicalSpray",
            "acidSpit",
            "dustNeedle",
            "silkNeedle",
            "repairPulse",
            "stampLaser",
          ].includes(mode)
        ) {
          playHeroAnim("basic", 520);
          const kind: Shot["kind"] =
              mode === "chemicalSpray" || mode === "repairPulse"
                ? "spray"
                : mode === "silkNeedle"
                  ? "web"
                  : mode === "stampLaser"
                    ? "laser"
                    : mode === "dustNeedle"
                      ? "venom"
                      : "acid",
            opts: Partial<Pick<Shot, "splash" | "stun" | "pierce">> =
              mode === "acidSpit"
                ? { splash: 0.45 }
                : mode === "dustNeedle"
                  ? { stun: 280 }
                  : mode === "silkNeedle"
                    ? { stun: 420 }
                    : mode === "stampLaser"
                      ? { pierce: true }
                      : {};
          for (const shotDirection of attackDirections)
            skillShot(shotDirection, kind, hero.attack * bonuses.basicDamageMultiplier, {
              ...opts,
              pierce: opts.pierce || bonuses.basicPierce,
              stun: Math.max(opts.stun ?? 0, bonuses.basicStun),
            });
          if (mode === "repairPulse")
            healArea(2.2, Math.max(2, Math.round(hero.maxHp * 0.025)));
          hero.act = hero.attackInterval * 1000;
          signatureFx(mode, dir, 0.85, 420);
        } else {
          const bonus = hero.attack * (bonuses.basicDamageMultiplier - 1);
          melee(hero, attackDirections[0], bonus, mode, bonuses.basicStun);
          for (let index = 1; index < attackDirections.length; index++) {
            const extraDirection = attackDirections[index];
            meleeHits.push({
              attacker: hero,
              dir: extraDirection,
              bonus,
              delay: 210 + index * 75,
              variant: mode,
              stun: bonuses.basicStun,
            });
            slashes.push({
              ...heroFxPos(),
              dir: extraDirection,
              life: 360 + index * 55,
              maxLife: 360 + index * 55,
              kind: "signature",
              variant: mode,
              color: kit.color,
              radius: 1,
            });
          }
        }
        setMessage(`Ctrl + 클릭 · ${kit.basic.caption}`);
      },
      issuePointerOrder = () => {
        if (
          ended ||
          !hero.alive ||
          aimingSkill ||
          buildMode !== "none" ||
          fillMode ||
          routeEdit
        )
          return;
        const w = cursorWorld(),
          x = Math.max(1, Math.min(COLS - 2, Math.floor(w.x / S))),
          y = Math.max(1, Math.min(ROWS - 2, Math.floor(w.y / S))),
          unit = visible(x, y) ? occupied(x, y, hero) : undefined,
          turret = visible(x, y) ? turretAt(x, y) : undefined,
          clickedBase = baseAt(x, y) ?? baseTargetAtWorld(w.x, w.y),
          base =
            clickedBase &&
            visible(
              clickedBase === "red" ? ENEMY.x : ALLY.x,
              clickedBase === "red" ? ENEMY.y : ALLY.y,
            )
              ? clickedBase
              : null;
        if (unit?.team === "blue") {
          moveTarget = null;
          attackTarget = null;
          setMessage(`아군 ${unit.name} · 공격하지 않음`);
          return;
        }
        moveTarget = { x, y, wx: w.x, wy: w.y };
        if (unit && unit.team === "red") {
          attackTarget = { kind: "unit", id: unit.id, x, y };
          setMessage(`${unit.name} 추적 · 사거리에서 자동 공격`);
        } else if (turret && turret.team === "red") {
          attackTarget = { kind: "turret", x, y };
          setMessage(
            `적 ${buildDef(turret.kind).name} 추적 · 공격 사거리로 이동`,
          );
        } else if (base === "red" && isCampaign && campaignChapter === 2) {
          const approach = { x: ENEMY.x - 2, y: ENEMY.y };
          moveTarget = {
            x: approach.x,
            y: approach.y,
            wx: approach.x * S + S / 2,
            wy: approach.y * S + S / 2,
          };
          attackTarget = null;
          setMessage("평택 거점 입구로 이동 · 호송 목적지는 공격하지 않음");
        } else if (base === "red") {
          moveTarget = {
            x: ENEMY.x,
            y: ENEMY.y,
            wx: ENEMY.x * S + S / 2,
            wy: ENEMY.y * S + S / 2,
          };
          attackTarget = { kind: "base", x: ENEMY.x, y: ENEMY.y };
          setMessage(`적 ${FACTION_BASES[enemyFaction].name} 공격 명령 · 사거리까지 접근`);
        } else {
          attackTarget = null;
          setMessage(`목적지 ${x}, ${y} · 자동 이동/굴착`);
        }
      },
      attackCommandAtPointer = () => {
        if (isSecretTunnel && battlePhase === "prepare") {
          setMessage("준비 단계 · 공격은 잠겨 있다 · 굴착과 방어 준비에 집중");
          return;
        }
        const w = cursorWorld(),
          x = Math.max(1, Math.min(COLS - 2, Math.floor(w.x / S))),
          y = Math.max(1, Math.min(ROWS - 2, Math.floor(w.y / S))),
          unit = visible(x, y) ? occupied(x, y, hero) : undefined,
          turret = visible(x, y) ? turretAt(x, y) : undefined,
          clickedBase = baseAt(x, y) ?? baseTargetAtWorld(w.x, w.y),
          base =
            clickedBase &&
            visible(
              clickedBase === "red" ? ENEMY.x : ALLY.x,
              clickedBase === "red" ? ENEMY.y : ALLY.y,
            )
              ? clickedBase
              : null;
        if (
          (unit && unit.team === "red") ||
          (turret && turret.team === "red") ||
          base === "red"
        ) {
          issuePointerOrder();
          return;
        }
        basicAttackAtPointer();
      },
      beginSkillAim = (skill: 2 | 3) => {
        if (!hero.alive || (skill === 2 ? cd2 : cd4) > 0) return;
        if (isSecretTunnel && battlePhase === "prepare") {
          setMessage("준비 단계 · 공격 기술은 침공 개시 후 사용할 수 있다");
          return;
        }
        cancelRouteEdit();
        if (buildMode !== "none") selectBuildMode("none");
        fillMode = false;
        aimingSkill = skill;
        moveTarget = null;
        attackTarget = null;
        setSelected(skill);
        tone("coin");
        setMessage(
          `${skill === 2 ? playerDef.skills[1] : playerDef.skills[3]} 조준 중 · 놓으면 발동`,
        );
      },
      cancelSkillAim = () => {
        if (!aimingSkill) return;
        aimingSkill = 0;
        setSelected(0);
        setMessage("기술 조준 취소");
      },
      releaseSkillAim = (skill: 2 | 3) => {
        if (aimingSkill !== skill) return;
        const w = cursorWorld(),
          dx = w.x - heroWorld.x,
          dy = w.y - heroWorld.y;
        aimingSkill = 0;
        setSelected(0);
        if (skill === 2) thrustDash(dx, dy);
        else ultimateSlash(dx, dy);
      },
      processCommand = (cmd: string) => {
        if (cmd.startsWith("allocation:")) {
          const allocation = cmd.slice(11) as TunnelRouteAllocation;
          if (!["50:50", "75:25", "25:75"].includes(allocation)) return;
          tunnelAllocations.blue = allocation;
          setMessage(
            allocation === "50:50"
              ? "다음 웨이브부터 진군 배분 · A/B 균등 50:50"
              : allocation === "75:25"
                ? "다음 웨이브부터 진군 배분 · A 집중 75:25"
                : "다음 웨이브부터 진군 배분 · B 집중 25:75",
          );
          return;
        }
        if (cmd === "route:off") {
          cancelRouteEdit();
          cancelQuickRouteAim();
          setMessage("진군 노선 편집 종료");
          return;
        }
        if (cmd === "route:A" || cmd === "route:B") {
          beginRouteEdit(cmd.slice(6) as RouteId);
          return;
        }
        if (cmd === "routeQuick:A" || cmd === "routeQuick:B") {
          beginQuickRouteAim(cmd.slice(-1) as RouteId);
          return;
        }
        if (cmd === "routeApply") {
          applyRouteDraft();
          return;
        }
        if (cmd === "routeReset") {
          resetRouteDraft();
          return;
        }
        if (cmd === "routeCancel") {
          cancelRouteEdit();
          cancelQuickRouteAim();
          setMessage("경로 수정을 취소했다 · 기존 경로 유지");
          return;
        }
        if (cmd === "routeClear:A" || cmd === "routeClear:B") {
          clearMarchRoute(cmd.slice(-1) as RouteId);
          return;
        }
        if (!cmd.startsWith("cursor:") && !cmd.startsWith("camera:")) {
          cancelRouteEdit();
          cancelQuickRouteAim();
        }
        if (
          isSecretTunnel &&
          battlePhase === "prepare" &&
          (cmd === "skill1" || cmd === "aim2" || cmd === "skill2" || cmd === "aim3" || cmd === "skill3" || cmd.startsWith("tactical:"))
        ) {
          setMessage("준비 단계 · 공격과 전술지원은 침공 개시 후 사용할 수 있다");
          return;
        }
        if (cmd === "skill1") {
          whirlwind();
          setSelected(0);
        } else if (cmd === "skill4") blueDrillBurst();
        else if (cmd === "aim2" || cmd === "skill2") beginSkillAim(2);
        else if (cmd === "aim3" || cmd === "skill3") beginSkillAim(3);
        else if (cmd === "release2") releaseSkillAim(2);
        else if (cmd === "release3") releaseSkillAim(3);
        else if (cmd === "cancelAim") cancelSkillAim();
        else if (cmd.startsWith("talent:")) {
          const id = cmd.slice(7);
          const selectedTalent = heroTalentById(playerDef.id, id);
          if (
            !selectedTalent ||
            !pendingTalentTiersRef.current.includes(selectedTalent.level) ||
            [...talents].some(
              (chosenId) =>
                heroTalentById(playerDef.id, chosenId)?.level === selectedTalent.level,
            )
          ) {
            setMessage("선택할 수 없는 특성입니다");
            return;
          }
          talents.add(id);
          pendingTalentTiersRef.current = pendingTalentTiersRef.current.filter(
            (level) => level !== selectedTalent.level,
          );
          setPendingTalentTiers([...pendingTalentTiersRef.current]);
          setSelectedTalentIds([...talents]);
          openTalentTier(null);
          if (selectedTalent.effect.maxHpMultiplier) {
            const increase = hero.maxHp * (selectedTalent.effect.maxHpMultiplier - 1);
            hero.maxHp += increase;
            hero.hp = Math.min(hero.maxHp, hero.hp + increase);
          }
          hero.armor += selectedTalent.effect.armorBonus ?? 0;
          hero.moveSpeed *= selectedTalent.effect.moveSpeedMultiplier ?? 1;
          tone("build");
          burst(hero.x, hero.y, selectedTalent.accent, 28);
          setMessage(`특성 선택 · ${selectedTalent.name} · 전투 효과 적용`);
        } else if (cmd.startsWith("cursor:")) {
          const [, x, y] = cmd.split(":").map(Number);
          updateCursor(x, y);
        } else if (cmd === "camera:end") {
          minimapGrabAnchor = null;
        } else if (cmd.startsWith("camera:start:") || cmd.startsWith("camera:move:")) {
          const [, phase, rawX, rawY] = cmd.split(":"),
            pointer = { x: Number(rawX), y: Number(rawY) };
          if (phase === "start") {
            minimapGrabAnchor = minimapDragAnchor(
              pointer,
              {
                x: (cam.x + viewWidth / 2) / W,
                y: (cam.y + viewHeight / 2) / H,
              },
              {
                width: Math.min(1, viewWidth / W),
                height: Math.min(1, viewHeight / H),
              },
            );
            setMessage(`미니맵 관측 위치 · Space로 ${playerDef.name} 복귀`);
          }
          const target = minimapDragTarget(pointer, minimapGrabAnchor ?? { x: 0, y: 0 });
          focusCameraAt(target.x * W, target.y * H);
        } else if (cmd === "research:minion") {
          const research = nextMinionResearch(minionLevels.blue);
          if (!research) setMessage("진군대 연구 완료 · 최대 LV.5");
          else if (!minionResearchReady(research.level, wave)) setMessage(`진군대 LV.${research.level} 연구는 WAVE ${minionResearchUnlockWave(research.level)}부터 가능`);
          else if (!researchMinionTeam("blue")) setMessage(`진군대 LV.${research.level} 연구에 ${research.cost} 크레딧 필요`);
        } else if (cmd === "elite:reserve") {
          const activeElites = units.filter((unit) => unit.alive && unit.team === "blue" && unit.role === "minion" && unit.minionRole === "elite").length,
            state = eliteDeployments.blue,
            readyIn = eliteReadyInWaves(wave, state.lastSpawnWave);
          if (!reserveEliteTeam("blue"))
            setMessage(
              wave < ELITE_UNLOCK_WAVE
                ? `정예병은 WAVE ${ELITE_UNLOCK_WAVE}부터 예약 가능`
                : state.reserved
                  ? "정예병이 다음 진군대에 이미 예약됨"
                  : activeElites
                    ? "정예병이 이미 전선에 있음"
                    : readyIn
                      ? `정예병 재편성까지 ${readyIn} WAVE`
                      : `정예병 예약에 ${ELITE_RESERVATION_COST} 크레딧 필요`,
            );
        } else if (cmd === "tactical:area") {
          if (isCampaign) { setMessage("전술지원은 대전에서 사용할 수 있습니다"); return; }
          tacticalAim = tacticalAim === "area" ? null : "area";
          buildMode = "none";
          fillMode = false;
          aimingSkill = 0;
          setBuildChoice("none");
          setMessage(tacticalAim ? `${tacticalDefinition(playerDef.faction, "area").name} · 시야 안의 열린 지점 선택` : "지역 타격 조준 취소");
        } else if (["tactical:defense", "tactical:offense", "tactical:recovery", "tactical:reinforce"].includes(cmd)) {
          const role = cmd.slice(9) as TacticalRole, definition = tacticalDefinition(playerDef.faction, role);
          if (!activateTacticalSupport("blue", role)) {
            const remaining = Math.max(0, Math.ceil((tacticalStates.blue.cooldownUntil - performance.now()) / 1000));
            setMessage(remaining ? `전술지원 재사용 대기 ${remaining}초` : `${definition.name} 발동에 ${definition.cost} 크레딧 필요`);
          }
        } else if (cmd.startsWith("build:"))
          selectBuildMode(cmd.slice(6) as BuildMode);
        else if (cmd === "build") {
          if (buildMode !== "none") selectBuildMode("none");
          setRouteChoice("none");
          setQuickRouteChoice("none");
          setRouteDraftCount(0);
          setRouteMenuOpen(false);
          setSupplyMenuOpen(false);
          setBuildMenuOpen((open) => !open);
          setMessage("건설 메뉴 · B로 열기/닫기");
        }
        else if (cmd === "fill") toggleFillMode();
        else if (cmd === "survival") activateSurvival();
        else if (cmd === "item1") activateItem(0);
        else if (cmd === "item2") activateItem(1);
      };
    const pointerPosition = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect(),
          x = ((e.clientX - r.left) / r.width) * viewWidth,
          y = ((e.clientY - r.top) / r.height) * viewHeight;
        updateCursor(x, y);
        return { x, y };
      },
      keydown = (e: KeyboardEvent) => {
        startAmbient();
        if (e.code === "Escape") {
          if (
            document.fullscreenElement ||
            performance.now() < fullscreenExitGuardUntilRef.current
          )
            return;
          e.preventDefault();
          if (talentTierOpenRef.current) {
            openTalentTier(null);
            return;
          }
          if (aimingSkill) {
            cancelSkillAim();
            return;
          }
          if (fillMode) {
            fillMode = false;
            setMessage("땅 메우기 지정 종료");
            return;
          }
          if (tacticalAim) {
            tacticalAim = null;
            setMessage("지역 타격 조준 취소");
            return;
          }
          if (buildMode !== "none") {
            selectBuildMode("none");
            return;
          }
          if (activeMatchConfig?.kind === "online") {
            onlineMenuOpenRef.current = !onlineMenuOpenRef.current;
            keys.clear();
            mobileMove.current = null;
            if (mobileOnlineMoveTimerRef.current !== null) {
              window.clearInterval(mobileOnlineMoveTimerRef.current);
              mobileOnlineMoveTimerRef.current = null;
            }
            pointerHeld = false;
            cameraDrag = null;
            setPaused(onlineMenuOpenRef.current);
            setMessage(onlineMenuOpenRef.current ? "온라인 전투 메뉴 · 경기는 계속 진행 중" : "온라인 전투 복귀");
            return;
          }
          pausedRef.current = !pausedRef.current;
          keys.clear();
          mobileMove.current = null;
          pointerHeld = false;
          cameraDrag = null;
          setPaused(pausedRef.current);
          return;
        }
        if (pausedRef.current || onlineMenuOpenRef.current) return;
        if (e.ctrlKey && (e.code === "ShiftLeft" || e.code === "ShiftRight")) {
          e.preventDefault();
          return;
        }
        if (e.code === "Space") {
          e.preventDefault();
          cameraFree = false;
          setMessage(`${playerDef.name} 카메라 추적 복귀`);
          return;
        }
        if (
          e.repeat &&
          [
            "Digit1",
            "Digit2",
            "Digit3",
            "Digit4",
            "ShiftLeft",
            "ShiftRight",
            "KeyB",
            "KeyE",
            "KeyQ",
            "KeyR",
          ].includes(e.code)
        )
          return;
        keys.add(e.code);
        if (e.code === "Digit1") {
          processCommand("skill1");
          publishOnlineInput({ type: "skill", slot: 1 });
        }
        if (e.code === "Digit2") beginSkillAim(2);
        if (e.code === "Digit3") beginSkillAim(3);
        if (e.code === "Digit4") {
          processCommand("skill4");
        }
        const moveDirection =
          e.code === "KeyW" || e.code === "ArrowUp" ? { x: 0, y: -1 } :
          e.code === "KeyS" || e.code === "ArrowDown" ? { x: 0, y: 1 } :
          e.code === "KeyA" || e.code === "ArrowLeft" ? { x: -1, y: 0 } :
          e.code === "KeyD" || e.code === "ArrowRight" ? { x: 1, y: 0 } : null;
        if (moveDirection && activeMatchConfig?.kind === "online") {
          const now = performance.now();
          if (!e.repeat || now - lastOnlineMoveCommandAtRef.current >= 100) {
            lastOnlineMoveCommandAtRef.current = now;
            publishOnlineInput({ type: "move", x: hero.x + moveDirection.x * 2, y: hero.y + moveDirection.y * 2 });
          }
        }
        if (e.code === "KeyB") {
          e.preventDefault();
          processCommand("build");
        }
        if (e.code === "KeyE") processCommand("fill");
        if (e.code === "ShiftLeft" || e.code === "ShiftRight")
          processCommand("survival");
        if (e.code === "KeyQ") processCommand("item1");
        if (e.code === "KeyR") processCommand("item2");
      },
      keyup = (e: KeyboardEvent) => {
        keys.delete(e.code);
        if (e.code === "Digit2") {
          releaseSkillAim(2);
          publishOnlineInput({ type: "skill", slot: 2 });
        }
        if (e.code === "Digit3") {
          releaseSkillAim(3);
          publishOnlineInput({ type: "skill", slot: 4 });
        }
      },
      pointerdown = (e: PointerEvent) => {
        if (pausedRef.current || onlineMenuOpenRef.current) return;
        startAmbient();
        const p = pointerPosition(e);
        if (e.button === 2) {
          e.preventDefault();
          pointerHeld = false;
          if (aimingSkill) cancelSkillAim();
          if (fillMode) {
            fillMode = false;
            setMessage("땅 메우기 지정 종료");
            return;
          }
          if (buildMode !== "none") {
            selectBuildMode("none");
            return;
          }
          cameraDrag = {
            pointerId: e.pointerId,
            x: p.x,
            y: p.y,
            camX: cam.x,
            camY: cam.y,
            moved: false,
          };
          canvas.setPointerCapture(e.pointerId);
          canvas.style.cursor = "grabbing";
          return;
        }
        if (e.button !== 0) return;
        if (minimapPoint(p.x, p.y)) {
          e.preventDefault();
          pointerHeld = false;
          minimapFocus(p.x, p.y);
          return;
        }
        if (routeQuickAim) {
          e.preventDefault();
          pointerHeld = false;
          const id = routeQuickAim,
            tile = cursorTile();
          if (e.pointerType !== "mouse") {
            routePointerGesture = {
              pointerId: e.pointerId,
              routeId: id,
              mode: "quick",
              x: p.x,
              y: p.y,
              camX: cam.x,
              camY: cam.y,
              tile,
              moved: false,
            };
            canvas.setPointerCapture(e.pointerId);
            return;
          }
          setRouteTarget(id, tile.x, tile.y);
          publishOnlineInput({ type: "route", route: id, x: tile.x, y: tile.y });
          cancelQuickRouteAim();
          return;
        }
        if (routeEdit) {
          e.preventDefault();
          pointerHeld = false;
          const tile = cursorTile();
          if (e.pointerType !== "mouse") {
            routePointerGesture = {
              pointerId: e.pointerId,
              routeId: routeEdit,
              mode: "detail",
              x: p.x,
              y: p.y,
              camX: cam.x,
              camY: cam.y,
              tile,
              moved: false,
            };
            canvas.setPointerCapture(e.pointerId);
            return;
          }
          addRoutePoint(routeEdit, tile.x, tile.y);
          return;
        }
        if (tacticalAim === "area") {
          e.preventDefault();
          pointerHeld = false;
          const tile = cursorTile(), definition = tacticalDefinition(playerDef.faction, "area"),
            inRange = Math.hypot(tile.x - hero.x, tile.y - hero.y) <= 12;
          if (!seen[tile.y]?.[tile.x] || !visible(tile.x, tile.y) || !open(tile.x, tile.y) || !inRange) {
            setMessage("영웅 12칸 안 · 현재 시야의 열린 땅굴만 지정 가능");
            return;
          }
          if (activateTacticalSupport("blue", "area", tile)) {
            publishOnlineInput({ type: "tactical", tacticalRole: "area", x: tile.x, y: tile.y });
            tacticalAim = null;
          } else {
            const remaining = Math.max(0, Math.ceil((tacticalStates.blue.cooldownUntil - performance.now()) / 1000));
            setMessage(remaining ? `전술지원 재사용 대기 ${remaining}초` : `${definition.name} 발동에 ${definition.cost} 크레딧 필요`);
          }
          return;
        }
        if (fillMode) {
          e.preventDefault();
          pointerHeld = false;
          const tile = cursorTile();
          placeFillAt(tile.x, tile.y);
          return;
        }
        if (buildMode !== "none") {
          e.preventDefault();
          pointerHeld = false;
          const tile = cursorTile();
          if (buildMode === "demolish") startDemolitionAt(tile.x, tile.y);
          else if (buildMode === "upgrade") startUpgradeAt(tile.x, tile.y);
          else placeBuildableAt(tile.x, tile.y);
          return;
        }
        if (!aimingSkill) {
          if (e.ctrlKey) {
            e.preventDefault();
            pointerHeld = false;
            attackCommandAtPointer();
            publishOnlineInput({ type: "attack", x: cursorTile().x, y: cursorTile().y });
          } else {
            pointerHeld = true;
            issuePointerOrder();
            publishOnlineInput({ type: "move", x: cursorTile().x, y: cursorTile().y });
          }
        }
      },
      pointermove = (e: PointerEvent) => {
        const p = pointerPosition(e);
        if (routePointerGesture && routePointerGesture.pointerId === e.pointerId) {
          const mx = p.x - routePointerGesture.x,
            my = p.y - routePointerGesture.y;
          routePointerGesture.moved ||= Math.hypot(mx, my) > 8;
          if (routePointerGesture.moved) {
            cameraFree = true;
            cam.x = routePointerGesture.camX - mx;
            cam.y = routePointerGesture.camY - my;
            clampCamera();
          }
          return;
        }
        if (cameraDrag && cameraDrag.pointerId === e.pointerId) {
          const mx = p.x - cameraDrag.x,
            my = p.y - cameraDrag.y;
          cameraDrag.moved ||= Math.hypot(mx, my) > 2;
          cameraFree = true;
          cam.x = cameraDrag.camX - mx;
          cam.y = cameraDrag.camY - my;
          clampCamera();
          return;
        }
        if (
          pointerHeld &&
          !aimingSkill &&
          !tacticalAim &&
          buildMode === "none" &&
          !fillMode &&
          !routeEdit
        )
          issuePointerOrder();
      },
      pointerup = (e: PointerEvent) => {
        pointerHeld = false;
        if (routePointerGesture && routePointerGesture.pointerId === e.pointerId) {
          const gesture = routePointerGesture;
          routePointerGesture = null;
          if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          if (e.type !== "pointercancel" && !gesture.moved) {
            if (gesture.mode === "detail")
              addRoutePoint(gesture.routeId, gesture.tile.x, gesture.tile.y);
            else {
              setRouteTarget(gesture.routeId, gesture.tile.x, gesture.tile.y);
              publishOnlineInput({
                type: "route",
                route: gesture.routeId,
                x: gesture.tile.x,
                y: gesture.tile.y,
              });
              cancelQuickRouteAim();
            }
          } else if (gesture.moved)
            setMessage(`자유 카메라 · ${gesture.routeId} 경로 지정 계속`);
          return;
        }
        if (cameraDrag && cameraDrag.pointerId === e.pointerId) {
          const moved = cameraDrag.moved;
          cameraDrag = null;
          if (canvas.hasPointerCapture(e.pointerId))
            canvas.releasePointerCapture(e.pointerId);
          canvas.style.cursor = "crosshair";
          if (moved)
            setMessage(
              routeEdit
                ? `자유 카메라 · ${routeEdit} 상세 경로 지정 계속`
                : routeQuickAim
                  ? `자유 카메라 · ${routeQuickAim} 빠른 목적지 지정 계속`
                  : `자유 카메라 · Space로 ${playerDef.name} 복귀`,
            );
        }
      },
      contextmenu = (e: MouseEvent) => {
        e.preventDefault();
      };
    const update = (dt: number, now: number) => {
      const reservationFrame = Math.floor(now / 34);
      if (reservationFrame !== lastMarchReservationFrame) {
        marchReservations.clear();
        combatSlotReservations.clear();
        lastMarchReservationFrame = reservationFrame;
      }
      if (!isCampaign) {
        // Restore the authoritative phase/tunnels before any local deadline or
        // queued command can run after an online host reconnects.
        syncOnlineBattleState(dt);
        processOnlineBattleCommands();
      }
      if (isSecretTunnel) {
        battlePhaseTimeLeft = activeMatchConfig?.kind === "online" && battlePhaseEndsAt > 0
          ? Math.max(0, battlePhaseEndsAt - Date.now())
          : Math.max(0, battlePhaseTimeLeft - dt);
        const authoritativeClock =
          activeMatchConfig?.kind !== "online" ||
          !onlineRoom ||
          !onlineIdentity ||
          onlineRoom.hostId === onlineIdentity.playerId;
        if (battlePhase === "prepare") {
          if (!secretBlueConnected && battlePhaseTimeLeft <= 15_000 && !secretWarning15Shown) {
            secretWarning15Shown = true;
            tone("warning");
            setMessage("15초 · 유효 전선 미연결 · 종료 시 고립 패배");
          }
          if (!secretBlueConnected && battlePhaseTimeLeft <= 5_000 && !secretWarning5Shown) {
            secretWarning5Shown = true;
            tone("warning");
            setMessage("5초 · 적 거점 또는 상대 연결 터널까지 반드시 뚫어라");
          }
          if (authoritativeClock && battlePhaseTimeLeft <= 0) enterSecretTunnelAssault();
        } else if (
          authoritativeClock &&
          battlePhase === "assault" &&
          battlePhaseTimeLeft <= 0
        ) {
          const resolution = resolveSecretTunnelTimeout({
            blue: { coreHp: allyHp / 600, shieldHp: allyShield / 180 },
            red: { coreHp: enemyHp / 600, shieldHp: enemyShield / 180 },
          });
          finishSecretTunnelBattle(
            resolution.winner,
            resolution.reason === "core-hp"
              ? "침공 종료 · 남은 코어 비율 판정"
              : resolution.reason === "shield-hp"
                ? "침공 종료 · 코어 동률, 방어막 비율 판정"
                : "침공 종료 · 코어와 방어막 동률 · 무승부",
          );
        }
        if (ended) return;
      }
      cd1 -= dt;
      cd2 -= dt;
      cd3 -= dt;
      cd4 -= dt;
      fillCd -= dt;
      survivalCd -= dt;
      coreRegenFxClock -= dt;
      let playerCoreRegenThisFrame = false;
      for (const fighter of units) {
        if (!fighter.alive || fighter.role !== "hero" || fighter.hp >= fighter.maxHp) continue;
        const ownCore = fighter.team === "blue" ? ALLY : ENEMY,
          amount = coreRegenAmount(
            fighter.maxHp,
            dt,
            Math.hypot(fighter.x - ownCore.x, fighter.y - ownCore.y),
            now - (fighter.lastDamagedAt ?? 0),
          );
        if (amount <= 0) continue;
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + amount);
        if (fighter === hero) {
          playerCoreRegenThisFrame = true;
          if (coreRegenFxClock <= 0) {
            const position = heroFxPos();
            spawnField("repair", position.x, position.y, 1.2, 780, 0, "#75f0a0");
            coreRegenFxClock = 900;
          }
        }
      }
      if (playerCoreRegenThisFrame && !heroCoreRegenActive)
        setMessage("거점 안전구역 · 비전투 체력 재정비 시작");
      heroCoreRegenActive = playerCoreRegenThisFrame;
      if (jumpVisual && now >= jumpVisual.start + jumpVisual.duration)
        jumpVisual = null;
      enemyBuildClock -= dt * computerBalance.enemyConstructionRate;
      spawnClock -= dt;
      steamDamageClock -= dt;
      while (commands.current.length) processCommand(commands.current.shift()!);
      updateBuildWork(dt);
      runEnemyConstruction();
      if (!isCampaign && (!isSecretTunnel || battlePhase === "assault") && spawnClock <= 0) {
        wave++;
        const guaranteedLevel = guaranteedMinionLevelForWave(wave);
        for (const team of ["blue", "red"] as Team[])
          if (guaranteedLevel > minionLevels[team]) applyTeamMinionLevel(team, guaranteedLevel);
        const playerBaseFormation: MinionRole[] = [
          "escort",
          "breaker",
          "breaker",
          "shooter",
        ],
          ownCoreDanger = units.some(
            (unit) => unit.alive && unit.team === "blue" && Math.hypot(unit.x - ENEMY.x, unit.y - ENEMY.y) <= 9,
          ),
          enemyBaseFormation = activeMatchConfig?.kind === "computer"
            ? computerWaveFormation({
                coreDiscovered: teamKnowsEnemyCore("red"),
                ownCoreDanger,
                wave,
              })
            : playerBaseFormation,
          playerFormation = withReservedElite(playerBaseFormation, eliteDeployments.blue.reserved),
          enemyFormation = withReservedElite(enemyBaseFormation, eliteDeployments.red.reserved);
        for (const team of ["blue", "red"] as Team[]) {
          const formation = team === "red" ? enemyFormation : playerFormation;
          if (formation.includes("elite")) {
            eliteDeployments[team].reserved = false;
            eliteDeployments[team].lastSpawnWave = wave;
          }
          formation.forEach((role, index) =>
            spawnQueue.push({ team, role, index, delay: index * 600 }),
          );
        }
        spawnClock = 14000;
        setMessage(
          `제 ${wave} 진군대 출전 · 아군 LV.${minionLevels.blue} / 적군 LV.${minionLevels.red}`,
        );
      }
      if (isCampaign && campaignChapter === 4) {
        const discoveredStage = hero.x >= 39 ? 3 : hero.x >= 27 ? 2 : hero.x >= 14 ? 1 : 0;
        if (discoveredStage > campaignPhase) {
          campaignPhase = discoveredStage;
          for (const unit of units)
            if (campaignStageIsActive(unit.campaignZone, campaignPhase)) unit.campaignActivated = true;
          for (const turret of turrets)
            if (campaignStageIsActive(turret.campaignZone, campaignPhase)) turret.campaignActivated = true;
          setMessage(`군체 전투실 ${campaignPhase} 활성화 · 매복 신호 포착`);
          tone("warning");
        }
      }
      if (isCampaign && campaignChapter === 1) {
        const livePhaseOne = units.filter((u) =>
            u.alive && u.team === "red" && u.role === "minion" && u.campaignWaveId === 1,
          ).length,
          queuedPhaseOne = spawnQueue.some((order) => order.team === "red" && order.campaignWaveId === 1);
        if (!campaign1VentOpen && campaignIntroClock >= CAMPAIGN1_SCOUT_EXIT_MS + CAMPAIGN1_VENT_DELAY_MS) {
          campaign1VentOpen = true;
          for (let y = CAMPAIGN1_VENT.y - 1; y <= CAMPAIGN1_VENT.y + 1; y++)
            for (let x = CAMPAIGN1_VENT.x - 1; x <= CAMPAIGN1_VENT.x + 1; x++)
              if (grid[y]?.[x]) grid[y][x] = { type: 0, hp: 0, max: 0 };
          setMessage("정찰충 퇴장 5초 · 전방 환풍구 개방");
          tone("warning");
        }
        if (!campaignWaveQueued && campaign1VentOpen) queueCampaignWave(1);
        else if (campaignPhase === 1 && !queuedPhaseOne && livePhaseOne === 0) {
          if (campaignWaveBreak < 0) {
            campaignWaveBreak = 3000;
            setMessage("1차 방어 성공 · 3초 후 강화 군체 접근");
            tone("warning");
          } else {
            campaignWaveBreak -= dt;
            if (campaignWaveBreak <= 0) queueCampaignWave(2);
          }
        }
        const remainingSecondWave = units.filter((u) => u.alive && u.team === "red" && u.role === "minion").length +
          spawnQueue.filter((order) => order.team === "red").length;
        if (campaign1BossShouldEnter(campaignPhase, Boolean(campaign1CheolgakReserve), remainingSecondWave) && campaign1CheolgakReserve) {
          const waveFront = units
              .filter((unit) => unit.alive && unit.team === "red" && unit.role === "minion" && unit.campaignWaveId === 2)
              .sort((a, b) => a.x - b.x)[0],
            anchor = waveFront ?? CAMPAIGN1_VENT,
            entry = [
              { x: anchor.x + 1, y: anchor.y }, { x: anchor.x + 1, y: anchor.y + 1 },
              { x: anchor.x + 1, y: anchor.y - 1 }, { x: anchor.x + 2, y: anchor.y },
              { x: anchor.x, y: anchor.y + 1 }, { x: anchor.x, y: anchor.y - 1 },
            ].find((cell) => open(cell.x, cell.y) && !occupied(cell.x, cell.y) && !turretAt(cell.x, cell.y) && !baseAt(cell.x, cell.y));
          if (entry) {
            campaign1CheolgakReserve.x = entry.x;
            campaign1CheolgakReserve.y = entry.y;
          }
          campaign1CheolgakReserve.act = 180;
          units.push(campaign1CheolgakReserve);
          campaign1CheolgakReserve = null;
          setMessage("2차 침입 후반 · 철각이 전선에 난입했다");
          tone("warning");
        }
      }
      for (let i = spawnQueue.length - 1; i >= 0; i--) {
        const order = spawnQueue[i];
        if (isSecretTunnel && battlePhase === "prepare") continue;
        order.delay -= dt;
        const stageReady = isCampaign && (campaignChapter === 4 || campaignChapter === 5)
            ? true
            : campaignStageIsActive(
              order.campaignZone,
              campaignChapter === 4 ? campaignPhase : campaign5GatePhase,
            ),
          ready = order.delay <= 0 && stageReady,
          spawned = ready && spawnMinion(
            order.team,
            order.index,
            order.role,
            order.campaignThreat,
            order.campaignPower,
            order.campaignName,
            order.campaignWaveId,
            order.campaignEscort,
            order.campaignFollower,
            order.campaignZone,
            order.emergencyReinforcement,
          ),
          preserveUntilSpawned = order.role === "elite" || Boolean(order.emergencyReinforcement) || (
            isCampaign && order.team === "red" &&
            (campaignChapter === 1 || campaignChapter === 4 || campaignChapter === 5)
          );
        if (ready && shouldRemoveSpawnOrder(spawned, order.delay, preserveUntilSpawned))
          spawnQueue.splice(i, 1);
      }
      for (const u of units) {
        u.act -= dt;
        u.shot -= dt;
        if (!u.alive) {
          u.respawn -= dt;
          if (u.role === "hero" && u.respawn <= 0 && !isCampaign) {
            const b = u.team === "blue" ? ALLY : ENEMY,
              opposingCore = u.team === "blue" ? ENEMY : ALLY,
              rear = cardinal(b.x - opposingCore.x, b.y - opposingCore.y),
              side = { x: -rear.y, y: rear.x },
              respawnCandidates = isSecretTunnel
                ? [
                    { x: b.x + rear.x + side.x, y: b.y + rear.y + side.y },
                    { x: b.x + rear.x - side.x, y: b.y + rear.y - side.y },
                    { x: b.x + side.x * 2, y: b.y + side.y * 2 },
                    { x: b.x - side.x * 2, y: b.y - side.y * 2 },
                    { x: b.x + rear.x * 2, y: b.y + rear.y * 2 },
                    { x: b.x - rear.x + side.x, y: b.y - rear.y + side.y },
                    { x: b.x - rear.x - side.x, y: b.y - rear.y - side.y },
                  ]
                : [{ x: b.x + (u.team === "blue" ? 1 : -1), y: b.y + 1 }],
              respawnCell = pickTeamSpawnCell(u.team, respawnCandidates, u);
            if (!respawnCell) continue;
            u.x = respawnCell.x;
            u.y = respawnCell.y;
            u.hp = u.maxHp;
            u.alive = true;
            if (u === hero) {
              heroWorld.x = u.x * S + S / 2;
              heroWorld.y = u.y * S + S / 2;
              u.act = 650;
              playHeroAnim("revive", 650);
            }
          }
        }
      }
      for (const mine of [...groundMines]) {
        if (isSecretTunnel && battlePhase === "prepare") {
          mine.armedAt += dt;
          mine.detonateAt += dt;
          continue;
        }
        const steppedOn = now >= mine.armedAt && units.some(
          (unit) =>
            unit.alive &&
            unit.team !== mine.team &&
            Math.hypot(unit.x - mine.x, unit.y - mine.y) <= 0.72,
        );
        if (steppedOn || now >= mine.detonateAt)
          detonateGroundMine(mine, steppedOn);
      }
      const steamPhase = now % 5200;
      if (
        !isCampaign &&
        (!isSecretTunnel || battlePhase === "assault") &&
        selectedBattleMap.hazard === "steam" &&
        steamPhase >= 2400 &&
        steamPhase < 3900 &&
        steamDamageClock <= 0
      ) {
        const exposed = units.filter(
          (unit) => unit.alive && grid[unit.y]?.[unit.x]?.hazard === "steam",
        );
        for (const unit of exposed)
          hurt(unit, 22, unit.team, false, 0, 1, true);
        if (exposed.includes(hero)) setMessage("증기 분출! 환기구에서 즉시 이탈하라");
        steamDamageClock = 700;
      }
      const m = mobileMove.current,
        dx =
          m?.x ??
          (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
        dy =
          m?.y ??
          (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
            (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
      if (hero.alive && hero.act <= 0) {
        if (dx || dy) {
          moveTarget = null;
          attackTarget = null;
          moveHeroStep(dx, dy, dt);
        } else if (moveTarget && !aimingSkill) {
          let goal = { x: moveTarget.x, y: moveTarget.y },
            targetValid = true;
          if (attackTarget?.kind === "unit") {
            const target = units.find(
              (u) => u.id === attackTarget!.id && u.alive && u.team === "red",
            );
            if (target) {
              goal = { x: target.x, y: target.y };
              attackTarget.x = target.x;
              attackTarget.y = target.y;
            } else targetValid = false;
          } else if (attackTarget?.kind === "turret")
            targetValid = !!turretAt(goal.x, goal.y)?.hp;
          else if (attackTarget?.kind === "base") targetValid = enemyHp > 0;
          if (!targetValid) {
            moveTarget = null;
            attackTarget = null;
          } else if (attackTarget) {
            const targetWorld = {
                x: goal.x * S + S / 2,
                y: goal.y * S + S / 2,
              },
              vx = targetWorld.x - heroWorld.x,
              vy = targetWorld.y - heroWorld.y,
              distance = Math.hypot(vx, vy),
              reliableRange = Math.max(1.5, playerDef.stats.range) * S * 0.92;
            if (distance <= reliableRange)
              melee(
                hero,
                { x: vx, y: vy },
                0,
                attackTarget.kind === "base" ? "coreSiege" : undefined,
              );
            else {
              const step = nextHeroPath(goal, true);
              if (step) moveHeroStep(step.x, step.y, dt);
              // 대각선 인접 칸에서 멈춰 허공을 휘두르지 않고 실제 타격 거리까지 붙는다.
              else moveHeroStep(vx, vy, dt);
            }
          }
          else if (!attackTarget && hero.x === goal.x && hero.y === goal.y) {
            if (settleHeroAtPointer(moveTarget, dt)) moveTarget = null;
          } else {
            const step = nextHeroPath(goal, !!attackTarget);
            if (step) moveHeroStep(step.x, step.y, dt);
            else if (!attackTarget) {
              // 동적 유닛이나 새로 드러난 벽 때문에 한 프레임 길이 막혀도 굴착 명령을 보존한다.
              const blockedForGood = DIRS.every((direction) => {
                const tile = grid[hero.y + direction.y]?.[hero.x + direction.x];
                return !tile || tile.type === 4;
              });
              if (blockedForGood) {
                moveTarget = null;
                setMessage("파괴할 수 없는 암반으로 경로가 완전히 막혔다");
              }
            }
          }
        }
      }
      if (isCampaign) {
        campaignIntroClock += dt;
        if (!ended && campaignTimeLeft > 0) campaignTimeLeft = Math.max(0, campaignTimeLeft - dt);
        const lines = campaignChapter === 1
          ? ["저게 머지?", "절대 서울 안으로 들여보내서는 안 돼!"]
          : campaignChapter === 2
            ? ["박사님들은 예정된 협곡로로 이동하세요!", "제가 뒤를 막겠습니다. 평택까지 멈추지 마세요!"]
            : campaignChapter === 3
              ? ["김씨 저들을 무력화하고 우리가 거대곤충 거점을 처들어간다,", ""]
              : campaignChapter === 4
                ? ["김씨, 군체 코어를 찾는다.", "시간 없다. 길을 열어."]
                : ["천안으로 가는 길이 완전히 막혔어.", "내가 새 길을 뚫는다. 따라와!"];
        campaignSpeech = campaignChapter === 1
          ? campaignIntroClock < 3000 ? "" : campaignIntroClock < 5200 ? lines[0] : campaignIntroClock < 8500 ? lines[1] : ""
          : campaignIntroClock < 2300 ? lines[0] : campaignIntroClock < 5900 ? lines[1] : "";
      }
      if (isCampaign && campaignChapter === 1) {
        const scout = units.find((unit) => unit.campaignScout && unit.alive);
        if (scout) {
          if (campaignIntroClock < 1400) {
            scout.dir = { x: -1, y: 0 };
            scout.minionVisual = "idle";
          } else if (campaignIntroClock < CAMPAIGN1_SCOUT_EXIT_MS) {
            if (scout.act <= 0) {
              const nx = scout.x + 1;
              scout.dir = { x: 1, y: 0 };
              if (openForTeam(nx, scout.y, scout.team) && !occupied(nx, scout.y, scout))
                commitGridMove(scout, nx, scout.y, unitMovementDuration(320));
              scout.minionVisual = "move";
              scout.minionVisualUntil = performance.now() + unitMovementDuration(280);
              scout.act = unitMovementDuration(260);
            }
          } else {
            scout.alive = false;
            scout.respawn = 0;
          }
        }
      }
      if (isCampaign && campaignChapter === 2)
        for (const scientist of units.filter((u) => u.role === "scientist" && u.alive)) {
          if (scientist.act > 0) continue;
          let routeIndex = Math.min(scientist.escortPointIndex ?? 0, campaign2EscortRoute.length - 1),
            goal = campaign2EscortRoute[routeIndex];
          if (Math.abs(scientist.x - goal.x) + Math.abs(scientist.y - goal.y) <= 1 && routeIndex < campaign2EscortRoute.length - 1) {
            routeIndex++;
            scientist.escortPointIndex = routeIndex;
            goal = campaign2EscortRoute[routeIndex];
          }
          const step = nextPath(scientist, goal);
          if (step) {
            const nx = scientist.x + step.x,
              ny = scientist.y + step.y;
            if (!occupied(nx, ny, scientist) && !turretAt(nx, ny) && !baseAt(nx, ny)) {
              commitGridMove(scientist, nx, ny, unitMovementDuration(1000 / scientist.moveSpeed * 0.96));
              scientist.dir = step;
            }
          }
          scientist.act = unitMovementDuration(1000 / scientist.moveSpeed);
        }
      if (!isCampaign) {
        for (const aiHero of battleAiHeroes) stepBattleHero(aiHero);
      }
      if (isCampaign && !(campaignChapter === 3 && campaignIntroClock < 5900))
        for (const fighter of units.filter((unit) => unit.campaignAi)) {
          if (campaignChapter === 2 && fighter.campaignGuard === "pyeongtaek" && !fighter.campaignActivated) {
            const doctorsClose = units.some(
              (unit) => unit.role === "scientist" && unit.alive && Math.hypot(unit.x - fighter.x, unit.y - fighter.y) <= 6,
            );
            if (!doctorsClose) continue;
            fighter.campaignActivated = true;
            fighter.act = 450;
            setMessage("평택 거점 앞 매복 발각 · 철각이 박사 행렬을 덮친다");
            tone("warning");
          }
          if (fighter.campaignActivated === false) continue;
          if (campaignChapter === 1 && fighter.team === "red" && campaignPhase === 0) continue;
          stepCampaignHero(fighter);
        }
      for (const u of units) if (u.role === "minion" && !u.campaignScout) stepMinion(u);
      stepTurrets(dt);
      updateBattleHeroImpacts(dt);
      updateMeleeHits(dt);
      updateShots(dt);
      updateSlashes(dt);
      updateFields(dt);
      updateTacticalSupport();
      markVision();
      for (const p of dust) p.life -= dt;
      for (let i = dust.length - 1; i >= 0; i--)
        if (dust[i].life <= 0) dust.splice(i, 1);
      for (const popup of damagePopups) popup.life -= dt;
      for (let i = damagePopups.length - 1; i >= 0; i--)
        if (damagePopups[i].life <= 0) damagePopups.splice(i, 1);
      for (let i = units.length - 1; i >= 0; i--)
        if (
          units[i].role === "minion" &&
          !units[i].alive &&
          units[i].respawn <= 0
        )
          units.splice(i, 1);
      const campaign1QueuedEnemies = spawnQueue.filter((order) => order.team === "red").length,
        campaign1AliveEnemies = units.filter((unit) => unit.alive && unit.team === "red" && !unit.campaignScout).length;
      if (isCampaign && campaignChapter === 1 && !ended && campaign1VictoryReady(
        campaignPhase,
        campaign1CheolgakReserve === null,
        campaign1QueuedEnemies,
        campaign1AliveEnemies,
      )) {
        ended = true;
        setOutcome("win");
        setMessage("2차 침입 및 철각 격퇴 · 제1장 방어 성공");
      }
      if (isCampaign && campaignChapter === 2 && !ended) {
        const scientists = units.filter((unit) => unit.role === "scientist"),
          aliveScientists = scientists.filter((unit) => unit.alive),
          arrivedScientists = aliveScientists.filter((unit) => unit.x >= 48 && Math.abs(unit.y - ENEMY.y) <= 4),
          escortOutcome = campaign2EscortOutcome(scientists.length, aliveScientists.length, arrivedScientists.length);
        if (escortOutcome.failed) {
          ended = true;
          setOutcome("lose");
          setMessage("박사 전원 사망 · 평택 호송 실패");
        } else if (escortOutcome.won) {
          ended = true;
          setOutcome("win");
          setMessage(`${aliveScientists.length}명 생존 도착 · 평택 연구소 문이 열린다`);
        }
      }
      if (isCampaign && campaignChapter === 3 && !ended && !units.some((unit) => unit.alive && unit.team === "red" && unit.campaignAi === "arena")) {
        ended = true;
        setOutcome("win");
        setMessage("김씨와 함께 두 동료를 제압했다 · 갈등 봉합");
      }
      if (isCampaign && campaignChapter === 4 && !ended && campaignTimeLeft <= 0) {
        ended = true;
        setOutcome("lose");
        setMessage("제한 시간 초과 · 버그본 거점 탈환 실패");
      }
      if (isCampaign && campaignChapter === 5 && !ended) {
        const phaseOneRemaining = units.some((unit) => unit.alive && unit.team === "red" && unit.campaignZone === 1) ||
          spawnQueue.some((order) => order.team === "red" && order.campaignZone === 1);
        if (campaign5GatePhase === 1 && !phaseOneRemaining) {
          grid[26][28] = { type: 0, hp: 0, max: 0 };
          campaign5GatePhase = 2;
          for (const unit of units) if (campaignStageIsActive(unit.campaignZone, 2)) unit.campaignActivated = true;
          for (const turret of turrets) if (campaignStageIsActive(turret.campaignZone, 2)) turret.campaignActivated = true;
          setMessage("첫 군체 전멸 · 봉쇄문 2 해제");
          tone("build");
        }
        const phaseTwoRemaining = units.some((unit) => unit.alive && unit.team === "red" && unit.campaignZone === 2) ||
          spawnQueue.some((order) => order.team === "red" && order.campaignZone === 2);
        if (campaign5GatePhase === 2 && !phaseTwoRemaining) {
          grid[13][42] = { type: 0, hp: 0, max: 0 };
          campaign5GatePhase = 3;
          for (const unit of units) if (campaignStageIsActive(unit.campaignZone, 3)) unit.campaignActivated = true;
          for (const turret of turrets) if (campaignStageIsActive(turret.campaignZone, 3)) turret.campaignActivated = true;
          setMessage("굴착군체장 2기 격파 · 천안 최종 구간 개방");
          tone("victory");
        }
        if (campaign5GatePhase === 3 && Math.abs(hero.x - ENEMY.x) + Math.abs(hero.y - ENEMY.y) <= 4) {
          ended = true;
          setOutcome("win");
          setMessage("천안 연결 지점 도달 · 생존 터널 복구 완료");
        } else if (campaignTimeLeft <= 0) {
          ended = true;
          setOutcome("lose");
          setMessage("제한 시간 초과 · 천안 연결 터널 복구 실패");
        }
      }
      if (!cameraFree) {
        cam.x += (heroWorld.x - viewWidth / 2 - cam.x) * 0.12;
        cam.y += (heroWorld.y - viewHeight / 2 - cam.y) * 0.12;
      }
      clampCamera();
      if (now - lastHud > 120) {
        const next = HERO_LEVELS.find((row) => row.level === heroLevel + 1),
          missionSubjects = units.filter((unit) => unit.role === "scientist"),
          missionSubjectsAlive = missionSubjects.filter((unit) => unit.alive),
          missionSubjectsCompleted = missionSubjectsAlive.filter(
            (unit) => unit.x >= 48 && Math.abs(unit.y - ENEMY.y) <= 4,
          );
        setHud({
          ally: allyHp,
          enemy: enemyHp,
          allyShield,
          enemyShield,
          hp: Math.round(hero.hp),
          maxHp: Math.round(hero.maxHp),
          money: Math.floor(money),
          wave,
          allies: units.filter(
            (u) => u.alive && u.campaignActivated !== false && u.team === "blue" && u.role === "minion",
          ).length,
          enemies: units.filter(
            (u) => u.alive && u.campaignActivated !== false && u.team === "red" && (isCampaign || u.role === "minion"),
          ).length,
          explored: Math.round(
            (seen.flat().filter(Boolean).length / (COLS * ROWS)) * 100,
          ),
          level: heroLevel,
          xp: heroXp,
          nextXp: next?.xp ?? HERO_LEVELS.at(-1)?.xp ?? 3340,
          minionLevel: minionLevels.blue,
          tacticalCd: Math.max(0, Math.ceil((tacticalStates.blue.cooldownUntil - now) / 1000)),
          eliteReserved: eliteDeployments.blue.reserved,
          eliteActive: units.some((unit) => unit.alive && unit.team === "blue" && unit.role === "minion" && unit.minionRole === "elite"),
          eliteReadyIn: eliteReadyInWaves(wave, eliteDeployments.blue.lastSpawnWave),
          cd1: Math.max(0, Math.ceil(cd1 / 1000)),
          cd2: Math.max(0, Math.ceil(cd2 / 1000)),
          cd3: Math.max(0, Math.ceil(cd3 / 1000)),
          cd4: Math.max(0, Math.ceil(cd4 / 1000)),
          fillCd: Math.max(0, Math.ceil(fillCd / 1000)),
          fillMode,
          survivalCd: Math.max(0, Math.ceil(survivalCd / 1000)),
          item1: itemSlots[0],
          item2: itemSlots[1],
          item1Charges: itemCharges[0],
          item2Charges: itemCharges[1],
          itemCd: Math.max(0, Math.ceil((itemCooldownUntil - now) / 1000)),
          missionTime: Math.max(0, Math.ceil(campaignTimeLeft / 1000)),
          missionStage: campaignChapter === 5 ? campaign5GatePhase : campaignPhase,
          missionSubjectsAlive: missionSubjectsAlive.length,
          missionSubjectsCompleted: missionSubjectsCompleted.length,
          battlePhase: isSecretTunnel ? battlePhase : "open-front",
          battleTime: isSecretTunnel ? Math.max(0, Math.ceil(battlePhaseTimeLeft / 1000)) : 0,
          battleConnected: !isSecretTunnel || secretBlueConnected,
          routeAllocation: tunnelAllocations.blue,
        });
        lastHud = now;
      }
    };
    const drawYooFallback = (u: Unit, x: number, y: number) => {
      const d = u.dir,
        p = { x: -d.y, y: d.x };
      ctx.save();
      ctx.fillStyle = "#161b21";
      ctx.fillRect(x - 9, y + 8, 7, 10);
      ctx.fillRect(x + 3, y + 8, 7, 10);
      ctx.fillStyle = "#113d70";
      ctx.fillRect(x - 11, y - 8, 22, 18);
      ctx.fillStyle = "#ddd5bd";
      ctx.fillRect(x - 11, y - 2, 22, 5);
      ctx.fillStyle = "#a86b4d";
      ctx.fillRect(x - 7, y - 20, 14, 12);
      ctx.fillStyle = "#171719";
      ctx.fillRect(x - 8, y - 23, 16, 6);
      const drillX = x + p.x * 13,
        drillY = y + p.y * 13;
      ctx.fillStyle = "#168fc0";
      ctx.fillRect(drillX - 5, drillY - 5, 10, 10);
      const handX = x - p.x * 12,
        handY = y - p.y * 12;
      ctx.strokeStyle = "#f1cd55";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(handX + d.x * 13, handY + d.y * 13);
      ctx.stroke();
      ctx.restore();
    };
    const drawYooActionSword = (
      u: Unit,
      x: number,
      y: number,
      anim: YooAnim,
      p: number,
    ) => {
      if (!["basic", "whirlwind", "thrust", "ultimate"].includes(anim)) return;
      const d = u.dir,
        row = directionRow(d),
        leftHands = [
          { x: 9, y: -8 },
          { x: 7, y: -7 },
          { x: -7, y: -7 },
          { x: -9, y: -8 },
        ],
        hand = leftHands[row],
        base = Math.atan2(d.y, d.x),
        pulse = Math.sin(Math.PI * p),
        ease = (v: number) => 1 - Math.pow(1 - v, 3);
      let angle = base,
        reach = 23,
        handX = x + hand.x,
        handY = y + hand.y,
        charge = 0;
      if (anim === "basic")
        angle = base - 0.8 + 1.6 * ease(Math.min(1, p * 1.7));
      else if (anim === "whirlwind") {
        angle = base - 1.15 + p * Math.PI * 2 * 1.45;
        reach = 26;
        handX = x + hand.x * 0.45 + Math.cos(angle) * 2;
        handY = y - 7 + hand.y * 0.22 + Math.sin(angle) * 2;
      } else if (anim === "thrust") {
        angle = base;
        reach = 29 + 4 * pulse;
        handX = x + hand.x * 0.55 + d.x * (7 + 5 * pulse);
        handY = y + hand.y + d.y * (7 + 5 * pulse);
      } else {
        const chargeEnd = 0.42,
          swingEnd = 0.64,
          raised = -Math.PI / 2;
        if (p < chargeEnd) {
          angle = raised;
          reach = 28;
          handX = x + hand.x * 0.35;
          handY = y - 16;
          charge = ease(p / chargeEnd);
        } else {
          const q = Math.min(1, (p - chargeEnd) / (swingEnd - chargeEnd)),
            delta = Math.atan2(
              Math.sin(base - raised),
              Math.cos(base - raised),
            );
          angle =
            raised +
            delta * ease(q) +
            (Math.abs(delta) < 0.08 ? 0.78 * Math.sin(Math.PI * q) : 0);
          reach = 30;
          handX = x + hand.x * 0.55 + d.x * 6 * pulse;
          handY = y + hand.y + d.y * 6 * pulse;
          charge = Math.max(0, 1 - (p - chargeEnd) * 2.2);
        }
      }
      const tipX = handX + Math.cos(angle) * reach,
        tipY = handY + Math.sin(angle) * reach;
      ctx.save();
      ctx.lineCap = "square";
      if (anim === "whirlwind") {
        ctx.globalAlpha = 0.52;
        ctx.strokeStyle = "#9ec2cc";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y - 7, reach - 2, angle - 1.1, angle - 0.12);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (charge > 0) {
        ctx.globalCompositeOperation = "screen";
        const glow = ctx.createRadialGradient(
          tipX,
          tipY,
          1,
          tipX,
          tipY,
          13 + 5 * charge,
        );
        glow.addColorStop(0, "#ffffff");
        glow.addColorStop(0.28, "#72e9ffcc");
        glow.addColorStop(1, "#2a9ec500");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 13 + 5 * charge, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 4; i++) {
          const a = p * 28 + (i * Math.PI) / 2,
            r = 8 + charge * 6;
          ctx.fillStyle = i % 2 ? "#c9e4ea" : "#76eaff";
          ctx.fillRect(
            tipX + Math.cos(a) * r - 1,
            tipY + Math.sin(a) * r - 1,
            3,
            3,
          );
        }
      }
      ctx.translate(handX, handY);
      ctx.rotate(angle);
      ctx.strokeStyle = "#701d25";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();
      ctx.strokeStyle = "#a93435";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(1, -5);
      ctx.lineTo(1, 5);
      ctx.stroke();
      ctx.fillStyle = "#709aaa";
      ctx.strokeStyle = "#b6d0d7";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(4, -4);
      ctx.lineTo(reach - 4, -4);
      ctx.lineTo(reach, 0);
      ctx.lineTo(reach - 4, 4);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#426b7c";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(7, 1);
      ctx.lineTo(reach - 5, 1);
      ctx.stroke();
      ctx.strokeStyle = "#a52b32";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-2, 3);
      ctx.bezierCurveTo(-9, 8, -12, -3, -15, 5);
      ctx.stroke();
      ctx.fillStyle = "#52dff2";
      ctx.fillRect(-16, 4, 3, 3);
      ctx.restore();
    };
    const drawYoo = (u: Unit, x: number, y: number) => {
      const now = performance.now(),
        row = directionRow(u.dir),
        localYoo = u === hero,
        remoteActionActive = now < (u.arenaActionUntil ?? 0),
        remoteAnim: YooAnim = u.arenaActionSlot === 1
          ? "whirlwind"
          : u.arenaActionSlot === 2
            ? "thrust"
            : u.arenaActionSlot === 3
              ? "drill"
              : u.arenaActionSlot === 4
                ? "ultimate"
                : "basic",
        activeAnim = localYoo ? heroAnim : remoteAnim,
        actionActive =
          localYoo
            ? heroAnim !== "locomotion" && now < heroAnimStart + heroAnimDuration
            : remoteActionActive,
        actionProgress = actionActive
          ? localYoo
            ? Math.min(1, (now - heroAnimStart) / Math.max(1, heroAnimDuration))
            : Math.max(
                0,
                Math.min(
                  1,
                  (now - (u.arenaActionStartedAt ?? now)) /
                    Math.max(1, u.arenaActionDuration ?? 1),
                ),
              )
          : 0;
      let sheet = "locomotion",
        frame = 0;
      if (!u.alive) {
        sheet = "states";
        frame = Math.min(5, 3 + Math.floor((now - heroAnimStart) / 150));
      } else if (
        localYoo &&
        actionActive &&
        (heroAnim === "hurt" || heroAnim === "revive")
      ) {
        sheet = "states";
        frame =
          heroAnim === "hurt"
            ? 1 + Math.min(1, Math.floor((now - heroAnimStart) / 140))
            : 5 -
              Math.min(
                5,
                Math.floor(
                  ((now - heroAnimStart) / Math.max(1, heroAnimDuration)) * 6,
                ),
              );
      } else if (actionActive) {
        sheet = "locomotion";
        frame = activeAnim === "thrust" || activeAnim === "ultimate" ? 2 : 0;
      } else {
        if (localYoo) heroAnim = "locomotion";
        frame =
          now < (localYoo ? heroMoveUntil : (u.arenaMoveUntil ?? 0))
            ? 2 + (Math.floor(now / 105) % 2)
            : Math.floor(now / 520) % 2;
      }
      ctx.save();
      const floorGlow = ctx.createRadialGradient(x, y + 5, 2, x, y + 5, 29);
      floorGlow.addColorStop(0, "#6fa4a14d");
      floorGlow.addColorStop(1, "#6fa4a100");
      ctx.fillStyle = floorGlow;
      ctx.fillRect(x - 30, y - 24, 60, 48);
      ctx.fillStyle = "#06080899";
      ctx.beginPath();
      ctx.ellipse(x, y + 17, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = localYoo ? "#f1cc62" : u.team === "blue" ? "#54dfef" : "#ff6555";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(x, y + 16, 23, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const img = atlases[sheet];
      if (img?.complete && img.naturalWidth) {
        const cellW = img.naturalWidth / 6,
          cellH = img.naturalHeight / 4,
          safeLocomotion = sheet === "locomotion",
          sourceFrame = safeLocomotion
            ? frame === 5
              ? 0
              : frame
            : Math.min(5, frame),
          sourceX = safeLocomotion
            ? 80 + sourceFrame * cellW
            : sourceFrame * cellW,
          sourceW = safeLocomotion ? 224 : cellW,
          destW = safeLocomotion ? 48 : 56,
          footOffset = [0, 4, 6, 8][row],
          anchorX = smoothHeroAnchor(
            safeLocomotion
              ? ([
                  [0, 0, 0, 0],
                  [3, 3, -5, -5],
                  [2, 2, 3, 3],
                  [0, 0, 0, 0],
                ][row][sourceFrame] ?? 0)
              : 0,
            now,
          ),
          p = actionProgress,
          pulse = Math.sin(Math.PI * p),
          facing = u.dir.x || -u.dir.y || 1,
          swordAction =
            actionActive &&
            safeLocomotion &&
            ["basic", "whirlwind", "thrust", "ultimate"].includes(activeAnim);
        let poseX = 0,
          poseY = 0,
          angle = 0,
          scaleX = 1,
          scaleY = 1;
        if (actionActive && sheet === "locomotion") {
          if (activeAnim === "basic") {
            poseX = u.dir.x * 4 * pulse;
            poseY = u.dir.y * 4 * pulse;
            angle = -facing * 0.14 * pulse;
          } else if (activeAnim === "whirlwind") {
            angle = Math.sin(p * Math.PI * 4) * 0.08 * (u.dir.x < 0 ? -1 : 1);
            poseX = u.dir.x * 2 * pulse;
            poseY = u.dir.y * 2 * pulse;
            scaleX = 1 + 0.05 * pulse;
            scaleY = 1 - 0.03 * pulse;
          } else if (activeAnim === "thrust") {
            poseX = u.dir.x * 6 * pulse;
            poseY = u.dir.y * 6 * pulse;
            angle = -facing * 0.08 * pulse;
            scaleY = 0.94;
          } else if (activeAnim === "drill") {
            poseX = Math.sin(p * 70) * 1.5;
            poseY = Math.cos(p * 54);
            scaleX = 1 + 0.04 * pulse;
          } else if (heroAnim === "ultimate") {
            const swing =
              p < 0.42
                ? -0.24 * (p / 0.42)
                : p < 0.64
                  ? -0.24 + 0.86 * ((p - 0.42) / 0.22)
                  : 0.62 * (1 - (p - 0.64) / 0.36);
            angle = facing * swing;
            poseX = u.dir.x * (2 + 6 * Math.max(0, (p - 0.42) / 0.58)) * pulse;
            poseY = u.dir.y * (2 + 6 * Math.max(0, (p - 0.42) / 0.58)) * pulse;
            scaleX = 1 + 0.12 * pulse;
            scaleY = 1 - 0.08 * pulse;
          }
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.filter = "drop-shadow(0 1px 1px #8ab8b499)";
        ctx.save();
        ctx.translate(x + poseX, y + poseY);
        ctx.rotate(angle);
        ctx.scale(scaleX, scaleY);
        if (swordAction) {
          heroCtx.clearRect(0, 0, 80, 80);
          heroCtx.globalCompositeOperation = "source-over";
          heroCtx.drawImage(
            img,
            sourceX,
            row * cellH,
            sourceW,
            cellH,
            40 - destW / 2 + anchorX,
            40 - 39 + footOffset,
            destW,
            52,
          );
          heroCtx.globalCompositeOperation = "destination-out";
          const masks = [
              { x: 49, y: 22, w: 16, h: 39 },
              { x: 47, y: 26, w: 18, h: 36 },
              { x: 15, y: 26, w: 18, h: 36 },
              { x: 15, y: 22, w: 18, h: 39 },
            ],
            mask = masks[row];
          heroCtx.fillStyle = "#000";
          heroCtx.fillRect(mask.x, mask.y, mask.w, mask.h);
          heroCtx.globalCompositeOperation = "source-over";
          ctx.drawImage(heroLayer, -40, -40);
        } else
          ctx.drawImage(
            img,
            sourceX,
            row * cellH,
            sourceW,
            cellH,
            -destW / 2 + anchorX,
            -39 + footOffset,
            destW,
            52,
          );
        ctx.restore();
        ctx.filter = "none";
      } else drawYooFallback(u, x, y);
      if (actionActive && u.alive)
        drawYooActionSword(u, x, y, activeAnim, actionProgress);
      ctx.restore();
      return true;
    };
    const drawSlash = (s: SlashFx) => {
      const x = s.x * S + S / 2 - cam.x,
        y = s.y * S + S / 2 - cam.y,
        t = 1 - s.life / s.maxLife,
        a = Math.max(0, s.life / s.maxLife),
        ang = Math.atan2(s.dir.y, s.dir.x);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = "square";
      if (s.kind === "toy") {
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = "#9fc3ce";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 25, -0.85, 0.85);
        ctx.stroke();
        ctx.strokeStyle = "#a93435";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (s.kind === "spin") {
        ctx.strokeStyle = "#69dff2";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(x, y, 28 + t * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#a8c6ce";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 18 + t * 24, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.kind === "thrust") {
        ctx.strokeStyle = s.color ?? "#5ad7ef";
        ctx.lineWidth = 10 * (1 - t) + 2;
        ctx.beginPath();
        ctx.moveTo(x + s.dir.x * 8, y + s.dir.y * 8);
        ctx.lineTo(x + s.dir.x * S * 4, y + s.dir.y * S * 4);
        ctx.stroke();
        ctx.strokeStyle = "#aac8d0";
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (s.kind === "ultimate") {
        const flight = Math.max(0, Math.min(1, (t - 0.42) / 0.58)),
          travel = ultimateTravel(s),
          cx = x + s.dir.x * travel,
          cy = y + s.dir.y * travel;
        ctx.globalAlpha =
          Math.min(1, flight * 9) * Math.max(0, 1 - flight * 0.72);
        ctx.globalCompositeOperation = "screen";
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.strokeStyle = "#dff7fb";
        ctx.lineWidth = 8 - 4 * flight;
        ctx.beginPath();
        ctx.moveTo(-5, -27);
        ctx.quadraticCurveTo(27, 0, -5, 27);
        ctx.stroke();
        ctx.strokeStyle = "#62e6ff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = "#91bdc9";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-36 - 30 * flight, 0);
        ctx.lineTo(-7, 0);
        ctx.stroke();
      } else if (s.kind === "signature") {
        const r = (s.radius ?? 2) * S * (0.65 + t * 0.35),
          color = s.color ?? "#66e4ef",
          variant = s.variant ?? "";
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        if (["microwaveBash", "smash", "microwave"].includes(variant)) {
          const reach = Math.max(20, r * (0.45 + t * 0.35));
          ctx.globalAlpha = a * 0.88;
          ctx.strokeRect(10, -13, reach, 26);
          ctx.beginPath();
          for (let grill = -8; grill <= 8; grill += 8) {
            ctx.moveTo(14, grill);
            ctx.lineTo(8 + reach, grill * 0.55);
          }
          ctx.stroke();
          ctx.strokeStyle = "#fff1b8";
          ctx.beginPath();
          ctx.arc(reach, 0, 10 + t * 8, -0.9, 0.9);
          ctx.stroke();
        } else if (["chemicalSpray", "stunSpray", "acidCone"].includes(variant)) {
          ctx.globalAlpha = a * 0.82;
          for (let i = 0; i < 9; i++) {
            const travel = r * (0.18 + ((i * 0.17 + t * 0.72) % 0.82)),
              spread = (i - 4) * travel * 0.055;
            ctx.beginPath();
            ctx.arc(travel, spread, 2 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.moveTo(7, -5);
          ctx.lineTo(r, -r * 0.32);
          ctx.moveTo(7, 5);
          ctx.lineTo(r, r * 0.32);
          ctx.stroke();
        } else if (["shieldBash", "shieldSweep", "lidDisc"].includes(variant)) {
          const reach = r * (0.48 + t * 0.42);
          ctx.globalAlpha = a * 0.9;
          ctx.lineWidth = 6 - t * 3;
          ctx.beginPath();
          ctx.arc(5, 0, reach, -0.72, 0.72);
          ctx.stroke();
          ctx.strokeStyle = "#e9fbff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(reach * 0.72, 0, 9 + t * 5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (["electricAura", "groupHeal", "armorOrder"].includes(variant)) {
          ctx.rotate(-ang);
          ctx.globalAlpha = a * 0.78;
          for (let ring = 1; ring <= 2; ring++) {
            ctx.beginPath();
            ctx.arc(0, 0, r * (0.28 * ring + t * 0.16), 0, Math.PI * 2);
            ctx.stroke();
          }
          for (let i = 0; i < 4; i++) {
            const q = i * Math.PI * 0.5 + t;
            ctx.fillRect(Math.cos(q) * r * 0.62 - 3, Math.sin(q) * r * 0.62 - 3, 6, 6);
          }
        } else if (variant === "rejectLaser") {
          ctx.globalAlpha = a * 0.7;
          ctx.fillRect(10, -r * 0.62, 12, r * 1.24);
          ctx.strokeStyle = "#eaffff";
          ctx.strokeRect(6, -r * 0.68, 20, r * 1.36);
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(0, -r * 0.76, 31, r * 1.52);
          ctx.setLineDash([]);
        } else if (
          ["auditBeam", "drillJab", "railLine", "blueprint"].includes(variant)
        ) {
          for (let i = -1; i <= 1; i++) {
            ctx.globalAlpha = a * (1 - Math.abs(i) * 0.22);
            ctx.beginPath();
            ctx.moveTo(8, i * 7);
            ctx.lineTo(r, i * 7);
            ctx.stroke();
          }
        } else if (["webTrap", "silkPull", "webLock"].includes(variant)) {
          ctx.rotate(-ang);
          for (let ring = 1; ring <= 3; ring++) {
            ctx.beginPath();
            ctx.arc(0, 0, (r * ring) / 3, 0, Math.PI * 2);
            ctx.stroke();
          }
          for (let i = 0; i < 8; i++) {
            const q = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(q) * r, Math.sin(q) * r);
            ctx.stroke();
          }
        } else if (
          [
            "repairBolt",
            "weldCone",
            "massRepair",
          ].includes(variant)
        ) {
          ctx.rotate(-ang);
          for (let i = 0; i < 6; i++) {
            const q = (i * Math.PI) / 3 + t * 0.8,
              px = Math.cos(q) * r * 0.65,
              py = Math.sin(q) * r * 0.65;
            ctx.fillRect(px - 5, py - 1, 10, 2);
            ctx.fillRect(px - 1, py - 5, 2, 10);
          }
        } else if (
          ["acidShot", "acidMark", "acidLine", "acidPool"].includes(
            variant,
          )
        ) {
          ctx.rotate(-ang);
          for (let i = 0; i < 7; i++) {
            const q = i * 2.3 + t * 2,
              rr = r * (0.25 + (i % 3) * 0.24);
            ctx.beginPath();
            ctx.arc(
              Math.cos(q) * rr,
              Math.sin(q) * rr,
              4 + (i % 2) * 3,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        } else if (variant === "jump") {
          ctx.globalAlpha = a * 0.9;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(r * 0.5, -34, r, 0);
          ctx.stroke();
          ctx.fillStyle = "#f4f1c5";
          ctx.beginPath();
          ctx.arc(r * t, -Math.sin(Math.PI * t) * 34, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (
          [
            "dash",
            "shellRush",
            "glide",
            "trackShift",
            "relocate",
            "moltRam",
            "overclock",
          ].includes(variant)
        ) {
          for (let i = -2; i <= 2; i++) {
            ctx.globalAlpha = a * (1 - Math.abs(i) * 0.14);
            ctx.beginPath();
            ctx.moveTo(-r * 0.5, i * 6);
            ctx.lineTo(r, i * 3);
            ctx.stroke();
          }
        } else if (variant === "fill") {
          ctx.rotate(-ang);
          ctx.globalAlpha = a * 0.82;
          for (let i = 0; i < 5; i++) {
            const q = i * Math.PI * 0.4 + t * 2,
              rr = 8 + i * 4;
            ctx.fillRect(Math.cos(q) * rr - 3, Math.sin(q) * rr - 3, 6, 6);
          }
          ctx.strokeStyle = "#e0b07a";
          ctx.strokeRect(-17, -17, 34, 34);
        } else if (variant === "bombPlant") {
          ctx.rotate(-ang);
          ctx.globalAlpha = a * 0.9;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(0, 0, 14 + t * 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#ffcf58";
          ctx.fillRect(-3, -3, 6, 6);
        } else {
          ctx.rotate(-ang);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = s.color ?? "#34c9ef";
        ctx.lineWidth = 5;
        for (let yy = -1; yy <= 1; yy++)
          for (let xx = -1; xx <= 1; xx++)
            if (xx || yy)
              ctx.strokeRect(x + xx * S - 13, y + yy * S - 13, 26, 26);
      }
      ctx.restore();
    };
    const tileHash = (x: number, y: number, salt = 0) =>
        Math.abs((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0,
      solidTile = (x: number, y: number) =>
        isSecretTunnel
          ? !openForTeam(x, y, "blue")
          : !!grid[y]?.[x] && grid[y][x].type !== 0,
      drawTile = (t: Tile, x: number, y: number) => {
        const px = x * S - cam.x,
          py = y * S - cam.y,
          seed = tileHash(x, y),
          now = performance.now(),
          neighbor = (dx: number, dy: number) => grid[y + dy]?.[x + dx];
        if (t.obstacle === "deepWater") {
          ctx.fillStyle = seed % 3 ? "#082b31" : "#092f34";
          ctx.fillRect(px, py, S, S);
          ctx.fillStyle = "#04191d88";
          for (let i = 0; i < 5; i++) {
            const sx = px + 3 + ((seed >>> (i * 3)) % 34),
              sy = py + 3 + ((seed >>> (i * 2 + 5)) % 34),
              w = 2 + ((seed + i) % 4);
            ctx.fillRect(sx, sy, w, 2);
          }
          const flow = (now / 180 + seed) % 22;
          ctx.fillStyle = "#3c8c93aa";
          for (let i = 0; i < 3; i++) {
            const sy = py + ((flow + i * 15) % 40),
              sx = px + 4 + ((seed >>> (i * 5)) % 13);
            ctx.fillRect(sx, sy, 10 + ((seed + i) % 12), 1);
            if ((seed + i) % 3 === 0) ctx.fillRect(sx + 4, sy + 2, 5, 1);
          }
          const bank = (side: "top" | "right" | "bottom" | "left") => {
            ctx.fillStyle = "#171c1d";
            if (side === "top") ctx.fillRect(px, py, S, 8);
            else if (side === "bottom") ctx.fillRect(px, py + S - 8, S, 8);
            else if (side === "left") ctx.fillRect(px, py, 8, S);
            else ctx.fillRect(px + S - 8, py, 8, S);
            ctx.fillStyle = "#6c7069";
            if (side === "top") ctx.fillRect(px, py + 1, S, 3);
            else if (side === "bottom") ctx.fillRect(px, py + S - 5, S, 3);
            else if (side === "left") ctx.fillRect(px + 1, py, 3, S);
            else ctx.fillRect(px + S - 5, py, 3, S);
            ctx.fillStyle = "#9ca096";
            if (side === "top") ctx.fillRect(px + 4, py + 1, 10, 1);
            else if (side === "bottom")
              ctx.fillRect(px + 22, py + S - 5, 11, 1);
            else if (side === "left") ctx.fillRect(px + 1, py + 7, 1, 11);
            else ctx.fillRect(px + S - 5, py + 21, 1, 10);
          };
          if (neighbor(0, -1)?.obstacle !== "deepWater") bank("top");
          if (neighbor(0, 1)?.obstacle !== "deepWater") bank("bottom");
          if (neighbor(-1, 0)?.obstacle !== "deepWater") bank("left");
          if (neighbor(1, 0)?.obstacle !== "deepWater") bank("right");
          if (seed % 5 === 0) {
            ctx.fillStyle = "#b59336";
            ctx.fillRect(px + 5, py + 4, 7, 2);
            ctx.fillStyle = "#d8bc54";
            ctx.fillRect(px + 5, py + 4, 3, 1);
          }
          return;
        }
        if (t.obstacle === "root") {
          ctx.fillStyle = "#100d0c";
          ctx.fillRect(px, py, S, S);
          ctx.fillStyle = "#211712";
          for (let i = 0; i < 5; i++)
            ctx.fillRect(
              px + ((seed >>> (i * 3)) % 36),
              py + ((seed >>> (i * 4 + 2)) % 36),
              3 + (i % 3),
              2,
            );
          const linked = DIRS.filter(
            ({ x: dxx, y: dyy }) => neighbor(dxx, dyy)?.obstacle === "root",
          );
          ctx.lineCap = "round";
          ctx.beginPath();
          for (const { x: dxx, y: dyy } of linked) {
            ctx.moveTo(px + 20, py + 20);
            ctx.quadraticCurveTo(
              px + 20 + dyy * 4,
              py + 20 - dxx * 4,
              px + 20 + dxx * 25,
              py + 20 + dyy * 25,
            );
          }
          if (!linked.length) {
            ctx.moveTo(px + 8, py + 34);
            ctx.quadraticCurveTo(px + 16, py + 18, px + 32, py + 5);
          }
          ctx.strokeStyle = "#2b1713";
          ctx.lineWidth = 20;
          ctx.stroke();
          ctx.strokeStyle = "#70402d";
          ctx.lineWidth = 13;
          ctx.stroke();
          ctx.strokeStyle = "#a86b48";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "#3c2119";
          ctx.fillRect(px + 14, py + 14, 13, 13);
          ctx.fillStyle = "#b27a54";
          ctx.fillRect(px + 17, py + 15, 5, 10);
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = i === 0 ? "#6f3f2c" : "#8e5439";
            ctx.lineWidth = 3 - i * 0.5;
            ctx.beginPath();
            ctx.moveTo(px + 18 + i * 4, py + 21);
            ctx.quadraticCurveTo(
              px + 7 + i * 3,
              py + 28 + i * 2,
              px + 3 + i * 4,
              py + 36,
            );
            ctx.stroke();
          }
          ctx.lineCap = "butt";
          return;
        }
        if (t.obstacle === "ledge") {
          ctx.fillStyle = seed % 3 ? "#303638" : "#353b3d";
          ctx.fillRect(px, py, S, S);
          ctx.fillStyle = "#202628";
          ctx.fillRect(px, py + 29, S, 11);
          ctx.fillStyle = "#555c5d";
          ctx.fillRect(px, py, S, 5);
          ctx.fillStyle = "#89908b";
          ctx.fillRect(px + 2, py + 1, S - 4, 1);
          if (x % 3 === 0) {
            ctx.fillStyle = "#1a2022";
            ctx.fillRect(px, py + 5, 2, 27);
            ctx.fillStyle = "#697071";
            ctx.fillRect(px + 2, py + 7, 1, 20);
          }
          if (seed % 4 === 0) {
            ctx.fillStyle = "#171c1e";
            ctx.fillRect(px + 25, py + 10, 9, 12);
            ctx.fillStyle = "#555d5e";
            ctx.fillRect(px + 27, py + 12, 5, 7);
          }
          if (seed % 5 === 0) {
            ctx.fillStyle = "#aa812c";
            ctx.fillRect(px + 4, py + 3, 8, 2);
            ctx.fillStyle = "#e0b84d";
            ctx.fillRect(px + 4, py + 3, 3, 1);
          }
          return;
        }
        if (t.type === 0) {
          const platform = t.surface === "platform",
            ramp = t.surface === "ramp",
            water = t.surface === "shallowWater";
          ctx.fillStyle = platform
            ? "#343a3b"
            : ramp
              ? "#3e4241"
              : seed % 3
                ? "#11191c"
                : "#131e21";
          ctx.fillRect(px, py, S, S);
          if (platform) {
            ctx.fillStyle = "#1d2325";
            ctx.fillRect(px, py + 32, S, 8);
            ctx.fillStyle = "#626866";
            ctx.fillRect(px, py, S, 4);
            ctx.fillStyle = "#92968d";
            ctx.fillRect(px + 2, py + 1, S - 4, 1);
            if (x % 3 === 0) {
              ctx.fillStyle = "#202628";
              ctx.fillRect(px, py + 4, 2, 28);
              ctx.fillStyle = "#505758";
              ctx.fillRect(px + 2, py + 6, 1, 23);
            }
            if (seed % 5 === 0) {
              ctx.fillStyle = "#202527";
              ctx.fillRect(px + 27, py + 12, 7, 9);
              ctx.fillStyle = "#6a706d";
              ctx.fillRect(px + 29, py + 14, 3, 4);
            }
          } else if (ramp) {
            ctx.fillStyle = "#272d2e";
            for (let yy = 4; yy < S; yy += 6) {
              ctx.fillRect(px + 4, py + yy, S - 8, 3);
              ctx.fillStyle = "#666b67";
              ctx.fillRect(px + 5, py + yy, S - 10, 1);
              ctx.fillStyle = "#272d2e";
            }
            ctx.fillStyle = "#a37c2d";
            for (let yy = 4; yy < S; yy += 12) {
              ctx.fillRect(px + 2, py + yy, 3, 7);
              ctx.fillRect(px + S - 5, py + yy, 3, 7);
            }
          } else {
            for (let i = 0; i < 4; i++) {
              ctx.fillStyle = i % 2 ? "#1b282b" : "#263438";
              ctx.globalAlpha = 0.28;
              ctx.fillRect(
                px + 3 + ((seed >>> (i * 4)) % 33),
                py + 4 + ((seed >>> (i * 5 + 3)) % 31),
                2 + ((seed + i) % 5),
                1 + (i % 2),
              );
              ctx.globalAlpha = 1;
            }
            if ((x + 2 * y) % 5 === 0) {
              ctx.fillStyle = "#2c393c88";
              ctx.fillRect(px + 2, py + 31, 22, 2);
              ctx.fillStyle = "#080e10";
              ctx.fillRect(px + 7, py + 33, 17, 1);
            }
            if (seed % 13 === 0) {
              ctx.fillStyle = "#56666866";
              ctx.fillRect(px + 8, py + 9, 6, 2);
              ctx.fillRect(px + 13, py + 11, 2, 5);
            }
          }
          if (water) {
            ctx.fillStyle = "#0e4a526e";
            ctx.fillRect(px, py, S, S);
            ctx.fillStyle = "#5ca0a69c";
            const wave = (seed + Math.floor(now / 220)) % 25;
            ctx.fillRect(
              px + 4 + (wave % 10),
              py + 8 + (wave % 3) * 9,
              9 + (seed % 8),
              1,
            );
            if (seed % 4 === 0) ctx.fillRect(px + 24, py + 28, 4, 2);
            ctx.fillStyle = "#b2d2cf55";
            if (neighbor(0, -1)?.surface !== "shallowWater")
              ctx.fillRect(px + 3, py + 1, S - 6, 2);
          }
          if (t.hazard === "steam") {
            const phase = now % 5200,
              warning = phase >= 1700 && phase < 2400,
              active = phase >= 2400 && phase < 3900;
            ctx.fillStyle = "#172225";
            ctx.fillRect(px + 5, py + 5, S - 10, S - 10);
            ctx.strokeStyle = warning ? "#ffcb48" : active ? "#fff4d0" : "#8b4b35";
            ctx.lineWidth = active ? 3 : 2;
            ctx.beginPath();
            ctx.arc(px + S / 2, py + S / 2, 11, 0, Math.PI * 2);
            ctx.stroke();
            for (let vent = -1; vent <= 1; vent++) {
              ctx.fillStyle = active
                ? `rgba(235,246,232,${0.34 + ((Math.sin(now / 90 + vent) + 1) * 0.16)})`
                : warning ? "#d9a83b88" : "#713c3188";
              const rise = active ? (now / 8 + vent * 11 + seed) % 32 : 0;
              ctx.beginPath();
              ctx.arc(px + 20 + vent * 8, py + 27 - rise, active ? 8 : 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          return;
        }
        const fresh = t.type === 5 && now < (t.freshUntil ?? 0),
          rootClump = t.type === 7,
          rock = t.type === 3 || t.type === 4,
          base = rock
            ? t.type === 4
              ? "#303639"
              : "#454a4b"
            : fresh
              ? "#92633f"
              : rootClump
                ? "#4a3025"
                : "#5b3c29";
        ctx.fillStyle = base;
        ctx.fillRect(px, py, S, S);
        if (!rock) {
          const soil = ["#3d291f", "#7c5437", "#916342", "#2c211b"];
          for (let i = 0; i < 7; i++) {
            ctx.fillStyle = soil[(seed + i) % soil.length];
            const sx = px + 2 + ((seed >>> (i * 3)) % 35),
              sy = py + 2 + ((seed >>> (i * 4 + 1)) % 35),
              w = 2 + ((seed + i) % 5),
              h = 1 + ((seed >>> (i + 2)) % 3);
            ctx.globalAlpha = i < 2 ? 0.48 : 0.27;
            ctx.fillRect(sx, sy, w, h);
          }
          ctx.globalAlpha = 1;
          if ((x + y) % 4 === 0) {
            const strataX = 3 + (seed % 11),
              strataW = 16 + ((seed >>> 5) % 15);
            ctx.fillStyle = "#8a5c3b66";
            ctx.fillRect(px + strataX, py + 27, strataW, 2);
            ctx.fillStyle = "#35241c77";
            ctx.fillRect(
              px + strataX + 5,
              py + 29,
              Math.max(5, strataW - 7),
              1,
            );
          }
        } else {
          ctx.fillStyle = "#767b7a42";
          for (let i = 0; i < 4; i++)
            ctx.fillRect(
              px + 3 + ((seed >>> (i * 4)) % 30),
              py + 4 + ((seed >>> (i * 5 + 2)) % 30),
              4 + (i % 3) * 3,
              2,
            );
          ctx.fillStyle = "#20262866";
          ctx.fillRect(px + 22, py + 18, 15, 13);
          ctx.fillStyle = "#5e656655";
          ctx.fillRect(px + 24, py + 19, 8, 3);
        }
        const edge = (
          dx: number,
          dy: number,
          side: "top" | "right" | "bottom" | "left",
        ) => {
          if (solidTile(x + dx, y + dy)) return;
          if (side === "top") {
            ctx.fillStyle = rock ? "#777c7f" : "#8a6040";
            ctx.fillRect(px, py, S, 4);
            ctx.fillStyle = "#21171199";
            ctx.fillRect(px, py + 4, S, 3);
          } else if (side === "bottom") {
            ctx.fillStyle = "#17100d99";
            ctx.fillRect(px, py + S - 6, S, 6);
          } else if (side === "left") {
            ctx.fillStyle = rock ? "#697074" : "#80583b";
            ctx.fillRect(px, py, 4, S);
            ctx.fillStyle = "#20161188";
            ctx.fillRect(px + 4, py, 3, S);
          } else {
            ctx.fillStyle = "#21171499";
            ctx.fillRect(px + S - 6, py, 6, S);
          }
        };
        edge(0, -1, "top");
        edge(1, 0, "right");
        edge(0, 1, "bottom");
        edge(-1, 0, "left");
        if (rootClump) {
          ctx.fillStyle = "#25181288";
          ctx.fillRect(px + 4, py + 28, 32, 8);
          ctx.lineCap = "round";
          for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = i % 2 ? "#a36543" : "#75442f";
            ctx.lineWidth = i % 2 ? 3 : 5;
            ctx.beginPath();
            ctx.moveTo(px + 3 + i * 8, py + 37);
            ctx.quadraticCurveTo(
              px + 32 - i * 5,
              py + 21,
              px + 7 + i * 6,
              py + 4,
            );
            ctx.stroke();
            if (i < 3) {
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(px + 14 + i * 7, py + 24);
              ctx.lineTo(px + 4 + i * 4, py + 16 - i * 3);
              ctx.stroke();
            }
          }
          ctx.lineCap = "butt";
        } else if (fresh) {
          ctx.strokeStyle = "#d29a66aa";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px + 15, py + 20, 7, 0.35, 2.75);
          ctx.stroke();
          ctx.fillStyle = "#4f321f77";
          ctx.fillRect(px + 25, py + 13, 3, 13);
          ctx.fillRect(px + 21, py + 23, 11, 3);
        } else if (seed % 5 === 0 && !rock) {
          ctx.strokeStyle = "#2a1d16aa";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + 10, py + 7);
          ctx.quadraticCurveTo(px + 17, py + 16, px + 12, py + 27);
          ctx.stroke();
        } else if (seed % 7 === 0 && rock) {
          ctx.fillStyle = "#9a8d69";
          ctx.fillRect(px + 6, py + 7, 4, 4);
          ctx.fillStyle = "#25292b";
          ctx.fillRect(px + 7, py + 8, 2, 2);
        }
        if (t.ore) {
          ctx.fillStyle = "#38281d";
          ctx.fillRect(px + 7, py + 11, 18, 7);
          ctx.fillRect(px + 11, py + 7, 8, 15);
          ctx.fillStyle = "#c59a3a";
          ctx.fillRect(px + 9, py + 12, 5, 4);
          ctx.fillRect(px + 15, py + 9, 6, 5);
          ctx.fillRect(px + 18, py + 15, 5, 4);
          ctx.fillStyle = "#f0c968";
          ctx.fillRect(px + 11, py + 11, 3, 2);
          ctx.fillRect(px + 17, py + 9, 3, 2);
          ctx.fillRect(px + 20, py + 15, 2, 2);
          ctx.fillStyle = "#778185";
          ctx.fillRect(px + 7, py + 17, 6, 3);
          ctx.fillRect(px + 14, py + 20, 5, 2);
        }
        const d = t.max > 0 ? 1 - t.hp / t.max : 0;
        if (d > 0) {
          ctx.strokeStyle = rock ? "#1f2528" : "#251813";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + 20, py + 3);
          ctx.lineTo(px + 16, py + 15);
          ctx.lineTo(px + 26, py + 23);
          if (d > 0.34) {
            ctx.moveTo(px + 16, py + 15);
            ctx.lineTo(px + 5, py + 27);
          }
          if (d > 0.66) {
            ctx.moveTo(px + 26, py + 23);
            ctx.lineTo(px + 36, py + 12);
            ctx.moveTo(px + 26, py + 23);
            ctx.lineTo(px + 30, py + 39);
          }
          ctx.stroke();
        }
      };
    const drawBase = (b: { x: number; y: number }, team: Team, hp: number) => {
      const isPyeongtaek = isCampaign && campaignChapter === 2 && team === "red",
        isCheonan = isCampaign && campaignChapter === 5 && team === "red",
        humanMissionCore = isPyeongtaek || isCheonan,
        faction = humanMissionCore ? "human" : team === "blue" ? playerDef.faction : enemyFaction,
        baseDef = FACTION_BASES[faction],
        baseImage = baseImages[faction],
        cx = b.x * S + S / 2 - cam.x,
        cy = b.y * S + S / 2 - cam.y,
        dw = faction === "bugborn" ? 112 : 106,
        dh = faction === "bugborn" ? 82 : 74,
        left = cx - dw / 2,
        top = cy - dh + 25,
        teamColor = humanMissionCore ? "#78f0a0" : team === "blue" ? "#54dfef" : "#ff5e51";
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 15, 41, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (baseImage?.complete && baseImage.naturalWidth) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        if (team === "red" && !humanMissionCore)
          ctx.filter =
            "saturate(.9) brightness(.78) drop-shadow(0 0 3px #d64c40)";
        ctx.drawImage(baseImage, left, top, dw, dh);
        ctx.filter = "none";
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.fillStyle = FACTIONS[faction].color;
        ctx.fillRect(cx - S / 2 + 2, cy - S / 2 + 2, S - 4, S - 4);
      }
      if (hp < 420) {
        ctx.globalAlpha = Math.min(0.55, (420 - hp) / 420 + 0.18);
        ctx.fillStyle = "#17191a";
        ctx.beginPath();
        ctx.arc(
          cx + 15,
          top + 19,
          8 + (performance.now() % 700) / 135,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#101617";
      ctx.fillRect(cx - 45, top - 10, 90, 7);
      ctx.fillStyle = teamColor;
      ctx.fillRect(cx - 43, top - 8, (86 * hp) / 600, 3);
      ctx.strokeStyle = "#c9b46f";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 45, top - 10, 90, 7);
      ctx.fillStyle = teamColor;
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        isPyeongtaek
          ? "목적지 · 평택거점(연구소)"
          : isCheonan
            ? "목적지 · 천안 생존 코어"
            : `${team === "blue" ? "아군" : "적군"} · ${baseDef.name}`,
        cx,
        top - 14,
      );
      ctx.restore();
    };
    const drawMinion = (u: Unit, x: number, y: number) => {
      const role = u.minionRole ?? "escort",
        sheet = minionSheets[u.faction],
        now = performance.now(),
        state = !u.alive
          ? "down"
          : now < (u.minionVisualUntil ?? 0)
            ? (u.minionVisual ?? "idle")
            : "idle",
        row = role === "breaker" ? 0 : role === "escort" ? 1 : 2,
        frame =
          state === "down"
            ? 5
            : state === "hurt"
              ? 4
              : state === "attack"
                ? Math.floor(now / 140) % 2
                  ? 3
                  : 4
                : state === "move"
                  ? 1 + (Math.floor(now / 140) % 2)
                  : 0,
        cellSize =
          u.faction === "human"
            ? { w: 43, h: 50 }
            : u.faction === "bugborn"
              ? { w: 43, h: 40 }
              : { w: 47, h: 44 };
      ctx.save();
      ctx.translate(x, y);
      if (u.alive && supportAuraForUnit(u)) {
        const supportColor = u.faction === "human" ? "#63e9ff" : u.faction === "bugborn" ? "#b7ef61" : "#ff9b55";
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = supportColor;
        ctx.globalAlpha = 0.48 + Math.sin(now / 120 + u.id) * 0.15;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 11, 18, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      if (u.alive && u.level >= 4) {
        const radius = u.level >= 5 ? 25 : 20,
          glow = ctx.createRadialGradient(0, -7, 2, 0, -7, radius);
        glow.addColorStop(0, u.team === "blue" ? "#bff8ff80" : "#ffd0bf70");
        glow.addColorStop(0.48, u.team === "blue" ? "#58ddeb32" : "#ff76542d");
        glow.addColorStop(1, "#00000000");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -7, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#050707a8";
      ctx.beginPath();
      ctx.ellipse(0, 11, role === "escort" ? 12 : 10, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      const walk = state === "move" ? Math.sin((now + u.id * 53) / 78) : 0;
      ctx.translate(0, -Math.abs(walk) * 1.25);
      ctx.rotate(walk * 0.018);
      const eliteImage = role === "elite" ? eliteImages[u.faction] : undefined;
      if (eliteImage?.complete && eliteImage.naturalWidth > 0) {
        const flip = u.dir.x < 0,
          size = u.faction === "ai" ? 67 : u.faction === "human" ? 64 : 61,
          attackKick = state === "attack" ? Math.sin(now / 55) * 2 : 0;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        if (flip) ctx.scale(-1, 1);
        ctx.filter = "drop-shadow(0 0 7px rgba(255,214,102,.45)) drop-shadow(2px 4px 2px rgba(0,0,0,.75))";
        ctx.drawImage(eliteImage, -size / 2 + attackKick, -size + 16, size, size);
        ctx.filter = "none";
        ctx.imageSmoothingEnabled = false;
      } else if (sheet) {
        const sw = sheet.width / 6,
          sh = sheet.height / 3,
          flip = u.dir.x < 0;
        minionFrameCtx.clearRect(0, 0, 128, 128);
        minionFrameCtx.drawImage(
          sheet,
          frame * sw,
          row * sh,
          sw,
          sh,
          0,
          0,
          128,
          128,
        );
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        if (flip) ctx.scale(-1, 1);
        const dx = -cellSize.w / 2,
          dy = -cellSize.h + 16;
        ctx.filter = "brightness(0)";
        ctx.globalAlpha = 0.82;
        for (const [ox, oy] of [
          [-1.4, 0],
          [1.4, 0],
          [0, -1.4],
          [0, 1.4],
        ])
          ctx.drawImage(
            minionFrameLayer,
            dx + ox,
            dy + oy,
            cellSize.w,
            cellSize.h,
          );
        ctx.filter = "none";
        ctx.globalAlpha = 1;
        ctx.drawImage(minionFrameLayer, dx, dy, cellSize.w, cellSize.h);
        ctx.imageSmoothingEnabled = false;
      } else {
        const def = minionDefinition(u.faction, role);
        ctx.strokeStyle = "#0b0d0d";
        ctx.lineWidth = 3;
        ctx.fillStyle = def.colors.body;
        ctx.strokeRect(-7, -15, 14, 23);
        ctx.fillRect(-7, -15, 14, 23);
        ctx.fillStyle = def.colors.accent;
        ctx.fillRect(-5, -12, 10, 5);
      }
      ctx.restore();
      if (u.alive && role === "elite") {
        ctx.save();
        ctx.strokeStyle = u.team === "blue" ? "#ffe071" : "#ff826e";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.lineDashOffset = -now / 90;
        ctx.beginPath();
        ctx.ellipse(x, y + 12, 22, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#100d09df";
        ctx.strokeStyle = "#d4ac47";
        ctx.fillRect(x - 24, y - 50, 48, 11);
        ctx.strokeRect(x - 24, y - 50, 48, 11);
        ctx.fillStyle = "#ffe58d";
        ctx.font = "900 8px 'Malgun Gothic', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("정예", x, y - 42);
        ctx.restore();
      }
      if (u.alive && u.campaignThreat) {
        ctx.save();
        ctx.strokeStyle = u.campaignThreat === "runner" ? "#ffdf62" : u.campaignThreat === "boss" ? "#ff4d42" : "#c784ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y + 10, u.campaignThreat === "runner" ? 14 : u.campaignThreat === "boss" ? 21 : 17, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#191114";
        ctx.fillRect(x - 24, y - 48, 48, 10);
        ctx.fillStyle = u.campaignThreat === "runner" ? "#ffdf62" : u.campaignThreat === "boss" ? "#ff6f61" : "#d39dff";
        ctx.font = "bold 7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(u.campaignThreat === "runner" ? "침투!" : u.campaignThreat === "boss" ? u.name : "군체 선두", x, y - 40);
        ctx.restore();
      }
      if (u.alive && u.campaignScout) {
        ctx.save();
        ctx.fillStyle = "#160f0ddd";
        ctx.strokeStyle = "#ff9b62";
        ctx.lineWidth = 1;
        ctx.fillRect(x - 29, y - 47, 58, 11);
        ctx.strokeRect(x - 29, y - 47, 58, 11);
        ctx.fillStyle = "#ffd2aa";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(campaignIntroClock < 1400 ? "정찰 중…" : "도주!", x, y - 39);
        ctx.restore();
      }
    };
    const drawCampaignSpeech = (x: number, y: number, text: string) => {
      const width = Math.max(96, text.length * 12 + 24), left = x - width / 2, top = y - 78;
      ctx.save();
      ctx.fillStyle = "#f3ead8";
      ctx.strokeStyle = "#241f1a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(left, top, width, 28, 7);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 6, top + 28);
      ctx.lineTo(x + 2, top + 28);
      ctx.lineTo(x - 2, top + 35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#251f1b";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, top + 14);
      ctx.restore();
    };
    const drawCampaignVent = () => {
      const cx = CAMPAIGN1_VENT.x * S + S / 2 - cam.x,
        cy = CAMPAIGN1_VENT.y * S + S / 2 - cam.y;
      ctx.save();
      ctx.fillStyle = "#171b1d";
      ctx.strokeStyle = campaign1VentOpen ? "#ff765d" : "#656c6e";
      ctx.lineWidth = 3;
      ctx.fillRect(cx - 25, cy - 19, 50, 38);
      ctx.strokeRect(cx - 25, cy - 19, 50, 38);
      ctx.lineWidth = 2;
      for (let y = -12; y <= 12; y += 8) {
        ctx.beginPath();
        ctx.moveTo(cx - 19, cy + y);
        ctx.lineTo(cx + 19, cy + y);
        ctx.stroke();
      }
      if (campaign1VentOpen) {
        ctx.fillStyle = "#ff6f58";
        ctx.fillRect(cx - 4, cy - 27, 8, 5);
      }
      ctx.restore();
    };
    const drawSharedRosterHero = (
      u: Unit,
      definition: (typeof HEROES)[number],
      x: number,
      y: number,
      state: {
        moving: boolean;
        action: boolean;
        actionPose: 0 | 1 | 2 | 3 | 4;
        progress: number;
        down?: boolean;
        hurt?: boolean;
        revive?: boolean;
        selected?: boolean;
      },
    ) => {
      const customC999 = definition.id === "c999",
        plan = heroFramePlan({
          heroId: definition.id,
          direction: u.dir,
          moving: state.moving,
          actionPose: state.action ? state.actionPose : 0,
          actionProgress: state.action ? Math.max(0.001, state.progress) : 0,
          down: state.down,
          customSideSheet: customC999,
        }),
        sheet = plan.sheet === "skill"
          ? heroSkillSheets[definition.faction]
          : plan.sheet === "verticalCombat"
            ? heroVerticalCombatSheets[definition.faction]
          : plan.sheet === "vertical"
            ? heroVerticalSheets[definition.faction]
            : customC999 ? c999Sheet : heroRosterSheets[definition.faction],
        size = customC999
          ? 62
          : definition.stats.bodyRadius > 0.44
            ? 64
            : definition.faction === "bugborn" ? 58 : 56,
        pulse = Math.sin(Math.PI * state.progress),
        walk = state.moving && !state.action ? Math.sin((performance.now() + u.id * 71) / 82) : 0,
        poseX = state.action
          ? u.dir.x * (plan.vertical ? 9 : 5) * pulse
          : state.hurt ? -u.dir.x * 4 * Math.sin(state.progress * Math.PI * 5) : 0,
        poseY = state.action
          ? u.dir.y * (plan.vertical ? 9 : 5) * pulse
          : state.revive ? (1 - state.progress) * 8 : 0,
        tilt = state.action
          ? (plan.vertical ? u.dir.x : plan.facingX) * 0.09 * pulse
          : state.hurt
            ? (plan.vertical ? u.dir.x : plan.facingX) * 0.06 * Math.sin(state.progress * Math.PI * 5)
            : 0;
      if (!sheet?.complete || !sheet.naturalWidth || plan.row < 0) return false;
      const sw = sheet.naturalWidth / plan.cols,
        sh = sheet.naturalHeight / plan.rows;
      rosterFrameCtx.clearRect(0, 0, 160, 160);
      rosterFrameCtx.drawImage(sheet, plan.frame * sw, plan.row * sh, sw, sh, 8, 8, 144, 144);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "#060808aa";
      ctx.beginPath();
      ctx.ellipse(0, 15, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (state.selected) {
        ctx.strokeStyle = definition.faction === "ai" ? "#e68c47" : "#f1cc62";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(0, 14, 23, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.translate(poseX, poseY - Math.abs(walk) * 1.4);
      ctx.rotate(tilt + walk * 0.018);
      if (plan.verticalAction && !plan.useVerticalCombatPose)
        ctx.scale(1 - pulse * 0.045, 1 + pulse * 0.07);
      if (state.revive) ctx.globalAlpha = 0.35 + 0.65 * state.progress;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (state.hurt)
        ctx.filter = "sepia(1) saturate(5) hue-rotate(315deg) brightness(1.25)";
      if (plan.flip) ctx.scale(-1, 1);
      const drawSize = plan.useSkillPose || plan.useVerticalCombatPose ? size * 1.2 : size;
      ctx.drawImage(rosterFrameLayer, -drawSize / 2, -drawSize + 18, drawSize, drawSize);
      ctx.restore();
      if (state.action && u.alive)
        drawRosterEffect(definition, u, x, y, state.progress, state.actionPose);
      return true;
    };
    const drawUnifiedPlayerHero = (u: Unit, x: number, y: number) => {
      const now = performance.now(),
        action = heroAnim !== "locomotion" && now < heroAnimStart + heroAnimDuration,
        combatAction = action && !["hurt", "down", "revive"].includes(heroAnim),
        progress = action ? Math.min(1, (now - heroAnimStart) / Math.max(1, heroAnimDuration)) : 0;
      return drawSharedRosterHero(u, playerDef, x, y, {
        moving: !action && now < heroMoveUntil,
        action: combatAction,
        actionPose: combatAction ? heroActionPose : 0,
        progress,
        down: !u.alive || heroAnim === "down",
        hurt: action && heroAnim === "hurt",
        revive: action && heroAnim === "revive",
        selected: true,
      });
    };
    const drawUnifiedCampaignHero = (
      u: Unit,
      x: number,
      y: number,
      definitionOverride?: (typeof HEROES)[number],
    ) => {
      const definition = definitionOverride ?? HEROES.find((heroDef) => heroDef.id === (u.heroId ?? u.campaignHeroId));
      if (!definition) return false;
      const now = performance.now(),
        action = now < (u.arenaActionUntil ?? 0),
        progress = action
          ? Math.max(0, Math.min(1, (now - (u.arenaActionStartedAt ?? now)) / Math.max(1, u.arenaActionDuration ?? 1)))
          : 0;
      return drawSharedRosterHero(u, definition, x, y, {
        moving: now < (u.arenaMoveUntil ?? 0),
        action,
        actionPose: u.arenaActionSlot ?? 0,
        progress,
      });
    };
    const drawRosterEffect = (
      definition: (typeof HEROES)[number],
      u: Unit,
      x: number,
      y: number,
      p: number,
      slot: 0 | 1 | 2 | 3 | 4,
    ) => {
      const actionKit = heroKit(definition.id),
        d = u.dir,
        side = { x: -d.y, y: d.x },
        pulse = Math.sin(Math.PI * p),
        reach = 24 + 8 * pulse,
        ang = Math.atan2(d.y, d.x);
      ctx.save();
      ctx.translate(x + d.x * 5 * pulse, y + d.y * 5 * pulse - 8);
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = actionKit.accent;
      ctx.fillStyle = actionKit.color;
      ctx.lineWidth = 3;
      const variant =
          slot === 1
            ? actionKit.skill1.mode
            : slot === 2
              ? actionKit.skill2.mode
              : slot === 3
                ? actionKit.drill.mode
                : slot === 4 ? actionKit.ultimate.mode : actionKit.basic.mode;
      if (slot === 3) {
        ctx.rotate(ang);
        ctx.globalAlpha = 0.85 * (1 - p * 0.45);
        ctx.setLineDash([7, 5]);
        for (let lane = -1; lane <= 1; lane++) {
          ctx.beginPath();
          ctx.moveTo(8, lane * 7);
          ctx.lineTo(
            reach + 28,
            lane *
              (variant === "widePush" || variant === "shieldLane" ? 13 : 5),
          );
          ctx.stroke();
        }
        ctx.setLineDash([]);
        for (let i = 1; i <= 4; i++)
          ctx.strokeRect(i * 11, -3 - (i % 2) * 4, 7, 7);
        ctx.restore();
        return;
      }
      if (slot === 4) {
        ctx.globalAlpha = 0.5 + 0.35 * pulse;
        for (let i = 0; i < 8; i++) {
          const q = (i * Math.PI) / 4 + p * 0.7,
            r = 24 + 10 * pulse;
          ctx.beginPath();
          ctx.moveTo(Math.cos(q) * r * 0.55, Math.sin(q) * r * 0.55);
          ctx.lineTo(Math.cos(q) * r, Math.sin(q) * r);
          ctx.stroke();
        }
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + 10 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (slot === 2) {
        if (
          [
            "electricAura",
            "groupHeal",
            "armorOrder",
            "nightPatrol",
            "weldCone",
          ].includes(variant)
        ) {
          ctx.globalAlpha = 0.72;
          for (let ring = 1; ring <= 3; ring++) {
            ctx.beginPath();
            ctx.arc(0, 8, ring * (10 + 5 * pulse), 0, Math.PI * 2);
            ctx.stroke();
          }
          for (let i = 0; i < 4; i++) {
            const q = (i * Math.PI) / 2;
            ctx.fillRect(
              Math.cos(q) * reach * 0.7 - 2,
              8 + Math.sin(q) * reach * 0.7 - 7,
              4,
              14,
            );
          }
        } else if (["acidMark", "silkPull"].includes(variant)) {
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(d.x * 8, d.y * 8);
          ctx.lineTo(d.x * (reach + 22), d.y * (reach + 22));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(
            d.x * (reach + 22),
            d.y * (reach + 22),
            9 + 5 * pulse,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        } else {
          ctx.globalAlpha = 0.75;
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(
              -d.x * (12 + i * 3) + side.x * i * 5,
              -d.y * (12 + i * 3) + side.y * i * 5,
            );
            ctx.lineTo(
              -d.x * (38 + i * 5) + side.x * i * 8,
              -d.y * (38 + i * 5) + side.y * i * 8,
            );
            ctx.stroke();
          }
        }
        ctx.restore();
        return;
      }
      if (actionKit.motion === "heavy") {
        ctx.translate(d.x * reach, d.y * reach);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.72 * (1 - p);
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(0, i * 8, 10 + 8 * pulse, -1.1, 1.1);
          ctx.stroke();
        }
      } else if (actionKit.motion === "sprayer") {
        for (let i = -2; i <= 2; i++) {
          ctx.globalAlpha = 0.85 - Math.abs(i) * 0.12;
          ctx.beginPath();
          ctx.arc(
            d.x * reach + side.x * i * 7,
            d.y * reach + side.y * i * 7,
            3 + Math.abs(i % 2),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      } else if (actionKit.motion === "guardian") {
        ctx.translate(d.x * reach, d.y * reach);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.8 * (1 - p * 0.55);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, 13 + i * 7, -1.2, 1.2);
          ctx.stroke();
        }
      } else if (actionKit.motion === "beast") {
        ctx.translate(d.x * reach, d.y * reach);
        ctx.rotate(ang);
        for (const y2 of [-7, 7]) {
          ctx.beginPath();
          ctx.moveTo(-18, y2);
          ctx.lineTo(8 + pulse * 12, y2 * 0.4);
          ctx.stroke();
        }
      } else if (actionKit.motion === "spitter") {
        ctx.beginPath();
        ctx.arc(d.x * reach, d.y * reach, 5 + 3 * pulse, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = 0.5 / i;
          ctx.beginPath();
          ctx.arc(
            d.x * (reach - i * 7),
            d.y * (reach - i * 7),
            3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      } else if (actionKit.motion === "flutter") {
        ctx.globalAlpha = 0.65 * (1 - p * 0.4);
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side.x * sign * 8, side.y * sign * 8);
          ctx.quadraticCurveTo(
            -d.x * 16 + side.x * sign * 18,
            -d.y * 16 + side.y * sign * 18,
            -d.x * 32 + side.x * sign * 10,
            -d.y * 32 + side.y * sign * 10,
          );
          ctx.stroke();
        }
      } else if (actionKit.motion === "weaver") {
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(side.x * i * 4, side.y * i * 4);
          ctx.quadraticCurveTo(
            d.x * reach * 0.5 + side.x * i * 8,
            d.y * reach * 0.5 + side.y * i * 8,
            d.x * reach + side.x * i * 6,
            d.y * reach + side.y * i * 6,
          );
          ctx.stroke();
        }
      } else if (actionKit.motion === "piston") {
        ctx.translate(d.x * reach, d.y * reach);
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.75 - i * 0.14;
          ctx.beginPath();
          ctx.arc(-d.x * i * 7, -d.y * i * 7, 5 + i * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (actionKit.motion === "braced") {
        ctx.rotate(ang);
        ctx.globalAlpha = 0.75 * (1 - p * 0.5);
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(18, i * 8);
          ctx.lineTo(reach + 16, i * 4);
          ctx.stroke();
        }
      } else if (actionKit.motion === "welder") {
        ctx.translate(d.x * reach, d.y * reach);
        for (let i = 0; i < 8; i++) {
          const a = i * 0.8 + p * 9;
          ctx.fillRect(Math.cos(a) * (8 + i), Math.sin(a) * (8 + i), 3, 3);
        }
      } else if (actionKit.motion === "bureaucrat") {
        ctx.translate(d.x * reach, d.y * reach);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.72 * (1 - p * 0.35);
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(-12, -16, 24, 32);
        ctx.setLineDash([]);
        for (let i = -1; i <= 1; i++)
          ctx.fillRect(-6 - i * 4, -2 + i * 7, 12, 2);
      }
      ctx.restore();
    };
    const drawHeroReadabilityGlow = (
      u: Unit,
      definition: (typeof HEROES)[number],
      x: number,
      y: number,
      emphasized = false,
    ) => {
      const actionKit = heroKit(definition.id),
        teamColor = u.team === "blue" ? "#54dfef" : "#ff6658",
        radius = emphasized ? 31 : 29;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const glow = ctx.createRadialGradient(x, y + 7, 2, x, y + 7, radius);
      glow.addColorStop(0, actionKit.color + (emphasized ? "66" : "52"));
      glow.addColorStop(0.55, actionKit.accent + (emphasized ? "2b" : "22"));
      glow.addColorStop(1, actionKit.color + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 32, y - 24, 64, 52);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = teamColor + (emphasized ? "b8" : "96");
      ctx.shadowColor = actionKit.accent + "99";
      ctx.shadowBlur = emphasized ? 5 : 4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 20, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
    heroSpriteFilter = (
      u: Unit,
      definition: (typeof HEROES)[number],
      emphasized = false,
    ) => {
      const actionKit = heroKit(definition.id),
        teamColor = u.team === "blue" ? "#54dfef" : "#ff6658";
      return `brightness(${emphasized ? 1.09 : 1.12}) saturate(1.08) contrast(1.04) drop-shadow(0 0 2px ${teamColor}aa) drop-shadow(0 0 ${emphasized ? 4 : 5}px ${actionKit.color}88)`;
    };
    const drawTeamMarker = (u: Unit, x: number, y: number) => {
        if (!u.alive || u.role !== "hero") return;
        const color = u.team === "blue" ? "#54dfef" : "#ff5e51",
          top = u.role === "hero" ? y - 64 : y - 46;
        ctx.save();
        ctx.fillStyle = "#071012e8";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 5, top);
        ctx.lineTo(x + 5, top);
        ctx.lineTo(x, top + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (u.role === "hero") {
          const label = u.team === "blue" ? "아군" : "적군";
          ctx.fillStyle = "#071012e8";
          ctx.fillRect(x - 20, top - 12, 40, 10);
          ctx.strokeRect(x - 20, top - 12, 40, 10);
          ctx.fillStyle = color;
          ctx.font = "bold 7px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(label, x, top - 4);
        }
        ctx.restore();
      },
      drawUltimateMarker = (u: Unit, x: number, y: number) => {
        const remaining = (u.ultimateLabelUntil ?? 0) - performance.now();
        if (!u.alive || remaining <= 0) return;
        const age = 1 - Math.min(1, remaining / 1150),
          scale = 0.86 + Math.sin(Math.min(1, age * 2.4) * Math.PI) * 0.25,
          alpha = Math.min(1, remaining / 220);
        ctx.save();
        ctx.translate(x, y - 79 - Math.sin(age * Math.PI) * 8);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#130707ee";
        ctx.strokeStyle = "#ffd66b";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-29, -14, 58, 28, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff1ad";
        ctx.font = "900 19px 'Malgun Gothic', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("결전", 0, 0);
        ctx.restore();
      },
      drawTacticalBuffAura = (u: Unit, x: number, y: number, now: number) => {
        if (!u.alive || (u.role !== "hero" && u.role !== "minion")) return;
        const role: TacticalBuffRole | null = now < (u.tacticalRecoveryUntil ?? 0)
            ? "recovery"
            : u.role === "minion" && now < tacticalStates[u.team].defenseUntil
              ? "defense"
              : u.role === "minion" && now < tacticalStates[u.team].offenseUntil
                ? "offense"
                : null;
        if (!role) return;
        const visual = tacticalBuffVisual(u.faction, role),
          pulse = 0.78 + Math.sin(now / 115 + u.id * 0.71) * 0.18,
          orbit = now / (role === "defense" ? 520 : role === "recovery" ? 440 : 330) + u.id * 0.43;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const bodyGlow = ctx.createRadialGradient(x, y - 8, 2, x, y - 8, 31);
        bodyGlow.addColorStop(0, `${visual.auraColor}99`);
        bodyGlow.addColorStop(0.5, `${visual.auraColor}42`);
        bodyGlow.addColorStop(1, `${visual.auraColor}00`);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = bodyGlow;
        ctx.beginPath();
        ctx.arc(x, y - 8, 31, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.34 + pulse * 0.18;
        ctx.fillStyle = visual.auraColor;
        ctx.beginPath();
        ctx.ellipse(x, y + 13, 23, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.88;
        ctx.strokeStyle = visual.auraColor;
        ctx.lineWidth = role === "defense" ? 2.5 : 2;
        ctx.setLineDash(role === "defense" ? [7, 3] : role === "recovery" ? [2, 4] : []);
        ctx.lineDashOffset = -now / 85;
        ctx.beginPath();
        ctx.ellipse(x, y + 13, 20 + pulse * 2, 7 + pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = visual.sparkColor;
        for (let index = 0; index < 4; index++) {
          const angle = orbit + index * Math.PI / 2,
            sparkX = x + Math.cos(angle) * (18 + (index % 2) * 3),
            sparkY = y - 7 + Math.sin(angle) * (13 + (index % 2) * 2);
          ctx.globalAlpha = 0.55 + ((index + Math.floor(now / 140)) % 2) * 0.35;
          ctx.fillRect(Math.round(sparkX) - 1, Math.round(sparkY) - 1, role === "offense" ? 3 : 2, role === "offense" ? 3 : 2);
        }
        ctx.restore();
        ctx.save();
        ctx.translate(x + 18, y - 22);
        ctx.fillStyle = visual.sparkColor;
        ctx.strokeStyle = "#071012";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = visual.auraColor;
        ctx.shadowBlur = 7;
        ctx.beginPath();
        if (visual.badge === "shield") {
          ctx.moveTo(0, -6); ctx.lineTo(6, -3); ctx.lineTo(4, 4); ctx.lineTo(0, 8); ctx.lineTo(-4, 4); ctx.lineTo(-6, -3);
        } else if (visual.badge === "plus") {
          ctx.moveTo(-2, -7); ctx.lineTo(2, -7); ctx.lineTo(2, -2); ctx.lineTo(7, -2); ctx.lineTo(7, 2); ctx.lineTo(2, 2); ctx.lineTo(2, 7); ctx.lineTo(-2, 7); ctx.lineTo(-2, 2); ctx.lineTo(-7, 2); ctx.lineTo(-7, -2); ctx.lineTo(-2, -2);
        } else {
          ctx.moveTo(0, -7); ctx.lineTo(7, 1); ctx.lineTo(3, 1); ctx.lineTo(3, 7); ctx.lineTo(-3, 7); ctx.lineTo(-3, 1); ctx.lineTo(-7, 1);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      },
      drawUnit = (u: Unit) => {
        const now = performance.now(),
          j = u === hero ? jumpVisual : null,
          jumpP = j
            ? Math.max(
                0,
                Math.min(1, (now - j.start) / j.duration),
              )
            : 1,
          arenaMoveP = u.arenaMoveStartedAt !== undefined && u.arenaMoveDuration
            ? Math.max(0, Math.min(1, (now - u.arenaMoveStartedAt) / u.arenaMoveDuration))
            : 1,
          arenaMoveEase = arenaMoveP,
          arenaMoving = arenaMoveP < 1 && u.arenaMoveFromX !== undefined && u.arenaMoveFromY !== undefined && u.arenaMoveToX !== undefined && u.arenaMoveToY !== undefined,
          arenaX = arenaMoving
            ? u.arenaMoveFromX! + (u.arenaMoveToX! - u.arenaMoveFromX!) * arenaMoveEase
            : u.x * S + S / 2,
          arenaY = arenaMoving
            ? u.arenaMoveFromY! + (u.arenaMoveToY! - u.arenaMoveFromY!) * arenaMoveEase
            : u.y * S + S / 2,
          worldX = j
            ? j.fromX + (j.toX - j.fromX) * jumpP
            : arenaMoving
              ? arenaX
            : u === hero
              ? heroWorld.x
              : u.x * S + S / 2,
          worldY =
            (j
              ? j.fromY + (j.toY - j.fromY) * jumpP
              : arenaMoving
                ? arenaY
              : u === hero
                ? heroWorld.y
                : u.y * S + S / 2) - (j ? Math.sin(Math.PI * jumpP) * 28 : 0),
          x = worldX - cam.x,
          y = worldY - cam.y;
        if (u === hero) {
          if (playerDef.id === "yoo-seungcheon") drawYoo(u, x, y);
          else {
            drawHeroReadabilityGlow(u, playerDef, x, y, true);
            ctx.save();
            ctx.filter = heroSpriteFilter(u, playerDef, true);
            drawUnifiedPlayerHero(u, x, y);
            ctx.restore();
          }
          if (u.alive) {
            ctx.save();
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
            ctx.filter = "none";
            ctx.setLineDash([]);
            ctx.lineWidth = 1;
            ctx.fillStyle = "#090d0f";
            ctx.fillRect(x - 46, y - 51, 22, 10);
            ctx.fillStyle = "#d9b85b";
            ctx.fillRect(x - 46, y - 51, 2, 10);
            ctx.fillStyle = "#ffe58b";
            ctx.font = "bold 7px Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`LV.${u.level}`, x - 34, y - 46);
            ctx.fillStyle = "#101415";
            ctx.fillRect(x - 22, y - 49, 44, 7);
            ctx.fillStyle = "#54dfef";
            ctx.fillRect(x - 20, y - 47, (40 * u.hp) / u.maxHp, 3);
            ctx.restore();
            drawTeamMarker(u, x, y);
            drawUltimateMarker(u, x, y);
            if (isCampaign && campaignSpeech) drawCampaignSpeech(x, y, campaignSpeech);
          }
          return;
        }
        if (!u.alive && u.role !== "minion") return;
        if (u.role === "minion") drawMinion(u, x, y);
        else if (u.role === "scientist") {
          ctx.save();
          const scientistImage = scientistImages[u.scientistIndex ?? 0];
          if (scientistImage.complete && scientistImage.naturalWidth) {
            ctx.filter = "drop-shadow(0 2px 2px #000b)";
            ctx.drawImage(scientistImage, x - 13, y - 32, 26, 52);
          } else {
            ctx.fillStyle = "#e9e2d4";
            ctx.fillRect(x - 8, y - 18, 16, 27);
            ctx.fillStyle = "#78f0a0";
            ctx.fillRect(x + 7, y, 7, 9);
          }
          ctx.restore();
        }
        else {
          const campaignHeroDefinition = HEROES.find(
            (heroDef) => heroDef.id === (u.heroId ?? u.campaignHeroId),
          );
          let renderedHero = false;
          if (campaignHeroDefinition) {
            drawHeroReadabilityGlow(u, campaignHeroDefinition, x, y);
            ctx.save();
            ctx.filter = heroSpriteFilter(u, campaignHeroDefinition);
            renderedHero = campaignHeroDefinition.id === "yoo-seungcheon"
              ? drawYoo(u, x, y)
              : drawUnifiedCampaignHero(u, x, y, campaignHeroDefinition);
            ctx.restore();
          }
          if (!renderedHero) {
            ctx.strokeStyle = u.faction === "ai" ? "#e58a43" : "#a7c95a";
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 16, y - 20, 32, 40);
            ctx.fillStyle = u.faction === "ai" ? "#5d6667" : "#67525e";
            ctx.fillRect(x - 11, y - 8, 22, 25);
            ctx.fillStyle = u.faction === "ai" ? "#737a78" : "#8f795a";
            ctx.fillRect(x - 8, y - 19, 16, 12);
            ctx.fillStyle = "#292a28";
            ctx.fillRect(x - 10, y - 23, 20, 6);
            ctx.fillStyle = u.team === "blue" ? "#65e5f0" : "#ff7560";
            ctx.fillRect(x + u.dir.x * 13 - 4, y + u.dir.y * 13 - 4, 8, 8);
          }
        }
        if (u.alive) {
          drawTacticalBuffAura(u, x, y, now);
          const width = u.role === "minion" ? 24 : u.role === "scientist" ? 34 : 30,
            barY = u.role === "minion" ? y - 39 : u.role === "scientist" ? y - 37 : y - 31,
            teamColor = u.team === "blue" ? "#54dfef" : "#ff5e51";
          ctx.fillStyle = "#101415";
          ctx.fillRect(x - width / 2 - 1, barY - 1, width + 2, 5);
          ctx.fillStyle = teamColor;
          ctx.fillRect(x - width / 2, barY, (width * u.hp) / u.maxHp, 3);
          if (u.role === "minion") {
            ctx.fillStyle = u.level >= 5
              ? "#fff2a8"
              : u.level >= 4
                ? "#ffb76b"
                : u.level >= 3
                  ? "#ffe06a"
                  : u.level >= 2
                    ? "#d8f39a"
                    : "#d6d9d7";
            ctx.font = `bold ${u.level >= 5 ? 8 : 7}px sans-serif`;
            ctx.textAlign = "right";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`LV.${u.level}`, x - width / 2 - 3, barY + 3);
          }
          if (u.role === "scientist" || u.campaignHeroId) {
            ctx.fillStyle = "#f4f0e4";
            ctx.font = "bold 8px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(
              u.role === "hero" ? `${u.name} · LV.${u.level}` : u.name,
              x,
              barY - 5,
            );
          }
          drawTeamMarker(u, x, y);
          drawUltimateMarker(u, x, y);
          if (attackTarget?.kind === "unit" && attackTarget.id === u.id) {
            ctx.save();
            ctx.strokeStyle = "#ffc24f";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.ellipse(x, y + 12, 17, 6, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      };
    const drawTurret = (t: Turret) => {
      if (t.hp <= 0) return;
      const def = buildDef(t.kind),
        blocker = def.category === "blocker",
        supportDevice = def.category === "support",
        controlDevice = Boolean(def.control),
        x = t.x * S + S / 2 - cam.x,
        y = t.y * S + S / 2 - cam.y,
        img = buildImages[t.kind],
        hover = cursorTile(),
        selected =
          (buildMode === "demolish" || buildMode === "upgrade") &&
          hover.x === t.x &&
          hover.y === t.y,
        size = blocker ? 48 : supportDevice ? (def.faction === "bugborn" ? 60 : 64) : controlDevice ? (def.faction === "bugborn" ? 58 : 56) : def.faction === "bugborn" ? 55 : 50,
        dw = blocker ? 60 : size,
        dh = size,
        top = y - dh + 15;
      ctx.save();
      if (supportDevice && t.built) {
        const pulse = 0.5 + Math.sin(performance.now() / 260 + t.id) * 0.16,
          color = t.faction === "human" ? "#63e9ff" : t.faction === "bugborn" ? "#b7ef61" : "#ff9b55";
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -performance.now() / 100;
        ctx.beginPath();
        ctx.ellipse(x, y + 11, 24, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      if (controlDevice && t.built) {
        const controlColor = def.control?.kind === "acid" ? "#b8ed36" : def.control?.kind === "tether" ? "#ff9948" : "#63e9ff",
          pulse = 0.45 + Math.sin(performance.now() / 150 + t.id) * 0.18;
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = controlColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -performance.now() / 70;
        ctx.beginPath();
        ctx.ellipse(x, y + 11, 23, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      if (selected) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle =
          t.team === "blue" ? FACTIONS[t.faction].color : "#ef6756";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y + 11, blocker ? 27 : 21, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (img?.complete && img.naturalWidth) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        if (t.team === "red")
          ctx.filter =
            "saturate(.85) brightness(.8) drop-shadow(0 0 2px #d95345)";
        const fireAge = turretStats(t).cooldown - t.cool,
          recoilProgress = !blocker && fireAge >= 0 && fireAge < 180 ? fireAge / 180 : 1,
          recoil = recoilProgress < 1 ? Math.sin(recoilProgress * Math.PI) : 0;
        ctx.save();
        ctx.translate(x, top + dh);
        ctx.scale(1 + recoil * 0.035, 1 - recoil * 0.045);
        ctx.translate(0, recoil * 2);
        ctx.drawImage(img, -dw / 2, -dh, dw, dh);
        ctx.restore();
        ctx.filter = "none";
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.fillStyle = blocker ? "#76513a" : FACTIONS[t.faction].color;
        ctx.fillRect(x - 12, y - 17, 24, 27);
      }
      const teamColor = t.team === "blue" ? "#54dfef" : "#ff5e51";
      ctx.fillStyle = teamColor;
      ctx.fillRect(x - dw / 2 + 3, top + dh - 5, dw - 6, 3);
      if (
        attackTarget?.kind === "turret" &&
        attackTarget.x === t.x &&
        attackTarget.y === t.y
      ) {
        ctx.strokeStyle = "#ffc24f";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.ellipse(x, y + 11, dw * 0.38, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (t.level >= 2) {
        ctx.fillStyle = "#d9b84f";
        if (blocker) {
          ctx.fillRect(x - dw / 2 + 7, y - 19, dw - 14, 4);
          ctx.fillRect(x - 4, y - 26, 8, 7);
        } else {
          ctx.fillRect(x - 15, top + 8, 7, 7);
          ctx.fillRect(x + 8, top + 8, 7, 7);
        }
        ctx.fillStyle = "#111";
        ctx.fillRect(x - 8, top - 9, 16, 8);
        ctx.fillStyle = "#f1d26a";
        ctx.font = "bold 7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("LV2", x, top - 3);
      }
      if (t.hp < t.maxHp || selected || t.demolish !== undefined || t.upgrade) {
        ctx.fillStyle = "#151718dd";
        ctx.fillRect(x - 16, top - 6, 32, 4);
        ctx.fillStyle =
          t.team === "blue" ? FACTIONS[t.faction].color : "#f46b59";
        ctx.fillRect(x - 16, top - 6, (32 * t.hp) / t.maxHp, 4);
      }
      if (t.demolish !== undefined || t.upgrade) {
        const progress =
          t.demolish !== undefined
            ? 1 - t.demolish / 1000
            : 1 - (t.upgrade?.remaining ?? 0) / 1500;
        ctx.fillStyle = "#0c0d0ddd";
        ctx.fillRect(x - 21, y + 14, 42, 6);
        ctx.fillStyle = t.upgrade ? "#6ee5df" : "#e1b44e";
        ctx.fillRect(x - 19, y + 16, 38 * progress, 2);
      }
      ctx.restore();
    };
    const drawTacticalAreas = () => {
      const now = performance.now();
      for (const event of tacticalAreas) {
        if (
          !visible(event.x, event.y) ||
          (event.team !== "blue" && isSecretTunnel && (
            battlePhase === "prepare" || !openForTeam(event.x, event.y, "blue")
          ))
        ) continue;
        const definition = tacticalDefinition(event.faction, "area"),
          x = event.x * S + S / 2 - cam.x,
          y = event.y * S + S / 2 - cam.y,
          radius = (definition.radius ?? 2) * S,
          warningEnd = event.startedAt + (definition.warningMs ?? 0),
          warningProgress = Math.max(0, Math.min(1, (now - event.startedAt) / Math.max(1, warningEnd - event.startedAt)));
        if (event.faction === "ai") {
          const impactProgress = event.impactAt
            ? Math.max(0, Math.min(1, (now - event.impactAt) / 520))
            : 0;
          ctx.save();
          ctx.translate(x, y);
          ctx.globalCompositeOperation = "screen";
          if (event.impactAt) {
            const fade = 1 - impactProgress;
            ctx.globalAlpha = fade * 0.9;
            const beam = ctx.createLinearGradient(-radius, 0, radius, 0);
            beam.addColorStop(0, "#ff6a4500");
            beam.addColorStop(0.35, "#ff6a4577");
            beam.addColorStop(0.5, "#fff5d8");
            beam.addColorStop(0.65, "#ff6a4577");
            beam.addColorStop(1, "#ff6a4500");
            ctx.fillStyle = beam;
            ctx.fillRect(-radius, -viewHeight, radius * 2, viewHeight * 2);
            ctx.strokeStyle = impactProgress < 0.35 ? "#ffffff" : definition.color;
            ctx.lineWidth = Math.max(2, 7 * fade);
            for (let ring = 0; ring < 3; ring++) {
              const size = radius * (0.25 + impactProgress * (1.1 + ring * 0.22));
              ctx.globalAlpha = fade * (0.9 - ring * 0.18);
              ctx.strokeRect(-size, -size, size * 2, size * 2);
            }
            ctx.fillStyle = "#ffd9bd";
            for (let shard = 0; shard < 14; shard++) {
              const angle = (shard / 14) * Math.PI * 2,
                distance = radius * impactProgress * (0.45 + (shard % 4) * 0.16),
                size = 2 + (shard % 3);
              ctx.fillRect(
                Math.cos(angle) * distance - size / 2,
                Math.sin(angle) * distance - size / 2,
                size,
                size,
              );
            }
          } else {
            const pulse = 0.72 + Math.sin(now / 75) * 0.18,
              boxRadius = radius * (1.28 - warningProgress * 0.28);
            ctx.globalAlpha = 0.2 + warningProgress * 0.22;
            ctx.fillStyle = definition.color;
            ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = warningProgress > 0.78 ? "#fff0dc" : definition.color;
            ctx.lineWidth = 2 + warningProgress * 2;
            ctx.setLineDash([8, 5]);
            ctx.strokeRect(-boxRadius, -boxRadius, boxRadius * 2, boxRadius * 2);
            ctx.setLineDash([]);
            for (let line = -1; line <= 1; line++) {
              const offset = line * radius * 0.55;
              ctx.globalAlpha = 0.32 + warningProgress * 0.48;
              ctx.beginPath();
              ctx.moveTo(-radius, offset); ctx.lineTo(radius, offset);
              ctx.moveTo(offset, -radius); ctx.lineTo(offset, radius);
              ctx.stroke();
            }
            ctx.globalAlpha = 0.95;
            ctx.beginPath();
            ctx.moveTo(-18, 0); ctx.lineTo(18, 0);
            ctx.moveTo(0, -18); ctx.lineTo(0, 18);
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.3 + Math.sin(now / 70) * 0.08;
        ctx.fillStyle = definition.color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = definition.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 6]);
        ctx.beginPath();
        ctx.arc(x, y, radius * (1.35 - warningProgress * 0.35), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y);
        ctx.moveTo(x, y - 13); ctx.lineTo(x, y + 13);
        ctx.stroke();
        ctx.restore();
      }
      if (tacticalAim === "area") {
        const tile = cursorTile(), definition = tacticalDefinition(playerDef.faction, "area"),
          x = tile.x * S + S / 2 - cam.x, y = tile.y * S + S / 2 - cam.y,
          valid = Boolean(seen[tile.y]?.[tile.x] && visible(tile.x, tile.y) && open(tile.x, tile.y) && Math.hypot(tile.x - hero.x, tile.y - hero.y) <= 12);
        ctx.save();
        ctx.strokeStyle = valid ? definition.color : "#ef6658";
        ctx.fillStyle = valid ? `${definition.color}2f` : "#ef66582f";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, (definition.radius ?? 2) * S, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    };
    const drawFields = () => {
      const now = performance.now();
      for (const f of fields) {
        const fieldX = Math.floor(f.x), fieldY = Math.floor(f.y), fieldTeam = f.team ?? "blue";
        if (
          !visible(fieldX, fieldY) ||
          (fieldTeam !== "blue" && isSecretTunnel && (
            battlePhase === "prepare" || !openForTeam(fieldX, fieldY, "blue")
          ))
        ) continue;
        const x = f.x * S + S / 2 - cam.x,
          y = f.y * S + S / 2 - cam.y,
          r = f.radius * S,
          p = 1 - f.life / f.maxLife,
          pulse = 0.72 + 0.18 * Math.sin(now / 95);
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = Math.min(1, f.life / 450) * 0.72;
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = f.color;
        ctx.fillStyle = f.color;
        ctx.lineWidth = 3;
        if (f.kind === "electric") {
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4 + now / 420;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
            ctx.lineTo(
              Math.cos(a + 0.12) * r * 0.5,
              Math.sin(a + 0.12) * r * 0.5,
            );
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.stroke();
          }
        } else if (f.kind === "acid") {
          ctx.globalAlpha *= 0.58;
          ctx.beginPath();
          ctx.ellipse(0, 5, r, r * 0.56, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.85;
          for (let i = 0; i < 7; i++) {
            const a = i * 2.1;
            ctx.beginPath();
            ctx.arc(
              Math.cos(a) * r * 0.55,
              5 + Math.sin(a) * r * 0.28,
              3 + (i % 3) * 2 + p * 5,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          }
        } else if (f.kind === "web") {
          for (let ring = 1; ring <= 4; ring++) {
            ctx.beginPath();
            ctx.arc(0, 0, (r * ring) / 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI) / 5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.stroke();
          }
        } else if (f.kind === "molt") {
          ctx.rotate(now / 1400);
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            ctx.save();
            ctx.rotate(a);
            ctx.strokeRect(r * 0.25, -8, r * 0.6, 16);
            ctx.restore();
          }
        } else if (f.kind === "lockdown") {
          ctx.setLineDash([9, 6]);
          ctx.strokeRect(-r, -r * 0.55, r * 2, r * 1.1);
          ctx.setLineDash([]);
          for (let i = -2; i <= 2; i++) {
            ctx.fillRect(i * r * 0.34 - 3, -r * 0.55, 6, r * 1.1);
          }
        } else if (f.kind === "reject") {
          const d = f.dir ?? { x: 1, y: 0 };
          ctx.rotate(Math.atan2(d.y, d.x));
          ctx.globalAlpha = 0.72 + 0.18 * Math.sin(now / 70);
          ctx.fillRect(-5, -r, 10, r * 2);
          ctx.strokeStyle = "#eaffff";
          ctx.strokeRect(-9, -r, 18, r * 2);
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(-16, -r * 0.86, 32, r * 1.72);
          ctx.setLineDash([]);
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(-22, i * r * 0.32);
            ctx.lineTo(-9, i * r * 0.32);
            ctx.stroke();
          }
        } else {
          ctx.rotate(now / 850);
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            ctx.save();
            ctx.translate(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65);
            ctx.rotate(-now / 850);
            ctx.fillRect(-9, -2, 18, 4);
            ctx.fillRect(-2, -9, 4, 18);
            ctx.restore();
          }
        }
        if (f.kind !== "reject") {
          ctx.globalAlpha = 0.9 * pulse;
          ctx.beginPath();
          ctx.arc(
            0,
            0,
            r * (0.88 + 0.07 * Math.sin(now / 140)),
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        ctx.restore();
      }
    };
    const drawGroundMines = () => {
      const now = performance.now();
      for (const mine of groundMines) {
        if (mine.team !== "blue" || !seen[mine.y]?.[mine.x]) continue;
        const x = mine.x * S + S / 2 - cam.x,
          y = mine.y * S + S / 2 - cam.y,
          armed = now >= mine.armedAt,
          remaining = Math.max(0, mine.detonateAt - now),
          urgent = remaining <= 850,
          pulse = 0.65 + Math.sin(now / (urgent ? 55 : 125)) * 0.25;
        ctx.save();
        ctx.translate(x, y + 8);
        ctx.fillStyle = "#070a0bba";
        ctx.beginPath();
        ctx.ellipse(0, 5, 17, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3d4645";
        ctx.strokeStyle = armed ? (urgent ? "#ff694f" : "#edbd4d") : "#78d8d0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = armed ? `rgba(255,88,62,${pulse})` : "#73dfd4";
        ctx.fillRect(-2, -3, 4, 4);
        if (urgent) {
          ctx.globalAlpha = Math.max(0.2, pulse);
          ctx.strokeStyle = "#ff7c55";
          ctx.beginPath();
          ctx.arc(0, 0, 1.9 * S, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    };
    const drawFog = () => {
        fctx.globalCompositeOperation = "source-over";
        fctx.globalAlpha = 1;
        fctx.filter = "none";
        fctx.clearRect(0, 0, viewWidth, viewHeight);
        fctx.fillStyle = "#000";
        fctx.fillRect(0, 0, viewWidth, viewHeight);
        fctx.save();
        fctx.globalCompositeOperation = "destination-out";
        fctx.filter = "blur(20px)";
        fctx.beginPath();
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++)
            if (seen[y][x])
              fctx.rect(x * S - cam.x - 3, y * S - cam.y - 3, S + 6, S + 6);
        fctx.fillStyle = "rgba(0,0,0,.96)";
        fctx.fill();
        fctx.restore();
        fctx.save();
        fctx.filter = "blur(15px)";
        fctx.beginPath();
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++)
            if (seen[y][x]) fctx.rect(x * S - cam.x, y * S - cam.y, S, S);
        fctx.fillStyle = "rgba(48,52,54,.66)";
        fctx.fill();
        fctx.restore();
        fctx.globalCompositeOperation = "destination-out";
        fctx.filter = "none";
        const cutVisionHole = (px: number, py: number, r: number) => {
          const g = fctx.createRadialGradient(px, py, r * 0.55, px, py, r);
          g.addColorStop(0, "rgba(0,0,0,1)");
          g.addColorStop(0.72, "rgba(0,0,0,.93)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          fctx.fillStyle = g;
          fctx.beginPath();
          fctx.arc(px, py, r, 0, Math.PI * 2);
          fctx.fill();
        };
        cutVisionHole(
          ALLY.x * S + S / 2 - cam.x,
          ALLY.y * S + S / 2 - cam.y,
          S * (allyCoreVisionRadius + 0.4),
        );
        for (const u of visionSources()) {
          const visualWorld = interpolatedUnitWorld(u);
          cutVisionHole(
            visualWorld.x - cam.x,
            visualWorld.y - cam.y,
            S * (visionRadius(u) + 0.4),
          );
        }
        fctx.globalCompositeOperation = "source-over";
        ctx.drawImage(fog, 0, 0);
      },
      drawAimGuide = () => {
        if (!aimingSkill || !hero.alive) return;
        const w = cursorWorld(),
          d = unitVector(w.x - heroWorld.x, w.y - heroWorld.y),
          mode = aimingSkill === 2 ? kit.skill2.mode : kit.ultimate.mode,
          selfCast = ["electricAura", "groupHeal", "armorOrder", "nightPatrol"].includes(mode),
          range = aimingSkill === 2 ? kit.skill2.range : kit.ultimate.range,
          maxReach = range * S,
          reach = openRayReach(d, range),
          x = heroWorld.x - cam.x,
          y = heroWorld.y - cam.y,
          pointerDistance = Math.hypot(w.x - heroWorld.x, w.y - heroWorld.y),
          guideReach = selfCast ? pointerDistance : Math.min(pointerDistance, maxReach),
          validReach = selfCast ? guideReach : Math.min(reach, guideReach),
          ex = x + d.x * guideReach,
          ey = y + d.y * guideReach,
          bx = x + d.x * validReach,
          by = y + d.y * validReach,
          blocked = !selfCast && validReach < guideReach - 1;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.setLineDash([8, 5]);
        ctx.strokeStyle = "#77e8f4aa";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = "#d7fbff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + d.x * 18, y + d.y * 18);
        ctx.lineTo(bx, by);
        ctx.stroke();
        if (selfCast) {
          const radius = mode === "electricAura" ? 2.4 : mode === "armorOrder" ? 3.5 : mode === "nightPatrol" ? 2.6 : range;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(x, y, radius * S, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = blocked ? "#f06a5a" : "#64e3ef";
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#071012dd";
        ctx.fillRect(x - 48, y - 60, 96, 19);
        ctx.fillStyle = "#d8f8fa";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          aimingSkill === 2
            ? `2 떼면 ${playerDef.skills[1]}${selfCast ? " · 주변 발동" : ""}`
            : `3 떼면 ${playerDef.skills[3]}`,
          x,
          y - 47,
        );
        ctx.restore();
      },
      drawScaledWorldActor = (worldX: number, worldY: number, draw: () => void) => {
        if (battleScale === 1) {
          draw();
          return;
        }
        const screenX = worldX - cam.x,
          screenY = worldY - cam.y;
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.scale(battleScale, battleScale);
        ctx.translate(-screenX, -screenY);
        draw();
        ctx.restore();
      },
      drawTunnelAccessOverlay = (sx: number, sy: number, ex: number, ey: number) => {
        if (!isSecretTunnel || !secretTunnelOverlay || battlePhase === "prepare") return;
        const accessAt = (x: number, y: number) =>
          secretTunnelOverlay?.tiles[y]?.[x]?.access ?? TUNNEL_ACCESS.none;
        ctx.save();
        for (let y = sy; y <= ey; y++)
          for (let x = sx; x <= ex; x++) {
            if (!seen[y]?.[x]) continue;
            const tile = secretTunnelOverlay.tiles[y]?.[x];
            if (tile?.access !== TUNNEL_ACCESS.blue && tile?.access !== TUNNEL_ACCESS.red)
              continue;
            const px = x * S - cam.x,
              py = y * S - cam.y,
              own = tile.access === TUNNEL_ACCESS.blue,
              regionColor = own ? "#35dbe8" : "#ff665f",
              edgeColor = own ? "#79edf3" : "#ff8a84";
            ctx.globalAlpha = own ? 0.055 : 0.05;
            ctx.fillStyle = regionColor;
            ctx.fillRect(px - 1, py - 1, S + 2, S + 2);
            ctx.globalAlpha = 0.42;
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (accessAt(x, y - 1) !== tile.access) {
              ctx.moveTo(px, py);
              ctx.lineTo(px + S, py);
            }
            if (accessAt(x + 1, y) !== tile.access) {
              ctx.moveTo(px + S, py);
              ctx.lineTo(px + S, py + S);
            }
            if (accessAt(x, y + 1) !== tile.access) {
              ctx.moveTo(px + S, py + S);
              ctx.lineTo(px, py + S);
            }
            if (accessAt(x - 1, y) !== tile.access) {
              ctx.moveTo(px, py + S);
              ctx.lineTo(px, py);
            }
            ctx.stroke();
            if (!own) {
              const inset = Math.max(8, S * 0.29);
              ctx.globalAlpha = 0.2;
              ctx.strokeStyle = "#ffaca7";
              ctx.lineWidth = 1.25;
              ctx.setLineDash([3, 4]);
              ctx.beginPath();
              ctx.moveTo(px + inset, py + inset);
              ctx.lineTo(px + S - inset, py + S - inset);
              ctx.moveTo(px + S - inset, py + inset);
              ctx.lineTo(px + inset, py + S - inset);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        ctx.globalAlpha = 1;
        ctx.restore();
      },
      render = () => {
        ctx.fillStyle = "#050607";
        ctx.fillRect(0, 0, viewWidth, viewHeight);
        const sx = Math.max(0, Math.floor(cam.x / S)),
          sy = Math.max(0, Math.floor(cam.y / S)),
          ex = Math.min(COLS - 1, Math.ceil((cam.x + viewWidth) / S)),
          ey = Math.min(ROWS - 1, Math.ceil((cam.y + viewHeight) / S));
        for (let y = sy; y <= ey; y++)
          for (let x = sx; x <= ex; x++) {
            if (!seen[y][x]) {
              ctx.fillStyle = "#111416";
              ctx.fillRect(x * S - cam.x, y * S - cam.y, S + 1, S + 1);
            } else drawTile(visible(x, y) ? tileForLocalTunnelView(x, y) : memory[y][x], x, y);
          }
        drawTunnelAccessOverlay(sx, sy, ex, ey);
        drawTacticalAreas();
        drawFields();
        drawGroundMines();
        const actors: Array<{ z: number; draw: () => void }> = [];
        if (seen[ALLY.y][ALLY.x])
          actors.push({
            z: (ALLY.y + 1) * S,
            draw: () => drawScaledWorldActor(
              ALLY.x * S + S / 2,
              ALLY.y * S + S / 2,
              () => drawBase(ALLY, "blue", allyHp),
            ),
          });
        if (isCampaign && campaignChapter === 1 && campaign1VentOpen && seen[CAMPAIGN1_VENT.y][CAMPAIGN1_VENT.x])
          actors.push({
            z: (CAMPAIGN1_VENT.y + 1) * S,
            draw: () => drawScaledWorldActor(
              CAMPAIGN1_VENT.x * S + S / 2,
              CAMPAIGN1_VENT.y * S + S / 2,
              drawCampaignVent,
            ),
          });
        if (!(isCampaign && campaignChapter === 1) && (isSecretTunnel || visible(ENEMY.x, ENEMY.y) || (isCampaign && campaignChapter === 5)))
          actors.push({
            z: (ENEMY.y + 1) * S,
            draw: () => drawScaledWorldActor(
              ENEMY.x * S + S / 2,
              ENEMY.y * S + S / 2,
              () => drawBase(ENEMY, "red", enemyHp),
            ),
          });
        for (const t of turrets)
          if (
            t.campaignActivated !== false &&
            (t.team === "blue" || (
              battlePhase !== "prepare" &&
              visible(t.x, t.y) &&
              (!isSecretTunnel || openForTeam(t.x, t.y, "blue"))
            ))
          )
            actors.push({
              z: t.y * S + S / 2,
              draw: () => drawScaledWorldActor(
                t.x * S + S / 2,
                t.y * S + S / 2,
                () => drawTurret(t),
              ),
            });
        const renderNow = performance.now();
        for (const u of units) {
          if (
            u.campaignActivated === false ||
            u.networkVisible === false ||
            (u.team !== "blue" && (
              battlePhase === "prepare" ||
              !visible(u.x, u.y) ||
              (isSecretTunnel && !openForTeam(u.x, u.y, "blue"))
            ))
          ) continue;
          // 확대 배율의 중심점도 실제 보간 위치를 써야 한다. 논리 목적 칸을 쓰면
          // 1.5배 화면에서 다음 이동이 시작될 때마다 유닛이 반 칸 뒤로 튕긴다.
          const world = interpolatedUnitWorld(u, renderNow);
          actors.push({
            z: world.y,
            draw: () => drawScaledWorldActor(world.x, world.y, () => drawUnit(u)),
          });
        }
        actors.sort((a, b) => a.z - b.z);
        for (const actor of actors) actor.draw();
        for (const s of shots) {
          if (
            [
              "rock",
              "can",
              "root",
              "venom",
              "laser",
              "missile",
              "acid",
              "spray",
              "disc",
              "web",
              "ampoule",
              "receipt",
            ].includes(s.kind)
          )
            continue;
          const tx = Math.floor(s.x / S),
            ty = Math.floor(s.y / S);
          if (
            s.team === "blue" ||
            (battlePhase !== "prepare" &&
              visible(tx, ty) &&
              (!isSecretTunnel || openForTeam(tx, ty, "blue")))
          ) {
            ctx.fillStyle =
              s.kind === "blast"
                ? "#ffad38"
                : s.team === "blue"
                  ? "#f4db78"
                  : "#ef6856";
            ctx.fillRect(s.x - 6 - cam.x, s.y - 2 - cam.y, 12, 4);
          }
        }
        for (const s of slashes) drawSlash(s);
        for (const p of dust) {
          const tx = Math.floor(p.x / S),
            ty = Math.floor(p.y / S);
          if (visible(tx, ty) && (!isSecretTunnel || openForTeam(tx, ty, "blue"))) {
            ctx.globalAlpha = Math.max(0, p.life / 550);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 3 - cam.x, p.y - 3 - cam.y, 6, 6);
            ctx.globalAlpha = 1;
          }
        }
        for (const popup of damagePopups) {
          const popupTileX = Math.floor(popup.x / S),
            popupTileY = Math.floor(popup.y / S);
          if (
            !visible(popupTileX, popupTileY) ||
            (isSecretTunnel && !openForTeam(popupTileX, popupTileY, "blue"))
          ) continue;
          const progress = 1 - popup.life / popup.maxLife;
          ctx.save();
          ctx.globalAlpha = Math.min(1, popup.life / 180);
          ctx.fillStyle = popup.color;
          ctx.strokeStyle = "#130707";
          ctx.lineWidth = 3;
          ctx.font = `${popup.critical ? "900 16px" : "800 13px"} 'Malgun Gothic', sans-serif`;
          ctx.textAlign = "center";
          const x = popup.x - cam.x, y = popup.y - cam.y - progress * 24;
          ctx.strokeText(popup.text, x, y);
          ctx.fillText(popup.text, x, y);
          ctx.restore();
        }
        if (isCampaign && !hero.alive) {
          const x = heroWorld.x - cam.x, y = heroWorld.y - cam.y - 72;
          ctx.save();
          ctx.fillStyle = "#160707e8";
          ctx.strokeStyle = "#ff6658";
          ctx.lineWidth = 2;
          ctx.fillRect(x - 52, y - 15, 104, 30);
          ctx.strokeRect(x - 52, y - 15, 104, 30);
          ctx.fillStyle = "#ff887b";
          ctx.font = "900 18px 'Malgun Gothic', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("전투불능", x, y);
          ctx.restore();
        }
        drawFog();
        if (isSecretTunnel && battlePhase === "prepare")
          drawScaledWorldActor(
            ENEMY.x * S + S / 2,
            ENEMY.y * S + S / 2,
            () => drawBase(ENEMY, "red", enemyHp),
          );
        drawAimGuide();
      };
    const drawMinimap = () => {
      if (minimapCollapsedRef.current) return;
      const m = minimap,
        cw = m.w / COLS,
        ch = m.h / ROWS,
        wx = m.w / W,
        wy = m.h / H;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#050708ee";
      ctx.fillRect(m.x - 5, m.y - 18, m.w + 10, m.h + 23);
      ctx.strokeStyle = "#9a7b45";
      ctx.lineWidth = 2;
      ctx.strokeRect(m.x - 4, m.y - 17, m.w + 8, m.h + 21);
      ctx.fillStyle = "#c8a55f";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("미니맵", m.x, m.y - 6);
      ctx.beginPath();
      ctx.rect(m.x, m.y, m.w, m.h);
      ctx.clip();
      ctx.fillStyle = "#000";
      ctx.fillRect(m.x, m.y, m.w, m.h);
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++)
          if (seen[y][x]) {
            const t = memory[y][x],
              live = visible(x, y);
            ctx.fillStyle =
              t.type === 0
                ? live
                  ? "#365053"
                  : "#182527"
                : t.type === 3
                  ? live
                    ? "#77736d"
                    : "#393735"
                  : t.type === 4
                    ? "#24282a"
                    : live
                      ? "#765137"
                      : "#39291f";
            ctx.fillRect(
              m.x + x * cw,
              m.y + y * ch,
              Math.ceil(cw + 0.2),
              Math.ceil(ch + 0.2),
            );
          }
      if (isSecretTunnel && secretTunnelOverlay && battlePhase !== "prepare") {
        ctx.save();
        ctx.globalAlpha = 0.34;
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++) {
            if (!seen[y]?.[x]) continue;
            const tile = secretTunnelOverlay.tiles[y]?.[x];
            if (tile?.access !== TUNNEL_ACCESS.blue && tile?.access !== TUNNEL_ACCESS.red)
              continue;
            ctx.fillStyle = tile.access === TUNNEL_ACCESS.blue ? "#42dce8" : "#ff665f";
            ctx.fillRect(
              m.x + x * cw,
              m.y + y * ch,
              Math.max(1, Math.ceil(cw)),
              Math.max(1, Math.ceil(ch)),
            );
          }
        ctx.restore();
      }
      const dot = (x: number, y: number, color: string, size = 3) => {
        ctx.fillStyle = color;
        ctx.fillRect(
          m.x + (x + 0.5) * cw - size / 2,
          m.y + (y + 0.5) * ch - size / 2,
          size,
          size,
        );
      };
      dot(ALLY.x, ALLY.y, "#61ecfa", 5);
      if (
        !(isCampaign && campaignChapter === 1) &&
        (isSecretTunnel || visible(ENEMY.x, ENEMY.y) || (isCampaign && campaignChapter === 5))
      )
        dot(ENEMY.x, ENEMY.y, campaignChapter === 5 ? "#ffe071" : "#ff6857", campaignChapter === 5 ? 7 : 5);
      for (const t of turrets)
        if (
          t.hp > 0 &&
          (t.team === "blue" || (
            battlePhase !== "prepare" &&
            visible(t.x, t.y) &&
            (!isSecretTunnel || openForTeam(t.x, t.y, "blue"))
          ))
        )
          dot(t.x, t.y, t.team === "blue" ? "#54dce9" : "#f25b4c", 3);
      for (const u of units)
        if (
          u.alive &&
          (u.team === "blue" || (
            battlePhase !== "prepare" &&
            visible(u.x, u.y) &&
            (!isSecretTunnel || openForTeam(u.x, u.y, "blue"))
          ))
        )
          dot(
            u.x,
            u.y,
            u === hero ? "#fff3a1" : u.team === "blue" ? "#65e4ef" : "#ff705e",
            u === hero ? 5 : 2,
          );
      ctx.strokeStyle = "#f2d477";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(m.x + cam.x * wx, m.y + cam.y * wy, viewWidth * wx, viewHeight * wy);
      ctx.restore();
    };
    const syncMinimapOverlay = () => {
        const stage = canvas.parentElement;
        if (!(stage instanceof HTMLElement)) return;
        const stageRect = stage.getBoundingClientRect(),
          canvasRect = canvas.getBoundingClientRect(),
          scaleX = canvasRect.width / Math.max(1, viewWidth),
          scaleY = canvasRect.height / Math.max(1, viewHeight),
          left = canvasRect.left - stageRect.left + minimap.x * scaleX,
          top = canvasRect.top - stageRect.top + minimap.y * scaleY;
        stage.style.setProperty("--minimap-left", `${left}px`);
        stage.style.setProperty("--minimap-top", `${top}px`);
        stage.style.setProperty("--minimap-width", `${minimap.w * scaleX}px`);
        stage.style.setProperty("--minimap-height", `${minimap.h * scaleY}px`);
        stage.classList.add("minimap-layout-ready");
      },
      resizeBattleCanvas = () => {
        const rect = canvas.getBoundingClientRect(),
          nextWidth = Math.max(320, Math.round(rect.width || VW)),
          nextHeight = Math.max(240, Math.round(rect.height || VH));
        if (nextWidth === viewWidth && nextHeight === viewHeight) {
          syncMinimapOverlay();
          return;
        }
        viewWidth = nextWidth;
        viewHeight = nextHeight;
        canvas.width = viewWidth;
        canvas.height = viewHeight;
        fog.width = viewWidth;
        fog.height = viewHeight;
        ctx.imageSmoothingEnabled = false;
        minimap = { ...minimap, x: viewWidth - 180, y: viewHeight - 124 };
        cursorScreen.x = Math.max(0, Math.min(viewWidth, cursorScreen.x));
        cursorScreen.y = Math.max(0, Math.min(viewHeight, cursorScreen.y));
        clampCamera();
        syncMinimapOverlay();
      },
      routeHotkey = (e: KeyboardEvent) => {
        if (
          !e.ctrlKey ||
          e.repeat ||
          pausedRef.current ||
          onlineMenuOpenRef.current ||
          ended ||
          (e.code !== "Digit1" && e.code !== "Digit2")
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const tile = cursorTile();
        const id: RouteId = e.code === "Digit1" ? "A" : "B";
        cancelRouteEdit();
        cancelQuickRouteAim();
        setRouteTarget(id, tile.x, tile.y);
        publishOnlineInput({ type: "route", route: id, x: tile.x, y: tile.y });
      },
      buildHotkey = (e: KeyboardEvent) => {
        if (
          !e.ctrlKey ||
          e.altKey ||
          e.metaKey ||
          e.repeat ||
          pausedRef.current ||
          onlineMenuOpenRef.current ||
          ended
        ) return;
        const hotkeyIndex = BUILD_HOTKEY_CODES.indexOf(
          e.code as (typeof BUILD_HOTKEY_CODES)[number],
        );
        if (hotkeyIndex < 0) return;
        const buildables = factionBuildables(playerDef.faction),
          buildHotkeyCommands = [
            ...buildables.map((definition) => `build:${definition.id}`),
            "build:upgrade",
            "build:demolish",
            "tactical:defense",
            "tactical:offense",
            "tactical:area",
            "tactical:recovery",
            "tactical:reinforce",
            "research:minion",
            "elite:reserve",
          ],
          shortcutCommand = buildHotkeyCommands[hotkeyIndex];
        if (!shortcutCommand) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        command(shortcutCommand);
        setBuildMenuOpen(false);
      },
      followHeroPointer = (e: PointerEvent) => {
        if (e.button === 0 && !minimapPoint(cursorScreen.x, cursorScreen.y))
          cameraFree = false;
      };
    syncMinimapOverlay();
    markVision();
    if (isSecretTunnel && battlePhase === "prepare")
      announceSecretPhase("터널 뚫기 시작", "30초 · 벽을 밀어내듯 공격로와 광맥을 빠르게 뚫어라");
    cam.x = Math.max(0, heroWorld.x - viewWidth / 2);
    cam.y = Math.max(0, heroWorld.y - viewHeight / 2);
    const loop = (now: number) => {
      const dt = Math.min(34, now - last);
      last = now;
      if (!ended && !pausedRef.current) update(dt, now);
      render();
      drawMarchRoutes();
      drawShotFx();
      drawBuildGuide();
      drawMinimap();
      if (!minimapCollapsedRef.current) drawMarchRoutes(true);
      raf = requestAnimationFrame(loop);
    };
    addEventListener("keydown", buildHotkey, true);
    addEventListener("keydown", routeHotkey, true);
    addEventListener("keydown", keydown);
    addEventListener("keyup", keyup);
    addEventListener("pointerup", pointerup);
    addEventListener("resize", resizeBattleCanvas);
    canvas.addEventListener("pointerdown", followHeroPointer);
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("pointermove", pointermove);
    canvas.addEventListener("pointercancel", pointerup);
    canvas.addEventListener("contextmenu", contextmenu);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (defeatTimer !== null) window.clearTimeout(defeatTimer);
      if (phaseAnnouncementTimer !== null) window.clearTimeout(phaseAnnouncementTimer);
      removeEventListener("keydown", buildHotkey, true);
      removeEventListener("keydown", routeHotkey, true);
      removeEventListener("keydown", keydown);
      removeEventListener("keyup", keyup);
      removeEventListener("pointerup", pointerup);
      removeEventListener("resize", resizeBattleCanvas);
      canvas.removeEventListener("pointerdown", followHeroPointer);
      canvas.removeEventListener("pointerdown", pointerdown);
      canvas.removeEventListener("pointermove", pointermove);
      canvas.removeEventListener("pointercancel", pointerup);
      canvas.removeEventListener("contextmenu", contextmenu);
    };
  }, [screen, selectedHeroId, gameMode, campaignChapter, campaignDifficulty, activeMatchConfig, selectedMapId, selectedLoadout, battleScale, battleRunId]);
  const finishCampaignPrologue = () => {
      window.localStorage.setItem(CAMPAIGN_PROLOGUE_STORAGE_KEY, "1");
      setCampaignPrologueError(null);
      setScreen("chapters");
    },
    openCampaign = () => {
      setCampaignPrologueError(null);
      setScreen(
        hasSeenCampaignPrologue(window.localStorage.getItem(CAMPAIGN_PROLOGUE_STORAGE_KEY))
          ? "chapters"
          : "prologue",
      );
    },
    replayCampaignPrologue = () => {
      setCampaignPrologueError(null);
      setScreen("prologue");
    };
  if (screen === "prologue")
    return (
      <main className="campaign-cinematic chapter-cinematic-player prologue-player">
        {/* The approved prologue already contains its Korean story text in the picture. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          autoPlay
          controls
          playsInline
          preload="auto"
          aria-label="휴먼 캠페인 프롤로그"
          onLoadedData={() => setCampaignPrologueError(null)}
          onError={() => setCampaignPrologueError("프롤로그 영상을 불러오지 못했습니다. 건너뛰면 작전지도로 이동합니다.")}
          onEnded={finishCampaignPrologue}
          src={CAMPAIGN_PROLOGUE_VIDEO}
        />
        <header className="chapter-cinematic-meta prologue-meta">
          <small>HUMAN SURVIVAL RECORD · PROLOGUE</small>
          <strong>서울 지하 999M</strong>
        </header>
        <div className="chapter-cinematic-actions">
          {campaignPrologueError && <p role="alert">{campaignPrologueError}</p>}
          <button onClick={finishCampaignPrologue}>SKIP · 작전지도로</button>
        </div>
      </main>
    );
  if (screen === "cinematic")
    return (
      <main className="campaign-cinematic chapter-cinematic-player">
        {/* Approved chapter cinematics contain their Korean story text in-picture. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          key={campaignChapter}
          autoPlay
          controls
          playsInline
          preload="auto"
          aria-label={`제${campaignChapter}장 작전 시네마틱`}
          onLoadedData={() => setCampaignCinematicError(null)}
          onError={() => setCampaignCinematicError("시네마틱 영상을 불러오지 못했습니다. 건너뛰어도 작전은 계속할 수 있습니다.")}
          onEnded={finishCampaignCinematic}
          src={CAMPAIGN_CINEMATICS[campaignChapter]}
        />
        <header className="chapter-cinematic-meta">
          <small>HUMAN SURVIVAL RECORD · CHAPTER {String(campaignChapter).padStart(2, "0")}</small>
          <strong>{selectedCampaignInfo.title}</strong>
        </header>
        <div className="chapter-cinematic-actions">
          {campaignCinematicError && <p role="alert">{campaignCinematicError}</p>}
          <button onClick={finishCampaignCinematic} disabled={campaignAssetsLoading}>
            {campaignAssetsLoading
              ? "전투 준비 중…"
              : campaignCinematicMode === "replay"
                ? "상세로 돌아가기"
                : "건너뛰고 작전 시작"}
          </button>
        </div>
      </main>
    );
  if (screen === "chapters")
    return (
      <main className="chapter-screen">
        <MenuSceneBackdrop />
        <section>
          <span>HUMAN SURVIVAL RECORD</span>
          <h1>휴먼 캠페인</h1>
          <p>앞선 작전을 완료하면 다음 생존 기록이 순서대로 해제됩니다.</p>
          <div className="chapter-map-toolbar">
            <strong className="chapter-progress">작전 완료 {completedCampaignChapters.length} / 5</strong>
            <button className="prologue-replay" onClick={replayCampaignPrologue}>
              프롤로그 다시 보기
            </button>
          </div>
          <div className="chapter-chain">
            {([1, 2, 3, 4, 5] as CampaignChapter[]).map((chapterNumber) => {
              const status = campaignChapterStatus(chapterNumber, completedCampaignChapters),
                info = campaignChapterInfo[chapterNumber],
                statusLabel = status === "completed" ? "완료" : status === "available" ? "작전 가능" : "LOCK";
              return (
                <article
                  key={chapterNumber}
                  className={`${status} ${campaignChapter === chapterNumber ? "selected" : ""}`}
                >
                  <button
                    type="button"
                    disabled={status === "locked"}
                    aria-label={`제${chapterNumber}장 ${info.subtitle} · ${statusLabel}`}
                    onClick={() => {
                      setCampaignChapter(chapterNumber);
                      setScreen("briefing");
                    }}
                  >
                    <i aria-hidden="true">{status === "locked" ? "⌧" : status === "completed" ? "✓" : "▶"}</i>
                    <b>{String(chapterNumber).padStart(2, "0")}</b>
                    <span>{statusLabel}</span>
                  </button>
                  <strong>{info.subtitle}</strong>
                </article>
              );
            })}
          </div>
          <button className="back-button" onClick={() => setScreen("intro")}>
            첫 화면으로
          </button>
        </section>
      </main>
    );
  if (screen === "briefing")
    return (
      <main className="chapter-screen mission-brief">
        <MenuSceneBackdrop />
        <section>
          <span>CHAPTER {String(campaignChapter).padStart(2, "0")} · {selectedCampaignInfo.subtitle}</span>
          <h1>
            {selectedCampaignInfo.title}
          </h1>
          <div className="mission-brief-overview">
            <figure className="briefing-visual-card">
              <img className={`briefing-art chapter-${campaignChapter}`} src={selectedCampaignInfo.asset} alt={selectedCampaignInfo.assetAlt} />
              <figcaption>{selectedCampaignInfo.description}</figcaption>
            </figure>
            <section className="mission-conditions" aria-label="작전 승패 조건">
              <header>
                <small>MISSION CONDITIONS</small>
                <b>이번 작전의 성공·실패 조건</b>
              </header>
              <div className="victory">
                <strong>승리</strong>
                <p>{selectedCampaignObjective.victory}</p>
              </div>
              <div className="defeat">
                <strong>패배</strong>
                <p>{selectedCampaignObjective.defeat}</p>
              </div>
            </section>
          </div>
          <section className="mission-story-record" aria-label="작전 기록">
            <header><small>SURVIVAL RECORD</small><b>작전 기록</b></header>
            <div>{selectedCampaignInfo.story.map((line) => <p key={line}>{line}</p>)}</div>
          </section>
          <div className="campaign-difficulty" role="group" aria-label="캠페인 난이도 선택">
            <strong>작전 난이도</strong>
            {(Object.keys(CAMPAIGN_DIFFICULTIES) as CampaignDifficulty[]).map((difficulty) => {
              const option = CAMPAIGN_DIFFICULTIES[difficulty];
              return (
                <button
                  key={difficulty}
                  type="button"
                  className={campaignDifficulty === difficulty ? "active" : ""}
                  aria-pressed={campaignDifficulty === difficulty}
                  onClick={() => setCampaignDifficulty(difficulty)}
                >
                  <b>{option.label}</b>
                  <small>{option.callout}</small>
                </button>
              );
            })}
          </div>
          <div className="mission-brief-actions">
            <button className="cinematic-replay" onClick={() => showCampaignCinematic("replay")} disabled={campaignAssetsLoading}>
              시네마틱 다시 보기
            </button>
            <button onClick={startCampaignMission} disabled={campaignAssetsLoading}>
            {campaignAssetsLoading ? "원본 전투 자료 불러오는 중…" : "작전 시작"}
            </button>
          </div>
          {campaignLoadError && <p role="alert">{campaignLoadError}</p>}
          <button className="quiet" onClick={() => setScreen("chapters")}>
            작전 지도
          </button>
        </section>
      </main>
    );
  if (screen === "intro")
    return (
      <main className={`title-screen ${menuPanel === "roster" ? "roster-open" : menuPanel === "help" ? "help-open" : ""}`}>
        <aside className="mobile-landscape-notice" aria-label="모바일 PC 플레이 권장 안내">
          <span>
            <b>PC 환경 권장</b>
            <small>원활한 플레이를 위해 PC 브라우저에서 접속해 주세요.</small>
          </span>
        </aside>
        <MenuSceneBackdrop />
        <div className="title-noise" />
        <div className="title-depth">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <header>
          <span>SEOUL EMERGENCY SHELTER NETWORK</span>
          <b>DEPTH: −999M</b>
          <em>통신 상태 불량</em>
        </header>
        <section className="title-brand">
          <p className="eyebrow">지상 폐쇄 후 143년 · 생존구역 09</p>
          <img
            src="/assets/branding/seoul-999m-logo-concept-v1.png"
            alt="서울 지하 999M"
          />
          <p className="tagline">
            땅을 파라. 길을 만들어라.
            <br />
            <strong>먼저 코어에 도달한 종족만 살아남는다.</strong>
          </p>
          {menuPanel === "main" ? (
            <nav className="main-menu" aria-label="게임 모드 선택">
              <button
                className="campaign"
                onClick={openCampaign}
              >
                <kbd>01</kbd>
                <span>
                  <b>캠페인</b>
                  <small>휴먼 생존 기록 · 제1장 작전 가능</small>
                </span>
                <em>진입</em>
              </button>
              <button onClick={() => setMenuPanel("roster")}>
                <kbd>02</kbd>
                <span>
                  <b>컴퓨터와 대전</b>
                  <small>자유 편성 · 거점 파괴전</small>
                </span>
                <em>대전</em>
              </button>
              <button
                onClick={() => {
                  setMenuPanel("together");
                  setLobbyNotice("게스트 통신망 · 로그인 없이 참가");
                }}
              >
                <kbd>03</kbd>
                <span>
                  <b>같이하기</b>
                  <small>방을 만들거나 코드로 합류</small>
                </span>
                <em>접속</em>
              </button>
              <button onClick={() => setMenuPanel("settings")}>
                <kbd>04</kbd>
                <span>
                  <b>설정</b>
                  <small>전투 화면 배율 · 표시 환경</small>
                </span>
                <em>조정</em>
              </button>
              <button onClick={() => { setHelpTab("quick"); setMenuPanel("help"); }}>
                <kbd>05</kbd>
                <span>
                  <b>게임 플레이 방법</b>
                  <small>목표 · 전체 조작 · 모드 규칙 · 승패 조건</small>
                </span>
                <em>교본</em>
              </button>
            </nav>
          ) : menuPanel === "together" ? (
            <section className="together-panel" aria-label="같이하기">
              <div className="panel-heading">
                <span>
                  <b>같이하기</b>
                  <small>로그인 없이 임시 호출명으로 접속</small>
                </span>
                <button
                  onClick={() => onlineRoom ? roomAction("leave") : setMenuPanel("main")}
                  aria-label="뒤로 가기"
                >
                  ×
                </button>
              </div>
              {!onlineRoom ? (
                <>
                  <label>
                    호출명
                    <input value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" />
                  </label>
                  <div className="online-room-options">
                    <fieldset className="battle-ruleset-select">
                      <legend>대전 규칙</legend>
                      <button className={selectedRuleset === "secret-tunnel" ? "active" : ""} onClick={() => selectBattleRuleset("secret-tunnel")}>비밀 굴착전</button>
                      <button className={selectedRuleset === "open-front" ? "active" : ""} onClick={() => selectBattleRuleset("open-front")}>개방 전선전</button>
                    </fieldset>
                    <fieldset>
                      <legend>대전 인원</legend>
                      <button className={skirmishTeamSize === 1 ? "active" : ""} onClick={() => setSkirmishTeamSize(1)}>1:1</button>
                      <button className={skirmishTeamSize === 2 ? "active" : ""} onClick={() => setSkirmishTeamSize(2)}>2:2</button>
                    </fieldset>
                    <label>
                      전장
                      <select value={selectedMapId} onChange={(event) => setSelectedMapId(event.target.value as BattleMapId)}>
                        {battleMapsForRuleset(selectedRuleset).map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
                      </select>
                    </label>
                    <label>
                      내 영웅
                      <select value={selectedHeroId} onChange={(event) => setSelectedHeroId(event.target.value)}>
                        {HEROES.map((candidate) => <option key={candidate.id} value={candidate.id}>{FACTIONS[candidate.faction].name} · {candidate.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <section className="online-hero-preview" aria-label="같이하기 선택 영웅 미리보기">
                    <i className="hero-frame" style={heroPortraitStyle(activeHeroDef)} />
                    <span>
                      <small>내 영웅</small>
                      <b>{activeHeroDef.name}</b>
                      <em>{activeHeroDef.role} · {heroKit(activeHeroDef.id).identity}</em>
                    </span>
                    <div aria-label="영웅 기술 아이콘">
                      <HeroKitIcon heroId={activeHeroDef.id} slot="skill1" />
                      <HeroKitIcon heroId={activeHeroDef.id} slot="skill2" />
                      <HeroKitIcon heroId={activeHeroDef.id} slot="ultimate" />
                      <HeroKitIcon heroId={activeHeroDef.id} slot="drill" />
                    </div>
                  </section>
                  <div className="room-actions">
                    <button disabled={onlineBusy} onClick={createRoom}>{onlineBusy ? "연결 중" : "방 만들기"}</button>
                    <i>또는</i>
                    <label>
                      방 코드
                      <input value={roomCode} maxLength={6} onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="6자리" />
                    </label>
                    <button disabled={onlineBusy || roomCode.length !== 6} onClick={joinRoom}>참가하기</button>
                  </div>
                </>
              ) : (
                <div className="online-lobby">
                  <div className="room-code-card">
                    <span>ROOM CODE</span>
                    <strong>{onlineRoom.code}</strong>
                    <small>{onlineRoomRuleset(onlineRoom) === "secret-tunnel" ? "비밀 굴착전" : "개방 전선전"} · {onlineRoom.teamSize}:{onlineRoom.teamSize} · {battleMap(onlineRoom.mapId).name}</small>
                    <small>
                      공용 전장 #{onlineRoom.seed.toString(16).toUpperCase()} · 거점 위치는 경기마다
                      대칭 후보에서 확정
                    </small>
                  </div>
                  <div className="online-slots">
                    {(["blue", "red"] as const).map((team) => (
                      <section key={team} className={team}>
                        <h3>{team === "blue" ? "A TEAM" : "B TEAM"}</h3>
                        {Array.from({ length: onlineRoom.teamSize }, (_, index) => {
                          const member = onlineRoom.players.find((player) => player.team === team && player.index === index),
                            memberHero = member ? HEROES.find((candidate) => candidate.id === member.heroId) : undefined;
                          return <article key={`${team}-${index}`} className={member?.ready ? "ready" : ""}>
                            <i className={`online-slot-portrait ${memberHero ? "" : "empty"}`} style={memberHero ? heroPortraitStyle(memberHero) : undefined} />
                            <span className="online-slot-copy">
                              <b>{member ? member.nickname : "참가 대기"}</b>
                              <small>{memberHero?.name ?? `SLOT ${index + 1}`}</small>
                              <em>{member ? member.aiControlled ? "AI 인계" : member.connected ? member.ready ? "준비 완료" : "준비 중" : "연결 끊김" : "빈 슬롯"}</em>
                            </span>
                          </article>;
                        })}
                      </section>
                    ))}
                  </div>
                  <div className="online-lobby-actions">
                    {(() => {
                      const me = onlineRoom.players.find((player) => player.id === onlineIdentity?.playerId), host = me?.id === onlineRoom.hostId;
                      return <>
                        {onlineRoom.status === "lobby" && <button disabled={onlineBusy} onClick={() => roomAction(me?.ready ? "unready" : "ready")}>{me?.ready ? "준비 취소" : "준비 완료"}</button>}
                        {host && onlineRoom.status === "lobby" && <button className="start" disabled={onlineBusy || !roomCanStart(onlineRoom)} onClick={() => roomAction("start")}>전투 시작</button>}
                        {host && onlineRoom.status === "finished" && <button className="start" disabled={onlineBusy} onClick={() => roomAction("rematch")}>재대전 준비</button>}
                        <button className="leave" onClick={() => roomAction("leave")}>방 나가기</button>
                      </>;
                    })()}
                  </div>
                  {onlineRoom.status === "countdown" && <strong className="online-countdown">전투 동기화 중 · 잠시 후 투입</strong>}
                   {onlineRoom.status === "finished" && <strong className="online-countdown">{onlineRoom.winner === "draw" ? "무승부" : `${onlineRoom.winner === "blue" ? "A TEAM" : "B TEAM"} 승리`} · {onlineRoom.hostId === onlineIdentity?.playerId ? "재대전을 선택할 수 있습니다" : "방장의 재대전 선택을 기다리는 중"}</strong>}
                </div>
              )}
              <p className="lobby-notice">{lobbyNotice}</p>
            </section>
          ) : menuPanel === "settings" ? (
            <section className="settings-panel" aria-label="게임 설정">
              <div className="panel-heading">
                <span>
                  <b>설정 · 전투 화면</b>
                  <small>전투 중 보이는 캐릭터와 타일의 크기를 정합니다</small>
                </span>
                <button onClick={() => setMenuPanel("main")} aria-label="뒤로 가기">×</button>
              </div>
              <div className="battle-scale-options" role="radiogroup" aria-label="전투 화면 배율">
                {([
                  [1, "기본", "현재 화면 · 넓은 시야"],
                  [1.5, "크게 보기", "캐릭터와 지형을 1.5배 크게"],
                ] as const).map(([scale, label, description]) => (
                  <button
                    key={scale}
                    className={battleScale === scale ? "active" : ""}
                    role="radio"
                    aria-checked={battleScale === scale}
                    onClick={() => {
                      setBattleScale(scale);
                      window.localStorage.setItem(BATTLE_SCALE_STORAGE_KEY, String(scale));
                    }}
                  >
                    <span className={`scale-preview scale-${String(scale).replace(".", "-")}`}>
                      <i /><i /><i />
                    </span>
                    <span><b>{label} · ×{scale.toFixed(1)}</b><small>{description}</small></span>
                    <em>{battleScale === scale ? "사용 중" : "선택"}</em>
                  </button>
                ))}
              </div>
              <p>배율은 다음 전투부터 적용되며 이 브라우저에 자동 저장됩니다.</p>
              <section className="mobile-play-settings" aria-label="모바일 플레이 안내">
                <span>
                  <b>모바일 화면 맞춤</b>
                  <small>기기를 가로로 돌리면 이동·기술·아이템을 왼쪽 조작 레일에 배치합니다. 아래 버튼은 지원 기기에서 전체화면과 가로 고정을 요청합니다.</small>
                </span>
                <button onClick={requestLandscapeFullscreen}>가로 전체화면 시도</button>
              </section>
            </section>
          ) : menuPanel === "help" ? (
            <section className="help-panel" aria-label="게임 플레이 방법">
              <div className="panel-heading">
                <span>
                  <b>게임 플레이 방법 · 생존본부 현장 교본</b>
                  <small>처음 플레이하는 심사위원도 목표, 조작, 모드 규칙과 승패 조건을 순서대로 확인할 수 있습니다</small>
                </span>
                <button onClick={() => setMenuPanel("main")} aria-label="게임 플레이 방법 닫기">×</button>
              </div>
              <div className="help-tabs" role="tablist" aria-label="게임 플레이 방법 보기">
                <button
                  id="help-tab-quick"
                  role="tab"
                  aria-selected={helpTab === "quick"}
                  aria-controls="help-panel-quick"
                  className={helpTab === "quick" ? "active" : ""}
                  onClick={(event) => {
                    setHelpTab("quick");
                    event.currentTarget.closest(".help-panel")?.scrollTo({ top: 0 });
                  }}
                >
                  <b>빠른 시작</b><small>처음 한 판은 이것만</small>
                </button>
                <button
                  id="help-tab-detail"
                  role="tab"
                  aria-selected={helpTab === "detail"}
                  aria-controls="help-panel-detail"
                  className={helpTab === "detail" ? "active" : ""}
                  onClick={(event) => {
                    setHelpTab("detail");
                    event.currentTarget.closest(".help-panel")?.scrollTo({ top: 0 });
                  }}
                >
                  <b>상세 교본</b><small>전체 조작과 모든 규칙</small>
                </button>
              </div>
              {helpTab === "quick" ? (
                <section id="help-panel-quick" className="help-brief" role="tabpanel" aria-labelledby="help-tab-quick">
                  <header className="help-brief-hero">
                    <i className="help-brief-image" aria-hidden="true" />
                    <span>
                      <small>FIRST MATCH</small>
                      <h2>땅을 파서 공격로를 만들고, 병력과 함께 적 코어를 부수면 승리</h2>
                      <p><b>추천 첫 경기</b> · 컴퓨터와 대전 → 비밀 굴착전 → 1:1</p>
                      <div><strong>30초</strong><small>길 만들기</small><i>→</i><strong>4분</strong><small>거점 공격</small></div>
                    </span>
                  </header>
                  <section className="help-brief-steps" aria-label="첫 경기 네 단계">
                    <header><small>PLAY IN 4 STEPS</small><b>이 네 가지만 따라 하세요</b></header>
                    <ol>
                      <li><b>1</b><span><strong>경기 선택</strong><small>컴퓨터와 대전에서 비밀 굴착전·쉬움·1:1을 고르고 시작합니다.</small></span></li>
                      <li><b>2</b><span><strong>30초 동안 길 연결</strong><small>보이는 적 거점 방향을 클릭하거나 WASD로 팝니다. <kbd>4</kbd>는 넓은 범위를 빠르게 뚫습니다.</small></span></li>
                      <li><b>3</b><span><strong>병력과 함께 전진</strong><small>공격이 시작되면 영웅은 기지로 돌아옵니다. 내가 만든 길로 자동 출전하는 아군을 따라갑니다.</small></span></li>
                      <li><b>4</b><span><strong>방어막·코어 파괴</strong><small>적을 클릭해 공격하고, 붉은 방어막 다음 코어 HP를 0으로 만들면 승리합니다.</small></span></li>
                    </ol>
                  </section>
                  <section className="help-brief-controls" aria-label="첫 경기에 필요한 조작">
                    <header><small>ESSENTIAL CONTROLS</small><b>처음에는 이 조작만 쓰면 됩니다</b></header>
                    <div>
                      {[
                        ["클릭 / WASD", "이동·땅 파기"],
                        ["적 클릭", "추적 공격"],
                        ["1 · 2 · 3", "전투 기술"],
                        ["4", "넓은 범위 굴착"],
                        ["Shift", "생존 행동"],
                        ["Q / R", "아이템 사용"],
                        ["B", "건설 메뉴"],
                        ["Esc", "메뉴·일시정지"],
                      ].map(([key, action]) => <span key={key}><kbd>{key}</kbd><b>{action}</b></span>)}
                    </div>
                  </section>
                  <aside className="help-brief-notice">
                    <b>처음에는 A/B를 몰라도 됩니다.</b>
                    <span>추천 비밀 굴착전에서는 기본 경로로 병력이 진군합니다. 병력을 두 길로 세밀하게 나누거나 건설·전술을 익히고 싶을 때 <button onClick={(event) => { setHelpTab("detail"); event.currentTarget.closest(".help-panel")?.scrollTo({ top: 0 }); }}>상세 교본 보기</button></span>
                  </aside>
                </section>
              ) : (
                <div id="help-panel-detail" className="help-detail" role="tabpanel" aria-labelledby="help-tab-detail">
              <section className="help-intro">
                <img src="/assets/opening/scenes-v12/scene-06-secret-tunnels.png" alt="서울 지하의 갈라진 비밀 땅굴" />
                <span>
                  <small>CORE GAMEPLAY</small>
                  <b>영웅으로 땅을 파고, 그 길로 부대를 지휘해 적 코어를 파괴한다</b>
                  <p>플레이어는 영웅 한 명을 직접 조작합니다. 흙벽을 굴착해 공격로를 만들고, 자동 출전하는 진군대를 A/B 경로로 보내며, 크레딧으로 설치물과 전술지원을 운용하세요.</p>
                  <strong>대전 기본 승리: 적 방어막을 제거한 뒤 코어 HP를 0으로 만들기</strong>
                </span>
              </section>
              <section className="help-quickstart" aria-label="처음 플레이 60초 순서">
                <header><small>60-SECOND START</small><b>처음 플레이는 이 순서만 따라 하세요</b></header>
                <ol>
                  <li><b>1</b><span><strong>컴퓨터와 대전 선택</strong><small>처음이면 쉬움을 고른 뒤 비밀 굴착전, 영웅과 Q/R 아이템을 선택합니다. 어려움은 기존 AI 전투력입니다.</small></span></li>
                  <li><b>2</b><span><strong>클릭해서 땅굴 개척</strong><small>30초 안에 적 거점 또는 상대 터널까지 길을 연결합니다.</small></span></li>
                  <li><b>3</b><span><strong>A/B 공격로 설정</strong><small>A 설정·B 설정으로 경로를 만들고 다음 WAVE 배분을 고릅니다.</small></span></li>
                  <li><b>4</b><span><strong>영웅·진군대로 코어 공격</strong><small>적을 제거하고 방어막과 코어를 파괴하면 승리합니다.</small></span></li>
                </ol>
              </section>
              <div className="help-grid">
                <article className="help-card victory-rules">
                  <header><span>01</span><b>목표와 승패 조건</b><small>대전에서 무엇을 해야 하나요?</small></header>
                  <div className="help-goal-flow">
                    <span><b>굴착</b><small>영웅으로 흙벽을 열어 이동로를 만듭니다.</small></span>
                    <i>→</i>
                    <span><b>지휘</b><small>A/B 경로와 다음 WAVE 배분을 정합니다.</small></span>
                    <i>→</i>
                    <span><b>교전</b><small>적 영웅·진군대·설치물을 제거합니다.</small></span>
                    <i>→</i>
                    <span><b>코어 파괴</b><small>방어막을 먼저 없애고 코어 HP를 0으로 만듭니다.</small></span>
                  </div>
                  <ul>
                    <li><b>승리</b> · 적 코어 HP를 먼저 0으로 만든 팀</li>
                    <li><b>패배</b> · 아군 코어 HP가 먼저 0이 된 팀</li>
                    <li><b>역할</b> · 영웅은 길을 열고 전투를 주도하며, 진군대는 열린 길을 따라 자동 공세합니다.</li>
                    <li><b>설치물</b> · 방어와 길목 장악용입니다. 설치물만으로는 코어를 파괴할 수 없습니다.</li>
                  </ul>
                </article>
                <article className="help-card key-controls">
                  <header><span>02</span><b>PC 전체 조작</b><small>마우스가 기본, 키보드는 빠른 입력</small></header>
                  <div className="help-key-grid">
                    {[
                      ["클릭", "이동·자동 굴착", "열린 곳으로 이동합니다. 경로가 흙벽에 막히면 진행 방향을 계속 굴착합니다."],
                      ["WASD / 방향키", "정밀 이동·굴착", "한 방향을 직접 유지하며 움직이거나 벽을 팝니다."],
                      ["적 클릭", "추적 공격", "선택한 적에게 사거리까지 접근해 기본 공격을 반복합니다."],
                      ["Ctrl+클릭", "강제 기본 공격", "이동 명령 없이 현재 위치에서 커서 방향으로 공격합니다."],
                      ["1 / 2", "일반 기술", "1은 즉시, 2는 누른 채 조준하고 놓아 발동합니다."],
                      ["3", "필살기", "누른 채 커서 방향을 조준하고 놓아 영웅의 고유 필살기를 사용합니다."],
                      ["4", "고유 굴착기", "영웅마다 다른 넓은 범위의 지형 굴착을 즉시 사용합니다."],
                      ["Shift", "생존 행동", "도약·회복·방어·회피 중 영웅 역할에 맞는 행동을 사용합니다."],
                      ["E → 클릭", "땅 메우기", "15크레딧을 내고 반경 2칸의 빈 열린 땅을 흙벽으로 복구합니다. 비밀 굴착전 침공 중에는 사용할 수 없습니다."],
                      ["Q / R", "투입 아이템", "편성한 아이템을 사용합니다. 컴퓨터 대전은 슬롯마다 2회, 두 슬롯은 1초 대기를 공유합니다."],
                      ["B", "건설 메뉴", "설치물·강화·철거·전술지원·연구 목록을 열고 닫습니다."],
                      ["우클릭 드래그", "카메라 이동", "영웅과 별도로 화면을 움직입니다. 상세 A/B 편집 중에도 사용할 수 있습니다."],
                      ["Space", "영웅 추적 복귀", "자유 카메라를 해제하고 내 영웅을 화면 중앙으로 되돌립니다."],
                      ["Esc", "전투 메뉴", "컴퓨터전·캠페인은 일시정지합니다. 온라인은 멈추지 않습니다."],
                    ].map(([key, name, description]) => (
                      <div key={key}><kbd>{key}</kbd><span><b>{name}</b><small>{description}</small></span></div>
                    ))}
                  </div>
                </article>
                <article className="help-card digging secret-mode">
                  <img src="/assets/opening/scenes-v12/scene-07-tunnel-threats.png" alt="굴착한 터널 안에서 마주친 지하 위협" />
                  <header><span>03</span><b>비밀 굴착전</b><small>30초 준비 + 4분 침공</small></header>
                  <p>준비 30초에는 적 거점 위치만 보이고 상대 영웅과 상대가 파는 길은 보이지 않습니다. 이동·굴착이 2.25배 빠르며 4번 굴착기도 빠르게 재사용됩니다.</p>
                  <ol className="help-steps"><li><b>1</b>적 거점 또는 상대가 완성한 터널까지 길을 연결</li><li><b>2</b>광석을 캐서 크레딧을 확보하고 A/B 경로 준비</li><li><b>3</b>개전 시 영웅은 자기 거점으로 귀환하고 WAVE 공세 시작</li></ol>
                  <ul><li><b>연결 실패</b> · 한 팀만 고립되면 즉시 패배, 양 팀 모두 고립되면 무승부</li><li><b>터널 권한</b> · 아군 전용만 통행 가능. 양 팀 터널이 맞닿아 연결된 구간은 공동 통행</li><li><b>적 전용 X</b> · 개전 후 옅은 X는 적이 판 길이며 아군은 통행 불가</li><li><b>4분 종료</b> · 남은 코어 비율 → 방어막 비율 → 무승부 순으로 판정</li></ul>
                </article>
                <article className="help-card modes">
                  <header><span>04</span><b>다른 게임 모드</b><small>모드마다 목표를 먼저 확인</small></header>
                  <div className="help-mode-list">
                    <span><b>개방 전선전</b><small>준비 단계 없이 양 팀이 같은 열린 전장에서 즉시 굴착·전투·건설합니다. 시간 제한 없이 먼저 적 코어를 파괴하면 승리합니다.</small></span>
                    <span><b>캠페인</b><small>각 장 브리핑의 승리·패배 조건이 우선입니다. 전투 중 왼쪽 위 작전 카드에서 현재 목표와 진행도를 확인하세요.</small></span>
                    <span><b>같이하기</b><small>로그인 없이 방을 만들고 6자리 코드로 합류합니다. 방장이 시작하며 온라인 전투는 일시정지와 개인 Q/R 아이템을 지원하지 않습니다.</small></span>
                    <span><b>1:1 / 2:2</b><small>1:1은 영웅 한 명씩, 2:2 컴퓨터전은 플레이어 영웅과 선택한 AI 동료 영웅이 함께 싸웁니다.</small></span>
                  </div>
                </article>
                <article className="help-card strategy">
                  <img src="/assets/opening/scenes-v12/scene-05-scrap-rebuilding.png" alt="지하 작업장에서 작전을 준비하는 생존자" />
                  <header><span>05</span><b>A/B 진군 전략</b><small>자동 진군대의 길과 다음 WAVE 배분</small></header>
                  <p>진군대는 열린 길만 따라갑니다. 길이 끊기면 전선 끝에서 기다리므로 먼저 영웅으로 통로를 완성한 뒤 A/B 경로를 지정하세요.</p>
                  <ul><li><b>A 설정 / B 설정</b> · 버튼을 누르고 열린 길을 순서대로 클릭합니다. 점 개수 제한 없이 이어지며 마지막 점이 최종 목적지입니다.</li><li><b>적용</b> · 금색 초안 경로를 확정합니다. 잘못 찍었으면 초기화 후 처음부터 다시 지정합니다.</li><li><b>Ctrl+1 / Ctrl+2</b> · 현재 마우스 커서 위치를 A/B 최종 목적지로 빠르게 지정하고 자동 경로를 만듭니다.</li><li><b>균등</b> · 다음 WAVE 50/50, <b>A 집중</b> · 75/25, <b>B 집중</b> · 25/75</li><li><b>중요</b> · 배분 변경은 다음 WAVE부터 적용되며 이미 출전한 병력을 거점으로 되돌리지 않습니다.</li></ul>
                </article>
                <article className="help-card construction">
                  <header><span>06</span><b>크레딧과 건설</b><small>광석·처치 보상으로 전선을 강화</small></header>
                  <p>굴착 중 광석을 발견하거나 적 영웅·진군대·설치물을 처치하면 크레딧을 얻습니다. <kbd>B</kbd>로 건설 메뉴를 열고 유효한 열린 칸을 클릭해 배치하세요.</p>
                  <div className="help-shortcut-groups">
                    <section><b>설치·관리</b><small><kbd>Ctrl+Z</kbd> 1번 설치물 · <kbd>Ctrl+X</kbd> 2번 · <kbd>Ctrl+C</kbd> 3번 · <kbd>Ctrl+V</kbd> 차단벽 · <kbd>Ctrl+B</kbd> 상시 지원 · <kbd>Ctrl+N</kbd> 강화 · <kbd>Ctrl+M</kbd> 철거</small></section>
                    <section><b>전술·성장</b><small><kbd>Ctrl+A</kbd> 방어 · <kbd>Ctrl+S</kbd> 공세 · <kbd>Ctrl+D</kbd> 지역 타격 · <kbd>Ctrl+F</kbd> 회복 · <kbd>Ctrl+G</kbd> 긴급 증원 · <kbd>Ctrl+H</kbd> 진군대 연구 · <kbd>Ctrl+J</kbd> 정예병 예약</small></section>
                  </div>
                  <ul><li><b>설치 제한</b> · 공격 시설 3개, 차단벽 4개, 상시 지원 시설 1개. 출전 통로 하나는 반드시 남겨야 합니다.</li><li><b>밀집 할증</b> · 공격 시설을 가까이 붙이면 비용이 최대 40% 증가합니다.</li><li><b>강화</b> · 건설비의 65%, 1.5초 작업. 작업 중 피격되면 취소됩니다.</li><li><b>철거</b> · 1초 뒤 현재 HP 비율을 반영해 투자액 일부를 돌려받습니다.</li></ul>
                </article>
                <article className="help-card tactical" aria-label="전술지원과 진군대 연구 도움말">
                  <header><span>07</span><b>전술지원과 진군대 연구</b><small>건설 메뉴 · 팀 크레딧 사용</small></header>
                  <div className="help-tactical-layout">
                    <div className="help-buff-preview" aria-label="종족별 전술 버프 광원">
                      {(["human", "bugborn", "ai"] as FactionId[]).map((faction, index) => {
                        const role: TacticalBuffRole = index === 1 ? "offense" : index === 2 ? "recovery" : "defense",
                          visual = tacticalBuffVisual(faction, role);
                        return (
                            <span key={faction} className="help-buff-unit" style={{ "--buff-aura": visual.auraColor, "--buff-spark": visual.sparkColor } as CSSProperties}>
                            <i aria-hidden="true"><em /></i><b>{FACTIONS[faction].name}</b><small>{role === "defense" ? "방어 광원" : role === "offense" ? "공세 광원" : "회복 광원"}</small>
                          </span>
                        );
                      })}
                    </div>
                    <div className="help-tactical-roles">
                      {([[
                        "수비",
                        TACTICAL_SUPPORT.human.defense.cost,
                        "진군대 생존력을 즉시 강화",
                      ], [
                        "공세",
                        TACTICAL_SUPPORT.human.offense.cost,
                        "공격·이동·사거리 등을 강화",
                       ], [
                         "지역 타격",
                         TACTICAL_SUPPORT.human.area.cost,
                         "시야 안 열린 지점에 광역 공격",
                       ], [
                         "지속 회복",
                         TACTICAL_SUPPORT.human.recovery.cost,
                         "영웅·현재 진군대를 8초간 매초 3% 회복",
                       ], [
                         "긴급 증원",
                         TACTICAL_SUPPORT.human.reinforce.cost,
                         "일반 진군대 5명을 2.5초에 걸쳐 투입",
                       ]] as const).map(([name, cost, description]) => (
                        <span key={name}><kbd>{cost}₡</kbd><i><b>{name}</b><small>{description}</small></i></span>
                      ))}
                    </div>
                  </div>
                  <p>건설 메뉴에서 발동합니다. 다섯 전술은 팀 공용 <b>{TACTICAL_SHARED_COOLDOWN_MS / 1000}초</b> 재사용을 공유합니다. 활성화된 영웅·진군대에는 종족색 광원과 상태 표식이 표시됩니다.</p>
                  <ul><li><b>지역 타격</b> · 영웅 12칸 안, 현재 보이는 열린 땅을 지정</li><li><b>지속 회복</b> · 발동 시 생존한 영웅과 진군대를 총 24% 회복. 거점·설치물과 이후 새로 출전한 병력은 제외</li><li><b>진군대 연구</b> · WAVE 3/9/17/25에 순차 해금, LV.5까지 기존·신규 병력에 즉시 적용</li><li><b>정예병</b> · WAVE 6부터 150₡으로 다음 WAVE 한 자리를 대체 예약, 팀당 한 명</li><li><b>상시 지원 시설</b> · 팀당 한 채, 살아 있는 동안 현재·신규 진군대에 종족별 강화 적용</li><li><b>지역 제어 시설</b> · 감전·산성 지대·구속으로 길목을 지연하며 공격 시설 3개 상한에 포함</li></ul>
                </article>
                <article className="help-card items">
                  <header><span>08</span><b>아이템·생존·회복</b><small>Q/R 편성과 전선 복귀 수단</small></header>
                  <p className="help-item-rules">컴퓨터 대전은 Q/R에 고른 아이템을 <b>슬롯마다 2회</b> 사용합니다. Q/R은 1초 공용 대기시간을 공유합니다. 캠페인은 수복팩을 Q/R 각 1회 지급하며, 온라인 개인 아이템은 잠겨 있습니다.</p>
                  <div>
                    {(Object.keys(SUPPLY_ITEMS) as ItemId[]).map((id) => (
                      <span key={id}><CommandIcon kind={id} /><i><b>{SUPPLY_ITEMS[id].name}</b><small>{SUPPLY_ITEMS[id].effect}</small></i></span>
                    ))}
                  </div>
                  <ul><li><b>거점 안전 회복</b> · 자기 코어 4.5칸 안에서 마지막 피격 후 4초가 지나면 초당 최대 HP 6% 회복</li><li><b>회복 전술지원</b> · 생존기가 회복형이 아닌 영웅도 Ctrl+F 지원으로 8초간 회복 가능</li><li><b>영웅 전투불능</b> · 대전에서는 일정 시간 뒤 자기 거점에서 부활. 캠페인은 장별 실패 규칙이 우선</li><li><b>특성</b> · 영웅 LV.3·6·9에 HUD 특성 버튼을 열어 두 선택지 중 하나를 적용</li></ul>
                </article>
                <article className="help-card vision">
                  <header><span>09</span><b>시야·미니맵·화면 읽기</b><small>보이는 정보만 믿으세요</small></header>
                  <ul><li><b>검정</b> · 아직 탐사하지 않은 지역</li><li><b>어두운 지형</b> · 과거에 탐사했지만 현재 시야 밖인 지역. 적은 표시되지 않음</li><li><b>밝은 지형</b> · 현재 아군 시야. 적 유닛·설치물을 확인 가능</li><li><b>미니맵 클릭·드래그</b> · 해당 전장으로 카메라 이동. <kbd>Space</kbd>로 영웅에게 복귀</li><li><b>상단 바</b> · 양 팀 코어 HP·방어막, 현재 WAVE·모드 시간을 확인</li><li><b>전선 기록</b> · 화면 아래에서 사용 결과, 오류 원인과 다음 행동 안내 확인</li></ul>
                </article>
                <article className="help-card mobile">
                  <header><span>10</span><b>모바일 가로 플레이</b><small>화면 버튼으로 같은 규칙 사용</small></header>
                  <p>기기를 가로로 돌리면 전장이 세로로 넓어지고, 왼쪽 조작 레일에 방향 패드·기술·생존·아이템이 2열로 표시됩니다. 조준 기술은 버튼을 누른 채 방향을 정하고 놓습니다. A/B 전략과 건설은 <b>전술</b> 버튼으로 펼칩니다.</p>
                  <ul><li><b>전체화면</b> · 설정의 ‘가로 전체화면 시도’ 사용</li><li><b>상세 경로</b> · A/B 설정 후 전장을 탭해 경유점 추가</li><li><b>화면 이동</b> · 상세 편집 중 빈 곳을 드래그해 카메라 이동</li></ul>
                </article>
              </div>
                </div>
              )}
            </section>
          ) : (
            <section className="roster-panel" aria-label="캐릭터 편성">
              <div className="panel-heading">
                <span>
                  <b>컴퓨터와 대전 · 지하 투입 인원</b>
                  <small>
                    현재 검증 로스터 {HEROES.length}명 · 고유 능력치/장비/기술
                  </small>
                </span>
                <button
                  onClick={() => setMenuPanel("main")}
                  aria-label="뒤로 가기"
                >
                  ×
                </button>
              </div>
              <div className="skirmish-config">
                <div className="battle-ruleset-select" role="radiogroup" aria-label="대전 규칙 선택">
                  <b>대전 규칙</b>
                  <button role="radio" aria-checked={selectedRuleset === "secret-tunnel"} className={selectedRuleset === "secret-tunnel" ? "active" : ""} onClick={() => selectBattleRuleset("secret-tunnel")}>
                    <strong>비밀 굴착전</strong><small>30초 초고속 굴착 · 4분 침공</small>
                  </button>
                  <button role="radio" aria-checked={selectedRuleset === "open-front"} className={selectedRuleset === "open-front" ? "active" : ""} onClick={() => selectBattleRuleset("open-front")}>
                    <strong>개방 전선전</strong><small>기존 자유 굴착 · 무제한 전선</small>
                  </button>
                </div>
                <div className="team-size-select">
                  <b>대전 인원</b>
                  {([1, 2] as TeamSize[]).map((size) => (
                    <button key={size} className={skirmishTeamSize === size ? "active" : ""} onClick={() => setSkirmishTeamSize(size)}>
                      {size}:{size}
                    </button>
                  ))}
                </div>
                <div className="skirmish-difficulty-select" role="radiogroup" aria-label="컴퓨터 대전 난이도 선택">
                  <b>AI 난이도</b>
                  {(Object.keys(SKIRMISH_DIFFICULTIES) as SkirmishDifficulty[]).map((difficulty) => {
                    const definition = SKIRMISH_DIFFICULTIES[difficulty];
                    return (
                      <button
                        key={difficulty}
                        role="radio"
                        aria-checked={skirmishDifficulty === difficulty}
                        className={skirmishDifficulty === difficulty ? "active" : ""}
                        onClick={() => setSkirmishDifficulty(difficulty)}
                      >
                        <strong>{definition.label}</strong>
                        <small>{definition.callout}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="battle-map-select">
                  <b>전장 선택</b>
                  {battleMapsForRuleset(selectedRuleset).map((map) => (
                    <button key={map.id} className={selectedMapId === map.id ? "active" : ""} onClick={() => setSelectedMapId(map.id)}>
                      <strong>{map.name}</strong>
                      <small>{map.subtitle}</small>
                    </button>
                  ))}
                </div>
              </div>
              <nav className="faction-tabs">
                {(Object.keys(FACTIONS) as FactionId[]).map((id) => (
                  <button
                    key={id}
                    className={rosterFaction === id ? "active" : ""}
                    onClick={() => setRosterFaction(id)}
                  >
                    <i style={{ background: FACTIONS[id].color }} />
                    {FACTIONS[id].name}
                    <small>{FACTIONS[id].trait}</small>
                  </button>
                ))}
              </nav>
              <div className="roster-grid">
                {HEROES.filter((hero) => hero.faction === rosterFaction).map(
                  (hero) => (
                    <article key={hero.id} className={`playable ${selectedHeroId === hero.id ? "selected" : ""}`}>
                      <div className="roster-portrait" style={heroPortraitStyle(hero)} />
                      <span>
                        <b>{hero.name}</b>
                        <em>{hero.title}</em>
                        <small>
                          {hero.role} · {hero.weapon}
                        </small>
                        <small>{heroKit(hero.id).identity}</small>
                        <span className="roster-action-icons" aria-label="기술 구성">
                          <HeroKitIcon heroId={hero.id} slot="skill1" /><HeroKitIcon heroId={hero.id} slot="skill2" />
                          <HeroKitIcon heroId={hero.id} slot="ultimate" /><HeroKitIcon heroId={hero.id} slot="drill" />
                        </span>
                      </span>
                      <button onClick={() => {
                        setSelectedHeroId(hero.id);
                        const ally = HEROES.find((candidate) => candidate.faction === hero.faction && candidate.id !== hero.id);
                        if (ally) setSelectedAllyHeroId(ally.id);
                      }}>
                        {selectedHeroId === hero.id ? "선택됨" : "내 영웅 선택"}
                      </button>
                    </article>
                  ),
                )}
              </div>
              <section className="hero-detail-panel" aria-label="선택 영웅 상세 설명">
                <header>
                  <i className="hero-detail-portrait" style={heroPortraitStyle(activeHeroDef)} />
                  <span><b>{activeHeroDef.name}</b><small>{activeHeroDef.title} · {activeHeroDef.role}</small></span>
                  <p>{heroKit(activeHeroDef.id).identity}</p>
                </header>
                <div>
                  {([
                    ["기본", "basic", activeHeroDef.weapon, heroKit(activeHeroDef.id).basic.caption],
                    ["1", "skill1", activeHeroDef.skills[0], heroKit(activeHeroDef.id).skill1.caption],
                    ["2", "skill2", activeHeroDef.skills[1], heroKit(activeHeroDef.id).skill2.caption],
                    ["3", "ultimate", activeHeroDef.skills[3], heroKit(activeHeroDef.id).ultimate.caption],
                    ["4", "drill", activeHeroDef.skills[2], heroKit(activeHeroDef.id).drill.caption],
                    ["Shift", "survival", heroSurvivalPresentation(activeHeroDef.id).name, heroSurvivalPresentation(activeHeroDef.id).description],
                  ] as Array<[string, HeroKitActionSlot | "survival", string, string]>).map(([key, kind, name, description]) => (
                    <article key={key}><span className="detail-action-icon">{kind === "survival" ? <CommandIcon kind="survival" /> : <HeroKitIcon heroId={activeHeroDef.id} slot={kind} />}<kbd>{key}</kbd></span><span><b>{name}</b><small>{description}</small></span></article>
                  ))}
                </div>
              </section>
              <section className="loadout-select" aria-label="전투 전 아이템 선택">
                <header><b>투입 아이템 · 2개 선택</b><small>Q/R 슬롯 장착</small></header>
                <div>
                  {(Object.keys(SUPPLY_ITEMS) as ItemId[]).map((id) => {
                    const slot = selectedLoadout.indexOf(id), item = SUPPLY_ITEMS[id];
                    return <button key={id} className={slot >= 0 ? "active" : ""} onClick={() => setSelectedLoadout((current) => {
                      const next: [ItemId | null, ItemId | null] = [...current];
                      const existing = next.indexOf(id);
                      if (existing >= 0) next[existing] = null;
                      else {
                        const empty = next.indexOf(null);
                        next[empty >= 0 ? empty : 1] = id;
                      }
                      return next;
                    })}><span className="loadout-icon"><CommandIcon kind={id} /><kbd>{slot === 0 ? "Q" : slot === 1 ? "R" : "–"}</kbd></span><span><b>{item.name}</b><small>{item.effect}</small></span></button>;
                  })}
                </div>
              </section>
              {skirmishTeamSize === 2 && (
                <div className="ally-select">
                  <b>AI 동료 선택 · 같은 종족</b>
                  <div>
                    {HEROES.filter((hero) => hero.faction === activeHeroDef.faction && hero.id !== selectedHeroId).map((hero) => (
                      <button key={hero.id} className={selectedAllyHeroId === hero.id ? "active" : ""} onClick={() => setSelectedAllyHeroId(hero.id)}>
                        <i className="ally-portrait" style={heroPortraitStyle(hero)} /><span><strong>{hero.name}</strong><small>{hero.role}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button className="skirmish-start" onClick={() => startSkirmish(selectedHeroId)}>
                {selectedRuleset === "secret-tunnel" ? "비밀 굴착전" : "개방 전선전"} · {SKIRMISH_DIFFICULTIES[skirmishDifficulty].label} · {skirmishTeamSize}:{skirmishTeamSize} · {battleMap(selectedMapId).name} 시작
              </button>
            </section>
          )}
        </section>
        <aside className="title-lore">
          <div className="signal">
            <span>● LIVE</span>
            <b>지하 생존 방송</b>
            <small>“금일도 지상 출입은 권장하지 않습니다.”</small>
          </div>
          <div className="factions">
            <article>
              <i>H</i>
              <span>
                <b>휴먼</b>
                <small>고철과 화약</small>
              </span>
            </article>
            <article>
              <i>B</i>
              <span>
                <b>버그본</b>
                <small>턱과 산성</small>
              </span>
            </article>
            <article>
              <i>AI</i>
              <span>
                <b>기계지성</b>
                <small>센서와 전력</small>
              </span>
            </article>
          </div>
          <p>
            ※ 생존본부는 굴착 중 발생하는 실종, 변이 및 기계 반란에 책임지지
            않습니다.
          </p>
        </aside>
      </main>
    );
  const moveStart = (x: number, y: number) => () => {
      mobileMove.current = { x, y };
      const publishMove = () => publishOnlineInput({ type: "move", dx: x, dy: y });
      publishMove();
      if (mobileOnlineMoveTimerRef.current !== null)
        window.clearInterval(mobileOnlineMoveTimerRef.current);
      mobileOnlineMoveTimerRef.current = window.setInterval(publishMove, 300);
    },
    moveStop = () => {
      mobileMove.current = null;
      if (mobileOnlineMoveTimerRef.current !== null) {
        window.clearInterval(mobileOnlineMoveTimerRef.current);
        mobileOnlineMoveTimerRef.current = null;
      }
    };
  return (
    <main className="underground-game">
      {isSecretBattleUi && secretPhaseAnnouncement && (
        <section
          key={secretPhaseAnnouncement.key}
          className="secret-phase-announcement"
          role="status"
          aria-live="assertive"
        >
          <small>비밀 굴착전</small>
          <strong>{secretPhaseAnnouncement.title}</strong>
          <span>{secretPhaseAnnouncement.subtitle}</span>
        </section>
      )}
      <aside className="mobile-landscape-notice" aria-label="모바일 PC 플레이 권장 안내">
        <span><b>PC 환경 권장</b><small>원활한 플레이를 위해 PC 브라우저에서 접속해 주세요.</small></span>
      </aside>
      <header>
        <div>
          <b>아군 코어</b>
          <i>
            <span style={{ width: `${hud.ally / 6}%` }} />
          </i>
          <strong>
            {hud.ally} · 방어막 {Math.round(hud.allyShield)}
          </strong>
        </div>
        <h1>
          {isCampaign
            ? campaignChapter === 1
              ? hud.wave === 0
                ? `제1장 · 정찰 경보 · 미확인 개체 ${hud.enemies}기`
                : `제1장 · ${hud.wave}차 침입 · 침입체 ${hud.enemies}기`
              : campaignChapter === 3
                ? `제3장 · 격리 아레나 · 대련 상대 ${hud.enemies}명`
              : `제${campaignChapter}장 · ${selectedCampaignInfo.subtitle} · 적 ${hud.enemies}기${hud.missionTime ? ` · ${Math.floor(hud.missionTime / 60)}:${String(hud.missionTime % 60).padStart(2, "0")}` : ""}`
            : isSecretBattleUi
              ? `${hud.battlePhase === "prepare" ? "비밀 굴착" : hud.battlePhase === "assault" ? "침공" : "작전 종료"} ${Math.floor(hud.battleTime / 60)}:${String(hud.battleTime % 60).padStart(2, "0")} · ${battleMap(activeMatchConfig.mapId).name}`
              : `${battleMap(activeMatchConfig?.mapId ?? selectedMapId).name} · WAVE ${hud.wave} · 진군대 LV.${hud.minionLevel}`}
        </h1>
        <div className="red">
          <b>
            {isCampaign && campaignChapter === 1
              ? "BUGBORN INVASION"
              : isCampaign && campaignChapter === 2
                ? "PYEONGTAEK GATE"
                : isCampaign && campaignChapter === 5
                  ? "CHEONAN SURVIVAL CORE"
                : "적 코어"}
          </b>
          <i>
            <span
              style={{
                width: `${
                  isCampaign && campaignChapter === 1
                    ? Math.min(100, (hud.enemies / CAMPAIGN1_MAX_ACTIVE_INVADERS) * 100)
                    : hud.enemy / 6
                }%`,
              }}
            />
          </i>
          <strong>
            {isCampaign && campaignChapter === 1
              ? `현재 침입체 ${hud.enemies}기`
              : isCampaign && campaignChapter === 2
                ? "박사 호송 목적지"
                : isCampaign && campaignChapter === 5
                  ? "천안 연결 목표"
                : `${hud.enemy} · 방어막 ${Math.round(hud.enemyShield)}`}
          </strong>
        </div>
      </header>
      <button
        className="pause-trigger"
        onClick={togglePause}
        aria-label={activeMatchConfig?.kind === "online" ? "온라인 전투 메뉴" : "일시정지 메뉴"}
      >
        ESC 메뉴
      </button>
      <section className="minefield">
        {isSecretBattleUi && (
          <section className={`secret-phase-guide ${hud.battlePhase} ${hud.battleConnected ? "connected" : "disconnected"}`} aria-label="비밀 굴착전 진행 상태">
            <header>
              <span>{hud.battlePhase === "prepare" ? "준비 30초" : hud.battlePhase === "assault" ? "침공 4분" : "작전 종료"}</span>
              <strong>{Math.floor(hud.battleTime / 60)}:{String(hud.battleTime % 60).padStart(2, "0")}</strong>
            </header>
            {hud.battlePhase === "prepare" ? (
              <ol>
                <li><b>1</b> 적 거점 확인</li>
                <li><b>2</b> 터널 연결</li>
                <li><b>3</b> 광석·방어 선택</li>
              </ol>
            ) : (
              <p>A/B 공격로 개방 · {hud.routeAllocation === "50:50" ? "균등" : hud.routeAllocation === "75:25" ? "A 집중" : "B 집중"}</p>
            )}
            {hud.battlePhase !== "prepare" && (
              <div className="tunnel-zone-legend" aria-label="터널 구역 범례">
                <span className="own"><i aria-hidden="true" />아군 전용</span>
                <span className="opponent"><i aria-hidden="true" />적군 전용</span>
              </div>
            )}
            <em>{hud.battleConnected ? "유효 전선 연결" : "미연결 · 준비 종료 시 고립 패배"}</em>
          </section>
        )}
        {isCampaign && (
          <section
            className={`mission-objective-card ${missionGuideCollapsed ? "collapsed" : ""}`}
            role="complementary"
            aria-label="현재 작전 승패 조건"
          >
            <header>
              <span><small>CHAPTER {String(campaignChapter).padStart(2, "0")}</small><b>작전 목표</b></span>
              <button
                type="button"
                onClick={() => setMissionGuideCollapsed((collapsed) => !collapsed)}
                aria-expanded={!missionGuideCollapsed}
                aria-label={missionGuideCollapsed ? "작전 조건 펼치기" : "작전 조건 접기"}
              >
                {missionGuideCollapsed ? "펼치기" : "접기"}
              </button>
            </header>
            <p className="mission-progress"><i aria-hidden="true" />{missionProgress}</p>
            {!missionGuideCollapsed && (
              <div>
                <p className="victory"><strong>승리</strong><span>{selectedCampaignObjective.victory}</span></p>
                <p className="defeat"><strong>패배</strong><span>{selectedCampaignObjective.defeat}</span></p>
              </div>
            )}
          </section>
        )}
        <div className="battle-stage">
          <canvas ref={canvasRef} />
          <button
            className="minimap-hit"
            aria-label="미니맵 드래그로 관측 위치 이동"
            hidden={minimapCollapsed}
            onPointerDown={minimapDragStart}
            onPointerMove={minimapDragMove}
            onPointerUp={minimapDragEnd}
            onPointerCancel={minimapDragCancel}
            onLostPointerCapture={() => command("camera:end")}
          />
          <button
            className={`minimap-toggle ${minimapCollapsed ? "collapsed" : ""}`}
            onClick={toggleMinimap}
            aria-expanded={!minimapCollapsed}
            aria-label={minimapCollapsed ? "미니맵 펼치기" : "미니맵 접기"}
          >
            <span aria-hidden="true">{minimapCollapsed ? "▱" : "▾"}</span>
            {minimapCollapsed ? "지도 펼치기" : "접기"}
          </button>
        </div>
        <section className={`combat-command-dock ${mobileTacticsOpen ? "mobile-tactics-open" : ""}`} aria-label="전투 지휘 패널">
        <button
          className={`build-toggle ${buildChoice !== "none" || buildMenuOpen ? "active" : ""}`}
          onClick={() => {
            command("route:off");
            setRouteChoice("none");
            setQuickRouteChoice("none");
            setRouteDraftCount(0);
            setRouteMenuOpen(false);
            setSupplyMenuOpen(false);
            setBuildMenuOpen((v) => !v);
          }}
          aria-expanded={buildMenuOpen}
          aria-label={`${FACTIONS[activeHeroDef.faction].name} 건설 메뉴 열기`}
        >
          <kbd>B</kbd>
          <span>
            <b>
              {buildChoice === "none"
                ? "건설"
                : buildChoice === "demolish"
                  ? "철거"
                  : buildChoice === "upgrade"
                    ? "강화"
                    : (activeBuildMap[buildChoice]?.short ?? "건설")}
            </b>
          </span>
        </button>
        {buildMenuOpen && (
          <nav
            className="build-menu"
            aria-label={`${FACTIONS[activeHeroDef.faction].name} 설치물 건설 메뉴`}
          >
            <header>
              <b>{FACTIONS[activeHeroDef.faction].name} 건설반</b>
              <small>Ctrl+Z~M 설치·관리 · Ctrl+A~J 전술·연구</small>
            </header>
            {activeBuildables.map((def, index) => (
              <button
                key={def.id}
                className={buildChoice === def.id ? "active" : ""}
                onClick={() => {
                  command(`build:${def.id}`);
                  setBuildMenuOpen(false);
                }}
              >
                <kbd className="build-shortcut" title={buildHotkeyLabel(index)}>{buildHotkeyLabel(index)}</kbd>
                <img src={def.asset} alt="" />
                <span>
                  <b>{def.short}</b>
                  <small>
                    {def.cost}₡ ·{" "}
                    {def.control?.kind === "shock"
                      ? `3대상 감전 · ${(def.control.stunMs ?? 0) / 1000}초 지연`
                      : def.control?.kind === "acid"
                        ? `산성 폭발 · ${(def.control.fieldDurationMs ?? 0) / 1000}초 지대`
                        : def.control?.kind === "tether"
                          ? `2대상 구속 · ${(def.control.stunMs ?? 0) / 1000}초 지연`
                          : def.category === "multi"
                      ? "근거리 다중"
                      : def.category === "ranged"
                        ? def.id === "laserL1"
                          ? "직선 관통"
                          : def.id === "missileM2"
                            ? "쌍발 광역"
                            : "원거리 공격"
                        : def.category === "support"
                          ? def.supportAura?.kind === "attack"
                            ? `진군대 공격 +${Math.round(def.supportAura.value * 100)}% · 생존 중`
                            : def.supportAura?.kind === "speed"
                              ? `진군대 이동 +${Math.round(def.supportAura.value * 100)}% · 생존 중`
                              : `사격·정예 사거리 +${def.supportAura?.value ?? 0} · 생존 중`
                          : "길목 차단"}
                  </small>
                </span>
              </button>
            ))}
            <button
              className={`upgrade ${buildChoice === "upgrade" ? "active" : ""}`}
              onClick={() => {
                command("build:upgrade");
                setBuildMenuOpen(false);
              }}
            >
              <kbd className="build-action-shortcut" title={buildHotkeyLabel(5)}>{buildHotkeyLabel(5)}</kbd>
              <span>
                <b>2레벨 강화</b>
                <small>건설비 65% · 1.5초</small>
              </span>
            </button>
            <button
              className={`demolish ${buildChoice === "demolish" ? "active" : ""}`}
              onClick={() => {
                command("build:demolish");
                setBuildMenuOpen(false);
              }}
            >
              <kbd className="build-action-shortcut" title={buildHotkeyLabel(6)}>{buildHotkeyLabel(6)}</kbd>
              <span>
                <b>철거</b>
                <small>1초 · 상태 비례 50% 환급</small>
              </span>
            </button>
            {!isCampaign && (
              <section className="tactical-support-menu" aria-label="전술지원과 진군대 연구">
                <header><b>전술지원</b><small>{hud.tacticalCd ? `공용 대기 ${hud.tacticalCd}초` : `팀 공용 ${TACTICAL_SHARED_COOLDOWN_MS / 1000}초`}</small></header>
                <div>
                  {activeTacticalSupport.map((support, index) => (
                    <button
                      key={support.role}
                      disabled={hud.tacticalCd > 0 || hud.money < support.cost}
                      onClick={() => {
                        command(`tactical:${support.role}`);
                        setBuildMenuOpen(false);
                      }}
                    >
                      <kbd className="tactical-shortcut" title={buildHotkeyLabel(index + 7)}>{buildHotkeyLabel(index + 7)}</kbd>
                      <i aria-hidden="true">{support.role === "defense" ? "◈" : support.role === "offense" ? "⚡" : support.role === "area" ? "◎" : support.role === "recovery" ? "+" : "✦"}</i>
                      <span><b>{support.name}</b><small>{support.cost}₡ · {support.description}</small></span>
                    </button>
                  ))}
                </div>
                <button
                  className="minion-research"
                  disabled={!upcomingMinionResearch || hud.money < upcomingMinionResearch.cost || !minionResearchReady(upcomingMinionResearch.level, hud.wave)}
                  onClick={() => command("research:minion")}
                >
                  <kbd className="tactical-shortcut" title={buildHotkeyLabel(12)}>{buildHotkeyLabel(12)}</kbd>
                  <i aria-hidden="true">LV</i>
                  <span>
                    <b>진군대 연구 · 현재 LV.{hud.minionLevel}</b>
                    <small>{upcomingMinionResearch ? !minionResearchReady(upcomingMinionResearch.level, hud.wave) ? `WAVE ${minionResearchUnlockWave(upcomingMinionResearch.level)} 해금 · ${upcomingMinionResearch.cost}₡` : `${upcomingMinionResearch.cost}₡ · LV.${upcomingMinionResearch.level} 즉시 적용` : "LV.5 연구 완료"}</small>
                  </span>
                </button>
                <button
                  className="elite-reservation"
                  disabled={hud.wave < ELITE_UNLOCK_WAVE || hud.eliteReserved || hud.eliteActive || hud.eliteReadyIn > 0 || hud.money < ELITE_RESERVATION_COST}
                  onClick={() => command("elite:reserve")}
                >
                  <kbd className="tactical-shortcut" title={buildHotkeyLabel(13)}>{buildHotkeyLabel(13)}</kbd>
                  <i aria-hidden="true">★</i>
                  <span>
                    <b>정예병 예약 · {minionDefinition(activeHeroDef.faction, "elite").name}</b>
                    <small>
                      {hud.eliteReserved
                        ? "다음 진군대 출전 예약 완료"
                        : hud.eliteActive
                          ? "정예병 전선 활동 중"
                          : hud.wave < ELITE_UNLOCK_WAVE
                            ? `WAVE ${ELITE_UNLOCK_WAVE} 해금`
                            : hud.eliteReadyIn > 0
                              ? `재편성까지 ${hud.eliteReadyIn} WAVE`
                              : `${ELITE_RESERVATION_COST}₡ · 일반병 한 자리를 대체`}
                    </small>
                  </span>
                </button>
              </section>
            )}
          </nav>
        )}
        <div className="route-hotkeys route-command-panel allocation-routes" aria-label="A/B 진군 경로와 다음 웨이브 배분">
          <section className="route-lanes" aria-label="A/B 진군 경로">
            <span className="route-section-label"><b>전략 설정</b></span>
            {(["A", "B"] as RouteId[]).map((id) => (
              <button
                key={id}
                className={`route-badge${routeChoice === id ? " active" : ""}`}
                onClick={() => command(`route:${id}`)}
                title={`${id} 상세 수정 · Ctrl+${id === "A" ? "1" : "2"}는 커서 위치 빠른 지정`}
                aria-label={`${id} 경로 상세 수정 · Ctrl+${id === "A" ? "1" : "2"} 빠른 지정`}
              ><b>{id} 설정</b></button>
            ))}
          </section>
          <section className="route-allocation" aria-label="다음 웨이브 A/B 진군 배분">
            <span className="route-section-label"><b>배분</b><small>다음 WAVE</small></span>
            <div>
              {([[
                "50:50", "균등",
              ], [
                "75:25", "A 집중",
              ], [
                "25:75", "B 집중",
              ]] as Array<[TunnelRouteAllocation, string]>).map(([allocation, label]) => (
                <button key={allocation} className={hud.routeAllocation === allocation ? "active" : ""} onClick={() => command(`allocation:${allocation}`)}>
                  <b>{label}</b><small>{allocation.replace(":", "/")}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
        {(routeChoice !== "none" || quickRouteChoice !== "none") && (
          <section className="route-edit-toolbar" aria-label="진군 경로 수정 도구">
            {routeChoice !== "none" ? (
              <>
                <span><b>{routeChoice} 상세 경로</b><small>{routeDraftCount ? `${routeDraftCount}개 지점 · 마지막이 최종 목적지` : "맵을 순서대로 클릭"}</small></span>
                <button className="apply" disabled={!routeDraftCount} onClick={() => command("routeApply")}>적용</button>
                <button onClick={() => command("routeReset")}>초기화</button>
                <button onClick={() => command("routeCancel")}>취소</button>
              </>
            ) : (
              <>
                <span><b>{quickRouteChoice} 빠른 지정</b><small>맵에서 최종 목적지 한 곳 클릭</small></span>
                <button onClick={() => command("routeCancel")}>취소</button>
              </>
            )}
          </section>
        )}
        <aside>
          <div className="active hero-status">
            <kbd
              className="hero-face"
              style={
                activeHeroDef.id === "c999"
                  ? {
                      backgroundImage:
                        "url(/assets/characters/sprites/roster-v1/ai-c999-director-actions-v2.png)",
                      backgroundSize: "600% 100%",
                      backgroundPosition: "0 center",
                    }
                  : { backgroundImage: `url(${activeHeroDef.portrait})` }
              }
            >
              {activeHeroDef.name.slice(0, 1)}
            </kbd>
            <b>
              {activeHeroDef.name} · LV.{hud.level}
            </b>
            <span
              className={`hero-health ${hud.hp / hud.maxHp < 0.3 ? "danger" : ""}`}
            >
              <em
                style={{ width: `${Math.max(0, (hud.hp / hud.maxHp) * 100)}%` }}
              />
              <strong>
                HP {hud.hp} / {hud.maxHp}
              </strong>
            </span>
            <small className="hero-progress">XP {hud.xp}/{hud.nextXp}</small>
            <small className="hero-resources">
              {hud.money}₡ · 아 {hud.allies} · 적 {hud.enemies} · 탐 {hud.explored}%
            </small>
            <button
              className={`talent-ready ${pendingTalentTiers.length ? "available" : ""}`}
              onClick={() => {
                const reviewTier = selectedTalentIds
                  .map((id) => heroTalentById(activeHeroDef.id, id)?.level)
                  .find((level): level is TalentTier => level !== undefined);
                openTalentTier(pendingTalentTiers[0] ?? reviewTier ?? null);
              }}
              disabled={!pendingTalentTiers.length && !selectedTalentIds.length}
              aria-label={pendingTalentTiers.length ? `선택 가능한 특성 ${pendingTalentTiers.length}개` : "선택한 특성 확인"}
            >
              <TalentIcon kind="ultimate" accent="#ffe071" />
              <span>
                <b>{pendingTalentTiers.length ? `특성 ${pendingTalentTiers.length}` : `특성 ${selectedTalentIds.length}/${TALENT_LEVELS.length}`}</b>
                <small>{pendingTalentTiers.length ? "선택 가능" : selectedTalentIds.length ? "선택 내역" : "미선택"}</small>
              </span>
            </button>
          </div>
        </aside>
        <div className="utilitybar" aria-label="공용 행동과 아이템">
          <button
            className="icon-command"
            onClick={() => command("survival")}
            disabled={!!hud.survivalCd}
            data-tooltip={`${["yoo-seungcheon", "hoebun"].includes(activeHeroDef.id) ? "벽 넘기 점프" : ["ahn-seona", "r486"].includes(activeHeroDef.id) ? "응급 회복" : ["kang-ryeokhan", "cheolgak", "g77", "c999"].includes(activeHeroDef.id) ? "버티기" : "긴급 회피"} · 위기에서 즉시 사용하는 생존 행동`}
            title="생존 행동 · 위기에서 즉시 사용"
          >
            <CommandIcon kind="survival" />
            <kbd>SHIFT</kbd>
            <span className="command-state">{hud.survivalCd ? `${hud.survivalCd}s` : "준비"}</span>
          </button>
          <button
            className={`icon-command ${hud.fillMode ? "active" : ""}`}
            onClick={() => command("fill")}
            disabled={isSecretBattleUi && hud.battlePhase !== "prepare"}
            data-tooltip="커서 위치 땅 메우기 · E 즉시 시전 · 15 크레딧"
            title="커서 위치 땅 메우기 · 15 크레딧"
          >
            <CommandIcon kind="fill" />
            <kbd>E</kbd>
            <span className="command-state">{hud.fillCd ? `${hud.fillCd}s` : "15₡"}</span>
          </button>
          <button
            className={`icon-command ${!hud.item1 ? "empty" : ""}`}
            onClick={() => command("item1")}
            disabled={activeMatchConfig?.kind === "online" || !!hud.itemCd}
            data-tooltip={hud.item1 ? `${SUPPLY_ITEMS[hud.item1].name} ×${hud.item1Charges} · ${SUPPLY_ITEMS[hud.item1].effect}` : "Q 빈 슬롯 · 전투 전에 아이템을 선택하세요"}
            title={hud.item1 ? `${SUPPLY_ITEMS[hud.item1].name} ×${hud.item1Charges} · ${SUPPLY_ITEMS[hud.item1].effect}` : "Q 빈 슬롯"}
          >
            <CommandIcon kind={hud.item1 ?? "medKit"} />
            <kbd>Q</kbd>
            <span className="command-state">{activeMatchConfig?.kind === "online" ? "온라인 잠금" : hud.itemCd ? `${hud.itemCd}s` : hud.item1 ? `사용 ×${hud.item1Charges}` : "비어 있음"}</span>
          </button>
          <button
            className={`icon-command ${!hud.item2 ? "empty" : ""}`}
            onClick={() => command("item2")}
            disabled={activeMatchConfig?.kind === "online" || !!hud.itemCd}
            data-tooltip={hud.item2 ? `${SUPPLY_ITEMS[hud.item2].name} ×${hud.item2Charges} · ${SUPPLY_ITEMS[hud.item2].effect}` : "R 빈 슬롯 · 전투 전에 아이템을 선택하세요"}
            title={hud.item2 ? `${SUPPLY_ITEMS[hud.item2].name} ×${hud.item2Charges} · ${SUPPLY_ITEMS[hud.item2].effect}` : "R 빈 슬롯"}
          >
            <CommandIcon kind={hud.item2 ?? "armorPlate"} />
            <kbd>R</kbd>
            <span className="command-state">{activeMatchConfig?.kind === "online" ? "온라인 잠금" : hud.itemCd ? `${hud.itemCd}s` : hud.item2 ? `사용 ×${hud.item2Charges}` : "비어 있음"}</span>
          </button>
        </div>
        <div className="skillbar">
          <button
            className={`icon-command ${selected === 1 ? "active" : ""}`}
            onClick={() => command("skill1")}
            data-tooltip={`${activeHeroDef.skills[0]} · 기본 공격 · 클릭 즉시`}
            title={`${activeHeroDef.skills[0]} · 기본 공격 · 클릭 즉시`}
          >
            <CommandIcon kind="skill1" />
            <kbd>1</kbd>
            <span className="command-state">{hud.cd1 ? `${hud.cd1}s` : "즉시"}</span>
          </button>
          <button
            className={`icon-command ${selected === 2 ? "active" : ""}`}
            onPointerDown={skillHoldStart(2)}
            onPointerMove={skillHoldMove}
            onPointerUp={skillHoldEnd(2)}
            onPointerCancel={skillHoldCancel}
            data-tooltip={`${activeHeroDef.skills[1]} · 누르고 조준한 뒤 놓아 발동`}
            title={`${activeHeroDef.skills[1]} · 누르고 조준한 뒤 놓아 발동`}
          >
            <CommandIcon kind="skill2" />
            <kbd>2</kbd>
            <span className="command-state">{hud.cd2 ? `${hud.cd2}s` : "조준"}</span>
          </button>
          <button
            className={`icon-command ultimate-command ${selected === 3 ? "active" : ""}`}
            onPointerDown={skillHoldStart(3)}
            onPointerMove={skillHoldMove}
            onPointerUp={skillHoldEnd(3)}
            onPointerCancel={skillHoldCancel}
            data-tooltip={`3번 고유기 · ${activeHeroDef.skills[3]} · 누르고 조준한 뒤 놓아 발동`}
            title={`3번 고유기 · ${activeHeroDef.skills[3]} · 누르고 조준한 뒤 놓아 발동`}
          >
            <CommandIcon kind="ultimate" />
            <kbd>3</kbd>
            <span className="command-state">{hud.cd4 ? `${hud.cd4}s` : "조준"}</span>
          </button>
          <button className="icon-command" disabled={isSecretBattleUi && hud.battlePhase !== "prepare"} onClick={() => command("skill4")} data-tooltip={isSecretBattleUi && hud.battlePhase !== "prepare" ? "지반 고정 · 침공 중 굴착 불가" : `굴착 · ${activeHeroDef.skills[2]} · 클릭 즉시 발동`} title={isSecretBattleUi && hud.battlePhase !== "prepare" ? "지반 고정" : `굴착 · ${activeHeroDef.skills[2]} · 클릭 즉시 발동`}>
            <CommandIcon kind="drill" />
            <kbd>4</kbd>
            <span className="command-state">{isSecretBattleUi && hud.battlePhase !== "prepare" ? "지반 고정" : hud.cd3 ? `${hud.cd3}s` : "굴착"}</span>
          </button>
        </div>
        <div className="mobile-pad">
          <button
            onPointerDown={moveStart(0, -1)}
            onPointerUp={moveStop}
            onPointerCancel={moveStop}
            onPointerLeave={moveStop}
          >
            ▲
          </button>
          <button
            onPointerDown={moveStart(-1, 0)}
            onPointerUp={moveStop}
            onPointerCancel={moveStop}
            onPointerLeave={moveStop}
          >
            ◀
          </button>
          <button
            onPointerDown={moveStart(1, 0)}
            onPointerUp={moveStop}
            onPointerCancel={moveStop}
            onPointerLeave={moveStop}
          >
            ▶
          </button>
          <button
            onPointerDown={moveStart(0, 1)}
            onPointerUp={moveStop}
            onPointerCancel={moveStop}
            onPointerLeave={moveStop}
          >
            ▼
          </button>
        </div>
        <button
          className={`mobile-tactics-toggle ${mobileTacticsOpen ? "active" : ""}`}
          onClick={() => setMobileTacticsOpen((open) => !open)}
          aria-expanded={mobileTacticsOpen}
          aria-label={mobileTacticsOpen ? "모바일 전술 메뉴 접기" : "모바일 전술 메뉴 펼치기"}
        >
          <kbd>◎</kbd>
          <span>{mobileTacticsOpen ? "전술 닫기" : "전술"}</span>
        </button>
        </section>
      </section>
      <footer>
        <b>◈ 전선 기록</b>
        <p>{message}</p>
        <span>
          클릭 이동·굴착 · Ctrl+클릭 공격 · 1~4 기술 · Ctrl+Z~M 건설 · Ctrl+A~J 전술 · Ctrl+1/2 A/B 빠른 지정
        </span>
      </footer>
      {talentTierOpen && !outcome && (
        <aside
          className="talent-drawer"
          role="dialog"
          aria-modal="false"
          aria-label={`${activeHeroDef.name} 특성 선택`}
        >
          <header>
            <span><small>LEVEL {talentTierOpen} ADAPTATION</small><b>{activeHeroDef.name} · 지하 적응</b></span>
            <button onClick={() => openTalentTier(null)} aria-label="특성 창 닫기">×</button>
          </header>
          <nav aria-label="특성 단계">
            {TALENT_LEVELS.map((level) => {
              const chosen = selectedTalentIds
                .map((id) => heroTalentById(activeHeroDef.id, id))
                .find((talent) => talent?.level === level);
              return (
                <button
                  key={level}
                  className={`${talentTierOpen === level ? "active" : ""} ${chosen ? "chosen" : ""}`}
                  disabled={!pendingTalentTiers.includes(level) && !chosen}
                  onClick={() => openTalentTier(level)}
                >
                  <b>LV.{level}</b><small>{chosen?.name ?? (pendingTalentTiers.includes(level) ? "선택 가능" : "잠김")}</small>
                </button>
              );
            })}
          </nav>
          {displayedTalent ? (
            <section className="talent-selected-card" style={{ "--talent-accent": displayedTalent.accent } as CSSProperties}>
              <TalentIcon kind={displayedTalent.icon} accent={displayedTalent.accent} />
              <span><small>LV.{displayedTalent.level} · 선택 완료</small><b>{displayedTalent.name}</b><p>{displayedTalent.description}</p></span>
              <em>적용 중</em>
            </section>
          ) : (
            <div className="talent-choices">
              {heroTalentChoices(activeHeroDef.id, talentTierOpen).map((talent, index) => (
                <button key={talent.id} onClick={() => chooseTalent(talent.id)} style={{ "--talent-accent": talent.accent } as CSSProperties}>
                  <TalentIcon kind={talent.icon} accent={talent.accent} />
                  <span><small>{index === 0 ? "A · 변형" : "B · 강화"}</small><b>{talent.name}</b><p>{talent.description}</p></span>
                  <em>선택</em>
                </button>
              ))}
            </div>
          )}
          <footer>전투는 계속 진행됩니다 · 지금 선택하지 않아도 특성 포인트는 유지됩니다.</footer>
        </aside>
      )}
      {paused && !outcome && (
        <div
          className="pause-menu"
          role="dialog"
          aria-modal="true"
          aria-label={activeMatchConfig?.kind === "online" ? "온라인 전투 메뉴" : "일시정지"}
        >
          <article>
            <span>{activeMatchConfig?.kind === "online" ? "ONLINE MATCH MENU" : "OPERATION SUSPENDED"}</span>
            <h2>{activeMatchConfig?.kind === "online" ? "온라인 전투 메뉴" : "작전 일시정지"}</h2>
            <p>{activeMatchConfig?.kind === "online" ? "메뉴가 열려 있어도 상대와 전투 시간은 계속 진행됩니다." : "지하 전선 시간이 정지했습니다."}</p>
            <button onClick={togglePause}>{activeMatchConfig?.kind === "online" ? "게임으로 돌아가기" : "계속하기"}</button>
            <button className="exit" onClick={exitToMenu}>
              첫 화면으로
            </button>
            <small>ESC 키로 {activeMatchConfig?.kind === "online" ? "메뉴를 닫을" : "계속할"} 수 있습니다.</small>
          </article>
        </div>
      )}
      {outcome && (
        <div className={`result ${outcome}`}>
          <article>
            <span>
              {outcome === "win"
                ? isCampaign
                  ? `CHAPTER ${String(campaignChapter).padStart(2, "0")} COMPLETE`
                  : isSecretBattleUi
                    ? "TUNNEL OPERATION WON"
                    : "ENEMY CORE COLLAPSED"
                : outcome === "draw"
                  ? isSecretBattleUi ? "TUNNEL OPERATION DRAW" : "BOTH CORES STANDING"
                : isCampaign && defeatSummary
                  ? "HERO COMBAT DISABLED"
                  : isSecretBattleUi ? "TUNNEL OPERATION FAILED" : "ALLY CORE COLLAPSED"}
            </span>
            <h2>
              {outcome === "win"
                ? isCampaign
                  ? `제${campaignChapter}장 작전 성공`
                  : isSecretBattleUi ? "비밀 굴착 작전 승리" : "지하 전선 돌파"
                : outcome === "draw"
                  ? "쌍방 생존 · 작전 무승부"
                  : isCampaign
                    ? `제${campaignChapter}장 작전 실패`
                    : isSecretBattleUi ? "비밀 굴착 작전 실패" : "생존 거점 함락"}
            </h2>
            <p>
              {outcome === "win"
                ? isCampaign
                  ? `${selectedCampaignInfo.title} 작전을 완료했습니다.`
                  : isSecretBattleUi
                    ? message
                    : "네가 만든 땅굴을 따라 아군이 적 거점을 무너뜨렸습니다."
                : outcome === "draw"
                  ? isSecretBattleUi
                    ? message
                    : "코어와 방어막 우위를 가리지 못했습니다. 굴착량이나 처치 수는 승패에 사용하지 않습니다."
                : isCampaign && defeatSummary
                  ? `${defeatSummary.killer}의 ${defeatSummary.action}에 ${defeatSummary.amount} 피해를 받고 전투불능이 되었습니다.`
                  : isCampaign
                    ? `${selectedCampaignInfo.title} 작전 조건을 달성하지 못했습니다.`
                    : isSecretBattleUi ? message : "적 굴착대가 우리 생존 거점을 파괴했습니다."}
            </p>
            {outcome === "lose" && isCampaign && defeatSummary && (
              <section className="defeat-recap" aria-label="최근 피해 기록">
                <b>최근 피해 기록</b>
                {defeatSummary.recent.map((record, index) => (
                  <span key={`${record.attacker}-${record.action}-${index}`}>
                    <i>{record.attacker}</i>
                    <em>{record.action}</em>
                    <strong>{record.critical ? "치명타 " : ""}{record.amount}</strong>
                  </span>
                ))}
              </section>
            )}
            {activeMatchConfig?.kind === "online"
              ? <button onClick={returnToOnlineRoom}>온라인 방으로</button>
              : isCampaign
                ? <button onClick={() => void launchCampaignMission()} disabled={campaignAssetsLoading}>{campaignAssetsLoading ? "전투 준비 중…" : "다시 플레이"}</button>
                : <button onClick={restartComputerBattle}>다시 플레이</button>}
            <button onClick={isCampaign ? () => { setOutcome(null); setScreen("chapters"); } : exitToMenu}>
              {isCampaign ? "작전 지도" : "첫 화면으로"}
            </button>
          </article>
        </div>
      )}
    </main>
  );
}
