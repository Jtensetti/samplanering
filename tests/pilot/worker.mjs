// Used only by wrangler.pilot-test.json; this file is never a production entrypoint.
import { decodeJwt } from "jose";
import { createHandler } from "../../worker/index.mjs";
import { appUser } from "../../worker/auth.mjs";
export { Workspace, UserDirectory } from "../../worker/objects.mjs";
const app = createHandler(async (request) => {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw Object.assign(new Error("Logga in."), { status: 401 });
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=test-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.users?.length)
    throw Object.assign(new Error("Logga in."), { status: 401 });
  const claims = decodeJwt(token);
  if (
    claims.aud !== "demo-planner-tensetti" ||
    claims.sub !== result.users[0].localId
  )
    throw Object.assign(new Error("Fel emulator."), { status: 401 });
  return appUser(claims);
});
export default {
  async fetch(request, env) {
    const response = await app.fetch(request, env);
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    headers.set(
      "Content-Security-Policy",
      headers
        .get("Content-Security-Policy")
        .replace(
          "connect-src 'self'",
          "connect-src 'self' http://127.0.0.1:9099",
        ),
    );
    return new Response(response.body, { status: response.status, headers });
  },
};
