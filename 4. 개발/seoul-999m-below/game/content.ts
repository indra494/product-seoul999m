export type FactionId="human"|"bugborn"|"ai";
export type MinionRole="breaker"|"escort"|"shooter"|"elite";

export type SupportAura={kind:"attack"|"speed"|"range";value:number;upgradedValue:number};
export type BuildableControl={
 kind:"shock"|"acid"|"tether";stunMs?:number;splash?:number;fieldDurationMs?:number;fieldDamage?:number;
};

export type CombatStats={
 maxHp:number;armor:number;moveSpeed:number;damage:number;attackInterval:number;
 range:number;critChance:number;critMultiplier:number;vision:number;bodyRadius:number;digPower:number;
};

export type HeroDefinition={
 id:string;faction:FactionId;name:string;title:string;role:string;weapon:string;drill:string;
 skills:[string,string,string,string];stats:CombatStats;portrait:string;playable:boolean;
};

export type MinionDefinition={
 id:string;faction:FactionId;role:MinionRole;name:string;stats:CombatStats;shieldDamage:number;
 colors:{body:string;accent:string;dark:string};
};

export type BuildableDefinition={
  id:string;faction:FactionId;category:"multi"|"ranged"|"blocker"|"support";name:string;short:string;
 cost:number;hp:number;range:number;cooldown:number;damage:number;targets:number;critChance:number;
  critMultiplier:number;drillDurability:number;asset?:string;supportAura?:SupportAura;control?:BuildableControl;
};

export const FACTIONS={
 human:{name:"휴먼",tagline:"고철 민방위대",trait:"균형형",color:"#55dce9"},
 bugborn:{name:"버그본",tagline:"폐토의 진화 군체",trait:"고속·저화력",color:"#a6c755"},
 ai:{name:"AI 로봇",tagline:"도시 유지보수군",trait:"저속·고화력",color:"#e68c47"},
} satisfies Record<FactionId,{name:string;tagline:string;trait:string;color:string}>;

export const FACTION_BASES:Record<FactionId,{name:string;asset:string}>={
 human:{name:"서울 생존 코어",asset:"/assets/bases/human/seoul/human-seoul-base-v1-alpha.png"},
 bugborn:{name:"버그본 군체 코어",asset:"/assets/bases/bugborn/bugborn-hive-core-v1-alpha.png"},
 ai:{name:"AI 도시 관제 코어",asset:"/assets/bases/ai/ai-city-control-core-v1-alpha.png"},
};

const hero=(id:string,faction:FactionId,name:string,title:string,role:string,weapon:string,drill:string,skills:[string,string,string,string],stats:CombatStats,portrait:string,playable=true):HeroDefinition=>({id,faction,name,title,role,weapon,drill,skills,stats,portrait,playable});

export const HEROES:HeroDefinition[]=[
 hero("yoo-seungcheon","human","유승천","쾌속검","스피드 딜러","장난감검","파란 드릴",["회오리베기","돌격 찌르기","파란 드릴 전개","참격"],{maxHp:820,armor:8,moveSpeed:5.2,damage:42,attackInterval:.38,range:1.15,critChance:.12,critMultiplier:1.5,vision:6.5,bodyRadius:.32,digPower:1},"/assets/characters/concepts/human-yoo-seungcheon-concept-v3-soccer-bgrade.png",true),
 hero("kimssi","human","김씨","전자레인지 장사","힘형 딜러","전자레인지","커다란 드릴",["전자레인지로 찍기","전자레인지 켜기","염력 굴착장","전자레인지에 넣고 돌리기"],{maxHp:1250,armor:18,moveSpeed:3.6,damage:80,attackInterval:.78,range:1.15,critChance:.05,critMultiplier:1.65,vision:5.5,bodyRadius:.48,digPower:2},"/assets/characters/concepts/human-kimssi-concept-v2-bgrade.png"),
 hero("ahn-seona","human","안서나","빈민가 약제사","원거리 지원가","분무기","얇은 드릴",["분무기 뿌리기","응급 분사","모세관 굴착","분무기 뚜껑 열기"],{maxHp:760,armor:6,moveSpeed:4.7,damage:24,attackInterval:.62,range:4.8,critChance:.08,critMultiplier:1.45,vision:8,bodyRadius:.31,digPower:1},"/assets/characters/concepts/human-ahn-seona-concept-v2-bgrade.png"),
 hero("kang-ryeokhan","human","강력한","모범 시민","탱커","하수구 뚜껑","주먹 드릴",["뚜껑 들고 밀기","모범 시민 방어령","나만의 안전구역","뚜껑 날리기"],{maxHp:1500,armor:35,moveSpeed:3.8,damage:55,attackInterval:.65,range:1.05,critChance:.05,critMultiplier:1.5,vision:6,bodyRadius:.45,digPower:1},"/assets/characters/concepts/human-kang-ryeokhan-concept-v2-longhair-bgrade.png"),
 hero("cheolgak","bugborn","철각","무너진 2호선의 뿔","돌격 브루저","거대 턱","쐐기굴",["턱 벌려 쓸기","껍질 돌격","쐐기굴","탈피 충각"],{maxHp:1100,armor:18,moveSpeed:4.8,damage:54,attackInterval:.72,range:1.2,critChance:.08,critMultiplier:1.4,vision:6,bodyRadius:.42,digPower:2},"/assets/characters/concepts/bugborn-playable-roster-concept-v1.png"),
 hero("sanmi","bugborn","산미","하수처리장의 신맛","산성 지속 딜러","산성낭","산성 굴착액",["신물 뱉기","산성 표식","산성 굴착액","여왕의 위산"],{maxHp:690,armor:4,moveSpeed:5.2,damage:20,attackInterval:.65,range:4.3,critChance:.1,critMultiplier:1.35,vision:7,bodyRadius:.3,digPower:1},"/assets/characters/concepts/bugborn-playable-roster-concept-v1.png"),
 hero("hoebun","bugborn","회분","비상등을 믿는 나방","고속 정찰 지원","인분 침","초음파 균열",["눈가루","비상등 활강","초음파 균열","불나방 대폭주"],{maxHp:650,armor:2,moveSpeed:5.8,damage:16,attackInterval:.55,range:3.6,critChance:.12,critMultiplier:1.35,vision:9,bodyRadius:.29,digPower:1},"/assets/characters/concepts/bugborn-playable-roster-concept-v1.png"),
 hero("maedeup","bugborn","매듭","터널을 짜는 여덟 손","함정 제어","굳은실 바늘","실톱 굴착",["끈끈이 매복","이리 와","실톱 굴착","팔방 봉쇄"],{maxHp:840,armor:10,moveSpeed:4.6,damage:30,attackInterval:.82,range:3,critChance:.08,critMultiplier:1.4,vision:7.5,bodyRadius:.35,digPower:1},"/assets/characters/concepts/bugborn-playable-roster-concept-v1.png"),
 hero("d09","ai","D-09 땅파","폐기된 노선 굴착기","굴착 딜러","드릴 잽","노선 직진",["규격 외 천공","궤도 전환","노선 직진","공사기한 준수"],{maxHp:1100,armor:22,moveSpeed:3.8,damage:74,attackInterval:.72,range:1.3,critChance:.06,critMultiplier:1.6,vision:6.5,bodyRadius:.4,digPower:2},"/assets/characters/concepts/ai-robot-playable-roster-concept-v1.png"),
 hero("g77","ai","G-77 야간반장","통행금지 담당","중장갑 탱커","차단봉","방패 압착 굴착",["차단봉 진압","야간 순찰","방패 압착 굴착","전면 통행금지"],{maxHp:1700,armor:42,moveSpeed:2.9,damage:86,attackInterval:1.05,range:1.25,critChance:.04,critMultiplier:1.7,vision:6,bodyRadius:.49,digPower:1},"/assets/characters/concepts/ai-robot-playable-roster-concept-v1.png"),
 hero("r486","ai","R-486 땜빵","출장 수리 접수기","수리 지원가","영수증 볼트","배관 탐색",["덕트테이프 처방","용접 불꽃","배관 탐색","긴급 A/S"],{maxHp:900,armor:18,moveSpeed:3.5,damage:38,attackInterval:.85,range:4.8,critChance:.05,critMultiplier:1.55,vision:7.5,bodyRadius:.34,digPower:1},"/assets/characters/concepts/ai-robot-playable-roster-concept-v1.png"),
 hero("c999","ai","C-999 국장","폐청사의 최종 결재권자","원거리 지휘","결재선 레이저","도면 재승인",["결재 반려","부서 이동","도면 재승인","전면 감사"],{maxHp:950,armor:16,moveSpeed:3.2,damage:58,attackInterval:1,range:5.6,critChance:.06,critMultiplier:1.65,vision:8.5,bodyRadius:.36,digPower:1},"/assets/characters/concepts/ai-robot-playable-roster-concept-v1.png"),
];

const minion=(faction:FactionId,role:MinionRole,name:string,maxHp:number,armor:number,moveSpeed:number,damage:number,attackInterval:number,range:number,critChance:number,critMultiplier:number,shieldDamage:number,colors:MinionDefinition["colors"]):MinionDefinition=>({id:`${faction}-${role}`,faction,role,name,stats:{maxHp,armor,moveSpeed,damage,attackInterval,range,critChance,critMultiplier,vision:role==="shooter"||role==="elite"?5:4,bodyRadius:role==="elite"?.4:.28,digPower:0},shieldDamage,colors});

export const MINIONS:MinionDefinition[]=[
 minion("human","breaker","착암 아저씨",85,8,1.45,8,1.1,.9,.05,1.5,22,{body:"#3f8e98",accent:"#e2b84f",dark:"#273336"}),
 minion("human","escort","문짝 경비",125,18,1.3,13,1.15,.9,.07,1.5,4,{body:"#50727a",accent:"#b8794e",dark:"#283234"}),
 minion("human","shooter","새총 예비군",60,4,1.4,10,.95,4.2,.1,1.5,2,{body:"#397f89",accent:"#d1a66a",dark:"#263133"}),
 minion("human","elite","폐가전 중화기병",250,20,1.2,28,1.6,3.2,.08,1.6,12,{body:"#456f75",accent:"#efb94d",dark:"#222d30"}),
 minion("bugborn","breaker","턱파쇄충",75,5,1.67,6,1.08,.9,.08,1.35,18,{body:"#745845",accent:"#a9c95c",dark:"#352b2a"}),
 minion("bugborn","escort","갑각말이충",110,14,1.5,10,1.12,.9,.1,1.35,3,{body:"#67515e",accent:"#c1b06a",dark:"#302730"}),
 minion("bugborn","shooter","독침배충",53,2,1.61,8,.95,4,.12,1.35,2,{body:"#6b6d45",accent:"#b7dd55",dark:"#303428"}),
 minion("bugborn","elite","군체 포식장",210,16,1.45,22,1.25,1.15,.1,1.45,14,{body:"#6d4038",accent:"#c5d85a",dark:"#2e2525"}),
 minion("ai","breaker","천공 404",94,13,1.22,10,1.25,1,.04,1.6,27,{body:"#67645e",accent:"#e58a43",dark:"#303234"}),
 minion("ai","escort","차폐 02",138,24,1.09,17,1.3,1,.05,1.6,5,{body:"#5a6263",accent:"#d65f43",dark:"#292d2f"}),
 minion("ai","shooter","볼트 사수",66,9,1.18,13,1.1,4.5,.06,1.6,3,{body:"#626b6c",accent:"#55c7c8",dark:"#282d30"}),
 minion("ai","elite","철거 집행기 808",285,28,.95,35,2,4.5,.05,1.7,16,{body:"#5d6061",accent:"#e46f43",dark:"#25292a"}),
];

const build=(id:string,faction:FactionId,category:BuildableDefinition["category"],name:string,short:string,cost:number,hp:number,range:number,cooldown:number,damage:number,targets:number,critChance:number,critMultiplier:number,drillDurability:number,asset?:string,options:Pick<BuildableDefinition,"supportAura"|"control">={}):BuildableDefinition=>({id,faction,category,name,short,cost,hp,range,cooldown,damage,targets,critChance,critMultiplier,drillDurability,asset,...options});

export const BUILDABLES:BuildableDefinition[]=[
 build("rockBunker","human","multi","돌멩이 민방위 벙커","돌벙커",110,150,3,1500,8,3,.06,1.5,0,"/assets/buildables/human/human-rock-bunker-v1-alpha.png"),
 build("canMissile","human","ranged","깡통미사일 포대","캔포대",150,135,6,750,14,1,.08,1.5,0,"/assets/buildables/human/human-can-missile-v1-alpha.png"),
 build("highVoltageTrap","human","multi","고압 폐전기 함정","감전함정",135,120,3.8,1400,6,3,.05,1.4,0,"/assets/buildables/human/human-high-voltage-trap-v1-alpha.png",{control:{kind:"shock",stunMs:380}}),
 build("brickWall","human","blocker","5겹 방어벽돌","5겹벽",55,220,0,0,0,0,0,1.5,5,"/assets/buildables/human/human-five-layer-wall-v2-alpha.png"),
 build("humanSupply","human","support","출정 보급소","보급소",125,130,0,0,0,0,0,1.5,0,"/assets/buildables/human/human-departure-supply-v1-alpha.png",{supportAura:{kind:"attack",value:.08,upgradedValue:.12}}),
 build("rootAmbusher","bugborn","multi","뿌리매복체","뿌리매복",90,125,2.5,400,3,4,.08,1.35,0,"/assets/buildables/bugborn/bugborn-root-ambusher-v1-alpha.png"),
 build("venomTree","bugborn","ranged","독침나무","독침나무",145,100,5.3,950,7,3,.08,1.35,0,"/assets/buildables/bugborn/bugborn-venom-tree-v1-alpha.png"),
 build("acidSporeSac","bugborn","ranged","산성 포자낭","산성포자",130,105,4.8,1900,5,1,.08,1.35,0,"/assets/buildables/bugborn/bugborn-acid-spore-sac-v1-alpha.png",{control:{kind:"acid",splash:1.15,fieldDurationMs:2200,fieldDamage:2}}),
 build("boneWall","bugborn","blocker","잡뼈 방벽","잡뼈벽",40,165,0,0,0,0,0,1.35,4,"/assets/buildables/bugborn/bugborn-bone-wall-v1-alpha.png"),
 build("pheromoneGuide","bugborn","support","페로몬 유도탑","유도탑",115,115,0,0,0,0,0,1.35,0,"/assets/buildables/bugborn/bugborn-pheromone-guide-v1-alpha.png",{supportAura:{kind:"speed",value:.08,upgradedValue:.12}}),
 build("laserL1","ai","ranged","직선광선기 L-1","광선기",165,175,7,2100,18,8,.04,1.6,0,"/assets/buildables/ai/ai-laser-l1-v1-alpha.png"),
 build("missileM2","ai","ranged","쌍발미사일기 M-2","쌍발 M-2",245,150,7.5,4200,42,2,.04,1.6,0,"/assets/buildables/ai/ai-missile-m2-v1-alpha.png"),
 build("restraintT3","ai","ranged","구속 전극기 T-3","구속 T-3",190,160,5.5,1800,9,2,.04,1.6,0,"/assets/buildables/ai/ai-restraint-electrode-t3-v1-alpha.png",{control:{kind:"tether",stunMs:600}}),
 build("armorWallA6","ai","blocker","철갑격벽 A-6","철갑벽",75,280,0,0,0,0,0,1.6,6,"/assets/buildables/ai/ai-armor-wall-a6-v1-alpha.png"),
 build("targetRelay","ai","support","표적 중계기","중계기",145,150,0,0,0,0,0,1.6,0,"/assets/buildables/ai/ai-target-relay-v1-alpha.png",{supportAura:{kind:"range",value:.5,upgradedValue:.75}}),
];

export const supportAuraValue=(aura:SupportAura|undefined,level:number)=>aura?(level>=2?aura.upgradedValue:aura.value):0;
export const supportAuraAppliesToRole=(aura:SupportAura|undefined,role:MinionRole|undefined)=>Boolean(aura&&role&&(aura.kind!=="range"||role==="shooter"||role==="elite"));

export type MinionLevel = 1 | 2 | 3 | 4 | 5;

export const MINION_LEVELS=[
 {level:1,hp:1,damage:1,speed:1,critBonus:0},
 {level:2,hp:1.15,damage:1.1,speed:1.02,critBonus:.01},
 {level:3,hp:1.32,damage:1.22,speed:1.05,critBonus:.02},
 {level:4,hp:1.52,damage:1.37,speed:1.08,critBonus:.03},
 {level:5,hp:1.75,damage:1.55,speed:1.12,critBonus:.04},
] as const;

export const minionLevelForWave = (wave: number): MinionLevel =>
 wave >= 31 ? 5 : wave >= 23 ? 4 : wave >= 15 ? 3 : wave >= 7 ? 2 : 1;

export const HERO_LEVELS=[
 {level:1,xp:0,hp:1,damage:1,armor:0,ultimateCooldown:1},
 {level:2,xp:140,hp:1.05,damage:1.04,armor:0,ultimateCooldown:1},
 {level:3,xp:340,hp:1.1,damage:1.04,armor:2,ultimateCooldown:1},
 {level:4,xp:620,hp:1.15,damage:1.08,armor:2,ultimateCooldown:1},
 {level:5,xp:980,hp:1.2,damage:1.08,armor:4,ultimateCooldown:1},
 {level:6,xp:1420,hp:1.24,damage:1.14,armor:4,ultimateCooldown:.94},
 {level:7,xp:1960,hp:1.29,damage:1.18,armor:6,ultimateCooldown:.94},
 {level:8,xp:2600,hp:1.34,damage:1.22,armor:6,ultimateCooldown:.9},
 {level:9,xp:3340,hp:1.4,damage:1.28,armor:8,ultimateCooldown:.86},
] as const;

export const YOO_TALENTS={
 level3:[{id:"plastic-typhoon",name:"플라스틱 태풍",description:"회오리 반경 +20% · 피해 +10%"},{id:"foot-motor",name:"발에 모터 달았냐",description:"돌격 거리 +1칸 · 회복 -25%"}],
 level5:[{id:"used-like-new",name:"중고인데 새것 같음",description:"파란 드릴 쿨다운 -25% · 방어 +10"},{id:"slash-delivery",name:"참격 배송 완료",description:"첫 일반 유닛 관통"}],
} as const;

export const minionDefinition=(faction:FactionId,role:MinionRole)=>MINIONS.find(unit=>unit.faction===faction&&unit.role===role)!;
export const factionBuildables=(faction:FactionId)=>BUILDABLES.filter(buildable=>buildable.faction===faction);
