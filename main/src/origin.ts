import type { IncomingMessage, ServerResponse } from "http";

// 로컬 서버(127.0.0.1:랜덤포트)의 교차 출처 차단.
//
// 이 서버는 loopback 에만 붙지만 사용자가 방문한 웹페이지도 loopback 에 요청할 수 있다.
// 그래서 /proxy 가 특히 위험하다 — useSessionCookies:true 라 거래소 세션 쿠키가 실려 나가고,
// 악성 페이지가 fetch("http://127.0.0.1:포트/proxy/poe.kakaogames.com/...") 한 번으로
// 사용자 계정 권한의 요청을 보낼 수 있다(응답은 CORS 로 못 읽어도 요청 자체가 나간다).
// /config 와 /uploads 도 같은 문에 있다. 랜덤 포트가 유일한 방어였다.
//
// 브라우저는 교차 출처 요청에 Origin 을 붙이고 페이지는 그걸 위조할 수 없다. 우리 렌더러는
// 항상 로컬 서버에서 열리므로(loadURL http://localhost:포트) Origin 이 loopback 이거나
// 아예 없다(동일 출처 GET). 그래서 "외부 오리진만 거부"로 충분하다.
// Origin 없는 네이티브 클라이언트는 통과 — 로컬 프로세스는 이미 코드 실행 권한이 있어
// CSWSH/CSRF 벡터가 아니다.
//
// ⚠ 다만 "브라우저는 교차 출처 요청에 Origin 을 붙인다"는 위 전제는 **CORS 모드 요청에만**
// 참이다. <img src="http://127.0.0.1:포트/proxy/…"> 처럼 no-cors 로 나가는 GET 하위 리소스는
// Origin 없이 도착해서 이 검사를 그냥 통과한다(2026-09-06 자가 검진에서 확인).
// 그 경우에도 브라우저는 Sec-Fetch-Site 를 붙이므로 아래 isAllowedFetchSite 가 마저 막는다.
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false; // 브라우저가 보내는 Origin 은 항상 파싱 가능 — 이상하면 거부
  }
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]"
  );
}

/**
 * Origin 이 안 붙는 no-cors GET 을 막는 두 번째 문.
 *
 * "cross-site" 만 거부한다 — 이게 악성 웹페이지의 경우이고, 여기만 막으면 우리 렌더러의
 * 동일 출처 호출(same-origin)이나 헤더를 아예 안 보내는 네이티브 클라이언트를 안 건드린다.
 * same-site(같은 호스트의 다른 포트)를 거부하지 않는 건 의도다 — 127.0.0.1 에 페이지를
 * 띄우려면 이미 로컬 코드 실행 권한이 있고, 그건 위 네이티브 클라이언트와 같은 처지다.
 */
export function isAllowedFetchSite(site: string | undefined): boolean {
  return site !== "cross-site";
}

/**
 * 외부 오리진이면 403 으로 닫고 true 를 돌려준다(라우트는 곧바로 return 하면 된다).
 * 같은 요청에 라우트가 여럿 달려 있어 여러 번 불리므로 응답은 한 번만 끝낸다.
 */
export function denyForeignOrigin(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const site = req.headers["sec-fetch-site"];
  if (
    isAllowedOrigin(req.headers.origin) &&
    isAllowedFetchSite(typeof site === "string" ? site : undefined)
  )
    return false;
  if (!res.writableEnded) {
    res.statusCode = 403;
    res.end();
  }
  return true;
}
