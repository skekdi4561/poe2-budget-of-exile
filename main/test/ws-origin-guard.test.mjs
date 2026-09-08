// server.ts 의 IPC WebSocket 방어 회귀 가드:
//  A) CSWSH: 악성 웹페이지가 ws://127.0.0.1:port/events 로 붙는 걸 Origin 검증으로 차단하되,
//     로컬 서버(127.0.0.1:port)에서 붙는 렌더러는 절대 안 끊어야 한다(안 그러면 IPC 전체가 죽는다).
//  B) 견고성: 비-JSON WS 프레임이 JSON.parse 예외로 전역 uncaughtException 을 내면 안 된다.
// main 에 테스트 러너가 없어 node 로 직접 돈다:  node main/test/ws-origin-guard.test.mjs
// (server.ts 의 isAllowedWsOrigin / message 핸들러 로직을 미러 — 그쪽을 고치면 여기도 맞출 것.)
import assert from "node:assert";

// isAllowedWsOrigin 미러
function isAllowedWsOrigin(origin) {
  if (!origin) return true;
  let host;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]"
  );
}

// --- A) 렌더러의 정당한 연결은 절대 안 끊긴다 (window.location.host = 로컬 서버) ---
for (const ok of [
  "http://127.0.0.1:8584", // 패키지 앱: 렌더러가 로컬 서버에서 로드됨
  "http://127.0.0.1:51234", // 랜덤 포트(port=0)
  "http://localhost:5173", // dev: vite 프록시 경유(Origin 은 localhost)
  "http://[::1]:8584", // IPv6 loopback
  undefined, // 네이티브 클라이언트(Origin 없음) — CSWSH 벡터 아님
]) {
  assert.strictEqual(
    isAllowedWsOrigin(ok),
    true,
    `정당한 오리진을 끊음: ${ok}`,
  );
}

// --- A) 외부 웹페이지는 차단 (브라우저가 Origin 을 붙이고 페이지가 못 위조) ---
for (const bad of [
  "https://evil.com",
  "http://attacker.example:1234",
  "https://poe.trade", // 합법 사이트라도 우리 IPC 엔 접근 불가여야 함
  "http://127.0.0.1.evil.com", // 서브도메인 트릭 — hostname 은 127.0.0.1.evil.com
  "null", // URL 파싱 실패 → 거부
  "not a url",
]) {
  assert.strictEqual(
    isAllowedWsOrigin(bad),
    false,
    `외부 오리진을 통과시킴: ${bad}`,
  );
}

// --- B) message 핸들러: 비-JSON 프레임은 던지지 않고 조용히 버린다 ---
function handleMessage(bytesStr, emit) {
  let event;
  try {
    event = JSON.parse(bytesStr);
  } catch {
    return;
  }
  if (!event || typeof event.name !== "string") return;
  emit(event.name, event.payload);
}
let emitted = [];
const emit = (n, p) => emitted.push([n, p]);
assert.doesNotThrow(
  () => handleMessage("네트워크쓰레기{{{", emit),
  "비-JSON 이 throw",
);
assert.doesNotThrow(() => handleMessage("123", emit), "숫자 JSON 이 throw");
assert.doesNotThrow(() => handleMessage("null", emit), "null JSON 이 throw");
assert.doesNotThrow(
  () => handleMessage('{"payload":1}', emit),
  "이름 없는 이벤트가 throw",
);
assert.strictEqual(emitted.length, 0, "잘못된 프레임이 이벤트를 냄");
handleMessage(
  '{"name":"CLIENT->MAIN::used-recently","payload":{"isOverlay":true}}',
  emit,
);
assert.strictEqual(emitted.length, 1, "정상 이벤트가 안 나감");
assert.strictEqual(emitted[0][0], "CLIENT->MAIN::used-recently");

console.log("ws-origin-guard self-test PASS");
