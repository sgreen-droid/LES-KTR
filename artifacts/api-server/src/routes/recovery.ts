import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateRecoverySessionBody,
  CreateRecoverySessionResponse,
  GetAction1ReadinessResponse,
  GetRecoveryDeviceParams,
  GetRecoveryDeviceResponse,
  GetRecoverySessionResponse,
  GetRecoverySummaryResponse,
  ListRecoveryDevicesQueryParams,
  ListRecoveryDevicesResponse,
} from "@workspace/api-zod";
import {
  Action1UnavailableError,
  buildRecoverySummary,
  filterRecoveryDevices,
  getAction1Readiness,
  getRecoverySnapshot,
} from "../lib/action1-recovery";
import {
  clearLoginAttempts,
  createRecoverySession,
  getLoginAttemptState,
  getRecoverySessionExpiry,
  recordFailedLogin,
  verifyDashboardPassword,
} from "../lib/recovery-session";

const router: IRouter = Router();
const SESSION_COOKIE = "les_recovery_session";

function getClientIdentifier(req: Request): string {
  return req.ip || "unknown";
}

function setRecoveryCookie(
  res: Response,
  token: string,
  expiresAt: string,
): void {
  res.cookie(SESSION_COOKIE, token, {
    expires: new Date(expiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: true,
  });
}

function clearRecoveryCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: true,
  });
}

function sendUnauthorized(res: Response): void {
  res.status(401).json({
    error: "UNAUTHORIZED",
    message: "An authorized recovery console session is required.",
  });
}

function requireRecoverySession(req: Request, res: Response): string | null {
  const expiresAt = getRecoverySessionExpiry(req.cookies?.[SESSION_COOKIE]);
  if (!expiresAt) {
    clearRecoveryCookie(res);
    sendUnauthorized(res);
    return null;
  }
  return expiresAt;
}

function sendAction1Unavailable(
  req: Request,
  res: Response,
  error: unknown,
): void {
  const reason =
    error instanceof Action1UnavailableError ? error.message : "Unexpected error";
  req.log.error({ reason }, "Recovery console could not refresh Action1 data");
  res.status(502).json({
    error: "ACTION1_UNAVAILABLE",
    message:
      "Action1 recovery data is temporarily unavailable. Check the API credential role and try again.",
  });
}

router.get(
  "/recovery/auth/session",
  (req, res): void => {
    const expiresAt = getRecoverySessionExpiry(req.cookies?.[SESSION_COOKIE]);
    res.set("Cache-Control", "no-store");
    res.json(
      GetRecoverySessionResponse.parse({
        authenticated: Boolean(expiresAt),
        expiresAt,
      }),
    );
  },
);

router.post(
  "/recovery/auth/session",
  (req, res): void => {
    res.set("Cache-Control", "no-store");
    const body = CreateRecoverySessionBody.safeParse(req.body);
    if (!body.success) {
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "The password was not accepted.",
      });
      return;
    }

    const clientId = getClientIdentifier(req);
    const attemptState = getLoginAttemptState(clientId);
    if (!attemptState.allowed) {
      res.set("Retry-After", String(attemptState.retryAfterSeconds));
      res.status(429).json({
        error: "RATE_LIMITED",
        message: "Too many failed attempts. Please try again later.",
      });
      return;
    }

    if (!verifyDashboardPassword(body.data.password)) {
      const attempts = recordFailedLogin(clientId);
      req.log.warn({ attempts }, "Recovery console login rejected");
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "The password was not accepted.",
      });
      return;
    }

    clearLoginAttempts(clientId);
    const session = createRecoverySession();
    setRecoveryCookie(res, session.token, session.expiresAt);
    req.log.info("Recovery console unlocked");
    res.json(
      CreateRecoverySessionResponse.parse({
        authenticated: true,
        expiresAt: session.expiresAt,
      }),
    );
  },
);

router.delete(
  "/recovery/auth/session",
  (req, res): void => {
    clearRecoveryCookie(res);
    res.set("Cache-Control", "no-store");
    req.log.info("Recovery console locked");
    res.sendStatus(204);
  },
);

router.get(
  "/recovery/readiness",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const readiness = await getAction1Readiness();
    res.set("Cache-Control", "no-store");
    res.json(GetAction1ReadinessResponse.parse(readiness));
  },
);

router.get(
  "/recovery/summary",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    try {
      const snapshot = await getRecoverySnapshot();
      res.set("Cache-Control", "no-store");
      res.json(
        GetRecoverySummaryResponse.parse(
          buildRecoverySummary(snapshot.devices, snapshot.refreshedAt),
        ),
      );
    } catch (error) {
      sendAction1Unavailable(req, res, error);
    }
  },
);

router.get(
  "/recovery/devices",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const filters = ListRecoveryDevicesQueryParams.safeParse(req.query);
    if (!filters.success) {
      res.status(400).json({
        error: "INVALID_FILTERS",
        message: "One or more recovery filters are invalid.",
      });
      return;
    }

    try {
      const snapshot = await getRecoverySnapshot();
      const devices = filterRecoveryDevices(snapshot.devices, filters.data);
      res.set("Cache-Control", "no-store");
      res.json(
        ListRecoveryDevicesResponse.parse({
          devices,
          refreshedAt: snapshot.refreshedAt,
          source: snapshot.source,
        }),
      );
    } catch (error) {
      sendAction1Unavailable(req, res, error);
    }
  },
);

router.get(
  "/recovery/devices/:endpointId",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const params = GetRecoveryDeviceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({
        error: "INVALID_ENDPOINT",
        message: "The endpoint identifier is invalid.",
      });
      return;
    }

    try {
      const snapshot = await getRecoverySnapshot();
      const device = snapshot.devices.find(
        (candidate) => candidate.endpointId === params.data.endpointId,
      );
      if (!device) {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "The requested Action1 endpoint was not found.",
        });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.json(GetRecoveryDeviceResponse.parse(device));
    } catch (error) {
      sendAction1Unavailable(req, res, error);
    }
  },
);

export default router;