import { promises as fs, watchFile, unwatchFile } from "fs";
import path from "path";
import { app } from "electron";
import { guessFileLocation } from "./utils";
import { ServerEvents } from "../server";
import { Logger } from "../RemoteLogger";
import { FileWriter } from "./FileWriter";

const POSSIBLE_PATH =
  process.platform === "win32"
    ? [
        "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt",
        "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt",
      ]
    : process.platform === "linux"
      ? [
          path.join(
            app.getPath("home"),
            ".wine/drive_c/Program Files (x86)/Grinding Gear Games/Path of Exile 2/logs/Client.txt",
          ),
          path.join(
            app.getPath("home"),
            ".local/share/Steam/steamapps/common/Path of Exile 2/logs/Client.txt",
          ),
        ]
      : process.platform === "darwin"
        ? [
            path.join(
              app.getPath("home"),
              "Library/Caches/com.GGG.PathOfExile/Logs/Client.txt",
            ),
          ]
        : [];

export class GameLogWatcher {
  private _wantedPath: string | null = null;
  get actualPath() {
    return this._state?.path ?? null;
  }

  private _state: {
    offset: number;
    path: string;
    file: fs.FileHandle;
    isReading: boolean;
    readBuff: Buffer;
    // 직전 읽기의 미완성 꼬리 바이트 — 라인(\n 이전)이나 멀티바이트 문자(한글 등)가
    // 64KB 버퍼 경계에 걸려 잘리지 않도록 다음 읽기 앞에 이어붙인다.
    carry: Buffer;
  } | null = null;

  constructor(
    private server: ServerEvents,
    private logger: Logger,
    private fileWriter: FileWriter,
  ) {
    this.server.onEventAnyClient("CLIENT->MAIN::re-parse-log", async () => {
      if (this._state) {
        // so have file and user set allow client-log to true
        if (!this._state.isReading) {
          this.fileWriter.flushClientLogFile();
          this._state.offset = 0;
          this._state.carry = Buffer.alloc(0); // 처음부터 다시 읽으니 이월 꼬리도 비운다
          this._state.isReading = true;
          this.readToEOF();
        } else {
          this.logger.write(
            "warn [GameLogWatcher] Asked to re-parse log but currently reading, skipping",
          );
        }
      }
    });
  }

  async restart(logFile: string, readLog: boolean) {
    if (!readLog) {
      this.logger.write("info [GameLogWatcher] disabled");
      if (this._state) {
        unwatchFile(this._state.path);
        await this._state.file.close();
        this._state = null;
      }
      return;
    }

    if (this._wantedPath !== logFile) {
      this._wantedPath = logFile;
      if (this._state) {
        unwatchFile(this._state.path);
        await this._state.file.close();
        this._state = null;
      }
    } else {
      return;
    }

    if (!logFile.length) {
      const guessedPath = await guessFileLocation(POSSIBLE_PATH);
      if (guessedPath) {
        logFile = guessedPath;
      } else {
        if (guessedPath === null) {
          this.logger.write(
            "error [GameLogWatcher] Found 2 log files, please enter one into settings:",
          );
          for (const path of POSSIBLE_PATH) {
            this.logger.write(`\n ${path}`);
          }
        } else {
          this.logger.write("error [GameLogWatcher] No log file found");
        }
        return;
      }
    }

    try {
      const file = await fs.open(logFile, "r");
      const stats = await file.stat();
      watchFile(logFile, { interval: 450 }, this.handleFileChange.bind(this));
      this._state = {
        path: logFile,
        file,
        offset: stats.size,
        isReading: false,
        readBuff: Buffer.allocUnsafe(64 * 1024),
        carry: Buffer.alloc(0),
      };
    } catch {
      this.logger.write("error [GameLogWatcher] Failed to watch file.");
    }
  }

  private handleFileChange() {
    if (this._state && !this._state.isReading) {
      this._state.isReading = true;
      this.readToEOF();
    }
  }

  private async readToEOF() {
    if (!this._state) return;

    const { file, readBuff, offset } = this._state;
    const { bytesRead } = await file.read(readBuff, 0, readBuff.length, offset);

    if (bytesRead) {
      // 이월 꼬리 + 이번 청크를 이어붙이고, 마지막 개행(\n=0x0A)까지만 문자열로 디코드한다.
      // \n 은 ASCII 라 UTF-8 멀티바이트 시퀀스(연속 바이트 0x80~0xBF) 안에 절대 안 나타나므로,
      // 개행 바이트에서 자르면 항상 문자 경계라 한글 등이 쪼개지지 않는다. 개행 뒤 미완성
      // 바이트는 carry 로 남겨 다음 읽기 앞에 붙인다(라인이 경계에 걸려 반토막 나는 것도 방지).
      const combined = Buffer.concat([
        this._state.carry,
        readBuff.subarray(0, bytesRead),
      ]);
      let cut = combined.lastIndexOf(0x0a);
      // 개행 없는 비정상 초장문으로 carry 가 무한히 커지는 것 방지 — 상한 넘으면 통째로 흘려보낸다.
      if (cut < 0 && combined.length > 1 << 20) cut = combined.length - 1;
      if (cut >= 0) {
        const lines = combined
          .toString("utf8", 0, cut + 1)
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length);
        this._state.carry = Buffer.from(combined.subarray(cut + 1)); // 미완성 꼬리만 복사 보관
        if (lines.length) {
          this.server.sendEventTo("broadcast", {
            name: "MAIN->CLIENT::game-log",
            payload: { lines },
          });
        }
      } else {
        this._state.carry = combined; // 아직 완성 라인이 없다 — 계속 모은다
      }
    }

    if (bytesRead) {
      this._state.offset += bytesRead;
      this.readToEOF();
    } else {
      this._state.isReading = false;
    }
  }
}
