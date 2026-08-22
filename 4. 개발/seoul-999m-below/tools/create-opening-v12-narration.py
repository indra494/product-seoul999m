import asyncio
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parents[1]
EDGE_TTS_ROOT = PROJECT_ROOT / ".tools" / "edge-tts"
sys.path.insert(0, str(EDGE_TTS_ROOT))

import edge_tts

OUTPUT_ROOT = WORKSPACE_ROOT / "3. 설계" / "영상" / "프롤로그" / "v12" / "audio"
VOICE = "ko-KR-SunHiNeural"
NORMAL_TEXT = (
    "지상은 죽었다. "
    "하늘은 독성 먼지로 뒤덮였고, 인류는 더 이상 그곳에서 숨을 쉴 수 없었다. "
    "살아남은 사람들은 땅속으로 내려갔다. "
    "지하 구백구십구 미터. 과거에 건설된 공기 정화층이 아직 작동하는, 생존 가능 구역이었다. "
    "서울도 그곳에 새로운 도시를 세웠다."
)
NEXT_TEXT = "각 도시의 연구자들은 언젠가 지상을 되살리기 위한 연구를 계속했다."


async def generate(text: str, stem: str) -> dict:
    media_path = OUTPUT_ROOT / f"{stem}.mp3"
    subtitle_path = OUTPUT_ROOT / f"{stem}.vtt"
    communicate = edge_tts.Communicate(
        text=text,
        voice=VOICE,
        rate="+45%",
        volume="+0%",
        pitch="-2Hz",
        boundary="WordBoundary",
    )
    await communicate.save(str(media_path), str(subtitle_path))
    return {
        "text": text,
        "media": str(media_path),
        "subtitle": str(subtitle_path),
        "bytes": media_path.stat().st_size,
    }


async def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    normal, next_sentence = await asyncio.gather(
        generate(NORMAL_TEXT, "narration-normal-sunhi-neural"),
        generate(NEXT_TEXT, "narration-next-sunhi-neural"),
    )
    metadata = {
        "engine": "Microsoft Edge Neural TTS",
        "voice": VOICE,
        "rate": "+45%",
        "pitch": "-2Hz",
        "normal": normal,
        "next": next_sentence,
    }
    (OUTPUT_ROOT / "narration-neural-metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
