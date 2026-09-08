// 옵션 이름을 앱 언어로 보여준다.
//
// 곡선에 실린 옵션 문구는 카카오(한국) 거래소에서 긁어온 한국어 원문이다 — UI 를 영어로
// 바꿔도 이 목록만 한국어로 남는다. 원본(EE2)이 언어별 스탯 표를 들고 있어서,
// 한국어 표기 → 언어 무관 ref → 지금 언어 표기로 두 번 옮기면 해결된다.
// 실측(2026-09-05): 수집된 옵션 69종·등장 5,338건이 한국어 표 4,534항목에 100% 대응했다.
//
// 못 찾은 옵션은 한국어 원문 그대로 둔다 — 빈 칸이나 키 이름이 뜨는 것보다 낫다.
import { ref } from "vue";
import { AppConfig } from "@/web/Config";
import { STAT_BY_REF } from "@/assets/data";
import { modKey } from "./appraiser";

// 표가 준비되면 올라간다. 화면이 이 값을 읽어 두면 로딩이 끝났을 때 저절로 다시 그려진다.
export const statTextRev = ref(0);

let refByKo: Map<string, string> | null = null;
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

/** 한국어일 땐 아무것도 안 한다(원문이 곧 표시문). 그 외 언어에서만 표를 받아 둔다. */
export async function initStatText(): Promise<void> {
  const lang = AppConfig().language;
  if (builtFor === lang) return;
  builtFor = lang;
  if (lang === "ko") {
    refByKo = null; // 원문이 곧 표시문
    statTextRev.value++;
    return;
  }
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/ko/stats.ndjson`, {
      signal: AbortSignal.timeout(15_000),
    });
    refByKo = buildRefIndex(await r.text());
  } catch {
    refByKo = new Map(); // 실패해도 화면은 한국어 원문으로 멀쩡히 돈다
  }
  statTextRev.value++;
}

/** 옵션 열쇠(한국어 정규형)를 지금 언어의 표기로. 모르면 그대로 돌려준다. */
export function statText(key: string): string {
  // 표가 늦게 오면 다시 그리도록 **일부러** 반응형 의존성만 읽는다(값은 안 쓴다).
  // Vue 에서 흔한 관용이라 규칙을 이 한 줄만 끈다 — void 는 no-void 에 걸리고,
  // 변수에 담으면 미사용 변수가 된다.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  statTextRev.value;
  if (!refByKo) return key;
  const r = refByKo.get(key);
  if (!r) return key;
  const s = STAT_BY_REF(r);
  const local = s?.matchers?.[0]?.string;
  return local ? modKey(local) : r; // 표기가 없으면 ref(영문 정본)로
}

/** 테스트 전용 — 표를 직접 밀어 넣는다. */
export function _setRefIndex(m: Map<string, string> | null): void {
  refByKo = m;
  builtFor = null;
  statTextRev.value++;
}
