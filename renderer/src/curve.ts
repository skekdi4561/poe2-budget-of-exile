// 웹판 시장 곡선 — 게임에서 F7 로 여는 위젯(WidgetMarketCurve.vue)을 그대로 띄운다.
// 디자인을 따로 복제하지 않고 같은 컴포넌트·같은 CSS 를 쓰므로 위젯이 바뀌면 웹도 같이 바뀐다.
import { createApp, h, computed, ref } from "vue";
// App.vue 를 그리지는 않지만 불러와야 전역 CSS(tailwind·글꼴)가 게임 속과 같은 순서로 들어온다.
// 첫 import 여야 하는 이유는 Config ↔ 위젯 목록의 순환 import 다 — 위젯을 먼저 불러오면
// 초기화 전 접근(TDZ) 오류가 난다(main.ts 도 App.vue 를 먼저 불러온다).
import "./web/App.vue";
import * as I18n from "./web/i18n";
import { loadStats } from "./assets/data";
import {
  AppConfig,
  updateConfig,
  defaultConfig,
  languageFromLocales,
} from "./web/Config";
import type {
  MarketCurveWidget,
  WidgetManager,
} from "./web/overlay/interfaces";
import WidgetMarketCurve from "./web/price-check/market-curve/WidgetMarketCurve.vue";

(async function () {
  // ?lang=en 처럼 언어를 고를 수 있다. 없거나 앱에 없는 언어(오타 포함)면 앱 첫 실행과 같은
  // 규칙(브라우저 언어 목록)을 쓴다 — 규칙은 모르는 값을 en 으로 돌리므로 그대로 쓰면 안 된다.
  const q = new URLSearchParams(location.search).get("lang") ?? "";
  const fromQuery = languageFromLocales([q.replace(/^cmn-/i, "zh-")]);
  // initConfig() 는 /config 를 요청하는데 정적 사이트에는 없다 — 기본 설정에 언어만 얹는다.
  updateConfig({
    ...defaultConfig(),
    language:
      fromQuery !== "en" || /^en(-|$)/i.test(q)
        ? fromQuery
        : languageFromLocales(navigator.languages),
  });
  const lang = AppConfig().language;
  document.title = lang === "ko" ? "PoE2 시세 감정소" : "PoE2 Budget of Exile";
  const i18n = await I18n.init(lang); // <html lang> 도 여기서 정해진다(uiLocale 이 읽는다)
  // Data.init 은 거래소 API 를 부르므로 쓰지 않는다. 옵션 이름 표(STAT_BY_REF)는 반응형이
  // 아니라서 위젯을 붙이기 전에 채운다. 실패하면 옵션 이름이 영어 원문으로 보일 뿐이다.
  await loadStats(lang).catch(console.error);

  const config = AppConfig<MarketCurveWidget>("market-curve")!;
  config.wmWants = "show"; // F7 을 누른 상태 — 위젯이 이 값을 보고 데이터를 불러온다
  const noop = () => {};
  const wm: WidgetManager = {
    show: noop,
    hide: noop,
    remove: noop,
    bringToTop: noop,
    create: noop,
    setFlag: noop,
    widgets: computed(() => AppConfig().widgets),
    active: ref(true),
    size: ref({ width: window.innerWidth, height: window.innerHeight }),
    poePanelWidth: computed(() => 0),
  };

  createApp({
    render: () => [
      // 게임에서 F7 을 누르면 오버레이가 화면을 옅게 덮는다 — 같은 색을 어두운 바탕에 깐다
      h("div", {
        class: "curve-backdrop",
        style: { background: AppConfig().overlayBackground },
      }),
      h(WidgetMarketCurve, { config, class: "curve-host" }),
    ],
  })
    .provide("wm", wm)
    .use(i18n)
    .mount("#app");
})();
