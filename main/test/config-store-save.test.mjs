// ConfigStore.save 회귀 가드:
//  A) .tmp 래치 버그 — 손상 config 감지로 tmp=true 저장이 한 번 일어난 뒤, 사용자의
//     영구 저장(tmp=false)이 config.json 대신 config.json.tmp 로 새서 재시작 시 유실됐다.
//     이제 대상은 매 호출 tmp 로 결정 → 영구 저장은 항상 config.json(손상 자가치유).
//  B) 원자적 쓰기 — 쓰는 도중 죽어도 config.json 이 온전해야(부분/손상 방지) 다음 부팅이 산다.
// main 에 테스트 러너가 없어 node 로 직접 돈다:  node main/test/config-store-save.test.mjs
// (ConfigStore.save 의 대상선택+원자쓰기 로직을 실제 fs 로 미러 — 그쪽을 고치면 여기도 맞출 것.)
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cfgstore-"));
const cfgPath = path.join(dir, "config.json");

// ConfigStore.save 의 고쳐진 로직 미러
async function save(contents, tmp) {
  const target = tmp ? cfgPath + ".tmp" : cfgPath;
  await fs.mkdir(path.dirname(target), { recursive: true });
  const writing = target + ".writing";
  await fs.writeFile(writing, contents);
  await fs.rename(writing, target);
}

let failed = false;
try {
  // A) 손상 config 시나리오: 기본값 임시저장(tmp) → 사용자 설정 변경(영구) ×2
  await save('{"configVersion":35,"__":"defaults"}', true); // 폴백 → .tmp
  await save('{"configVersion":35,"fontSize":20}', false); // 사용자 영구 저장
  await save('{"configVersion":35,"fontSize":22}', false); // 또 영구 저장

  // 영구 저장은 config.json 으로 가야 한다(예전 버그는 .tmp 로 샜다)
  assert.ok(
    existsSync(cfgPath),
    "config.json 이 안 만들어짐(영구 저장이 .tmp 로 샘)",
  );
  const saved = JSON.parse(readFileSync(cfgPath, "utf8"));
  assert.strictEqual(
    saved.fontSize,
    22,
    "config.json 이 마지막 영구 저장을 반영 안 함",
  );
  assert.ok(
    !("__" in saved),
    "config.json 이 손상 폴백 기본값에 갇힘 — 자가치유 실패",
  );

  // 폴백 스크래치는 .tmp 에 남고 원본 자리를 안 침범
  assert.ok(existsSync(cfgPath + ".tmp"), ".tmp 폴백이 사라짐");

  // B) 원자성: 중간 산출물(.writing)이 남지 않아야(성공 시 rename 으로 소비됨)
  assert.ok(
    !existsSync(cfgPath + ".writing"),
    ".writing 임시 파일이 남음(원자 교체 실패)",
  );

  // 정상 경로(전부 영구): 항상 config.json, 완결된 JSON
  await save('{"configVersion":35,"ok":true}', false);
  assert.deepStrictEqual(JSON.parse(readFileSync(cfgPath, "utf8")), {
    configVersion: 35,
    ok: true,
  });

  console.log("config-store-save self-test PASS");
} catch (e) {
  failed = true;
  console.error("FAIL:", e.message);
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
