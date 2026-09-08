"use strict";

import { app, systemPreferences } from "electron";
import { uIOhook } from "uiohook-napi";
import os from "node:os";
import { startServer, eventPipe, server } from "./server";
import { Logger } from "./RemoteLogger";
import { GameWindow } from "./windowing/GameWindow";
import { OverlayWindow } from "./windowing/OverlayWindow";
import { GameConfig } from "./host-files/GameConfig";
import { Shortcuts } from "./shortcuts/Shortcuts";
import { AppUpdater } from "./AppUpdater";
import { AppTray } from "./AppTray";
import { OverlayVisibility } from "./windowing/OverlayVisibility";
import { GameLogWatcher } from "./host-files/GameLogWatcher";
import { HttpProxy } from "./proxy";
import { installExtension, VUEJS_DEVTOOLS } from "electron-devtools-installer";
import { FileWriter } from "./host-files/FileWriter";
import path from "node:path";
import fs from "node:fs";

// 설정 폴더는 표시 이름(한글 productName)과 무관한 ASCII 경로에 고정한다 — 기본값은 productName 에서
// 파생되어 이름을 바꾸면 설정이 통째로 초기화되고, 한글 경로는 네이티브 모듈에 변수가 된다.
// 옛 이름(poe2-appraiser)으로 쓰던 설정은 첫 실행 때 한 번 복사해 온다(락·ConfigStore 보다 먼저).
{
  const appData = app.getPath("appData");
  const userData = path.join(appData, "poe2-sise");
  const legacy = path.join(appData, "poe2-appraiser", "apt-data");
  try {
    if (
      !fs.existsSync(path.join(userData, "apt-data")) &&
      fs.existsSync(legacy)
    ) {
      fs.cpSync(legacy, path.join(userData, "apt-data"), { recursive: true });
    }
  } catch (e) {
    console.warn("legacy config copy failed", e);
  }
  app.setPath("userData", userData);
  // productName 이 그대로 User-Agent 토큰이 된다. 이제 ASCII 지만 공백이 있어
  // ("PoE2 Budget of Exile/0.1.4") 토큰이 셋으로 쪼개진다 — 한 덩어리로 바꾼다.
  // 옛 한글 productName 패턴도 남겨 둔다(비ASCII 헤더가 카카오 거래소로 나가는 것은
  // 검증된 적이 없다). 원본은 "exiled-exchange-2/버전" 형태였다.
  app.userAgentFallback = app.userAgentFallback
    .replace(/PoE2 Budget of Exile/g, "poe2-budget-of-exile")
    .replace(/PoE2\s?시세\s?감정소/g, "poe2-budget-of-exile");
}

if (!app.requestSingleInstanceLock()) {
  app.exit();
}

if (process.platform !== "darwin") {
  app.disableHardwareAcceleration();
}
app.enableSandbox();
let tray: AppTray;

(async () => {
  if (process.platform === "darwin") {
    async function ensureAccessibilityPermission(): Promise<boolean> {
      if (systemPreferences.isTrustedAccessibilityClient(false)) return true;

      // Trigger the system prompt
      systemPreferences.isTrustedAccessibilityClient(true);

      const maxWaitTime = 15000; // 15 seconds
      const startTime = Date.now();

      return await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (systemPreferences.isTrustedAccessibilityClient(false)) {
            clearInterval(interval);
            resolve(true);
          }

          // Stop waiting if time runs out
          if (Date.now() - startTime > maxWaitTime) {
            clearInterval(interval);
            resolve(false);
          }
        }, 1000);
      });
    }
    const hasPermission = await ensureAccessibilityPermission();
    if (!hasPermission) {
      console.warn("Accessibility permission not granted, exiting");
      app.quit();
      return;
    }
    console.log("Accessibility permission granted, starting app");
  }

  app.on("ready", async () => {
    tray = new AppTray(eventPipe);
    const logger = new Logger(eventPipe);
    const gameConfig = new GameConfig(eventPipe, logger);
    const poeWindow = new GameWindow();
    const appUpdater = new AppUpdater(eventPipe);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _httpProxy = new HttpProxy(server, logger);
    const fileWriter = new FileWriter(eventPipe, logger);
    const gameLogWatcher = new GameLogWatcher(eventPipe, logger, fileWriter);

    if (process.env.VITE_DEV_SERVER_URL) {
      try {
        await installExtension(VUEJS_DEVTOOLS);
        logger.write("info Vue Devtools installed");
      } catch (error) {
        logger.write(`error installing Vue Devtools: ${error}`);
        console.log(`error installing Vue Devtools: ${error}`);
      }
    }
    process.addListener("uncaughtException", (err) => {
      logger.write(`error [uncaughtException] ${err.message}, ${err.stack}`);
    });
    process.addListener("unhandledRejection", (reason) => {
      logger.write(`error [unhandledRejection] ${(reason as Error).stack}`);
    });

    setTimeout(
      async () => {
        const overlay = new OverlayWindow(eventPipe, logger, poeWindow);
        // eslint-disable-next-line no-new
        new OverlayVisibility(eventPipe, overlay, gameConfig);
        const shortcuts = await Shortcuts.create(
          logger,
          overlay,
          poeWindow,
          gameConfig,
          eventPipe,
        );
        eventPipe.onEventAnyClient(
          "CLIENT->MAIN::update-host-config",
          (cfg) => {
            overlay.updateOpts(
              cfg.overlayKey,
              cfg.windowTitle,
              cfg.hideOverlayOnBlur,
            );
            shortcuts.updateActions(
              cfg.shortcuts,
              cfg.stashScroll,
              cfg.logKeys,
              cfg.restoreClipboard,
              cfg.language,
            );
            shortcuts.updateDelay(cfg.initialDelay);
            gameLogWatcher.restart(cfg.clientLog ?? "", cfg.readClientLog);
            gameConfig.readConfig(cfg.gameConfig ?? "");
            appUpdater.checkAtStartup();
            tray.overlayKey = cfg.overlayKey;
            // 트레이 문구도 설정 언어를 따라간다 — 안 부르면 최초 메뉴(ko)가 그대로 남는다
            tray.language = cfg.language ?? "ko";
            tray.rebuildMenu();
            fileWriter.restart(cfg.libraryAlpha, cfg.libraryOutputPath);
          },
        );
        uIOhook.start();
        console.log("uIOhook started");
        const port = await startServer(appUpdater, logger);
        // TODO: move up (currently crashes)
        logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`);
        overlay.loadAppPage(port);
        tray.serverPort = port;
      },
      // fixes(linux): window is black instead of transparent
      process.platform === "linux" ? 1000 : 0,
    );
  });
})();
