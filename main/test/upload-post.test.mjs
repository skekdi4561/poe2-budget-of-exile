// file-uploads.ts POST 핸들러 회귀 가드:
//  ① 확장자를 raw req.url 에서 뽑으면 쿼리스트링(?v=1)이 파일명에 섞여 '?' 가 들어가고,
//     Windows 에서 writeFileSync 가 ENOENT 로 던져 응답이 매달렸다 → 파싱된 pathname 사용.
//  ② mkdirSync/writeFileSync 무try/catch → 쓰기 실패가 전역 uncaughtException + 응답 매달림
//     → try/catch 로 감싸 500 으로 닫는다.
// main 에 테스트 러너가 없어 node 로 직접 돈다:  node main/test/upload-post.test.mjs
// (file-uploads.ts POST 핸들러 로직을 실제 fs/http 로 미러 — 그쪽을 고치면 여기도 맞출 것.)
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert";

const uploadsPath = fs.mkdtempSync(path.join(os.tmpdir(), "upl-"));

function onPost(req, res) {
  if (req.method !== "POST" || !req.url?.startsWith("/uploads/")) return;
  let contents = Buffer.alloc(0);
  req.on("data", (c) => {
    if (contents.length > 16_000_000) return req.destroy();
    contents = Buffer.concat([contents, c]);
  });
  req.once("end", () => {
    const hash = crypto.createHash("md5").update(contents).digest("hex");
    const ext = path.extname(new URL(req.url, "http://localhost").pathname); // 쿼리 제거
    const filename = `${hash}${ext}`;
    try {
      fs.mkdirSync(uploadsPath, { recursive: true });
      fs.writeFileSync(path.join(uploadsPath, filename), contents);
    } catch {
      res.statusCode = 500;
      res.end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ name: filename }));
  });
}

function post(port, url, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, path: url, method: "POST" }, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => resolve({ status: res.statusCode, body: b }));
    });
    req.on("error", reject);
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error(`응답 매달림(타임아웃): ${url}`));
    });
    req.end(body);
  });
}

const server = http.createServer(onPost);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

let failed = false;
try {
  // ① 쿼리스트링 든 URL — 예전엔 여기서 매달렸다
  const q = await post(port, "/uploads/shot.png?v=1&x=2", "PNGDATA");
  assert.strictEqual(q.status, 200, "쿼리스트링 POST 가 200 아님(매달림?)");
  const name = JSON.parse(q.body).name;
  assert.ok(name.endsWith(".png"), `확장자에 쿼리가 샘: ${name}`);
  assert.ok(!name.includes("?"), `파일명에 ? 침입: ${name}`);
  assert.ok(fs.existsSync(path.join(uploadsPath, name)), "파일이 안 써짐");

  // 정상 POST
  const n = await post(port, "/uploads/y.png", "IMG");
  assert.strictEqual(n.status, 200);
  assert.ok(JSON.parse(n.body).name.endsWith(".png"));

  // 같은 내용은 같은 md5 → 같은 파일명(내용 주소화)
  const dup = await post(port, "/uploads/z.png", "IMG");
  assert.strictEqual(
    JSON.parse(dup.body).name,
    JSON.parse(n.body).name,
    "md5 주소화 깨짐",
  );

  console.log("upload-post self-test PASS");
} catch (e) {
  failed = true;
  console.error("FAIL:", e.message);
} finally {
  server.close();
  fs.rmSync(uploadsPath, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
