import type { FactionId } from "./content";

export type TacticalRole = "defense" | "offense" | "area" | "recovery" | "reinforce";
export type TacticalBuffRole = "defense" | "offense" | "recovery";

export type TacticalBuffVisual = {
  auraColor: string;
  sparkColor: string;
  badge: "shield" | "surge" | "plus";
};

export type TacticalSupportDefinition = {
  role: TacticalRole;
  name: string;
  description: string;
  cost: number;
  durationMs: number;
  warningMs?: number;
  radius?: number;
  color: string;
};

export const TACTICAL_SHARED_COOLDOWN_MS = 45_000;
export const TACTICAL_RECOVERY_TICK_MS = 1_000;
export const TACTICAL_RECOVERY_FRACTION = 0.03;
export const ELITE_TACTICAL_EFFECT_SCALE = 0.7;
export const ELITE_RECOVERY_SCALE = 0.5;

export const TACTICAL_SUPPORT: Readonly<Record<FactionId, Readonly<Record<TacticalRole, TacticalSupportDefinition>>>> = {
  human: {
    defense: { role: "defense", name: "긴급 차폐망", description: "진군대 받는 피해 65% 감소 · 6초", cost: 100, durationMs: 6_000, color: "#67e8f9" },
    offense: { role: "offense", name: "고철 과부하", description: "공격력 +35% · 이동 +15% · 10초", cost: 120, durationMs: 10_000, color: "#f6c453" },
    area: { role: "area", name: "깡통 미사일 포격", description: "지정 지점에 예고 후 3연속 포격", cost: 150, durationMs: 2_000, warningMs: 800, radius: 2.2, color: "#ffb454" },
    recovery: { role: "recovery", name: "응급 수리반", description: "현재 진군대 최대 HP 3%씩 8초 회복", cost: 130, durationMs: 8_000, color: "#71e6c1" },
    reinforce: { role: "reinforce", name: "비상 소집령", description: "거점에서 일반 진군대 5명 긴급 출전", cost: 180, durationMs: 2_500, color: "#f6c453" },
  },
  bugborn: {
    defense: { role: "defense", name: "갑피 탈피", description: "최대 체력 25% 임시 갑피 · 6초", cost: 100, durationMs: 6_000, color: "#a8e05f" },
    offense: { role: "offense", name: "페로몬 광분", description: "공격 간격 -30% · 흡혈 20% · 10초", cost: 120, durationMs: 10_000, color: "#df5fae" },
    area: { role: "area", name: "산성 포자 폭우", description: "6초 지속 피해와 방어 약화 지대", cost: 150, durationMs: 6_000, warningMs: 700, radius: 2.5, color: "#b7e35a" },
    recovery: { role: "recovery", name: "재생 포자", description: "현재 진군대 최대 HP 3%씩 8초 회복", cost: 130, durationMs: 8_000, color: "#9ee76d" },
    reinforce: { role: "reinforce", name: "알집 긴급 부화", description: "거점에서 일반 진군대 5명 긴급 출전", cost: 180, durationMs: 2_500, color: "#d6d95d" },
  },
  ai: {
    defense: { role: "defense", name: "절대방어 프로토콜", description: "다음 피해 2회 차단 · 6초", cost: 100, durationMs: 6_000, color: "#66d9ff" },
    offense: { role: "offense", name: "연산 오버클럭", description: "사거리 +1 · 공격 간격 -25% · 10초", cost: 120, durationMs: 10_000, color: "#ff914d" },
    area: { role: "area", name: "좌표 소거 포격", description: "긴 예고 뒤 좁고 강한 정밀 타격", cost: 150, durationMs: 1_900, warningMs: 1_600, radius: 1.5, color: "#ff6a45" },
    recovery: { role: "recovery", name: "복구 프로토콜", description: "현재 진군대 최대 HP 3%씩 8초 회복", cost: 130, durationMs: 8_000, color: "#70e6ff" },
    reinforce: { role: "reinforce", name: "예비 기체 가동", description: "거점에서 일반 진군대 5명 긴급 출전", cost: 180, durationMs: 2_500, color: "#ffad5c" },
  },
};

export const tacticalDefinition = (faction: FactionId, role: TacticalRole) => TACTICAL_SUPPORT[faction][role];

const TACTICAL_BUFF_VISUALS: Readonly<Record<FactionId, Readonly<Record<TacticalBuffRole, TacticalBuffVisual>>>> = {
  human: {
    defense: { auraColor: "#67e8f9", sparkColor: "#d9fbff", badge: "shield" },
    offense: { auraColor: "#79ddff", sparkColor: "#f6c453", badge: "surge" },
    recovery: { auraColor: "#71e6c1", sparkColor: "#d7fff2", badge: "plus" },
  },
  bugborn: {
    defense: { auraColor: "#a8e05f", sparkColor: "#e5ff9d", badge: "shield" },
    offense: { auraColor: "#df5fae", sparkColor: "#baff78", badge: "surge" },
    recovery: { auraColor: "#9ee76d", sparkColor: "#edffc8", badge: "plus" },
  },
  ai: {
    defense: { auraColor: "#66d9ff", sparkColor: "#e7fbff", badge: "shield" },
    offense: { auraColor: "#76e7ff", sparkColor: "#ff914d", badge: "surge" },
    recovery: { auraColor: "#70e6ff", sparkColor: "#e7fbff", badge: "plus" },
  },
};

export const tacticalBuffVisual = (faction: FactionId, role: TacticalBuffRole) => TACTICAL_BUFF_VISUALS[faction][role];
