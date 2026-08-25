export const SKIRMISH_STARTING_CREDITS = 120;
export const MINION_KILL_CREDITS = 8;
export const ELITE_KILL_CREDITS = 30;
export const HERO_KILL_CREDITS = 35;
export const INSTALLATION_REWARD_RATE = 0.25;
export const INSTALLATION_REWARD_MIN = 10;
export const COMPUTER_CREDIT_MULTIPLIER = 1.08;

export const installationKillCredits = (cost: number) =>
  Math.max(INSTALLATION_REWARD_MIN, Math.round(cost * INSTALLATION_REWARD_RATE));

export const creditedAmount = (amount: number, computerTeam: boolean) =>
  Math.round(amount * (computerTeam ? COMPUTER_CREDIT_MULTIPLIER : 1));

