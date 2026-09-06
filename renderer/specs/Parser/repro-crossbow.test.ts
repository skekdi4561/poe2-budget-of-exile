// 유저 버그 신고 재현: 한국어 클라이언트에서 고유 석궁("성벽 랩터")이 "분석 중 오류 발생".
// 추측하지 말고 실제 클립보드 텍스트를 파서에 그대로 먹여 실패 지점을 본다.
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser/Parser";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";

// 스크린샷의 좌측 패널(= 클립보드 원문)을 그대로 옮긴 것.
const RAMPART_RAPTOR = `아이템 종류: 쇠뇌
아이템 희귀도: 고유
성벽 랩터
팽팽한 석궁
--------
물리 피해: 12-22 (augmented)
치명타 명중 확률: 5.00%
초당 공격 횟수: 2.15 (augmented)
재장전 시간: 0.82 (augmented)
--------
요구 사항: 8 힘, 8 민첩
--------
아이템 레벨: 70
--------
볼트 속도 24(20-30)% 증가
--------
물리 피해 48(40-60)% 증가
재장전 속도 30% 감소
최근 4초 이내 재장전한 경우 석궁 공격으로 발사된 볼트가 100%의 확률로 탄약을 소모하지 않음
공격 속도 34(30-40)% 증가
--------
"그가 관문을 향해 다가가자, 트럼펫이 울려퍼지고 깃발이 펴지며 그를 맞이했다. 그가 전혀 예상치 못한 일이었다."
- 익명의 침묵의 형제단 보고서
`;

// 같은 함정을 밟는 다른 언어·아이템이 있다(실측 2026-09-06, items.ndjson 전수):
//   es 10종 · fr 6 · ko 5 · pt 5 · ja 4 · de 4 · ru 1 · zh 1 · **en 0**
// 영어는 원리적으로 안 걸린다(번역이 곧 refName) — 원작이 못 본 이유로 보인다.
// ko 충돌 예: Barricade/Bulwark Tower Shield -> 둘 다 "방벽 거대 방패",
//            Spiked/Spined Bracers -> 둘 다 "가시 팔보호구".
describe("유저 신고 — 고유 석궁 분석 실패", () => {
  beforeEach(async () => {
    setupTests();
    await init("ko");
  });

  it("성벽 랩터(고유 석궁)가 분석된다", () => {
    const res = parseClipboard(RAMPART_RAPTOR);
    // 실패하면 사유를 그대로 보여준다(예전엔 item.parse_error 였다)
    if (!res.isOk()) throw new Error(`파서 실패: ${JSON.stringify(res.error)}`);
    const item = res.value;
    expect(item.info.refName).toBe("Rampart Raptor");
    expect(item.info.unique?.base).toBe("Tense Crossbow");
    expect(item.category).toBe("Crossbow");
  });
});
