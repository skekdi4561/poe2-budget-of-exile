<template>
  <transition
    enter-active-class="animate__animated animate__fadeIn"
    leave-active-class="animate__animated animate__backOutDown"
  >
    <div :class="$style.widget" v-if="show">
      <div :class="$style.box">
        <div class="py-2 px-4">
          <div class="text-base">{{ t("app.name") }}</div>
          <p>{{ t("app_is_ready") }}</p>
          <p class="text-gray-400 text-sm">{{ hints }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { shallowRef, computed } from "vue";
import { useI18n } from "vue-i18n";
import { Host } from "@/web/background/IPC";
import { AppConfig } from "@/web/Config";
import type {
  PriceCheckWidget,
  MarketCurveWidget,
} from "@/web/overlay/widgets";

const { t } = useI18n();

const show = shallowRef(false);

// 단축키 안내 — 예전엔 한국어 문장 하나("Ctrl+D 가격 검색 · …")가 모든 언어에 박혀 있었고,
// 사용자가 단축키를 바꿔도 옛 키를 알려줬다. 실제 설정된 키와 지금 언어의 이름으로 만든다.
const hints = computed(() => {
  const pc = AppConfig<PriceCheckWidget>("price-check");
  const mc = AppConfig<MarketCurveWidget>("market-curve");
  const price = pc?.hotkey
    ? [pc.hotkeyHold, pc.hotkey].filter(Boolean).join(" + ")
    : null;
  return [
    [price, t("attach_hint.price")],
    [mc?.toggleKey ?? null, t("attach_hint.curve")],
    [AppConfig().overlayKey, t("attach_hint.settings")],
  ]
    .filter(([key]) => key)
    .map(([key, label]) => `${key} ${label}`)
    .join(" · ");
});

Host.onEvent("MAIN->OVERLAY::overlay-attached", () => {
  if (!show.value && AppConfig().showAttachNotification) {
    show.value = true;
    setTimeout(() => {
      show.value = false;
    }, 2500);
  }
});
</script>

<style lang="postcss" module>
.widget {
  position: absolute;
  display: flex;
  width: 100%;
  justify-content: center;
  bottom: 20%;
}

.box {
  position: relative;
  display: flex;
  @apply bg-gray-800;
  @apply text-gray-100;
  @apply rounded;
  box-shadow: 0px 0px 1px 2px rgb(255 255 255 / 20%);
}

.box::before {
  position: absolute;
  content: "";
  background: url("/images/jeweler.png") no-repeat top right/contain;
  right: 100%;
  width: 100%;
  height: 100%;
  max-width: 78px;
  @apply mr-2;
  pointer-events: none;
  filter: drop-shadow(2px 4px 6px #000);
}
</style>
