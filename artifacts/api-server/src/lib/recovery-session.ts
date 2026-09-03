import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const SESSION_DURATION_MS = 60 * 60 * 1000;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 5;

interface SessionPayload {
  exp: number;
  nonce: string;
  version: 1;
}

interface LoginAttempt {
  attempts: number;
  blockedUntil: number;
  windowStartedAt: number;
}

const attemptsByClient = new Map<string, LoginAttempt>();
const revokedSessions = new Map<string, number>();

function getSessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET is required for recovery console sessions.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function safeCompare(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function verifyDashboardPassword(password: string): boolean {
  const configuredPassword = process.env["DASHBOARD_ADMIN_PASSWORD"];
  return Boolean(
    configuredPassword &&
      password.length > 0 &&
      safeCompare(password, configuredPassword),
  );
}

export function createRecoverySession(): {
  expiresAt: string;
  token: string;
} {
  const payload: SessionPayload = {
    exp: Date.now() + SESSION_DURATION_MS,
    nonce: randomUUID(),
    version: 1,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return {
    expiresAt: new Date(payload.exp).toISOString(),
    token: `${encodedPayload}.${sign(encodedPayload)}`,
  };
}

function parseVerifiedPayload(token: unknown): SessionPayload | null {
  if (typeof token !== "string") {
    return null;
  }

  const [encodedPayload, suppliedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra.length > 0) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  if (!safeCompare(suppliedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      payload.version !== 1 ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      typeof payload.nonce !== "string" ||
      payload.nonce.length < 16 ||
      payload.exp <= Date.now()
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function getRecoverySessionExpiry(token: unknown): string | null {
  const payload = parseVerifiedPayload(token);
  if (!payload) {
    return null;
  }
  purgeRevokedSessions();
  if (revokedSessions.has(payload.nonce)) {
    return null;
  }
  return new Date(payload.exp).toISOString();
}

export function revokeRecoverySession(token: unknown): void {
  const payload = parseVerifiedPayload(token);
  if (!payload) {
    return;
  }
  revokedSessions.set(payload.nonce, payload.exp);
  purgeRevokedSessions();
}

function purgeRevokedSessions(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of revokedSessions) {
    if (expiresAt <= now) {
      revokedSessions.delete(nonce);
    }
  }
}

export function getLoginAttemptState(clientId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const attempt = attemptsByClient.get(clientId);
  if (!attempt) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  if (attempt.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((attempt.blockedUntil - now) / 1000),
      ),
    };
  }

  if (
    attempt.blockedUntil > 0 ||
    now - attempt.windowStartedAt >= LOGIN_ATTEMPT_WINDOW_MS
  ) {
    attemptsByClient.delete(clientId);
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function recordFailedLogin(clientId: string): number {
  const now = Date.now();
  const existing = attemptsByClient.get(clientId);
  const withinWindow =
    existing && now - existing.windowStartedAt < LOGIN_ATTEMPT_WINDOW_MS;
  const next: LoginAttempt = withinWindow
    ? { ...existing, attempts: existing.attempts + 1 }
    : { attempts: 1, blockedUntil: 0, windowStartedAt: now };

  if (next.attempts >= LOGIN_ATTEMPT_LIMIT) {
    next.blockedUntil = now + LOGIN_ATTEMPT_WINDOW_MS;
  }
  attemptsByClient.set(clientId, next);
  return next.attempts;
}

export function clearLoginAttempts(clientId: string): void {
  attemptsByClient.delete(clientId);
}