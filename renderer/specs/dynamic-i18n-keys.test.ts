// 코드가 변수로 만들어 t() 에 넘기는 키 — 리터럴 t("...") 가 아니라서 누락이 안 보인다.
// 어느 언어 파일에도 없으면 vue-i18n(fallbackFormat)이 키 이름을 그대로 화면에 찍는다.
// 실제로 숨김 사유 4개와 수정자 유형이 모든 언어에서 "hide_attr_same_2nd_n_3rd", "explicit"
// 처럼 떴다(2026-09-24 출시 전 리뷰). en 에만 있어도 다른 언어는 영어로 떨어지므로 en 을 본다.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const en = JSON.parse(
  readFileSync(resolve(here, "../public/data/en/app_i18n.json"), "utf-8"),
) as Record<string, unknown>;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.(ts|vue)$/.test(n) && !/\.test\.ts$/.test(n)
        ? [p]
        : [];
  });
}

describe("변수로 만든 i18n 키가 en 에 있다", () => {
  it("숨김 사유(filter.hidden = '...') — FilterModifier 가 t(filter.hidden) 로 보여준다", () => {
    const keys = new Set<string>();
    for (const f of files(src))
      for (const m of readFileSync(f, "utf-8").matchAll(
        /\.hidden\s*=\s*"([^"]+)"/g,
      ))
        keys.add(m[1]);
    expect(keys.size).toBeGreaterThan(3); // 추출이 통째로 실패하면 여기서 걸린다
    const get = (k: string) =>
      k
        .split(".")
        .reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], en) ??
      en[k];
    expect([...keys].filter((k) => typeof get(k) !== "string")).toEqual([]);
  });

  it("수정자 유형(ModifierType 값) — UnknownModifier 가 t(stat.type) 로 보여준다", () => {
    const body = readFileSync(resolve(src, "parser/modifiers.ts"), "utf-8");
    const enumBody = body.slice(
      body.indexOf("export enum ModifierType"),
      body.indexOf("}", body.indexOf("export enum ModifierType")),
    );
    const values = [...enumBody.matchAll(/=\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(values.length).toBeGreaterThan(10);
    expect(values.filter((v) => typeof en[v] !== "string")).toEqual([]);
    // SourceInfo.vue 는 t(`item.mod_${type}`) 로 같은 값들을 또 쓴다 — 6개가 빠져 있었다
    const item = en.item as Record<string, unknown>;
    expect(values.filter((v) => typeof item[`mod_${v}`] !== "string")).toEqual(
      [],
    );
  });
});
