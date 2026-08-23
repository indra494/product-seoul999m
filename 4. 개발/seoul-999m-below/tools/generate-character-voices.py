"""Generate fixed Korean hero skill voices. Run from the project root with edge-tts on PYTHONPATH."""
import asyncio
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]

HEROES = {
    "yoo-seungcheon": ("ko-KR-HyunsuMultilingualNeural", "+12%", "-8Hz", [
        "회오리베기이!", "돌격! 찌르기!", "파란 드릴! 전개애!", "필살! 짝퉁! 초고속! 참겨어억!",
    ]),
    "kimssi": ("ko-KR-InJoonNeural", "-8%", "-22Hz", [
        "전자레인지로! 찍는다!", "전자레인지! 최고 출력이다!", "염력 굴착장! 간다!", "필살! 전자레인지에! 넣고! 돌린다아!",
    ]),
    "ahn-seona": ("ko-KR-SunHiNeural", "+15%", "+12Hz", [
        "분무기! 뿌립니다!", "응급 분사! 가만히 있어요!", "모세관 굴착! 갑니다!", "필살! 과다 투약! 들어갑니다아!",
    ]),
    "kang-ryeokhan": ("ko-KR-HyunsuMultilingualNeural", "-5%", "-28Hz", [
        "뚜껑 들고! 민다!", "모범 시민! 방어령!", "나만의! 안전구역!", "필살! 하수구 뚜껑! 날아간다아!",
    ]),
    "d09": ("ko-KR-InJoonNeural", "-14%", "-34Hz", [
        "규격 외 천공. 승인.", "궤도 전환. 집행.", "노선 직진. 개통.", "필살 프로토콜. 공사 기한. 준수.",
    ]),
    "g77": ("ko-KR-HyunsuMultilingualNeural", "-18%", "-42Hz", [
        "차단봉 진압.", "야간 순찰. 개시.", "방패 압착 굴착.", "필살 프로토콜. 전면 통행 금지.",
    ]),
    "r486": ("ko-KR-SunHiNeural", "+2%", "-18Hz", [
        "덕트테이프 처방.", "용접 불꽃. 주의.", "배관 탐색. 완료.", "필살 프로토콜. 긴급 에이 에스.",
    ]),
    "c999": ("ko-KR-InJoonNeural", "-22%", "-48Hz", [
        "결재 반려.", "부서 이동 명령.", "도면 재승인.", "필살 프로토콜. 전면 감사 집행.",
    ]),
}

async def generate(hero_id, slot, voice, rate, pitch, text, semaphore):
    target = ROOT / "public" / "assets" / "audio" / "voices" / hero_id / f"skill-{slot}.mp3"
    target.parent.mkdir(parents=True, exist_ok=True)
    async with semaphore:
        await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume="+10%").save(str(target))
    if target.stat().st_size < 1000:
        raise RuntimeError(f"Invalid voice output: {target}")
    print(f"{hero_id} skill-{slot}: {target.stat().st_size} bytes")

async def main():
    semaphore = asyncio.Semaphore(4)
    jobs = []
    for hero_id, (voice, rate, pitch, lines) in HEROES.items():
        for slot, text in enumerate(lines, 1):
            jobs.append(generate(hero_id, slot, voice, rate, pitch, text, semaphore))
    await asyncio.gather(*jobs)
    print(f"Generated {len(jobs)} fixed character voice files.")

if __name__ == "__main__":
    asyncio.run(main())
