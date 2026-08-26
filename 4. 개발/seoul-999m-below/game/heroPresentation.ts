import { HEROES, type FactionId } from "./content";

export type HeroSheetKind = "side" | "vertical" | "verticalCombat" | "skill";

export const HERO_SIDE_SOURCE_FACING_X: Record<string, -1 | 1> = {
  kimssi: -1,
  "ahn-seona": -1,
  "kang-ryeokhan": 1,
  cheolgak: -1,
  sanmi: -1,
  hoebun: -1,
  maedeup: -1,
  d09: 1,
  g77: 1,
  // R-486의 측면 대기/이동 원본은 왼쪽을 바라본다. 스킬 시트 기준과 분리한다.
  r486: -1,
  c999: -1,
};

const HERO_SKILL_SOURCE_FACING_X: Record<string, readonly [-1 | 1, -1 | 1, -1 | 1, -1 | 1]> = {
  kimssi: [-1, -1, -1, 1],
  // 대기 시트(-1)는 이미 정상이다. 전용 스킬 시트 1/2/필살만 같은 기준으로 맞춘다.
  "ahn-seona": [-1, -1, 1, -1],
  "kang-ryeokhan": [-1, 1, 1, 1],
  cheolgak: [-1, -1, -1, -1],
  sanmi: [-1, -1, -1, -1],
  hoebun: [-1, -1, -1, -1],
  maedeup: [-1, -1, -1, -1],
  d09: [1, 1, 1, 1],
  g77: [1, 1, 1, 1],
  r486: [1, 1, 1, 1],
  c999: [-1, -1, -1, 1],
};

const HERO_SIDE_FRAME_SOURCE_FACING_X: Partial<Record<string, readonly [-1 | 1, -1 | 1, -1 | 1, -1 | 1, -1 | 1, -1 | 1]>> = {
  kimssi: [-1, -1, -1, -1, -1, -1],
  // 안서나의 대기·이동은 왼쪽 원본이지만 기본 공격 2프레임은 오른쪽 원본이다.
  // 이 차이를 무시하면 공격하는 순간에만 캐릭터 몸이 목표 반대편을 본다.
  "ahn-seona": [-1, -1, -1, 1, 1, -1],
  "kang-ryeokhan": [1, 1, 1, 1, 1, 1],
  // R-486은 대기 프레임은 왼쪽, 실제 이동에 쓰는 1번 프레임은 오른쪽 원본이다.
  r486: [-1, 1, -1, -1, -1, -1],
  // C-999 전용 시트는 대기 프레임은 왼쪽, 실제 이동에 쓰는 1번 프레임은 오른쪽 원본이다.
  c999: [-1, 1, -1, -1, 1, -1],
};

const HERO_BASIC_FRAMES: Partial<Record<string, readonly [number, number]>> = {
  // 원본 4번 프레임의 방패 효과가 셀 경계를 침범하므로 온전한 타격 포즈를 유지한다.
  "kang-ryeokhan": [3, 3],
};

export type HeroFrameRequest = {
  heroId: string;
  direction: { x: number; y: number };
  moving: boolean;
  actionPose: 0 | 1 | 2 | 3 | 4;
  actionProgress: number;
  down?: boolean;
  customSideSheet?: boolean;
};

export const heroFramePlan = (request: HeroFrameRequest) => {
  const definition = HEROES.find((hero) => hero.id === request.heroId);
  if (!definition) throw new Error(`Unknown hero presentation: ${request.heroId}`);
  const factionRoster = HEROES.filter((hero) => hero.faction === definition.faction),
    rawRow = factionRoster.findIndex((hero) => hero.id === definition.id),
    vertical = !request.down && Math.abs(request.direction.y) > Math.abs(request.direction.x),
    verticalAction = vertical && request.actionProgress > 0,
    useSkillPose = request.actionPose > 0 && request.actionProgress > 0.12 && request.actionProgress < 0.9 && !vertical,
    useVerticalCombatPose = verticalAction && request.actionProgress > 0.08 && request.actionProgress < 0.94,
    sheet: HeroSheetKind = useVerticalCombatPose ? "verticalCombat" : useSkillPose ? "skill" : vertical ? "vertical" : "side",
    rows = request.customSideSheet && sheet === "side" ? 1 : definition.faction === "human" ? 3 : 4,
    cols = sheet === "side" ? 6 : sheet === "verticalCombat" ? 10 : 4,
    row = request.customSideSheet && sheet === "side" ? 0 : rawRow - (definition.faction === "human" ? 1 : 0),
    basicFrames = HERO_BASIC_FRAMES[definition.id] ?? [3, 4],
    verticalPair = request.actionPose === 3 ? 4 : request.actionPose === 4 ? 3 : request.actionPose,
    frame = useVerticalCombatPose
      ? verticalPair * 2 + (request.direction.y >= 0 ? 0 : 1)
      : useSkillPose
      ? request.actionPose - 1
      : vertical
        ? (request.direction.y >= 0 ? 0 : 2) + (request.moving || (verticalAction && request.actionProgress > 0.16 && request.actionProgress < 0.82) ? 1 : 0)
        : request.down
          ? 5
          : request.actionPose >= 0 && request.actionProgress > 0
            ? request.actionProgress < 0.48 ? basicFrames[0] : basicFrames[1]
            : request.moving ? 1 : 0,
    sourceFacingX = useSkillPose
      ? HERO_SKILL_SOURCE_FACING_X[definition.id]?.[frame] ?? HERO_SIDE_SOURCE_FACING_X[definition.id] ?? 1
      : sheet === "side"
        ? HERO_SIDE_FRAME_SOURCE_FACING_X[definition.id]?.[frame] ?? HERO_SIDE_SOURCE_FACING_X[definition.id] ?? 1
        : HERO_SIDE_SOURCE_FACING_X[definition.id] ?? 1,
    facingX = (Math.abs(request.direction.x) > 0.05 ? Math.sign(request.direction.x) : sourceFacingX) as -1 | 1;
  return {
    definition,
    sheet,
    rows,
    cols,
    row,
    frame,
    vertical,
    verticalAction,
    useSkillPose,
    useVerticalCombatPose,
    facingX,
    flip: !vertical && facingX !== sourceFacingX,
  };
};

export const factionSheetRows = (faction: FactionId) => faction === "human" ? 3 : 4;
