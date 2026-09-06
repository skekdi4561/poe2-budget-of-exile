// 방패는 무기가 아니라 방어구다 — 지표가 DPS 가 아니라 방어도(ar)이고, 수집기가 방어도를
// pdps 자리에 담아 보내므로 곡선·최전선·예산·추세 계산은 한 줄도 안 바뀐다.
// 바뀌는 건 **문구와 지표 토글**뿐인데, 그게 전부 템플릿 조건이라 조용히 깨진다:
// 타입 검사도 통과하고 예외도 안 나고, 마우스를 올려야 보이는 자리(호버 라벨)까지 있다.
// 이 저장소엔 컴포넌트 렌더 테스트 도구가 없으므로(@vue/test-utils 없음) i18n.test.ts 와
// 같은 방식 — 소스 텍스트 대조 — 으로 그물을 놓는다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vue = readFileSync(resolve(here, "WidgetMarketCurve.vue"), "utf-8");
const appraiser = readFileSync(resolve(here, "appraiser.ts"), "utf-8");

describe("방패(방어구) 지원", () => {
  it("무기 목록에 방패가 있다", () => {
    expect(vue).toMatch(/\{\s*suffix:\s*"shield",\s*key:\s*"weapon_shield"\s*\}/);
  });

  it("지표는 카테고리가 정한다 — isArmour 가 방패 접미사로 갈린다", () => {
    expect(vue).toMatch(/isArmour\s*=\s*computed\(\(\)\s*=>\s*curWeapon\.value\s*===\s*"shield"\)/);
  });

  it("물리·원소 토글이 방패에서 숨는다", () => {
    // 방패는 edps 가 전부 0 이라 '원소'는 빈 화면, '물리'는 '총'과 같은 값이다.
    expect(vue).toMatch(/<div v-if="!isArmour" class="flex bg-gray-900 rounded p-0\.5">/);
  });

  it("무기를 바꾸면 방패에서 지표를 total 로 되돌린다", () => {
    // 무기에서 '원소'를 고른 채 방패로 넘어가면 metricRows 의 d>0 이 전 매물을 지운다.
    // 데이터도 코드도 멀쩡한데 화면만 비는 형태라 이 한 줄이 없으면 원인 추적이 오래 걸린다.
    expect(vue).toMatch(/if \(isArmour\.value\) metric\.value = "total";/);
  });

  it("치확 입력과 막기 입력이 서로 배타적이다", () => {
    // 활을 보면서 '막기 최소'(항상 0 → 전 매물 제외)를 입력할 수 있으면 안 된다. 반대도 같다.
    const crit = vue.indexOf('t(":crit_min")');
    const block = vue.indexOf('t(":block_min")');
    expect(crit).toBeGreaterThan(-1);
    expect(block).toBeGreaterThan(-1);
    // 치확 블록은 v-if="!isArmour", 막기 블록은 그 바로 뒤 v-else
    expect(vue.slice(Math.max(0, crit - 200), crit)).toContain('v-if="!isArmour"');
    expect(vue.slice(Math.max(0, block - 200), block)).toContain("v-else");
  });

  it("두 게이트가 모두 filtered 에 걸린다", () => {
    // 조기 반환이 되살아나면 조건 필터가 빈 기본 상태에서 게이트가 통째로 무시된다.
    expect(vue).not.toMatch(/if \(!normFilters\.value\.length\) return board\.value\.rows;/);
    expect(vue).toMatch(/r\.crit >= lo/);
    expect(vue).toMatch(/r\.block >= bl/);
  });

  it("지표 이름을 말하는 화면 문자열에 하드코딩된 DPS 가 없다", () => {
    // 호버 라벨은 마우스를 올려야 보여서 정지 화면 확인으로는 안 잡힌다. ASCII 라
    // i18n.test.ts 의 '한글 하드코딩 금지'에도 안 걸린다 — 여기가 유일한 그물이다.
    const template = vue.slice(0, vue.indexOf("<script"));
    const leaked = template
      .split(/\r?\n/)
      .map((l, i) => [i + 1, l.trim()] as const)
      .filter(([, s]) => /(^|[>\s{])DPS\b/.test(s) && !s.startsWith("<!--"));
    expect(leaked.map(([n, s]) => `${n}: ${s}`)).toEqual([]);
  });

  it("막기가 행까지 실린다 — 골라 담는 리터럴에 있어야 한다", () => {
    // 여기서 빠지면 값이 조용히 사라진다(컴파일도 통과하고 예외도 없다).
    expect(appraiser).toMatch(/block: numOr0\(b\.block\)/);
    expect(appraiser).toMatch(/crit: numOr0\(b\.crit\)/);
  });
});
