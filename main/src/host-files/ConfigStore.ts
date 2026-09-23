import type { ServerEvents } from "../server";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";

export class ConfigStore {
  private cfgPath = path.join(
    app.getPath("userData"),
    "apt-data",
    "config.json",
  );

  constructor(server: ServerEvents) {
    server.onEventAnyClient("CLIENT->MAIN::save-config", (cfg) => {
      this.save(cfg.contents, cfg.isTemporary);
      server.sendEventTo("broadcast", {
        name: "MAIN->CLIENT::config-changed",
        payload: { contents: cfg.contents },
      });
    });
  }

  async load(): Promise<string | null> {
    // 없음(ENOENT)만 첫 실행이다. 백신·동기화가 잠깐 잡은 오류(EBUSY·EPERM)를 첫 실행으로 보면
    // 기본값(시장 곡선 수집 켬)으로 시작하고 다음 저장이 사용자 설정을 덮는다 — 몇 번 다시 읽는다.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await fs.readFile(this.cfgPath, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        await new Promise((resolve) =>
          setTimeout(resolve, 250 * (attempt + 1)),
        );
      }
    }
    return null;
  }

  private async save(contents: string, tmp: boolean) {
    if (process.env.VITE_DEV_SERVER_URL) return;

    // tmp=true 는 손상 config 감지 시 기본값을 스크래치(.tmp)에 쓰는 폴백 경로다(원본 보존).
    // 대상은 매 호출마다 tmp 로 결정한다 — 예전엔 한 번 tmp 를 쓰면 cfgPath 를 영구히 .tmp 로
    // 래치해서, 그 뒤의 "영구 저장(tmp=false)"까지 .tmp 로 새 재시작 시 유실됐다(실측 재현).
    // 이제 사용자가 명시적으로 저장하면(tmp=false) config.json 으로 가 손상이 자가치유된다.
    const target = tmp ? this.cfgPath + ".tmp" : this.cfgPath;
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      // 원자적 쓰기: 임시 파일에 쓰고 rename 으로 교체한다. 쓰는 도중 죽어도 target 은
      // 온전히 남아 다음 실행이 손상 config 로 부팅하지 않는다(serve.py write_latest 와 같은 방식).
      const writing = target + ".writing";
      await fs.writeFile(writing, contents);
      await fs.rename(writing, target);
    } catch {
      app.exit(1);
    }
  }
}
