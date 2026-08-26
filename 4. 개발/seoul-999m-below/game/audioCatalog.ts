import type { BattleMapId } from "./matchConfig";

export type MusicId =
  | "shelter-network"
  | "rust-rail-assault"
  | "flooded-pressure"
  | "root-signal"
  | "redline-siege";
export type VoiceSlot = 1 | 2 | 3 | 4;
export type VoiceStyle = "human-male" | "human-female" | "ai" | "bugborn";
export type ImpactMaterial = "human" | "bugborn" | "ai" | "structure";
export type DigMaterial = "earth" | "rock" | "metal" | "ore";

const variants = (folder: string, count: number) =>
  Array.from({ length: count }, (_, index) => `/assets/audio/sfx/${folder}-${index + 1}.wav?v=1`);

export const COMBAT_SAMPLES = {
  impact: {
    human: variants("impact/human", 3),
    bugborn: variants("impact/bugborn", 3),
    ai: variants("impact/ai", 3),
    structure: variants("impact/structure", 3),
  } satisfies Record<ImpactMaterial, string[]>,
  critical: variants("impact/critical", 3),
  dig: {
    earth: variants("dig/earth", 3),
    rock: variants("dig/rock", 3),
    metal: variants("dig/metal", 3),
    ore: variants("dig/ore", 3),
  } satisfies Record<DigMaterial, string[]>,
  collapse: variants("dig/collapse", 3),
  down: {
    human: variants("down/human", 2),
    bugborn: variants("down/bugborn", 2),
    ai: variants("down/ai", 2),
  } satisfies Record<Exclude<ImpactMaterial, "structure">, string[]>,
  victory: "/assets/audio/sfx/result/victory.wav?v=1",
  defeat: "/assets/audio/sfx/result/defeat.wav?v=1",
};

export const MUSIC_TRACKS: Record<
  MusicId,
  { title: string; file: string; bpm: number }
> = {
  "shelter-network": {
    title: "생존본부 주파수",
    file: "/assets/audio/bgm/01-shelter-network.wav?v=3",
    bpm: 64,
  },
  "rust-rail-assault": {
    title: "녹슨 환승 전투",
    file: "/assets/audio/bgm/02-rust-rail-assault.wav?v=3",
    bpm: 84,
  },
  "flooded-pressure": {
    title: "침수 압력 경보",
    file: "/assets/audio/bgm/03-flooded-pressure.wav?v=3",
    bpm: 72,
  },
  "root-signal": {
    title: "군체 신호",
    file: "/assets/audio/bgm/04-root-signal.wav?v=3",
    bpm: 78,
  },
  "redline-siege": {
    title: "적색선 공성",
    file: "/assets/audio/bgm/05-redline-siege.wav?v=3",
    bpm: 92,
  },
};

export const MUSIC_BY_MAP: Record<BattleMapId, MusicId> = {
  "secret-crossroads": "rust-rail-assault",
  "secret-reservoir": "flooded-pressure",
  "secret-cache": "root-signal",
  "central-exchange": "rust-rail-assault",
  "flooded-pump": "flooded-pressure",
  "root-lab": "root-signal",
  "freight-fork": "rust-rail-assault",
  "thermal-shaft": "redline-siege",
  "sealed-bunker": "redline-siege",
  "ore-catacomb": "root-signal",
};

export const MUSIC_BY_CAMPAIGN: Record<number, MusicId> = {
  1: "redline-siege",
  2: "flooded-pressure",
  3: "rust-rail-assault",
  4: "root-signal",
  5: "redline-siege",
};

type VoiceLine = {
  style: VoiceStyle;
  file: string;
  spoken: string;
  playbackRate: number;
};

const voice = (
  heroId: string,
  style: VoiceStyle,
  playbackRate: number,
  lines: [string, string, string, string],
): Record<VoiceSlot, VoiceLine> =>
  Object.fromEntries(
    lines.map((spoken, index) => {
      const slot = (index + 1) as VoiceSlot;
      return [
        slot,
        {
          style,
          spoken,
          playbackRate,
          file: `/assets/audio/voices/${heroId}/skill-${slot}.${style === "bugborn" ? "wav" : "mp3"}`,
        },
      ];
    }),
  ) as Record<VoiceSlot, VoiceLine>;

export const HERO_VOICE_LINES: Record<string, Record<VoiceSlot, VoiceLine>> = {
  "yoo-seungcheon": voice("yoo-seungcheon", "human-male", 0.86, [
    "회오리베기이!",
    "돌격! 찌르기!",
    "파란 드릴! 전개애!",
    "필살! 짝퉁! 초고속! 참겨어억!",
  ]),
  kimssi: voice("kimssi", "human-male", 0.78, [
    "전자레인지로 찍는다!",
    "전자레인지, 최고 출력!",
    "염력 굴착장!",
    "필살! 전자레인지에 넣고 돌린다!",
  ]),
  "ahn-seona": voice("ahn-seona", "human-female", 1.06, [
    "분무기 뿌립니다!",
    "응급 분사, 가만히 있어요!",
    "모세관 굴착!",
    "필살! 과다 투약 들어갑니다!",
  ]),
  "kang-ryeokhan": voice("kang-ryeokhan", "human-male", 0.91, [
    "뚜껑 들고 민다!",
    "모범 시민 방어령!",
    "나만의 안전구역!",
    "필살! 뚜껑 날아간다!",
  ]),
  cheolgak: voice("cheolgak", "bugborn", 0.82, ["크륵, 자가!", "키르르, 카악!", "그르륵, 츠아!", "키야아, 크라가라! 필사아알! "]),
  sanmi: voice("sanmi", "bugborn", 1.08, ["츠시익, 카라!", "키시시, 라아!", "스르륵, 차악!", "키이익, 사라카! 필사아알! "]),
  hoebun: voice("hoebun", "bugborn", 1.24, ["휘릭, 키리!", "샤라락, 흐아!", "키키키, 츠릉!", "휘이익, 카라라! 필사아알! "]),
  maedeup: voice("maedeup", "bugborn", 0.96, ["차르륵, 크리!", "키라, 이리카!", "자자작, 그르!", "크르르, 팔라카! 필사아알! "]),
  d09: voice("d09", "ai", 0.9, ["규격 외 천공. 승인.", "궤도 전환.", "노선 직진.", "필살 프로토콜. 공사기한 준수." ]),
  g77: voice("g77", "ai", 0.79, ["차단봉 진압.", "야간 순찰 개시.", "방패 압착 굴착.", "필살 프로토콜. 전면 통행금지." ]),
  r486: voice("r486", "ai", 1.02, ["덕트테이프 처방.", "용접 불꽃 주의.", "배관 탐색.", "필살 프로토콜. 긴급 에이 에스." ]),
  c999: voice("c999", "ai", 0.84, ["결재 반려.", "부서 이동 명령.", "도면 재승인.", "필살 프로토콜. 전면 감사 집행." ]),
};

export const voiceLine = (heroId: string, slot: VoiceSlot) =>
  HERO_VOICE_LINES[heroId]?.[slot];
