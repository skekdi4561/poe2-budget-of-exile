import path from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    esbuildOptions: { target: "esnext" },
  },
  plugins: [
    // 브라우저 단독 미리보기용: Electron 메인(8584)이 없으면 /config 를 null 로 응답해
    // 기본 설정으로 부팅되게 한다. 메인이 살아 있으면 원래 프록시로 넘긴다.
    {
      name: "dev-config-stub",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/config") return next();
          try {
            await fetch("http://127.0.0.1:8584/config", {
              signal: AbortSignal.timeout(300),
            });
            next();
          } catch {
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                version: "web-preview",
                updater: { state: "initial" },
                contents: null,
              }),
            );
          }
        });
        // 미리보기 프록시 — 정적 카탈로그(GET /api/trade2/data|leagues)만 통과.
        // 검색/매물 API 는 막는다: 미리보기가 레이트 리밋을 태우면 안 된다.
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/proxy/")) return next();
          try {
            await fetch("http://127.0.0.1:8584/config", {
              signal: AbortSignal.timeout(300),
            });
            return next(); // 메인 프로세스가 있으면 원래 프록시로
          } catch {
            /* 메인 없음 — 아래 스텁 사용 */
          }
          const target = req.url.slice("/proxy/".length);
          // 호스트를 명시 허용목록으로 잠근다 — [\w.-]+ 만으로는 evil.com 이나
          // 169.254.169.254(클라우드 메타데이터)까지 프록시돼 dev 서버가 SSRF 통로가 된다.
          // 실제 프록시(main/src/proxy.ts)의 공식 거래소 호스트만 허용한다.
          const PREVIEW_HOSTS = new Set([
            "www.pathofexile.com",
            "ru.pathofexile.com",
            "pathofexile.tw",
            "poe.kakaogames.com",
            "jp.pathofexile.com",
            "de.pathofexile.com",
            "es.pathofexile.com",
            "br.pathofexile.com",
            "fr.pathofexile.com",
          ]);
          const host = target.split("/", 1)[0].split("?")[0];
          const okPath =
            PREVIEW_HOSTS.has(host) &&
            /^[\w.-]+\/api\/trade2\/(data|leagues)(\/|\?|$)/.test(target);
          if (req.method !== "GET" || !okPath) {
            res.statusCode = 501;
            res.end(JSON.stringify({ error: "web-preview: blocked" }));
            return;
          }
          try {
            const r = await fetch("https://" + target, {
              headers: { "user-agent": "poe2-appraiser-web-preview" },
            });
            res.statusCode = r.status;
            res.setHeader(
              "content-type",
              r.headers.get("content-type") ?? "application/json",
            );
            res.end(Buffer.from(await r.arrayBuffer()));
          } catch (e) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      },
    },
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === "webview",
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ipc": path.resolve(__dirname, "./src/../../ipc"),
      "@specs": path.resolve(__dirname, "./specs"),
    },
    extensions: [".ts", ".js", ".vue", ".json"],
  },
  define: {
    "import.meta.vitest": "undefined",
  },
  server: {
    proxy: {
      "^/(config|uploads|proxy)": { target: "http://127.0.0.1:8584" },
      "/events": { ws: true, target: "http://127.0.0.1:8584" },
    },
  },
});
