import asyncio
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parents[1]
EDGE_TTS_ROOT = PROJECT_ROOT / ".tools" / "edge-tts"
sys.path.insert(0, str(EDGE_TTS_ROOT))

import edge_tts

OUTPUT_ROOT = WORKSPACE_ROOT / "5. 오픈" / "영상" / "audio" / "v2"
VOICE = "ko-KR-SunHiNeural"
CUES = [
    ("intro", 0, "오염된 지상을 피해, 인류는 지하 구백구십구 미터에 새로운 서울을 세웠습니다. 서울 지하 구백구십구 미터는 직접 땅굴을 파고, 그 길로 부대를 진격시켜 적 거점을 파괴하는 실시간 전략 액션 게임입니다."),
    ("prep", 21, "전투는 삼십 초의 준비 단계에서 시작됩니다. 제한된 시간 동안 직접 땅을 파 공격 경로를 설계합니다."),
    ("advance", 34, "준비가 끝나면 거점 공격이 시작되고, 부대는 플레이어가 만든 터널을 따라 자동으로 진격합니다."),
    ("battle", 52, "영웅을 직접 조작하고 부대와 시설을 운용해 전선을 밀어붙입니다. 상황에 따라 공격 경로와 다음 병력 배분도 바꿀 수 있습니다."),
    ("victory", 79, "상대의 방어선을 돌파해 거점 코어를 파괴하면 승리합니다."),
    ("heroes", 107, "서로 다른 지휘관은 각자의 기술과 전투 방식으로 전장의 흐름을 바꿉니다."),
    ("campaign", 121, "캠페인에서는 서울 지하의 구역을 순서대로 공략합니다. 임무를 선택하고 전투를 완수하며 게임의 세계관을 경험할 수 있습니다."),
    ("online", 154, "방 코드를 이용하면 다른 플레이어와 온라인 일대일 대전을 즐길 수 있습니다."),
    ("ending", 169, "지금, 서울 지하 구백구십구 미터로 내려오십시오."),
]


async def generate(stem: str, start: int, text: str) -> dict:
    media = OUTPUT_ROOT / f"{stem}.mp3"
    subtitle = OUTPUT_ROOT / f"{stem}.vtt"
    communicate = edge_tts.Communicate(
        text=text,
        voice=VOICE,
        rate="+32%",
        volume="+0%",
        pitch="-2Hz",
        boundary="WordBoundary",
    )
    await communicate.save(str(media), str(subtitle))
    return {"stem": stem, "start": start, "text": text, "media": str(media), "subtitle": str(subtitle), "bytes": media.stat().st_size}


async def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    cues = await asyncio.gather(*(generate(*cue) for cue in CUES))
    metadata = {"engine": "Microsoft Edge Neural TTS", "voice": VOICE, "rate": "+32%", "pitch": "-2Hz", "cues": cues}
    (OUTPUT_ROOT / "narration-v2.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
