export const TALENT_LEVELS = [3, 6, 9] as const;

export type TalentTier = (typeof TALENT_LEVELS)[number];
export type TalentIcon =
  | "blades"
  | "burst"
  | "shield"
  | "heart"
  | "boots"
  | "field"
  | "drill"
  | "ultimate";

export type HeroTalentEffect = {
  basicCount?: number;
  basicSpread?: number;
  basicDamageMultiplier?: number;
  basicPierce?: boolean;
  basicStun?: number;
  skill1DamageMultiplier?: number;
  skill1RadiusMultiplier?: number;
  skill1CooldownMultiplier?: number;
  skill1Echo?: number;
  skill2DamageMultiplier?: number;
  skill2RangeBonus?: number;
  skill2CooldownMultiplier?: number;
  drillCooldownMultiplier?: number;
  drillWidthBonus?: number;
  ultimateDamageMultiplier?: number;
  ultimateRadiusMultiplier?: number;
  ultimateCooldownMultiplier?: number;
  ultimateEcho?: number;
  fieldRadiusMultiplier?: number;
  fieldDurationMultiplier?: number;
  healMultiplier?: number;
  lifesteal?: number;
  maxHpMultiplier?: number;
  armorBonus?: number;
  moveSpeedMultiplier?: number;
};

export type HeroTalent = {
  id: string;
  heroId: string;
  level: TalentTier;
  name: string;
  description: string;
  icon: TalentIcon;
  accent: string;
  effect: HeroTalentEffect;
};

const talent = (
  heroId: string,
  sourceLevel: 2 | 4 | 6,
  id: string,
  name: string,
  description: string,
  icon: TalentIcon,
  accent: string,
  effect: HeroTalentEffect,
): HeroTalent => ({
  heroId,
  level: sourceLevel === 2 ? 3 : sourceLevel === 4 ? 6 : 9,
  id,
  name,
  description,
  icon,
  accent,
  effect,
});

export const HERO_TALENT_TREES: Record<string, HeroTalent[]> = {
  "yoo-seungcheon": [
    talent("yoo-seungcheon", 2, "yoo-triple-delivery", "삼연참 배송", "기본공격이 좌·중·우 삼연참으로 변하고 각 타격은 58% 피해", "blades", "#68e8ef", { basicCount: 3, basicSpread: .22, basicDamageMultiplier: .58 }),
    talent("yoo-seungcheon", 2, "yoo-blue-overdrive", "파란 신발 과충전", "이동속도 +12% · 돌격 거리 +1칸", "boots", "#78bfff", { moveSpeedMultiplier: 1.12, skill2RangeBonus: 1 }),
    talent("yoo-seungcheon", 4, "yoo-plastic-typhoon", "플라스틱 태풍", "회오리 피해 +25% · 반경 +30%", "burst", "#61ecfa", { skill1DamageMultiplier: 1.25, skill1RadiusMultiplier: 1.3 }),
    talent("yoo-seungcheon", 4, "yoo-drill-warranty", "중고 드릴 무상수리", "굴착 기술 재사용 -32% · 굴착 폭 +1칸", "drill", "#4ecbe6", { drillCooldownMultiplier: .68, drillWidthBonus: 1 }),
    talent("yoo-seungcheon", 6, "yoo-slash-copy", "참격 복사 배송", "필살 참격이 좌·중·우 3개로 복제되고 각 참격은 72% 피해", "ultimate", "#ffe071", { ultimateEcho: 2, ultimateDamageMultiplier: .72 }),
    talent("yoo-seungcheon", 6, "yoo-unlimited", "오늘만 무제한", "필살기 피해 +15% · 재사용 -40%", "ultimate", "#f2b94b", { ultimateDamageMultiplier: 1.15, ultimateCooldownMultiplier: .6 }),
  ],
  kimssi: [
    talent("kimssi", 2, "kim-microwave-2plus1", "전자레인지 2+1", "기본 찍기가 삼연격으로 변하고 각 타격은 55% 피해", "blades", "#f1b257", { basicCount: 3, basicSpread: .18, basicDamageMultiplier: .55 }),
    talent("kimssi", 2, "kim-heavy-armor", "무거운 게 갑옷", "최대 체력 +18% · 방어력 +10", "shield", "#c99055", { maxHpMultiplier: 1.18, armorBonus: 10 }),
    talent("kimssi", 4, "kim-industrial-wire", "산업용 고압선", "전기장 반경 +35% · 지속시간 +45%", "field", "#ffd05c", { fieldRadiusMultiplier: 1.35, fieldDurationMultiplier: 1.45 }),
    talent("kimssi", 4, "kim-door-slam", "문짝째 찍기", "첫 기술 피해 +35% · 한 번 더 잔상 타격", "burst", "#ee9b45", { skill1DamageMultiplier: 1.35, skill1Echo: 1 }),
    talent("kimssi", 6, "kim-turntable-hell", "회전판 지옥", "필살기 피해 +30% · 조리 종료 후 전기 후폭풍", "ultimate", "#ffcf4b", { ultimateDamageMultiplier: 1.3, ultimateEcho: 1 }),
    talent("kimssi", 6, "kim-open-24h", "24시간 영업", "필살기 재사용 -35% · 모든 장판 지속시간 +30%", "field", "#f1a34c", { ultimateCooldownMultiplier: .65, fieldDurationMultiplier: 1.3 }),
  ],
  "ahn-seona": [
    talent("ahn-seona", 2, "ahn-three-nozzle", "분무기 삼구 노즐", "기본 분사가 3방향으로 갈라지고 각 약품은 60% 피해", "burst", "#86f0ae", { basicCount: 3, basicSpread: .2, basicDamageMultiplier: .6 }),
    talent("ahn-seona", 2, "ahn-self-medication", "자가 처방", "최대 체력 +12% · 모든 회복량 +30%", "heart", "#73e7a4", { maxHpMultiplier: 1.12, healMultiplier: 1.3 }),
    talent("ahn-seona", 4, "ahn-overcare", "응급실 과잉진료", "응급 분사 재사용 -28% · 효과 범위 +1칸", "heart", "#d9ffce", { skill2CooldownMultiplier: .72, skill2RangeBonus: 1, healMultiplier: 1.18 }),
    talent("ahn-seona", 4, "ahn-overdose", "약품 과다투여", "첫 기술 피해 +28% · 범위 +30%", "field", "#78efa5", { skill1DamageMultiplier: 1.28, skill1RadiusMultiplier: 1.3 }),
    talent("ahn-seona", 6, "ahn-cap-open", "뚜껑 완전 개방", "필살기 피해·범위 +30% · 약품 후폭풍", "ultimate", "#d4ff85", { ultimateDamageMultiplier: 1.3, ultimateRadiusMultiplier: 1.3, ultimateEcho: 1 }),
    talent("ahn-seona", 6, "ahn-free-refill", "무상 리필", "필살기 재사용 -38% · 모든 회복량 +25%", "heart", "#83f0b2", { ultimateCooldownMultiplier: .62, healMultiplier: 1.25 }),
  ],
  "kang-ryeokhan": [
    talent("kang-ryeokhan", 2, "kang-two-hand-lid", "뚜껑 양손 운전", "기본공격 피해 +32% · 적을 0.35초 더 경직", "blades", "#7fd7dc", { basicDamageMultiplier: 1.32, basicStun: 350 }),
    talent("kang-ryeokhan", 2, "kang-crowd-formation", "시민 밀집 대형", "최대 체력 +20% · 방어력 +12", "shield", "#77bfc8", { maxHpMultiplier: 1.2, armorBonus: 12 }),
    talent("kang-ryeokhan", 4, "kang-eviction", "민원인 강제퇴장", "뚜껑 밀기 피해 +30% · 범위 +25%", "burst", "#66d6df", { skill1DamageMultiplier: 1.3, skill1RadiusMultiplier: 1.25 }),
    talent("kang-ryeokhan", 4, "kang-emergency-order", "비상 방어령", "방어령 재사용 -30% · 회복량 +25%", "shield", "#a7f1f2", { skill2CooldownMultiplier: .7, healMultiplier: 1.25 }),
    talent("kang-ryeokhan", 6, "kang-lid-orbit", "뚜껑 위성 궤도", "필살기가 2회 추가 궤도 타격 · 각 타격 70% 피해", "ultimate", "#f1d56f", { ultimateEcho: 2, ultimateDamageMultiplier: .7 }),
    talent("kang-ryeokhan", 6, "kang-model-citizen", "종신 모범시민", "필살기 재사용 -32% · 방어력 +16", "shield", "#86dce3", { ultimateCooldownMultiplier: .68, armorBonus: 16 }),
  ],
  cheolgak: [
    talent("cheolgak", 2, "cheol-triple-mandible", "삼중 턱니", "기본 턱 공격이 3회 갈라지고 각 공격은 58% 피해", "blades", "#c8e466", { basicCount: 3, basicSpread: .2, basicDamageMultiplier: .58 }),
    talent("cheolgak", 2, "cheol-blood-taste", "피맛 회복", "가한 피해의 12%를 체력으로 회복 · 최대 체력 +8%", "heart", "#b7cf55", { lifesteal: .12, maxHpMultiplier: 1.08 }),
    talent("cheolgak", 4, "cheol-shell-bullet", "갑각 탄환", "껍질 돌격 거리 +1.5칸 · 피해 +25%", "boots", "#a9c85c", { skill2RangeBonus: 1.5, skill2DamageMultiplier: 1.25 }),
    talent("cheolgak", 4, "cheol-jaw-crusher", "좌우 턱분쇄", "턱 쓸기가 한 번 더 반복 · 피해 +18%", "burst", "#d2e36c", { skill1Echo: 1, skill1DamageMultiplier: 1.18 }),
    talent("cheolgak", 6, "cheol-molt-colony", "탈피 군락", "탈피장 반경 +40% · 지속시간 +55% · 후폭풍", "field", "#b5d765", { ultimateRadiusMultiplier: 1.4, fieldDurationMultiplier: 1.55, ultimateEcho: 1 }),
    talent("cheolgak", 6, "cheol-king-horn", "왕뿔 충각", "필살기 피해 +38% · 재사용 -25%", "ultimate", "#e2ec73", { ultimateDamageMultiplier: 1.38, ultimateCooldownMultiplier: .75 }),
  ],
  sanmi: [
    talent("sanmi", 2, "sanmi-triple-acid", "삼분사 산성낭", "산성 기본공격이 3방향으로 갈라지고 각 탄은 58% 피해", "burst", "#d1e85d", { basicCount: 3, basicSpread: .19, basicDamageMultiplier: .58 }),
    talent("sanmi", 2, "sanmi-corrosive-mucus", "부식성 점액", "모든 산성 장판 반경 +25% · 지속시간 +30%", "field", "#b8d64c", { fieldRadiusMultiplier: 1.25, fieldDurationMultiplier: 1.3 }),
    talent("sanmi", 4, "sanmi-mark-spread", "표식 전염", "산성 표식 피해 +30% · 재사용 -25%", "field", "#d9f277", { skill2DamageMultiplier: 1.3, skill2CooldownMultiplier: .75 }),
    talent("sanmi", 4, "sanmi-acid-rain", "신물 폭우", "신물 뱉기가 한 번 더 발사 · 범위 +25%", "burst", "#cde95a", { skill1Echo: 1, skill1RadiusMultiplier: 1.25 }),
    talent("sanmi", 6, "sanmi-acid-lake", "산성 호수", "필살 장판 반경 +45% · 지속시간 +45%", "field", "#e2f25e", { ultimateRadiusMultiplier: 1.45, fieldDurationMultiplier: 1.45 }),
    talent("sanmi", 6, "sanmi-queen-blood", "여왕의 독혈", "필살기 피해 +32% · 가한 피해의 10% 회복", "heart", "#b8d944", { ultimateDamageMultiplier: 1.32, lifesteal: .1 }),
  ],
  hoebun: [
    talent("hoebun", 2, "hoebun-three-dust", "세 갈래 인분침", "기본 인분침이 3방향으로 갈라지고 각 침은 58% 피해", "burst", "#e8d878", { basicCount: 3, basicSpread: .2, basicDamageMultiplier: .58 }),
    talent("hoebun", 2, "hoebun-emergency-light", "비상등 추종 본능", "이동속도 +15% · 활강 거리 +1칸", "boots", "#f0c96a", { moveSpeedMultiplier: 1.15, skill2RangeBonus: 1 }),
    talent("hoebun", 4, "hoebun-blind-storm", "실명 폭풍", "눈가루 반경 +35% · 피해 +22%", "field", "#f2dc80", { skill1RadiusMultiplier: 1.35, skill1DamageMultiplier: 1.22 }),
    talent("hoebun", 4, "hoebun-glide-echo", "활강 잔상", "활강 재사용 -32% · 착지 후 기술 잔상", "boots", "#d9c566", { skill2CooldownMultiplier: .68, skill1Echo: 1 }),
    talent("hoebun", 6, "hoebun-split-swarm", "불나방 분열체", "필살기 후폭풍 2회 · 각 피해 72%", "ultimate", "#ffdf72", { ultimateEcho: 2, ultimateDamageMultiplier: .72 }),
    talent("hoebun", 6, "hoebun-last-light", "최후의 광원", "필살기 재사용 -38% · 이동속도 +10%", "ultimate", "#f7cc63", { ultimateCooldownMultiplier: .62, moveSpeedMultiplier: 1.1 }),
  ],
  maedeup: [
    talent("maedeup", 2, "maedeup-triangle-needle", "삼각 실바늘", "기본 실바늘이 3방향으로 갈라지고 각 바늘은 60% 피해", "burst", "#d8c6e8", { basicCount: 3, basicSpread: .21, basicDamageMultiplier: .6 }),
    talent("maedeup", 2, "maedeup-steel-silk", "철실 외골격", "최대 체력 +15% · 방어력 +10", "shield", "#bda9d2", { maxHpMultiplier: 1.15, armorBonus: 10 }),
    talent("maedeup", 4, "maedeup-double-web", "겹그물 매복", "끈끈이 매복이 한 번 더 펼쳐지고 장판 지속 +35%", "field", "#cab6dd", { skill1Echo: 1, fieldDurationMultiplier: 1.35 }),
    talent("maedeup", 4, "maedeup-pull-again", "당기고 또 당기기", "끌기 피해 +30% · 재사용 -28%", "blades", "#e1c7ed", { skill2DamageMultiplier: 1.3, skill2CooldownMultiplier: .72 }),
    talent("maedeup", 6, "maedeup-double-lock", "팔방 이중봉쇄", "필살 봉쇄 반경 +35% · 후폭풍", "ultimate", "#e4caf0", { ultimateRadiusMultiplier: 1.35, ultimateEcho: 1 }),
    talent("maedeup", 6, "maedeup-tunnel-weave", "터널 전체 직조", "모든 장판 지속 +55% · 필살기 재사용 -25%", "field", "#c4add8", { fieldDurationMultiplier: 1.55, ultimateCooldownMultiplier: .75 }),
  ],
  d09: [
    talent("d09", 2, "d09-triple-jab", "삼중 드릴 잽", "기본 드릴이 3회 천공하고 각 타격은 56% 피해", "drill", "#f0a75d", { basicCount: 3, basicSpread: .16, basicDamageMultiplier: .56 }),
    talent("d09", 2, "d09-overmotor", "과출력 모터", "기본공격 피해 +20% · 이동속도 +10%", "boots", "#e59048", { basicDamageMultiplier: 1.2, moveSpeedMultiplier: 1.1 }),
    talent("d09", 4, "d09-illegal-drill", "규격 외 연속천공", "첫 기술이 한 번 더 반복 · 피해 +20%", "drill", "#ffad58", { skill1Echo: 1, skill1DamageMultiplier: 1.2 }),
    talent("d09", 4, "d09-two-speed", "궤도 이단변속", "궤도 전환 거리 +1.5칸 · 재사용 -25%", "boots", "#f49a4c", { skill2RangeBonus: 1.5, skill2CooldownMultiplier: .75 }),
    talent("d09", 6, "d09-three-shift", "공사기한 3교대", "필살기 후폭풍 2회 · 각 피해 72%", "ultimate", "#ffc166", { ultimateEcho: 2, ultimateDamageMultiplier: .72 }),
    talent("d09", 6, "d09-final-breach", "준공 전면돌파", "필살기 피해 +35% · 굴착 재사용 -30%", "drill", "#f1a152", { ultimateDamageMultiplier: 1.35, drillCooldownMultiplier: .7 }),
  ],
  g77: [
    talent("g77", 2, "g77-triple-baton", "차단봉 삼단봉", "기본 진압이 3회로 변하고 각 타격은 56% 피해", "blades", "#f0a055", { basicCount: 3, basicSpread: .18, basicDamageMultiplier: .56 }),
    talent("g77", 2, "g77-night-armor", "야간용 중장갑", "최대 체력 +18% · 방어력 +14", "shield", "#d58445", { maxHpMultiplier: 1.18, armorBonus: 14 }),
    talent("g77", 4, "g77-wide-suppression", "광역 진압 절차", "차단봉 진압 범위 +30% · 피해 +25%", "burst", "#ee994a", { skill1RadiusMultiplier: 1.3, skill1DamageMultiplier: 1.25 }),
    talent("g77", 4, "g77-double-patrol", "순찰 2교대", "야간 순찰 재사용 -30% · 회복량 +25%", "shield", "#f2b15d", { skill2CooldownMultiplier: .7, healMultiplier: 1.25 }),
    talent("g77", 6, "g77-total-lockdown", "전면 통행금지령", "필살 봉쇄 반경 +40% · 지속시간 +45%", "field", "#ffbd60", { ultimateRadiusMultiplier: 1.4, fieldDurationMultiplier: 1.45 }),
    talent("g77", 6, "g77-martial-law", "계엄 모드", "필살기 피해 +32% · 재사용 -30%", "ultimate", "#e68c47", { ultimateDamageMultiplier: 1.32, ultimateCooldownMultiplier: .7 }),
  ],
  r486: [
    talent("r486", 2, "r486-triple-receipt", "영수증 연속발행", "기본 볼트가 3방향으로 발행되고 각 볼트는 60% 피해", "burst", "#75d6c8", { basicCount: 3, basicSpread: .2, basicDamageMultiplier: .6 }),
    talent("r486", 2, "r486-insurance", "보험 적용 수리", "최대 체력 +12% · 모든 회복량 +30%", "heart", "#64cbbd", { maxHpMultiplier: 1.12, healMultiplier: 1.3 }),
    talent("r486", 4, "r486-bulk-tape", "덕트테이프 대량처방", "처방 범위 +30% · 피해 +22%", "field", "#83ded0", { skill1RadiusMultiplier: 1.3, skill1DamageMultiplier: 1.22 }),
    talent("r486", 4, "r486-weld-team", "용접 출장반", "용접 재사용 -28% · 회복량 +25%", "heart", "#9ce8dc", { skill2CooldownMultiplier: .72, healMultiplier: 1.25 }),
    talent("r486", 6, "r486-national-as", "전국 긴급 A/S", "필살기 범위 +40% · 장판 지속 +45%", "field", "#adf1e7", { ultimateRadiusMultiplier: 1.4, fieldDurationMultiplier: 1.45 }),
    talent("r486", 6, "r486-infinite-warranty", "무한 보증기간", "필살기 재사용 -38% · 수리 후폭풍", "ultimate", "#77d6c9", { ultimateCooldownMultiplier: .62, ultimateEcho: 1 }),
  ],
  c999: [
    talent("c999", 2, "c999-triple-copy", "결재선 3중 복사", "기본 레이저가 3방향으로 복사되고 각 광선은 58% 피해", "burst", "#f0aa62", { basicCount: 3, basicSpread: .17, basicDamageMultiplier: .58, basicPierce: true }),
    talent("c999", 2, "c999-central-authority", "권한 집중", "기본공격 피해 +25% · 방어력 +8", "shield", "#de8b4d", { basicDamageMultiplier: 1.25, armorBonus: 8 }),
    talent("c999", 4, "c999-auto-reject", "반려 자동화", "결재 반려가 한 번 더 실행 · 피해 +20%", "burst", "#f2a356", { skill1Echo: 1, skill1DamageMultiplier: 1.2 }),
    talent("c999", 4, "c999-transfer-exception", "부서 이동 특례", "부서 이동 거리 +1.5칸 · 재사용 -28%", "boots", "#e99a55", { skill2RangeBonus: 1.5, skill2CooldownMultiplier: .72 }),
    talent("c999", 6, "c999-multi-audit", "전면 감사 복수결재", "필살기 후폭풍 2회 · 범위 +25%", "ultimate", "#ffc16e", { ultimateEcho: 2, ultimateRadiusMultiplier: 1.25, ultimateDamageMultiplier: .75 }),
    talent("c999", 6, "c999-permanent-audit", "상시 감사 체제", "필살기 재사용 -38% · 모든 장판 지속 +30%", "field", "#e9944f", { ultimateCooldownMultiplier: .62, fieldDurationMultiplier: 1.3 }),
  ],
};

const combinedDefaults: Required<HeroTalentEffect> = {
  basicCount: 1,
  basicSpread: 0,
  basicDamageMultiplier: 1,
  basicPierce: false,
  basicStun: 0,
  skill1DamageMultiplier: 1,
  skill1RadiusMultiplier: 1,
  skill1CooldownMultiplier: 1,
  skill1Echo: 0,
  skill2DamageMultiplier: 1,
  skill2RangeBonus: 0,
  skill2CooldownMultiplier: 1,
  drillCooldownMultiplier: 1,
  drillWidthBonus: 0,
  ultimateDamageMultiplier: 1,
  ultimateRadiusMultiplier: 1,
  ultimateCooldownMultiplier: 1,
  ultimateEcho: 0,
  fieldRadiusMultiplier: 1,
  fieldDurationMultiplier: 1,
  healMultiplier: 1,
  lifesteal: 0,
  maxHpMultiplier: 1,
  armorBonus: 0,
  moveSpeedMultiplier: 1,
};

export const heroTalentChoices = (heroId: string, level: TalentTier) =>
  (HERO_TALENT_TREES[heroId] ?? []).filter((choice) => choice.level === level);

export const heroTalentById = (heroId: string, id: string) =>
  (HERO_TALENT_TREES[heroId] ?? []).find((choice) => choice.id === id);

export const combineHeroTalentEffects = (heroId: string, chosenIds: Iterable<string>) => {
  const result = { ...combinedDefaults };
  for (const id of chosenIds) {
    const effect = heroTalentById(heroId, id)?.effect;
    if (!effect) continue;
    result.basicCount = Math.max(result.basicCount, effect.basicCount ?? 1);
    result.basicSpread = Math.max(result.basicSpread, effect.basicSpread ?? 0);
    result.basicDamageMultiplier *= effect.basicDamageMultiplier ?? 1;
    result.basicPierce ||= effect.basicPierce ?? false;
    result.basicStun = Math.max(result.basicStun, effect.basicStun ?? 0);
    result.skill1DamageMultiplier *= effect.skill1DamageMultiplier ?? 1;
    result.skill1RadiusMultiplier *= effect.skill1RadiusMultiplier ?? 1;
    result.skill1CooldownMultiplier *= effect.skill1CooldownMultiplier ?? 1;
    result.skill1Echo += effect.skill1Echo ?? 0;
    result.skill2DamageMultiplier *= effect.skill2DamageMultiplier ?? 1;
    result.skill2RangeBonus += effect.skill2RangeBonus ?? 0;
    result.skill2CooldownMultiplier *= effect.skill2CooldownMultiplier ?? 1;
    result.drillCooldownMultiplier *= effect.drillCooldownMultiplier ?? 1;
    result.drillWidthBonus += effect.drillWidthBonus ?? 0;
    result.ultimateDamageMultiplier *= effect.ultimateDamageMultiplier ?? 1;
    result.ultimateRadiusMultiplier *= effect.ultimateRadiusMultiplier ?? 1;
    result.ultimateCooldownMultiplier *= effect.ultimateCooldownMultiplier ?? 1;
    result.ultimateEcho += effect.ultimateEcho ?? 0;
    result.fieldRadiusMultiplier *= effect.fieldRadiusMultiplier ?? 1;
    result.fieldDurationMultiplier *= effect.fieldDurationMultiplier ?? 1;
    result.healMultiplier *= effect.healMultiplier ?? 1;
    result.lifesteal += effect.lifesteal ?? 0;
    result.maxHpMultiplier *= effect.maxHpMultiplier ?? 1;
    result.armorBonus += effect.armorBonus ?? 0;
    result.moveSpeedMultiplier *= effect.moveSpeedMultiplier ?? 1;
  }
  return result;
};
