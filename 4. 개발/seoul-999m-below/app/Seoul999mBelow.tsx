"use client";
/* Canvas simulation callbacks intentionally own mutable refs and imperative frame state. */
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/purity, prefer-const */
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BUILDABLES,
  FACTION_BASES,
  FACTIONS,
  HEROES,
  HERO_LEVELS,
  MINION_LEVELS,
  YOO_TALENTS,
  factionBuildables,
  minionDefinition,
  type BuildableDefinition,
  type FactionId,
  type MinionRole,
} from "../game/content";
import { heroKit } from "../game/heroKits";
import { heroAction } from "../game/heroActions";
import { heroFramePlan } from "../game/heroPresentation";
import { decideHeroAction, type HeroBrainRole } from "../game/heroBrain";
import { siegeResponse } from "../game/aiSiegeRules";
import { BATTLE_MAPS, applyBattleMapLayout, battleMap, resolveBattleSpawns } from "../game/battleMaps";
import { buildPlacementCost } from "../game/buildRules";
import { coreRegenAmount, emergencyRepairAmount } from "../game/healingRules";
import { gameAudio, type CombatSfx } from "../game/combatAudio";
import { canDamageCore, exposedCoreDamage } from "../game/coreCombatRules";
import { canEmergencyBreach } from "../game/minionBreachRules";
import { CAMPAIGN1_MAX_ACTIVE_INVADERS, CAMPAIGN1_RETREAT_AFTER_MS, CAMPAIGN1_WAVE_COUNTS, campaign1AdvanceWatch, campaign1BossShouldEnter, campaign1VictoryReady, shouldRemoveSpawnOrder, shouldUseCampaign1GuardGoal } from "../game/campaignRules";
import { createComputerMatch, createOnlineMatch, type BattleMapId, type MatchConfig, type TeamSize } from "../game/matchConfig";
import { roomCanStart, type OnlineRoomView, type RoomClientIdentity } from "../game/onlineRoom";
import type { OnlineBattleCommand, OnlineBattleSnapshot } from "../game/onlineRoom";
import { createOnlineRoom, joinOnlineRoom, readOnlineRoom, sendOnlineBattleCommand, sendOnlineBattleSnapshot, updateOnlineRoom } from "../game/onlineRoomClient";
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

type RouteStance = "assault" | "guard" | "capture";
type GameMode = "skirmish" | "campaign1";
type CampaignDifficulty = "easy" | "normal" | "hard";
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
};
type DamageRecord = { attacker: string; action: string; amount: number; critical: boolean };
type DefeatSummary = { killer: string; action: string; amount: number; recent: DamageRecord[] };
type WallBomb = { x: number; y: number; team: Team; armedAt: number };
type ItemId = "wallBomb" | "energyDrink" | "medKit" | "armorPlate" | "scanner" | "phaseBoots";
type JumpVisual = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
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
  stance: RouteStance;
  points: Array<{ x: number; y: number }>;
  revision: number;
};
const COLS = 56,
  ROWS = 36,
  S = 40,
  W = COLS * S,
  H = ROWS * S,
  VW = 760,
  VH = 500,
  DIRS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ],
  MINIMAP = { x: VW - 180, y: VH - 124, w: 168, h: 108 };
const WALKABLE_TERRAIN = new Set([0, 9, 10, 11]);
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
  normal: { label: "보통", callout: "영웅·진군대 LV.1 · 피해 12% 감소 · 성장 보정", heroLevel: 1, minionLevel: 1, allyHp: 1.15, allyDamage: 1.04, incomingDamage: 0.88, xpGain: 1.1 },
  hard: { label: "어려움", callout: "영웅·진군대 LV.1 · 생존 및 성장 보정 없음", heroLevel: 1, minionLevel: 1, allyHp: 1, allyDamage: 1, incomingDamage: 1, xpGain: 1 },
};
const BUILD_BY_ID = Object.fromEntries(
  BUILDABLES.map((def) => [def.id, def]),
) as Record<string, BuildableDefinition>;
const SUPPLY_ITEMS: Record<
  ItemId,
  { name: string; effect: string; icon: string }
> = {
  wallBomb: {
    name: "벽 매설 폭탄",
    effect: "흙벽에 숨겨 적 굴착 시 폭발",
    icon: "◆",
  },
  energyDrink: {
    name: "에너지 드링크",
    effect: "체력 20% 회복 · 5초 가속",
    icon: "▥",
  },
  medKit: { name: "응급 수복팩", effect: "체력 90% 즉시 회복", icon: "+" },
  armorPlate: { name: "복합 장갑판", effect: "8초간 방어력 강화", icon: "▰" },
  scanner: { name: "진동 탐지기", effect: "주변 8칸 지형과 위협 탐지", icon: "◎" },
  phaseBoots: { name: "위상 장화", effect: "10초 가속 · 1초 회피", icon: "≫" },
};
const MENU_SCENES = [
  "scene-01-dead-seoul.png", "scene-02-descent.png", "scene-03-air-purification-layer.png",
  "scene-04-underground-seoul.png", "scene-05-scrap-rebuilding.png", "scene-06-secret-tunnels.png",
  "scene-07-tunnel-threats.png", "scene-08-discovery.png",
];
const MenuSceneBackdrop = () => (
  <div className="menu-scene-backdrop" aria-hidden="true">
    {MENU_SCENES.map((scene, index) => (
      <img key={scene} src={`/assets/opening/scenes-v12/${scene}`} style={{ animationDelay: `${index * 5}s` }} alt="" />
    ))}
  </div>
);
type CommandIconKind = "survival" | "fill" | "skill1" | "skill2" | "ultimate" | "drill" | ItemId;
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
export default function Seoul999mBelow() {
  const [screen, setScreen] = useState<
      "intro" | "prologue" | "chapters" | "briefing" | "play"
    >("intro"),
    [gameMode, setGameMode] = useState<GameMode>("skirmish"),
    [campaignChapter, setCampaignChapter] = useState<1 | 2 | 3 | 4 | 5>(1),
    [campaignDifficulty, setCampaignDifficulty] = useState<CampaignDifficulty>("easy"),
    [outcome, setOutcome] = useState<"win" | "lose" | null>(null),
    [defeatSummary, setDefeatSummary] = useState<DefeatSummary | null>(null),
    [selected, setSelected] = useState<Skill>(0),
    [buildChoice, setBuildChoice] = useState<BuildMode>("none"),
    [buildMenuOpen, setBuildMenuOpen] = useState(false),
    [, setSupplyMenuOpen] = useState(false),
    [, setRouteMenuOpen] = useState(false),
    [, setRouteChoice] = useState<RouteId | "none">("none");
  const [paused, setPaused] = useState(false);
  const [menuPanel, setMenuPanel] = useState<"main" | "together" | "roster">(
      "main",
    ),
    [nickname, setNickname] = useState("굴착자"),
    [roomCode, setRoomCode] = useState(""),
    [lobbyNotice, setLobbyNotice] = useState(
      "게스트 통신망 · 로그인 없이 참가",
    );
  const [rosterFaction, setRosterFaction] = useState<FactionId>("human"),
    [routeStances, setRouteStances] = useState<Record<RouteId, RouteStance>>({ A: "guard", B: "guard" }),
    [selectedHeroId, setSelectedHeroId] = useState("yoo-seungcheon"),
    [selectedAllyHeroId, setSelectedAllyHeroId] = useState("kimssi"),
    [skirmishTeamSize, setSkirmishTeamSize] = useState<TeamSize>(1),
    [selectedMapId, setSelectedMapId] = useState<BattleMapId>("central-exchange"),
    [selectedLoadout, setSelectedLoadout] = useState<[ItemId | null, ItemId | null]>([
      "wallBomb",
      "energyDrink",
    ]),
    [activeMatchConfig, setActiveMatchConfig] = useState<MatchConfig | null>(null),
    [onlineRoom, setOnlineRoom] = useState<OnlineRoomView | null>(null),
    [onlineIdentity, setOnlineIdentity] = useState<RoomClientIdentity | null>(null),
    [onlineBusy, setOnlineBusy] = useState(false),
    [talentPrompt, setTalentPrompt] = useState<3 | 5 | null>(null),
    [minimapCollapsed, setMinimapCollapsed] = useState(false),
    [audioReady, setAudioReady] = useState(false);
  const [hud, setHud] = useState({
      ally: 600,
      enemy: 600,
      allyShield: 180,
      enemyShield: 180,
      hp: 180,
      maxHp: 180,
      money: 120,
      wave: 0,
      allies: 0,
      enemies: 0,
      explored: 1,
      level: 1,
      xp: 0,
      nextXp: 90,
      minionLevel: 1,
      cd1: 0,
      cd2: 0,
      cd3: 0,
      cd4: 0,
      fillCd: 0,
      fillMode: false,
      survivalCd: 0,
      item1: null as ItemId | null,
      item2: null as ItemId | null,
      missionTime: 0,
    }),
    [message, setMessage] = useState("유승천의 파란 드릴로 땅굴을 열어라.");
  useEffect(() => {
    const unlock = () => void gameAudio.unlock().then(() => setAudioReady(true));
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);
  useEffect(() => {
    if (screen === "prologue") gameAudio.stopMusic();
    else if (screen !== "play") void gameAudio.startMenu();
  }, [screen]);
  useEffect(() => {
    if (screen === "play" && outcome) void gameAudio.result(outcome);
  }, [outcome, screen]);
  const canvasRef = useRef<HTMLCanvasElement>(null),
    commands = useRef<string[]>([]),
    mobileMove = useRef<{ x: number; y: number } | null>(null),
    pausedRef = useRef(false),
    minimapCollapsedRef = useRef(false),
    talentPromptRef = useRef<3 | 5 | null>(null),
    onlineStartedRef = useRef(false),
    onlineCommandInboxRef = useRef<OnlineBattleCommand[]>([]),
    lastOnlineCommandRef = useRef(0),
    lastOnlineSnapshotRef = useRef(0),
    onlineSnapshotRef = useRef<OnlineBattleSnapshot | null>(null),
    onlineAiPlayersRef = useRef<Set<string>>(new Set()),
    isCampaign = gameMode === "campaign1";
  const command = (v: string) => {
      if (!pausedRef.current) {
        commands.current.push(v);
        if (v === "skill1") publishOnlineInput({ type: "skill", slot: 1 });
        else if (v === "release2") publishOnlineInput({ type: "skill", slot: 2 });
        else if (v === "release3") publishOnlineInput({ type: "skill", slot: 4 });
        else if (v === "skill4") publishOnlineInput({ type: "drill" });
      }
    },
    chooseTalent = (id: string) => {
      commands.current.push(`talent:${id}`);
      talentPromptRef.current = null;
      pausedRef.current = false;
      setPaused(false);
    },
    queueAimPointer = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect(),
        x = ((clientX - r.left) / r.width) * VW,
        y = ((clientY - r.top) / r.height) * VH;
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
  const minimapMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect(),
        x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      command(`camera:${x}:${y}`);
    },
    minimapDragStart = (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      minimapMove(e);
    },
    minimapDragMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) minimapMove(e);
    },
    minimapDragEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    },
    toggleMinimap = () => {
      minimapCollapsedRef.current = !minimapCollapsedRef.current;
      setMinimapCollapsed(minimapCollapsedRef.current);
    };
  const togglePause = () => {
    if (screen !== "play" || outcome) return;
    pausedRef.current = !pausedRef.current;
    mobileMove.current = null;
    setPaused(pausedRef.current);
  };
  const exitToMenu = () => {
    pausedRef.current = false;
    talentPromptRef.current = null;
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
    setTalentPrompt(null);
    setGameMode("skirmish");
    setMenuPanel("main");
    setScreen("intro");
  };
  const activeHeroDef =
    HEROES.find((hero) => hero.id === selectedHeroId) ?? HEROES[0];
  const campaignChapterInfo = {
    1: { title: "새벽 3시, 환풍구가 울었다", subtitle: "환풍구 방어전", description: "두 차례의 버그본 침입을 막고 서울 거점을 지켜라.", asset: null },
    2: { title: "평택으로 가는 표본", subtitle: "박사 호송", description: "박사 3명 중 한 명 이상을 평택 연구소 입구까지 호송하라.", asset: "/assets/campaign/scientists/scientists-v1.png" },
    3: { title: "평택 연구소의 밤", subtitle: "격리 아레나", description: "격리실에서 세 동료와 끝까지 겨뤄 의견 차이를 풀어라.", asset: null },
    4: { title: "군체의 둥지", subtitle: "거점 시간 공략", description: "김씨와 함께 제한 시간 안에 버그본 코어를 파괴하라.", asset: null },
    5: { title: "천안으로 가는 길", subtitle: "붕괴 터널", description: "두 대원과 함께 천안거점까지 새 터널을 뚫어라.", asset: null },
  } as const;
  const selectedCampaignInfo = campaignChapterInfo[campaignChapter];
  const activeBuildables = factionBuildables(activeHeroDef.faction),
    activeBuildMap = Object.fromEntries(
      activeBuildables.map((def) => [def.id, def]),
    ) as Record<string, BuildableDefinition>;
  const startSkirmish = (heroId: string) => {
    const hero = HEROES.find((candidate) => candidate.id === heroId),
      fallbackAlly = HEROES.find((candidate) => candidate.faction === hero?.faction && candidate.id !== heroId),
      allyId = HEROES.some((candidate) => candidate.id === selectedAllyHeroId && candidate.faction === hero?.faction && candidate.id !== heroId)
        ? selectedAllyHeroId
        : fallbackAlly?.id;
    setActiveMatchConfig(createComputerMatch({
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
        teamSize: skirmishTeamSize, mapId: selectedMapId,
      });
      setOnlineRoom(result.room);
      setOnlineIdentity(result.identity);
      setRoomCode(result.room.code);
      window.localStorage.setItem(`seoul999m-room-${result.room.code}`, JSON.stringify({ ...result.identity, nickname }));
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
      const stored = window.localStorage.getItem(`seoul999m-room-${roomCode}`);
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
      window.localStorage.setItem(`seoul999m-room-${result.room.code}`, JSON.stringify({ ...result.identity, nickname }));
      setLobbyNotice(`방 ${result.room.code} 참가 완료`);
      onlineStartedRef.current = false;
    } catch (error) {
      setLobbyNotice(error instanceof Error ? error.message : "방 참가 실패");
    } finally { setOnlineBusy(false); }
  };
  const roomAction = async (action: "ready" | "unready" | "start" | "leave" | "rematch") => {
    if (!onlineRoom || !onlineIdentity || onlineBusy) return;
    setOnlineBusy(true);
    try {
      const result = await updateOnlineRoom(onlineRoom.code, onlineIdentity, action);
      setOnlineRoom(result.room);
      if (action === "rematch") {
        onlineStartedRef.current = false;
        onlineSnapshotRef.current = null;
        lastOnlineSnapshotRef.current = 0;
        setLobbyNotice("재대전 준비 · 전 대원이 다시 준비해야 합니다.");
      }
      if (action === "leave") {
        window.localStorage.removeItem(`seoul999m-room-${onlineRoom.code}`);
        setOnlineRoom(null);
        setOnlineIdentity(null);
        setLobbyNotice("방에서 나왔습니다.");
      }
    } catch (error) {
      setLobbyNotice(error instanceof Error ? error.message : "방 명령 실패");
    } finally { setOnlineBusy(false); }
  };
  const publishOnlineInput = (input: Omit<OnlineBattleCommand, "sequence" | "playerId" | "issuedAt">) => {
    if (!onlineRoom || !onlineIdentity || onlineRoom.status !== "playing") return;
    void sendOnlineBattleCommand(onlineRoom.code, onlineIdentity, input).catch((error) =>
      setLobbyNotice(error instanceof Error ? error.message : "전투 명령 전송 실패"),
    );
  };
  useEffect(() => {
    if (!onlineRoom || !onlineIdentity) return;
    const poll = window.setInterval(async () => {
      try {
        const result = await readOnlineRoom(onlineRoom.code, onlineIdentity);
        const unseen = result.room.commands.filter(
          (command) => command.sequence > lastOnlineCommandRef.current && command.playerId !== onlineIdentity.playerId,
        );
        if (unseen.length) onlineCommandInboxRef.current.push(...unseen);
        lastOnlineCommandRef.current = Math.max(lastOnlineCommandRef.current, result.room.commandSequence);
        onlineAiPlayersRef.current = new Set(
          result.room.players.filter((player) => player.aiControlled).map((player) => player.id),
        );
        if (result.room.snapshot && result.room.snapshot.sequence > lastOnlineSnapshotRef.current) {
          onlineSnapshotRef.current = result.room.snapshot;
          lastOnlineSnapshotRef.current = result.room.snapshot.sequence;
        }
        setOnlineRoom(result.room);
      } catch (error) {
        setLobbyNotice(error instanceof Error ? error.message : "방 동기화 중단");
      }
    }, 750);
    return () => window.clearInterval(poll);
  }, [onlineRoom?.code, onlineIdentity?.playerId, onlineIdentity?.token]);
  useEffect(() => {
    if (!onlineRoom || !onlineIdentity || onlineRoom.status !== "playing" || onlineStartedRef.current) return;
    const local = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId);
    if (!local) return;
    const config = createOnlineMatch({
      teamSize: onlineRoom.teamSize, mapId: onlineRoom.mapId, seed: onlineRoom.seed,
      localPlayerId: local.id, players: onlineRoom.players,
    });
    onlineStartedRef.current = true;
    lastOnlineCommandRef.current = onlineRoom.commandSequence;
    onlineCommandInboxRef.current = [];
    onlineSnapshotRef.current = null;
    lastOnlineSnapshotRef.current = onlineRoom.snapshot?.sequence ?? 0;
    setActiveMatchConfig(config);
    setSelectedHeroId(local.heroId);
    setGameMode("skirmish");
    setOutcome(null);
    setMessage(`온라인 방 ${onlineRoom.code} · ${local.nickname} 투입`);
    setScreen("play");
  }, [onlineRoom?.status, onlineIdentity?.playerId]);
  useEffect(() => {
    if (!outcome || !onlineRoom || !onlineIdentity || onlineRoom.status !== "playing" || onlineRoom.hostId !== onlineIdentity.playerId) return;
    const local = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId);
    if (!local) return;
    const winner = outcome === "win" ? local.team : local.team === "blue" ? "red" : "blue";
    void updateOnlineRoom(onlineRoom.code, onlineIdentity, "finish", { winner }).then((result) => setOnlineRoom(result.room)).catch((error) =>
      setLobbyNotice(error instanceof Error ? error.message : "전투 결과 확정 실패"),
    );
  }, [outcome, onlineRoom?.status, onlineIdentity?.playerId]);
  useEffect(() => {
    if (outcome || screen !== "play" || onlineRoom?.status !== "finished" || !onlineRoom.winner || !onlineIdentity) return;
    const local = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId);
    if (local) setOutcome(local.team === onlineRoom.winner ? "win" : "lose");
  }, [onlineRoom?.status, onlineRoom?.winner, onlineIdentity?.playerId, outcome, screen]);
  const returnToOnlineRoom = () => {
    pausedRef.current = false;
    onlineStartedRef.current = false;
    setPaused(false);
    setOutcome(null);
    setActiveMatchConfig(null);
    setMenuPanel("together");
    setScreen("intro");
  };
  const startCampaignMission = () => {
    setGameMode("campaign1");
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
    setDefeatSummary(null);
    setMessage(`제${campaignChapter}장 작전 개시`);
    setScreen("play");
  };
  useEffect(() => {
    if (screen !== "play" || !canvasRef.current) return;
    const canvas = canvasRef.current,
      ctx = canvas.getContext("2d")!;
    canvas.width = VW;
    canvas.height = VH;
    ctx.imageSmoothingEnabled = false;
    const fog = document.createElement("canvas"),
      fctx = fog.getContext("2d")!;
    fog.width = VW;
    fog.height = VH;
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
      const img = new Image();
      img.src = src;
      atlases[name] = img;
    }
    const heroRosterSheets = {} as Partial<Record<FactionId, HTMLImageElement>>;
    for (const [faction, src] of Object.entries({
      human: "/assets/characters/sprites/roster-v1/human-roster-actions-v1.png",
      bugborn:
        "/assets/characters/sprites/roster-v1/bugborn-roster-actions-v1.png",
      ai: "/assets/characters/sprites/roster-v1/ai-roster-actions-v1.png",
    }) as Array<[FactionId, string]>) {
      const img = new Image();
      img.src = src;
      heroRosterSheets[faction] = img;
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
      const img = new Image();
      img.src = src;
      heroVerticalSheets[faction] = img;
    }
    const heroVerticalCombatSheets = {} as Partial<Record<FactionId, HTMLImageElement>>;
    const verticalCombatSources: Record<FactionId, string> = {
      human: "/assets/characters/sprites/roster-v4/human-roster-vertical-combat-v4.png",
      bugborn: "/assets/characters/sprites/roster-v4/bugborn-roster-vertical-combat-v4.png",
      ai: "/assets/characters/sprites/roster-v4/ai-roster-vertical-combat-v4.png",
    };
    for (const faction of Object.keys(verticalCombatSources) as FactionId[]) {
      const img = new Image();
      img.src = verticalCombatSources[faction];
      heroVerticalCombatSheets[faction] = img;
    }
    const heroSkillSheets = {} as Partial<Record<FactionId, HTMLImageElement>>;
    for (const [faction, src] of Object.entries({
      human:
        "/assets/characters/sprites/roster-v3/human-roster-skill-poses-v3.png",
      bugborn:
        "/assets/characters/sprites/roster-v3/bugborn-roster-skill-poses-v3.png",
      ai: "/assets/characters/sprites/roster-v3/ai-roster-skill-poses-v3.png",
    }) as Array<[FactionId, string]>) {
      const img = new Image();
      img.src = src;
      heroSkillSheets[faction] = img;
    }
    const c999Sheet = new Image();
    c999Sheet.src =
      "/assets/characters/sprites/roster-v1/ai-c999-director-actions-v2.png";
    const scientistImages = ["han", "yoon", "min"].map((id) => {
      const img = new Image();
      img.src = `/assets/campaign/scientists/scientist-${id}-v2.png`;
      return img;
    });
    const baseImages = {} as Record<FactionId, HTMLImageElement>;
    for (const [faction, def] of Object.entries(FACTION_BASES) as Array<
      [FactionId, (typeof FACTION_BASES)[FactionId]]
    >) {
      const img = new Image();
      img.src = def.asset;
      baseImages[faction] = img;
    }
    const buildImages = {} as Record<BuildKind, HTMLImageElement>;
    for (const def of BUILDABLES) {
      if (!def.asset) continue;
      const img = new Image();
      img.src = def.asset;
      buildImages[def.id] = img;
    }
    const minionSheets = {} as Partial<Record<FactionId, HTMLCanvasElement>>,
      prepareMinionSheet = (faction: FactionId, src: string) => {
        const img = new Image();
        img.onload = () => {
          const sheet = document.createElement("canvas"),
            sheetCtx = sheet.getContext("2d")!;
          sheet.width = img.naturalWidth;
          sheet.height = img.naturalHeight;
          sheetCtx.drawImage(img, 0, 0);
          minionSheets[faction] = sheet;
        };
        img.src = src;
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
      lastMarchReservationFrame = -1,
      unitId = 1,
      buildId = 1,
      allyHp = 600,
      enemyHp = 600,
      allyShield = 180,
      enemyShield = 180,
      money = 120,
      wave = 0,
      spawnClock =
        activeMatchConfig?.kind === "online" && onlineRoom?.countdownAt
          ? Math.max(0, 1600 - Math.max(0, Date.now() - onlineRoom.countdownAt))
          : 1600,
      enemyBuildCredits = 120,
      enemyBuildClock = 5200,
      steamDamageClock = 0,
      heroXp = isCampaign ? HERO_LEVELS[campaignBalance.heroLevel - 1].xp : 0,
      heroLevel = isCampaign ? campaignBalance.heroLevel : 1,
      minionLevel = isCampaign ? campaignBalance.minionLevel : 1,
      drillArmorUntil = 0,
      hasteUntil = 0,
      evadeUntil = 0,
      ended = false,
      cam = { x: 0, y: 0 },
      cameraFree = false,
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
        ? ["medKit", "armorPlate"]
        : [...selectedLoadout],
      combatAudio = gameAudio,
      aimingSkill: Skill = 0,
      buildMode: BuildMode = "none",
      routeEdit: RouteId | null = null,
      pointerHeld = false,
      cursorScreen = { x: VW / 2, y: VH / 2 },
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
      resolvedBattleSpawns = resolveBattleSpawns(
        selectedBattleMap,
        activeMatchConfig?.seed ?? deterministicSeed,
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
      wallBombs: WallBomb[] = [],
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
       }> = [],
       marchRoutes: Record<RouteId, MarchRoute> = {
        A: { id: "A", color: "#58e5ef", stance: "guard", points: [], revision: 0 },
        B: { id: "B", color: "#efc35b", stance: "guard", points: [], revision: 0 },
       },
        marchReservations = new Set<string>();
    let defeatTimer: number | null = null;
    let campaignPhase = 0,
      campaign5GatePhase = 0,
      campaignWaveQueued = false,
      campaignWaveBreak = -1,
      campaignIntroClock = 0,
      campaignSpeech = "",
      campaignTimeLeft = campaignChapter === 4 ? 150000 : campaignChapter === 5 ? 210000 : 0;
    const drawShotFx = () => {
      for (const s of shots) {
        const tx = Math.floor(s.x / S),
          ty = Math.floor(s.y / S);
        if (s.team !== "blue" && !visible(tx, ty)) continue;
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
    const ALLY = isCampaign
        ? { x: 7, y: 18 }
        : { ...resolvedBattleSpawns.blue },
      ENEMY = isCampaign
        ? campaignChapter === 4
          ? ([{ x: 43, y: 8 }, { x: 44, y: 28 }, { x: 29, y: 7 }, { x: 30, y: 29 }][
              (activeMatchConfig?.seed ?? Date.now()) % 4
            ])
          : { x: 50, y: campaignChapter === 5 ? 10 : 18 }
        : { ...resolvedBattleSpawns.red };
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
    openRoom(ENEMY);
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
        carve(17, 23, 25, 29);
        carve(31, 10, 39, 17);
        carve(46, 7, 52, 13);
        // 반드시 우회할 수 없는 암반 띠. 가운데 문은 해당 구역 적 처치 후 열린다.
        for (const x of [14, 28, 42])
          for (let y = 2; y < ROWS - 2; y++)
            grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "ledge" };
        for (const [x, y] of [[14, 18], [28, 26], [42, 13]])
          grid[y][x] = { type: 4, hp: 99, max: 99, obstacle: "ledge" };
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
        act: isCampaign && campaignChapter === 3 ? 6900 : 0,
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
        (def) => def.category !== "blocker",
      )!,
      enemyStarter = factionBuildables(enemyFaction).find(
        (def) => def.category !== "blocker",
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
        units.push(createCivilianUnit({ id: unitId++, x: ALLY.x + 2, y: ALLY.y + index - 1, name, scientistIndex: index as 0 | 1 | 2, act: 900 + index * 280 })),
      );
    if (isCampaign && campaignChapter === 2) {
      for (const [x, y] of [[14, 16], [25, 25], [32, 20], [36, 13], [44, 23]])
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
      const arenaOpponents = [
        makeCampaignHero("kimssi", "red", 28, 17, "arena", 0),
        makeCampaignHero("ahn-seona", "red", 29, 18, "arena", 1),
        makeCampaignHero("kang-ryeokhan", "red", 28, 19, "arena", 2),
      ];
      Object.assign(arenaOpponents[0], { hp: 430, maxHp: 430, attack: 24, armor: 18 });
      Object.assign(arenaOpponents[1], { hp: 350, maxHp: 350, attack: 20, armor: 10 });
      Object.assign(arenaOpponents[2], { hp: 480, maxHp: 480, attack: 23, armor: 25 });
      units.push(...arenaOpponents);
      const arenaRoster = [hero, ...arenaOpponents], now = performance.now();
      arenaRoster.forEach((fighter, index) => {
        fighter.arenaTargetId = fighter === hero ? arenaOpponents[0].id : undefined;
        fighter.arenaTargetUntil = fighter === hero ? now + 5200 : 0;
        fighter.arenaSkillReadyAt = now + 700 + index * 320;
        fighter.arenaUltimateReadyAt = now + 3600 + index * 520;
      });
    }
    if (isCampaign && campaignChapter === 4)
      units.push(makeCampaignHero("kimssi", "blue", ALLY.x + 2, ALLY.y - 1, "companion"));
    if (isCampaign && campaignChapter === 1) {
      campaign1CheolgakReserve = makeCampaignHero("cheolgak", "red", 38, 17, "battle", 0);
      Object.assign(campaign1CheolgakReserve, { hp: 220, maxHp: 220, attack: 22, armor: 8 });
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
      });
      units.push(pyeongtaekGuard, makeCampaignHero("sanmi", "red", 42, 10, "battle", 1));
    }
    if (isCampaign && campaignChapter === 4) {
      units.push(
        makeCampaignHero("cheolgak", "red", 34, 17, "battle", 0),
        makeCampaignHero("sanmi", "red", 45, 27, "battle", 1),
      );
    }
    if (isCampaign && campaignChapter === 5) {
      const chapter5Heroes = [
        makeCampaignHero("cheolgak", "red", 21, 26, "battle", 0),
        makeCampaignHero("hoebun", "red", 35, 13, "battle", 1),
        makeCampaignHero("sanmi", "red", 36, 16, "battle", 2),
        makeCampaignHero("maedeup", "red", 49, 11, "battle", 3),
      ];
      chapter5Heroes.forEach((fighter, index) => { fighter.campaignPower = index < 2 ? 1 : 2; });
      units.push(...chapter5Heroes);
    }
    if (isCampaign && campaignChapter === 4) {
      for (const [x, y] of [[20, 10], [23, 26], [37, 17], [46, 28], [ENEMY.x - 2, ENEMY.y + 1]])
        turrets.push(createBuildableUnit({ id: buildId++, x, y, team: "red", kind: "venomTree", hp: 155, cool: 250, cost: 0, level: 2 }));
    }
    if (isCampaign && campaignChapter === 5) {
      for (const [x, y] of [[19, 24], [24, 28], [33, 11], [38, 16], [47, 9], [51, 12]])
        turrets.push(createBuildableUnit({ id: buildId++, x, y, team: "red", kind: "venomTree", hp: 175, cool: 220, cost: 0, level: 2 }));
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
    const tone = (kind: CombatSfx) => {
      void combatAudio.sfx(kind);
    };
    const kindTone = (kind: BuildKind): "shot" | "blast" =>
      kind === "missileM2" || kind === "rootAmbusher" ? "blast" : "shot";
    const burst = (x: number, y: number, color: string, n = 8) => {
        for (let i = 0; i < n; i++)
          dust.push({
            x: x * S + S / 2 + (random() - 0.5) * S,
            y: y * S + S / 2 + (random() - 0.5) * S,
            life: 240 + random() * 330,
            color,
          });
      },
      occupied = (x: number, y: number, ignore?: Unit) =>
        units.find((u) => u !== ignore && u.alive && u.x === x && u.y === y),
      turretAt = (x: number, y: number) =>
        turrets.find((t) => t.hp > 0 && t.x === x && t.y === y),
      baseAt = (x: number, y: number) =>
        x === ALLY.x && y === ALLY.y
          ? "blue"
          : x === ENEMY.x && y === ENEMY.y
            ? "red"
            : null,
      open = (x: number, y: number) =>
        !!grid[y]?.[x] && WALKABLE_TERRAIN.has(grid[y][x].type),
      terrainMoveFactor = (x: number, y: number) =>
        grid[y]?.[x]?.surface === "shallowWater" ? 0.58 : 1,
      resolveUnitOverlaps = () => {
        const claimed = new Set<string>(),
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
          let key = `${u.x},${u.y}`;
          if (!claimed.has(key)) {
            claimed.add(key);
            continue;
          }
          const escape = offsets
            .map((d) => ({ x: u.x + d.x, y: u.y + d.y }))
            .find(
              (p) =>
                open(p.x, p.y) &&
                !claimed.has(`${p.x},${p.y}`) &&
                !turretAt(p.x, p.y) &&
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
          key = `${u.x},${u.y}`;
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
          const eased = elapsed * elapsed * (3 - 2 * elapsed);
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
        setUnitMoveVisual(u, x, y, duration);
        u.x = x;
        u.y = y;
        if (u.role === "minion") marchReservations.add(`${x},${y}`);
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
    const visionSources = () => [
        ...units.filter((u) => u.alive && u.team === "blue"),
        ...turrets.filter((t) => t.hp > 0 && t.team === "blue"),
      ],
      visionRadius = (u: Unit | Turret) =>
        "role" in u && u === hero
          ? playerDef.stats.vision
          : "role" in u && u.role === "minion"
            ? 4
            : 7,
      visible = (x: number, y: number) =>
        visionSources().some(
          (u) => (u.x - x) ** 2 + (u.y - y) ** 2 <= visionRadius(u) ** 2,
        ),
      markVision = () => {
        resolveUnitOverlaps();
        recoverEmbeddedHero();
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
                memory[y][x] = { ...grid[y][x] };
              }
        }
      };
    const awardCredits = (team: Team, amount: number) => {
        if (team === "blue") money += amount;
        else if (activeMatchConfig?.kind === "computer") enemyBuildCredits += amount;
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
        const before = HERO_LEVELS[Math.max(0, hero.level - 1)],
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
          const nextMinionLevel = next >= 5 ? 3 : next >= 3 ? 2 : 1;
          if (nextMinionLevel > minionLevel) {
            const afterMinion = MINION_LEVELS[nextMinionLevel - 1];
            for (const minion of units.filter(
              (unit) => unit.alive && unit.role === "minion" && unit.team === "blue",
            )) {
              const beforeMinion = MINION_LEVELS[Math.max(0, minion.level - 1)],
                hpRatio = minion.maxHp > 0 ? minion.hp / minion.maxHp : 0,
                baseHp = minion.maxHp / beforeMinion.hp,
                baseAttack = minion.attack / beforeMinion.damage,
                baseSpeed = minion.moveSpeed / beforeMinion.speed,
                baseCrit = minion.critChance - beforeMinion.critBonus;
              minion.level = nextMinionLevel;
              minion.maxHp = baseHp * afterMinion.hp;
              minion.hp = minion.maxHp * hpRatio;
              minion.attack = baseAttack * afterMinion.damage;
              minion.moveSpeed = baseSpeed * afterMinion.speed;
              minion.critChance = baseCrit + afterMinion.critBonus;
            }
            minionLevel = nextMinionLevel;
          }
        }
        if (playerDef.id === "yoo-seungcheon" && (next === 3 || next === 5)) {
          talentPromptRef.current = next;
          setTalentPrompt(next);
          pausedRef.current = true;
          setPaused(true);
        }
        tone("build");
        setMessage(`${playerDef.name} ${next}레벨 · 지하 적응 완료`);
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
        source?: { attacker: string; action: string },
      ) => {
        if (!u.alive || (u.team === from && !forceHostile)) return 0;
        if (u === hero && performance.now() < evadeUntil) {
          burst(hero.x, hero.y, "#d7fbff", 10);
          setMessage("회피 성공 · 피해 무효");
          return 0;
        }
        const weakened = (u.vulnerableUntil ?? 0) > performance.now() ? 18 : 0,
          activeArmor =
            Math.max(0, u.armor - weakened) +
            (u === hero && performance.now() < drillArmorUntil ? 10 : 0),
          arenaScale =
            isCampaign &&
            campaignChapter === 3 &&
            (u === hero || u.campaignAi === "arena")
              ? 0.62
              : 1,
          campaignDamageScale = isCampaign && u.team === "blue" ? campaignBalance.incomingDamage : 1,
          result = combatDamage(d * arenaScale * campaignDamageScale, activeArmor, from, canCrit, chance, mult);
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
        u.hp -= result.amount;
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
            awardCredits(from, u.role === "hero" ? 45 : 14);
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
        if (t.upgrade) {
          if (t.team === "blue") money += t.upgrade.cost;
          t.upgrade = undefined;
          setMessage("강화 취소 · 비용 전액 반환");
        }
        t.demolish = undefined;
        const def = BUILD_BY_ID[t.kind],
          result = combatDamage(
            d,
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
            awardCredits(from, Math.max(12, Math.round((def?.cost ?? 0) * 0.35)));
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
      damageBase = (attacker: Team, d: number, source?: Unit) => {
        if (isCampaign && attacker === "blue" && campaignChapter !== 4) {
          setMessage(campaignChapter === 1 ? "목표는 침입체 전멸이다" : "이번 작전의 목표는 적 거점 파괴가 아니다");
          return;
        }
        if (!canDamageCore({
          role: source?.role,
          minionRole: source?.minionRole,
          isCampaign,
          campaignChapter,
        })) {
          setMessage("영웅과 설치물은 코어를 파괴할 수 없다 · 쫄따구를 진입시켜라");
          return;
        }
        let shield = attacker === "blue" ? enemyShield : allyShield;
        if (shield > 0) {
          if (!source || source.role !== "minion") {
            setMessage("생존 코어 방어막 · 파쇄병을 먼저 보내야 함");
            return;
          }
          const shieldDamage = source.shieldDamage ?? Math.max(1, d * 0.2);
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
        const coreDamage = exposedCoreDamage(d, {
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
          setOutcome(enemyHp <= 0 ? "win" : "lose");
        }
      };
    const breakTile = (u: Unit, x: number, y: number, power = 1) => {
        const t = grid[y]?.[x];
        if (!t || t.type === 0 || t.type === 4) return false;
        const bombIndex = wallBombs.findIndex(
          (b) =>
            b.x === x &&
            b.y === y &&
            b.team !== u.team &&
            b.armedAt <= performance.now(),
        );
        if (bombIndex >= 0) {
          const bomb = wallBombs.splice(bombIndex, 1)[0];
          t.hp = 0;
          for (const target of units)
            if (
              target.alive &&
              target.team !== bomb.team &&
              Math.hypot(target.x - x, target.y - y) <= 1.6
            ) {
              hurt(target, 55, bomb.team, false);
              target.act = Math.max(target.act, 700);
            }
          burst(x, y, "#ffb43b", 28);
          tone("blast");
        } else {
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
        }
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
          return true;
        }
        return false;
      },
      moveOrDig = (u: Unit, dx: number, dy: number, duration = 280) => {
        if (!u.alive) return;
        u.dir = { x: dx, y: dy };
        if (u === hero) heroMoveUntil = performance.now() + 220;
        const x = u.x + dx,
          y = u.y + dy,
          t = grid[y]?.[x];
        if (
          !t ||
          t.type === 4 ||
          occupied(x, y, u) ||
          turretAt(x, y) ||
          baseAt(x, y)
        )
          return;
        if (t.type !== 0) {
          if (u.role === "hero") breakTile(u, x, y);
          return;
        }
        commitGridMove(u, x, y, duration);
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
    const heroTerrainClear = (px: number, py: number) => {
      const radius = 8;
      for (const ox of [-radius, radius])
        for (const oy of [-radius, radius]) {
          const tx = Math.floor((px + ox) / S),
            ty = Math.floor((py + oy) / S);
          if (!open(tx, ty)) return false;
        }
      return true;
    };
    const heroWorldClear = (px: number, py: number) => {
      if (!heroTerrainClear(px, py)) return false;
      for (const u of units)
        if (u !== hero && u.alive) {
          const p = unitWorld(u);
          if (Math.hypot(p.x - px, p.y - py) < 20) return false;
        }
      for (const t of turrets)
        if (
          t.hp > 0 &&
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
        tile.type !== 0 &&
        tile.type !== 4
      );
    };
    const drillBlockedTile = (
      blocked: { x: number; y: number },
      d: { x: number; y: number },
    ) => {
      hero.dir = d;
      breakTile(hero, blocked.x, blocked.y, playerDef.stats.digPower);
      hero.act = 135;
      heroMoveUntil = performance.now() + 220;
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
        terrainFactor = terrainMoveFactor(hero.x, hero.y),
        advance = ((playerDef.stats.moveSpeed * speedBoost * terrainFactor * S) / 1000) * dt,
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
          ((playerDef.stats.moveSpeed * speedBoost * terrainFactor * S) / 1000) * dt,
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
          if (grid[ty]?.[tx]?.type !== 0) {
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
        range = u === hero ? playerDef.stats.range * S : 44,
        candidates = units
          .filter((v) => v.alive && v.team !== u.team)
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
          { attacker: u.name, action: u.role === "hero" ? "기본 공격" : "일반 공격" },
        );
        if (hit.variant === "microwaveBash")
          target.act = Math.max(target.act, 360);
        if (hit.variant === "baton") target.act = Math.max(target.act, 520);
        if (hit.variant === "mandible")
          hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(3, dealt * 0.28));
        if (hit.variant === "shieldBash") {
          const nx = target.x + Math.sign(target.x - u.x),
            ny = target.y + Math.sign(target.y - u.y);
          if (
            open(nx, ny) &&
            !occupied(nx, ny, target) &&
            !turretAt(nx, ny) &&
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
        if (t.hp > 0 && t.team !== u.team) {
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
      if (dist <= range && facing >= 0.35)
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
              clearRay(tx, ty, u.x, u.y)
            ) {
              hurt(u, s.damage, s.team, false);
              if (s.stun) u.act = Math.max(u.act, s.stun);
            }
          }
        for (const t of turrets)
          if (
            t.hp > 0 &&
            t.team !== s.team &&
            Math.hypot(t.x - tx, t.y - ty) <= radius &&
            clearRay(tx, ty, t.x, t.y)
          )
            hurtTurret(t, s.damage, s.team, false);
      };
    const enemyActors = () => units.filter((u) => u.alive && u.team === "red"),
      healArea = (radius: number, amount: number) => {
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
            hurt(u, damage, "blue", true, hero.critChance, hero.critMultiplier);
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
            hurt(u, damage, "blue", true, hero.critChance, hero.critMultiplier);
            if (stun) u.act = Math.max(u.act, stun);
            if (push) {
              const nx = Math.max(1, Math.min(COLS - 2, u.x + Math.sign(dx))),
                ny = Math.max(1, Math.min(ROWS - 2, u.y + Math.sign(dy)));
              if (
                open(nx, ny) &&
                !occupied(nx, ny, u) &&
                !turretAt(nx, ny) &&
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
      ) =>
        fields.push({
          kind,
          x,
          y,
          radius,
          life,
          maxLife: life,
          tick: 0,
          damage,
          color,
          hitIds: [],
        }),
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
              tile = grid[Math.floor(ny)]?.[Math.floor(nx)];
            if (!tile || tile.type !== 0) {
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
                const rx = u.x - f.x,
                  ry = u.y - f.y,
                  along = rx * d.x + ry * d.y,
                  side = Math.abs(rx * d.y - ry * d.x);
                if (Math.abs(along) > 0.8 || side > f.radius) continue;
                if (!f.hitIds.includes(u.id)) {
                  hurt(u, f.damage, "blue", false);
                  f.hitIds.push(u.id);
                }
                const ux = u.x + Math.sign(d.x),
                  uy = u.y + Math.sign(d.y);
                if (
                  open(ux, uy) &&
                  !occupied(ux, uy, u) &&
                  !turretAt(ux, uy) &&
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
          for (const u of enemyActors())
            if (Math.hypot(u.x - f.x, u.y - f.y) <= f.radius) {
              if (f.kind === "web") {
                u.act = Math.max(u.act, 460);
                if (!f.hitIds.includes(u.id)) {
                  hurt(u, f.damage, "blue", false);
                  f.hitIds.push(u.id);
                }
              } else if (f.kind === "lockdown") {
                u.act = Math.max(u.act, 620);
                if (!f.hitIds.includes(u.id)) {
                  hurt(u, f.damage, "blue", false);
                  f.hitIds.push(u.id);
                }
              } else if (f.kind === "molt") {
                if (!f.hitIds.includes(u.id)) {
                  hurt(
                    u,
                    f.damage,
                    "blue",
                    true,
                    hero.critChance,
                    hero.critMultiplier,
                  );
                  u.act = Math.max(u.act, 850);
                  f.hitIds.push(u.id);
                }
              } else {
                hurt(u, f.damage, "blue", false);
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
        damage =
          hero.attack *
          (playerDef.id === "yoo-seungcheon" && talents.has("plastic-typhoon")
            ? 1.1
            : spec.damage),
        dir = { ...hero.dir };
      if (spec.mode === "spin")
        areaDamage(
          playerDef.id === "yoo-seungcheon" && talents.has("plastic-typhoon")
            ? 2.04
            : spec.radius,
          damage,
        );
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
      else if (spec.mode === "blindDust") areaDamage(spec.radius, damage, 1450);
      else if (spec.mode === "webTrap") {
        const p = heroFxPos();
        spawnField(
          "web",
          p.x + dir.x * 3,
          p.y + dir.y * 3,
          spec.radius,
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
      playHeroAnim(spec.mode === "spin" ? "whirlwind" : "basic", 760, 1);
      signatureFx(spec.mode, dir, spec.radius, 760);
      burst(hero.x, hero.y, kit.color, 20);
      hero.act = 760;
      cd1 = spec.cooldown;
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
        d = unitVector(dx, dy),
        startFx = heroFxPos(),
        damage = hero.attack * spec.damage;
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
        healArea(spec.range, Math.round(hero.maxHp * 0.22));
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
              dist <= spec.range && (dx / dist) * d.x + (dy / dist) * d.y > 0.72
            );
          })
          .sort(
            (a, b) =>
              Math.hypot(a.x - hero.x, a.y - hero.y) -
              Math.hypot(b.x - hero.x, b.y - hero.y),
          )[0];
        if (target) {
          hurt(target, damage * 0.45, "blue", false);
          target.vulnerableUntil = performance.now() + 6000;
        }
      } else if (spec.mode === "silkPull") {
        const target = enemyActors()
          .filter((u) => {
            const dx = u.x - hero.x,
              dy = u.y - hero.y,
              dist = Math.hypot(dx, dy);
            return (
              dist <= spec.range && (dx / dist) * d.x + (dy / dist) * d.y > 0.6
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
          );
          const nx = hero.x + Math.sign(target.x - hero.x),
            ny = hero.y + Math.sign(target.y - hero.y);
          if (open(nx, ny) && !occupied(nx, ny, target)) {
            target.x = nx;
            target.y = ny;
          }
          target.act = Math.max(target.act, 900);
        }
      } else if (spec.mode === "nightPatrol") {
        drillArmorUntil = performance.now() + 6500;
        areaDamage(2.6, hero.attack * 0.35, 650);
      } else if (spec.mode === "weldCone") {
        coneDamage(d, spec.range, damage, 0.15, 450);
        healArea(3.5, Math.round(hero.maxHp * 0.12));
        repairStructures(3.5, 36);
      } else if (spec.mode === "relocate") {
        dash(spec.range, false);
        hero.hp = Math.min(hero.maxHp, hero.hp + 12);
        burst(hero.x, hero.y, kit.accent, 26);
      } else if (spec.mode === "glide") {
        let landed = false;
        for (let r = spec.range; r >= 1 && !landed; r -= 0.5) {
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
        dash(
          playerDef.id === "yoo-seungcheon" && talents.has("foot-motor")
            ? spec.range + 1
            : spec.range,
          true,
        );
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
      signatureFx(spec.mode, d, Math.max(1.2, spec.range * 0.45), 720);
      slashes.push({
        ...startFx,
        dir: d,
        life: 560,
        maxLife: 560,
        kind: "thrust",
        color: kit.color,
      });
      hero.act = 720;
      cd2 = spec.cooldown;
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
      const spec = kit.drill,
        d = gridStep(hero.dir.x, hero.dir.y),
        side = { x: -d.y, y: d.x },
        dig = (x: number, y: number) => {
          if (grid[y]?.[x]?.type !== 4) breakTile(hero, x, y, 99);
        };
      if (spec.mode === "radial") {
        for (let y = -1; y <= 1; y++)
          for (let x = -1; x <= 1; x++) if (x || y) dig(hero.x + x, hero.y + y);
      } else if (spec.mode === "sealRing") {
        for (let y = -1; y <= 1; y++)
          for (let x = -1; x <= 1; x++)
            if (
              (x || y) &&
              open(hero.x + x, hero.y + y) &&
              !occupied(hero.x + x, hero.y + y) &&
              !turretAt(hero.x + x, hero.y + y)
            )
              grid[hero.y + y][hero.x + x] = {
                type: 5,
                hp: 3,
                max: 3,
                freshUntil: performance.now() + 1500,
                filledBy: hero.team,
              };
      } else if (spec.mode === "sonicCross") {
        for (const axis of DIRS)
          for (let n = 1; n <= spec.length; n++)
            dig(hero.x + axis.x * n, hero.y + axis.y * n);
      } else if (spec.mode === "pipeFork") {
        for (let n = 1; n <= spec.length; n++) {
          dig(hero.x + d.x * n, hero.y + d.y * n);
          if (n > 2) {
            dig(
              hero.x + d.x * n + side.x * (n - 2),
              hero.y + d.y * n + side.y * (n - 2),
            );
            dig(
              hero.x + d.x * n - side.x * (n - 2),
              hero.y + d.y * n - side.y * (n - 2),
            );
          }
        }
      } else if (spec.mode === "blueprint") {
        for (let n = 1; n <= spec.length; n++) {
          dig(
            hero.x + d.x * n + side.x * spec.width,
            hero.y + d.y * n + side.y * spec.width,
          );
          dig(
            hero.x + d.x * n - side.x * spec.width,
            hero.y + d.y * n - side.y * spec.width,
          );
        }
        for (let w = -spec.width; w <= spec.width; w++)
          dig(
            hero.x + d.x * spec.length + side.x * w,
            hero.y + d.y * spec.length + side.y * w,
          );
      } else if (spec.mode === "sawLine") {
        let lastX = hero.x,
          lastY = hero.y;
        for (let n = 1; n <= spec.length; n++) {
          const offset = n % 2 ? 1 : -1,
            x = hero.x + d.x * n + side.x * offset,
            y = hero.y + d.y * n + side.y * offset;
          dig(hero.x + d.x * n, hero.y + d.y * n);
          dig(x, y);
          if (Math.abs(x - lastX) + Math.abs(y - lastY) > 1)
            dig(
              hero.x + d.x * n + side.x * (n % 2 ? 0 : -1),
              hero.y + d.y * n + side.y * (n % 2 ? 0 : -1),
            );
          lastX = x;
          lastY = y;
        }
      } else {
        for (let n = 1; n <= spec.length; n++)
          for (let w = -spec.width; w <= spec.width; w++)
            dig(hero.x + d.x * n + side.x * w, hero.y + d.y * n + side.y * w);
      }
      if (spec.mode === "spikeLine")
        coneDamage(hero.dir, 3.8, hero.attack * 0.7, 0.35, 450);
      if (spec.mode === "acidLine")
        coneDamage(hero.dir, 4.8, hero.attack * 0.55, 0.5, 300);
      if (talents.has("used-like-new"))
        drillArmorUntil = performance.now() + 2000;
      playHeroAnim("drill", 980, 3);
      slashes.push({
        ...heroFxPos(),
        dir: { ...hero.dir },
        life: 900,
        maxLife: 900,
        kind: "drill",
        variant: spec.mode,
        color: kit.color,
      });
      signatureFx(spec.mode, hero.dir, 2.1, 900);
      hero.act = 980;
      cd3 = talents.has("used-like-new") ? spec.cooldown * 0.75 : spec.cooldown;
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
        d = unitVector(dx, dy),
        damage = hero.attack * spec.damage;
      hero.dir = d;
      if (spec.mode === "slash") {
        slashes.push({
          ...heroFxPos(),
          dir: d,
          life: 560,
          maxLife: 560,
          kind: "ultimate",
          damage,
          resolved: false,
          hitIds: [],
        });
      } else if (spec.mode === "microwave") {
        const target = enemyActors()
          .filter((u) => {
            const dx = u.x - hero.x,
              dy = u.y - hero.y,
              dist = Math.hypot(dx, dy);
            return (
              dist <= spec.range && (dx / dist) * d.x + (dy / dist) * d.y > 0.72
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
        coneDamage(d, spec.range, damage, 0.05, 900);
        healArea(3.5, Math.round(hero.maxHp * 0.28));
      } else if (spec.mode === "lidDisc")
        skillShot(d, "disc", damage, { splash: spec.radius, pierce: true });
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
        const reach = openRayReach(d, spec.range);
        heroWorld.x += d.x * Math.max(0, reach - 10);
        heroWorld.y += d.y * Math.max(0, reach - 10);
        hero.x = Math.floor(heroWorld.x / S);
        hero.y = Math.floor(heroWorld.y / S);
        areaDamage(spec.radius, damage, 900);
      } else if (spec.mode === "acidPool") {
        const reach = Math.min(spec.range * S, openRayReach(d, spec.range)),
          p = heroFxPos();
        spawnField(
          "acid",
          p.x + (d.x * reach) / S,
          p.y + (d.y * reach) / S,
          spec.radius,
          5200,
          hero.attack * 0.32,
          kit.color,
        );
      } else if (spec.mode === "frenzy") {
        areaDamage(spec.radius, damage, 650);
        hasteUntil = performance.now() + 4500;
        drillArmorUntil = performance.now() + 2500;
      } else if (spec.mode === "webLock") {
        const p = heroFxPos();
        spawnField(
          "web",
          p.x + d.x * 2.2,
          p.y + d.y * 2.2,
          spec.radius,
          6200,
          damage * 0.35,
          kit.color,
        );
      } else if (spec.mode === "overclock") {
        const ax = heroWorld.x,
          ay = heroWorld.y;
        let travel = 0;
        for (let dist = 8; dist <= spec.range * S; dist += 8) {
          const px = ax + d.x * dist,
            py = ay + d.y * dist,
            tx = Math.floor(px / S),
            ty = Math.floor(py / S),
            tile = grid[ty]?.[tx];
          if (!tile || tile.type === 4) break;
          if (tile.type !== 0) breakTile(hero, tx, ty, 99);
          travel = dist;
        }
        const bx = ax + d.x * travel,
          by = ay + d.y * travel;
        for (const u of enemyActors()) {
          const p = unitWorld(u);
          if (segmentMetric(p.x, p.y, ax, ay, bx, by).distance <= 25) {
            hurt(u, damage, "blue", true, hero.critChance, hero.critMultiplier);
            u.act = Math.max(u.act, 650);
          }
        }
        for (const t of turrets)
          if (
            t.hp > 0 &&
            t.team === "red" &&
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
          spec.radius,
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
          spec.radius,
          6200,
          Math.max(4, hero.maxHp * 0.035),
          kit.color,
        );
        healArea(spec.radius, Math.round(hero.maxHp * 0.18));
        repairStructures(spec.radius, 60);
        areaDamage(spec.radius, damage * 0.35, 700);
      } else skillShot(d, "laser", damage, { pierce: true, stun: 900 });
      hero.ultimateLabelUntil = performance.now() + 1150;
      playHeroAnim("ultimate", 820, 4);
      signatureFx(spec.mode, d, spec.radius, 900);
      hero.act = 820;
      cd4 = spec.cooldown * HERO_LEVELS[heroLevel - 1].ultimateCooldown;
      void combatAudio.skillCue(playerDef.id, 4, 1, 6);
      tone("blast");
      setMessage(`필살기 · ${playerDef.skills[3]} · ${spec.caption}`);
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
          const w = cursorWorld(),
            d = unitVector(w.x - heroWorld.x, w.y - heroWorld.y),
            maxDistance = Math.min(
              3 * S,
              Math.hypot(w.x - heroWorld.x, w.y - heroWorld.y),
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
        setMessage(`${playerDef.name} 생존기 · ${type}`);
      },
      fillPlacementError = (x: number, y: number) => {
        if (Math.hypot(x - hero.x, y - hero.y) > 2.25)
          return "영웅 반경 2칸 안만 메울 수 있다";
        if (!visible(x, y)) return "현재 시야 안의 땅만 메울 수 있다";
        if (Math.hypot(x - ENEMY.x, y - ENEMY.y) < 3)
          return "적 코어 근처에서는 땅을 메울 수 없다";
        if (!open(x, y)) return "열린 땅만 메울 수 있다";
        if (occupied(x, y) || turretAt(x, y) || baseAt(x, y))
          return "다른 대상이 있는 칸은 메울 수 없다";
        if (money < 15) return "땅 메우기 · 15 크레딧 필요";
        return "";
      },
      toggleFillMode = () => {
        if (!hero.alive) return;
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
        grid[y][x] = {
          type: 5,
          hp: 2,
          max: 2,
          freshUntil: performance.now() + 1500,
          filledBy: hero.team,
        };
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
      activateItem = (slot: number) => {
        if (!hero.alive) return;
        const item = itemSlots[slot];
        if (!item) {
          setMessage("빈 아이템 슬롯 · 전투 편성에서 장착 가능");
          return;
        }
        if (item === "wallBomb") {
          const d = gridStep(hero.dir.x, hero.dir.y),
            x = hero.x + d.x,
            y = hero.y + d.y,
            t = grid[y]?.[x];
          if (
            !t ||
            t.type === 0 ||
            t.type === 4 ||
            wallBombs.some((b) => b.x === x && b.y === y)
          ) {
            setMessage("진행 방향의 흙벽에만 폭탄을 숨길 수 있다");
            return;
          }
          wallBombs.push({
            x,
            y,
            team: "blue",
            armedAt: performance.now() + 1250,
          });
          itemSlots[slot] = null;
          hero.act = 700;
          playHeroAnim("drill", 700, 3);
          slashes.push({
            x,
            y,
            dir: { ...hero.dir },
            life: 700,
            maxLife: 700,
            kind: "signature",
            variant: "bombPlant",
            color: "#f0b04c",
            radius: 0.8,
          });
          tone("item");
          tone("build");
          setMessage("벽 매설 폭탄 설치 · 1.25초 뒤 무장");
        } else if (item === "energyDrink") {
          itemSlots[slot] = null;
          const now = performance.now();
          hero.hp = Math.min(
            hero.maxHp,
            hero.hp + Math.round(hero.maxHp * 0.2),
          );
          hasteUntil = Math.max(hasteUntil, now + 5000);
          playHeroAnim("whirlwind", 480, 2);
          spawnField(
            "repair",
            heroFxPos().x,
            heroFxPos().y,
            1.35,
            900,
            0,
            "#f1dc62",
          );
          tone("item");
          burst(hero.x, hero.y, "#f1dc62", 20);
          setMessage("에너지 드링크 · 체력 20% 회복 + 5초 가속");
        } else if (item === "medKit") {
          itemSlots[slot] = null;
          hero.hp = Math.min(hero.maxHp, hero.hp + emergencyRepairAmount(hero.maxHp));
          spawnField("repair", heroFxPos().x, heroFxPos().y, 1.4, 900, 0, "#75f0a0");
          tone("item");
          tone("heal");
          setMessage("응급 수복팩 · 체력 90% 회복");
        } else if (item === "armorPlate") {
          itemSlots[slot] = null;
          drillArmorUntil = Math.max(drillArmorUntil, performance.now() + 8000);
          tone("item");
          tone("shield");
          setMessage("복합 장갑판 · 8초 방어 강화");
        } else if (item === "scanner") {
          itemSlots[slot] = null;
          for (let y = hero.y - 8; y <= hero.y + 8; y++)
            for (let x = hero.x - 8; x <= hero.x + 8; x++)
              if (seen[y]?.[x] !== undefined && Math.hypot(x - hero.x, y - hero.y) <= 8) {
                seen[y][x] = true;
                memory[y][x] = { ...grid[y][x] };
              }
          tone("item");
          tone("warning");
          setMessage("진동 탐지기 · 주변 8칸 탐사 완료");
        } else {
          itemSlots[slot] = null;
          hasteUntil = Math.max(hasteUntil, performance.now() + 10000);
          evadeUntil = Math.max(evadeUntil, performance.now() + 1000);
          tone("item");
          tone("coin");
          setMessage("위상 장화 · 10초 가속 + 1초 회피");
        }
      };
    const spawnCells = [
        { x: ALLY.x - 1, y: ALLY.y + 2 },
        { x: ALLY.x, y: ALLY.y + 2 },
        { x: ALLY.x + 1, y: ALLY.y + 2 },
      ],
      buildDef = (kind: BuildKind) => BUILD_BY_ID[kind],
      isBlocker = (kind: BuildKind) => buildDef(kind)?.category === "blocker",
      ownBuilds = () =>
        turrets.filter(
          (t) => t.team === "blue" && t.built && !t.starter && t.hp > 0,
        ),
      placementCost = (kind: BuildKind, x: number, y: number, builds = ownBuilds()) => {
        const def = buildDef(kind);
        return buildPlacementCost(
          def.cost,
          isBlocker(kind),
          x,
          y,
          builds.map((t) => ({ x: t.x, y: t.y, isBlocker: isBlocker(t.kind) })),
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
          (p) => open(p.x, p.y) && !(p.x === blockX && p.y === blockY),
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
              !open(x, y) ||
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
          attacks = all.filter((t) => !isBlocker(t.kind)).length,
          walls = all.filter((t) => isBlocker(t.kind)).length;
        if (dist < 2 || dist > 6) return "붉은 설치 한계선 안쪽만 가능";
        if (!visible(x, y)) return "현재 시야 안에서만 건설 가능";
        if (!open(x, y)) return "열린 땅굴에만 건설 가능";
        if (baseAt(x, y) || turretAt(x, y) || occupied(x, y))
          return "다른 대상과 겹쳐 건설할 수 없음";
        if (spawnCells.some((p) => p.x === x && p.y === y))
          return "굴착대 출전 칸은 비워야 함";
        if (all.length >= 6) return "추가 설치물은 최대 6개";
        if (isBlocker(kind) && walls >= 4) return "방어벽은 최대 4개";
        if (!isBlocker(kind) && attacks >= 3) return "공격 설치물은 최대 3개";
        if (isBlocker(kind) && !preservesExitPath(x, y))
          return "최소 한 개의 출전 경로를 남겨야 함";
        const cost = placementCost(kind, x, y, all);
        if (money < cost) return `${cost} 크레딧 필요${cost > def.cost ? " · 밀집 건설 할증" : ""}`;
        return "";
      },
      enemyOwnBuilds = () =>
        turrets.filter((t) => t.team === "red" && t.built && !t.starter && t.hp > 0),
      preservesEnemyExitPath = (blockX: number, blockY: number) => {
        const starts = DIRS.map((d) => ({ x: ENEMY.x + d.x, y: ENEMY.y + d.y }))
          .filter((p) => open(p.x, p.y) && !(p.x === blockX && p.y === blockY));
        if (!starts.length) return false;
        const q = [...starts], visited = new Set(q.map((p) => `${p.x},${p.y}`));
        for (let i = 0; i < q.length; i++) {
          const p = q[i];
          if (Math.hypot(p.x - ENEMY.x, p.y - ENEMY.y) >= 4.5) return true;
          for (const d of DIRS) {
            const x = p.x + d.x, y = p.y + d.y, key = `${x},${y}`;
            if (visited.has(key) || !open(x, y) || (x === blockX && y === blockY) || turretAt(x, y) || baseAt(x, y)) continue;
            visited.add(key);
            q.push({ x, y });
          }
        }
        return false;
      },
      runEnemyConstruction = () => {
        if (activeMatchConfig?.kind !== "computer" || enemyBuildClock > 0) return;
        const builds = enemyOwnBuilds(),
          attackCount = builds.filter((t) => !isBlocker(t.kind)).length,
          wallCount = builds.length - attackCount;
        if (builds.length >= 6 || (attackCount >= 3 && wallCount >= 3)) {
          enemyBuildClock = 9000;
          return;
        }
        const threats = units
            .filter((u) => u.alive && u.team === "blue")
            .map((u) => ({ unit: u, dist: Math.hypot(u.x - ENEMY.x, u.y - ENEMY.y) }))
            .sort((a, b) => a.dist - b.dist),
          nearest = threats[0],
          urgent = Boolean(nearest && nearest.dist <= 10),
          defs = factionBuildables(enemyFaction),
          wantsWall = wallCount < 3 && (urgent || attackCount >= 2),
          affordable = defs
            .filter((def) => def.cost <= enemyBuildCredits)
            .filter((def) => wantsWall ? def.category === "blocker" : def.category !== "blocker")
            .sort((a, b) => b.cost - a.cost),
          def = affordable[0] ?? defs
            .filter((candidate) => candidate.cost <= enemyBuildCredits)
            .sort((a, b) => b.cost - a.cost)[0];
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
                def.category === "blocker",
                x,
                y,
                builds.map((t) => ({ x: t.x, y: t.y, isBlocker: isBlocker(t.kind) })),
              );
            if (distance < 2 || distance > 6 || !open(x, y) || baseAt(x, y) || turretAt(x, y) || occupied(x, y) || cost > enemyBuildCredits) continue;
            if (def.category === "blocker" && !preservesEnemyExitPath(x, y)) continue;
            const openSides = DIRS.filter((d) => open(x + d.x, y + d.y)).length,
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
        if (visible(spot.x, spot.y)) {
          setMessage(`적 건설 감지 · ${def.name} · ${urgent ? "이 길목을 차단한다" : "이 전선을 엄호한다"}`);
          tone("warning");
          burst(spot.x, spot.y, FACTIONS[enemyFaction].color, 18);
        }
      },
      selectBuildMode = (mode: BuildMode) => {
        fillMode = false;
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
        units
          .filter((v) => v.alive && v.team !== u.team)
          .sort(
            (a, b) =>
              Math.abs(a.x - u.x) +
              Math.abs(a.y - u.y) -
              (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)),
          )
          .find((v) => Math.abs(v.x - u.x) + Math.abs(v.y - u.y) <= range),
      nearestEnemyTurret = (u: Unit, range = 99) =>
        turrets
          .filter((t) => t.hp > 0 && t.team !== u.team)
          .sort(
            (a, b) =>
              Math.abs(a.x - u.x) +
              Math.abs(a.y - u.y) -
              (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)),
          )
          .find((t) => Math.abs(t.x - u.x) + Math.abs(t.y - u.y) <= range),
      clearRay = (ax: number, ay: number, bx: number, by: number) => {
        const dist = Math.hypot(bx - ax, by - ay),
          steps = Math.ceil(dist * 4);
        for (let i = 1; i < steps; i++) {
          const x = Math.floor(ax + ((bx - ax) * i) / steps),
            y = Math.floor(ay + ((by - ay) * i) / steps);
          if ((x === ax && y === ay) || (x === bx && y === by)) continue;
          if (!open(x, y)) return false;
        }
        return true;
      };
    const routePathCells = (
      start: { x: number; y: number },
      goal: { x: number; y: number },
    ) => {
      const startKey = `${start.x},${start.y}`,
        goalKey = `${goal.x},${goal.y}`,
        queue = [start],
        parent = new Map<string, string | null>([[startKey, null]]);
      let found = false;
      for (let head = 0; head < queue.length && head < 2000; head++) {
        const p = queue[head],
          key = `${p.x},${p.y}`;
        if (key === goalKey) {
          found = true;
          break;
        }
        for (const d of DIRS) {
          const x = p.x + d.x,
            y = p.y + d.y,
            k = `${x},${y}`;
          if (parent.has(k) || !open(x, y)) continue;
          parent.set(k, key);
          queue.push({ x, y });
        }
      }
      if (!found) return [] as Array<{ x: number; y: number }>;
      const cells: Array<{ x: number; y: number }> = [];
      let current: string | null = goalKey;
      while (current) {
        const [x, y] = current.split(",").map(Number);
        cells.push({ x, y });
        current = parent.get(current) ?? null;
      }
      return cells.reverse();
    };
    const activeRouteIds = () =>
        (["A", "B"] as RouteId[]).filter((id) => marchRoutes[id].points.length),
      chooseSpawnRoute = (index: number) => {
        const active = activeRouteIds();
        return active.length === 2 ? active[(index + wave) % 2] : active[0];
      },
      assignAvailableRoute = (u: Unit) => {
        const active = activeRouteIds();
        if (!active.length) {
          u.routeId = undefined;
          return;
        }
        const counts = (id: RouteId) =>
          units.filter(
            (v) =>
              v.alive &&
              v.team === "blue" &&
              v.role === "minion" &&
              v.routeId === id,
          ).length;
        u.routeId = [...active].sort((a, b) => counts(a) - counts(b))[0];
        u.routePointIndex = 0;
        u.routeWaitMs = 0;
        u.routeRetreating = false;
        u.routeResumeIndex = undefined;
      };
    const rebalanceRoutes = () => {
      const active = activeRouteIds();
      if (!active.length) return;
      units.filter((u) => u.alive && u.team === "blue" && u.role === "minion").forEach((u, index) => {
        u.routeId = active[index % active.length];
        u.routePointIndex = 0;
        u.routeRetreating = false;
        u.routeWaitMs = 0;
      });
    };
    const addRoutePoint = (id: RouteId, x: number, y: number) => {
        const route = marchRoutes[id];
        if (route.points.length >= 6) {
          setMessage(`${id} 노선은 경로 포인트를 최대 6개까지 지정할 수 있다`);
          tone("hit");
          return;
        }
        if (!seen[y]?.[x] || !open(x, y)) {
          setMessage("탐사한 열린 땅굴에만 진군 포인트를 지정할 수 있다");
          tone("hit");
          return;
        }
        const from = route.points.at(-1) ?? { x: ALLY.x, y: ALLY.y };
        if (from.x === x && from.y === y) return;
        if (!routePathCells(from, { x, y }).length) {
          setMessage(`${id} 노선 단절 · 현재 열린 땅굴로 연결되지 않는다`);
          tone("hit");
          return;
        }
        route.points.push({ x, y });
        route.revision++;
        for (const u of units)
          if (u.alive && u.team === "blue" && u.role === "minion" && !u.routeId)
            assignAvailableRoute(u);
        tone("coin");
        setMessage(
          `${id} 노선 ${route.points.length}번 포인트 지정 · 마지막 포인트는 집결점`,
        );
      },
      undoRoutePoint = (id: RouteId) => {
        const route = marchRoutes[id];
        if (!route.points.length) return;
        route.points.pop();
        route.revision++;
        for (const u of units)
          if (u.routeId === id) {
            u.routePointIndex = Math.min(
              u.routePointIndex ?? 0,
              Math.max(0, route.points.length - 1),
            );
            u.routeRetreating = false;
            u.routeWaitMs = 0;
          }
        setMessage(`${id} 노선 마지막 포인트 취소`);
      },
      clearMarchRoute = (id: RouteId) => {
        marchRoutes[id].points = [];
        marchRoutes[id].revision++;
        for (const u of units)
          if (u.routeId === id) {
            u.routeId = undefined;
            assignAvailableRoute(u);
          }
        setMessage(`${id} 노선 초기화`);
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
        const route = marchRoutes[id];
        route.points = [{ x, y }];
        route.revision++;
        rebalanceRoutes();
        tone("coin");
        setMessage(`${id} 전략 지점 갱신 · 분대가 이 위치를 최종 집결점으로 사용한다`);
      };
    const setRouteStance = (id: RouteId, stance: RouteStance) => {
      const route = marchRoutes[id];
      if (stance === "capture" && !route.points.length) {
        setMessage(`${id} 점령 지점 없음 · 커서를 열린 땅굴에 두고 Ctrl+${id === "A" ? "1" : "2"}로 먼저 지정`);
        return;
      }
      route.stance = stance;
      route.revision++;
      rebalanceRoutes();
      setRouteStances((current) => ({ ...current, [id]: stance }));
      setMessage(`${id} 분대 · ${stance === "assault" ? "돌격" : stance === "guard" ? "경계" : "점령"} 명령`);
    };
    const pathDistanceMap = (goal: { x: number; y: number }) => {
      const distances = new Map<string, number>(),
        queue = [goal];
      if (!open(goal.x, goal.y)) return distances;
      distances.set(`${goal.x},${goal.y}`, 0);
      for (let head = 0; head < queue.length && head < 2000; head++) {
        const p = queue[head],
          distance = distances.get(`${p.x},${p.y}`)!;
        for (const d of DIRS) {
          const x = p.x + d.x,
            y = p.y + d.y,
            key = `${x},${y}`;
          if (distances.has(key) || !open(x, y)) continue;
          distances.set(key, distance + 1);
          queue.push({ x, y });
        }
      }
      return distances;
    };
    const nextPath = (u: Unit, goal: { x: number; y: number }) => {
      const distances = pathDistanceMap(goal);
      if (!distances.has(`${u.x},${u.y}`)) return null;
      const toward = { x: goal.x - u.x, y: goal.y - u.y },
        candidates = DIRS.map((d) => {
          const x = u.x + d.x,
            y = u.y + d.y,
            distance = distances.get(`${x},${y}`);
          if (distance === undefined) return null;
          const crowd = units.filter(
              (v) =>
                v !== u &&
                v.alive &&
                v.team === u.team &&
                Math.abs(v.x - x) + Math.abs(v.y - y) <= 1,
            ).length,
            reserved = marchReservations.has(`${x},${y}`),
            space = DIRS.filter((n) => open(x + n.x, y + n.y)).length,
            cross = toward.x * d.y - toward.y * d.x,
            sideBias = (u.formationSide ?? 0) * Math.sign(cross),
            blocked = occupied(x, y, u) || turretAt(x, y) || baseAt(x, y) || reserved;
          return {
            d,
            x,
            y,
            score:
              distance * 40 +
              crowd * 24 +
              (blocked ? 10000 : 0) -
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
      if (!chosen) return null;
      return chosen.d;
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
            !open(x, y) ||
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
    const spawnMinion = (team: Team, index: number, role: MinionRole, campaignThreat?: "runner" | "vanguard" | "boss", campaignPower: 1 | 2 = 1, campaignName?: string) => {
      const activeLimit = isCampaign && campaignChapter === 1 && team === "red"
        ? CAMPAIGN1_MAX_ACTIVE_INVADERS
        : 12;
      if (
        units.filter((u) => u.alive && u.team === team && u.role === "minion")
          .length >= activeLimit
      )
        return false;
      const campaignZones = campaignChapter === 2
          ? [{ x: 20, y: 18 }, { x: 25, y: 27 }, { x: 34, y: 18 }, { x: 42, y: 22 }, { x: 47, y: 18 }]
          : campaignChapter === 4
            ? [{ x: 20, y: 10 }, { x: 22, y: 26 }, { x: 35, y: 17 }, { x: 45, y: 27 }, ENEMY]
            : campaignChapter === 5
              ? campaignPower === 1
                ? [{ x: 20, y: 26 }, { x: 23, y: 25 }, { x: 35, y: 13 }]
                : [{ x: 35, y: 15 }, { x: 48, y: 10 }, { x: 51, y: 12 }]
              : [ENEMY],
        b = team === "red" && isCampaign ? campaignZones[index % campaignZones.length] : team === "blue" ? ALLY : ENEMY,
        spawnCandidates = [
          { x: b.x, y: b.y }, { x: b.x - 1, y: b.y }, { x: b.x + 1, y: b.y },
          { x: b.x, y: b.y + 1 }, { x: b.x, y: b.y - 1 }, { x: b.x - 2, y: b.y },
          { x: b.x + 2, y: b.y }, { x: b.x - 1, y: b.y + 1 }, { x: b.x + 1, y: b.y + 1 },
        ],
        spawn = spawnCandidates.find((cell) => open(cell.x, cell.y) && !occupied(cell.x, cell.y) && !turretAt(cell.x, cell.y) && !baseAt(cell.x, cell.y)),
        x = spawn?.x ?? b.x,
        y = spawn?.y ?? b.y,
        dir = team === "blue" ? 1 : -1;
      if (!spawn) return false;
      const faction: FactionId =
          team === "blue" ? playerDef.faction : enemyFaction,
        def = minionDefinition(faction, role),
        unitMinionLevel = isCampaign && team === "red" ? 1 : minionLevel,
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
        routeId = team === "blue" ? chooseSpawnRoute(index) : undefined,
        formationSide: -1 | 0 | 1 = role === "escort" ? 0 : index % 2 ? -1 : 1;
      units.push(createMinionUnit({
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
        routeId,
        routePointIndex: 0,
        routeWaitMs: 0,
        routeRetreating: false,
        formationSide,
        campaignAdvanceX: isCampaign && campaignChapter === 1 && team === "red" ? x : undefined,
        campaignAdvanceStallMs: 0,
        campaignRegroups: 0,
      }));
      return true;
    };
    const applyMinionLevel = (next: number) => {
      minionLevel = next;
      if (isCampaign) return;
      const growth = MINION_LEVELS[next - 1];
      for (const unit of units.filter(
        (candidate) => candidate.alive && candidate.role === "minion",
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
    };
    if (isCampaign && campaignChapter === 1) {
      (
        ["escort", "breaker", "shooter"] as MinionRole[]
      ).forEach((role, index) =>
        spawnQueue.push({ team: "blue", role, index, delay: index * 140 }),
      );
    }
    if (isCampaign && campaignChapter === 2) {
      (["escort", "shooter"] as MinionRole[]).forEach((role, index) => spawnQueue.push({ team: "blue", role, index, delay: index * 120 }));
      (["escort", "breaker", "shooter", "breaker", "escort", "shooter", "breaker", "shooter", "breaker", "escort"] as MinionRole[]).forEach((role, index) => spawnQueue.push({ team: "red", role, index: index % 3, delay: 900 + index * 620, campaignPower: index >= 5 ? 2 : 1 }));
      spawnQueue.push({ team: "red", role: "breaker", index: 2, delay: 3500, campaignThreat: "boss", campaignPower: 2, campaignName: "협곡 포식자" });
    }
    if (isCampaign && campaignChapter === 4) {
      enemyShield = 0;
      enemyHp = 900;
      (["escort", "breaker"] as MinionRole[]).forEach((role, index) =>
        spawnQueue.push({ team: "blue", role, index, delay: index * 180 }),
      );
      for (let index = 0; index < 18; index++)
        spawnQueue.push({
          team: "red",
          role: index % 3 === 0 ? "shooter" : index % 3 === 1 ? "breaker" : "escort",
          index: index % 3,
          delay: 900 + index * 520,
          campaignThreat: index === 9 ? "vanguard" : undefined,
          campaignPower: index >= 8 ? 2 : 1,
        });
    }
    if (isCampaign && campaignChapter === 5) {
      (["breaker", "shooter"] as MinionRole[]).forEach((role, index) =>
        spawnQueue.push({ team: "blue", role, index, delay: index * 180 }),
      );
      for (let index = 0; index < 20; index++)
        spawnQueue.push({
          team: "red",
          role: index % 4 === 0 ? "shooter" : "breaker",
          index: index % 3,
          delay: 1000 + index * 540,
          campaignThreat: index === 5 || index === 14 ? "boss" : index % 7 === 6 ? "vanguard" : undefined,
          campaignPower: index >= 8 ? 2 : 1,
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
                turretAt(p.x, p.y),
            )
          )
            continue;
          for (const p of cells)
            if (!open(p.x, p.y)) breakTile(u, p.x, p.y, 99);
          const first = cells[0];
          if (open(first.x, first.y) && !occupied(first.x, first.y, u)) {
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
        const currentDistance = Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y),
          candidates = DIRS.map((direction) => {
            const x = u.x + direction.x, y = u.y + direction.y,
              tile = grid[y]?.[x];
            if (
              !tile || !open(x, y) || occupied(x, y, u) || turretAt(x, y) ||
              baseAt(x, y) || marchReservations.has(`${x},${y}`)
            ) return null;
            const distance = Math.abs(objective.x - x) + Math.abs(objective.y - y);
            if (!allowYield && distance > currentDistance) return null;
            const crowd = units.filter(
              (ally) => ally.alive && ally.team === u.team && ally !== u && Math.abs(ally.x - x) + Math.abs(ally.y - y) <= 1,
            ).length,
              reversePenalty = direction.x === -preferred.x && direction.y === -preferred.y ? 2.8 : 0,
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
        const nx = u.x + step.x, ny = u.y + step.y;
        u.dir = step;
        if (occupied(nx, ny, u) || turretAt(nx, ny) || baseAt(nx, ny) || marchReservations.has(`${nx},${ny}`))
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
          goal = { x: ALLY.x + slot.x, y: ALLY.y + slot.y };
        return open(goal.x, goal.y) && !turretAt(goal.x, goal.y)
          ? goal
          : { x: ALLY.x, y: ALLY.y + 2 };
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
              (p) => open(p.x, p.y) && !turretAt(p.x, p.y) && !baseAt(p.x, p.y),
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
        const core = team === "blue" ? ENEMY : ALLY;
        return units.some(
          (unit) =>
            unit.alive &&
            unit.team === team &&
            Math.hypot(unit.x - core.x, unit.y - core.y) <= 7,
        );
      },
      explorationGoal = (unit: Unit) => {
        const now = performance.now(), own = unit.team === "blue" ? ALLY : ENEMY,
          reached = unit.aiSearchGoal && Math.hypot(unit.x - unit.aiSearchGoal.x, unit.y - unit.aiSearchGoal.y) <= 2;
        if (!unit.aiSearchGoal || reached || (unit.aiSearchUntil ?? 0) < now) {
          const candidates = [
            { x: 9, y: 7 }, { x: 28, y: 6 }, { x: 46, y: 8 },
            { x: 46, y: 28 }, { x: 28, y: 29 }, { x: 9, y: 28 },
            { x: 17, y: 18 }, { x: 38, y: 18 },
          ].filter((point) =>
            Math.hypot(point.x - own.x, point.y - own.y) > 10 &&
            grid[point.y]?.[point.x]?.type !== 4),
            nearbyFallbacks = DIRS
              .map((direction) => ({ x: own.x + direction.x * 8, y: own.y + direction.y * 8 }))
              .filter((point) => grid[point.y]?.[point.x]?.type !== 4),
            mapFallback = grid.flatMap((row, y) => row.map((tile, x) => ({ tile, x, y })))
              .find(({ tile, x, y }) => tile.type !== 4 && Math.hypot(x - own.x, y - own.y) > 10),
            sectors = candidates.length
              ? candidates
              : nearbyFallbacks.length
                ? nearbyFallbacks
                : mapFallback
                  ? [{ x: mapFallback.x, y: mapFallback.y }]
                  : [{ x: own.x, y: own.y }];
          const phase = Math.floor(now / 9000), index = Math.abs(unit.id * 5 + phase * 3) % sectors.length;
          unit.aiSearchGoal = { ...sectors[index] };
          unit.aiSearchUntil = now + 12000;
        }
        return unit.aiSearchGoal;
      },
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
      const reservationFrame = Math.floor(performance.now() / 34);
      if (reservationFrame !== lastMarchReservationFrame) {
        marchReservations.clear();
        lastMarchReservationFrame = reservationFrame;
      }
      const tick = 1000 / (u.moveSpeed * terrainMoveFactor(u.x, u.y));
      const campaign1Invader = isCampaign && campaignChapter === 1 && u.team === "red" && !u.campaignScout;
      if (campaign1Invader) {
        const watch = campaign1AdvanceWatch(u.campaignAdvanceX, u.x, u.campaignAdvanceStallMs, tick);
        u.campaignAdvanceX = watch.bestX;
        u.campaignAdvanceStallMs = watch.stalledMs;
        if (watch.shouldRegroup) {
          const coreDistances = pathDistanceMap(ALLY),
            candidates: { x: number; y: number; distance: number }[] = [];
          for (let forward = 4; forward >= 1; forward--)
            for (const offsetY of [0, -1, 1, -2, 2, -3, 3]) {
              const x = u.x - forward,
                y = u.y + offsetY,
                distance = coreDistances.get(`${x},${y}`);
              if (distance === undefined || !open(x, y) || occupied(x, y) || turretAt(x, y) || baseAt(x, y)) continue;
              candidates.push({ x, y, distance });
            }
          candidates.sort((a, b) => a.distance - b.distance || a.x - b.x || Math.abs(a.y - ALLY.y) - Math.abs(b.y - ALLY.y));
          const regroup = candidates[0];
          if (regroup) {
            commitGridMove(u, regroup.x, regroup.y, 520);
            u.campaignAdvanceX = regroup.x;
            u.campaignAdvanceStallMs = 0;
            u.campaignRegroups = (u.campaignRegroups ?? 0) + 1;
            u.blockedMs = 0;
            u.noPathMs = 0;
            u.act = 520;
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
          u.act = u.attackInterval * 1000;
          return;
        }
        if (Math.abs(core.x - u.x) + Math.abs(core.y - u.y) === 1) {
          melee(u, { x: core.x - u.x, y: core.y - u.y });
          u.act = u.attackInterval * 1000;
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
        if (response === "attack" && obstruction) {
          melee(u, {
            x: obstruction.turret.x - u.x,
            y: obstruction.turret.y - u.y,
          });
          u.blockedMs = 0;
          u.noPathMs = 0;
          u.act = u.attackInterval * 1000;
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
        knowsEnemyBase = campaign1Invader || teamKnowsEnemyCore(u.team);
      if (Math.abs(enemyBase.x - u.x) + Math.abs(enemyBase.y - u.y) === 1) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        melee(u, { x: enemyBase.x - u.x, y: enemyBase.y - u.y });
        u.act = u.attackInterval * 1000;
        return;
      }
      const shooterRange = Math.ceil(
          minionDefinition(u.faction, "shooter").stats.range,
        ),
        escortTarget = isCampaign && campaignChapter === 2 && u.team === "red"
          ? units
              .filter((target) => target.alive && target.role === "scientist")
              .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]
          : undefined,
        ranged =
          u.minionRole === "shooter"
            ? escortTarget && Math.hypot(escortTarget.x - u.x, escortTarget.y - u.y) <= shooterRange
              ? escortTarget
              : nearestEnemy(u, shooterRange)
            : undefined,
        rangedTurret =
          u.minionRole === "shooter"
            ? nearestEnemyTurret(u, shooterRange)
            : undefined;
      if (ranged && clearRay(u.x, u.y, ranged.x, ranged.y)) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        u.dir = cardinal(ranged.x - u.x, ranged.y - u.y);
        fire(u, ranged.x - u.x, ranged.y - u.y, "minion", u.attack);
        u.act = u.attackInterval * 1000;
        return;
      }
      if (rangedTurret && clearRay(u.x, u.y, rangedTurret.x, rangedTurret.y)) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        u.dir = cardinal(rangedTurret.x - u.x, rangedTurret.y - u.y);
        fire(u, rangedTurret.x - u.x, rangedTurret.y - u.y, "minion", u.attack);
        u.act = u.attackInterval * 1000;
        return;
      }
      const close = nearestEnemy(u, 1);
      if (close) {
        u.blockedMs = 0;
        u.noPathMs = 0;
        melee(u, { x: close.x - u.x, y: close.y - u.y });
        u.act = u.attackInterval * 1000;
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
        u.act = u.attackInterval * 1000;
        return;
      }
      if (escortTarget) {
        const chaseStep = nextPath(u, escortTarget);
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
      const currentRoute = u.team === "blue" && u.routeId ? marchRoutes[u.routeId] : undefined,
        stance = currentRoute?.stance ?? "assault",
        capturePoint = currentRoute?.points[currentRoute.points.length - 1],
        priorityCandidate = campaign1Invader || stance === "guard" ? undefined : nearestEnemy(u, stance === "capture" ? 6 : 5),
        priorityEnemy =
          stance === "capture" &&
          priorityCandidate &&
          capturePoint &&
          Math.hypot(priorityCandidate.x - capturePoint.x, priorityCandidate.y - capturePoint.y) > 5
            ? undefined
            : priorityCandidate;
      if (priorityEnemy) {
        const chaseStep = nextPath(u, priorityEnemy);
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
      let objective: { x: number; y: number }, route: MarchRoute | undefined;
      if (u.team === "blue") {
        const hasAssignedRoute = Boolean(u.routeId && marchRoutes[u.routeId].points.length);
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
          if (!u.routeId || !marchRoutes[u.routeId].points.length)
            assignAvailableRoute(u);
          route = u.routeId ? marchRoutes[u.routeId] : undefined;
          if (route?.points.length) {
          let index = Math.max(
            -1,
            Math.min(u.routePointIndex ?? 0, route.points.length - 1),
          );
          if (u.routeRetreating) {
            const retreatTarget =
              index < 0 ? guardGoal(u) : route.points[index];
            if (
              Math.abs(retreatTarget.x - u.x) +
                Math.abs(retreatTarget.y - u.y) <=
              1
            ) {
              const resumeIndex = Math.min(
                  u.routeResumeIndex ?? 0,
                  route.points.length - 1,
                ),
                resume = route.points[resumeIndex];
              if (pathDistanceMap(resume).has(`${u.x},${u.y}`)) {
                u.routeRetreating = false;
                u.routePointIndex = resumeIndex;
                u.routeResumeIndex = undefined;
                u.routeWaitMs = 0;
                index = resumeIndex;
                setMessage(`${route.id} 노선 재개 · 열린 땅굴 확인`);
              } else {
                u.routeWaitMs = (u.routeWaitMs ?? 0) + tick;
                if (u.routeWaitMs >= 7000) {
                  recallMinion(
                    u,
                    `${route.id} 노선 장기 단절 · ${u.name} 거점 회수`,
                  );
                  return;
                }
                u.act = tick;
                return;
              }
            }
            objective = retreatTarget;
          } else {
            while (
              index < route.points.length - 1 &&
              Math.abs(route.points[index].x - u.x) +
                Math.abs(route.points[index].y - u.y) <=
                1
            )
              index++;
            u.routePointIndex = Math.max(0, index);
            const point = route.points[u.routePointIndex],
              last = u.routePointIndex === route.points.length - 1;
            objective = last ? rallyGoal(u, point) : point;
            if (
              last &&
              Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y) <= 1
            ) {
              u.noPathMs = 0;
              u.blockedMs = 0;
              u.minionVisual = "idle";
              u.act = tick;
              return;
            }
          }
          } else {
            // 지시가 없어도 출구가 생기면 소규모 정찰을 시작한다.
            objective = explorationGoal(u);
            if (Math.abs(objective.x - u.x) + Math.abs(objective.y - u.y) <= 1) {
              u.minionVisual = "idle";
              u.act = tick;
              return;
            }
          }
        }
      } else {
        const installation = campaign1Invader ? undefined : reachableEnemyInstallation(u);
        objective = installation?.approach ?? (knowsEnemyBase ? enemyBase : explorationGoal(u));
      }
      let step = nextPath(u, objective);
      if (!step) {
        const obstruction = reachableEnemyInstallation(u, true);
        if (obstruction) {
          objective = obstruction.approach;
          step = nextPath(u, objective);
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
      } else {
        u.blockedMs = 0;
        u.noPathMs = (u.noPathMs ?? 0) + tick;
        if (tryEmergencyBreach(u, objective)) return;
        if (route && !u.routeRetreating && u.noPathMs >= 3000) {
          const blockedIndex = u.routePointIndex ?? 0;
          u.routeResumeIndex = blockedIndex;
          u.routePointIndex = blockedIndex - 1;
          u.routeRetreating = true;
          u.routeWaitMs = 0;
          u.noPathMs = 0;
          setMessage(`${route.id} 노선 단절 · ${u.name} 이전 포인트로 후퇴`);
        } else if (
          (!route && u.noPathMs >= 5000) ||
          (route && u.routeRetreating && u.noPathMs >= 7000)
        )
          recallMinion(
            u,
            route
              ? `${route.id} 노선 복귀 불가 · ${u.name} 회수`
              : `${u.name} 경로 상실 · 회수`,
          );
      }
      u.act = tick;
    };
    const drawMarchRoutes = (minimap = false) => {
      for (const id of ["A", "B"] as RouteId[]) {
        const route = marchRoutes[id],
          target = route.points[0];
        if (!target) continue;
        const cells = routePathCells(ALLY, target),
          scaleX = minimap ? MINIMAP.w / COLS : S,
          scaleY = minimap ? MINIMAP.h / ROWS : S,
          originX = minimap ? MINIMAP.x : -cam.x,
          originY = minimap ? MINIMAP.y : -cam.y,
          broken = !cells.length;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = minimap ? 0.48 : 0.38;
        ctx.fillStyle = broken ? "#ff7668" : route.color;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = minimap ? 1 : 2;
        const shown = (broken ? [ALLY, target] : cells).filter(
            (cell) => seen[cell.y]?.[cell.x],
          ),
          stride = minimap ? 5 : 2;
        for (let i = 1; i < shown.length; i += stride) {
          const prev = shown[Math.max(0, i - 1)],
            cell = shown[i],
            dx = cell.x - prev.x,
            dy = cell.y - prev.y,
            x = originX + (cell.x + 0.5) * scaleX,
            y = originY + (cell.y + 0.5) * scaleY,
            angle = Math.atan2(dy * scaleY, dx * scaleX);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(minimap ? 3 : 8, 0);
          ctx.lineTo(minimap ? -2 : -7, minimap ? -2 : -6);
          ctx.lineTo(minimap ? 0 : -3, 0);
          ctx.lineTo(minimap ? -2 : -7, minimap ? 2 : 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        if (!minimap && seen[target.y]?.[target.x]) {
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
          ctx.fillText(broken ? `${id} 단절` : `${id} 전략`, x, y - 8);
        }
        ctx.restore();
      }
    };
    const heroBrainRole = (unit: Unit): HeroBrainRole => {
        const role = HEROES.find((definition) => definition.id === unit.heroId)?.role ?? "";
        if (/지원|수리/.test(role)) return "support";
        if (/탱커|중장갑/.test(role)) return "tank";
        if (/원거리|지속|제어/.test(role)) return "artillery";
        if (/고속|정찰|스피드/.test(role)) return "skirmisher";
        return "assault";
      },
       setBattleHeroAction = (unit: Unit, slot: 0 | 1 | 2 | 3 | 4, duration: number) => {
        if (slot === 4) unit.ultimateLabelUntil = performance.now() + 1150;
        unit.arenaActionSlot = slot;
        unit.arenaActionStartedAt = performance.now();
        unit.arenaActionDuration = duration;
        unit.arenaActionUntil = performance.now() + duration;
        unit.act = duration;
      },
      battleHeroTargets = (
        attacker: Unit,
        radius: number,
        ignoresTerrain = false,
      ) =>
        units.filter(
          (target) =>
            target.alive &&
            target.team !== attacker.team &&
            Math.hypot(target.x - attacker.x, target.y - attacker.y) <= radius &&
            (ignoresTerrain || clearRay(attacker.x, attacker.y, target.x, target.y)),
        ),
      damageFromBattleHero = (attacker: Unit, target: Unit, multiplier: number, stun = 0, actionName = "기본 공격") => {
        const dealt = hurt(
          target,
          attacker.attack * Math.max(0.35, multiplier),
          attacker.team,
          true,
          attacker.critChance,
          attacker.critMultiplier,
          false,
          { attacker: attacker.name, action: actionName },
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
        if (Math.hypot(target.x - attacker.x, target.y - attacker.y) > Math.max(2.2, action.range + 1.25)) return;
        if (
          !new Set(["acidShot", "glide", "overclock"]).has(mode) &&
          !clearRay(attacker.x, attacker.y, target.x, target.y)
        )
          return;
        damageFromBattleHero(attacker, target, action.damage, stunModes.has(mode) ? 720 : 0, actionName);
        if (["acidMark", "acidShot"].includes(mode)) target.vulnerableUntil = now + 5200;
        if (["webTrap", "silkPull", "webLock"].includes(mode)) target.act = Math.max(target.act, 950);
        if (pushModes.has(mode) && target.alive) {
          const direction = cardinal(target.x - attacker.x, target.y - attacker.y),
            nx = target.x + direction.x,
            ny = target.y + direction.y;
          if (open(nx, ny) && !occupied(nx, ny, target) && !turretAt(nx, ny) && !baseAt(nx, ny)) {
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
        battleHeroFx(attacker, target, mode, radius, duration);
        setBattleHeroAction(attacker, slot, duration);
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
        battleHeroFx(attacker, target, action.mode, Math.max(1.2, action.radius), duration);
        setBattleHeroAction(attacker, slot, duration);
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
      executeBattleHeroDrill = (attacker: Unit, goal: { x: number; y: number }) => {
        const now = performance.now(), action = heroAction(attacker.heroId ?? "yoo-seungcheon", 3),
          direction = cardinal(goal.x - attacker.x, goal.y - attacker.y),
          kitDefinition = heroKit(attacker.heroId ?? "yoo-seungcheon"),
          length = Math.max(3, kitDefinition.drill.length);
        for (let distance = 1; distance <= length; distance++)
          breakTile(attacker, attacker.x + direction.x * distance, attacker.y + direction.y * distance, attacker.faction === "ai" ? 3 : 2);
        battleHeroFx(attacker, null, action.mode, 2, 820);
        setBattleHeroAction(attacker, 3, 820);
        void combatAudio.skillCue(attacker.heroId ?? "yoo-seungcheon", 3, attacker.team === "blue" ? .76 : .58);
        const cooldowns = attacker.aiCooldowns ?? [0, 0, 0, 0];
        cooldowns[2] = now + action.cooldown;
        attacker.aiCooldowns = cooldowns;
        attacker.aiPreviousAction = "drill";
      },
      transformOnlinePoint = (unit: Unit, x: number, y: number) =>
        unit.team === "red" ? { x: COLS - 1 - x, y: ROWS - 1 - y } : { x, y },
      processOnlineBattleCommands = () => {
        while (onlineCommandInboxRef.current.length) {
          const command = onlineCommandInboxRef.current.shift()!,
            unit = battleAiHeroes.find((candidate) => candidate.onlinePlayerId === command.playerId);
          if (!unit || !unit.alive) continue;
          const target = nearestEnemy(unit, 9);
          if (command.type === "move" && command.x !== undefined && command.y !== undefined) {
            unit.remoteGoal = transformOnlinePoint(unit, command.x, command.y);
          } else if (command.type === "attack" && target) {
            const range = HEROES.find((definition) => definition.id === unit.heroId)?.stats.range ?? 1.2;
            unit.dir = cardinal(target.x - unit.x, target.y - unit.y);
            if (range > 2) fire(unit, target.x - unit.x, target.y - unit.y, "arrow", unit.attack);
            else melee(unit, { x: target.x - unit.x, y: target.y - unit.y }, 4);
            setBattleHeroAction(unit, 0, Math.max(380, unit.attackInterval * 720));
          } else if (command.type === "skill" && command.slot && target) {
            const ready = unit.aiCooldowns ?? [0, 0, 0, 0], index = command.slot === 1 ? 0 : command.slot === 2 ? 1 : 3;
            if (ready[index] <= performance.now()) executeBattleHeroSkill(unit, target, command.slot);
          } else if (command.type === "drill") executeBattleHeroDrill(unit, unit.remoteGoal ?? (unit.team === "blue" ? ENEMY : ALLY));
        }
      },
      syncOnlineBattleState = (dt: number) => {
        if (activeMatchConfig?.kind !== "online" || !onlineRoom || !onlineIdentity) return;
        const localRoomPlayer = onlineRoom.players.find((player) => player.id === onlineIdentity.playerId),
          isHost = onlineRoom.hostId === onlineIdentity.playerId;
        if (!localRoomPlayer) return;
        if (!isHost) {
          const snapshot = onlineSnapshotRef.current;
          if (!snapshot || snapshot.sequence <= appliedOnlineSnapshot) return;
          appliedOnlineSnapshot = snapshot.sequence;
          if (snapshot.minionLevel !== minionLevel)
            applyMinionLevel(snapshot.minionLevel);
          const mirrored = localRoomPlayer.team === "red";
          allyHp = mirrored ? snapshot.enemyCore.hp : snapshot.allyCore.hp;
          allyShield = mirrored ? snapshot.enemyCore.shield : snapshot.allyCore.shield;
          enemyHp = mirrored ? snapshot.allyCore.hp : snapshot.enemyCore.hp;
          enemyShield = mirrored ? snapshot.allyCore.shield : snapshot.enemyCore.shield;
          for (const state of snapshot.heroes) {
            const unit = units.find((candidate) => candidate.onlinePlayerId === state.playerId);
            if (!unit) continue;
            unit.x = mirrored ? COLS - 1 - state.x : state.x;
            unit.y = mirrored ? ROWS - 1 - state.y : state.y;
            unit.hp = state.hp;
            unit.maxHp = state.maxHp;
            unit.alive = state.alive;
            unit.dir = mirrored ? { x: -state.dir.x, y: -state.dir.y } : state.dir;
            if (unit === hero) {
              heroWorld.x = unit.x * S + S / 2;
              heroWorld.y = unit.y * S + S / 2;
            }
          }
          return;
        }
        onlineSnapshotClock -= dt;
        if (onlineSnapshotClock > 0) return;
        onlineSnapshotClock = 500;
        void sendOnlineBattleSnapshot(onlineRoom.code, onlineIdentity, {
          minionLevel: minionLevel as 1 | 2 | 3,
          allyCore: { hp: allyHp, shield: allyShield },
          enemyCore: { hp: enemyHp, shield: enemyShield },
          heroes: units.filter((unit) => unit.role === "hero" && unit.onlinePlayerId).map((unit) => ({
            playerId: unit.onlinePlayerId!, x: unit.x, y: unit.y, hp: unit.hp, maxHp: unit.maxHp,
            alive: unit.alive, dir: unit.dir,
          })),
        }).catch(() => undefined);
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
              moveOrDig(aiHero, remoteStep.x, remoteStep.y);
              aiHero.act = 260 / terrainMoveFactor(aiHero.x, aiHero.y);
            }
          } else aiHero.act = 120;
          return;
        }
        const now = performance.now(), definition = HEROES.find((candidate) => candidate.id === aiHero.heroId),
          ownCore = aiHero.team === "blue" ? ALLY : ENEMY,
          opposingCore = aiHero.team === "blue" ? ENEMY : ALLY,
          allies = units.filter((unit) => unit.alive && unit.team === aiHero.team && unit !== aiHero),
          // AI도 자기 시야와 거점 방어 경보 안의 대상만 안다.
          enemies = units.filter(
            (unit) =>
              unit.alive && unit.team !== aiHero.team &&
              (Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y) <= 9 ||
                Math.hypot(unit.x - ownCore.x, unit.y - ownCore.y) <= 8),
          ),
          target = enemies
            .map((unit) => ({
              unit,
              score:
                Math.hypot(unit.x - aiHero.x, unit.y - aiHero.y) * 3 +
                unit.hp / unit.maxHp * 2 -
                (unit.role === "hero" ? 2.4 : 0) -
                (Math.hypot(unit.x - ownCore.x, unit.y - ownCore.y) < 8 ? 5 : 0),
            }))
            .sort((a, b) => a.score - b.score)[0]?.unit,
          targetDistance = target ? Math.hypot(target.x - aiHero.x, target.y - aiHero.y) : 99,
          basicRange = Math.max(1.25, definition?.stats.range ?? 1.25),
          coreDanger = Math.min(1, enemies.filter((unit) => Math.hypot(unit.x - ownCore.x, unit.y - ownCore.y) < 9).length / 4),
          strategicGoal = teamKnowsEnemyCore(aiHero.team) ? opposingCore : explorationGoal(aiHero),
          routeStep = cardinal(strategicGoal.x - aiHero.x, strategicGoal.y - aiHero.y),
          routeBlocked = !open(aiHero.x + routeStep.x, aiHero.y + routeStep.y),
          cooldowns = aiHero.aiCooldowns ?? [0, 0, 0, 0],
          decision = decideHeroAction({
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
          });
        aiHero.aiDecisionReason = decision.reason;
        aiHero.aiTargetId = target?.id;
        const skillChainReady = (aiHero.aiComboLockUntil ?? 0) <= now;
        if (target && skillChainReady && decision.action === "ultimate" && cooldowns[3] <= now) return executeBattleHeroSkill(aiHero, target, 4);
        if (target && skillChainReady && decision.action === "skill2" && cooldowns[1] <= now) return executeBattleHeroSkill(aiHero, target, 2);
        if (target && skillChainReady && decision.action === "skill1" && cooldowns[0] <= now) return executeBattleHeroSkill(aiHero, target, 1);
        if (decision.action === "drill" && cooldowns[2] <= now) return executeBattleHeroDrill(aiHero, strategicGoal);
        if (target && targetDistance <= basicRange && clearRay(aiHero.x, aiHero.y, target.x, target.y)) {
          aiHero.dir = cardinal(target.x - aiHero.x, target.y - aiHero.y);
          if (basicRange > 2) fire(aiHero, target.x - aiHero.x, target.y - aiHero.y, "arrow", aiHero.attack);
          else melee(aiHero, { x: target.x - aiHero.x, y: target.y - aiHero.y }, 4);
          setBattleHeroAction(aiHero, 0, Math.max(380, aiHero.attackInterval * 720));
          aiHero.aiPreviousAction = "attack";
          return;
        }
        const retreating = decision.action === "retreat" || decision.action === "regroup",
          role = heroBrainRole(aiHero),
          screenMinion = units
            .filter((unit) => unit.alive && unit.team === aiHero.team && unit.role === "minion")
            .sort((a, b) => Math.hypot(a.x - strategicGoal.x, a.y - strategicGoal.y) - Math.hypot(b.x - strategicGoal.x, b.y - strategicGoal.y))[0],
          formationGoal = (role === "support" || role === "artillery") && screenMinion
            ? { x: Math.round((screenMinion.x + ownCore.x) / 2), y: Math.round((screenMinion.y + ownCore.y) / 2) }
            : strategicGoal,
          goal = retreating ? ownCore : target && targetDistance < 9 ? target : formationGoal;
        if (retreating && Math.hypot(aiHero.x - ownCore.x, aiHero.y - ownCore.y) <= 2.5) {
          aiHero.act = 480;
          return;
        }
        let step = nextPath(aiHero, goal),
          blockingInstallation = step ? turretAt(aiHero.x + step.x, aiHero.y + step.y) : undefined,
          obstruction = blockingInstallation?.team !== aiHero.team
            ? { turret: blockingInstallation, approach: { x: aiHero.x, y: aiHero.y }, distance: 0 }
            : !step
              ? reachableEnemyInstallation(aiHero)
              : undefined;
        const response = siegeResponse({
          adjacentEnemyInstallation: Boolean(blockingInstallation && blockingInstallation.team !== aiHero.team),
          pathBlockedByEnemyInstallation: Boolean(blockingInstallation && blockingInstallation.team !== aiHero.team),
          reachableEnemyInstallation: Boolean(obstruction),
        });
        if (response === "attack" && obstruction) {
          const siegeTarget = obstruction.turret,
            siegeDistance = Math.hypot(siegeTarget.x - aiHero.x, siegeTarget.y - aiHero.y);
          if (skillChainReady && decision.action === "ultimate" && cooldowns[3] <= now && executeBattleHeroSiegeSkill(aiHero, siegeTarget, 4)) return;
          if (skillChainReady && decision.action === "skill2" && cooldowns[1] <= now && executeBattleHeroSiegeSkill(aiHero, siegeTarget, 2)) return;
          if (skillChainReady && decision.action === "skill1" && cooldowns[0] <= now && executeBattleHeroSiegeSkill(aiHero, siegeTarget, 1)) return;
          aiHero.dir = cardinal(siegeTarget.x - aiHero.x, siegeTarget.y - aiHero.y);
          if (basicRange > 2 && siegeDistance <= basicRange && clearRay(aiHero.x, aiHero.y, siegeTarget.x, siegeTarget.y))
            fire(aiHero, siegeTarget.x - aiHero.x, siegeTarget.y - aiHero.y, "arrow", aiHero.attack);
          else melee(aiHero, { x: siegeTarget.x - aiHero.x, y: siegeTarget.y - aiHero.y }, 4);
          setBattleHeroAction(aiHero, 0, Math.max(380, aiHero.attackInterval * 720));
          aiHero.aiPreviousAction = "attack";
          return;
        }
        if (response === "approach" && obstruction)
          step = nextPath(aiHero, obstruction.approach);
        step ??= cardinal(goal.x - aiHero.x, goal.y - aiHero.y);
        if (
          grid[aiHero.y + step.y]?.[aiHero.x + step.x]?.type === 4 ||
          baseAt(aiHero.x + step.x, aiHero.y + step.y) ||
          turretAt(aiHero.x + step.x, aiHero.y + step.y)?.team === aiHero.team
        ) {
          const alternatives = DIRS
            .filter((direction) => {
              const x = aiHero.x + direction.x, y = aiHero.y + direction.y, tile = grid[y]?.[x];
              return tile && tile.type !== 4 && !baseAt(x, y) && !turretAt(x, y) && !occupied(x, y, aiHero);
            })
            .sort((a, b) => {
              const distanceA = Math.hypot(aiHero.x + a.x - goal.x, aiHero.y + a.y - goal.y),
                distanceB = Math.hypot(aiHero.x + b.x - goal.x, aiHero.y + b.y - goal.y);
              return distanceA - distanceB || ((aiHero.id % 2 ? a.y - b.y : a.x - b.x));
            });
          if (alternatives[0]) step = alternatives[0];
        }
        if (grid[aiHero.y]?.[aiHero.x]?.hazard === "steam" && selectedBattleMap.hazard === "steam") {
          const safe = DIRS.find((direction) => open(aiHero.x + direction.x, aiHero.y + direction.y) && grid[aiHero.y + direction.y]?.[aiHero.x + direction.x]?.hazard !== "steam");
          if (safe) moveOrDig(aiHero, safe.x, safe.y);
          else moveOrDig(aiHero, step.x, step.y);
        } else moveOrDig(aiHero, step.x, step.y);
        aiHero.aiPreviousAction = decision.action;
        aiHero.act = (240 + (aiHero.id % 4) * 24) / terrainMoveFactor(aiHero.x, aiHero.y);
      };
    const arenaFighters = () =>
        units.filter(
          (unit) =>
            unit.alive &&
            (unit.campaignAi === "arena" ||
              (isCampaign && campaignChapter === 3 && unit === hero)),
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
          { attacker: attacker.name, action: actionName },
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
          if (!open(nx, ny) || occupied(nx, ny, target) || turretAt(nx, ny) || baseAt(nx, ny)) break;
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
          if (target === attacker || Math.hypot(target.x - attacker.x, target.y - attacker.y) > radius) continue;
          arenaDamage(attacker, target, damage, actionName);
          if (target.alive && stun) target.act = Math.max(target.act, stun);
        }
      },
      chooseArenaTarget = (fighter: Unit) => {
        const now = performance.now(), candidates = arenaFighters().filter((unit) => unit !== fighter),
          current = candidates.find((unit) => unit.id === fighter.arenaTargetId);
        if (!candidates.length) return null;
        if (current && now < (fighter.arenaTargetUntil ?? 0)) return current;
        const playerTarget = candidates.find((unit) => unit === hero),
          otherFighters = candidates.filter((unit) => unit !== hero),
          playerAttackers = units.filter(
            (unit) =>
              unit.alive &&
              unit !== fighter &&
              unit.campaignAi === "arena" &&
              unit.arenaTargetId === hero.id &&
              now < (unit.arenaTargetUntil ?? 0),
          ).length,
          targetPool = playerTarget && playerAttackers < 2 && (!otherFighters.length || random() < 0.6)
            ? [playerTarget]
            : otherFighters.length ? otherFighters : candidates,
          id = fighter.campaignHeroId ?? "yoo-seungcheon",
          ranked = targetPool
          .map((unit) => ({
            unit,
            score:
              Math.hypot(unit.x - fighter.x, unit.y - fighter.y) * (id === "ahn-seona" ? 0.18 : 0.55) +
              (unit.hp / unit.maxHp) * (id === "kimssi" ? 1.8 : 0.9) +
              arenaFighters().filter((other) => other !== fighter && other.arenaTargetId === unit.id).length * 1.15 +
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
        else if (action.mode === "groupHeal")
          fighter.hp = Math.min(fighter.maxHp, fighter.hp + fighter.maxHp * 0.18);
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
              ? fighter.hp / fighter.maxHp < 0.72 ? 2 : 1
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
            if (!open(x, y) || occupied(x, y, fighter) || turretAt(x, y) || baseAt(x, y)) return null;
            const nextDistance = Math.hypot(target.x - x, target.y - y),
              crowd = arenaFighters().filter((unit) => unit !== fighter && Math.hypot(unit.x - x, unit.y - y) <= 1.2).length,
              exits = DIRS.filter((exit) => open(x + exit.x, y + exit.y)).length;
            return { d, score: Math.abs(nextDistance - desiredDistance) * 3.2 + crowd * 1.6 - exits * 0.35 + random() * 0.8 };
          }).filter(Boolean) as Array<{ d: { x: number; y: number }; score: number }>;
        movementChoices.sort((a, b) => a.score - b.score);
        let step: { x: number; y: number } | null = movementChoices[0]?.d ?? null;
        if (!step) step = nextPath(fighter, { x: target.x, y: target.y });
        if (step) {
          moveOrDig(fighter, step.x, step.y, 300);
          if (fighter === hero) {
            heroWorld.x = hero.x * S + S / 2;
            heroWorld.y = hero.y * S + S / 2;
            heroMoveUntil = now + 320;
          }
        }
        fighter.act = 300 + random() * 90;
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
      const target = nearestEnemy(fighter, fighter.campaignAi === "companion" ? 9 : 30);
      if (target) {
        // 동료도 대전 영웅과 같은 판단·기술·기본 공격 모듈을 사용한다.
        stepBattleHero(fighter);
        return;
      }
      if (fighter.campaignAi === "companion") {
        const follow = { x: hero.x - 1, y: hero.y + 1 };
        if (Math.abs(fighter.x - follow.x) + Math.abs(fighter.y - follow.y) > 2) {
          const step = nextPath(fighter, follow);
          if (step) moveOrDig(fighter, step.x, step.y);
        }
      }
      fighter.act = 320;
    };
    const stepTurrets = (dt: number) => {
        for (const t of turrets) {
          const def = buildDef(t.kind);
          if (
            t.hp <= 0 ||
            def.category === "blocker" ||
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
                  ((isCampaign && campaignChapter === 2 && t.team === "red") || clearRay(t.x, t.y, u.x, u.y)),
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
                          : "missile",
              speed =
                kind === "root"
                  ? 6
                  : kind === "missile"
                    ? 7
                    : kind === "laser"
                      ? 14
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
                splash: kind === "missile" ? 1.35 : 0,
                pierce: kind === "laser",
                hitIds: [],
                ignoresTerrain: isCampaign && campaignChapter === 2 && t.team === "red",
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
            (grid[ty][tx].type !== 0 && s.kind !== "acid" && !s.ignoresTerrain)
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
            if (u.alive && u.team !== s.team && !s.hitIds?.includes(u.id)) {
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
                  );
                  if (s.kind === "receipt")
                    repairAt(
                      u.x,
                      u.y,
                      Math.max(4, Math.round(hero.maxHp * 0.045)),
                    );
                }
                if (s.stun) u.act = Math.max(u.act, s.stun);
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
            if (t.hp > 0 && t.team !== s.team) {
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
            if (m.distance < 24) {
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
              if (u.alive && u.team === "red" && !s.hitIds?.includes(u.id)) {
                const p = unitWorld(u),
                  m = segmentMetric(p.x, p.y, ax, ay, bx, by);
                if (m.distance <= 26)
                  consider({ kind: "unit", at: m.t, unit: u });
              }
            for (const t of turrets)
              if (t.hp > 0 && t.team === "red") {
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
            if (enemyHp > 0 && bm.distance <= 29)
              consider({ kind: "base", at: bm.t });
            if (nearest) {
              const chosen = nearest as {
                kind: "unit" | "turret" | "base";
                at: number;
                unit?: Unit;
                turret?: Turret;
              };
              if (chosen.kind === "unit" && chosen.unit) {
                hurt(chosen.unit, slashDamage, "blue", false);
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
        cam.x = Math.max(0, Math.min(W - VW, cam.x));
        cam.y = Math.max(0, Math.min(H - VH, cam.y));
      },
      focusCameraAt = (wx: number, wy: number) => {
        cameraFree = true;
        cam.x = wx - VW / 2;
        cam.y = wy - VH / 2;
        clampCamera();
      },
      minimapPoint = (x: number, y: number) =>
        !minimapCollapsedRef.current &&
        x >= MINIMAP.x &&
        x <= MINIMAP.x + MINIMAP.w &&
        y >= MINIMAP.y &&
        y <= MINIMAP.y + MINIMAP.h,
      minimapFocus = (x: number, y: number) => {
        focusCameraAt(
          ((x - MINIMAP.x) / MINIMAP.w) * W,
          ((y - MINIMAP.y) / MINIMAP.h) * H,
        );
        setMessage(`미니맵 관측 위치 · Space로 ${playerDef.name} 복귀`);
      };
    const cancelRouteEdit = () => {
        routeEdit = null;
        setRouteChoice("none");
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
        cursorScreen.x = Math.max(0, Math.min(VW, x));
        cursorScreen.y = Math.max(0, Math.min(VH, y));
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
          mode = kit.basic.mode;
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
            opts =
              mode === "acidSpit"
                ? { splash: 0.45 }
                : mode === "dustNeedle"
                  ? { stun: 280 }
                  : mode === "silkNeedle"
                    ? { stun: 420 }
                    : mode === "stampLaser"
                      ? { pierce: true }
                      : {};
          skillShot(dir, kind, hero.attack, opts);
          if (mode === "repairPulse")
            healArea(2.2, Math.max(2, Math.round(hero.maxHp * 0.025)));
          hero.act = hero.attackInterval * 1000;
          signatureFx(mode, dir, 0.85, 420);
        } else melee(hero, dir, 0, mode);
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
          base = visible(x, y) ? baseAt(x, y) : null;
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
        } else if (base === "red") {
          attackTarget = { kind: "base", x, y };
          setMessage(`적 ${FACTION_BASES[enemyFaction].name}로 이동`);
        } else {
          attackTarget = null;
          setMessage(`목적지 ${x}, ${y} · 자동 이동/굴착`);
        }
      },
      beginSkillAim = (skill: 2 | 3) => {
        if (!hero.alive || (skill === 2 ? cd2 : cd4) > 0) return;
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
        if (cmd.startsWith("stance:")) {
          const [, routeId, stance] = cmd.split(":");
          setRouteStance(routeId as RouteId, stance as RouteStance);
          return;
        }
        if (cmd === "route:off") {
          cancelRouteEdit();
          setMessage("진군 노선 편집 종료");
          return;
        }
        if (cmd === "route:A" || cmd === "route:B") {
          routeEdit = cmd.slice(6) as RouteId;
          fillMode = false;
          buildMode = "none";
          setBuildChoice("none");
          aimingSkill = 0;
          moveTarget = null;
          attackTarget = null;
          setSelected(0);
          setRouteChoice(routeEdit);
          setMessage(
            `${routeEdit} 노선 편집 · 탐사한 열린 땅굴을 순서대로 클릭`,
          );
          return;
        }
        if (cmd === "routeUndo:A" || cmd === "routeUndo:B") {
          undoRoutePoint(cmd.slice(-1) as RouteId);
          return;
        }
        if (cmd === "routeClear:A" || cmd === "routeClear:B") {
          clearMarchRoute(cmd.slice(-1) as RouteId);
          return;
        }
        if (!cmd.startsWith("cursor:") && !cmd.startsWith("camera:"))
          cancelRouteEdit();
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
          talents.add(id);
          setTalentPrompt(null);
          pausedRef.current = false;
          setPaused(false);
          tone("build");
          setMessage(
            `특성 선택 · ${[...YOO_TALENTS.level3, ...YOO_TALENTS.level5].find((t) => t.id === id)?.name ?? id}`,
          );
        } else if (cmd.startsWith("cursor:")) {
          const [, x, y] = cmd.split(":").map(Number);
          updateCursor(x, y);
        } else if (cmd.startsWith("camera:")) {
          const [, x, y] = cmd.split(":").map(Number);
          focusCameraAt(x * W, y * H);
          setMessage(`미니맵 관측 위치 · Space로 ${playerDef.name} 복귀`);
        } else if (cmd.startsWith("build:"))
          selectBuildMode(cmd.slice(6) as BuildMode);
        else if (cmd === "build")
          selectBuildMode(factionBuildables(playerDef.faction)[0].id);
        else if (cmd === "fill") toggleFillMode();
        else if (cmd === "survival") activateSurvival();
        else if (cmd === "item1") activateItem(0);
        else if (cmd === "item2") activateItem(1);
      };
    const pointerPosition = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect(),
          x = ((e.clientX - r.left) / r.width) * VW,
          y = ((e.clientY - r.top) / r.height) * VH;
        updateCursor(x, y);
        return { x, y };
      },
      keydown = (e: KeyboardEvent) => {
        startAmbient();
        if (e.code === "Escape") {
          e.preventDefault();
          if (talentPrompt) return;
          if (routeEdit) {
            cancelRouteEdit();
            setMessage("진군 노선 편집 종료");
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
          if (buildMode !== "none") {
            selectBuildMode("none");
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
        if (pausedRef.current) return;
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
          publishOnlineInput({ type: "drill" });
        }
        const moveDirection =
          e.code === "KeyW" || e.code === "ArrowUp" ? { x: 0, y: -1 } :
          e.code === "KeyS" || e.code === "ArrowDown" ? { x: 0, y: 1 } :
          e.code === "KeyA" || e.code === "ArrowLeft" ? { x: -1, y: 0 } :
          e.code === "KeyD" || e.code === "ArrowRight" ? { x: 1, y: 0 } : null;
        if (moveDirection)
          publishOnlineInput({ type: "move", x: hero.x + moveDirection.x * 2, y: hero.y + moveDirection.y * 2 });
        if (e.code === "KeyB") processCommand("build");
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
        if (pausedRef.current) return;
        startAmbient();
        const p = pointerPosition(e);
        if (e.button === 2) {
          e.preventDefault();
          pointerHeld = false;
          if (routeEdit) {
            undoRoutePoint(routeEdit);
            return;
          }
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
        if (routeEdit) {
          e.preventDefault();
          pointerHeld = false;
          const tile = cursorTile();
          addRoutePoint(routeEdit, tile.x, tile.y);
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
            basicAttackAtPointer();
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
          buildMode === "none" &&
          !fillMode &&
          !routeEdit
        )
          issuePointerOrder();
      },
      pointerup = (e: PointerEvent) => {
        pointerHeld = false;
        if (cameraDrag && cameraDrag.pointerId === e.pointerId) {
          const moved = cameraDrag.moved;
          cameraDrag = null;
          if (canvas.hasPointerCapture(e.pointerId))
            canvas.releasePointerCapture(e.pointerId);
          canvas.style.cursor = "crosshair";
          if (moved) setMessage(`자유 카메라 · Space로 ${playerDef.name} 복귀`);
        }
      },
      contextmenu = (e: MouseEvent) => {
        e.preventDefault();
      };
    const update = (dt: number, now: number) => {
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
      enemyBuildClock -= dt;
      spawnClock -= dt;
      steamDamageClock -= dt;
      while (commands.current.length) processCommand(commands.current.shift()!);
      updateBuildWork(dt);
      runEnemyConstruction();
      if (!isCampaign && spawnClock <= 0) {
        wave++;
        const nextMinionLevel = wave >= 15 ? 3 : wave >= 7 ? 2 : 1;
        if (nextMinionLevel !== minionLevel) applyMinionLevel(nextMinionLevel);
        const formation: MinionRole[] = [
          "escort",
          "breaker",
          "breaker",
          "shooter",
        ];
        for (const team of ["blue", "red"] as Team[])
          formation.forEach((role, index) =>
            spawnQueue.push({ team, role, index, delay: index * 600 }),
          );
        spawnClock = 14000;
        setMessage(
          `제 ${wave} 진군대 출전 · ${minionLevel}레벨 ${FACTIONS[enemyFaction].name}과 교전`,
        );
      }
      if (isCampaign && campaignChapter === 1) {
        const liveRedMinions = units.filter((u) => u.alive && u.team === "red" && u.role === "minion" && !u.campaignScout).length,
          queuedRedMinions = spawnQueue.some((order) => order.team === "red");
        if (!campaignWaveQueued && campaignIntroClock >= 8500) queueCampaignWave(1);
        else if (campaignPhase === 1 && !queuedRedMinions && liveRedMinions === 0) {
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
          units.push(campaign1CheolgakReserve);
          campaign1CheolgakReserve = null;
          setMessage("2차 침입 후반 · 철각이 전선에 난입했다");
          tone("warning");
        }
      }
      for (let i = spawnQueue.length - 1; i >= 0; i--) {
        const order = spawnQueue[i];
        order.delay -= dt;
        const ready = order.delay <= 0,
          spawned = ready && spawnMinion(order.team, order.index, order.role, order.campaignThreat, order.campaignPower, order.campaignName),
          preserveUntilSpawned = isCampaign && campaignChapter === 1 && order.team === "red";
        if (ready && shouldRemoveSpawnOrder(spawned, order.delay, preserveUntilSpawned))
          spawnQueue.splice(i, 1);
      }
      for (const u of units) {
        u.act -= dt;
        u.shot -= dt;
        if (!u.alive) {
          u.respawn -= dt;
          if (u.role === "hero" && u.respawn <= 0 && !isCampaign) {
            const b = u.team === "blue" ? ALLY : ENEMY;
            u.x = b.x + (u.team === "blue" ? 1 : -1);
            u.y = b.y + 1;
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
      const steamPhase = now % 5200;
      if (
        !isCampaign &&
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
              reliableRange = Math.max(30, playerDef.stats.range * S * 0.92);
            if (distance <= reliableRange)
              melee(hero, { x: vx, y: vy });
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
              ? ["말로는 결론이 안 나겠네.", "좋아. 서로 방식대로 붙어 보자!"]
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
          } else if (campaignIntroClock < 3200) {
            if (scout.act <= 0) {
              const nx = scout.x + 1;
              scout.dir = { x: 1, y: 0 };
              if (open(nx, scout.y) && !occupied(nx, scout.y, scout))
                commitGridMove(scout, nx, scout.y, 320);
              scout.minionVisual = "move";
              scout.minionVisualUntil = performance.now() + 280;
              scout.act = 260;
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
              commitGridMove(scientist, nx, ny, 1000 / scientist.moveSpeed * 0.96);
              scientist.dir = step;
            }
          }
          scientist.act = 1000 / scientist.moveSpeed;
        }
      if (!isCampaign) {
        processOnlineBattleCommands();
        syncOnlineBattleState(dt);
        for (const aiHero of battleAiHeroes) stepBattleHero(aiHero);
      }
      if (isCampaign && !(campaignChapter === 3 && campaignIntroClock < 6900))
        for (const fighter of units.filter((unit) => unit.campaignAi)) {
          if (campaignChapter === 1 && fighter.team === "red" && campaignPhase === 0) continue;
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
          stepCampaignHero(fighter);
        }
      for (const u of units) if (u.role === "minion" && !u.campaignScout) stepMinion(u);
      stepTurrets(dt);
      updateBattleHeroImpacts(dt);
      updateMeleeHits(dt);
      updateShots(dt);
      updateSlashes(dt);
      updateFields(dt);
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
        const scientists = units.filter((unit) => unit.role === "scientist"), aliveScientists = scientists.filter((unit) => unit.alive);
        if (aliveScientists.length < scientists.length) {
          ended = true;
          setOutcome("lose");
          setMessage("박사 사망 · 전원 호송 조건 실패");
        } else if (aliveScientists.length === 3 && aliveScientists.every((unit) => unit.x >= 48 && Math.abs(unit.y - ENEMY.y) <= 4)) {
          ended = true;
          setOutcome("win");
          setMessage("박사 3명 전원 도착 · 평택 연구소 문이 열린다");
        }
      }
      if (isCampaign && campaignChapter === 3 && !ended && !units.some((unit) => unit.alive && unit.team === "red" && unit.campaignAi === "arena")) {
        ended = true;
        setOutcome("win");
        setMessage("세 동료가 승부를 인정했다 · 갈등 봉합");
      }
      if (isCampaign && campaignChapter === 4 && !ended && campaignTimeLeft <= 0) {
        ended = true;
        setOutcome("lose");
        setMessage("제한 시간 초과 · 버그본 거점 탈환 실패");
      }
      if (isCampaign && campaignChapter === 5 && !ended) {
        if (campaign5GatePhase === 0 && hero.x >= 11) {
          grid[18][14] = { type: 0, hp: 0, max: 0 };
          campaign5GatePhase = 1;
          setMessage("봉쇄문 1 해제 · 첫 전투실을 돌파하라");
          tone("warning");
        }
        const phaseOneRemaining = units.some((unit) => unit.alive && unit.team === "red" && unit.campaignPower === 1) ||
          spawnQueue.some((order) => order.team === "red" && order.campaignPower === 1);
        if (campaign5GatePhase === 1 && !phaseOneRemaining) {
          grid[26][28] = { type: 0, hp: 0, max: 0 };
          campaign5GatePhase = 2;
          setMessage("첫 군체 전멸 · 봉쇄문 2 해제");
          tone("build");
        }
        const phaseTwoRemaining = units.some((unit) => unit.alive && unit.team === "red" && unit.campaignPower === 2) ||
          spawnQueue.some((order) => order.team === "red" && order.campaignPower === 2);
        if (campaign5GatePhase === 2 && !phaseTwoRemaining) {
          grid[13][42] = { type: 0, hp: 0, max: 0 };
          campaign5GatePhase = 3;
          setMessage("굴착군체장 2기 격파 · 천안 최종 구간 개방");
          tone("victory");
        }
        if (Math.abs(hero.x - ENEMY.x) + Math.abs(hero.y - ENEMY.y) <= 4) {
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
        cam.x += (heroWorld.x - VW / 2 - cam.x) * 0.12;
        cam.y += (heroWorld.y - VH / 2 - cam.y) * 0.12;
      }
      clampCamera();
      if (now - lastHud > 120) {
        const next = HERO_LEVELS.find((row) => row.level === heroLevel + 1);
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
            (u) => u.alive && u.team === "blue" && u.role === "minion",
          ).length,
          enemies: units.filter(
            (u) => u.alive && u.team === "red" && (isCampaign || u.role === "minion"),
          ).length,
          explored: Math.round(
            (seen.flat().filter(Boolean).length / (COLS * ROWS)) * 100,
          ),
          level: heroLevel,
          xp: heroXp,
          nextXp: next?.xp ?? 850,
          minionLevel,
          cd1: Math.max(0, Math.ceil(cd1 / 1000)),
          cd2: Math.max(0, Math.ceil(cd2 / 1000)),
          cd3: Math.max(0, Math.ceil(cd3 / 1000)),
          cd4: Math.max(0, Math.ceil(cd4 / 1000)),
          fillCd: Math.max(0, Math.ceil(fillCd / 1000)),
          fillMode,
          survivalCd: Math.max(0, Math.ceil(survivalCd / 1000)),
          item1: itemSlots[0],
          item2: itemSlots[1],
          missionTime: Math.max(0, Math.ceil(campaignTimeLeft / 1000)),
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
        actionActive =
          heroAnim !== "locomotion" && now < heroAnimStart + heroAnimDuration,
        actionProgress = actionActive
          ? Math.min(1, (now - heroAnimStart) / Math.max(1, heroAnimDuration))
          : 0;
      let sheet = "locomotion",
        frame = 0;
      if (!u.alive) {
        sheet = "states";
        frame = Math.min(5, 3 + Math.floor((now - heroAnimStart) / 150));
      } else if (
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
        frame = heroAnim === "thrust" || heroAnim === "ultimate" ? 2 : 0;
      } else {
        heroAnim = "locomotion";
        frame =
          now < heroMoveUntil
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
      ctx.strokeStyle = "#f1cc62";
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
            ["basic", "whirlwind", "thrust", "ultimate"].includes(heroAnim);
        let poseX = 0,
          poseY = 0,
          angle = 0,
          scaleX = 1,
          scaleY = 1;
        if (actionActive && sheet === "locomotion") {
          if (heroAnim === "basic") {
            poseX = u.dir.x * 4 * pulse;
            poseY = u.dir.y * 4 * pulse;
            angle = -facing * 0.14 * pulse;
          } else if (heroAnim === "whirlwind") {
            angle = Math.sin(p * Math.PI * 4) * 0.08 * (u.dir.x < 0 ? -1 : 1);
            poseX = u.dir.x * 2 * pulse;
            poseY = u.dir.y * 2 * pulse;
            scaleX = 1 + 0.05 * pulse;
            scaleY = 1 - 0.03 * pulse;
          } else if (heroAnim === "thrust") {
            poseX = u.dir.x * 6 * pulse;
            poseY = u.dir.y * 6 * pulse;
            angle = -facing * 0.08 * pulse;
            scaleY = 0.94;
          } else if (heroAnim === "drill") {
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
        drawYooActionSword(u, x, y, heroAnim, actionProgress);
      ctx.restore();
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
        !!grid[y]?.[x] && grid[y][x].type !== 0,
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
        const bomb = wallBombs.find(
          (b) => b.x === x && b.y === y && b.team === "blue",
        );
        if (bomb) {
          const armed = now >= bomb.armedAt,
            pulse = armed && Math.floor(now / 650) % 2 === 0;
          ctx.fillStyle = "#252a2c";
          ctx.fillRect(px + 25, py + 22, 11, 8);
          ctx.strokeStyle = armed ? (pulse ? "#ff6b58" : "#7c302b") : "#e5b84d";
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 25, py + 22, 11, 8);
          ctx.beginPath();
          ctx.moveTo(px + 25, py + 25);
          ctx.quadraticCurveTo(px + 19, py + 18, px + 15, py + 24);
          ctx.stroke();
          ctx.fillStyle = armed ? (pulse ? "#e45245" : "#742b29") : "#e5b84d";
          ctx.fillRect(px + 29, py + 24, 3, 3);
        }
      };
    const drawBase = (b: { x: number; y: number }, team: Team, hp: number) => {
      const isPyeongtaek = isCampaign && campaignChapter === 2 && team === "red",
        faction = isPyeongtaek ? "human" : team === "blue" ? playerDef.faction : enemyFaction,
        baseDef = FACTION_BASES[faction],
        baseImage = baseImages[faction],
        cx = b.x * S + S / 2 - cam.x,
        cy = b.y * S + S / 2 - cam.y,
        dw = faction === "bugborn" ? 112 : 106,
        dh = faction === "bugborn" ? 82 : 74,
        left = cx - dw / 2,
        top = cy - dh + 25,
        teamColor = isPyeongtaek ? "#78f0a0" : team === "blue" ? "#54dfef" : "#ff5e51";
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
        if (team === "red" && !isPyeongtaek)
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
        isPyeongtaek ? "목적지 · 평택거점(연구소)" : `${team === "blue" ? "아군" : "적군"} · ${baseDef.name}`,
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
      ctx.fillStyle = "#050707a8";
      ctx.beginPath();
      ctx.ellipse(0, 11, role === "escort" ? 12 : 10, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (sheet) {
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
        ctx.imageSmoothingEnabled = false;
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
      ctx.translate(poseX, poseY);
      ctx.rotate(tilt);
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
    const drawUnifiedCampaignHero = (u: Unit, x: number, y: number) => {
      const definition = HEROES.find((heroDef) => heroDef.id === (u.heroId ?? u.campaignHeroId));
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
    const drawPlayerHeroGlow = (x: number, y: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const glow = ctx.createRadialGradient(x, y + 7, 2, x, y + 7, 30);
      glow.addColorStop(0, kit.color + "66");
      glow.addColorStop(0.55, kit.accent + "28");
      glow.addColorStop(1, kit.color + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 32, y - 24, 64, 52);
      ctx.strokeStyle = kit.accent + "88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 20, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
        ctx.fillText("필살", 0, 0);
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
          arenaMoveEase = arenaMoveP * arenaMoveP * (3 - 2 * arenaMoveP),
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
            drawPlayerHeroGlow(x, y);
            ctx.save();
            ctx.filter = `drop-shadow(0 0 2px ${kit.accent}) drop-shadow(0 0 4px ${kit.color})`;
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
        else if (!drawUnifiedCampaignHero(u, x, y)) {
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
        if (u.alive) {
          const width = u.role === "minion" ? 24 : u.role === "scientist" ? 34 : 30,
            barY = u.role === "minion" ? y - 39 : u.role === "scientist" ? y - 37 : y - 31,
            teamColor = u.team === "blue" ? "#54dfef" : "#ff5e51";
          ctx.fillStyle = "#101415";
          ctx.fillRect(x - width / 2 - 1, barY - 1, width + 2, 5);
          ctx.fillStyle = teamColor;
          ctx.fillRect(x - width / 2, barY, (width * u.hp) / u.maxHp, 3);
          if (u.role === "minion") {
            ctx.fillStyle = u.level >= 3 ? "#ffe06a" : u.level >= 2 ? "#d8f39a" : "#d6d9d7";
            ctx.font = "bold 7px sans-serif";
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
        x = t.x * S + S / 2 - cam.x,
        y = t.y * S + S / 2 - cam.y,
        img = buildImages[t.kind],
        hover = cursorTile(),
        selected =
          (buildMode === "demolish" || buildMode === "upgrade") &&
          hover.x === t.x &&
          hover.y === t.y,
        size = blocker ? 48 : def.faction === "bugborn" ? 55 : 50,
        dw = blocker ? 60 : size,
        dh = size,
        top = y - dh + 15;
      ctx.save();
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
        const recoil =
          !blocker && t.cool > turretStats(t).cooldown - 120 ? 2 : 0;
        ctx.drawImage(img, x - dw / 2 - recoil, top, dw, dh);
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
    const drawFields = () => {
      const now = performance.now();
      for (const f of fields) {
        if (!visible(Math.floor(f.x), Math.floor(f.y))) continue;
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
    const drawFog = () => {
        fctx.globalCompositeOperation = "source-over";
        fctx.globalAlpha = 1;
        fctx.filter = "none";
        fctx.clearRect(0, 0, VW, VH);
        fctx.fillStyle = "#000";
        fctx.fillRect(0, 0, VW, VH);
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
        for (const u of visionSources()) {
          const r = S * (visionRadius(u) + 0.4),
            px = (u === hero ? heroWorld.x : u.x * S + S / 2) - cam.x,
            py = (u === hero ? heroWorld.y : u.y * S + S / 2) - cam.y,
            g = fctx.createRadialGradient(px, py, r * 0.55, px, py, r);
          g.addColorStop(0, "rgba(0,0,0,1)");
          g.addColorStop(0.72, "rgba(0,0,0,.93)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          fctx.fillStyle = g;
          fctx.beginPath();
          fctx.arc(px, py, r, 0, Math.PI * 2);
          fctx.fill();
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
      render = () => {
        ctx.fillStyle = "#050607";
        ctx.fillRect(0, 0, VW, VH);
        const sx = Math.max(0, Math.floor(cam.x / S)),
          sy = Math.max(0, Math.floor(cam.y / S)),
          ex = Math.min(COLS - 1, Math.ceil((cam.x + VW) / S)),
          ey = Math.min(ROWS - 1, Math.ceil((cam.y + VH) / S));
        for (let y = sy; y <= ey; y++)
          for (let x = sx; x <= ex; x++) {
            if (!seen[y][x]) {
              ctx.fillStyle = "#111416";
              ctx.fillRect(x * S - cam.x, y * S - cam.y, S + 1, S + 1);
            } else drawTile(visible(x, y) ? grid[y][x] : memory[y][x], x, y);
          }
        drawFields();
        const actors: Array<{ z: number; draw: () => void }> = [];
        if (seen[ALLY.y][ALLY.x])
          actors.push({
            z: (ALLY.y + 1) * S,
            draw: () => drawBase(ALLY, "blue", allyHp),
          });
        if (!(isCampaign && campaignChapter === 1) && (visible(ENEMY.x, ENEMY.y) || (isCampaign && campaignChapter === 5)))
          actors.push({
            z: (ENEMY.y + 1) * S,
            draw: () => drawBase(ENEMY, "red", enemyHp),
          });
        for (const t of turrets)
          if (t.team === "blue" || visible(t.x, t.y))
            actors.push({ z: t.y * S + S / 2, draw: () => drawTurret(t) });
        for (const u of units)
          if (u.team === "blue" || visible(u.x, u.y))
            actors.push({ z: unitWorld(u).y, draw: () => drawUnit(u) });
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
          if (s.team === "blue" || visible(tx, ty)) {
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
          if (visible(tx, ty)) {
            ctx.globalAlpha = Math.max(0, p.life / 550);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 3 - cam.x, p.y - 3 - cam.y, 6, 6);
            ctx.globalAlpha = 1;
          }
        }
        for (const popup of damagePopups) {
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
        drawAimGuide();
      };
    const drawMinimap = () => {
      if (minimapCollapsedRef.current) return;
      const m = MINIMAP,
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
        (visible(ENEMY.x, ENEMY.y) || (isCampaign && campaignChapter === 5))
      )
        dot(ENEMY.x, ENEMY.y, campaignChapter === 5 ? "#ffe071" : "#ff6857", campaignChapter === 5 ? 7 : 5);
      for (const t of turrets)
        if (t.hp > 0 && (t.team === "blue" || visible(t.x, t.y)))
          dot(t.x, t.y, t.team === "blue" ? "#54dce9" : "#f25b4c", 3);
      for (const u of units)
        if (u.alive && (u.team === "blue" || visible(u.x, u.y)))
          dot(
            u.x,
            u.y,
            u === hero ? "#fff3a1" : u.team === "blue" ? "#65e4ef" : "#ff705e",
            u === hero ? 5 : 2,
          );
      ctx.strokeStyle = "#f2d477";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(m.x + cam.x * wx, m.y + cam.y * wy, VW * wx, VH * wy);
      ctx.restore();
    };
    const routeHotkey = (e: KeyboardEvent) => {
        if (
          !e.ctrlKey ||
          e.repeat ||
          (e.code !== "Digit1" && e.code !== "Digit2")
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const tile = cursorTile();
        setRouteTarget(e.code === "Digit1" ? "A" : "B", tile.x, tile.y);
        publishOnlineInput({ type: "route", route: e.code === "Digit1" ? "A" : "B", x: tile.x, y: tile.y });
      },
      followHeroPointer = (e: PointerEvent) => {
        if (e.button === 0 && !minimapPoint(cursorScreen.x, cursorScreen.y))
          cameraFree = false;
      };
    markVision();
    cam.x = Math.max(0, heroWorld.x - VW / 2);
    cam.y = Math.max(0, heroWorld.y - VH / 2);
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
    addEventListener("keydown", routeHotkey, true);
    addEventListener("keydown", keydown);
    addEventListener("keyup", keyup);
    addEventListener("pointerup", pointerup);
    canvas.addEventListener("pointerdown", followHeroPointer);
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("pointermove", pointermove);
    canvas.addEventListener("pointercancel", pointerup);
    canvas.addEventListener("contextmenu", contextmenu);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (defeatTimer !== null) window.clearTimeout(defeatTimer);
      removeEventListener("keydown", routeHotkey, true);
      removeEventListener("keydown", keydown);
      removeEventListener("keyup", keyup);
      removeEventListener("pointerup", pointerup);
      canvas.removeEventListener("pointerdown", followHeroPointer);
      canvas.removeEventListener("pointerdown", pointerdown);
      canvas.removeEventListener("pointermove", pointermove);
      canvas.removeEventListener("pointercancel", pointerup);
      canvas.removeEventListener("contextmenu", contextmenu);
    };
  }, [screen, selectedHeroId, gameMode, campaignChapter, campaignDifficulty, activeMatchConfig, selectedMapId, selectedLoadout]);
  const finishPrologue = () => {
      window.localStorage.setItem("seoul999m.prologueSeen", "1");
      setScreen("chapters");
    },
    openCampaign = () =>
      setScreen(window.localStorage.getItem("seoul999m.prologueSeen") === "1" ? "chapters" : "prologue");
  if (screen === "prologue")
    return (
      <main className="campaign-cinematic prologue-player">
        <video
          autoPlay
          controls={false}
          playsInline
          onEnded={finishPrologue}
          src="/assets/opening/seoul-999m-opening-v12.mp4"
        >
          <track kind="captions" src="/assets/opening/seoul-999m-opening-v12-ko.vtt" srcLang="ko" label="한국어" default />
        </video>
        <button className="prologue-skip" onClick={finishPrologue}>SKIP</button>
      </main>
    );
  if (screen === "chapters")
    return (
      <main className="chapter-screen">
        <MenuSceneBackdrop />
        <section>
          <span>HUMAN SURVIVAL RECORD</span>
          <h1>휴먼 캠페인</h1>
          <p>생존본부가 회수한 다섯 개의 작전 기록.</p>
          <button className="prologue-replay" onClick={() => setScreen("prologue")}>
            프롤로그 재생
          </button>
          <div className="chapter-chain">
            {[
              "환풍구 방어전",
              "평택으로 가는 표본",
              "평택 연구소의 밤",
              "군체의 둥지",
              "천안으로 가는 길",
            ].map((chapter, index) => (
              <article
                key={chapter}
                className={index + 1 === campaignChapter ? "open" : "locked"}
              >
                <button
                  onClick={() => {
                    setCampaignChapter((index + 1) as 1 | 2 | 3 | 4 | 5);
                    setScreen("briefing");
                  }}
                >
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span>{index + 1 === campaignChapter ? "작전 선택" : "기록 열람"}</span>
                </button>
                <strong>{chapter}</strong>
              </article>
            ))}
          </div>
          <button className="back-button" onClick={() => setScreen("intro")}>
            첫 화면으로
          </button>
        </section>
      </main>
    );
  if (screen === "briefing")
    return (
      <main className="campaign-cinematic mission-brief">
        <video
          autoPlay
          muted
          loop
          playsInline
          src="/assets/opening/seoul-999m-opening-v12.mp4"
        />
        <section>
          <span>CHAPTER {String(campaignChapter).padStart(2, "0")} · {selectedCampaignInfo.subtitle}</span>
          <h1>
            {selectedCampaignInfo.title}
          </h1>
          {selectedCampaignInfo.asset && <img className="briefing-scientists" src={selectedCampaignInfo.asset} alt="평택 연구소로 향하는 박사 세 명" />}
          <p>{selectedCampaignInfo.description}</p>
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
          <button onClick={startCampaignMission}>작전 시작</button>
          <button className="quiet" onClick={() => setScreen("chapters")}>
            작전 지도
          </button>
        </section>
      </main>
    );
  if (screen === "intro")
    return (
      <main className={`title-screen ${menuPanel === "roster" ? "roster-open" : ""}`}>
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
                type="button"
                className={`audio-start ${audioReady ? "ready" : ""}`}
                onClick={() => void gameAudio.unlock().then(() => setAudioReady(true))}
              >
                <kbd>♪</kbd>
                <span>
                  <b>{audioReady ? "BGM 재생 중" : "BGM 시작"}</b>
                  <small>{audioReady ? "메뉴 음악과 전투 음향은 별도 트랙으로 재생됩니다" : "브라우저 정책상 한 번 눌러 사운드를 시작합니다"}</small>
                </span>
                <em>{audioReady ? "ON" : "재생"}</em>
              </button>
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
                    <fieldset>
                      <legend>대전 인원</legend>
                      <button className={skirmishTeamSize === 1 ? "active" : ""} onClick={() => setSkirmishTeamSize(1)}>1:1</button>
                      <button className={skirmishTeamSize === 2 ? "active" : ""} onClick={() => setSkirmishTeamSize(2)}>2:2</button>
                    </fieldset>
                    <label>
                      전장
                      <select value={selectedMapId} onChange={(event) => setSelectedMapId(event.target.value as BattleMapId)}>
                        {BATTLE_MAPS.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
                      </select>
                    </label>
                    <label>
                      내 영웅
                      <select value={selectedHeroId} onChange={(event) => setSelectedHeroId(event.target.value)}>
                        {HEROES.map((candidate) => <option key={candidate.id} value={candidate.id}>{FACTIONS[candidate.faction].name} · {candidate.name}</option>)}
                      </select>
                    </label>
                  </div>
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
                    <small>{onlineRoom.teamSize}:{onlineRoom.teamSize} · {battleMap(onlineRoom.mapId).name}</small>
                  </div>
                  <div className="online-slots">
                    {(["blue", "red"] as const).map((team) => (
                      <section key={team} className={team}>
                        <h3>{team === "blue" ? "A TEAM" : "B TEAM"}</h3>
                        {Array.from({ length: onlineRoom.teamSize }, (_, index) => {
                          const member = onlineRoom.players.find((player) => player.team === team && player.index === index);
                          return <article key={`${team}-${index}`} className={member?.ready ? "ready" : ""}>
                            <b>{member ? member.nickname : "참가 대기"}</b>
                            <span>{member ? HEROES.find((candidate) => candidate.id === member.heroId)?.name : `SLOT ${index + 1}`}</span>
                            <em>{member ? member.aiControlled ? "AI 인계" : member.connected ? member.ready ? "준비 완료" : "준비 중" : "연결 끊김" : "빈 슬롯"}</em>
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
                  {onlineRoom.status === "finished" && <strong className="online-countdown">{onlineRoom.winner === "blue" ? "A TEAM" : "B TEAM"} 승리 · {onlineRoom.hostId === onlineIdentity?.playerId ? "재대전을 선택할 수 있습니다" : "방장의 재대전 선택을 기다리는 중"}</strong>}
                </div>
              )}
              <p className="lobby-notice">{lobbyNotice}</p>
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
                <div className="team-size-select">
                  <b>대전 인원</b>
                  {([1, 2] as TeamSize[]).map((size) => (
                    <button key={size} className={skirmishTeamSize === size ? "active" : ""} onClick={() => setSkirmishTeamSize(size)}>
                      {size}:{size}
                    </button>
                  ))}
                </div>
                <div className="battle-map-select">
                  <b>전장 선택</b>
                  {BATTLE_MAPS.map((map) => (
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
                  (hero, index) => (
                    <article key={hero.id} className={`playable ${selectedHeroId === hero.id ? "selected" : ""}`}>
                      <div
                        className="roster-portrait"
                        style={
                          hero.id === "c999"
                            ? {
                                backgroundImage:
                                  "url(/assets/characters/sprites/roster-v1/ai-c999-director-actions-v2.png)",
                                backgroundSize: "600% 100%",
                                backgroundPosition: "0 center",
                              }
                            : {
                                backgroundImage: `url(${hero.portrait})`,
                                backgroundSize:
                                  rosterFaction === "human"
                                    ? "cover"
                                    : "400% 100%",
                                backgroundPosition:
                                  rosterFaction === "human"
                                    ? "center"
                                    : `${index * 33.333}% center`,
                              }
                        }
                      />
                      <span>
                        <b>{hero.name}</b>
                        <em>{hero.title}</em>
                        <small>
                          {hero.role} · {hero.weapon}
                        </small>
                        <small>{heroKit(hero.id).identity}</small>
                        <small>
                          {hero.skills[0]} / {hero.skills[1]} / {hero.skills[3]}
                        </small>
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
                  <span><b>{activeHeroDef.name}</b><small>{activeHeroDef.title} · {activeHeroDef.role}</small></span>
                  <p>{heroKit(activeHeroDef.id).identity}</p>
                </header>
                <div>
                  {[
                    ["기본", activeHeroDef.weapon, heroKit(activeHeroDef.id).basic.caption],
                    ["1", activeHeroDef.skills[0], heroKit(activeHeroDef.id).skill1.caption],
                    ["2", activeHeroDef.skills[1], heroKit(activeHeroDef.id).skill2.caption],
                    ["4", activeHeroDef.skills[2], heroKit(activeHeroDef.id).drill.caption],
                    ["3 · 필살", activeHeroDef.skills[3], heroKit(activeHeroDef.id).ultimate.caption],
                  ].map(([key, name, description]) => (
                    <article key={key}><kbd>{key}</kbd><span><b>{name}</b><small>{description}</small></span></article>
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
                    })}><kbd>{slot === 0 ? "Q" : slot === 1 ? "R" : item.icon}</kbd><span><b>{item.name}</b><small>{item.effect}</small></span></button>;
                  })}
                </div>
              </section>
              {skirmishTeamSize === 2 && (
                <div className="ally-select">
                  <b>AI 동료 선택 · 같은 종족</b>
                  <div>
                    {HEROES.filter((hero) => hero.faction === activeHeroDef.faction && hero.id !== selectedHeroId).map((hero) => (
                      <button key={hero.id} className={selectedAllyHeroId === hero.id ? "active" : ""} onClick={() => setSelectedAllyHeroId(hero.id)}>
                        <strong>{hero.name}</strong><small>{hero.role}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button className="skirmish-start" onClick={() => startSkirmish(selectedHeroId)}>
                {skirmishTeamSize}:{skirmishTeamSize} · {battleMap(selectedMapId).name} 전투 시작
              </button>
            </section>
          )}
          <footer>
            <span>로그인 없이 게스트 접속</span>
            <i />
            캠페인은 이 브라우저에 자동 저장 예정
            <i />
            온라인은 방 코드 방식
          </footer>
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
    },
    moveStop = () => {
      mobileMove.current = null;
    };
  return (
    <main className="underground-game">
      <header>
        <div>
          <b>ALLY CORE</b>
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
            : `${battleMap(activeMatchConfig?.mapId ?? selectedMapId).name} · WAVE ${hud.wave} · 진군대 LV.${hud.minionLevel}`}
        </h1>
        <div className="red">
          <b>
            {isCampaign && campaignChapter === 1
              ? "BUGBORN INVASION"
              : isCampaign && campaignChapter === 2
                ? "PYEONGTAEK GATE"
                : "ENEMY CORE"}
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
                : `${hud.enemy} · 방어막 ${Math.round(hud.enemyShield)}`}
          </strong>
        </div>
      </header>
      <button
        className="pause-trigger"
        onClick={togglePause}
        aria-label="일시정지 메뉴"
      >
        ESC 메뉴
      </button>
      <section className="minefield">
        <div className="battle-stage">
          <canvas ref={canvasRef} />
          <button
            className="minimap-hit"
            aria-label="미니맵 드래그로 관측 위치 이동"
            hidden={minimapCollapsed}
            onPointerDown={minimapDragStart}
            onPointerMove={minimapDragMove}
            onPointerUp={minimapDragEnd}
            onPointerCancel={minimapDragEnd}
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
        <section className="combat-command-dock" aria-label="전투 지휘 패널">
        <button
          className={`build-toggle ${buildChoice !== "none" ? "active" : ""}`}
          onClick={() => {
            command("route:off");
            setRouteChoice("none");
            setRouteMenuOpen(false);
            setSupplyMenuOpen(false);
            setBuildMenuOpen((v) => !v);
          }}
          aria-expanded={buildMenuOpen}
          aria-label={`${FACTIONS[activeHeroDef.faction].name} 건설 메뉴 열기`}
        >
          <kbd>▦</kbd>
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
              <small>코어 반경 2~6칸 · 포탑 밀집 +20~40%</small>
            </header>
            {activeBuildables.map((def) => (
              <button
                key={def.id}
                className={buildChoice === def.id ? "active" : ""}
                onClick={() => {
                  command(`build:${def.id}`);
                  setBuildMenuOpen(false);
                }}
              >
                <img src={def.asset} alt="" />
                <span>
                  <b>{def.short}</b>
                  <small>
                    {def.cost}₡ ·{" "}
                    {def.category === "multi"
                      ? "근거리 다중"
                      : def.category === "ranged"
                        ? def.id === "laserL1"
                          ? "직선 관통"
                          : def.id === "missileM2"
                            ? "쌍발 광역"
                            : "원거리 공격"
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
              <kbd>↑</kbd>
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
              <kbd>×</kbd>
              <span>
                <b>철거</b>
                <small>1초 · 상태 비례 50% 환급</small>
              </span>
            </button>
          </nav>
        )}
        <div className="route-hotkeys" aria-label="진군 분대 지시">
          {(["A", "B"] as RouteId[]).map((id) => (
            <section key={id} aria-label={`${id} 분대 태세`}>
              <kbd>CTRL+{id === "A" ? "1" : "2"}</kbd>
              <div>{(["assault", "guard", "capture"] as RouteStance[]).map((stance) => <button key={stance} className={routeStances[id] === stance ? "active" : ""} onClick={() => command(`stance:${id}:${stance}`)}>{stance === "assault" ? "돌격" : stance === "guard" ? "경계" : "점령"}</button>)}</div>
            </section>
          ))}
        </div>
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
            data-tooltip={hud.item1 ? `${SUPPLY_ITEMS[hud.item1].name} · ${SUPPLY_ITEMS[hud.item1].effect}` : "Q 빈 슬롯 · 전투 전에 아이템을 선택하세요"}
            title={hud.item1 ? `${SUPPLY_ITEMS[hud.item1].name} · ${SUPPLY_ITEMS[hud.item1].effect}` : "Q 빈 슬롯"}
          >
            <CommandIcon kind={hud.item1 ?? "medKit"} />
            <kbd>Q</kbd>
            <span className="command-state">{hud.item1 ? "사용" : "비어 있음"}</span>
          </button>
          <button
            className={`icon-command ${!hud.item2 ? "empty" : ""}`}
            onClick={() => command("item2")}
            data-tooltip={hud.item2 ? `${SUPPLY_ITEMS[hud.item2].name} · ${SUPPLY_ITEMS[hud.item2].effect}` : "R 빈 슬롯 · 전투 전에 아이템을 선택하세요"}
            title={hud.item2 ? `${SUPPLY_ITEMS[hud.item2].name} · ${SUPPLY_ITEMS[hud.item2].effect}` : "R 빈 슬롯"}
          >
            <CommandIcon kind={hud.item2 ?? "armorPlate"} />
            <kbd>R</kbd>
            <span className="command-state">{hud.item2 ? "사용" : "비어 있음"}</span>
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
            data-tooltip={`필살기 · ${activeHeroDef.skills[3]} · 누르고 조준한 뒤 놓아 발동`}
            title={`필살기 · ${activeHeroDef.skills[3]} · 누르고 조준한 뒤 놓아 발동`}
          >
            <CommandIcon kind="ultimate" />
            <kbd>3</kbd>
            <span className="command-state">{hud.cd4 ? `${hud.cd4}s` : "필살"}</span>
          </button>
          <button className="icon-command" onClick={() => command("skill4")} data-tooltip={`굴착 · ${activeHeroDef.skills[2]} · 클릭 즉시 발동`} title={`굴착 · ${activeHeroDef.skills[2]} · 클릭 즉시 발동`}>
            <CommandIcon kind="drill" />
            <kbd>4</kbd>
            <span className="command-state">{hud.cd3 ? `${hud.cd3}s` : "즉시"}</span>
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
        </section>
      </section>
      <footer>
        <b>◈ 전선 기록</b>
        <p>{message}</p>
        <span>
          클릭=이동 · Ctrl+클릭=기본공격 · Ctrl+1/2=진군 지시 · 1·2 일반기 · 3
          필살기 · 4 굴착 · Shift 생존기 · E 메우기 · Q/R 아이템
        </span>
      </footer>
      {talentPrompt && (
        <div
          className="talent-menu"
          role="dialog"
          aria-modal="true"
          aria-label="특성 선택"
        >
          <article>
            <span>LEVEL {talentPrompt} ADAPTATION</span>
            <h2>지하 적응 특성 선택</h2>
            <p>이번 전투 동안 유지됩니다. 둘 중 하나만 선택할 수 있습니다.</p>
            <div>
              {(talentPrompt === 3
                ? YOO_TALENTS.level3
                : YOO_TALENTS.level5
              ).map((talent) => (
                <button key={talent.id} onClick={() => chooseTalent(talent.id)}>
                  <b>{talent.name}</b>
                  <small>{talent.description}</small>
                </button>
              ))}
            </div>
          </article>
        </div>
      )}
      {paused && !talentPrompt && (
        <div
          className="pause-menu"
          role="dialog"
          aria-modal="true"
          aria-label="일시정지"
        >
          <article>
            <span>OPERATION SUSPENDED</span>
            <h2>작전 일시정지</h2>
            <p>지하 전선 시간이 정지했습니다.</p>
            <button onClick={togglePause}>계속하기</button>
            <button className="exit" onClick={exitToMenu}>
              첫 화면으로
            </button>
            <small>ESC 키로 계속할 수 있습니다.</small>
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
                  : "ENEMY CORE COLLAPSED"
                : isCampaign && defeatSummary
                  ? "HERO COMBAT DISABLED"
                  : "ALLY CORE COLLAPSED"}
            </span>
            <h2>
              {outcome === "win"
                ? isCampaign
                  ? `제${campaignChapter}장 작전 성공`
                  : "지하 전선 돌파"
                : isCampaign ? `제${campaignChapter}장 작전 실패` : "생존 거점 함락"}
            </h2>
            <p>
              {outcome === "win"
                ? isCampaign
                  ? `${selectedCampaignInfo.title} 작전을 완료했습니다.`
                  : "네가 만든 땅굴을 따라 아군이 적 거점을 무너뜨렸습니다."
                : isCampaign && defeatSummary
                  ? `${defeatSummary.killer}의 ${defeatSummary.action}에 ${defeatSummary.amount} 피해를 받고 전투불능이 되었습니다.`
                  : isCampaign ? `${selectedCampaignInfo.title} 작전 조건을 달성하지 못했습니다.` : "적 굴착대가 우리 생존 거점을 파괴했습니다."}
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
            {activeMatchConfig?.kind === "online" ? <button onClick={returnToOnlineRoom}>온라인 방으로</button> : <button onClick={() => location.reload()}>다시 플레이</button>}
            <button onClick={isCampaign ? () => { setOutcome(null); setScreen("chapters"); } : exitToMenu}>
              {isCampaign ? "작전 지도" : "첫 화면으로"}
            </button>
          </article>
        </div>
      )}
    </main>
  );
}
