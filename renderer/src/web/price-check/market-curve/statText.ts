// 옵션 이름을 앱 언어로 보여준다.
//
// 곡선에 실린 옵션 문구는 거래소 응답 원문이라 **두 언어가 섞여 온다** — 수집기와 카카오
// 사용자의 크라우드 표본은 한국어, 글로벌 사용자의 크라우드 표본은 영어다(2026-09-05 에
// realm 게이트를 푼 뒤부터). 원본(EE2)이 언어별 스탯 표를 들고 있어서,
// 원문 표기 → 언어 무관 ref → 지금 언어 표기로 두 번 옮기면 해결된다.
//
// 실측(2026-09-23, 공개 스냅샷 16개): 옵션 329종·등장 26,987건 중 한국어 표만으로는
// 2.85% 가 번역되지 않았고 그 대부분이 영어 원문이었다(Adds # to # Lightning Damage 등).
// 한국어 UI 에선 그게 영어로 섞여 보였다. 그래서 지금 언어가 아닌 쪽 표를 **둘 다** 받는다.
//
// 못 찾은 옵션은 원문 그대로 둔다 — 빈 칸이나 키 이름이 뜨는 것보다 낫다.
import { ref } from "vue";
import { AppConfig } from "@/web/Config";
import { STAT_BY_REF } from "@/assets/data";
import { modKey } from "./appraiser";

// 표가 준비되면 올라간다. 화면이 이 값을 읽어 두면 로딩이 끝났을 때 저절로 다시 그려진다.
export const statTextRev = ref(0);

let refIndex: Map<string, string> | null = null;
// 어느 언어 기준으로 준비했는지 — 설정에서 언어를 바꿔도 앱을 껐다 켜지 않게 한다.
let builtFor: string | null = null;

/** ko/stats.ndjson 한 덩어리에서 "정규화된 한국어 표기 → ref" 표를 만든다. */
export function buildRefIndex(ndjson: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of ndjson.split("\n")) {
    if (!line.trim()) continue;
    let o: { ref?: string; matchers?: Array<{ string?: string }> };
    try {
      o = JSON.parse(line);
    } catch {
      continue; // 한 줄이 깨져도 나머지는 쓴다
    }
    if (!o.ref) continue;
    for (const m of o.matchers ?? []) {
      const k = modKey(m.string ?? "");
      // 먼저 나온 matcher 를 이긴다 — 뒤엣것은 대개 값이 1 로 고정된 특수형이다
      if (k && !out.has(k)) out.set(k, o.ref);
    }
  }
  return out;
}

/**
 * 받아야 할 표 — **지금 언어가 아닌 쪽**만. 지금 언어의 원문은 그대로 보여주면 되므로.
 *  en → [ko]      (지금과 같다 — 영어 원문은 그대로 통과)
 *  ko → [en]      (한국어 원문은 표에 없으니 그대로 통과, 영어 크라우드만 한국어로)
 *  그 외 → [ko,en] (둘 다 그 언어로)
 * 한국어·영어 사용자는 원문 쪽 동작이 바뀌지 않는다 — 회귀가 원리적으로 없다.
 */
export const tablesFor = (lang: string): string[] =>
  ["ko", "en"].filter((l) => l !== lang);

export async function initStatText(): Promise<void> {
  const lang = AppConfig().language;
  if (builtFor === lang) return;
  builtFor = lang;
  const idx = new Map<string, string>();
  for (const l of tablesFor(lang)) {
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}data/${l}/stats.ndjson`,
        {
          signal: AbortSignal.timeout(15_000),
        },
      );
      for (const [k, v] of buildRefIndex(await r.text())) {
        if (!idx.has(k)) idx.set(k, v); // 두 언어 표기는 겹치지 않는다 — 방어만
      }
    } catch {
      // 한 표가 실패해도 나머지로 돈다. 다 실패하면 화면은 원문 그대로 멀쩡히 돈다.
    }
  }
  refIndex = idx;
  statTextRev.value++;
}

/** 옵션 열쇠(원문 정규형 — 한국어 또는 영어)를 지금 언어의 표기로. 모르면 그대로 돌려준다. */
export function statText(key: string): string {
  // 표가 늦게 오면 다시 그리도록 **일부러** 반응형 의존성만 읽는다(값은 안 쓴다).
  // Vue 에서 흔한 관용이라 규칙을 이 한 줄만 끈다 — void 는 no-void 에 걸리고,
  // 변수에 담으면 미사용 변수가 된다.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  statTextRev.value;
  if (!refIndex) return key;
  const r = refIndex.get(key);
  if (!r) return key;
  const s = STAT_BY_REF(r);
  const local = s?.matchers?.[0]?.string;
  return local ? modKey(local) : r; // 표기가 없으면 ref(영문 정본)로
}

/** 테스트 전용 — 표를 직접 밀어 넣는다. */
export function _setRefIndex(m: Map<string, string> | null): void {
  refIndex = m;
  builtFor = null;
  statTextRev.value++;
}
