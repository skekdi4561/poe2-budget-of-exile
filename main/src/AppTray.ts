import path from "path";
import { app, Tray, Menu, shell, nativeImage, dialog } from "electron";
import type { ServerEvents } from "./server";

// 트레이는 앱의 유일한 상시 진입점이다. 여기가 한국어로 굳어 있으면, 영어권 배포명
// (PoE2 Budget of Exile)으로 설치한 사용자가 오버레이 단축키를 모를 때 갈 곳이 없다.
// 렌더러의 app_i18n 은 메인 프로세스에서 못 읽으므로 최소 문자열만 여기 둔다(앱의 10개 언어).
const TRAY_TEXT = {
  "ko": {
    settings: "설정 / 리그",
    settingsTitle: "설정",
    settingsBody: (key: string) =>
      `Path of Exile 2 를 실행한 뒤 "${key}" 를 누르고, 톱니바퀴 버튼을 누르세요.`,
    openBrowser: "브라우저에서 열기",
    openFolder: "설정 폴더 열기",
    quit: "종료",
  },
  "en": {
    settings: "Settings / League",
    settingsTitle: "Settings",
    settingsBody: (key: string) =>
      `Launch Path of Exile 2, press "${key}", then click the gear button.`,
    openBrowser: "Open in browser",
    openFolder: "Open config folder",
    quit: "Quit",
  },
  "ru": {
    settings: "Настройки / Лига",
    settingsTitle: "Настройки",
    settingsBody: (key: string) =>
      `Запустите Path of Exile 2, нажмите "${key}", затем нажмите на кнопку с шестерёнкой.`,
    openBrowser: "Открыть в браузере",
    openFolder: "Открыть папку настроек",
    quit: "Выход",
  },
  "cmn-Hant": {
    settings: "設置 / 聯盟",
    settingsTitle: "設置",
    settingsBody: (key: string) =>
      `啟動 Path of Exile 2 後按下「${key}」，再點擊齒輪按鈕。`,
    openBrowser: "在瀏覽器中開啟",
    openFolder: "開啟配置資料夾",
    quit: "退出",
  },
  "ja": {
    settings: "設定 / リーグ",
    settingsTitle: "設定",
    settingsBody: (key: string) =>
      `Path of Exile 2 を起動し、「${key}」を押してから歯車ボタンをクリックしてください。`,
    openBrowser: "ブラウザで開く",
    openFolder: "設定フォルダを開く",
    quit: "終了",
  },
  "de": {
    settings: "Einstellungen / Liga",
    settingsTitle: "Einstellungen",
    settingsBody: (key: string) =>
      `Starte Path of Exile 2, drücke "${key}" und klicke dann auf den Zahnrad-Button.`,
    openBrowser: "Im Browser öffnen",
    openFolder: "Konfigurationsordner öffnen",
    quit: "Beenden",
  },
  "es": {
    settings: "Configuración / Liga",
    settingsTitle: "Configuración",
    settingsBody: (key: string) =>
      `Inicia Path of Exile 2, presiona "${key}" y luego haz clic en el botón del engranaje.`,
    openBrowser: "Abrir en el navegador",
    openFolder: "Abrir carpeta de configuración",
    quit: "Salir",
  },
  "pt": {
    settings: "Configurações / Liga",
    settingsTitle: "Configurações",
    settingsBody: (key: string) =>
      `Inicie o Path of Exile 2, pressione "${key}" e depois clique no botão de engrenagem.`,
    openBrowser: "Abrir no navegador",
    openFolder: "Abrir pasta de configuração",
    quit: "Sair",
  },
  "fr": {
    settings: "Paramètres / Ligue",
    settingsTitle: "Paramètres",
    settingsBody: (key: string) =>
      `Lancez Path of Exile 2, appuyez sur "${key}", puis cliquez sur le bouton en forme d'engrenage.`,
    openBrowser: "Ouvrir dans le navigateur",
    openFolder: "Ouvrir le dossier de configuration",
    quit: "Quitter",
  },
  "th": {
    settings: "ตั้งค่า / ลีก",
    settingsTitle: "ตั้งค่า",
    settingsBody: (key: string) =>
      `เปิดเกม Path of Exile 2 แล้วกด "${key}" จากนั้นกดปุ่มรูปเฟือง`,
    openBrowser: "เปิดในเบราว์เซอร์",
    openFolder: "เปิดโฟลเดอร์ config",
    quit: "ออกจากโปรแกรม",
  },
};

export class AppTray {
  public overlayKey = "Shift + Space";
  /** 렌더러 설정의 language. 표에 없는 언어는 영어로. */
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
    const T =
      TRAY_TEXT[this.language as keyof typeof TRAY_TEXT] ?? TRAY_TEXT.en;
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
