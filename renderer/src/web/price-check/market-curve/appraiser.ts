// 공격 무기 시세 감정소 — 시장 곡선 데이터 (이 포크의 차별화 기능)
// 데이터는 공개 사이트의 24시간 합집합 스냅샷(latest.json)을 직접 읽는다.
// GitHub Pages 는 CORS 를 열어두므로 렌더러에서 바로 fetch 가 된다 — 별도 프로세스 0.
// 판정·조건 필터 로직은 감정소(serve.py / index.html)와 같은 규칙의 TS 포트다.

const SNAPSHOT_BASE = "https://skekdi4561.github.io/poe2-bow/";
// 활은 latest.json, 다른 공격무기는 latest.<접미사>.json (감정소 serve.py ATTACK_WEAPONS 규칙).
export function snapshotUrl(suffix = ""): string {
  return SNAPSHOT_BASE + (suffix ? `latest.${suffix}.json` : "latest.json");
}

/**
 * 리그와 무기 접미사를 **한 문자열로 접는다**: "hc" + "crossbow" -> "hc.crossbow".
 * snapshotUrl 이 그대로 latest.hc.crossbow.json 을 만들고(감정소 serve.py latest_path 와 같은 규칙),
 * 캐시·inflight 키도 이 문자열 하나라 리그가 섞일 자리가 **원천적으로 없다**.
 *
 * 도전 리그 하드코어만 "hc" 다. 상시 하드코어("Hardcore")는 별개 리그이고 감정소가 안 모으므로
 * 태그를 붙이지 않는다 — 거래소 id 판정은 Prices.ts 의 `startsWith("HC ")` 선례를 따른다.
 */
export const snapKey = (league = "", suffix = ""): string =>
  [league.startsWith("HC ") ? "hc" : "", suffix].filter(Boolean).join(".");
const CACHE_MS = 10 * 60 * 1000; // 사이트 CDN 캐시와 같은 10분
const ROW_TTL = 24 * 60 * 60 * 1000; // 감정소와 같은 규칙: 수집 24시간이 지난 매물은 제외
// 환율 수집이 실패한 스냅샷에서도 축척이 살도록 — 감정소 RATE_DEFAULT 와 같은 값
// **콜드 스타트 전용.** 수집기가 미러 없는 리그(하드코어 — poe.ninja 응답에 mirror 항목이
// 아예 없다)에도 다른 리그의 배수를 빌려 스냅샷에 실어주므로(serve.py _MIRROR_MULT),
// 정상 동작에서는 이 값에 도달하지 않는다.
// ⚠ 안 썩는 값이 아니다: 지난 리그 6500 -> 350(09-06) -> 920(09-08), 같은 리그 안에서도
//   3일에 240~1188 로 움직였다. 값을 키우지 말고 수집기 파생을 고칠 것.
// serve.py MIRROR_IN_DIVINE / index.html MIRROR_IN_DIVINE 과 같은 값.
export const MIRROR_IN_DIVINE = 920; // 2026-09-08 실측 (mirror 116,773 ex / divine 127.2 ex)

// ⚠️ mirror 가 빠지면 rateOf 가 0 을 돌려주지만, 값이 0 인 행은 이미 걸러지므로
// (frontier 의 `r <= 0 || price <= 0` 가드) '공짜로 최전선을 점령'하지는 않는다 —
// 옛 주석이 그렇게 말했지만 사실이 아니다. 폴백의 역할은 그 행을 화면에 남기는 것이다.
// 스냅샷이 오기 전에만 쓰이는 안전망. 2026-09-08 poe.ninja 실측으로 갱신 —
// 직전(09-06) 값은 이틀 만에 chaos 2.28배·divine 1.84배·annul 5.72배 어긋나 있었다.
// 감정소 serve.py DEFAULT_RATES / index.html RATE_DEFAULT 와 같은 값.
const DEFAULT_RATES: Record<string, number> = {
  exalted: 1,
  chaos: 7.77,
  divine: 127.2,
  annul: 53.2,
  mirror: 127.2 * MIRROR_IN_DIVINE,
};

interface SnapshotBow {
  pdps?: number;
  edps?: number;
  // 아이템 자체의 치명타 확률(%). 거래소가 properties 로 주는 **최종값**이라
  // 베이스 + 로컬 증가가 이미 반영돼 있다 — mods 의 "치명타 확률 +N%"(증가분)와 다르다.
  crit?: number;
  // 방패의 막기 확률(%). 같은 채널(properties)에서 오는 최종값이다.
  // 거래소 extended 에는 막기가 없어서(dps/pdps/edps/ar/ev/es/ward 뿐) 이 경로뿐이다.
  block?: number;
  price?: number;
  cur?: string;
  rarity?: string;
  t?: number;
  mods?: string[];
  cond?: string | null;
}
export interface TrendPoint {
  t: number;
  floors: Record<string, number>; // 앵커(문자열) → 그때 최저가(엑잘). "top" = TOP100 진입 최저가
}
export interface Trend {
  anchors: (number | string)[]; // 숫자 = "DPS ≥ a 최저가", "top" = TOP100 진입 최저가(수집기 기본)
  points: TrendPoint[];
}
interface Snapshot {
  taken_at?: number;
  /** 수집기가 실어 보내는 무기 종류. 활(latest.json)에는 없고, 그 부재가 곧 "무기"다. */
  category?: string;
  rates?: Record<string, { rate?: number } | number>;
  bows?: SnapshotBow[];
  trend?: Trend | null;
}

export interface Row {
  d: number;
  p: number;
  t: number;
}
export interface RichRow {
  pdps: number;
  edps: number;
  p: number;
  t: number;
  // 아이템 최종 치확. 옵션(offs)이 아니라 별도 필드인 게 핵심이다 — offs 에 합성 키로 넣으면
  // 이미 있는 "치명타 확률 #%"(모드 증가분) 열쇠와 충돌하고, statOptions 가 그걸 옵션 검색
  // 드롭다운에 올려 "옵션 필터와 분리"라는 요구를 정면으로 어긴다.
  // 옵셔널이 아니라 필수다 — 빠뜨린 자리를 vue-tsc 가 잡아준다.
  crit: number;
  // 방패 막기. 0 은 "미수집"이라는 뜻이다 — 방패는 막기가 언제나 양수라(실측 26~33)
  // 0 이 정상값일 수 없다. 그래서 별도 센티널 없이 0 하나로 구분된다.
  block: number;
  offs: Record<string, number>;
}
// 24h 매물에서 실제로 관측된 옵션 하나 — 필터 검색 목록의 항목
export interface StatOption {
  key: string; // "치명타 확률 #%" 처럼 숫자를 # 으로 지운 옵션 열쇠
  n: number; // 이 옵션을 가진 매물 수
  lo: number; // 관측된 최소값 — 입력 힌트용
  hi: number; // 관측된 최대값
}
// 사용자가 추가한 필터 행 — min/max 모두 비우면 "이 옵션이 있기만 하면"
export interface StatFilter {
  key: string;
  min: number | null;
  max: number | null;
}
export interface MarketBoard {
  rows: RichRow[];
  stats: StatOption[];
  sample: number;
  ageHours: number;
  rates: Record<string, number>;
  rateFallback: boolean;
  staleKept: boolean; // 24h 이내가 부족해 낡은 매물로 대체했는가(수집 중단 추정) — index.html staleKept 와 같음
  trend: Trend | null; // 가격 추세(앵커 DPS 별 최저가 시계열) — 없으면 null
}

// 무기별로 캐시/inflight 를 따로 둔다 — 활과 다른 무기가 서로의 스냅샷을 덮어쓰지 않게.
const cache = new Map<string, { at: number; data: Snapshot | null }>();
const inflightBy = new Map<string, Promise<Snapshot | null>>();

async function fetchSnapshot(suffix = ""): Promise<Snapshot | null> {
  const c = cache.get(suffix);
  if (c && Date.now() - c.at < CACHE_MS) return c.data;
  const pending = inflightBy.get(suffix);
  if (pending) return pending;
  const p = (async () => {
    try {
      const r = await fetch(snapshotUrl(suffix), {
        signal: AbortSignal.timeout(15_000),
      }); // 멎은 응답에 모든 load() 가 묶이지 않게
      const data = (await r.json()) as Snapshot;
      cache.set(suffix, { at: Date.now(), data });
      return data;
    } catch {
      const prev = cache.get(suffix)?.data ?? null;
      cache.set(suffix, { at: Date.now() - CACHE_MS + 60_000, data: prev }); // 실패 시 1분 뒤 재시도
      return prev;
    } finally {
      inflightBy.delete(suffix);
    }
  })();
  inflightBy.set(suffix, p);
  return p;
}

const okRate = (v: unknown): v is number =>
  typeof v === "number" && isFinite(v) && v >= 1;

function parseRates(snap: Snapshot): {
  rates: Record<string, number>;
  fallbackCurs: Set<string>;
} {
  const raw = snap.rates ?? {};
  const rates: Record<string, number> = {};
  const fallbackCurs = new Set<string>();
  for (const c of new Set([
    ...Object.keys(raw),
    ...Object.keys(DEFAULT_RATES),
  ])) {
    const v = raw[c];
    let r = typeof v === "object" && v ? v.rate : (v as number | undefined);
    if (!okRate(r)) {
      r = DEFAULT_RATES[c] ?? 0;
      if (r && c !== "exalted") fallbackCurs.add(c);
    }
    rates[c] = r!;
  }
  // 미러 기본값만 디바인 배수로 갈아 끼운다(위 주석). 실측이 있으면 위 루프가 이미 그걸 넣었다.
  if (fallbackCurs.has("mirror"))
    rates.mirror = rates.divine * MIRROR_IN_DIVINE;
  return { rates, fallbackCurs };
}

// ---------- 옵션 파싱 (index.html 과 같은 규칙) ----------

// DPS 에 이미 계산된 옵션 — 필터 후보에서 뺀다. 느슨하게 잡으면 "반려수의 공격 속도"
// 같은 무관 옵션까지 삼키므로 index.html 과 같은 엄격한 패턴을 유지할 것.
const COUNTED = [
  /increased Physical Damage|^물리 피해 [\d.]+% 증가/i,
  /^Adds \d|^(?:\S+ )?피해 \d+~\d+ 추가/i, // 접두 조건('감전된 적에게 …')이 붙은 추가 피해는 거래소 DPS 밖
  /increased Attack Speed|reduced Attack Speed|^공격 속도 [\d.]+% (증가|감소)/i,
];
// 크라우드 행에는 영어 클라이언트에서 온 것이 섞인다(실측: 전체 mod 줄의 1.6%).
// 한국어 표기만 막으면 같은 옵션이 영문으로 그대로 드롭다운에 오른다.
const JUNK_MOD =
  /^결속됨|^Allocates|시야 반경|Light Radius|투사체 사거리|Projectile Range|능력치 요구사항|Attribute Requirements/;
const JUNK_EXACT = new Set([
  "민첩 #",
  "힘 #",
  "지능 #",
  "모든 능력치 #",
  "+# to Dexterity",
  "+# to Strength",
  "+# to Intelligence",
  "+# to all Attributes",
  "# to Dexterity",
  "# to Strength",
  "# to Intelligence",
  "# to all Attributes",
]);

// "[Physical|물리] 피해" 같은 게임 마크업을 벗긴다
const cleanMod = (m: string) =>
  String(m)
    .replace(/\[([^\]|]*)\|([^\]]*)\]/g, "$2")
    .replace(/\[([^\]]*)\]/g, "$1");
// 숫자를 # 으로 지워 같은 옵션을 같은 열쇠로 묶는다 — 수집기 mod_key 와 글자까지 같아야 한다
export const modKey = (m: string) =>
  cleanMod(m)
    .replace(/[\d.]+/g, "#")
    .replace(/\+\s*#/g, "#")
    .replace(/\s+/g, " ")
    .trim();
const modVal = (m: string) => {
  // 첫 숫자가 아니라 **가장 큰 숫자**를 쓴다. "최근 4초 이내 재장전한 경우 … 30% 확률"
  // 처럼 문턱값이 앞에 오는 옵션에서 첫 숫자를 잡으면 필터가 4 를 값으로 보고 30 이상을
  // 요구하는 조건이 항상 0건이 되며, 관측 힌트(lo~hi)도 거짓을 말한다.
  const ns = String(m).match(/[\d.]+/g);
  return ns ? Math.max(...ns.map(Number).filter((n) => isFinite(n))) : 0;
};
// 방어구(방패)는 지표가 방어도라 세는 옵션이 다르다. 무기 목록을 그대로 쓰면 방어도를
// 만드는 옵션이 '방어도 밖 옵션' 상위를 차지하고, 그걸 조건으로 걸면 "이 조건을 걸면 같은
// 방어도를 사는 데 더 든다"는 정반대 결론이 나온다 — 걸린 조건 자체가 방어도를 올린다.
// 감정소 사이트 index.html 의 COUNTED_ARM 과 **같은 목록이어야 한다**.
const COUNTED_ARM = [
  /increased Armour(?!,)|^방어도 [\d.]+% 증가/i,
  /increased Armour, Evasion and Energy Shield|^방어도, 회피, 에너지 보호막 [\d.]+% 증가/i,
  /to Armour$|^방어도 \+?\d/i,
];
export const isOffDps = (m: string, armour = false) => {
  const c = cleanMod(m);
  return !(armour ? COUNTED_ARM : COUNTED).some((re) => re.test(c));
};

// 활 하나의 { 옵션 열쇠: 값 } — 같은 열쇠가 여러 번이면 큰 값
function offMods(mods: string[], armour = false): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of mods) {
    if (!isOffDps(m, armour) || JUNK_MOD.test(cleanMod(m))) continue;
    if (JUNK_EXACT.has(modKey(m))) continue;
    const k = modKey(m);
    const v = modVal(m);
    if (!(k in out) || v > out[k]) out[k] = v;
  }
  return out;
}

// 옵션 표시 순서 — 감정소 index.html 의 optRank/byUsefulness 와 같은 규칙이어야 한다.
// 빈도만으로 줄세우면 유용도와 어긋난다(실측: 활에서 "반려수의 공격 속도" 133 이
// "모든 투사체 스킬 레벨" 120 보다 위였다 — 앞은 동료 빌드 전용이라 무기 값과 거의 무관).
//   0 = 무기 성능 직결 / 1 = 그 외 / 2 = 무기가 아닌 대상(반려수·소환수)
const OPT_TOP =
  /스킬 레벨|치명타|흡수|추가로 발사|추가 화살|Skill Level|Critical|Leech/;
const OPT_BOTTOM = /반려수|소환수|Companion|Minion/;
export function optRank(key: string): number {
  if (OPT_BOTTOM.test(key)) return 2;
  if (OPT_TOP.test(key)) return 0;
  return 1;
}

// 24h 매물에서 관측된 옵션 전체 목록 — 거래소 필터처럼 검색해 고른다
export function statOptions(rows: RichRow[]): StatOption[] {
  const agg = new Map<string, { n: number; lo: number; hi: number }>();
  for (const r of rows)
    for (const [k, v] of Object.entries(r.offs)) {
      const a = agg.get(k);
      if (!a) agg.set(k, { n: 1, lo: v, hi: v });
      else {
        a.n++;
        if (v < a.lo) a.lo = v;
        if (v > a.hi) a.hi = v;
      }
    }
  return [...agg.entries()]
    .filter(([, a]) => a.n >= 2) // 곡선이 성립하려면 최소 2개
    .map(([key, a]) => ({ key, n: a.n, lo: a.lo, hi: a.hi }))
    .sort((a, b) => optRank(a.key) - optRank(b.key) || b.n - a.n);
}

// 필터 행 전부 만족해야 통과. min/max 비우면 "옵션 존재"만 본다.
export function matchesFilters(
  offs: Record<string, number>,
  filters: StatFilter[],
): boolean {
  return filters.every((f) => {
    if (!(f.key in offs)) return false; // 존재 판정은 값이 아니라 열쇠로 — 값 없는 옵션이 '죽은 필터'가 됐다
    const v = offs[f.key] || 0;
    if (f.min != null && v < f.min) return false;
    if (f.max != null && v > f.max) return false;
    return true;
  });
}

// 지표별 행 변환 — 선택 지표가 0인 활(예: 원소 지표에서 물리 전용 활)은
// 제외한다 — index.html 의 v.d > 0 규칙과 같아야 두 화면의 곡선이 일치한다.
export function metricRows(
  rows: RichRow[],
  metric: "total" | "phys" | "ele",
): Row[] {
  return rows
    .map((r) => ({
      d:
        metric === "phys"
          ? r.pdps
          : metric === "ele"
            ? r.edps
            : r.pdps + r.edps,
      p: r.p,
      t: r.t,
    }))
    .filter((r) => r.d > 0);
}

// ---------- 최전선 ----------

// 감정소 frontier 와 같은 판정(동점 전원 생존) — DPS 내림차순 한 번 훑기
export function frontier(rows: Row[]): Row[] {
  const s = [...rows].sort((a, b) => b.d - a.d || a.p - b.p);
  const out: Row[] = [];
  let best = Infinity;
  for (let i = 0; i < s.length; ) {
    // NaN 은 자기 자신과도 같지 않아 j 가 안 늘고 무한 루프가 된다(렌더러가 통째로 멈춘다).
    // 지금 UI 경로로는 NaN 이 안 들어오지만, 결과가 "앱이 죽는다"라 가드가 훨씬 싸다.
    let j = i + 1;
    while (j < s.length && s[j].d === s[i].d) j++;
    const gmin = s[i].p;
    if (gmin < best) {
      for (let k = i; k < j && s[k].p === gmin; k++) out.push(s[k]);
      best = gmin;
    }
    i = j;
  }
  return out.reverse();
}

// 숫자 형식은 **사용자 언어**를 따라야 한다. 예전엔 "ko-KR" 이 박혀 있어서 독일·프랑스·
// 러시아·포르투갈·스페인 사용자가 소수점과 천단위 구분자가 뒤바뀐 숫자를 봤다
// (de 는 1.234.567,89 가 맞는데 1,234,567.89 로 나왔다 — 값을 오독할 수 있다).
// i18n 의 loadLang 이 document.documentElement.lang 을 이미 설정하므로 그걸 읽는다.
// 테스트는 node 환경이라 document 가 없다 — 방어하고, 호출부가 로케일을 직접 줄 수도 있게 한다
// (그래야 테스트가 실행 환경의 기본 로케일에 흔들리지 않는다).
export function uiLocale(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.documentElement.lang || undefined;
}

// 1 디바인어치부터 div 표기 — 감정소 money() 와 같은 규칙
export function formatEx(
  vEx: number,
  rates: Record<string, number>,
  locale: string | undefined = uiLocale(),
): string {
  const dv = rates.divine ?? 0;
  const useDiv = okRate(dv) && dv > 1 && Math.abs(vEx) >= dv;
  const v = useDiv ? vEx / dv : vEx;
  const a = Math.abs(v);
  const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4;
  const num = v.toLocaleString(locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return num + (useDiv ? " div" : " ex");
}

// 가격축 눈금 — lo/hi 는 log10 가격, first/last 는 최전선 양 끝 가격(엑잘).
// 10 의 거듭제곱 눈금이 2개 미만(가격 폭이 한 자릿수 안)이면 축이 비므로 양 끝값으로 대신한다.
export function priceTicks(
  lo: number,
  hi: number,
  first: number,
  last: number,
): number[] {
  const ticks: number[] = [];
  for (let k = Math.ceil(lo); k <= Math.floor(hi); k++)
    ticks.push(Math.pow(10, k));
  return ticks.length < 2 ? [first, last] : ticks;
}

// 신뢰 경계(네트워크 fetch JSON)에서 숫자를 강제한다 — pdps 가 문자열 "227" 로
// 오면 pdps+edps 가 문자열 결합("22738")되어 frontier 정렬을 통째로 망가뜨린다(실측).
// serve.py/worker 가 숫자를 보장하지만, 읽는 쪽도 방어하는 게 4회차 원칙의 연장이다.
const numOr0 = (v: unknown): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

// 스냅샷 → 24h 유효 매물 목록 (순수 함수라 테스트 가능)
export function rowsFromSnapshot(
  snap: Snapshot,
  rates: Record<string, number>,
  fallbackCurs: Set<string>,
  now: number = Date.now(),
): { rows: RichRow[]; rateFallback: boolean; staleKept: boolean } {
  const cut = now - ROW_TTL;
  // 지표는 카테고리가 정한다 — 옵션이 지표에 이미 들었는지 판정이 무기와 방어구에서 갈린다.
  const armourCat = (snap.category ?? "").startsWith("armour.");
  let rateFallback = false;
  const fresh: RichRow[] = [];
  const all: RichRow[] = [];
  for (const b of snap.bows ?? []) {
    if ((b.rarity || "Rare") !== "Rare") continue; // 빈 문자열도 Rare 로 — 사이트·serve.py 와 같은 규칙(?? 는 이식 오류)
    const r = rates[b.cur ?? ""] ?? 0;
    const price = numOr0(b.price);
    if (r <= 0 || price <= 0) continue;
    const t = numOr0(b.t) || numOr0(snap.taken_at);
    const pdps = numOr0(b.pdps);
    const edps = numOr0(b.edps);
    if (pdps + edps <= 0) continue;
    if (fallbackCurs.has(b.cur!)) rateFallback = true;
    // 여기가 스냅샷 필드를 골라 담는 **유일한** 지점이다 — 여기 안 적으면 조용히 사라진다.
    const row = {
      pdps,
      edps,
      p: price * r,
      t,
      crit: numOr0(b.crit),
      block: numOr0(b.block),
      offs: offMods(b.mods ?? [], armourCat),
    };
    all.push(row);
    if (t >= cut) fresh.push(row);
  }
  // 신선분이 곡선을 못 그릴 만큼 적으면(수집 중단 추정) 낡은 매물이라도 보여준다 —
  // 빈 화면/"불러오지 못함"은 고장으로 보인다. index.html partition 의 staleKept 와 같은 규칙.
  if (fresh.length < 2 && all.length >= 2) {
    return { rows: all, rateFallback, staleKept: true };
  }
  return { rows: fresh, rateFallback, staleKept: false };
}

// 스냅샷 → 24h 유효 매물(옵션 포함) + 옵션 목록 + 환율
/** 화면이 사유별로 다른 문구를 쓸 수 있게 실패를 구분해 알린다. 접미사 유무로 추론하면
 *  인터넷이 끊긴 사용자가 활에서는 "못 불러왔다", 방패에서는 "아직 수집 안 됨"을 본다. */
export let lastBoardError: "fetch" | "empty" | null = null;

export async function marketBoard(
  suffix = "",
  league = "",
): Promise<MarketBoard | null> {
  const snap = await fetchSnapshot(snapKey(league, suffix));
  if (!snap) {
    lastBoardError = "fetch";
    return null;
  }
  if (!snap.bows?.length) {
    lastBoardError = "empty";
    return null;
  }
  lastBoardError = null;

  const { rates, fallbackCurs } = parseRates(snap);
  const { rows, rateFallback, staleKept } = rowsFromSnapshot(
    snap,
    rates,
    fallbackCurs,
  );
  if (rows.length < 2) {
    lastBoardError = "empty";
    return null;
  }

  return {
    rows,
    stats: statOptions(rows),
    sample: rows.length,
    ageHours: (Date.now() - Math.max(...rows.map((r) => r.t))) / 3_600_000,
    rates,
    rateFallback,
    staleKept,
    trend: snap.trend ?? null,
  };
}
