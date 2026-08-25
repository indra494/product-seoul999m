export type CampaignChapter = 1 | 2 | 3 | 4 | 5;

export const CAMPAIGN_PROLOGUE_STORAGE_KEY = "seoul999m.prologueSeen";
export const CAMPAIGN_PROLOGUE_VIDEO = "/assets/opening/seoul-999m-opening-v12.mp4";
export const CAMPAIGN_PROGRESS_STORAGE_KEY = "seoul999m.campaign.completed.v1";
export const CAMPAIGN_CINEMATIC_STORAGE_KEY = "seoul999m.campaign.cinematicsSeen.v1";

export const CAMPAIGN_CINEMATICS: Record<CampaignChapter, string> = {
  1: "/assets/campaign/cinematics/human_story_01.mp4",
  2: "/assets/campaign/cinematics/human_story_02.mp4",
  3: "/assets/campaign/cinematics/human_story_03.mp4",
  4: "/assets/campaign/cinematics/human_story_04.mp4",
  5: "/assets/campaign/cinematics/human_story_05.mp4",
};

const isCampaignChapter = (value: unknown): value is CampaignChapter =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

export const hasSeenCampaignPrologue = (raw: string | null) => raw === "1";

export const parseCampaignChapterList = (raw: string | null): CampaignChapter[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(isCampaignChapter))].sort((a, b) => a - b);
  } catch {
    return [];
  }
};

export const completeCampaignChapter = (
  completed: CampaignChapter[],
  chapter: CampaignChapter,
) => [...new Set([...completed, chapter])].sort((a, b) => a - b) as CampaignChapter[];

export const unlockedCampaignChapter = (completed: CampaignChapter[]) => {
  let unlocked: CampaignChapter = 1;
  while (unlocked < 5 && completed.includes(unlocked))
    unlocked = (unlocked + 1) as CampaignChapter;
  return unlocked;
};

export const campaignChapterStatus = (
  chapter: CampaignChapter,
  completed: CampaignChapter[],
): "completed" | "available" | "locked" => {
  if (completed.includes(chapter)) return "completed";
  return chapter === unlockedCampaignChapter(completed) ? "available" : "locked";
};
