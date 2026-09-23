// 옵션 이름을 앱 언어로 보여주고, 같은 스탯을 원문 언어와 상관없이 하나로 묶는다.
//
// 곡선에 실린 옵션 문구는 거래소 응답 원문이라 **두 언어가 섞여 온다** — 수집기와 카카오
// 사용자의 크라우드 표본은 한국어, 글로벌 사용자의 크라우드 표본은 영어다(2026-09-05 에
// realm 게이트를 푼 뒤부터). 원본(EE2)이 언어별 스탯 표를 들고 있어서,
// 원문 표기 → 언어 무관 ref → 지금 언어 표기로 두 번 옮기면 해결된다.
//
// **묶기(statId).** 예전엔 옵션을 원문 문구 그대로 모아서, 같은 스탯이 한국어·영어로 두 번
// 올랐고 하나를 골라 필터하면 다른 언어로 온 매물이 전부 빠졌다(2026-09-24 실측: 스냅샷
// 16개에서 26종·40건, 매물 2,223개 중 339개 누락). 그래서 한국어·영어 표를 **언제나 둘 다**
// 받아 원문 → {ref, 부호} 로 정체를 정하고, 옵션·필터는 그 정체로 묶는다.
// 원문이 이미 지금 언어면 번역하지 않고 그대로 보여준다 — 한국어·영어 사용자의 기존 표시는
// 바뀌지 않는다.
//
// **부호를 기억한다.** 스탯 표는 "증폭/감폭", "증가/감소"를 한 ref 에 묶고 뒤쪽을 negate 로
// 표시한다. 예전엔 원문이 negate 쪽이어도 번역을 matchers[0](양수 쪽)으로 골라서,
// "공격 피해 20% 감폭"이 영어 UI 에서 "#% more Attack Damage"로 떴다 — 필터로 고르면 정반대
// 매물이 걸렸다(2026-09-23 실측: 스냅샷 16개에서 3종·78건, ko 외 모든 언어).
//
// **거래소 스탯 id 로 보강한다.** ref 이름이 언어마다 다르거나(cmn-Hant·es 의 기절 축적),
// 한국어판이 문구가 같은 두 스탯을 한 항목으로 묶은 경우(무기 흡수 local/전역)는 ref 로는
// 못 찾는다. 그때만 원문 항목의 거래소 스탯 id 로 지금 언어 표를 찾고, 같은 부호의 문구가
// **딱 하나**일 때만 쓴다(둘 이상이면 다른 스탯을 섞게 된다 — 2026-09-24 점검에서 확인).
//
// 못 찾은 옵션은 원문 그대로 둔다 — 빈 칸이나 키 이름이 뜨는 것보다 낫다.
import { ref } from "vue";
import { AppConfig } from "@/web/Config";
import { STAT_BY_REF, STATS_ITERATOR } from "@/assets/data";
import { modKey } from "./appraiser";

// 표가 준비되면 올라간다. 화면이 이 값을 읽어 두면 로딩이 끝났을 때 저절로 다시 그려진다.
export const statTextRev = ref(0);

/** 원문 표기 하나가 가리키는 스탯 — ref, 부호(negate), 어느 표에서 왔는지, 거래소 스탯 id. */
export type RefEntry = {
  ref: string;
  neg: boolean;
  lang?: string;
  ids?: string[];
};
type StatLine = {
  ref?: string;
  id?: string;
  matchers?: Array<{ string?: string; negate?: boolean }>;
  trade?: { ids?: Record<string, string[]> };
};
let refIndex: Map<string, RefEntry> | null = null;
// 어느 언어 기준으로 준비했는지 — 설정에서 언어를 바꿔도 앱을 껐다 켜지 않게 한다.
let builtFor: string | null = null;
// 스탯 id 대체 경로의 결과(표를 훑으므로 비싸다). 언어가 열쇠에 들어 있다.
const viaIdMemo = new Map<string, string | null>();

// 옵션 정체를 정하는 원문 언어 — 수집되는 원문은 이 둘뿐이다.
export const SOURCE_LANGS = ["ko", "en"] as const;

/** 거래소 스탯 id 의 숫자 부분 — explicit/implicit/rune/... 어디에 있든 같은 스탯이다. */
const statIds = (o: StatLine): string[] => [
  ...new Set(
    Object.values(o.trade?.ids ?? {})
      .flat()
      .map((s) => /stat_(\d+)/.exec(s)?.[1])
      .filter((x): x is string => !!x),
  ),
];

/** stats.ndjson 한 덩어리에서 "정규화된 원문 표기 → 스탯" 표를 만든다. */
export function buildRefIndex(
  ndjson: string,
  lang?: string,
): Map<string, RefEntry> {
  const out = new Map<string, RefEntry>();
  for (const line of ndjson.split("\n")) {
    if (!line.trim()) continue;
    let o: StatLine;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // 한 줄이 깨져도 나머지는 쓴다
    }
    if (!o.ref) continue;
    const ids = statIds(o);
    for (const m of o.matchers ?? []) {
      const k = modKey(m.string ?? "");
      // 먼저 나온 matcher 를 이긴다 — 뒤엣것은 대개 값이 1 로 고정된 특수형이다
      if (k && !out.has(k))
        out.set(k, {
          ref: o.ref,
          neg: m.negate === true,
          ...(lang ? { lang } : {}),
          ...(ids.length ? { ids } : {}),
        });
    }
  }
  return out;
}

/**
 * 한국어판은 문구가 같은 두 스탯을 한 항목으로 묶고 id 를 둘 다 단다 — 예: 무기 고유
 * "Leeches #% of Physical Damage as Life"(local)와 전역 "Leech #% of Physical Attack Damage
 * as Life" 가 둘 다 "물리 공격 피해의 #%를 생명력으로 흡수"다. 시장 곡선은 무기·방패의 옵션만
 * 다루므로, 묶인 id 가 영어 표에서 서로 다른 스탯이고 그중 **local 이 하나**면 그쪽으로 본다.
 * 그래야 영어 크라우드가 보내는 같은 옵션과 한 줄로 묶이고, 다른 언어 UI 에서 전역 스탯의
 * 문구가 뜨지 않는다(점검 실측: 한국어 원문 634건이 6개 언어에서 다른 스탯 문구로 떴다).
 */
export function preferLocal(idx: Map<string, RefEntry>, enNdjson: string) {
  const byId = new Map<string, { ref: string; local: boolean }>();
  for (const line of enNdjson.split("\n")) {
    if (!line.trim()) continue;
    let o: StatLine;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (!o.ref) continue;
    for (const id of statIds(o))
      if (!byId.has(id))
        byId.set(id, { ref: o.ref, local: !!o.id?.startsWith("local_") });
  }
  for (const e of idx.values()) {
    if (e.lang === "en" || !e.ids || e.ids.length < 2) continue;
    const refs = new Map<string, boolean>();
    for (const id of e.ids) {
      const s = byId.get(id);
      if (s) refs.set(s.ref, s.local);
    }
    if (refs.size < 2) continue;
    const locals = [...refs].filter(([, local]) => local);
    if (locals.length === 1) e.ref = locals[0][0];
  }
}

export async function initStatText(): Promise<void> {
  const lang = AppConfig().language;
  if (builtFor === lang) return;
  builtFor = lang;
  const idx = new Map<string, RefEntry>();
  let en = "";
  for (const l of SOURCE_LANGS) {
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}data/${l}/stats.ndjson`,
        {
          signal: AbortSignal.timeout(15_000),
        },
      );
      const text = await r.text();
      if (l === "en") en = text;
      for (const [k, v] of buildRefIndex(text, l)) {
        if (!idx.has(k)) idx.set(k, v); // 두 언어 표기는 겹치지 않는다 — 방어만
      }
    } catch {
      // 한 표가 실패해도 나머지로 돈다. 다 실패하면 화면은 원문 그대로 멀쩡히 돈다.
    }
  }
  if (en) preferLocal(idx, en);
  refIndex = idx;
  viaIdMemo.clear();
  statTextRev.value++;
}

function lookup(key: string): RefEntry | undefined {
  if (!refIndex) return undefined;
  // "모든 원소 저항 -20%" — 음수 값이 붙은 양수 스탯이다. 표의 표기는 부호 없는 "#%" 다.
  return (
    refIndex.get(key) ??
    (key.includes("-#") ? refIndex.get(key.replace(/-#/g, "#")) : undefined)
  );
}

/** 같은 부호의 표기. 양수 표기가 하나도 없는 항목은 부호 표시가 틀린 데이터라 양수로 읽는다
 *  (ru "Вызывает увеличенное на #% накопление оглушения" — 뜻은 증가인데 negate 로만 달려 있다). */
function sameSign(
  s: { matchers?: Array<{ string?: string; negate?: boolean }> } | undefined,
  neg: boolean,
): string | undefined {
  const ms = s?.matchers ?? [];
  if (ms.length && ms.every((m) => m.negate === true))
    return neg ? undefined : ms[0].string;
  return ms.find((m) => (m.negate === true) === neg)?.string;
}

/** ref 로 못 찾을 때만 — 원문 항목의 스탯 id 로 지금 언어 표를 찾아 문구가 하나일 때만 쓴다. */
function viaTradeId(e: RefEntry, lang: string): string | undefined {
  if (!e.ids?.length) return undefined;
  const memoKey = `${lang}\u0000${e.neg}\u0000${e.ids.join(",")}`;
  if (viaIdMemo.has(memoKey)) return viaIdMemo.get(memoKey) ?? undefined;
  const texts = new Set<string>();
  for (const id of e.ids)
    for (const s of STATS_ITERATOR(`stat_${id}"`)) {
      if (!statIds(s as StatLine).includes(id)) continue;
      const t = sameSign(s, e.neg);
      if (t) texts.add(modKey(t));
    }
  const one = texts.size === 1 ? [...texts][0] : null;
  viaIdMemo.set(memoKey, one);
  return one ?? undefined;
}

/** 같은 스탯이면 원문 언어와 상관없이 같은 열쇠. 표에 없으면 원문 그대로. */
export function statId(key: string): string {
  // 표가 늦게 오면 다시 묶도록 반응형 의존성만 읽는다(statText 와 같은 관용).
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  statTextRev.value;
  const e = lookup(key);
  return e ? (e.neg ? `-${e.ref}` : e.ref) : key;
}

/** 옵션 열쇠(원문 정규형 — 한국어 또는 영어)를 지금 언어의 표기로. 모르면 그대로 돌려준다. */
export function statText(key: string): string {
  // 표가 늦게 오면 다시 그리도록 **일부러** 반응형 의존성만 읽는다(값은 안 쓴다).
  // Vue 에서 흔한 관용이라 규칙을 이 한 줄만 끈다 — void 는 no-void 에 걸리고,
  // 변수에 담으면 미사용 변수가 된다.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  statTextRev.value;
  const e = lookup(key);
  if (!e) return key;
  const lang = AppConfig().language;
  if (e.lang === lang) return key; // 원문이 곧 지금 언어 — 다시 쓰지 않는다
  // 원문과 **같은 부호**의 표기를 고른다 — 첫 표기는 대개 양수 쪽이다
  const local = sameSign(STAT_BY_REF(e.ref), e.neg) ?? viaTradeId(e, lang);
  if (local) return modKey(local);
  // 같은 부호 표기가 없으면: 양수는 ref(영문 정본)로, 음수는 원문 그대로 —
  // ref 는 양수 쪽 문구라 음수 원문을 ref 로 바꾸면 뜻이 뒤집힌다.
  return e.neg ? key : e.ref;
}

/** 묶인 원문 열쇠들 중 하나를 골라 보여준다 — 지금 언어 원문이 있으면 그것, 없으면 첫째. */
export function statLabel(keys: string[]): string {
  const lang = AppConfig().language;
  return statText(keys.find((k) => lookup(k)?.lang === lang) ?? keys[0]);
}

/** 테스트 전용 — 표를 직접 밀어 넣는다. */
export function _setRefIndex(m: Map<string, RefEntry> | null): void {
  refIndex = m;
  builtFor = null;
  viaIdMemo.clear();
  statTextRev.value++;
}
