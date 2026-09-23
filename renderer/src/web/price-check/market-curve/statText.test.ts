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
// 스탯 id 대체 경로용 — 지금 언어 표의 줄들(STATS_ITERATOR 는 부분 문자열로 줄을 고른다)
const LINES: Array<{
  ref: string;
  matchers: Array<{ string: string; negate?: true }>;
  trade: { ids: Record<string, string[]> };
}> = [];
vi.mock("@/assets/data", () => ({
  STAT_BY_REF: (r: string) => STATS[r],
  STATS_ITERATOR: function* (s: string) {
    for (const l of LINES) if (JSON.stringify(l).includes(s)) yield l;
  },
}));
const lang = vi.hoisted(() => ({ value: "en" }));
vi.mock("@/web/Config", () => ({
  AppConfig: () => ({ language: lang.value }),
}));

const {
  buildRefIndex,
  statText,
  statId,
  statLabel,
  preferLocal,
  _setRefIndex,
  SOURCE_LANGS,
  initStatText,
} = await import("./statText");
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

describe("묶기(statId) — 같은 스탯이면 원문 언어와 상관없이 한 옵션", () => {
  const IDX = () =>
    new Map([
      [
        "공격 피해 #% 증폭",
        { ref: "#% more Attack Damage", neg: false, lang: "ko" },
      ],
      [
        "공격 피해 #% 감폭",
        { ref: "#% more Attack Damage", neg: true, lang: "ko" },
      ],
      [
        "#% more Attack Damage",
        { ref: "#% more Attack Damage", neg: false, lang: "en" },
      ],
      [
        "모든 원소 저항 #%",
        { ref: "#% to all Elemental Resistances", neg: false, lang: "ko" },
      ],
    ]);
  beforeEach(() => _setRefIndex(IDX()));
  afterEach(() => {
    lang.value = "en";
    _setRefIndex(null);
  });

  it("한국어·영어 원문이 같은 열쇠, 부호가 다르면 다른 열쇠, 모르면 원문 그대로", () => {
    expect(statId("공격 피해 #% 증폭")).toBe(statId("#% more Attack Damage"));
    expect(statId("공격 피해 #% 감폭")).not.toBe(statId("공격 피해 #% 증폭"));
    expect(statId("듣도 보도 못한 옵션 #")).toBe("듣도 보도 못한 옵션 #");
  });

  it("음수 값이 붙은 원문(-#)도 같은 스탯으로 본다", () => {
    expect(statId("모든 원소 저항 -#%")).toBe(statId("모든 원소 저항 #%"));
  });

  it("원문이 지금 언어면 다시 쓰지 않는다 — 한국어·영어 사용자의 표시는 그대로", () => {
    lang.value = "ko";
    expect(statText("공격 피해 #% 증폭")).toBe("공격 피해 #% 증폭");
    lang.value = "en";
    expect(statText("#% more Attack Damage")).toBe("#% more Attack Damage");
  });

  it("statLabel 은 지금 언어 원문을 먼저 고른다", () => {
    lang.value = "ko";
    expect(statLabel(["#% more Attack Damage", "공격 피해 #% 증폭"])).toBe(
      "공격 피해 #% 증폭",
    );
    lang.value = "en";
    expect(statLabel(["공격 피해 #% 증폭", "#% more Attack Damage"])).toBe(
      "#% more Attack Damage",
    );
  });

  it("원문 표는 언제나 한국어·영어 둘 다다", () => {
    expect([...SOURCE_LANGS]).toEqual(["ko", "en"]);
  });
});

describe("표 데이터의 흠을 견딘다", () => {
  afterEach(() => {
    lang.value = "en";
    LINES.length = 0;
    delete STATS["Causes #% increased Stun Buildup"];
    _setRefIndex(null);
  });

  it("양수 표기가 하나도 없는 항목은 부호 표시가 틀린 것 — 양수로 읽는다(ru 기절 축적)", () => {
    lang.value = "ru";
    STATS["Causes #% increased Stun Buildup"] = {
      ref: "Causes #% increased Stun Buildup",
      matchers: [
        {
          string: "Вызывает увеличенное на #% накопление оглушения",
          negate: true,
        },
      ],
    };
    _setRefIndex(
      new Map([
        [
          "유발하는 기절 축적 #% 증가",
          { ref: "Causes #% increased Stun Buildup", neg: false, lang: "ko" },
        ],
        [
          "유발하는 기절 축적 #% 감소",
          { ref: "Causes #% increased Stun Buildup", neg: true, lang: "ko" },
        ],
      ]),
    );
    expect(statText("유발하는 기절 축적 #% 증가")).toBe(
      "Вызывает увеличенное на #% накопление оглушения",
    );
    // 음수는 그 문구로 옮기면 뜻이 뒤집히므로 원문 그대로
    expect(statText("유발하는 기절 축적 #% 감소")).toBe(
      "유발하는 기절 축적 #% 감소",
    );
  });

  it("ref 로 못 찾으면 거래소 스탯 id 로 찾는다 — 문구가 하나일 때만", () => {
    lang.value = "ko";
    LINES.push({
      ref: "Leech #% of Physical Attack Damage as Life",
      matchers: [{ string: "물리 공격 피해의 #%를 생명력으로 흡수" }],
      trade: {
        ids: {
          explicit: ["explicit.stat_2557965901", "explicit.stat_55876295"],
        },
      },
    });
    _setRefIndex(
      new Map([
        [
          "Leeches #% of Physical Damage as Life",
          {
            ref: "Leeches #% of Physical Damage as Life",
            neg: false,
            lang: "en",
            ids: ["55876295"],
          },
        ],
      ]),
    );
    expect(statText("Leeches #% of Physical Damage as Life")).toBe(
      "물리 공격 피해의 #%를 생명력으로 흡수",
    );
  });

  it("스탯 id 로 찾은 문구가 둘 이상이면 쓰지 않는다 — 다른 스탯을 섞게 된다", () => {
    lang.value = "ko";
    for (const t of ["문구 하나 #", "문구 둘 #"])
      LINES.push({
        ref: t,
        matchers: [{ string: t }],
        trade: { ids: { explicit: ["explicit.stat_111"] } },
      });
    _setRefIndex(
      new Map([
        [
          "Some stat #",
          { ref: "Some stat #", neg: false, lang: "en", ids: ["111"] },
        ],
      ]),
    );
    expect(statText("Some stat #")).toBe("Some stat #");
  });

  it("preferLocal — 한국어가 묶은 두 스탯 중 local 쪽으로 본다", () => {
    const idx = buildRefIndex(
      JSON.stringify({
        ref: "Leech #% of Physical Attack Damage as Life",
        matchers: [{ string: "물리 공격 피해의 #%를 생명력으로 흡수" }],
        trade: {
          ids: {
            explicit: ["explicit.stat_2557965901", "explicit.stat_55876295"],
          },
        },
      }),
      "ko",
    );
    preferLocal(
      idx,
      [
        {
          ref: "Leech #% of Physical Attack Damage as Life",
          id: "base_life_leech_from_physical_attack_damage_permyriad",
          trade: { ids: { explicit: ["explicit.stat_2557965901"] } },
        },
        {
          ref: "Leeches #% of Physical Damage as Life",
          id: "local_life_leech_from_physical_damage_permyriad",
          trade: { ids: { explicit: ["explicit.stat_55876295"] } },
        },
      ]
        .map((o) => JSON.stringify(o))
        .join("\n"),
    );
    expect(idx.get("물리 공격 피해의 #%를 생명력으로 흡수")?.ref).toBe(
      "Leeches #% of Physical Damage as Life",
    );
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

  it("한국어: 두 표를 다 받고(묶기용), 한국어 원문은 그대로 둔다", async () => {
    lang.value = "ko";
    await initStatText();
    expect(asked.map((u) => /\/(ko|en)\//.exec(u)?.[1])).toEqual(["ko", "en"]);
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

describe("실제 데이터 — 한국어·영어 원문이 한 옵션으로 묶인다", () => {
  // 2026-09-24 점검에서 목록에 두 번 오르던 대표 사례(스냅샷 16개, 매물 339개 누락의 원인)
  const read = (l: string) =>
    readFileSync(
      resolve(here, `../../../../public/data/${l}/stats.ndjson`),
      "utf-8",
    );
  afterEach(() => _setRefIndex(null));

  it("같은 스탯의 한국어·영어 원문이 같은 statId", () => {
    const idx = buildRefIndex(read("ko"), "ko");
    const en = read("en");
    for (const [k, v] of buildRefIndex(en, "en"))
      if (!idx.has(k)) idx.set(k, v);
    preferLocal(idx, en);
    _setRefIndex(idx);
    for (const [ko, eng] of [
      ["처치한 적 하나당 생명력 # 획득", "Gain # Life per enemy killed"],
      ["정확도 #", "# to Accuracy Rating"],
      ["치명타 피해 보너스 #%", "#% to Critical Damage Bonus"],
      // 한국어판이 local/전역 두 스탯을 한 문구로 묶은 경우 — preferLocal 이 local 로 맞춘다
      [
        "물리 공격 피해의 #%를 생명력으로 흡수",
        "Leeches #% of Physical Damage as Life",
      ],
      [
        "물리 공격 피해의 #%를 마나로 흡수",
        "Leeches #% of Physical Damage as Mana",
      ],
    ]) {
      expect(`${ko} | ${statId(ko)}`).toBe(`${ko} | ${statId(eng)}`);
    }
  });
});
