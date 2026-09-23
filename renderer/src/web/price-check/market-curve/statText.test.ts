// 옵션 이름 번역 — 한국어 원문 → ref → 지금 언어 표기.
// 못 찾으면 반드시 한국어 원문이 그대로 나와야 한다(빈 칸이나 ref 노출은 결함).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STATS: Record<
  string,
  { ref: string; matchers: Array<{ string: string; negate?: true }> }
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
  // 부호 쌍: 한 ref 에 양수 표기와 negate 표기가 같이 있다(스탯 표의 실제 모양)
  "#% more Attack Damage": {
    ref: "#% more Attack Damage",
    matchers: [
      { string: "#% more Attack Damage" },
      { string: "#% less Attack Damage", negate: true },
    ],
  },
  "#% increased Poison Duration": {
    ref: "#% increased Poison Duration",
    matchers: [{ string: "#% increased Poison Duration" }], // negate 표기 없음
  },
  // 지금 언어(여기선 독일어 흉내) 표기가 원문 두 언어와 모두 달라야 "옮겼다"가 보인다
  "Adds # to # Lightning Damage": {
    ref: "Adds # to # Lightning Damage",
    matchers: [{ string: "Fügt # bis # Blitzschaden hinzu" }],
  },
};
vi.mock("@/assets/data", () => ({
  STAT_BY_REF: (r: string) => STATS[r],
}));
const lang = vi.hoisted(() => ({ value: "en" }));
vi.mock("@/web/Config", () => ({
  AppConfig: () => ({ language: lang.value }),
}));

const { buildRefIndex, statText, _setRefIndex, tablesFor, initStatText } =
  await import("./statText");
const { modKey } = await import("./appraiser");

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
    expect(idx.get("물리 피해 #% 증가")).toEqual({
      ref: "#% increased Physical Damage",
      neg: false,
    });
    expect(idx.get("화염 피해 #~# 추가")).toEqual({
      ref: "Adds # to # Fire Damage",
      neg: false,
    });
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
    expect(idx.get("정확도 #")).toEqual({
      ref: "# to Accuracy Rating",
      neg: false,
    });
  });
});

describe("statText", () => {
  beforeEach(() => _setRefIndex(null));

  it("표가 없으면 원문 그대로", () => {
    expect(statText("물리 피해 #% 증가")).toBe("물리 피해 #% 증가");
  });

  it("표에 있으면 지금 언어 표기로", () => {
    _setRefIndex(
      new Map([
        [
          "물리 피해 #% 증가",
          { ref: "#% increased Physical Damage", neg: false },
        ],
      ]),
    );
    expect(statText("물리 피해 #% 증가")).toBe("#% increased Physical Damage");
  });

  it("표에 없는 옵션은 원문 그대로", () => {
    _setRefIndex(
      new Map([
        [
          "물리 피해 #% 증가",
          { ref: "#% increased Physical Damage", neg: false },
        ],
      ]),
    );
    expect(statText("듣도 보도 못한 옵션 #")).toBe("듣도 보도 못한 옵션 #");
  });

  it("negate 원문은 negate 표기로 — 뜻이 뒤집히지 않는다", () => {
    // "공격 피해 20% 감폭"(less)이 "more"로 뜨면 필터로 고른 매물이 정반대가 된다
    _setRefIndex(
      new Map([
        ["공격 피해 #% 증폭", { ref: "#% more Attack Damage", neg: false }],
        ["공격 피해 #% 감폭", { ref: "#% more Attack Damage", neg: true }],
      ]),
    );
    expect(statText("공격 피해 #% 증폭")).toBe("#% more Attack Damage");
    expect(statText("공격 피해 #% 감폭")).toBe("#% less Attack Damage");
  });

  it("지금 언어에 negate 표기가 없으면 원문 그대로 — ref 로 물러나면 뜻이 뒤집힌다", () => {
    _setRefIndex(
      new Map([
        [
          "중독 지속시간 #% 감소",
          { ref: "#% increased Poison Duration", neg: true },
        ],
      ]),
    );
    expect(statText("중독 지속시간 #% 감소")).toBe("중독 지속시간 #% 감소");
  });

  it("buildRefIndex 가 negate 표기를 부호와 함께 기억한다", () => {
    const idx = buildRefIndex(
      JSON.stringify({
        ref: "#% more Attack Damage",
        matchers: [
          { string: "공격 피해 #% 증폭" },
          { string: "공격 피해 #% 감폭", negate: true },
        ],
      }),
    );
    expect(idx.get("공격 피해 #% 증폭")).toEqual({
      ref: "#% more Attack Damage",
      neg: false,
    });
    expect(idx.get("공격 피해 #% 감폭")).toEqual({
      ref: "#% more Attack Damage",
      neg: true,
    });
  });

  it("그 언어에 표기가 없으면 ref(영문 정본)로 물러난다", () => {
    _setRefIndex(new Map([["아무거나 #", { ref: "표기없음", neg: false }]]));
    expect(statText("아무거나 #")).toBe("표기없음");
  });
});

describe("tablesFor — 지금 언어가 아닌 쪽 표만 받는다", () => {
  // 영어·한국어 사용자에게 회귀가 없다는 걸 여기서 못박는다: 자기 언어 표를 받으면
  // 원문이 matchers[0] 표기로 바뀌어 보일 수 있다(번역이 아니라 재표기).
  it("영어 UI 는 한국어 표만 — 지금과 같다", () => {
    expect(tablesFor("en")).toEqual(["ko"]);
  });
  it("한국어 UI 는 영어 표만 — 영어 크라우드 옵션을 한국어로", () => {
    expect(tablesFor("ko")).toEqual(["en"]);
  });
  it("그 외 언어는 둘 다", () => {
    for (const l of ["de", "ja", "ru", "cmn-Hant"])
      expect(tablesFor(l)).toEqual(["ko", "en"]);
  });
});

describe("실제 데이터", () => {
  it("영어 스탯 표도 읽히고, 글로벌 크라우드가 보내는 영어 옵션이 대응된다", () => {
    // 2026-09-23 실측에서 한국어 표에 없던 상위 옵션들 — 전부 영어 원문이었다.
    // 이게 빠지면 한국어 UI 에 영어가, 다른 언어 UI 에 영어가 섞여 보인다.
    const idx = buildRefIndex(
      readFileSync(
        resolve(here, "../../../../public/data/en/stats.ndjson"),
        "utf-8",
      ),
    );
    expect(idx.size).toBeGreaterThan(3000);
    for (const k of [
      "Adds # to # Lightning Damage",
      "# to Strength",
      "Gain # Life per enemy killed",
      "# to Accuracy Rating",
      "#% increased Physical Damage",
    ]) {
      expect(`${k} -> ${idx.has(k)}`).toBe(`${k} -> true`);
    }
  });

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
      expect(`${k} -> ${idx.get(k)?.ref ?? "(없음)"}`).not.toContain("(없음)");
    }
  });

  it("실제 수집에 나오는 negate 옵션이 부호째 기억되고, 영어 표에 같은 부호 표기가 있다", () => {
    // 2026-09-23 실측에서 뜻이 뒤집혀 보이던 세 옵션(스냅샷 16개, 78건)
    const read = (l: string) =>
      readFileSync(
        resolve(here, `../../../../public/data/${l}/stats.ndjson`),
        "utf-8",
      );
    const ko = buildRefIndex(read("ko"));
    const enNeg = new Set<string>();
    for (const line of read("en").split("\n")) {
      if (!line.trim()) continue;
      const o = JSON.parse(line) as {
        ref: string;
        matchers?: Array<{ negate?: boolean }>;
      };
      if (o.matchers?.some((m) => m.negate === true)) enNeg.add(o.ref);
    }
    for (const k of [
      "공격 피해 #% 감폭",
      "중독 지속시간 #% 감소",
      "최대 마나 #% 감소",
    ]) {
      const e = ko.get(k);
      expect(`${k} -> ${e?.neg}`).toBe(`${k} -> true`);
      expect(`${k} -> en negate ${enNeg.has(e?.ref ?? "")}`).toBe(
        `${k} -> en negate true`,
      );
    }
  });
});

describe("initStatText — 원문이 한국어든 영어든 지금 언어로", () => {
  const REF = "Adds # to # Lightning Damage";
  const KO = modKey("번개 피해 #~# 추가");
  const EN = modKey("Adds # to # Lightning Damage");
  const LOCAL = modKey("Fügt # bis # Blitzschaden hinzu");
  const asked: string[] = [];

  beforeEach(() => {
    asked.length = 0;
    _setRefIndex(null);
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      const m = url.includes("/ko/") ? "번개 피해 #~# 추가" : REF;
      return new Response(
        JSON.stringify({ ref: REF, matchers: [{ string: m }] }),
      );
    });
  });
  afterEach(() => {
    lang.value = "en";
    _setRefIndex(null);
    vi.unstubAllGlobals();
  });

  it("그 외 언어: 한국어 원문도 영어 원문도 옮긴다", async () => {
    lang.value = "de";
    await initStatText();
    expect(statText(KO)).toBe(LOCAL);
    expect(statText(EN)).toBe(LOCAL);
  });

  it("한국어: 영어 표만 받고, 한국어 원문은 그대로 둔다", async () => {
    lang.value = "ko";
    await initStatText();
    expect(asked.map((u) => u.includes("/en/"))).toEqual([true]);
    expect(statText(KO)).toBe(KO);
    expect(statText(EN)).toBe(LOCAL);
  });

  it("한 표를 못 받아도 나머지 표로 돈다", async () => {
    lang.value = "de";
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/ko/")) throw new Error("down");
      return new Response(
        JSON.stringify({ ref: REF, matchers: [{ string: REF }] }),
      );
    });
    await initStatText();
    expect(statText(EN)).toBe(LOCAL);
    expect(statText(KO)).toBe(KO);
  });
});
