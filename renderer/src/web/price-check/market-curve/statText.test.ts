// 옵션 이름 번역 — 한국어 원문 → ref → 지금 언어 표기.
// 못 찾으면 반드시 한국어 원문이 그대로 나와야 한다(빈 칸이나 ref 노출은 결함).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STATS: Record<
  string,
  { ref: string; matchers: Array<{ string: string }> }
> = {
  "#% increased Physical Damage": {
    ref: "#% increased Physical Damage",
    matchers: [{ string: "#% increased Physical Damage" }],
  },
  "Adds # to # Fire Damage": {
    ref: "Adds # to # Fire Damage",
    matchers: [{ string: "Adds # to # Fire Damage" }],
  },
  "표기없음": { ref: "표기없음", matchers: [] },
};
vi.mock("@/assets/data", () => ({
  STAT_BY_REF: (r: string) => STATS[r],
}));
vi.mock("@/web/Config", () => ({ AppConfig: () => ({ language: "en" }) }));

const { buildRefIndex, statText, _setRefIndex } = await import("./statText");

const here = dirname(fileURLToPath(import.meta.url));

describe("buildRefIndex", () => {
  it("한국어 표기를 정규화해 ref 로 잇는다", () => {
    const idx = buildRefIndex(
      [
        JSON.stringify({
          ref: "#% increased Physical Damage",
          matchers: [{ string: "물리 피해 #% 증가" }],
        }),
        "",
        "{깨진 줄",
        JSON.stringify({
          ref: "Adds # to # Fire Damage",
          matchers: [{ string: "화염 피해 #~# 추가" }],
        }),
      ].join("\n"),
    );
    expect(idx.get("물리 피해 #% 증가")).toBe("#% increased Physical Damage");
    expect(idx.get("화염 피해 #~# 추가")).toBe("Adds # to # Fire Damage");
    expect(idx.size).toBe(2); // 깨진 줄은 건너뛰고 나머지는 살린다
  });

  it("+ 가 붙은 표기도 열쇠와 같은 규칙으로 정규화된다", () => {
    // 곡선 쪽 열쇠는 "정확도 +#" 이 아니라 "정확도 #" 이다(modKey 가 + 를 지움).
    const idx = buildRefIndex(
      JSON.stringify({
        ref: "# to Accuracy Rating",
        matchers: [{ string: "정확도 +#" }],
      }),
    );
    expect(idx.get("정확도 #")).toBe("# to Accuracy Rating");
  });
});

describe("statText", () => {
  beforeEach(() => _setRefIndex(null));

  it("표가 없으면 원문 그대로", () => {
    expect(statText("물리 피해 #% 증가")).toBe("물리 피해 #% 증가");
  });

  it("표에 있으면 지금 언어 표기로", () => {
    _setRefIndex(
      new Map([["물리 피해 #% 증가", "#% increased Physical Damage"]]),
    );
    expect(statText("물리 피해 #% 증가")).toBe("#% increased Physical Damage");
  });

  it("표에 없는 옵션은 원문 그대로", () => {
    _setRefIndex(
      new Map([["물리 피해 #% 증가", "#% increased Physical Damage"]]),
    );
    expect(statText("듣도 보도 못한 옵션 #")).toBe("듣도 보도 못한 옵션 #");
  });

  it("그 언어에 표기가 없으면 ref(영문 정본)로 물러난다", () => {
    _setRefIndex(new Map([["아무거나 #", "표기없음"]]));
    expect(statText("아무거나 #")).toBe("표기없음");
  });
});

describe("실제 데이터", () => {
  it("한국어 스탯 표가 실제로 읽히고 대표 옵션이 대응된다", () => {
    const nd = readFileSync(
      resolve(here, "../../../../public/data/ko/stats.ndjson"),
      "utf-8",
    );
    const idx = buildRefIndex(nd);
    expect(idx.size).toBeGreaterThan(3000);
    // 실제 수집에서 가장 많이 나오는 옵션들 — 하나라도 빠지면 목록이 반쯤 한국어로 남는다
    for (const k of [
      "물리 피해 #% 증가",
      "공격 속도 #% 증가",
      "정확도 #",
      "화염 피해 #~# 추가",
      "번개 피해 #~# 추가",
      "물리 피해 #~# 추가",
    ]) {
      expect(`${k} -> ${idx.get(k) ?? "(없음)"}`).not.toContain("(없음)");
    }
  });
});
