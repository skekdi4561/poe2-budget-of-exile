// 앱 이름은 언어마다 다르다 — 한국어는 "PoE2 시세 감정소", 그 외는 "PoE2 Budget of Exile".
// 예전엔 이름이 문자열마다 박혀 있어서 한 곳만 고치면 갈라졌다: 실제로 9개 언어 전부가
// 한글 이름을 그대로 달고 있었고(프랑스 사용자가 "Paramètres - PoE2 시세 감정소" 를 봤다),
// 중국어는 아예 원작 이름("流亡交易所 2")이 남아 있었다. 이제 app.name 한 곳에서 나온다.
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
const load = (lang: string) =>
  JSON.parse(
    readFileSync(resolve(dataDir, lang, "app_i18n.json"), "utf-8"),
  ) as Record<string, Record<string, string>>;

const EN = "PoE2 Budget of Exile";
const KO = "PoE2 시세 감정소";

describe("앱 이름", () => {
  it("언어 파일이 9개 다 잡힌다", () => {
    expect(langs.length).toBeGreaterThanOrEqual(9);
  });

  it("모든 언어에 app.name 이 있고, 한국어만 한글 이름이다", () => {
    for (const lang of langs) {
      const want = lang === "ko" ? KO : EN;
      expect(`${lang}: ${load(lang).app?.name}`).toBe(`${lang}: ${want}`);
    }
  });

  it("이름을 문자열에 박아 두지 않는다 — 다른 언어에 한글/원작 이름이 새면 안 된다", () => {
    // 한 언어 파일 안에서 그 언어의 이름 말고 다른 이름이 보이면 그게 곧 드리프트다.
    const leaked: string[] = [];
    for (const lang of langs) {
      const mine = lang === "ko" ? KO : EN;
      const others = [KO, EN, "流亡交易所", "Exiled Exchange"].filter(
        (n) => !mine.includes(n),
      );
      const walk = (o: unknown, path: string[]) => {
        // MIT 고지는 원작 이름을 밝히는 게 목적이다 — 유출이 아니다
        if (path.join(".") === "app.based_on") return;
        if (typeof o === "string") {
          for (const bad of others) {
            if (o.includes(bad))
              leaked.push(`${lang}:${path.join(".")} → ${o}`);
          }
        } else if (o && typeof o === "object") {
          for (const [k, v] of Object.entries(o)) walk(v, [...path, k]);
        }
      };
      walk(load(lang), []);
    }
    expect(leaked).toEqual([]);
  });

  it("설정 창 제목이 그 언어의 이름을 쓴다", () => {
    for (const lang of langs) {
      const want = lang === "ko" ? KO : EN;
      expect(`${lang}: ${load(lang).settings.title.endsWith(want)}`).toBe(
        `${lang}: true`,
      );
    }
  });

  it("패키징 이름과 앱 이름이 어긋나지 않는다", () => {
    // productName·설치 파일명은 지역화가 안 되므로 영어 정본이어야 한다.
    const yml = readFileSync(
      resolve(here, "../../main/electron-builder.yml"),
      "utf-8",
    );
    expect(yml).toContain(`productName: "${EN}"`);
    expect(yml).toContain("PoE2-BudgetOfExile-Setup-");
    // 포터블은 배포하지 않기로 했다 — 빌드가 계속 만들면 릴리스에 실수로 섞인다
    expect(yml).not.toContain("portable");
    const pkg = JSON.parse(
      readFileSync(resolve(here, "../../main/package.json"), "utf-8"),
    ) as { productName: string };
    expect(pkg.productName).toBe(EN);
    // appId 는 일부러 안 바꿨다 — 바꾸면 기존 사용자에게 두 번째 설치가 생긴다
    expect(yml).toContain('appId: "com.skekdi4561.poe2-sise"');
  });
});
