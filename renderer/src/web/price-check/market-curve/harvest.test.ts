// 업로드 큐: 배치 초과분이 유실되지 않고 이어 전송되는지 (2회차 자가검증에서 잡은 결함)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _queue, _flush, FLUSH_MAX } from "./harvest";

function fakeRow(i: number) {
  return {
    id: "row" + i,
    name: "활" + i,
    pdps: 100 + i,
    edps: 0,
    aps: 1.2,
    crit: 5,
    price: 3,
    cur: "divine",
    rarity: "Rare",
    mods: ["옵션 +1"],
    league: "Standard",
  };
}

describe("flush 배치", () => {
  const sent: number[] = [];
  beforeEach(() => {
    sent.length = 0;
    _queue.clear();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body).rows.length);
        return Promise.resolve(new Response("{}"));
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("배치 초과분은 버리지 않고 이어서 보낸다", () => {
    for (let i = 0; i < 70; i++) _queue.set("row" + i, fakeRow(i) as never);
    _flush();
    expect(sent).toEqual([FLUSH_MAX]);
    expect(_queue.size).toBe(70 - FLUSH_MAX);
    vi.advanceTimersByTime(1100);
    vi.advanceTimersByTime(1100);
    expect(sent).toEqual([FLUSH_MAX, FLUSH_MAX, 70 - 2 * FLUSH_MAX]);
    expect(_queue.size).toBe(0);
  });

  it("본문이 keepalive 한도(64KB) 안에 든다 — 실측 최대 행 기준", () => {
    const fat = fakeRow(0);
    fat.mods = Array(12).fill(
      "아주 긴 한글 옵션 문자열이라고 가정한 것 ##.#% 증가",
    );
    const body = JSON.stringify({ rows: Array(FLUSH_MAX).fill(fat) });
    expect(new TextEncoder().encode(body).length).toBeLessThan(64 * 1024);
  });
});

import { harvestCtxOf } from "./harvest";
import { ItemCategory } from "@/parser/meta";

describe("harvestCtxOf (수집 대상 무기 판정 · 경쟁 조건 방지)", () => {
  it("검색마다 독립 문맥 — 나중 검색이 앞 검색 문맥을 덮지 않는다", () => {
    const bow = harvestCtxOf(
      { category: ItemCategory.Bow } as never,
      "Standard",
    );
    const sword = harvestCtxOf(
      { category: ItemCategory.OneHandedSword } as never,
      "Standard",
    );
    // 전역 상태가 아니라 값이므로, 둘째 호출이 첫째를 오염시키지 않는다
    expect(bow.cat).toBe("weapon.bow");
    expect(sword.cat).toBeNull();
  });
  it("POE2 에 있는 공격 무기 7종은 각자 카테고리로 수집된다", () => {
    const cases: Array<[ItemCategory, string]> = [
      [ItemCategory.Bow, "weapon.bow"],
      [ItemCategory.Crossbow, "weapon.crossbow"],
      [ItemCategory.OneHandedMace, "weapon.onemace"],
      [ItemCategory.TwoHandedMace, "weapon.twomace"],
      [ItemCategory.Spear, "weapon.spear"],
      [ItemCategory.Warstaff, "weapon.warstaff"],
      // 부적은 오프핸드 아이콘이라 빠뜨리기 쉽다 — serve.py ATTACK_WEAPONS·워커
      // CATEGORIES 와 셋이 같아야 곡선이 뜬다
      [ItemCategory.Talisman, "weapon.talisman"],
    ];
    for (const [cat, id] of cases) {
      expect(harvestCtxOf({ category: cat } as never, "L").cat).toBe(id);
    }
  });
  it("캐스터·미출시 무기·방어구는 수집 대상이 아니다(cat=null)", () => {
    for (const cat of [
      ItemCategory.Wand,
      ItemCategory.Sceptre,
      ItemCategory.Staff,
      ItemCategory.OneHandedSword,
      ItemCategory.TwoHandedAxe,
      ItemCategory.Dagger,
      ItemCategory.Claw,
      ItemCategory.Boots,
    ]) {
      expect(harvestCtxOf({ category: cat } as never, "L").cat).toBeNull();
    }
  });
  it("카테고리가 없는 아이템도 안 죽는다", () => {
    expect(harvestCtxOf({} as never, "L").cat).toBeNull();
  });
});

import { normalizeResult } from "./harvest";

describe("normalizeResult — serve.py normalize 정합", () => {
  const base = {
    id: "x1",
    item: { extended: { pdps: 100, edps: 0 }, typeLine: "고급 활" },
    listing: { price: { currency: "divine", amount: 3 } },
  };
  it("rarity 문자열이 있으면 그대로", () => {
    const r = normalizeResult(
      { ...base, item: { ...base.item, rarity: "Rare" } },
      "Standard",
    );
    expect(r?.rarity).toBe("Rare");
  });
  it("rarity 누락 + frameType=2 → 'Rare' (frameType 폴백, serve.py rarity_of 와 정합)", () => {
    // 이 폴백이 없으면 API 가 rarity 를 생략한 레어 활이 ''로 저장돼 곡선에서 빠졌다
    const r = normalizeResult(
      { ...base, item: { ...base.item, frameType: 2 } },
      "Standard",
    );
    expect(r?.rarity).toBe("Rare");
  });
  it("rarity·frameType 둘 다 없으면 ''", () => {
    const r = normalizeResult(base, "Standard");
    expect(r?.rarity).toBe("");
  });
  it("룬 변형 frameType 13 → 'Rare'", () => {
    const r = normalizeResult(
      { ...base, item: { ...base.item, frameType: 13 } },
      "Standard",
    );
    expect(r?.rarity).toBe("Rare");
  });
  it("pdps 반올림은 half-up — serve.py round1 과 지문 일치", () => {
    // 224.25 → 224.3 (half-up). Python round()(banker's)면 224.2 라 지문이 갈렸다.
    const r = normalizeResult(
      {
        ...base,
        item: {
          ...base.item,
          extended: { pdps: 224.25, edps: 0 },
          rarity: "Rare",
        },
      },
      "Standard",
    );
    expect(r?.pdps).toBe(224.3);
  });
});

describe("normalizeResult 미러 가격", () => {
  it("mirror 화폐 매물을 버리지 않는다 (serve.py PRICE_CURRENCIES 정합)", () => {
    const r = normalizeResult(
      {
        id: "m1",
        item: {
          extended: { pdps: 1500, edps: 0 },
          typeLine: "활",
          rarity: "Rare",
        },
        listing: { price: { currency: "mirror", amount: 1 } },
      },
      "Standard",
    );
    expect(r?.cur).toBe("mirror");
  });
});

import { harvestFetchResults } from "./harvest";

// 2026-09-05: 카카오/글로벌 거래소에 뜨는 매물이 같다는 것이 확인돼 realm 게이트를 풀었다.
// 이제는 어느 거래소 응답이든 큐에 넣는다 — 리그 대조와 진위 확인이 뒤에서 거른다.
describe("harvestFetchResults — 거래소를 가리지 않는다", () => {
  const ctx = { cat: "weapon.bow", league: "L" };
  const res = {
    id: "k1",
    item: { extended: { pdps: 100, edps: 0 }, typeLine: "활", rarity: "Rare" },
    listing: { price: { currency: "divine", amount: 3 } },
  };
  beforeEach(() => {
    _queue.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    _queue.clear();
    vi.runAllTimers(); // 5초 flush 타이머를 비워 다음 테스트로 새지 않게
    vi.useRealTimers();
  });
  it("어느 거래소 응답이든 큐에 넣는다", () => {
    harvestFetchResults([res], ctx);
    expect(_queue.size).toBe(1); // 게이트가 뒤집히면 수집이 통째로 꺼진다
  });
  it("무기가 아니면(cat 없음) 넣지 않는다 — 곡선이 무기별이라 분류 못 하면 쓸모없다", () => {
    harvestFetchResults([res], { cat: null, league: "L" });
    expect(_queue.size).toBe(0);
  });
  it("행에 문맥의 cat 과 league 를 싣는다", () => {
    // 수합 서버는 이 cat 으로 무기별 창을 나눈다 — 안 실리거나 틀리면 전부 활로 섞인다
    harvestFetchResults([res], {
      cat: "weapon.talisman",
      league: "Forbidden Rites",
    });
    const row = [..._queue.values()][0] as unknown as {
      cat: string;
      league: string;
    };
    expect([row.cat, row.league]).toEqual([
      "weapon.talisman",
      "Forbidden Rites",
    ]);
  });
  it("큐에 넣으면 5초 뒤 전송 타이머가 걸린다", () => {
    // 타이머를 안 걸면 행이 큐에 영원히 쌓이기만 하고 수집이 통째로 죽는다.
    // afterEach 의 runAllTimers 가 이걸 조용히 덮고 있었다.
    const sent: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body).rows);
        return Promise.resolve(new Response("{}"));
      }),
    );
    harvestFetchResults([res], ctx);
    vi.advanceTimersByTime(4900);
    expect(sent.length).toBe(0);
    vi.advanceTimersByTime(200);
    expect(sent.length).toBe(1);
    expect(_queue.size).toBe(0);
    vi.unstubAllGlobals();
  });
});

// 2026-09-07 실측: 방패 크라우드 39행이 전부 **막기 없이** 들어왔다.
// 수집기(serve.py)는 141/141 꺼냈는데, 그건 **type 코드** 덕분이었고 이름 정규식은 한 번도
// 검증된 적이 없었다. 그 이름 정규식만 오버레이에 옮겼으니 안 잡힌 것이다.
// 앞선 검사들은 "소스에 이 문자열이 있는가"만 봤기 때문에 이걸 못 잡았다 — 그래서 여기서는
// **실제 거래소 응답 모양을 넣어 나온 행을 본다.**
describe("normalizeResult — 방패(방어구)", () => {
  const listing = { price: { currency: "divine", amount: 2 } };
  const shield = (props: unknown[]) => ({
    id: "s1",
    item: {
      typeLine: "거대 방패",
      rarity: "Rare",
      extended: { ar: 900 },
      properties: props,
    },
    listing,
  });

  it("이름이 안 맞아도 type 코드로 막기를 꺼낸다", () => {
    // 이게 실제로 물린 경우 — 이름이 뭐든 코드가 15면 막기다
    const row = normalizeResult(
      shield([{ type: 15, name: "무슨이름이든", values: [["26%", 0]] }]),
      "L",
      "armour.shield",
    );
    expect(row?.block).toBe(26);
  });

  it("type 이 없으면 이름으로 떨어진다", () => {
    const row = normalizeResult(
      shield([{ name: "막기 확률", values: [["30%", 0]] }]),
      "L",
      "armour.shield",
    );
    expect(row?.block).toBe(30);
  });

  it("additionalProperties 에 있어도 찾는다 — serve.py 가 두 배열을 다 훑는다", () => {
    const row = normalizeResult(
      {
        id: "s2",
        item: {
          typeLine: "거대 방패",
          rarity: "Rare",
          extended: { ar: 900 },
          properties: [],
          additionalProperties: [
            { type: 15, name: "막기 확률", values: [["28%", 0]] },
          ],
        },
        listing,
      },
      "L",
      "armour.shield",
    );
    expect(row?.block).toBe(28);
  });

  it("이웃 속성(막기 회복)을 막기로 착각하지 않는다", () => {
    const row = normalizeResult(
      shield([{ type: 99, name: "막기 회복", values: [["77", 0]] }]),
      "L",
      "armour.shield",
    );
    expect(row?.block).toBeUndefined();
  });

  it("방어도는 주 지표(pdps)에 담기고 부 지표는 0 — serve.py 와 같은 규약", () => {
    const row = normalizeResult(shield([]), "L", "armour.shield");
    expect([row?.pdps, row?.edps]).toEqual([900, 0]);
    expect("block" in (row ?? {})).toBe(false); // 못 읽으면 키를 안 단다
  });

  it("무기 행에는 막기를 안 단다", () => {
    const bow = {
      id: "b1",
      item: {
        typeLine: "활",
        rarity: "Rare",
        extended: { pdps: 500, edps: 100 },
        properties: [{ type: 15, name: "막기 확률", values: [["26%", 0]] }],
      },
      listing,
    };
    const row = normalizeResult(bow, "L", "weapon.bow");
    expect("block" in (row ?? {})).toBe(false);
  });
});
