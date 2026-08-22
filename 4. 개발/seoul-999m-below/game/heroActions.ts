import { heroKit } from "./heroKits";

export type HeroActionSlot = 0 | 1 | 2 | 3 | 4;

export type HeroAction = {
  slot: HeroActionSlot;
  mode: string;
  caption: string;
  damage: number;
  range: number;
  radius: number;
  cooldown: number;
};

export const heroAction = (heroId: string, slot: HeroActionSlot): HeroAction => {
  const kit = heroKit(heroId);
  if (slot === 0)
    return {
      slot,
      mode: kit.basic.mode,
      caption: kit.basic.caption,
      damage: 1,
      range: 0,
      radius: 0,
      cooldown: 0,
    };
  const action = slot === 1 ? kit.skill1 : slot === 2 ? kit.skill2 : slot === 3 ? kit.drill : kit.ultimate;
  return {
    slot,
    mode: action.mode,
    caption: action.caption,
    damage: "damage" in action ? action.damage : 0,
    range: "range" in action ? action.range : "length" in action ? action.length : 0,
    radius: "radius" in action ? action.radius : "width" in action ? action.width : 0,
    cooldown: action.cooldown,
  };
};
