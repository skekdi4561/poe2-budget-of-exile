// 메인 프로세스 문구(트레이·관리자 권한 안내창)는 app_i18n 을 못 읽어 코드에 표로 둔다.
// 예전엔 트레이가 ko/en 둘뿐이라 다른 8개 언어 사용자는 영어 트레이를 봤고, 오버레이 연결
// 알림에는 한국어 문장이 모든 언어에 박혀 있었다(2026-09-24 다국어 점검). 언어가 늘거나
// 표에서 하나가 빠지면 여기서 잡는다.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../public/data");
const langs = readdirSync(dataDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((d) => readdirSync(resolve(dataDir, d)).includes("app_i18n.json"));
const src = (p: string) => readFileSync(resolve(here, "../..", p), "utf-8");

// `const NAME = {` 부터 첫 `\n};` 까지 — 그 안의 최상위 키(두 칸 들여쓰기) 목록
function tableKeys(file: string, name: string): string[] {
  const s = src(file);
  const start = s.indexOf(`const ${name}`);
  expect(start).toBeGreaterThan(-1);
  const body = s.slice(start, s.indexOf("\n};", start));
  return [...body.matchAll(/^ {2}"?([\w-]+)"?: \{/gm)].map((m) => m[1]);
}

describe("메인 프로세스 문구가 앱의 모든 언어에 있다", () => {
  it("언어 폴더가 10개 다 잡힌다", () => {
    expect(langs.length).toBeGreaterThanOrEqual(10);
  });

  it("트레이 메뉴(TRAY_TEXT)", () => {
    const keys = tableKeys("main/src/AppTray.ts", "TRAY_TEXT");
    expect(langs.filter((l) => !keys.includes(l))).toEqual([]);
  });

  it("관리자 권한 안내창(NO_ACCESS)", () => {
    const keys = tableKeys("main/src/windowing/OverlayWindow.ts", "NO_ACCESS");
    expect(langs.filter((l) => !keys.includes(l))).toEqual([]);
  });

  it("오버레이 연결 알림에 한글 문장이 박혀 있지 않다", () => {
    const leaked = src("renderer/src/web/overlay/LoadingAnimation.vue")
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter((l) => /[가-힣]/.test(l) && !/^(\*|\/\*|<!--)/.test(l));
    expect(leaked).toEqual([]);
  });

  it("알림 단축키 이름(attach_hint)이 모든 언어에 있다", () => {
    for (const l of langs) {
      const h = JSON.parse(
        readFileSync(resolve(dataDir, l, "app_i18n.json"), "utf-8"),
      ).attach_hint;
      expect(
        `${l}: ${h?.price && h?.curve && h?.settings ? "ok" : "빠짐"}`,
      ).toBe(`${l}: ok`);
    }
  });
});
