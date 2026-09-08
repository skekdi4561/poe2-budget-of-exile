// 소극 수집 — 사용자가 스스로 한 가격 검색의 응답에서 활 매물만 추려
// 익명으로 수합 서버에 보낸다. 추가 거래소 API 호출은 0회다(이미 도착한 응답 재활용).
// 판매자 계정명 등 개인 정보는 수집하지 않는다 — 공개 매물 수치만.
// 행 스키마는 감정소 수집기(serve.py normalize)와 글자 단위로 같아야 한다 —
// 어긋나면 24h 합집합의 지문(fingerprint) 중복 제거가 빗나간다.
import { ParsedItem } from "@/parser";
import { ItemCategory } from "@/parser/meta";

// 수집 대상 판정에 필요한 검색 문맥 — 요청마다 명시로 넘긴다(전역 상태 금지).
// 전역 ctx 를 async 응답 시점에 읽으면, 그 사이 다른 검색이 ctx 를 덮어써
// 비-활(검 등, pdps 존재)이 활 데이터로 오염 업로드된다(실측 재현, 13회차).
export interface HarvestCtx {
  cat: string | null; // 수집 대상이면 거래소 카테고리 id, 아니면 null
  league: string;
}

// 수집 대상 무기 — POE2 에 실제 있는 공격 무기 6종(캐스터 제외).
// serve.py ATTACK_WEAPONS / 워커 CATEGORIES 와 같은 목록이어야 한다.
// 검·도끼·단검·플레일·클로는 아직 게임에 없어 시장이 0건이다(실측).
// ⚠️ pathofexile-trade 의 CATEGORY_TO_TRADE_ID 를 import 하면 순환 참조가 된다
//    (그쪽이 이 파일을 import 한다) — 그래서 여기 따로 적는다.
const COLLECTED_WEAPONS = new Map<ItemCategory, string>([
  [ItemCategory.Bow, "weapon.bow"],
  [ItemCategory.Crossbow, "weapon.crossbow"],
  [ItemCategory.OneHandedMace, "weapon.onemace"],
  [ItemCategory.TwoHandedMace, "weapon.twomace"],
  [ItemCategory.Spear, "weapon.spear"],
  [ItemCategory.Warstaff, "weapon.warstaff"],
  // 부적은 오프핸드 아이콘이지만 마셜(양손 근접) 무기다 — meta.ts 의 WEAPON_TWO_HANDED_MELEE
  // 에 들어 있고 거래 id 도 weapon.talisman 이다(2026-09-05 추가).
  [ItemCategory.Talisman, "weapon.talisman"],
  // 방패는 무기가 아니라 방어구다 — 지표가 DPS 가 아니라 방어도(ar)이고, 아래 normalizeResult
  // 가 serve.py normalize 의 metric!="dps" 분기와 같은 규약으로 ar 을 pdps 자리에 담는다.
  [ItemCategory.Shield, "armour.shield"],
]);

export function harvestCtxOf(item: ParsedItem, league: string): HarvestCtx {
  return { cat: COLLECTED_WEAPONS.get(item.category!) ?? null, league };
}

// Cloudflare Worker 수합 엔드포인트 — 비어 있으면 수집 기능 전체가 꺼진다
export const HARVEST_URL = "https://poe2-bow-harvest.skekdi4561.workers.dev";

// 감정소가 가격으로 받는 화폐 — serve.py PRICE_CURRENCIES 와 같아야 한다(미러 포함: 시장 최상위가 미러 가격)
const TRADE_CURRENCIES = new Set([
  "exalted",
  "chaos",
  "divine",
  "annul",
  "mirror",
]);
const MOD_KEYS = [
  "implicitMods",
  "explicitMods",
  "runeMods",
  "craftedMods",
  "fracturedMods",
  "enchantMods",
  "desecratedMods",
] as const;

interface HarvestRow {
  id: string;
  /** 방패 막기 확률(%). 방어구에만 있고 언제나 양수라 없으면 키를 안 단다. */
  block?: number;
  name: string;
  pdps: number;
  edps: number;
  aps: number;
  crit: number;
  price: number;
  cur: string;
  rarity: string;
  mods: string[];
  fee?: number;
  league: string;
  cat: string; // 무기 종류 — 곡선이 무기별로 갈리므로 필수
}

// 리그는 여기서 걸지 않는다. 예전에는 `league === "Standard"` 를 박아뒀는데 수집기는
// 도전 리그를 뜨고 있어서 스탠다드 매물이 도전 리그 곡선에 섞였다(같은 DPS 가 전혀 다른
// 가격이 된다). 리그는 행에 실어 보내고 **수집기가 자기 리그와 대조해 거른다** — 그래야
// 리그가 바뀌어도 앱 수정이 필요 없다.

// 2026-09-05: 예전에는 카카오 거래소 응답만 보냈다(realm 이 다르면 시장도 다르다고 봤다).
// 실제로는 카카오와 글로벌 거래소에 뜨는 매물이 같다는 것이 확인돼(사용자 실사용 확인) 게이트를
// 풀었다 — 글로벌 이용자의 가격 체크도 표본이 된다. 전제가 틀렸다면 수집기 콘솔의
// "진위 미확인" 수가 뛴다: 최전선을 바꿀 만한 행은 카카오 거래소에 실재하는지 확인한 뒤에만
// 올라가므로, 남의 시장 매물이면 그 확인에서 떨어진다.

function toNumber(s: unknown): number {
  const m = String(s ?? "")
    .replace(/,/g, "")
    .match(/[\d.]+/);
  return m ? +m[0] : 0;
}

// 거래소 property 의 type 코드. serve.py PROP_CRIT/PROP_APS/PROP_BLOCK 과 같은 값이고
// 출처는 EE2 자신의 TradePropType 열거(pathofexile-trade.ts)다.
const PROP_CRIT = 12;
const PROP_APS = 13;
const PROP_BLOCK = 15;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * properties + additionalProperties 에서 값을 꺼낸다. serve.py 의 prop() 과 같은 규약이어야
 * 수집기 행과 크라우드 행이 같은 값을 갖는다.
 *
 * **type 코드를 전 항목에서 먼저** 훑고, 없을 때만 이름 정규식으로 떨어진다. 한 루프에서
 * OR 로 합치면 느슨한 이름이 이웃 속성("막기 회복")에 먼저 걸릴 수 있다.
 *
 * 이름만 보던 판이 실제로 물렸다: 수집기는 type 코드로 방패 막기를 141/141 꺼냈는데,
 * 같은 이름 정규식만 옮긴 오버레이는 크라우드 39행 전부 막기가 비어서 왔다(2026-09-07 실측).
 * 즉 수집기가 성공한 건 코드 덕분이고 이름 정규식은 한 번도 검증된 적이 없었다.
 */
function prop(item: any, re: RegExp, ptype?: number): number {
  const list = [
    ...(item.properties ?? []),
    ...(item.additionalProperties ?? []),
  ];
  const tests: Array<(p: any) => boolean> = [];
  if (ptype != null) tests.push((p) => p.type === ptype);
  tests.push((p) => re.test(String(p.name ?? "")));
  for (const hit of tests) {
    for (const p of list) {
      if (hit(p)) {
        const v = p.values?.[0]?.[0];
        if (v != null) return toNumber(v);
      }
    }
  }
  return 0;
}

// 막기는 extended 에 없다(dps/pdps/edps/ar/ev/es/ward 뿐) — aps/crit 과 같은 properties 채널이다.
// 0 은 "못 읽었다"는 뜻이라 호출부가 키를 안 단다(serve.py·워커와 같은 규약).
const blockOf = (item: any): number =>
  prop(item, /^\[?Block chance|^\[?막기 확률/, PROP_BLOCK);

function modLines(item: any): string[] {
  const out: string[] = [];
  for (const key of MOD_KEYS) {
    for (const m of item[key] ?? []) {
      if (typeof m === "string") out.push(m);
      else if (m?.description) out.push(String(m.description));
    }
  }
  return out;
}

// frameType 은 rarity 문자열이 없을 때의 대비책 (12~14 는 룬 박힌 변형).
// serve.py FRAME_RARITY 와 글자 단위로 같아야 한다.
const FRAME_RARITY: Record<number, string> = {
  0: "Normal",
  1: "Magic",
  2: "Rare",
  3: "Unique",
  12: "Magic",
  13: "Rare",
  14: "Unique",
};
// serve.py rarity_of 의 TS 판 — rarity 문자열이 없거나 이상하면 frameType 으로 보정한다.
// 이게 없으면(예전엔 item.rarity ?? "") API 가 rarity 를 생략한 레어 활이 ""로 저장돼
// Rare 필터에서 빠졌다 — 수집기는 frameType 으로 "Rare"로 넣으므로 크라우드만 조용히 누락됐다.
function rarityOf(item: any): string {
  const r = item.rarity;
  if (r === "Normal" || r === "Magic" || r === "Rare" || r === "Unique")
    return r;
  return FRAME_RARITY[item.frameType] ?? "";
}

// serve.py normalize() 의 TS 판 — null 이면 수집 대상이 아니다 (export 는 테스트 전용)
export function normalizeResult(
  res: any,
  league: string,
  cat = "weapon.bow",
): HarvestRow | null {
  const item = res?.item ?? {};
  const listing = res?.listing ?? {};
  const price = listing.price ?? {};
  if (!price.currency || !price.amount) return null;
  if (!TRADE_CURRENCIES.has(price.currency)) return null;
  const ext = item.extended ?? {};
  // 방어구는 지표가 하나뿐이다. 거래소 extended 에 pdps/edps 가 없고 ar 이 온다 —
  // serve.py normalize 의 metric!="dps" 분기와 **글자 단위로 같은 규약**으로,
  // 주 지표(pdps)에 방어도를 담고 부 지표(edps)는 0 으로 둔다. 그래야 최전선·탐침·
  // 추세·크라우드 게이트가 손 안 대고 그대로 돈다(전부 pdps+edps 를 본다).
  const armour = cat.startsWith("armour.");
  if (armour ? ext.ar == null : ext.pdps == null && ext.edps == null)
    return null;
  const name = [item.name, item.typeLine || item.baseType]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: String(res.id ?? ""),
    name: name || "이름 없음",
    pdps: Math.round((armour ? (ext.ar ?? 0) : (ext.pdps ?? 0)) * 10) / 10,
    edps: armour ? 0 : Math.round((ext.edps ?? 0) * 10) / 10,
    aps: prop(item, /Attacks per Second|초당 공격/, PROP_APS),
    crit: prop(item, /Critical .*Chance|치명타/, PROP_CRIT),
    price: price.amount,
    cur: price.currency,
    rarity: rarityOf(item), // serve.py rarity_of 와 정합 — frameType 폴백 포함
    mods: modLines(item),
    // 막기는 extended 에 없다(dps/pdps/edps/ar/ev/es/ward 뿐) — aps/crit 과 같은 채널이다.
    // 0 은 "못 읽었다"는 뜻이라 키를 안 단다(serve.py·워커와 같은 규약).
    ...(armour && blockOf(item) > 0 ? { block: blockOf(item) } : {}),
    // 카카오 즉시구매 매물은 수수료(fee)가 붙는다 — 수합 서버가 신뢰 필터로 쓴다
    fee: typeof listing.fee === "number" ? listing.fee : undefined,
    league,
    cat,
  };
}
/* eslint-enable */

// 배치 업로드 — 5초 모아 배치로 나눠 보내고, 실패는 조용히 버린다(사용자 경험 우선).
// 한 검색이 최대 100행을 만들 수 있으므로 배치 초과분은 버리지 말고 이어서 보낸다.
// 배치 30행: 실측 행 최대 788B × 30 ≈ 24KB — keepalive 본문 한도(64KB)의 절반 이하.
export const FLUSH_MAX = 30;
export const _queue = new Map<string, HarvestRow>(); // 테스트에서만 직접 접근
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function _flush() {
  flushTimer = null;
  if (!_queue.size || !HARVEST_URL) return;
  const rows: HarvestRow[] = [];
  for (const [k, v] of _queue) {
    rows.push(v);
    _queue.delete(k);
    if (rows.length >= FLUSH_MAX) break;
  }
  fetch(HARVEST_URL + "/harvest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
    keepalive: true,
  }).catch(() => {});
  if (_queue.size) flushTimer = setTimeout(_flush, 1000); // 남은 행 이어 보내기
}

export function harvestFetchResults(results: unknown[], ctx: HarvestCtx) {
  if (!HARVEST_URL || !ctx.cat) return;
  for (const res of results) {
    const row = normalizeResult(res, ctx.league, ctx.cat);
    if (row?.id) _queue.set(row.id, row);
  }
  if (_queue.size && !flushTimer) flushTimer = setTimeout(_flush, 5000);
}
