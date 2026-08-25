export type CampaignChapter = 1 | 2 | 3 | 4 | 5;

export type CampaignObjectiveDefinition = {
  victory: string;
  defeat: string;
};

export type CampaignObjectiveSnapshot = {
  phase: number;
  enemies: number;
  subjectsAlive: number;
  subjectsCompleted: number;
  enemyCoreHp: number;
  missionTime: number;
};

export const CAMPAIGN_OBJECTIVES: Record<CampaignChapter, CampaignObjectiveDefinition> = {
  1: {
    victory: "1·2차 침입체와 철각을 모두 격퇴한다.",
    defeat: "유승천이 전투불능이 되거나 서울 생존 코어가 파괴된다.",
  },
  2: {
    victory: "박사 3명 중 한 명 이상을 평택 연구소 입구까지 호송한다.",
    defeat: "유승천이 전투불능이 되거나 박사 3명이 모두 사망한다.",
  },
  3: {
    victory: "김씨와 함께 안서나·강력한 두 사람의 기권을 받아낸다.",
    defeat: "유승천이 먼저 전투불능이 되어 기권한다.",
  },
  4: {
    victory: "5분 안에 버그본 코어를 파괴한다.",
    defeat: "유승천이 전투불능이 되거나 제한 시간이 끝난다.",
  },
  5: {
    victory: "3분 30초 안에 두 전투실을 정리하고 천안 연결 지점에 도달한다.",
    defeat: "유승천이 전투불능이 되거나 제한 시간이 끝난다.",
  },
};

const formatTime = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;

export const campaignObjectiveProgress = (
  chapter: CampaignChapter,
  snapshot: CampaignObjectiveSnapshot,
) => {
  switch (chapter) {
    case 1:
      if (snapshot.phase === 0) return "정찰 경보 · 환풍구 개방 대기";
      return snapshot.phase === 1
        ? `1차 침입 방어 · 남은 침입체 ${snapshot.enemies}기`
        : `2차 침입·철각 격퇴 · 남은 적 ${snapshot.enemies}기`;
    case 2:
      return `박사 생존 ${snapshot.subjectsAlive}/3 · 평택 도착 ${snapshot.subjectsCompleted}/1`;
    case 3:
      return `남은 대련 상대 ${snapshot.enemies}/2`;
    case 4:
      return `버그본 코어 내구도 ${Math.max(0, Math.ceil(snapshot.enemyCoreHp))} · 남은 시간 ${formatTime(snapshot.missionTime)}`;
    case 5: {
      const stage = Math.min(3, Math.max(1, snapshot.phase));
      const stageLabel = stage === 1 ? "첫 군체 섬멸" : stage === 2 ? "군체장 격파" : "천안 연결점 도달";
      return `${stage}/3단계 · ${stageLabel} · 남은 시간 ${formatTime(snapshot.missionTime)}`;
    }
  }
};
