<template>
  <div class="max-w-md p-2">
    <div class="mb-2 bg-gray-700 rounded px-2 py-1 leading-none">
      <i class="fas fa-info-circle"></i> {{ t("settings.clear_hotkey") }}
    </div>
    <div class="flex flex-col gap-4 mb-8">
      <HotkeysGeneric :hotkeys="hotkeys" />
    </div>
    <div class="mb-8 flex">
      <label class="flex-1">{{ t("settings.stash_scroll") }}</label>
      <div class="flex gap-x-4">
        <ui-radio v-model="stashScroll" :value="true" class="font-poe"
          >Ctrl + MouseWheel</ui-radio
        >
        <ui-radio v-model="stashScroll" :value="false">{{
          t("Disabled")
        }}</ui-radio>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: "settings.hotkeys",
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  configProp,
  configModelValue,
  _configModelValue,
  findWidget,
} from "./utils";
import {
  PriceCheckWidget,
  DelveGridWidget,
  MarketCurveWidget,
} from "@/web/overlay/interfaces";
import { ItemCheckWidget } from "../item-check/widget.js";

import UiRadio from "@/web/ui/UiRadio.vue";
import HotkeysGeneric, { HotkeySchema } from "../settings/HotkeysGeneric.vue";

const props = defineProps(configProp());

const hotkeys = computed<HotkeySchema[]>(() => {
  const priceCheckWidget = findWidget<PriceCheckWidget>(
    "price-check",
    props.config,
  )!;
  const itemCheckWidget = findWidget<ItemCheckWidget>(
    "item-check",
    props.config,
  )!;
  const delveGridWidget = findWidget<DelveGridWidget>(
    "delve-grid",
    props.config,
  )!;
  // (이 포크) 시장 곡선 위젯(기본 F7). 예전엔 설정 어디에도 없어서 다른 프로그램과 겹쳐도
  // 설정 파일을 손으로 고쳐야 했다(README 는 "설정에서 확인하라"고 틀리게 안내했다).
  const marketCurveWidget = findWidget<MarketCurveWidget>(
    "market-curve",
    props.config,
  );
  return [
    {
      translationKey: "price_check.name",
      items: [
        {
          translationKey: "price_check.hotkey",
          config: {
            modKey: _configModelValue(priceCheckWidget, "hotkeyHold"),
            nonModKey: _configModelValue(priceCheckWidget, "hotkey"),
          },
        },
        {
          translationKey: "price_check.hotkey_locked",
          config: _configModelValue(priceCheckWidget, "hotkeyLocked"),
        },
      ],
    },
    {
      translationKey: "settings.overlay",
      config: _configModelValue(props.config, "overlayKey"),
      required: true,
    },
    {
      translationKey: "map_check.name",
      config: _configModelValue(itemCheckWidget, "hotkey"),
    },
    {
      translationKey: "item.info",
      config: _configModelValue(itemCheckWidget, "hotkey"),
    },
    {
      translationKey: "settings.delve_grid",
      config: _configModelValue(delveGridWidget, "toggleKey"),
    },
    ...(marketCurveWidget
      ? [
          {
            translationKey: "market_curve.title_rest",
            config: _configModelValue(marketCurveWidget, "toggleKey"),
          },
        ]
      : []),
  ];
});

const stashScroll = configModelValue(() => props.config, "stashScroll");

const { t } = useI18n();
</script>
