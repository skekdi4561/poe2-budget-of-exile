// 시장 곡선 판정 — 감정소(serve.py/index.html)와 같은 픽스처·같은 답이어야 한다
import { describe, it, expect, vi } from "vitest";
import {
  frontier,
  formatEx,
  uiLocale,
  matchesFilters,
  statOptions,
  metricRows,
  rowsFromSnapshot,
  RichRow,
  snapshotUrl,
  snapKey,
  marketBoard,
  optRank,
  isOffDps,
  priceTicks,
  MIRROR_IN_DIVINE,
} from "./appraiser";

describe("snapKey — 리그와 접미사를 한 키로 접는다", () => {
  // 감정소 serve.py latest_path() 와 같은 규칙이어야 파일을 찾는다.
  // **소프트코어는 접미사만** — 배포된 v1.1.1 이 옛 URL 을 계속 fetch 하므로 여기가 바뀌면 안 된다.
  it("도전 리그 하드코어만 hc 태그를 붙인다", () => {
    expect(snapKey("Forbidden Rites", "crossbow")).toBe("crossbow");
    expect(snapKey("HC Forbidden Rites", "crossbow")).toBe("hc.crossbow");
    expect(snapKey("HC Forbidden Rites", "")).toBe("hc");
    expect(snapKey("Forbidden Rites", "")).toBe("");
    expect(snapKey()).toBe("");
  });

  it("상시 하드코어는 별개 리그라 태그를 안 붙인다", () => {
    // 감정소는 도전 리그만 모은다. "Hardcore"/"Standard" 는 수집 대상이 아니므로
    // hc 태그를 붙이면 없는 파일을 부르게 된다.
    expect(snapKey("Hardcore", "")).toBe("");
    expect(snapKey("Standard", "crossbow")).toBe("crossbow");
  });

  it("접힌 키가 그대로 파일 이름이 된다", () => {
    expect(snapshotUrl(snapKey("HC Forbidden Rites", "crossbow"))).toBe(
      "https://skekdi4561.github.io/poe2-bow/latest.hc.crossbow.json",
    );
    expect(snapshotUrl(snapKey("HC Forbidden Rites", ""))).toBe(
      "https://skekdi4561.github.io/poe2-bow/latest.hc.json",
    );
  });
});

describe("marketBoard 캐시가 리그로 갈린다", () => {
  // 캐시 키가 접미사만이면 하드코어 요청이 소프트코어 캐시를 그대로 돌려받는다.
  // 컴파일·타입·스모크를 다 통과하고 화면에도 '곡선은 나오는' 형태라 이 단언 없이는
  // 어떤 그물에도 안 걸린다 — 값만 조용히 틀린다.
  it("같은 무기·다른 리그는 각각 받아온다", async () => {
    const urls: string[] = [];
    const snap = {
      taken_at: Date.now(),
      rates: { exalted: { rate: 1 } },
      bows: [
        { pdps: 100, edps: 0, price: 1, cur: "exalted", rarity: "Rare" },
        { pdps: 200, edps: 0, price: 2, cur: "exalted", rarity: "Rare" },
      ],
    };
    const orig = globalThis.fetch;
    globalThis.fetch = (async (u: string) => {
      urls.push(String(u));
      return { json: async () => snap } as unknown as Response;
    }) as typeof fetch;
    try {
      // 접미사는 이 테스트 전용이어야 한다 — 모듈 캐시가 파일 전역이라
      // 다른 테스트가 세는 무기("", crossbow, warstaff)를 쓰면 그쪽 fetch 수를 깎는다.
      await marketBoard("spear", "Forbidden Rites");
      await marketBoard("spear", "HC Forbidden Rites");
      await marketBoard("spear", "Forbidden Rites"); // 캐시 적중이라 요청이 안 늘어야 한다
    } finally {
      globalThis.fetch = orig;
    }
    expect(urls.filter((u) => u.endsWith("latest.spear.json"))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith("latest.hc.spear.json"))).toHaveLength(
      1,
    );
  });
});

describe("snapshotUrl", () => {
  it("활은 latest.json, 다른 무기는 latest.<접미사>.json", () => {
    expect(snapshotUrl("")).toBe(
      "https://skekdi4561.github.io/poe2-bow/latest.json",
    );
    expect(snapshotUrl()).toBe(
      "https://skekdi4561.github.io/poe2-bow/latest.json",
    );
    expect(snapshotUrl("crossbow")).toBe(
      "https://skekdi4561.github.io/poe2-bow/latest.crossbow.json",
    );
    expect(snapshotUrl("warstaff")).toBe(
      "https://skekdi4561.github.io/poe2-bow/latest.warstaff.json",
    );
  });
});

describe("marketBoard 무기별 캐시 격리", () => {
  it("무기마다 자기 URL 을 받고 서로 안 섞이며 캐시는 무기별로 동작", async () => {
    const now = Date.now();
    const mk = (pdps: number) => ({
      rarity: "Rare",
      cur: "exalted",
      price: 5,
      t: now,
      pdps,
      edps: 0,
    });
    const bySuffix: Record<string, unknown> = {
      "https://skekdi4561.github.io/poe2-bow/latest.json": {
        taken_at: now,
        rates: { divine: 65.6 },
        bows: [mk(100), mk(200), { ...mk(150), cur: "mirror", price: 1 }],
      },
      "https://skekdi4561.github.io/poe2-bow/latest.crossbow.json": {
        taken_at: now,
        rates: {},
        bows: [mk(300), mk(400)],
      },
    };
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (u: string) => {
      calls.push(String(u));
      return { ok: true, json: async () => bySuffix[String(u)] } as Response;
    }) as typeof fetch;
    try {
      const bow = await marketBoard("");
      const xbow = await marketBoard("crossbow");
      const bow2 = await marketBoard(""); // 같은 무기 재요청 — 캐시에서, 새 fetch 없음
      // 각 무기가 자기 데이터만 봄(섞이면 최고 DPS 가 어긋난다)
      expect(Math.max(...bow!.rows.map((r) => r.pdps))).toBe(200);
      // rates 에 mirror 가 없어도 살아남되(0 ex 면 최전선을 '공짜'로 점령한다), 절대값이 아니라
      // 실측 디바인의 배수여야 한다 — 절대값이면 리그가 바뀔 때 4.6배 부풀린 값이 된다
      // 배수를 상수로 박지 말 것 — 리그마다 바뀐다(6500 → 350 으로 갱신하며 여기서 걸렸다)
      expect(bow!.rows.some((r) => r.p === 65.6 * MIRROR_IN_DIVINE)).toBe(true);
      expect(Math.max(...xbow!.rows.map((r) => r.pdps))).toBe(400);
      expect(Math.max(...bow2!.rows.map((r) => r.pdps))).toBe(200);
      // fetch 는 무기마다 한 번씩만(bow2 는 캐시 히트)
      expect(calls).toEqual([
        "https://skekdi4561.github.io/poe2-bow/latest.json",
        "https://skekdi4561.github.io/poe2-bow/latest.crossbow.json",
      ]);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("frontier", () => {
  it("전수 비교와 같은 판정", () => {
    const f = frontier([
      { d: 100, p: 5, t: 0 },
      { d: 150, p: 20, t: 0 },
      { d: 120, p: 30, t: 0 },
      { d: 150, p: 18, t: 0 },
    ]);
    expect(f.map((x) => [x.d, x.p])).toEqual([
      [100, 5],
      [150, 18],
    ]);
  });
  it("동점(같은 DPS·가격)은 전원 생존", () => {
    expect(
      frontier([
        { d: 1, p: 2, t: 0 },
        { d: 1, p: 2, t: 0 },
      ]),
    ).toHaveLength(2);
    expect(
      frontier([
        { d: 1, p: 2, t: 0 },
        { d: 1, p: 3, t: 0 },
      ]),
    ).toHaveLength(1);
    expect(
      frontier([
        { d: 2, p: 2, t: 0 },
        { d: 1, p: 2, t: 0 },
      ]),
    ).toHaveLength(1);
    expect(frontier([])).toHaveLength(0);
  });
});

describe("formatEx", () => {
  const rates = { exalted: 1, divine: 400 };
  // 로케일을 **명시**한다 — 안 주면 실행 환경의 기본 로케일을 타서 CI 러너에 따라
  // 1,477 이 1.477 로 나올 수 있다(테스트가 환경에 흔들리면 안 된다).
  it("1 디바인어치부터 div 표기 (감정소 money 와 같은 규칙)", () => {
    expect(formatEx(5, rates, "en")).toBe("5.00 ex");
    expect(formatEx(399, rates, "en")).toBe("399 ex");
    expect(formatEx(400, rates, "en")).toBe("1.00 div");
    expect(formatEx(590800, rates, "en")).toBe("1,477 div");
  });
  it("디바인 환율이 깨져 있으면 ex 로 남는다", () => {
    expect(formatEx(590800, { exalted: 1, divine: 0 }, "en")).toBe(
      "590,800 ex",
    );
  });

  // 예전엔 "ko-KR" 이 박혀 있어서 독일·프랑스·러시아·포르투갈·스페인 사용자가
  // 소수점과 천단위 구분자가 뒤바뀐 숫자를 봤다. 값을 오독할 수 있는 결함이다.
  it("숫자 형식이 사용자 언어를 따른다", () => {
    // de \uc758 \uad6c\ubd84\uc790(. \uacfc ,)\ub294 ICU \ubc84\uc804\uacfc \ubb34\uad00\ud558\uac8c \uace0\uc815\uc774\ub77c \uadf8\ub300\ub85c \ub2e8\uc5b8\ud55c\ub2e4.
    expect(formatEx(590800, rates, "de")).toBe("1.477 div");
    expect(formatEx(5, rates, "de")).toBe("5,00 ex");
    // ru \uc758 \ucc9c\ub2e8\uc704 \uad6c\ubd84\uc790\ub294 **\uacf5\ubc31 \uacc4\uc5f4\uc774\uc9c0\ub9cc \uc5b4\ub5a4 \uacf5\ubc31\uc778\uc9c0\ub294 ICU \ubc84\uc804\ub9c8\ub2e4 \ub2e4\ub974\ub2e4**
    // (fr \uc740 ICU 72 \uc5d0\uc11c U+00A0 -> U+202F \ub85c \ubc14\ub00c\uc5c8\ub2e4). \ubb38\uc790\ub97c \ubc15\uc544\ub450\uba74 \ub7ec\ub108\uc758 ICU \uc5d0
    // \ub530\ub77c \uae68\uc9c4\ub2e4 \u2014 \uc2e4\uc81c\ub85c \uc774 \ub2e8\uc5b8\uc774 CI \uc5d0\uc11c \uae68\uc84c\ub2e4. \uc7a1\uc544\uc57c \ud560 \uac83\uc740 "en \uacfc \ub2e4\ub974\uac8c
    // \ub098\ub204\ub294\uac00"\uc774\ubbc0\ub85c \uad6c\ubd84\uc790\uac00 \uc27c\ud45c\uac00 \uc544\ub2c8\uace0 \uacf5\ubc31\uc774\ub77c\ub294 \uac83\ub9cc \ubcf8\ub2e4.
    const ru = formatEx(590800, rates, "ru");
    expect(ru).not.toBe("1,477 div");
    expect(ru).toMatch(/^1\s477 div$/u);
  });

  // 앱이 쓰는 10개 로케일 전부가 Intl 에서 살아야 한다. cmn-Hant 는 BCP-47 표준형이
  // 아니라 예외가 날 수 있는 후보였다(실측: 안 난다). 새 언어를 넣을 때 여기서 걸린다.
  it("앱의 모든 언어 코드가 Intl 에서 던지지 않는다", () => {
    for (const l of [
      "en",
      "ko",
      "ja",
      "cmn-Hant",
      "de",
      "es",
      "fr",
      "pt",
      "ru",
      "th",
    ]) {
      expect(() => formatEx(1234.5, rates, l)).not.toThrow();
    }
  });

  // node 환경(테스트)에는 document 가 없다 — 여기서 던지면 앱이 아니라 테스트가 죽는다.
  it("uiLocale 은 document 가 없어도 던지지 않는다", () => {
    expect(() => uiLocale()).not.toThrow();
  });
});

describe("matchesFilters", () => {
  const offs = { "치명타 확률 #%": 4, "생명력 최대치 #": 67 };
  it("min/max 직접 입력 판정", () => {
    expect(
      matchesFilters(offs, [{ key: "치명타 확률 #%", min: 2, max: null }]),
    ).toBe(true);
    expect(
      matchesFilters(offs, [{ key: "치명타 확률 #%", min: 5, max: null }]),
    ).toBe(false);
    expect(
      matchesFilters(offs, [{ key: "치명타 확률 #%", min: null, max: 3 }]),
    ).toBe(false);
    expect(
      matchesFilters(offs, [{ key: "치명타 확률 #%", min: 2, max: 4 }]),
    ).toBe(true);
  });
  it("min/max 비우면 존재만 확인, 없는 옵션은 탈락", () => {
    expect(
      matchesFilters(offs, [{ key: "생명력 최대치 #", min: null, max: null }]),
    ).toBe(true);
    expect(
      matchesFilters(offs, [{ key: "없는 옵션 #", min: null, max: null }]),
    ).toBe(false);
  });
  it("여러 행은 전부 만족해야 통과", () => {
    expect(
      matchesFilters(offs, [
        { key: "치명타 확률 #%", min: 2, max: null },
        { key: "생명력 최대치 #", min: 70, max: null },
      ]),
    ).toBe(false);
  });
});

describe("statOptions", () => {
  it("관측 옵션 집계 — 빈도순, 2개 미만 제외, 범위 포함", () => {
    const rows: RichRow[] = [
      {
        pdps: 1,
        edps: 0,
        p: 1,
        t: 0,
        crit: 0,
        block: 0,
        offs: { "치명타 확률 #%": 2, "희귀 옵션 #": 9 },
      },
      {
        pdps: 1,
        edps: 0,
        p: 1,
        t: 0,
        crit: 0,
        block: 0,
        offs: { "치명타 확률 #%": 5 },
      },
    ];
    const s = statOptions(rows);
    expect(s).toHaveLength(1);
    expect(s[0]).toEqual({ key: "치명타 확률 #%", n: 2, lo: 2, hi: 5 });
  });
});

describe("rowsFromSnapshot block", () => {
  // 방패 막기도 같은 리터럴에서 실린다. 0 은 "미수집" 이라 하한을 걸면 함께 빠지는 게 맞다 —
  // 방패 막기는 언제나 양수라(실측 26~33) 0 이 정상값일 수 없다.
  it("block 을 행에 싣고, 없으면 0", () => {
    const snap = {
      taken_at: 0,
      bows: [
        { pdps: 900, edps: 0, price: 1, cur: "exalted", block: 26 },
        { pdps: 900, edps: 0, price: 1, cur: "exalted" },
      ],
    };
    const { rows } = rowsFromSnapshot(snap, { exalted: 1 }, new Set(), 0);
    expect(rows.map((r) => r.block)).toEqual([26, 0]);
  });
});

describe("rowsFromSnapshot crit", () => {
  // 아이템 최종 치확은 스냅샷에만 있고 골라 담는 지점이 rowsFromSnapshot 의 리터럴 하나뿐이다.
  // 거기서 빠지면 게이트가 "항상 0" 이 되어 **아무도 안 걸리는데 오류도 안 난다**.
  // 문자열 케이스도 같이 본다 — numOr0 가 있는 이유가 그 신뢰 경계다(pdps 문자열 결합 실측 사고).
  it("crit 을 행에 싣고, 숫자가 아니거나 없으면 0", () => {
    const snap = {
      taken_at: 0,
      bows: [
        { pdps: 100, edps: 0, price: 1, cur: "exalted", crit: 9.5 },
        { pdps: 100, edps: 0, price: 1, cur: "exalted" },
        {
          pdps: 100,
          edps: 0,
          price: 1,
          cur: "exalted",
          crit: "9.5" as unknown as number,
        },
      ],
    };
    const { rows } = rowsFromSnapshot(snap, { exalted: 1 }, new Set(), 0);
    expect(rows.map((r) => r.crit)).toEqual([9.5, 0, 0]);
  });
});

describe("metricRows", () => {
  // 물리 전용 초저가 활이 "원소" 지표에서 0 DPS 계단으로 새면 안 된다 (index.html v.d>0 동일)
  const rows: RichRow[] = [
    { pdps: 300, edps: 0, p: 1, t: 0, crit: 0, block: 0, offs: {} },
    { pdps: 100, edps: 80, p: 5, t: 0, crit: 0, block: 0, offs: {} },
  ];
  it("선택 지표가 0인 행은 제외", () => {
    expect(metricRows(rows, "ele")).toEqual([{ d: 80, p: 5, t: 0 }]);
    expect(metricRows(rows, "phys")).toHaveLength(2);
    expect(metricRows(rows, "total")).toHaveLength(2);
  });
});

describe("rowsFromSnapshot", () => {
  const rates = { exalted: 1, divine: 300 };
  const fb = new Set<string>();
  const now = 1_000_000_000_000;
  it("문자열/비숫자 pdps 는 숫자 강제 — frontier 오염 방지", () => {
    const snap = {
      taken_at: now,
      bows: [
        // pdps 가 문자열 "227" 이면 예전엔 pdps+edps 가 "22738" 로 결합됐다
        {
          rarity: "Rare",
          cur: "divine",
          price: 5,
          t: now,
          pdps: "227" as unknown as number,
          edps: 38,
        },
        { rarity: "Rare", cur: "divine", price: 9, t: now, pdps: 300, edps: 0 },
      ],
    };
    const { rows } = rowsFromSnapshot(snap, rates, fb, now);
    for (const r of rows) {
      expect(typeof r.pdps).toBe("number");
      expect(typeof r.edps).toBe("number");
      expect(Number.isFinite(r.pdps + r.edps)).toBe(true);
    }
    // "227" → 0 강제되어 edps 38 만 남음, 두 번째는 300
    expect(rows.map((r) => r.pdps + r.edps).sort((a, b) => a - b)).toEqual([
      38, 300,
    ]);
  });
  it("가격/DPS 가 0·음수·비정상이면 제외", () => {
    const snap = {
      taken_at: now,
      bows: [
        { rarity: "Rare", cur: "divine", price: 0, t: now, pdps: 100, edps: 0 },
        { rarity: "Rare", cur: "divine", price: 5, t: now, pdps: 0, edps: 0 },
        {
          rarity: "Rare",
          cur: "divine",
          price: "x" as unknown as number,
          t: now,
          pdps: 100,
          edps: 0,
        },
      ],
    };
    expect(rowsFromSnapshot(snap, rates, fb, now).rows).toHaveLength(0);
  });
});

describe("rowsFromSnapshot staleKept", () => {
  const rates = { exalted: 1, divine: 300 };
  const fb = new Set<string>();
  const now = 2_000_000_000_000;
  const mk = (t: number) => ({
    rarity: "Rare",
    cur: "divine",
    price: 5,
    pdps: 300,
    edps: 0,
    t,
  });
  it("신선분 부족 시 낡은 매물로 폴백하고 staleKept=true", () => {
    const snap = {
      taken_at: now,
      bows: [mk(now - 30 * 3600 * 1000), mk(now - 40 * 3600 * 1000)],
    };
    const r = rowsFromSnapshot(snap, rates, fb, now);
    expect(r.rows.length).toBe(2);
    expect(r.staleKept).toBe(true);
  });
  it("신선분 충분하면 staleKept=false, 낡은 건 제외", () => {
    const snap = {
      taken_at: now,
      bows: [mk(now - 1000), mk(now - 2000), mk(now - 40 * 3600 * 1000)],
    };
    const r = rowsFromSnapshot(snap, rates, fb, now);
    expect(r.rows.length).toBe(2);
    expect(r.staleKept).toBe(false);
  });
});

describe("optRank (옵션 표시 순서)", () => {
  it("무기 성능 직결이 위, 반려수는 아래 — 감정소 index.html 과 같은 규칙", () => {
    expect(optRank("모든 투사체 스킬 레벨 #")).toBe(0);
    expect(optRank("치명타 확률 #%")).toBe(0);
    expect(optRank("물리 공격 피해의 #%를 생명력으로 흡수")).toBe(0);
    expect(optRank("정확도 #")).toBe(1);
    expect(optRank("반려수의 공격 속도 #% 증가")).toBe(2);
  });
  it("statOptions 가 빈도보다 유용도를 먼저 본다", () => {
    const rows: RichRow[] = [];
    // 반려수 옵션이 더 흔해도(3) 스킬 레벨(2)보다 아래여야 한다
    for (let i = 0; i < 3; i++)
      rows.push({
        pdps: 1,
        edps: 0,
        p: 1,
        t: 0,
        crit: 0,
        block: 0,
        offs: { "반려수의 공격 속도 #% 증가": 10 },
      });
    for (let i = 0; i < 2; i++) rows[i].offs["모든 투사체 스킬 레벨 #"] = 2;
    const s = statOptions(rows);
    expect(s[0].key).toBe("모든 투사체 스킬 레벨 #");
  });
});

describe("rowsFromSnapshot rarity (V27)", () => {
  const rates = { exalted: 1 };
  const fb = new Set<string>();
  const now = 3_000_000_000_000;
  const mk = (rarity: string | undefined) => ({
    rarity,
    cur: "exalted",
    price: 5,
    pdps: 300,
    edps: 0,
    t: now,
  });
  it("rarity '' 와 누락은 Rare 로 포함, Magic/Unique 는 제외 — 사이트·serve.py 와 같은 규칙", () => {
    const snap = {
      taken_at: now,
      bows: [mk(""), mk(undefined), mk("Rare"), mk("Magic"), mk("Unique")],
    };
    // '' 가 빠지면 2 — `??` 로 이식하면 '' 가 그대로 남아 Rare 필터에서 탈락한다
    expect(rowsFromSnapshot(snap, rates, fb, now).rows).toHaveLength(3);
  });
});

describe("matchesFilters 열쇠 존재 판정 (V08/V26)", () => {
  const zero = { "불리언 옵션": 0 };
  it("값이 0 인 옵션도 열쇠가 있으면 존재로 본다", () => {
    // 값으로 존재를 판정하면 0 이 '없음'이 되어 이 필터가 죽는다
    expect(
      matchesFilters(zero, [{ key: "불리언 옵션", min: null, max: null }]),
    ).toBe(true);
    // 열쇠가 있어도 min/max 는 여전히 값으로 판정한다
    expect(
      matchesFilters(zero, [{ key: "불리언 옵션", min: 1, max: null }]),
    ).toBe(false);
  });
});

describe("isOffDps — 방어구(방패)", () => {
  // 방패는 지표가 방어도다. 무기 목록을 그대로 쓰면 방어도를 만드는 옵션이 '방어도 밖 옵션'
  // 상위를 차지하고, 그 조건을 켜면 "같은 방어도를 사는 데 더 든다"는 정반대 결론이 나온다.
  it("방어도를 만드는 옵션은 '지표 밖'이 아니다", () => {
    for (const m of [
      "[Armour|방어도] 41% 증가",
      "[Armour|방어도] +265",
      "[Armour|방어도], [Evasion|회피], [EnergyShield|에너지 보호막] 20% 증가",
    ]) {
      expect(`${m} -> ${isOffDps(m, true)}`).toBe(`${m} -> false`);
    }
  });

  it("방어도에 안 들어가는 것은 그대로 남는다", () => {
    for (const m of [
      "[Block|막기] 확률 3% 증가",
      "[Resistances|화염] 저항 +21%",
      "[StunThreshold|기절 한계치] +130",
    ]) {
      expect(`${m} -> ${isOffDps(m, true)}`).toBe(`${m} -> true`);
    }
  });

  it("무기 판정은 안 바뀐다 — 기본값이 무기다", () => {
    expect(isOffDps("[Physical|물리] 피해 168% 증가")).toBe(false);
    expect(isOffDps("[Armour|방어도] 41% 증가")).toBe(true); // 무기에선 지표 밖이 맞다
  });
});

describe("isOffDps (COUNTED — 거래소 DPS 에 이미 든 옵션 판정, V57)", () => {
  it("조건부 추가 피해는 DPS 밖, 무조건 추가 피해는 DPS 안 — serve.py/index.html 과 3표면 동일", () => {
    // 접두 조건이 붙은 추가 피해를 COUNTED 로 삼키면 필터 후보에서 사라진다
    expect(isOffDps("감전된 적에게 번개 피해 1~60 추가")).toBe(true);
    // 무조건 추가 피해가 COUNTED 에서 빠지면 DPS 에 이미 든 옵션이 필터에 중복 등장한다
    expect(isOffDps("번개 피해 19~420 추가")).toBe(false);
    expect(isOffDps("[Physical|물리] 피해 19~30 추가")).toBe(false); // 게임 마크업을 벗긴 뒤 판정
    expect(isOffDps("Adds 19 to 420 Lightning Damage")).toBe(false);
  });
});

describe("priceTicks (가격축 눈금, V43)", () => {
  it("가격 폭이 한 자릿수(decade) 안이면 10^k 눈금이 없어 양 끝값으로 대신한다", () => {
    // 폴백이 없으면 12~85 ex 에서 눈금 0개 — 축이 빈다
    expect(priceTicks(Math.log10(12), Math.log10(85), 12, 85)).toEqual([
      12, 85,
    ]);
  });
  it("10^k 눈금이 하나뿐이어도 양 끝값으로 (2개 미만 폴백)", () => {
    // `< 2` 를 `< 1` 로 바꾸면 [10] 하나만 남아 여기서 잡힌다
    expect(priceTicks(Math.log10(5), Math.log10(50), 5, 50)).toEqual([5, 50]);
  });
  it("여러 자릿수를 걸치면 10 의 거듭제곱만", () => {
    expect(priceTicks(Math.log10(3), Math.log10(3000), 3, 3000)).toEqual([
      10, 100, 1000,
    ]);
  });
});

describe("fetchSnapshot 타임아웃 (V28)", () => {
  it("fetch 에 AbortSignal.timeout(15초) 를 넘기고, 끊기면 이전 캐시로 돌아간다", async () => {
    const now = Date.now();
    const mk = (pdps: number) => ({
      rarity: "Rare",
      cur: "exalted",
      price: 5,
      t: now,
      pdps,
      edps: 0,
    });
    const ac = new AbortController();
    // 실제 15초를 기다릴 수 없으니 타임아웃 신호를 손에 쥔 것으로 바꿔치기한다
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(ac.signal);
    const signals: unknown[] = [];
    let calls = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = ((_u: string, init: RequestInit) => {
      signals.push(init.signal);
      if (++calls === 1)
        return Promise.resolve({
          ok: true,
          json: async () => ({
            taken_at: now,
            rates: {},
            bows: [mk(100), mk(200)],
          }),
        } as Response);
      // 응답이 영원히 안 오는 서버 — 신호가 끊길 때만 실패한다(실제 fetch 와 같은 계약)
      return new Promise((_resolve, reject) =>
        init.signal!.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      );
    }) as typeof fetch;
    try {
      const first = await marketBoard("warstaff");
      expect(first).not.toBeNull();
      // 타임아웃이 빠지거나 값이 바뀌면 여기서 잡힌다
      expect(timeoutSpy).toHaveBeenCalledWith(15_000);
      // 신호가 fetch 까지 실제로 전달돼야 멎은 응답을 끊을 수 있다
      expect(signals[0]).toBe(ac.signal);

      vi.useFakeTimers();
      vi.setSystemTime(now + 11 * 60 * 1000); // 10분 캐시 만료 → 재요청
      const pending = marketBoard("warstaff");
      expect(calls).toBe(2);
      ac.abort();
      // 끊김을 삼키지 않으면 load() 가 영원히 pending — 이전 캐시(첫 응답)로 돌아와야 한다
      const second = await pending;
      expect(second?.rows.map((r) => r.pdps).sort()).toEqual(
        first!.rows.map((r) => r.pdps).sort(),
      );
    } finally {
      globalThis.fetch = orig;
      vi.useRealTimers();
      timeoutSpy.mockRestore();
    }
  });
});
