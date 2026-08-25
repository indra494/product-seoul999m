export type HeroBrainRole = "assault" | "tank" | "support" | "artillery" | "skirmisher";
export type HeroBrainAction = "attack" | "skill1" | "skill2" | "drill" | "ultimate" | "retreat" | "regroup" | "push";

export type HeroBrainContext = {
  hpRatio: number;
  allyHpRatio: number;
  coreDanger: number;
  targetDistance: number;
  enemiesInBasic: number;
  enemiesInArea: number;
  targetHpRatio: number;
  routeBlocked: boolean;
  allyNearby: boolean;
  cooldowns: readonly [number, number, number, number];
  role: HeroBrainRole;
  previousAction?: HeroBrainAction;
};

export type HeroBrainDecision = { action: HeroBrainAction; score: number; reason: string };

export const decideHeroAction = (context: HeroBrainContext): HeroBrainDecision => {
  const choices: HeroBrainDecision[] = [],
    repeat = (action: HeroBrainAction) => context.previousAction === action ? 12 : 0,
    add = (action: HeroBrainAction, score: number, reason: string) =>
      choices.push({ action, score: score - repeat(action), reason });

  add("push", 34 + (1 - context.coreDanger) * 18, "전선을 전진시킨다");
  if (context.hpRatio < 0.32)
    add("retreat", 82 + (0.32 - context.hpRatio) * 100, "생존을 위해 코어로 후퇴한다");
  if (context.coreDanger > 0.55)
    add("regroup", 58 + context.coreDanger * 55, "위험한 아군 코어에 합류한다");
  if (context.enemiesInBasic > 0)
    add("attack", 50 + (1 - context.targetHpRatio) * 28, "사거리 안의 적을 기본 공격한다");
  if (context.cooldowns[0] <= 0 && context.targetDistance < 5.8)
    add("skill1", 58 + context.enemiesInArea * 9, "전투 기술로 교전 우위를 만든다");
  if (context.cooldowns[1] <= 0 && context.targetDistance < 6.5) {
    const supportValue = context.role === "support" ? (1 - context.allyHpRatio) * 75 : 0,
      tankValue = context.role === "tank" && context.allyNearby ? 24 : 0;
    add("skill2", 48 + supportValue + tankValue + context.enemiesInArea * 5, "역할 기술의 효용이 높다");
  }
  if (context.cooldowns[2] <= 0 && context.routeBlocked)
    add("drill", 84, "막힌 진군 경로를 다시 연다");
  if (context.cooldowns[3] <= 0 && (context.enemiesInArea >= 2 || context.targetHpRatio < 0.28))
    add("ultimate", 76 + context.enemiesInArea * 12, "필살기로 다수 또는 빈사 적을 마무리한다");

  choices.sort((a, b) => b.score - a.score || a.action.localeCompare(b.action));
  return choices[0];
};
