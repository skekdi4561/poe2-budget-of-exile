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
    // 마이그레이션은 사슬이라 최신(38)까지 간다 — 안 돌면 36 그대로다
    expect(real.AppConfig().configVersion).toBe(38);
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

describe("upgradeConfig 37 → 38 (원작 0.16 의 savedAugments · hideOverlayOnBlur)", () => {
  // 원작은 이 두 값을 자기네 <35 블록에서 준다. 우리 사용자는 이미 35~37 이라 그 블록을
  // 다시 지나지 않으므로 <38 블록으로 옮겨왔다. 이게 빠지면 savedAugments 가 undefined 인 채
  // augment-builder.getSavedAugments 의 lookup[item.category] 가 소켓 있는 아이템마다 터진다.
  beforeEach(() => {
    vi.stubGlobal("document", { documentElement: { style: {} } });
  });

  const priceCheck = () =>
    real.AppConfig().widgets.find((w) => w.wmType === "price-check") as
      | { savedAugments?: Record<string, unknown> }
      | undefined;

  it("37 설정에 savedAugments 와 hideOverlayOnBlur 가 채워진다", async () => {
    // 가짜 레지스트리의 price-check 에는 savedAugments 가 없다 — 옛 설정과 같은 상태다
    await init({ configVersion: 37, hideOverlayOnBlur: undefined });
    expect(real.AppConfig().configVersion).toBe(38);
    expect(priceCheck()?.savedAugments).toEqual({});
    expect(real.AppConfig().hideOverlayOnBlur).toBe(false);
  });

  it("이미 저장된 값은 덮어쓰지 않는다", async () => {
    const saved = { bow: ["Iron Rune"] };
    await init({
      configVersion: 37,
      hideOverlayOnBlur: true,
      widgets: real
        .defaultConfig()
        .widgets.map((w) =>
          w.wmType === "price-check" ? { ...w, savedAugments: saved } : w,
        ) as Config["widgets"],
    });
    expect(priceCheck()?.savedAugments).toEqual(saved); // 원작 코드는 무조건 {} 로 지운다
    expect(real.AppConfig().hideOverlayOnBlur).toBe(true);
  });
});
