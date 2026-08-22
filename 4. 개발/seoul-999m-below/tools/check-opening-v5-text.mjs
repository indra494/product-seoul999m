import { readFile } from "node:fs/promises";

const rendererPath = new URL("./opening-v5-render.html", import.meta.url);
const source = await readFile(rendererPath, "utf8");
const archiveMatch = source.match(/const archive=\[([\s\S]*?)\];/);
if (!archiveMatch) throw new Error("v5 archive block was not found.");
const actual = [...archiveMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const expected = [
  "지상은 죽었다.",
  "하늘은 독성 먼지로 뒤덮였고, 인류는 더 이상 그곳에서 숨을 쉴 수 없었다.",
  "살아남은 사람들은 땅속으로 내려갔다.",
  "지하 999미터. 과거에 건설된 공기 정화층이 아직 작동하는, 마지막 생존 가능 구역이었다.",
  "서울도 그곳에 새로운 도시를 세웠다.",
  "전력망과 공장, 통신망은 무너졌고 사람들은 버려진 기계와 고철을 이어 붙이며 문명을 다시 시작했다.",
  "세계의 지하 도시들은 비밀 터널로 연결되었다.",
  "자원과 연구 자료가 오갔고, 각 도시의 연구자들은 언젠가 지상을 되살리기 위한 연구를 계속했다.",
  "하지만 터널을 통해 오간 것은 희망만이 아니었다.",
  "부족한 자원, 정체불명의 생물, 그리고 주인을 잃은 기계들이 도시 사이의 어둠을 차지하기 시작했다.",
  "우리는 서울의 ‘두더지’ 대원이라고 불린다.",
  "땅을 파고, 자원을 찾고, 새로운 도시로 향하는 길을 만드는 사람.",
  "오늘도 평범한 굴착 작업이어야 했다.",
  "우리가 먼저 이곳에 온 것이 아니라는 사실을 발견하기 전까지는.",
];

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Opening v5 archive text mismatch: expected ${expected.length} sentences, received ${actual.length}.`);
}
console.log("Opening v5 archive text: 14/14 exact match");
