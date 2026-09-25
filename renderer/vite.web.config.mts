// 웹판 시장 곡선(curve.html) 빌드 — 렌더러 설정을 그대로 쓰고 입구와 출력만 바꾼다.
// base "./" 라서 어느 주소에 올려도 된다(자산·data 요청이 문서 기준 상대 경로가 된다).
import path from "path";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.mts";

export default mergeConfig(
  base,
  defineConfig({
    base: "./",
    build: {
      outDir: "dist-web",
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: { input: path.resolve(__dirname, "curve.html") },
    },
  }),
);
