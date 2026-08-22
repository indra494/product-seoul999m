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
  r486: 1,
  c999: -1,
};

const HERO_SKILL_SOURCE_FACING_X: Record<string, readonly [-1 | 1, -1 | 1, -1 | 1, -1 | 1]> = {
  kimssi: [-1, -1, -1, 1],
  "ahn-seona": [1, 1, 1, 1],
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
  // 대기→기본공격 전환 중 flip 값이 바뀌면 캐릭터가 순간적으로 반전된다.
  // 두 휴먼은 측면 시트 전체를 같은 기준 방향으로 고정한다.
  "ahn-seona": [-1, -1, -1, -1, -1, -1],
  "kang-ryeokhan": [1, 1, 1, 1, 1, 1],
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
