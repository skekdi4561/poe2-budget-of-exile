import path from "path";
import { app, Tray, Menu, shell, nativeImage, dialog } from "electron";
import type { ServerEvents } from "./server";

// 트레이는 앱의 유일한 상시 진입점이다. 여기가 한국어로 굳어 있으면, 영어권 배포명
// (PoE2 Budget of Exile)으로 설치한 사용자가 오버레이 단축키를 모를 때 갈 곳이 없다.
// 렌더러의 app_i18n 은 메인 프로세스에서 못 읽으므로 최소 문자열만 여기 둔다.
const TRAY_TEXT = {
  ko: {
    settings: "설정 / 리그",
    settingsTitle: "설정",
    settingsBody: (key: string) =>
      `Path of Exile 2 를 실행한 뒤 "${key}" 를 누르고, 톱니바퀴 버튼을 누르세요.`,
    openBrowser: "브라우저에서 열기",
    openFolder: "설정 폴더 열기",
    quit: "종료",
  },
  en: {
    settings: "Settings / League",
    settingsTitle: "Settings",
    settingsBody: (key: string) =>
      `Launch Path of Exile 2, press "${key}", then click the gear button.`,
    openBrowser: "Open in browser",
    openFolder: "Open config folder",
    quit: "Quit",
  },
};

export class AppTray {
  public overlayKey = "Shift + Space";
  /** 렌더러 설정의 language. 한국어가 아니면 영어로 — 지원 언어가 늘면 여기에 추가한다. */
  public language = "ko";
  private tray: Tray;
  serverPort = 0;

  constructor(server: ServerEvents) {
    let trayImage = nativeImage.createFromPath(
      path.join(
        __dirname,
        process.env.STATIC!,
        process.platform === "win32" ? "icon.ico" : "icon.png",
      ),
    );

    if (process.platform === "darwin") {
      // Mac image size needs to be smaller, or else it looks huge. Size
      // guideline is from https://iconhandbook.co.uk/reference/chart/osx/
      trayImage = trayImage.resize({ width: 22, height: 22 });
    }

    this.tray = new Tray(trayImage);
    this.tray.setToolTip(`PoE2 Budget of Exile v${app.getVersion()}`);
    this.rebuildMenu();

    server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      if (action === "quit") {
        app.quit();
      }
    });
  }

  rebuildMenu() {
    const T = this.language === "ko" ? TRAY_TEXT.ko : TRAY_TEXT.en;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: T.settings,
        click: () => {
          dialog.showMessageBox({
            title: T.settingsTitle,
            message: T.settingsBody(this.overlayKey),
          });
        },
      },
      {
        label: T.openBrowser,
        click: () => {
          shell.openExternal(`http://localhost:${this.serverPort}`);
        },
      },
      { type: "separator" },
      {
        label: T.openFolder,
        click: () => {
          shell.openPath(path.join(app.getPath("userData"), "apt-data"));
        },
      },
      {
        label: T.quit,
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }
}
