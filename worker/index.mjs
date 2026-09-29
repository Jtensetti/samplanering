import { authenticate } from "./auth.mjs";
import { call } from "./rpc.mjs";
export { Workspace, UserDirectory } from "./objects.mjs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
async function readBody(request, limit) {
  if (Number(request.headers.get("content-length")) > limit)
    fail(413, "Innehållet är för stort.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        fail(413, "Innehållet är för stort.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
function secure(response, url, env) {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (url.protocol === "https:")
    headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${url.origin.replace(/^http/, "ws")} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://${env.FIREBASE_PROJECT_ID}.firebaseapp.com; frame-src https://${env.FIREBASE_PROJECT_ID}.firebaseapp.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
  );
  if (url.pathname.startsWith("/api/"))
    headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
// The test entrypoint injects authentication at this boundary; production always uses signed Firebase tokens.
export function createHandler(verify = authenticate) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      try {
        if (!url.pathname.startsWith("/api/"))
          return secure(await env.ASSETS.fetch(request), url, env);
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin)
          fail(403, "Anropet kommer från fel adress.");
        if (request.headers.get("Sec-Fetch-Site") === "cross-site")
          fail(403, "Anropet kommer från fel webbplats.");
        if (url.pathname === "/api/health" && request.method === "GET")
          return secure(
            Response.json({
              ok: true,
              backend: "cloudflare",
              auth: "firebase",
            }),
            url,
            env,
          );
        if (url.pathname === "/api/config" && request.method === "GET") {
          if (!env.FIREBASE_API_KEY)
            fail(503, "Pilotens inloggning är inte aktiverad ännu.");
          return secure(
            Response.json({
              firebase: {
                apiKey: env.FIREBASE_API_KEY,
                projectId: env.FIREBASE_PROJECT_ID,
                authDomain: `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
                ...(env.FIREBASE_APP_ID ? { appId: env.FIREBASE_APP_ID } : {}),
              },
              googleLogin: env.GOOGLE_LOGIN === "true",
            }),
            url,
            env,
          );
        }
        if (
          url.pathname === "/api/events" &&
          request.headers.get("Upgrade")?.toLowerCase() === "websocket"
        ) {
          const team = url.searchParams.get("team");
          const protocols =
            request.headers
              .get("Sec-WebSocket-Protocol")
              ?.split(",")
              .map((s) => s.trim()) || [];
          const ticket = protocols
            .find((p) => p.startsWith("ticket."))
            ?.slice(7);
          if (
            !uuid.test(team || "") ||
            !protocols.includes("samplanering") ||
            !/^[0-9a-f]{64}$/.test(ticket || "")
          )
            fail(401, "Anslut igen.");
          return await env.WORKSPACES.getByName(team).fetch(
            new Request("https://socket.internal/", {
              headers: { Upgrade: "websocket", "X-Socket-Ticket": ticket },
            }),
          );
        }
        const user = await verify(request, env);
        if (env.REQUEST_LIMIT) {
          const { success } = await env.REQUEST_LIMIT.limit({ key: user.id });
          if (!success) fail(429, "För många anrop. Försök igen om en stund.");
        }
        const directory = env.DIRECTORIES.getByName(user.id);
        if (url.pathname === "/api/me" && request.method === "GET")
          return secure(
            Response.json({ id: user.id, name: user.name, email: user.email }),
            url,
            env,
          );
        if (url.pathname === "/api/teams" && request.method === "GET")
          return secure(
            Response.json(await call(directory, "list", user)),
            url,
            env,
          );
        if (url.pathname === "/api/files" && request.method === "POST") {
          const team = url.searchParams.get("team");
          if (!uuid.test(team || "")) fail(400, "Välj ett team.");
          const stub = env.WORKSPACES.getByName(team);
          const access = await call(stub, "info", user);
          if (access.role === "viewer")
            fail(403, "Du har inte behörighet att göra detta.");
          const bytes = await readBody(request, 10 * 1024 * 1024);
          const file = await call(
            stub,
            "upload",
            user,
            bytes.buffer,
            url.searchParams.get("name"),
            url.searchParams.get("mime"),
          );
          return secure(Response.json(file, { status: 201 }), url, env);
        }
        let body = {};
        if (!["GET", "HEAD"].includes(request.method)) {
          const bytes = await readBody(request, 1024 * 1024);
          if (bytes.length) {
            try {
              body = JSON.parse(new TextDecoder().decode(bytes));
            } catch {
              fail(400, "Kontrollera uppgifterna.");
            }
            if (!body || typeof body !== "object" || Array.isArray(body))
              fail(400, "Kontrollera uppgifterna.");
          }
        }
        if (url.pathname === "/api/teams" && request.method === "POST") {
          const id =
            request.headers.get("Idempotency-Key") || crypto.randomUUID();
          return secure(
            Response.json(
              await call(directory, "create", user, body.name, id),
              { status: 201 },
            ),
            url,
            env,
          );
        }
        if (url.pathname === "/api/join" && request.method === "POST") {
          const [team, token, ...extra] = String(body.token || "").split(".");
          if (
            !uuid.test(team || "") ||
            extra.length ||
            !/^[a-f0-9]{64}$/.test(token || "")
          )
            fail(410, "Inbjudan är ogiltig.");
          const stub = env.WORKSPACES.getByName(team);
          const joined = await call(stub, "join", token, user);
          await call(directory, "add", await call(stub, "info", user));
          return secure(Response.json(joined), url, env);
        }
        const team =
          body.teamId ||
          url.searchParams.get("team") ||
          url.pathname.match(/^\/api\/teams\/([^/]+)/)?.[1] ||
          request.headers.get("X-Team-Id");
        if (!uuid.test(team || "")) fail(400, "Välj ett team.");
        const stub = env.WORKSPACES.getByName(team);
        if (url.pathname === "/api/socket-ticket" && request.method === "POST")
          return secure(
            Response.json(await call(stub, "ticket", user)),
            url,
            env,
          );
        const download = url.pathname.match(/^\/api\/files\/([a-f0-9-]+)$/);
        if (download && request.method === "GET")
          return secure(
            await call(stub, "download", download[1], user),
            url,
            env,
          );
        const result = await call(
          stub,
          "execute",
          {
            method: request.method,
            path: url.pathname + url.search,
            body,
            headers: { "if-match": request.headers.get("If-Match") },
          },
          user,
        );
        if (result.data?.token && url.pathname.endsWith("/invites"))
          result.data.token = `${team}.${result.data.token}`;
        return secure(
          Response.json(result.data, { status: result.status }),
          url,
          env,
        );
      } catch (error) {
        const status = Number(error.status) || 500;
        if (status >= 500)
          console.error(
            JSON.stringify({
              event: "request_error",
              path: url.pathname,
              message: error.message,
            }),
          );
        return secure(
          Response.json(
            {
              error:
                status >= 500
                  ? "Tjänsten är inte tillgänglig just nu. Försök igen."
                  : error.message,
            },
            { status },
          ),
          url,
          env,
        );
      }
    },
  };
}
export default createHandler();
