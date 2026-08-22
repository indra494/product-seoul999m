import { readFile } from "node:fs/promises";
import path from "node:path";

const expected = [
  "지상은 죽었다.",
  "하늘은 독성 먼지로 뒤덮였고, 인류는 더 이상 그곳에서 숨을 쉴 수 없었다.",
  "살아남은 사람들은 땅속으로 내려갔다.",
  "지하 999미터. 과거에 건설된 공기 정화층이 아직 작동하는, 생존 가능 구역이었다.",
  "서울도 그곳에 새로운 도시를 세웠다.",
  "각 도시의 연구자들은 언젠가 지상을 되살리기 위한 연구를 계속했다.",
  "우리는 서울의 ‘두더지’ 대원이라고 불린다.",
  "땅을 파고, 자원을 찾고, 새로운 도시로 향하는 길을 만드는 사람.",
  "오늘도 평범한 굴착 작업이어야 했다.",
  "우리가 먼저 이곳에 온 것이 아니라는 사실을 발견하기 전까지는."
];
const html = await readFile(path.join(import.meta.dirname, "opening-v10-render.html"), "utf8");
const archiveBlock = html.match(/const archive=\[([\s\S]*?)\];/);
if (!archiveBlock) throw new Error("Could not find the v10 archive array.");
const actual = [...archiveBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
if (actual.length !== expected.length || actual.some((line, index) => line !== expected[index])) {
  throw new Error("Opening v10 archive text differs from the approved 10 sentences.");
}
console.log(`Opening v10 archive text: ${actual.length}/${expected.length} exact match`);
