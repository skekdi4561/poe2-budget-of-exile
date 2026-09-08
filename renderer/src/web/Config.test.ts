// Config.ts 마이그레이션 — specs/vitest.setup.ts 가 @/web/Config 를 전역 스텁하므로 실물은 importActual 로만 가져온다.
// widget-registry 는 .vue 14개를 끌어오는데 vitest 설정에 vue 플러그인이 없어 가짜로 바꾼다 —
// defaultConfig().widgets 가 이 레지스트리에서 나오고 upgradeConfig 는 price-check 존재를 전제하므로 그것 하나만 둔다.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Host } from "@/web/background/IPC";
import type { Config } from "@/web/Config";

vi.mock("@/web/overlay/widget-registry", () => ({
  registry: {
    widgets: [
      {
        widget: {
          type: "price-check",
          instances: "single",
          initInstance: () => ({
            wmId: 0,
            wmType: "price-check",
            wmTitle: "",
            wmWants: "hide",
            wmZorder: null,
            wmFlags: [],
          }),
        },
      },
    ],
    getWidgetComponent: () => undefined,
  },
}));

const real =
  await vi.importActual<typeof import("@/web/Config")>("@/web/Config");

const marketCurves = () =>
  real.AppConfig().widgets.filter((w) => w.wmType === "market-curve");

async function init(cfg: Partial<Config>) {
  vi.mocked(Host.getConfig).mockResolvedValueOnce(
    JSON.stringify({ ...real.defaultConfig(), ...cfg }),
  );
  await real.initConfig();
}

describe("upgradeConfig 36 → 37 (V41 — 지운 시장 곡선 위젯 복구)", () => {
  beforeEach(() => {
    // updateConfig 가 document.documentElement.style.fontSize 를 만진다 — node 환경엔 document 가 없다
    vi.stubGlobal("document", { documentElement: { style: {} } });
  });
  it("위젯을 지운 v36 설정 → 37 이 되고 market-curve 위젯이 F7 로 되살아난다", async () => {
    await init({ configVersion: 36, widgets: real.defaultConfig().widgets }); // 가짜 레지스트리라 price-check 뿐
    expect(real.AppConfig().configVersion).toBe(37); // 마이그레이션이 안 돌면 36 그대로
    expect(marketCurves()).toHaveLength(1); // 위젯이 안 생기면 F7 이 영영 죽는다
    expect((marketCurves()[0] as { toggleKey?: string }).toggleKey).toBe("F7");
  });
  it("이미 위젯이 있는 v36 설정은 중복 생성하지 않는다", async () => {
    const mc = {
      wmId: 9,
      wmType: "market-curve",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: null,
      wmFlags: [],
      anchor: { pos: "cc", x: 50, y: 50 },
      toggleKey: "F7",
    } as unknown as Config["widgets"][number];
    await init({
      configVersion: 36,
      widgets: [...real.defaultConfig().widgets, mc],
    });
    expect(marketCurves()).toHaveLength(1); // 존재 검사가 빠지면 2
    expect(marketCurves()[0].wmId).toBe(9); // 있던 위젯을 갈아치우지 않는다
  });
});
