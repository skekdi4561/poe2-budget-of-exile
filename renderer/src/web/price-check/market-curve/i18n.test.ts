// 위젯의 화면 문자열이 앱 언어 설정을 따라가는지 지킨다.
// vue-i18n 이 fallbackFormat 이라 키가 없으면 예외 대신 **키 이름 자체**가 화면에 찍힌다
// ("market_curve.frontier" 같은 글자). 그래서 오타는 조용히 배포까지 나간다 — 여기서 잡는다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vue = readFileSync(resolve(here, "WidgetMarketCurve.vue"), "utf-8");
const load = (lang: string) =>
  JSON.parse(
    readFileSync(
      resolve(here, `../../../../public/data/${lang}/app_i18n.json`),
      "utf-8",
    ),
  ).market_curve as Record<string, string>;

// t(":key") 와 t(":" + x.key) 두 형태를 쓴다. 뒤엣것은 배열 리터럴의 key 값에서 모은다.
const used = new Set<string>();
for (const m of vue.matchAll(/t\("\s*:([a-z0-9_]+)"/g)) used.add(m[1]);
for (const m of vue.matchAll(/\bkey:\s*"([a-z0-9_]+)"/g)) used.add(m[1]);

describe("위젯 다국어", () => {
  it("쓰는 키가 실제로 있다(ko/en 둘 다)", () => {
    expect(used.size).toBeGreaterThan(30); // 추출이 통째로 실패하면 여기서 걸린다
    for (const lang of ["ko", "en"]) {
      const msgs = load(lang);
      const missing = [...used].filter((k) => !msgs[k]);
      expect(`${lang}: ${missing.join(", ")}`).toBe(`${lang}: `);
    }
  });

  it("ko 와 en 의 키 집합이 같다", () => {
    const ko = Object.keys(load("ko")).sort();
    const en = Object.keys(load("en")).sort();
    expect(ko).toEqual(en);
  });

  it("치환 자리({w},{n},{d} 등)가 두 언어에서 같다", () => {
    const ko = load("ko");
    const en = load("en");
    const slots = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(ko)) {
      expect(`${k}:${slots(en[k]).join(",")}`).toBe(
        `${k}:${slots(ko[k]).join(",")}`,
      );
    }
  });

  it("화면에 나갈 문자열이 위젯에 하드코딩돼 있지 않다", () => {
    // 주석(//, *, <!--)을 뺀 줄에 한글이 남아 있으면 그건 번역 안 된 UI 문자열이다.
    const leaked = vue
      .split(/\r?\n/)
      .map((l, i) => [i + 1, l.trim()] as const)
      .filter(([, s]) => /[가-힣]/.test(s) && !/^(\/\/|\*|\/\*|<!--)/.test(s))
      // 줄 끝 주석(코드 뒤 // …)은 화면에 안 나간다
      .filter(([, s]) => /[가-힣]/.test(s.replace(/\/\/.*$/, "")));
    expect(leaked.map(([n, s]) => `${n}: ${s}`)).toEqual([]);
  });
});
