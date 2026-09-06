/**
 * 유저 제보(2026-09-07): "신성한 꽃"(아이템 종류 지도 조각, 희귀도 화폐)이
 * "알 수 없는 아이템"으로 떴다. 원인은 아이템 DB가 현 리그 거래소 항목 64개
 * (룬·바알·탐험·베리시움·조각·의식)만큼 뒤처져 있던 것. 거래소 정적 데이터로 채웠다.
 * 이 테스트는 제보 화면의 텍스트 그대로를 한국어·영어 DB로 파싱한다.
 */
import { parseClipboard } from "@/parser";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init, ITEM_BY_REF } from "@/assets/data";

const KO_SACRED_BLOOM = `아이템 종류: 지도 조각
아이템 희귀도: 화폐
신성한 꽃
--------
지도에 취록의 야생림을 추가합니다.
--------
꽃을 피우지도, 시들지도 않는다.
--------
해당 아이템을 우클릭한 뒤, 엔드게임 세계 지역을 좌클릭해 적용합니다.
`;

const EN_LEGACY_RUNE = `Item Class: Socketable
Rarity: Currency
Legacy of Bramblejack
--------
Stack Size: 1/10
--------
Can be socketed into an item with an empty rune socket.
`;

describe("거래소 정적 데이터로 채운 리그 아이템", () => {
  it("신성한 꽃 — 한국어 (제보 텍스트 그대로)", async () => {
    setupTests();
    await init("ko");
    const item = parseClipboard(KO_SACRED_BLOOM);
    expect(item.isOk()).toBe(true);
    const parsed = item._unsafeUnwrap();
    expect(parsed.info.refName).toBe("Sacred Bloom");
    expect(parsed.info.tradeTag).toBe("sacred-bloom");
  });

  it("영어 DB에도 같은 항목이 있고, 새 룬도 찾힌다", async () => {
    setupTests();
    await init("en");
    expect(ITEM_BY_REF("ITEM", "Sacred Bloom")?.[0]?.tradeTag).toBe("sacred-bloom");
    expect(ITEM_BY_REF("ITEM", "Legacy of Bramblejack")?.[0]?.tradeTag).toBe(
      "legacy-of-bramblejack",
    );
    expect(ITEM_BY_REF("ITEM", "Kamasa's Orb of Sacrifice")?.[0]?.tradeTag).toBe(
      "kamasas-orb-of-sacrifice",
    );
    const rune = parseClipboard(EN_LEGACY_RUNE);
    expect(rune.isOk()).toBe(true);
    expect(rune._unsafeUnwrap().info.refName).toBe("Legacy of Bramblejack");
  });
});
