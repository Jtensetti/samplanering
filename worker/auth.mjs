import { decodeProtectedHeader, importX509, jwtVerify } from "jose";
import { createHash } from "node:crypto";
const certificateUrl =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certificates = { expires: 0, values: {} };
export function appUser(payload) {
  const hex = createHash("sha256")
    .update(`${payload.aud}:${payload.sub}`)
    .digest("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return {
    id,
    name: String(
      payload.name || payload.email?.split("@")[0] || "Deltagare",
    ).slice(0, 100),
    email: String(payload.email || ""),
    expires: payload.exp * 1000,
  };
}
export async function verifyFirebaseToken(token, projectId, resolveKey) {
  if (
    !token ||
    token.length > 12000 ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId || "")
  )
    throw new Error("Invalid authentication");
  const header = decodeProtectedHeader(token);
  if (header.alg !== "RS256" || !header.kid)
    throw new Error("Invalid signing key");
  if (!resolveKey) {
    if (certificates.expires < Date.now() || !certificates.values[header.kid]) {
      const response = await fetch(certificateUrl, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Authentication keys unavailable");
      const text = await response.text();
      if (text.length > 64000) throw new Error("Invalid certificates");
      const maxAge = Number(
        response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ||
          300,
      );
      certificates = {
        values: JSON.parse(text),
        expires: Date.now() + Math.min(maxAge, 3600) * 1000,
      };
    }
    const certificate = certificates.values[header.kid];
    if (!certificate) throw new Error("Unknown signing key");
    resolveKey = () => importX509(certificate, "RS256");
  }
  const { payload } = await jwtVerify(token, await resolveKey(header.kid), {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "auth_time"],
  });
  const seconds = Date.now() / 1000;
  if (
    !payload.sub ||
    payload.sub.length > 128 ||
    typeof payload.auth_time !== "number" ||
    payload.auth_time > seconds ||
    payload.iat > seconds
  )
    throw new Error("Invalid token claims");
  return appUser(payload);
}
export async function authenticate(request, env) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  try {
    return await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw Object.assign(new Error("Logga in för att fortsätta."), {
      status: 401,
    });
  }
}
