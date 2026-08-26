import asyncio
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parents[1]
EDGE_TTS_ROOT = PROJECT_ROOT / ".tools" / "edge-tts"
sys.path.insert(0, str(EDGE_TTS_ROOT))

import edge_tts

OUTPUT_ROOT = WORKSPACE_ROOT / "5. 오픈" / "영상" / "audio"
VOICE = "ko-KR-SunHiNeural"
TEXT = (
    "독성 먼지로 지상이 폐쇄된 미래. "
    "인류는 공기 정화층이 작동하는 지하 구백구십구 미터에 도시를 세웠습니다. "
    "서울 지하 구백구십구 미터는 직접 땅굴을 파고, 그 길로 부대를 보내 "
    "적 거점을 파괴하는 실시간 전략 액션 게임입니다."
)


async def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    media_path = OUTPUT_ROOT / "demo-intro-narration.mp3"
    subtitle_path = OUTPUT_ROOT / "demo-intro-narration.vtt"
    communicate = edge_tts.Communicate(
        text=TEXT,
        voice=VOICE,
        rate="+35%",
        volume="+0%",
        pitch="-2Hz",
        boundary="WordBoundary",
    )
    await communicate.save(str(media_path), str(subtitle_path))
    metadata = {
        "engine": "Microsoft Edge Neural TTS",
        "voice": VOICE,
        "rate": "+35%",
        "pitch": "-2Hz",
        "text": TEXT,
        "media": str(media_path),
        "subtitle": str(subtitle_path),
        "bytes": media_path.stat().st_size,
    }
    (OUTPUT_ROOT / "demo-intro-narration.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
