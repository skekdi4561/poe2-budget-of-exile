// GameLogWatcher.readToEOF 의 64KB 버퍼-경계 라인/멀티바이트 쪼갬 버그 회귀 가드.
// main 에는 테스트 러너가 없으므로 node 로 직접 돈다:  node main/test/game-log-reassemble.test.mjs
// (src/host-files/GameLogWatcher.ts 의 carry 알고리즘을 그대로 미러 — 그쪽을 고치면 여기도 맞출 것.)
//
// 버그: 청크(실제 64KB) 경계에 로그 라인이나 멀티바이트 문자(한글=3바이트)가 걸리면
//       구현이 toString+split 을 청크마다 해서 라인이 반토막 나거나 문자가 �로 깨졌다.
//       특히 re-parse-log(offset=0, 전체 파일)에서 경계마다 반복 발생.
// 수정: \n(0x0A, ASCII 라 UTF-8 연속바이트 안에 절대 안 나타남) 까지만 디코드하고,
//       그 뒤 미완성 바이트를 carry 로 이월 → 라인·문자 둘 다 경계에서 안 잘린다.
import assert from "node:assert";

// GameLogWatcher.readToEOF 의 핵심 로직 미러
function drain(fullBuf, chunkSize) {
  let carry = Buffer.alloc(0),
    offset = 0;
  const out = [];
  while (offset < fullBuf.length) {
    const chunk = fullBuf.subarray(offset, offset + chunkSize);
    offset += chunk.length;
    const combined = Buffer.concat([carry, chunk]);
    let cut = combined.lastIndexOf(0x0a);
    if (cut < 0 && combined.length > 1 << 20) cut = combined.length - 1;
    if (cut >= 0) {
      out.push(
        ...combined
          .toString("utf8", 0, cut + 1)
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length),
      );
      carry = Buffer.from(combined.subarray(cut + 1));
    } else {
      carry = combined;
    }
  }
  return out; // EOF 의 미완성 꼬리는 의도적으로 미방출(다음 쓰기 때 완성됨)
}

const src =
  [
    "2024/01/01 00:00:00 123 abc [Info] 리버뱅크에 진입했습니다",
    "2024/01/01 00:00:01 124 abc [Info] You have entered 무너진 신전",
    "2024/01/01 00:00:02 125 abc [Info] 캐릭터가 레벨 42 로 상승했습니다",
    "2024/01/01 00:00:03 126 abc [Info] short",
  ].join("\n") + "\n";
const buf = Buffer.from(src, "utf8");
const expected = src
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length);

// 3~8바이트: 한글(3바이트) 문자 중간에서 끊기는 크기 포함. 64/거대: 정상 경로.
for (const cs of [3, 4, 5, 7, 8, 13, 64, 100000]) {
  const got = drain(buf, cs);
  assert.deepStrictEqual(got, expected, `chunk=${cs} 재조립 불일치`);
  assert.ok(
    !got.join("|").includes("�"),
    `chunk=${cs} 에서 멀티바이트 문자 깨짐(�)`,
  );
}

// 개행 없는 초장문(비정상)이라도 1MB 상한에서 흘려보내 OOM/무한 carry 를 막는다.
const huge = Buffer.from("x".repeat((1 << 20) + 5), "utf8");
assert.strictEqual(drain(huge, 64 * 1024).length, 1, "1MB 상한 방출 안 됨");

console.log("game-log-reassemble self-test PASS");
