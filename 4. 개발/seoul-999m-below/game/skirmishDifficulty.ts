export type SkirmishDifficulty = "easy" | "hard";

export const DEFAULT_SKIRMISH_DIFFICULTY: SkirmishDifficulty = "easy";

export const SKIRMISH_DIFFICULTIES: Record<SkirmishDifficulty, {
  label: string;
  callout: string;
  enemyDamage: number;
  enemyCreditMultiplier: number;
  enemyConstructionRate: number;
}> = {
  easy: {
    label: "쉬움",
    callout: "적 피해 12% 감소 · 건설·성장 압박 완화",
    enemyDamage: 0.88,
    enemyCreditMultiplier: 0.92,
    enemyConstructionRate: 0.82,
  },
  hard: {
    label: "어려움",
    callout: "현재 AI 전투력 · 경제 보정 108%",
    enemyDamage: 1,
    enemyCreditMultiplier: 1.08,
    enemyConstructionRate: 1,
  },
};

export const resolveSkirmishDifficulty = (
  value?: SkirmishDifficulty | string | null,
): SkirmishDifficulty => value === "hard" ? "hard" : DEFAULT_SKIRMISH_DIFFICULTY;

export const skirmishDifficultyBalance = (
  value?: SkirmishDifficulty | string | null,
) => SKIRMISH_DIFFICULTIES[resolveSkirmishDifficulty(value)];
