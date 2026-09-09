// 위젯의 화면 문자열이 앱 언어 설정을 따라가는지 지킨다.
// vue-i18n 이 fallbackFormat 이라 키가 없으면 예외 대신 **키 이름 자체**가 화면에 찍힌다
// ("market_curve.frontier" 같은 글자). 그래서 오타는 조용히 배포까지 나간다 — 여기서 잡는다.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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

// 앱이 고를 수 있는 언어 전부. 빠진 언어는 fallbackLocale 이 en 이고 fallbackWarn 이 꺼져 있어
// **조용히 영어로** 나간다 — 그래서 여기서 세지 않으면 아무도 모른다.
// th 는 원작이 로케일 파일만 넣고 Config 의 language 유니온·설정 드롭다운에는 아직 없다.
// 고를 수 없는 언어라 화면에 안 나가지만, 키는 갖춰 두고 여기서 같이 지킨다.
const LANGS = [
  "en",
  "ko",
  "ru",
  "cmn-Hant",
  "ja",
  "de",
  "es",
  "pt",
  "fr",
  "th",
];

const slots = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("위젯 다국어", () => {
  it("쓰는 키가 모든 언어에 있다", () => {
    expect(used.size).toBeGreaterThan(30); // 추출이 통째로 실패하면 여기서 걸린다
    for (const lang of LANGS) {
      const msgs = load(lang);
      const missing = [...used].filter((k) => !msgs[k]);
      expect(`${lang}: ${missing.join(", ")}`).toBe(`${lang}: `);
    }
  });

  it("모든 언어의 키 집합이 en 과 같다", () => {
    const en = Object.keys(load("en")).sort();
    for (const lang of LANGS) {
      expect(`${lang}: ${Object.keys(load(lang)).sort().join(",")}`).toBe(
        `${lang}: ${en.join(",")}`,
      );
    }
  });

  it("치환 자리({w},{n},{d} 등)가 모든 언어에서 en 과 같다", () => {
    const en = load("en");
    for (const lang of LANGS) {
      const msgs = load(lang);
      for (const k of Object.keys(en)) {
        expect(`${lang}.${k}:${slots(msgs[k]).join(",")}`).toBe(
          `${lang}.${k}:${slots(en[k]).join(",")}`,
        );
      }
    }
  });

  it("vue-i18n 이 특수하게 읽는 문자가 없다", () => {
    // '|' 는 복수형 분기 구분자다 — "a | b" 는 예외 없이 **b 만** 렌더된다.
    // '@' 는 링크 메시지 문법이라 "Invalid linked format" 경고를 내고 깨진다.
    // 둘 다 조용히 실패하므로(missingWarn·fallbackWarn 이 꺼져 있다) 그물이 여기뿐이다.
    const bad: string[] = [];
    for (const lang of LANGS) {
      const msgs = load(lang);
      for (const [k, v] of Object.entries(msgs)) {
        if (v.includes("|") || v.includes("@")) bad.push(`${lang}.${k}: ${v}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("무기 분류명이 실제 게임 아이템 이름과 같다", () => {
    // item_category 는 못 믿는다 — PoE1 시절 이름이 남아 있다(모든 언어가 Warstaff 를
    // 달고 있었지만 PoE2 는 Quarterstaff 로 개명했다). 정본은 실제 베이스 아이템 이름이다.
    // 이름이 한 낱말로 모이는 분류만 검사한다. 철퇴·방패는 베이스 이름이 제각각이라
    // (Club/Mace/Hammer, Buckler/Tower Shield) 공유하는 낱말이 없어 이 방식이 안 통한다.
    const SINGLE: Record<string, string> = {
      weapon_bow: "Bow",
      weapon_crossbow: "Crossbow",
      weapon_spear: "Spear",
      weapon_warstaff: "Warstaff", // craftable.category 는 내부 키라 옛 이름 그대로다
      weapon_talisman: "Talisman",
    };
    for (const lang of LANGS) {
      const p = resolve(here, `../../../../public/data/${lang}/items.ndjson`);
      if (!existsSync(p)) continue; // th 는 원작이 아이템 데이터를 아직 안 넣었다
      const byCat = new Map<string, string[]>();
      for (const line of readFileSync(p, "utf-8").split("\n")) {
        if (!line.trim()) continue;
        const o = JSON.parse(line) as {
          name?: string;
          namespace?: string;
          craftable?: { category?: string };
        };
        const c = o.craftable?.category;
        if (c && o.name && o.namespace === "ITEM") {
          byCat.set(c, [...(byCat.get(c) ?? []), o.name]);
        }
      }
      const msgs = load(lang);
      for (const [key, cat] of Object.entries(SINGLE)) {
        const names = byCat.get(cat) ?? [];
        expect(`${lang}.${key} 베이스 수`).toBe(
          names.length > 10
            ? `${lang}.${key} 베이스 수`
            : `${lang}.${key}: ${names.length}종뿐`,
        );
        // "전부 포함"은 오탐이 난다 — ja/ko 는 베이스 이름이 한자·가타카나를 섞어 쓰고
        // (弓 vs コンポジットボウ), 분류에 안 어울리는 이름의 베이스도 있다(Trarthan Cannon).
        // 한 번이라도 나오는지만 본다. 그래도 낡은 이름은 0회라 확실히 걸린다
        // (ru 석궁 Арбалет 0/29, 모든 언어의 옛 Warstaff 0/36 이 이 검사로 잡혔다).
        const label = msgs[key].toLowerCase();
        const hit = names.filter((n) => n.toLowerCase().includes(label)).length;
        expect(
          `${lang}.${key} "${msgs[key]}" 를 쓰는 베이스 ${hit > 0 ? "있음" : "없음"}`,
        ).toBe(`${lang}.${key} "${msgs[key]}" 를 쓰는 베이스 있음`);
      }
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
