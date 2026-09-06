// 로컬 서버의 교차 출처 차단(main/src/origin.ts).
// /proxy 는 거래소 세션 쿠키를 실어 보내므로, 사용자가 방문한 웹페이지가 이 서버에
// 요청을 넣을 수 있으면 그건 곧 계정 권한의 요청이다. 여기가 그 문을 지킨다.
import { describe, it, expect } from "vitest";
import type { IncomingMessage, ServerResponse } from "http";
import {
  isAllowedOrigin,
  isAllowedFetchSite,
  denyForeignOrigin,
} from "../../../main/src/origin";

describe("isAllowedOrigin", () => {
  it("Origin 이 없으면 통과 — 동일 출처 GET 과 네이티브 클라이언트", () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin("")).toBe(true);
  });

  it("loopback 은 통과 — 렌더러는 항상 여기서 열린다", () => {
    for (const o of [
      "http://localhost:8584",
      "http://127.0.0.1:51234",
      "http://[::1]:8584",
    ]) {
      expect(`${o} -> ${isAllowedOrigin(o)}`).toBe(`${o} -> true`);
    }
  });

  it("외부 오리진은 거부", () => {
    for (const o of [
      "https://evil.com",
      "http://evil.com:8584",
      // 접두사로 눈속임하는 호스트 — 부분 문자열 비교로 고치면 여기서 걸린다
      "http://127.0.0.1.evil.com",
      "http://localhost.evil.com",
      "http://evil.com/127.0.0.1",
      "null",
      "not a url",
    ]) {
      expect(`${o} -> ${isAllowedOrigin(o)}`).toBe(`${o} -> false`);
    }
  });
});

describe("isAllowedFetchSite", () => {
  // Origin 은 no-cors GET 에 안 붙는다 — <img>/<script>/<iframe> 로 오는 요청은
  // Origin 없이 도착해 isAllowedOrigin 을 그냥 통과한다. 그 구멍을 여기서 막는다.
  it("cross-site 는 거부 — 악성 웹페이지가 <img> 로 /proxy 를 때리는 경우", () => {
    expect(isAllowedFetchSite("cross-site")).toBe(false);
  });

  it("우리 렌더러와 네이티브 클라이언트는 통과", () => {
    for (const s of ["same-origin", "none", "same-site", undefined]) {
      expect(`${s} -> ${isAllowedFetchSite(s)}`).toBe(`${s} -> true`);
    }
  });
});

const fakeRes = () => {
  const res = {
    statusCode: 200,
    writableEnded: false,
    end() {
      res.writableEnded = true;
    },
  };
  return res as unknown as ServerResponse & { writableEnded: boolean };
};
const reqWith = (origin?: string, site?: string) =>
  ({
    headers: {
      ...(origin === undefined ? {} : { origin }),
      ...(site === undefined ? {} : { "sec-fetch-site": site }),
    },
  }) as IncomingMessage;

describe("denyForeignOrigin", () => {
  it("외부 오리진은 403 으로 닫고 라우트를 멈춘다", () => {
    const res = fakeRes();
    expect(denyForeignOrigin(reqWith("https://evil.com"), res)).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(res.writableEnded).toBe(true);
  });

  it("허용 오리진은 응답을 건드리지 않는다", () => {
    const res = fakeRes();
    expect(denyForeignOrigin(reqWith("http://127.0.0.1:8584"), res)).toBe(
      false,
    );
    expect(denyForeignOrigin(reqWith(), res)).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(res.writableEnded).toBe(false);
  });

  it("Origin 없는 교차출처 GET 도 막는다 — <img src=…/proxy/…> 경로", () => {
    // 이게 실제 구멍이었다: no-cors GET 은 Origin 을 안 보내서 isAllowedOrigin 을 통과하고,
    // /proxy 는 useSessionCookies:true 라 거래소 세션 쿠키가 실린 요청이 나간다.
    const res = fakeRes();
    expect(denyForeignOrigin(reqWith(undefined, "cross-site"), res)).toBe(true);
    expect(res.statusCode).toBe(403);
  });

  it("한 요청에 라우트가 여럿 달려 있어도 응답은 한 번만 끝낸다", () => {
    // 실제로 /uploads·/proxy·정적 라우트가 같은 request 이벤트에 줄줄이 달려 있어서
    // 가드가 요청 하나당 여러 번 불린다. end() 를 두 번 부르면 write-after-end 로 샌다.
    const res = fakeRes();
    let ends = 0;
    (res as unknown as { end: () => void }).end = () => {
      ends += 1;
      (res as { writableEnded: boolean }).writableEnded = true;
    };
    const req = reqWith("https://evil.com");
    expect(denyForeignOrigin(req, res)).toBe(true);
    expect(denyForeignOrigin(req, res)).toBe(true);
    expect(denyForeignOrigin(req, res)).toBe(true);
    expect(ends).toBe(1);
  });
});

describe("라우트가 실제로 가드를 부른다", () => {
  // 가드가 있어도 라우트에서 안 부르면 아무것도 안 막는다 — 호출 자리를 직접 확인한다.
  it("/proxy·/uploads·/config·정적 네 라우트 모두", async () => {
    const { readFileSync } = await import("node:fs");
    const src = (p: string) =>
      readFileSync(new URL(`../../../main/src/${p}`, import.meta.url), "utf-8");
    expect(src("proxy.ts")).toContain(
      "if (denyForeignOrigin(req, res)) return;",
    );
    // 정적 에셋 + /config 두 자리
    expect(
      src("server.ts").split("if (denyForeignOrigin(req, res)) return;")
        .length - 1,
    ).toBe(2);
    // uploads GET + POST 두 자리
    expect(
      src("host-files/file-uploads.ts").split(
        "if (denyForeignOrigin(req, res)) return;",
      ).length - 1,
    ).toBe(2);
  });
});
