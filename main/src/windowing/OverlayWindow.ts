import path from "path";
import { BrowserWindow, dialog, shell, Menu } from "electron";
import {
  OverlayController,
  OVERLAY_WINDOW_OPTS,
} from "electron-overlay-window";
import type { ServerEvents } from "../server";
import type { Logger } from "../RemoteLogger";
import type { GameWindow } from "./GameWindow";

// 게임이 관리자 권한으로 돌 때의 안내 — 메인 프로세스라 app_i18n 을 못 읽어 여기 둔다.
const NO_ACCESS: Record<string, { title: string; body: string }> = {
  "ko": {
    title: "PoE2 창 - 접근 불가",
    body: "Path of Exile 2 가 관리자 권한으로 실행 중입니다.\nPoE2 시세 감정소를 관리자 권한으로 다시 실행해야 합니다.",
  },
  "en": {
    title: "PoE2 window - No access",
    body: "Path of Exile 2 is running with administrator rights.\nRestart PoE2 Budget of Exile as administrator.",
  },
  "ru": {
    title: "Окно PoE2 — нет доступа",
    body: "Path of Exile 2 запущена с правами администратора.\nПерезапустите PoE2 Budget of Exile от имени администратора.",
  },
  "cmn-Hant": {
    title: "PoE2 窗口 - 無法存取",
    body: "Path of Exile 2 正以系統管理員權限運行。\n請以系統管理員身分重新啟動 PoE2 Budget of Exile。",
  },
  "ja": {
    title: "PoE2 ウィンドウ - アクセス不可",
    body: "Path of Exile 2 が管理者権限で実行されています。\nPoE2 Budget of Exile を管理者として再起動してください。",
  },
  "de": {
    title: "PoE2-Fenster - Kein Zugriff",
    body: "Path of Exile 2 läuft mit Administratorrechten.\nStarte PoE2 Budget of Exile als Administrator neu.",
  },
  "es": {
    title: "Ventana de PoE2 - Sin acceso",
    body: "Path of Exile 2 se está ejecutando con permisos de administrador.\nReinicia PoE2 Budget of Exile como administrador.",
  },
  "pt": {
    title: "Janela do PoE2 - Sem acesso",
    body: "O Path of Exile 2 está sendo executado com privilégios de administrador.\nReinicie o PoE2 Budget of Exile como administrador.",
  },
  "fr": {
    title: "Fenêtre PoE2 - Accès refusé",
    body: "Path of Exile 2 est exécuté avec les droits d'administrateur.\nRedémarrez PoE2 Budget of Exile en tant qu'administrateur.",
  },
  "th": {
    title: "หน้าต่าง PoE2 - ไม่มีสิทธิ์เข้าถึง",
    body: "Path of Exile 2 กำลังทำงานด้วยสิทธิ์ผู้ดูแลระบบ\nโปรดเปิด PoE2 Budget of Exile ใหม่ในฐานะผู้ดูแลระบบ",
  },
};

export class OverlayWindow {
  public isInteractable = false;
  public wasUsedRecently = true;
  private window?: BrowserWindow;
  private overlayKey: string = "Shift + Space";
  private isOverlayKeyUsed = false;
  private shouldShowOverlay = true;
  private hideOverlayOnBlur = false;

  constructor(
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow,
  ) {
    this.server.onEventAnyClient(
      "OVERLAY->MAIN::focus-game",
      this.assertGameActive,
    );
    this.server.onEventAnyClient(
      "OVERLAY->MAIN::focus-overlay",
      this.assertOverlayActive,
    );
    this.poeWindow.on("active-change", this.handlePoeWindowActiveChange);
    this.poeWindow.onAttach(this.handleOverlayAttached);

    this.server.onEventAnyClient("CLIENT->MAIN::used-recently", (e) => {
      this.wasUsedRecently = e.isOverlay;
    });

    if (process.argv.includes("--no-overlay")) return;

    this.server.onEventAnyClient("OVERLAY->MAIN::render-state", (e) => {
      this.shouldShowOverlay = e.shouldShow;
      this.syncWindowVisibility();
    });

    this.window = new BrowserWindow({
      icon: path.join(__dirname, process.env.STATIC!, "icon.png"),
      ...OVERLAY_WINDOW_OPTS,
      width: 800,
      height: 600,
      webPreferences: {
        allowRunningInsecureContent: false,
        webviewTag: true,
        spellcheck: false,
      },
    });

    this.window.setMenu(
      Menu.buildFromTemplate([
        { role: "editMenu" },
        { role: "reload" },
        { role: "toggleDevTools" },
      ]),
    );

    this.window.webContents.on("before-input-event", this.handleExtraCommands);
    this.window.webContents.on(
      "did-attach-webview",
      (_, webviewWebContents) => {
        webviewWebContents.on("before-input-event", this.handleExtraCommands);
      },
    );

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });
  }

  loadAppPage(port: number) {
    const url =
      process.env.VITE_DEV_SERVER_URL || `http://localhost:${port}/index.html`;

    if (!this.window) {
      shell.openExternal(url);
      return;
    }

    if (process.env.VITE_DEV_SERVER_URL) {
      this.window.loadURL(url);
      this.window.webContents.openDevTools({ mode: "detach", activate: false });
    } else {
      this.window.loadURL(url);
    }
  }

  assertOverlayActive = () => {
    // 자기 상태(isInteractable)를 믿고 건너뛰지 않는다 — OS 포커스 탈취가 한 번 실패하면 게임은
    // 계속 활성이라 active-change 가 안 오고, 이 플래그만 "활성"으로 어긋난 채 남는다. 그 상태에서
    // 다음 요청을 건너뛰면 ESC 가 게임으로 가서 위젯이 안 닫힌다(F7 위젯에서 실측, 간헐).
    // activateOverlay 는 이미 활성일 때 다시 불러도 해가 없다.
    this.isInteractable = true;
    // 원작 795c4d0b 이 넣은 호출 — showOverlay() 가 이미 보이면 바로 반환하므로 멱등이라
    // 위 가드 제거와 충돌하지 않는다.
    this.onOverlayActive();
    OverlayController.activateOverlay();
    this.poeWindow.isActive = false;
  };

  assertGameActive = () => {
    if (this.isInteractable) {
      this.isInteractable = false;
      OverlayController.focusTarget();
      this.poeWindow.isActive = true;

      this.onGameActive();
    }
  };

  toggleActiveState = () => {
    this.isOverlayKeyUsed = true;
    if (this.isInteractable) {
      this.assertGameActive();
    } else {
      this.assertOverlayActive();
    }
  };

  /** 렌더러 설정의 language — 안내창 언어. 설정이 오기 전에는 null. */
  public language: string | null = null;

  updateOpts(
    overlayKey: string,
    windowTitle: string,
    hideOverlayOnBlur: boolean,
  ) {
    this.overlayKey = overlayKey;
    this.poeWindow.attach(this.window, windowTitle);
    this.hideOverlayOnBlur = hideOverlayOnBlur;
  }

  private handleExtraCommands = (
    event: Electron.Event,
    input: Electron.Input,
  ) => {
    if (input.type !== "keyDown") return;

    let { code, control: ctrlKey, shift: shiftKey, alt: altKey } = input;

    if (code.startsWith("Key")) {
      code = code.slice("Key".length);
    } else if (code.startsWith("Digit")) {
      code = code.slice("Digit".length);
    }

    if (shiftKey && altKey) code = `Shift + Alt + ${code}`;
    else if (ctrlKey && shiftKey) code = `Ctrl + Shift + ${code}`;
    else if (ctrlKey && altKey) code = `Ctrl + Alt + ${code}`;
    else if (altKey) code = `Alt + ${code}`;
    else if (ctrlKey) code = `Ctrl + ${code}`;
    else if (shiftKey) code = `Shift + ${code}`;

    switch (code) {
      case "Escape":
      case "Ctrl + W": {
        event.preventDefault();
        process.nextTick(this.assertGameActive);
        break;
      }
      case this.overlayKey: {
        event.preventDefault();
        process.nextTick(this.toggleActiveState);
        break;
      }
    }
  };

  private handleOverlayAttached = (hasAccess?: boolean) => {
    if (hasAccess === false) {
      this.logger.write(
        "error [Overlay] PoE2 is running with administrator rights",
      );

      // 설정 언어를 아직 모르면(렌더러가 설정을 보내기 전) 예전처럼 영어+한국어.
      // 알면 그 언어 + 영어 — 영어 안내는 언어와 상관없이 남겨 둔다.
      const local = NO_ACCESS[this.language ?? ""];
      const en = NO_ACCESS.en;
      const second =
        local && local !== en ? local : !local ? NO_ACCESS.ko : null;
      dialog.showErrorBox(
        (local ?? en).title,
        second ? `${en.body}\n\n${second.body}` : en.body,
      );
    } else {
      this.server.sendEventTo("broadcast", {
        name: "MAIN->OVERLAY::overlay-attached",
        payload: undefined,
      });
    }
    this.syncWindowVisibility();
  };

  private handlePoeWindowActiveChange = (isActive: boolean) => {
    if (isActive && this.isInteractable) {
      this.isInteractable = false;
    }
    this.server.sendEventTo("broadcast", {
      name: "MAIN->OVERLAY::focus-change",
      payload: {
        game: isActive,
        overlay: this.isInteractable,
        usingHotkey: this.isOverlayKeyUsed,
      },
    });
    this.isOverlayKeyUsed = false;
    this.syncWindowVisibility();
  };

  private syncWindowVisibility() {
    if (!this.window || !this.hideOverlayOnBlur) return;

    if (
      this.isInteractable ||
      (this.shouldShowOverlay && this.poeWindow.isActive)
    ) {
      this.showOverlay();
    } else if (this.window.isVisible()) {
      this.window.hide();
    }
  }

  private showOverlay() {
    if (!this.window || this.window.isVisible() || !this.hideOverlayOnBlur)
      return;

    this.window.showInactive();
    this.window.setAlwaysOnTop(true, "screen-saver");
  }

  private onGameActive() {
    this.syncWindowVisibility();
  }

  private onOverlayActive() {
    this.showOverlay();
  }
}
