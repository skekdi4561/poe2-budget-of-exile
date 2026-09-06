<template>
  <Widget :config="config" move-handles="center" :removable="false" :inline-edit="false">
    <div
      class="widget-default-style p-5 text-gray-100 rounded-lg"
      style="width: 48rem"
    >
      <!-- 헤더 -->
      <div class="flex items-baseline justify-between mb-3">
        <div class="flex items-baseline gap-2">
          <span class="font-bold text-lg"
            ><span class="text-yellow-500">{{ weaponName }}</span> {{ t(":title_rest") }}</span
          >
          <select
            v-model="curWeapon"
            @change="onWeaponChange"
            class="bg-gray-900 rounded px-2 py-0.5 text-gray-200 text-sm"
            :aria-label='t(":weapon_aria")'
          >
            <option v-for="w in WEAPONS" :key="w.suffix" :value="w.suffix">
              {{ t(":" + w.key) }}
            </option>
          </select>
        </div>
        <span v-if="board" class="text-sm text-gray-400"
          >{{ t(":listings", { n: filtered.length, m: board.sample }) }} ·
          {{ board.ageHours < 1 ? t(":just_now") : t(":hours_ago", { h: Math.round(board.ageHours) })
          }}<template v-if="board.rateFallback"> · {{ t(":rate_fallback") }}</template></span
        >
      </div>

      <div
        v-if="board && board.staleKept"
        class="mb-3 rounded bg-yellow-900/40 border border-yellow-700 px-3 py-1.5 text-sm text-yellow-200"
      >
        ⚠ {{ t(":stale_warn") }}
      </div>

      <!-- 통화 환율 (엑잘 기준) — 이미 수집된 rates 를 그대로 표시 -->
      <div
        v-if="board && rateChips.length"
        class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
        style="font-variant-numeric: tabular-nums"
      >
        <span class="text-gray-500" style="font-size: 12px; letter-spacing: 0.05em"
          >{{ t(":rates") }}</span
        >
        <span v-for="c in rateChips" :key="c.id" class="text-gray-300">
          1 {{ t(":" + c.key) }}
          <span class="text-gray-500">=</span>
          <span class="text-yellow-300 font-medium">{{ c.ex }}</span>
          <span class="text-gray-500">{{ t(":cur_exalted") }}</span>
        </span>
      </div>

      <div v-if="loading" class="text-gray-400 py-12 text-center">
        {{ t(":loading") }}
      </div>
      <div v-else-if="!board" class="text-gray-400 py-12 text-center">
        {{
          curWeapon
            ? t(":not_collected", { w: weaponName })
            : t(":load_failed")
        }}
      </div>

      <template v-else>
        <!-- 지표 · 예산 -->
        <div class="flex items-center gap-2 mb-3">
          <div v-if="!isArmour" class="flex bg-gray-900 rounded p-0.5">
            <button
              v-for="m in metrics"
              :key="m.id"
              @click="metric = m.id"
              class="px-3 py-1 rounded"
              :class="
                metric === m.id
                  ? 'bg-gray-600 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              "
            >
              {{ t(":" + m.key) }}
            </button>
          </div>
          <span class="ml-3 text-gray-400">{{ t(":budget") }}</span>
          <input
            v-model.number="budget"
            type="number"
            min="0"
            placeholder="0"
            class="bg-gray-900 rounded px-2 py-1 w-24 text-right"
            style="font-variant-numeric: tabular-nums"
          />
          <select
            v-model="budgetCur"
            class="bg-gray-900 rounded px-2 py-1 text-gray-200"
          >
            <option v-for="c in currencies" :key="c.id" :value="c.id">
              {{ t(":" + c.key) }}
            </option>
          </select>
          <span v-if="best" class="ml-auto"
            >{{ t(":best_for_budget", { m: metricLabel }) }}
            <span class="font-bold text-teal-400 text-lg">{{
              Math.round(best.d)
            }}</span>
            · {{ formatEx(best.p, board.rates) }}</span
          >
          <span v-else-if="budgetEx > 0" class="ml-auto text-gray-500"
            >{{ t(":none_in_budget") }}</span
          >
        </div>

        <!-- 아이템 치확 / 방패 막기 게이트 (근거는 script 의 minCrit 참고) -->
        <div
          v-if="!isArmour"
          class="flex items-center gap-2 mb-3 text-sm text-gray-400"
        >
          <span>{{ t(":crit_min") }}</span>
          <input
            v-model.number="minCrit"
            type="number"
            min="0"
            step="0.1"
            placeholder="0"
            class="w-20 bg-gray-950 rounded px-2 py-0.5 text-right border border-gray-700 text-gray-100"
            style="font-variant-numeric: tabular-nums"
          />
          <span>%</span>
        </div>
        <div v-else class="flex items-center gap-2 mb-3 text-sm text-gray-400">
          <span>{{ t(":block_min") }}</span>
          <input
            v-model.number="minBlock"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            class="w-20 bg-gray-950 rounded px-2 py-0.5 text-right border border-gray-700 text-gray-100"
            style="font-variant-numeric: tabular-nums"
          />
          <span>%</span>
        </div>

        <!-- 시장 곡선 차트 -->
        <div class="relative mb-3">
          <canvas
            ref="canvasEl"
            class="w-full rounded border border-gray-700 bg-gray-900"
            style="height: 20rem"
            @mousemove="onHover"
            @mouseleave="hover = null"
          ></canvas>
          <div
            v-if="hover"
            class="absolute pointer-events-none bg-gray-950 border border-gray-600 rounded px-2 py-1 text-sm shadow-lg"
            :style="{ left: hover.left + 'px', top: hover.top + 'px' }"
            style="font-variant-numeric: tabular-nums"
          >
            {{ metricLabel }} {{ Math.round(hover.d) }} ·
            <span class="text-yellow-400 font-bold">{{
              formatEx(hover.p, board.rates)
            }}</span>
          </div>
        </div>

        <!-- 아래 2단: 조건 필터 | 최전선 표 -->
        <div class="flex gap-4">
          <!-- 조건 필터 (거래소식 자유 필터) -->
          <div class="flex-1 min-w-0">
            <div
              class="text-gray-500 mb-1.5"
              style="font-size: 12px; letter-spacing: 0.05em"
            >
              {{ t(":filter_help") }}
            </div>

            <!-- 옵션 검색 -->
            <div class="relative mb-2">
              <input
                v-model="query"
                @focus="showDrop = true"
                @blur="hideDropSoon"
                type="text"
                :placeholder='t(":filter_placeholder")'
                class="w-full bg-gray-900 rounded px-3 py-1.5 border border-gray-700 focus:border-gray-500"
              />
              <div
                v-if="showDrop && matchedStats.length"
                class="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-gray-950 border border-gray-600 rounded shadow-lg"
              >
                <button
                  v-for="s in matchedStats"
                  :key="s.key"
                  @mousedown.prevent="addFilter(s)"
                  class="w-full text-left px-3 py-1.5 hover:bg-gray-800 flex justify-between gap-2"
                >
                  <span class="truncate">{{ statText(s.key) }}</span>
                  <span class="text-gray-500 whitespace-nowrap text-sm"
                    >{{ t(":stat_meta", { n: s.n, lo: s.lo, hi: s.hi }) }}</span
                  >
                </button>
              </div>
            </div>

            <!-- 추가된 필터 행들 -->
            <div
              v-if="!filters.length && !minCritN && !minBlockN"
              class="text-gray-600 text-sm py-2"
            >
              {{ t(":no_filter") }}
            </div>
            <div
              v-for="(f, i) in filters"
              :key="f.key + i"
              class="flex items-center gap-2 mb-1.5 bg-gray-900 rounded px-2 py-1.5 border border-gray-800"
            >
              <span class="flex-1 truncate" :title="statText(f.key)">{{ statText(f.key) }}</span>
              <input
                v-model.number="f.min"
                type="number"
                :placeholder='t(":min")'
                class="w-20 bg-gray-950 rounded px-2 py-0.5 text-right border border-gray-700"
                style="font-variant-numeric: tabular-nums"
              />
              <span class="text-gray-600">~</span>
              <input
                v-model.number="f.max"
                type="number"
                :placeholder='t(":max")'
                class="w-20 bg-gray-950 rounded px-2 py-0.5 text-right border border-gray-700"
                style="font-variant-numeric: tabular-nums"
              />
              <button
                @click="filters.splice(i, 1)"
                class="text-gray-500 hover:text-red-400 px-1"
                :title='t(":remove")'
              >
                ✕
              </button>
            </div>
            <button
              v-if="filters.length"
              @click="filters.splice(0)"
              class="text-sm text-gray-400 hover:text-gray-200 underline"
            >
              {{ t(":clear_all") }}
            </button>
          </div>

          <!-- 최전선 표 -->
          <div style="width: 15rem">
            <div class="flex items-center justify-between mb-1.5">
              <span
                class="text-gray-500"
                style="font-size: 12px; letter-spacing: 0.05em"
                >{{ t(":frontier") }}</span
              >
              <button
                @click="sortDesc = !sortDesc"
                class="text-sm text-gray-400 hover:text-gray-200 underline"
              >
                {{ sortDesc ? t(":sort_desc", { m: metricLabel }) : t(":sort_asc", { m: metricLabel }) }}
              </button>
            </div>
            <div
              class="overflow-y-auto rounded border border-gray-700 bg-gray-900"
              style="max-height: 15rem"
            >
              <table
                class="w-full"
                style="font-variant-numeric: tabular-nums"
              >
                <tbody>
                  <tr v-if="front.length < 2">
                    <td colspan="2" class="text-gray-500 text-center py-3 text-sm">
                      {{ t(":too_few") }}
                    </td>
                  </tr>
                  <tr
                    v-for="(r, i) in rungs"
                    :key="i"
                    class="border-b border-gray-800 last:border-0 hover:bg-gray-800"
                    :class="{ 'text-teal-400 font-bold': best && r.d === best.d }"
                  >
                    <td class="py-1 px-2">{{ Math.round(r.d) }}</td>
                    <td class="py-1 px-2 text-right">
                      {{ formatEx(r.p, board.rates) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 가격 추세 (있을 때만) — 지금 살까 기다릴까 -->
        <div v-if="trendAnchors.length" class="mt-5 pt-4 border-t border-gray-800">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="text-gray-500"
              style="font-size: 12px; letter-spacing: 0.05em"
              >{{ t(":trend_title", { d: trendDays }) }}</span
            >
            <!-- 앵커가 하나(수집기 기본 "top")면 고를 게 없으니 라벨만 -->
            <span v-if="trendAnchors.length === 1" class="text-gray-300 text-sm ml-1">{{
              anchorLabel(trendAnchors[0])
            }}</span>
            <div v-else class="flex bg-gray-900 rounded p-0.5 ml-1">
              <button
                v-for="a in trendAnchors"
                :key="a"
                @click="trendAnchor = a"
                class="px-2.5 py-0.5 rounded text-sm"
                :class="
                  trendAnchor === a
                    ? 'bg-gray-600 text-white font-medium'
                    : 'text-gray-400 hover:text-gray-200'
                "
              >
                {{ anchorLabel(a) }}
              </button>
            </div>
            <span
              v-if="trendChange"
              class="ml-auto text-sm"
              :class="trendChange.up ? 'text-red-400' : 'text-teal-400'"
              style="font-variant-numeric: tabular-nums"
            >
              {{ t(":trend_change", { d: trendDays }) }} {{ trendChange.up ? "▲" : "▼" }}
              {{ trendChange.pct }}%
            </span>
          </div>
          <canvas
            ref="trendCanvasEl"
            class="w-full rounded border border-gray-800 bg-gray-900"
            style="height: 7rem"
          ></canvas>
        </div>

        <div class="text-sm text-gray-500 mt-3">
          {{ t(":footer", { w: weaponName }) }}
        </div>
      </template>
    </div>
  </Widget>
</template>

<script lang="ts">
import {
  defineComponent,
  PropType,
  inject,
  ref,
  reactive,
  computed,
  watch,
  nextTick,
} from "vue";
import Widget from "@/web/overlay/Widget.vue";
import { useI18nNs } from "@/web/i18n";
import { statText, initStatText } from "./statText";
import { Host } from "@/web/background/IPC";
import type { WidgetManager, WidgetSpec } from "@/web/overlay/interfaces";
import type { MarketCurveWidget } from "@/web/overlay/interfaces";
import {
  marketBoard,
  frontier,
  formatEx,
  matchesFilters,
  metricRows,
  priceTicks,
  MarketBoard,
  StatOption,
  StatFilter,
  Row,
} from "./appraiser";

// 감정소 serve.py ATTACK_WEAPONS / index.html WEAPONS 와 같은 순서·접미사·표시명.
// 캐스터(완드·셉터·스태프)는 주문 옵션이 값을 정해 DPS 곡선과 무관하므로 제외.
const WEAPONS: { suffix: string; key: string }[] = [
  { suffix: "", key: "weapon_bow" },
  { suffix: "crossbow", key: "weapon_crossbow" },
  { suffix: "onemace", key: "weapon_onemace" },
  { suffix: "twomace", key: "weapon_twomace" },
  { suffix: "spear", key: "weapon_spear" },
  { suffix: "warstaff", key: "weapon_warstaff" },
  { suffix: "talisman", key: "weapon_talisman" },
  // 방패는 무기가 아니라 방어구다 — 지표가 DPS 가 아니라 방어도(ar)라서 아래 isArmour 로 갈린다.
  { suffix: "shield", key: "weapon_shield" },
];

export default defineComponent({
  widget: {
    type: "market-curve",
    instances: "single",
    trNameKey: "market_curve.name",
    initInstance: (): MarketCurveWidget => ({
      wmId: 0,
      wmType: "market-curve",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: null,
      // ESC 로 게임에 포커스를 돌려주면 위젯도 같이 닫힌다 — 없으면 그림만 남고
      // 클릭만 안 먹어서 F7 을 한 번 더 눌러야 사라진다(가격체크 위젯과 같은 플래그).
      wmFlags: ["hide-on-blur"],
      anchor: { pos: "cc", x: 50, y: 50 },
      toggleKey: "F7",
    }),
  } satisfies WidgetSpec,
  components: { Widget },
  props: {
    config: {
      type: Object as PropType<MarketCurveWidget>,
      required: true,
    },
  },
  setup(props) {
    // 화면 문자열은 전부 app_i18n.json 의 market_curve 아래에 있다(ko/en). 다른 언어는
    // 키가 없어 en 으로 대체된다 — 즉 앱 언어 설정을 그대로 따라간다.
    const { t } = useI18nNs("market_curve");
    void initStatText(); // 옵션 이름을 앱 언어로 보여주기 위한 표(한국어면 아무것도 안 받는다)
    const wm = inject<WidgetManager>("wm")!;

    // 브라우저 미리보기 전용 훅 — ?web-preview&show-curve 로 열면 즉시 표시
    if (!Host.isElectron && window.location.search.includes("show-curve")) {
      wm.show(props.config.wmId);
    }

    Host.onEvent("MAIN->CLIENT::widget-action", (e) => {
      if (e.target !== "market-curve") return;
      if (props.config.wmWants === "hide") {
        wm.show(props.config.wmId);
        shownAt = Date.now();
        // 토글 키로 열면 오버레이가 클릭 통과 상태라 조작이 안 된다 — 입력 포커스를 요청
        requestOverlayFocus(0);
      } else {
        wm.hide(props.config.wmId);
        Host.sendEvent({
          name: "OVERLAY->MAIN::focus-game",
          payload: undefined,
        });
      }
    });

    // ESC 로 위젯 닫기.
    // wmFlags 의 "hide-on-blur" 는 새로 만들어지는 설정에만 붙고, 이미 저장된 설정에는
    // 없다. 설정을 런타임에 고쳐 넣는 방법은 저장 시점(window blur)과 config-changed
    // 교체 때문에 유실될 수 있어 실제로 안 먹었다(실측: config.json 에 wmFlags=[] 유지).
    // 그래서 설정에 기대지 않고 **포커스 변화를 직접 듣는다** — ESC 는 게임에 포커스를
    // 돌려주므로 focus-change{overlay:false} 가 온다.
    // 예전엔 "overlay:true 를 한 번 본 뒤에만 닫기"로 열자마자 닫히는 사고를 막았는데, 그 플래그가
    // 포커스 탈취 실패·이벤트 누락으로 false 인 채 남으면 ESC 가 영영 안 먹었다(실측, 간헐).
    // 지금은 ①닫기 판정은 시간 유예(연 직후 300ms 안의 overlay:false 는 무시)로 바꾸고,
    // ②포커스 확인(overlay:true)이 300ms 안에 안 오면 두 번까지 다시 요청한다 — 메인은 요청을
    // 자기 상태와 무관하게 항상 실행하므로(OverlayWindow.assertOverlayActive) 어긋난 상태가 풀린다.
    let shownAt = 0;
    let overlayFocused = false;
    function requestOverlayFocus(attempt: number) {
      Host.sendEvent({ name: "OVERLAY->MAIN::focus-overlay", payload: undefined });
      if (attempt >= 2) return;
      setTimeout(() => {
        if (props.config.wmWants === "show" && !overlayFocused) requestOverlayFocus(attempt + 1);
      }, 300);
    }
    Host.onEvent("MAIN->OVERLAY::focus-change", (state) => {
      overlayFocused = state.overlay;
      if (!state.overlay && props.config.wmWants === "show" && Date.now() - shownAt > 300) {
        wm.hide(props.config.wmId); // ESC → 메인이 게임에 포커스를 돌려주며 overlay:false 를 보낸다
      }
    });

    const board = ref<MarketBoard | null>(null);
    const loading = ref(false);

    // 통화 환율 칩 — 이미 수집된 rates 를 엑잘 기준으로 표시(엑잘 자신은 제외)
    const rateChips = computed(() => {
      const r = board.value?.rates;
      if (!r) return [];
      const order = [
        { id: "divine", key: "cur_divine" },
        { id: "annul", key: "cur_annul" },
        { id: "chaos", key: "cur_chaos" },
      ];
      return order
        .filter((c) => typeof r[c.id] === "number" && r[c.id] > 1)
        .map((c) => ({
          ...c,
          // 소수점을 버리면 1.43 이 "1" 로 보여 "1 카오스 = 1 엑잘"이라는 거짓이 된다
          // (2026-09-05 리그 첫날 실측). 가격 눈금과 같은 규칙: 10 이상은 정수, 아래는 한 자리.
          ex:
            r[c.id] >= 10
              ? Math.round(r[c.id]).toLocaleString("ko-KR")
              : r[c.id].toFixed(1),
        }));
    });

    // 카테고리가 지표를 정한다 — 감정소의 metric_of()/isArmourCat() 과 같은 문법.
    // 방패는 방어도가 pdps 자리에 담겨 오므로(수집기가 그렇게 설계됐다) 곡선·최전선·예산·추세
    // 계산은 한 줄도 안 바뀐다. 바뀌는 건 **문구와 지표 토글**뿐이다.
    const isArmour = computed(() => curWeapon.value === "shield");
    const metricLabel = computed(() =>
      t(isArmour.value ? ":metric_name_armour" : ":metric_name_dps"),
    );

    const metric = ref<"total" | "phys" | "ele">("total");
    const metrics = [
      { id: "total" as const, key: "metric_total" },
      { id: "phys" as const, key: "metric_phys" },
      { id: "ele" as const, key: "metric_ele" },
    ];
    const sortDesc = ref(true);

    // 예산 — 통화 선택 가능, 내부 비교는 전부 엑잘 기준
    const budget = ref<number | "">("");
    const budgetCur = ref<"exalted" | "chaos" | "divine" | "annul">("exalted");
    const currencies = [
      { id: "exalted" as const, key: "cur_exalted" },
      { id: "divine" as const, key: "cur_divine" },
      { id: "chaos" as const, key: "cur_chaos" },
      { id: "annul" as const, key: "cur_annul" },
    ];
    const budgetEx = computed(() => {
      if (typeof budget.value !== "number" || budget.value <= 0) return 0;
      const r = board.value?.rates[budgetCur.value] ?? 0;
      return r > 0 ? budget.value * r : 0;
    });

    // 아이템 최종 치확 하한 — 조건 필터(filters)와 **별개로** 곡선 전체에 걸린다.
    // 옵션 필터는 mods 의 증가분("치명타 확률 +4.92%")을 보고, 이건 아이템 최종 치확
    // (베이스 12 + 증가분 4.92 = 16.92)을 본다. 베이스가 무기마다 달라서(육척봉 0·10·12,
    // 부적 5·8) 옵션 필터로는 "최종 치확 ≥ X" 를 원리적으로 만들 수 없다 — 그래서 별도 필드다.
    // 컨트롤을 예산 줄이 아니라 차트 위 자기 행에 둔 이유: 영어에서 예산 줄 잔여 폭이
    // 약 26px 뿐이라 즉시 줄바꿈된다(한국어만 보고 넣으면 영어에서만 깨진다).
    const minCrit = ref<number | "">("");
    const minCritN = computed(() =>
      typeof minCrit.value === "number" && minCrit.value > 0 ? minCrit.value : 0,
    );

    // 방패 막기 하한. 치확과 같은 자리에 서로 배타적으로 뜬다(무기=치확 / 방패=막기).
    // block 0 은 "미수집"이라 하한을 걸면 함께 빠진다 — 방패 막기는 언제나 양수다.
    const minBlock = ref<number | "">("");
    const minBlockN = computed(() =>
      typeof minBlock.value === "number" && minBlock.value > 0 ? minBlock.value : 0,
    );

    // 거래소식 자유 필터
    const filters = reactive<StatFilter[]>([]);
    const query = ref("");
    const showDrop = ref(false);
    function hideDropSoon() {
      setTimeout(() => (showDrop.value = false), 150);
    }
    const matchedStats = computed<StatOption[]>(() => {
      if (!board.value) return [];
      const q = query.value.trim().toLowerCase();
      const used = new Set(filters.map((f) => f.key));
      const pool = board.value.stats.filter((s) => !used.has(s.key));
      if (!q) return pool.slice(0, 20); // 비어 있으면 자주 보이는 옵션 순
      // 표시문(현재 언어)으로도 찾게 한다 — 영어 UI 에서 한국어 원문만 뒤지면 아무것도 안 걸린다
      return pool
        .filter(
          (s) =>
            s.key.toLowerCase().includes(q) ||
            statText(s.key).toLowerCase().includes(q),
        )
        .slice(0, 20);
    });
    function addFilter(s: StatOption) {
      filters.push({ key: s.key, min: null, max: null });
      query.value = "";
      showDrop.value = false;
    }

    // 무기 선택 — 활은 접미사 "", 다른 공격무기는 latest.<접미사>.json 을 읽는다.
    const curWeapon = ref("");
    const weaponName = computed(
      () => t(":" + (WEAPONS.find((w) => w.suffix === curWeapon.value)?.key ?? "weapon_bow")),
    );
    function onWeaponChange() {
      filters.splice(0); // 이전 무기 기준 옵션 필터는 다른 무기엔 의미가 없다
      // 치확 하한도 같이 지운다. 베이스 치확이 무기군마다 달라 그대로 들고 가면 뜻이 바뀌고,
      // 나중에 방패가 들어오면 방패는 치확이 전부 0 이라 값이 남아 있는 순간 전 매물이 탈락한다.
      minCrit.value = "";
      minBlock.value = "";
      // 방패는 edps 가 전부 0 이라 '원소' 지표에서 metricRows 의 d>0 필터가 전 매물을 지운다.
      // 데이터도 코드도 멀쩡한데 화면만 비는 형태라 원인 추적이 오래 걸린다 — 여기서 막는다.
      if (isArmour.value) metric.value = "total";
      load();
    }

    async function load() {
      const want = curWeapon.value; // 요청 시점의 무기를 고정
      loading.value = true;
      void initStatText(); // 설정에서 언어를 바꿨을 수 있다 — 같은 언어면 즉시 반환
      const b = await marketBoard(want); // 10분 캐시(무기별)라 매번 불러도 싸다
      // 느린 fetch 가 도는 사이 사용자가 무기를 바꿨으면 이 결과는 버린다 — 안 그러면
      // A 의 늦은 응답이 B 의 곡선을 덮어써 엉뚱한 무기가 뜬다(무기 전환 경합). 최신 load 가 loading 을 끈다.
      if (want !== curWeapon.value) return;
      board.value = b;
      loading.value = false;
    }
    watch(
      () => props.config.wmWants,
      (wants) => {
        if (wants === "show") load();
      },
      { immediate: true },
    );

    // v-model.number 는 빈 입력을 "" 로 만든다 — null 로 정규화
    const normFilters = computed<StatFilter[]>(() =>
      filters.map((f) => ({
        key: f.key,
        min: typeof f.min === "number" ? f.min : null,
        max: typeof f.max === "number" ? f.max : null,
      })),
    );
    const filtered = computed(() => {
      if (!board.value) return [];
      // 조기 반환(`if (!normFilters.length) return rows`)을 두면 옵션 필터가 비었을 때
      // 치확 게이트가 통째로 무시된다. matchesFilters 는 빈 배열에 every()로 true 를
      // 돌려주므로 조기 반환 없이도 결과가 같다 — 지우는 게 맞다.
      const lo = minCritN.value;
      const bl = minBlockN.value;
      return board.value.rows.filter(
        (r) =>
          r.crit >= lo &&
          r.block >= bl &&
          matchesFilters(r.offs, normFilters.value),
      );
    });
    const front = computed<Row[]>(() =>
      frontier(metricRows(filtered.value, metric.value)),
    );
    // frontier 는 DPS 오름차순 — 표시 정렬만 뒤집는다
    const rungs = computed(() =>
      sortDesc.value ? [...front.value].reverse() : front.value,
    );
    const best = computed(() => {
      if (budgetEx.value <= 0) return null;
      const affordable = front.value.filter((r) => r.p <= budgetEx.value);
      return affordable.length ? affordable[affordable.length - 1] : null;
    });

    // ---------- 차트 ----------
    const canvasEl = ref<HTMLCanvasElement | null>(null);
    const hover = ref<{ left: number; top: number; d: number; p: number } | null>(
      null,
    );
    let chartScale: { X: (d: number) => number } | null = null;

    const PAD = { l: 60, r: 18, t: 12, b: 24 };
    const GOLD = "#eab308";
    const TEAL = "#2dd4bf";

    // 눈금 라벨 — "25.0 div" 대신 "25 div" 처럼 군더더기 없이
    function fmtTick(pEx: number, rates: Record<string, number>): string {
      const dv = rates["divine"] ?? 0;
      const useDiv = dv > 1 && pEx >= dv;
      const v = useDiv ? pEx / dv : pEx;
      const s =
        v >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1);
      return s + (useDiv ? " div" : " ex");
    }

    // DPS 눈금을 보기 좋은 단위(10/25/50/100…)로
    function niceTicks(min: number, max: number, want: number): number[] {
      const span = max - min || 1;
      const raw = span / want;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const step =
        [1, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= want) ??
        10 * mag;
      const out: number[] = [];
      for (let v = Math.ceil(min / step) * step; v <= max; v += step)
        out.push(v);
      return out;
    }

    function draw() {
      const cv = canvasEl.value;
      if (!cv || !board.value) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      const ctx = cv.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      ctx.font = "12px sans-serif";

      const f = front.value;
      if (f.length < 2) {
        chartScale = null;
        ctx.fillStyle = "#5f7875";
        ctx.textAlign = "center";
        ctx.fillText(t(":too_few"), W / 2, H / 2);
        return;
      }

      const xmin = f[0].d;
      const xmax = f[f.length - 1].d;
      const lo = Math.log10(f[0].p);
      const hi = Math.log10(f[f.length - 1].p);
      const X = (d: number) =>
        PAD.l + ((d - xmin) / (xmax - xmin || 1)) * (W - PAD.l - PAD.r);
      const Y = (p: number) =>
        H -
        PAD.b -
        ((Math.log10(p) - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
      chartScale = { X };

      // 가격 눈금 (10의 거듭제곱)
      ctx.strokeStyle = "rgba(107,114,128,0.2)";
      ctx.fillStyle = "#93a8a5";
      ctx.textAlign = "right";
      ctx.lineWidth = 1;
      const ticks = priceTicks(lo, hi, f[0].p, f[f.length - 1].p);
      for (const p of ticks) {
        const y = Y(p);
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(W - PAD.r, y);
        ctx.stroke();
        ctx.fillText(fmtTick(p, board.value.rates), PAD.l - 6, y + 3);
      }
      // DPS 눈금 (보기 좋은 단위)
      ctx.textAlign = "center";
      for (const d of niceTicks(xmin, xmax, 8)) {
        const x = X(d);
        ctx.beginPath();
        ctx.moveTo(x, PAD.t);
        ctx.lineTo(x, H - PAD.b);
        ctx.stroke();
        ctx.fillText(String(Math.round(d)), x, H - 8);
      }
      // 축선
      ctx.strokeStyle = "rgba(156,163,175,0.5)";
      ctx.beginPath();
      ctx.moveTo(PAD.l, PAD.t);
      ctx.lineTo(PAD.l, H - PAD.b);
      ctx.lineTo(W - PAD.r, H - PAD.b);
      ctx.stroke();

      // 계단 경로 (아래 채움 + 금색 선)
      const path = new Path2D();
      path.moveTo(X(f[0].d), Y(f[0].p));
      for (let i = 1; i < f.length; i++) {
        path.lineTo(X(f[i].d), Y(f[i - 1].p));
        path.lineTo(X(f[i].d), Y(f[i].p));
      }
      const fill = new Path2D(path);
      fill.lineTo(X(xmax), H - PAD.b);
      fill.lineTo(X(xmin), H - PAD.b);
      fill.closePath();
      const grad = ctx.createLinearGradient(0, PAD.t, 0, H - PAD.b);
      grad.addColorStop(0, "rgba(234,179,8,0.18)");
      grad.addColorStop(1, "rgba(234,179,8,0.03)");
      ctx.fillStyle = grad;
      ctx.fill(fill);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke(path);

      // 계단 꼭짓점
      ctx.fillStyle = GOLD;
      for (const r of f) {
        ctx.beginPath();
        ctx.arc(X(r.d), Y(r.p), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 호버 십자선 + 강조점
      if (hover.value) {
        const hx = X(hover.value.d);
        const hy = Y(hover.value.p);
        ctx.strokeStyle = "rgba(156,163,175,0.45)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, PAD.t);
        ctx.lineTo(hx, H - PAD.b);
        ctx.moveTo(PAD.l, hy);
        ctx.lineTo(W - PAD.r, hy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 예산선 + 최적점
      if (budgetEx.value > 0) {
        const b = budgetEx.value;
        if (Math.log10(b) >= lo && Math.log10(b) <= hi) {
          ctx.strokeStyle = TEAL;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(PAD.l, Y(b));
          ctx.lineTo(W - PAD.r, Y(b));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (best.value) {
          ctx.fillStyle = TEAL;
          ctx.beginPath();
          ctx.arc(X(best.value.d), Y(best.value.p), 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#001f1c";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    function onHover(ev: MouseEvent) {
      const cv = canvasEl.value;
      if (!cv || !chartScale || front.value.length < 2) {
        hover.value = null;
        return;
      }
      const rect = cv.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      // 마우스 x 에 가장 가까운 계단 꼭짓점
      let nearest = front.value[0];
      let bestDist = Infinity;
      for (const r of front.value) {
        const dist = Math.abs(chartScale.X(r.d) - mx);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = r;
        }
      }
      hover.value = {
        left: Math.min(chartScale.X(nearest.d) + 12, rect.width - 170),
        top: Math.max(ev.clientY - rect.top - 32, 4),
        d: nearest.d,
        p: nearest.p,
      };
    }

    watch([front, budgetEx, board, hover], () => nextTick(draw), {
      flush: "post",
    });
    watch(
      () => props.config.wmWants,
      () => nextTick(draw),
      { flush: "post" },
    );

    // ---------- 가격 추세 ----------
    const trendAnchor = ref<number | string | null>(null);
    // 데이터가 실제로 있는 앵커만 (시계열 점 2개 이상)
    const trendAnchors = computed<(number | string)[]>(() => {
      const tr = board.value?.trend;
      if (!tr) return [];
      return tr.anchors.filter(
        (a) => tr.points.filter((p) => p.floors[String(a)] != null).length >= 2,
      );
    });
    watch(trendAnchors, (list) => {
      if (list.length && (trendAnchor.value == null || !list.includes(trendAnchor.value)))
        trendAnchor.value = list[Math.floor(list.length / 2)] ?? list[0]; // 가운데(중간 DPS) 기본
    });
    // "top" = TOP100 진입 최저가(수집기 기본, 한 선). 숫자 앵커는 옛 스냅샷 호환
    const anchorLabel = (a: number | string) =>
      a === "top" ? t(":anchor_top") : t(":anchor_dps", { a, m: metricLabel.value });
    // 선택 앵커의 (시각, 가격) 시계열
    const trendSeries = computed<{ t: number; p: number }[]>(() => {
      const tr = board.value?.trend;
      if (!tr || trendAnchor.value == null) return [];
      const key = String(trendAnchor.value);
      return tr.points
        .filter((p) => p.floors[key] != null && isFinite(p.floors[key]))
        .map((p) => ({ t: p.t, p: p.floors[key] }));
    });
    const trendDays = computed(() => {
      const s = trendSeries.value;
      if (s.length < 2) return 0;
      return Math.max(1, Math.round((s[s.length - 1].t - s[0].t) / 86_400_000));
    });
    const trendChange = computed(() => {
      const s = trendSeries.value;
      if (s.length < 2) return null;
      const a = s[0].p;
      const b = s[s.length - 1].p;
      if (a <= 0) return null;
      const pct = Math.round(((b - a) / a) * 100);
      if (pct === 0) return null;
      return { up: pct > 0, pct: Math.abs(pct) };
    });

    const trendCanvasEl = ref<HTMLCanvasElement | null>(null);
    function drawTrend() {
      const cv = trendCanvasEl.value;
      if (!cv) return;
      const s = trendSeries.value;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      const ctx = cv.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      if (s.length < 2 || !board.value) return;
      const P = { l: 54, r: 12, t: 10, b: 8 };
      const t0 = s[0].t;
      const t1 = s[s.length - 1].t;
      const lo = Math.log10(Math.min(...s.map((x) => x.p)));
      const hi = Math.log10(Math.max(...s.map((x) => x.p)));
      const X = (t: number) => P.l + ((t - t0) / (t1 - t0 || 1)) * (W - P.l - P.r);
      const Y = (p: number) =>
        H - P.b - ((Math.log10(p) - lo) / (hi - lo || 1)) * (H - P.t - P.b);
      // 가격 눈금(양끝)
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#93a8a5";
      ctx.textAlign = "right";
      ctx.fillText(formatEx(Math.pow(10, hi), board.value.rates), P.l - 6, P.t + 8);
      ctx.fillText(formatEx(Math.pow(10, lo), board.value.rates), P.l - 6, H - P.b);
      // 추세선 + 채움
      const path = new Path2D();
      s.forEach((x, i) => {
        const px = X(x.t);
        const py = Y(x.p);
        i ? path.lineTo(px, py) : path.moveTo(px, py);
      });
      const fill = new Path2D(path);
      fill.lineTo(X(t1), H - P.b);
      fill.lineTo(X(t0), H - P.b);
      fill.closePath();
      const rising = s[s.length - 1].p >= s[0].p;
      const col = rising ? "#d97066" : "#2dd4bf"; // 오르면 빨강(사기 나쁨), 내리면 청록
      ctx.fillStyle = rising ? "rgba(217,112,102,0.10)" : "rgba(45,212,191,0.10)";
      ctx.fill(fill);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke(path);
      // 최신 점
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(X(t1), Y(s[s.length - 1].p), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    watch([trendSeries, board], () => nextTick(drawTrend), { flush: "post" });
    watch(
      () => props.config.wmWants,
      () => nextTick(drawTrend),
      { flush: "post" },
    );

    return {
      trendAnchor,
      trendAnchors,
      anchorLabel,
      trendDays,
      t,
      statText,
      trendChange,
      trendCanvasEl,
      board,
      loading,
      WEAPONS,
      curWeapon,
      weaponName,
      onWeaponChange,
      rateChips,
      metric,
      metrics,
      sortDesc,
      budget,
      budgetCur,
      minCrit,
      minCritN,
      minBlock,
      minBlockN,
      isArmour,
      metricLabel,
      currencies,
      budgetEx,
      filters,
      query,
      showDrop,
      hideDropSoon,
      matchedStats,
      addFilter,
      filtered,
      front,
      rungs,
      best,
      formatEx,
      canvasEl,
      hover,
      onHover,
    };
  },
});
</script>
