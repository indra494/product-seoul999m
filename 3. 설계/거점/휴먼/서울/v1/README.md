# 휴먼 서울 거점 콘셉트 v1

- 상태: `채택·게임 적용`
- 이미지: `human-seoul-base-concept-v1.png`
- 투명 게임 에셋 원본: `게임에셋/human-seoul-base-v1-alpha.png`
- 런타임 사본: `4. 개발/seoul-999m-below/public/assets/bases/human/seoul/human-seoul-base-v1-alpha.png`
- 생성 방식: Codex 내장 이미지 생성 도구
- 스타일 참고: 유승천 콘셉트 v3의 어두운 고밀도 도트 표현과 색상 대비
- 목적: 거점 실루엣, 생존 코어, 방어막, 출전구, 건설 패드와 피해 단계의 시각 방향 확인
- 콘셉트 시트는 직접 렌더링하지 않고 메인 건물을 분리한 투명 게임 에셋을 사용한다.

## 생성 프롬프트 요약

- 지하철 출입구, 방공호, 아파트 보일러 설비와 고철로 조립한 휴먼 생존 코어
- 청록 코어광, 적색 경고등, 녹슨 철판과 오염된 콘크리트
- 큰 탑다운 3/4 시점 본체와 방어막·중파·파괴 상태 비교
- 굴착대 출구와 모듈형 건설 패드 표현
- 어두운 지하 공포를 우선하고 생활 폐품의 허술함으로 B급 대비 형성

## 최종 생성 프롬프트

```text
Use case: stylized-concept
Asset type: 2D game base concept sheet for "서울 지하 999M"
Input images: Image 1 is a visual style and palette reference only; do not include the character.
Primary request: Design the Human faction's underground base named "서울", a desperate survival core built 999 meters below ruined Seoul.
Scene/backdrop: plain near-black concept-sheet background, isolated asset studies only.
Subject: a compact improvised underground fortress assembled from a broken Seoul subway entrance, corrugated steel, concrete blast doors, old apartment boiler tanks, ventilation ducts, patched cables, traffic barriers, mismatched household appliances, and a glowing cyan survival reactor. A crooked battered station sign displays the exact Korean text "서울" once. One low front tunnel gate visibly releases small excavation troops. Four clearly readable construction sockets surround the core for future turrets or barricades.
Style/medium: original polished late-1990s Korean PC action-RPG pixel art, matching Image 1's dark high-detail pixel clusters, silhouette clarity, restrained B-movie junk aesthetic, not photorealistic, not 3D.
Composition/framing: concept sheet with one large three-quarter top-down hero view plus smaller isolated studies showing shield active, shield broken, heavily damaged, and destroyed states. Keep every state fully visible and separated with generous margins. The in-game structure should read as roughly a 3x3 tile footprint from a high top-down camera.
Lighting/mood: oppressive underground horror, dim amber emergency bulbs, cold cyan core light, red warning lamp, soot and faint steam; serious first impression with cheap improvised construction as the joke.
Color palette: charcoal, dirty concrete gray, rust brown, faded Seoul-blue, cyan reactor glow, small red warning accents.
Materials/textures: chipped concrete, peeling paint, duct tape, exposed rebar, greasy ventilation fans, dented sheet metal, patched wiring.
Constraints: no people, no characters, no modern clean sci-fi, no fantasy castle, no skyline or outdoor Seoul landmarks, no UI frame, no watermark, no logos or trademarks, no extra text besides the exact single word "서울". Distinct readable damage stages; strong compact silhouette suitable for conversion into a game sprite.
```

## 투명 게임 에셋 추출 프롬프트

```text
Use case: background-extraction
Asset type: transparent 2D game structure sprite for the Human base "서울"
Input images: Image 1 is the edit target and approved design source.
Primary request: Extract and isolate only the single large intact Seoul survival-core fortress from the upper-left of Image 1 as one clean game sprite.
Subject: preserve the exact central fortress design, proportions, three-quarter top-down angle, cyan reactor, rusted machinery, concrete, pipes, front tunnel doorway, red warning beacon, and the battered blue sign with the exact Korean word "서울".
Composition/framing: one centered intact fortress, fully visible with generous transparent padding, symmetrical visual balance, suitable for scaling to about 180 pixels wide in a top-down game.
Constraints: genuinely transparent background with alpha; remove every other concept-sheet study, shield dome, damaged and destroyed variants, all detached circular construction pads, all small drill vehicles, smoke clouds, floor scenery, labels and UI. Do not redesign the fortress. Preserve the original pixel-art texture, lighting, colors, camera angle and silhouette. Keep only the word "서울" once on the existing sign. No added objects, no watermark, no black background, no halo, no cast shadow extending far outside the structure.
```
