import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateRecoverySessionBody,
  CreateRecoverySessionResponse,
  CreateRecoveryIncidentBody,
  CreateRecoveryIncidentResponse,
  ExportRecoveryIncidentBody,
  ExportRecoveryIncidentParams,
  ExportRecoveryIncidentResponse,
  ExportRecoveryDeviceLocationHistoryParams,
  ExportRecoveryDeviceLocationHistoryQueryParams,
  ExportRecoveryDeviceLocationHistoryResponse,
  ExportRecoveryLocationHistoryQueryParams,
  ExportRecoveryLocationHistoryResponse,
  GetAction1ReadinessResponse,
  GetRecoveryDeviceParams,
  GetRecoveryDeviceResponse,
  GetRecoveryDeviceLocationHistoryParams,
  GetRecoveryDeviceLocationHistoryQueryParams,
  GetRecoveryDeviceLocationHistoryResponse,
  GetRecoveryIncidentParams,
  GetRecoveryIncidentResponse,
  GetRecoverySessionResponse,
  GetRecoverySummaryResponse,
  ListRecoveryIncidentsResponse,
  ListRecoveryDevicesQueryParams,
  ListRecoveryDevicesResponse,
  ListRecoveryLocationHistoryQueryParams,
  ListRecoveryLocationHistoryResponse,
  UpdateRecoveryIncidentBody,
  UpdateRecoveryIncidentParams,
  UpdateRecoveryIncidentResponse,
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
import {
  RecoveryIncidentInputError,
  createRecoveryEvidenceExport,
  createRecoveryIncident,
  getRecoveryIncidentDetail,
  listRecoveryIncidents,
  renderRecoveryEvidenceCsv,
  renderRecoveryEvidencePrintDocument,
  updateRecoveryIncident,
} from "../lib/recovery-incidents";
import {
  RecoveryLocationHistoryInputError,
  createRecoveryLocationHistoryExport,
  listRecoveryLocationHistory,
  renderRecoveryLocationHistoryCsv,
  renderRecoveryLocationHistoryPrintDocument,
} from "../lib/recovery-history";

const router: IRouter = Router();
const SESSION_COOKIE = "les_recovery_session";
const EXPORT_WINDOW_MS = 5 * 60 * 1000;
const EXPORT_LIMIT = 12;
const exportAttempts = new Map<string, number[]>();

function getClientIdentifier(req: Request): string {
  return req.ip || "unknown";
}

function allowExport(clientId: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const attempts = (exportAttempts.get(clientId) ?? []).filter(
    (attempt) => now - attempt < EXPORT_WINDOW_MS,
  );
  if (attempts.length >= EXPORT_LIMIT) {
    exportAttempts.set(clientId, attempts);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((EXPORT_WINDOW_MS - (now - attempts[0])) / 1000),
      ),
    };
  }
  attempts.push(now);
  exportAttempts.set(clientId, attempts);
  return { allowed: true, retryAfterSeconds: 0 };
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

function sendLocationHistoryInputError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  if (error instanceof RecoveryLocationHistoryInputError) {
    req.log.warn({ error }, "Recovery location history request was rejected");
    res.status(400).json({
      error: "INVALID_LOCATION_HISTORY_REQUEST",
      message: error.message,
    });
    return;
  }
  req.log.error({ error }, "Recovery location history request failed");
  res.status(500).json({
    error: "LOCATION_HISTORY_UNAVAILABLE",
    message: "Location history is temporarily unavailable. Try again shortly.",
  });
}

function normalizeEndpointIdsQuery(query: Request["query"]): Record<string, unknown> {
  const endpointIds = query["endpointIds"];
  return {
    ...query,
    endpointIds: typeof endpointIds === "string" ? [endpointIds] : endpointIds,
  };
}

function sendLocationHistoryExport(
  res: Response,
  format: "json" | "csv" | "print",
  filename: string,
  exportData: Awaited<ReturnType<typeof createRecoveryLocationHistoryExport>>,
): void {
  res.set("Cache-Control", "no-store");
  if (format === "csv") {
    res.type("text/csv; charset=utf-8");
    res.attachment(`${filename}.csv`);
    res.send(`\uFEFF${renderRecoveryLocationHistoryCsv(exportData)}`);
    return;
  }
  if (format === "print") {
    res.type("text/html");
    res.send(renderRecoveryLocationHistoryPrintDocument(exportData));
    return;
  }
  res.type("application/json; charset=utf-8");
  res.attachment(`${filename}.json`);
  res.send(
    JSON.stringify(ExportRecoveryLocationHistoryResponse.parse(exportData), null, 2),
  );
}

function sendNotFound(res: Response, message: string): void {
  res.status(404).json({ error: "NOT_FOUND", message });
}

function sendIncidentInputError(req: Request, res: Response, error: unknown): void {
  const message =
    error instanceof RecoveryIncidentInputError
      ? error.message
      : "The incident could not be saved. Try again shortly.";
  req.log.warn({ reason: message }, "Recovery incident request rejected");
  res.status(400).json({ error: "INVALID_INCIDENT", message });
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

router.get(
  "/recovery/devices/:endpointId/location-history",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const params = GetRecoveryDeviceLocationHistoryParams.safeParse(req.params);
    const query = GetRecoveryDeviceLocationHistoryQueryParams.safeParse(req.query);
    if (!params.success || !query.success) {
      res.status(400).json({
        error: "INVALID_LOCATION_HISTORY_REQUEST",
        message: "Review the endpoint identifier and date range.",
      });
      return;
    }
    try {
      const observations = await listRecoveryLocationHistory({
        endpointIds: [params.data.endpointId],
        from: query.data.from,
        to: query.data.to,
      });
      res.set("Cache-Control", "no-store");
      res.json(
        GetRecoveryDeviceLocationHistoryResponse.parse({
          observations,
          observationCount: observations.length,
          from: query.data.from ?? null,
          to: query.data.to ?? null,
        }),
      );
    } catch (error) {
      sendLocationHistoryInputError(req, res, error);
    }
  },
);

router.get(
  "/recovery/devices/:endpointId/location-history/export",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const params = ExportRecoveryDeviceLocationHistoryParams.safeParse(req.params);
    const query = ExportRecoveryDeviceLocationHistoryQueryParams.safeParse(req.query);
    if (!params.success || !query.success) {
      res.status(400).json({
        error: "INVALID_LOCATION_HISTORY_REQUEST",
        message: "Review the endpoint identifier, date range, and export format.",
      });
      return;
    }
    const exportState = allowExport(getClientIdentifier(req));
    if (!exportState.allowed) {
      res.set("Retry-After", String(exportState.retryAfterSeconds));
      res.status(429).json({
        error: "RATE_LIMITED",
        message: "Location history exports are temporarily rate limited. Try again shortly.",
      });
      return;
    }
    try {
      const exportData = await createRecoveryLocationHistoryExport({
        endpointIds: [params.data.endpointId],
        from: query.data.from,
        to: query.data.to,
        scope: "SINGLE",
      });
      req.log.info(
        {
          exportId: exportData.exportId,
          endpointId: params.data.endpointId,
          format: query.data.format,
          observationCount: exportData.observationCount,
        },
        "Recovery device location history exported",
      );
      sendLocationHistoryExport(
        res,
        query.data.format,
        `les-location-evidence-${params.data.endpointId}`,
        exportData,
      );
    } catch (error) {
      sendLocationHistoryInputError(req, res, error);
    }
  },
);

router.get(
  "/recovery/location-history",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const query = ListRecoveryLocationHistoryQueryParams.safeParse(
      normalizeEndpointIdsQuery(req.query),
    );
    if (!query.success) {
      res.status(400).json({
        error: "INVALID_LOCATION_HISTORY_REQUEST",
        message: "Review the endpoint selection and date range.",
      });
      return;
    }
    try {
      const observations = await listRecoveryLocationHistory(query.data);
      res.set("Cache-Control", "no-store");
      res.json(
        ListRecoveryLocationHistoryResponse.parse({
          observations,
          observationCount: observations.length,
          from: query.data.from ?? null,
          to: query.data.to ?? null,
        }),
      );
    } catch (error) {
      sendLocationHistoryInputError(req, res, error);
    }
  },
);

router.get(
  "/recovery/location-history/export",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const query = ExportRecoveryLocationHistoryQueryParams.safeParse(
      normalizeEndpointIdsQuery(req.query),
    );
    if (!query.success) {
      res.status(400).json({
        error: "INVALID_LOCATION_HISTORY_REQUEST",
        message: "Review the endpoint selection, date range, and export format.",
      });
      return;
    }
    const exportState = allowExport(getClientIdentifier(req));
    if (!exportState.allowed) {
      res.set("Retry-After", String(exportState.retryAfterSeconds));
      res.status(429).json({
        error: "RATE_LIMITED",
        message: "Location history exports are temporarily rate limited. Try again shortly.",
      });
      return;
    }
    try {
      const endpointIds = query.data.endpointIds;
      const exportData = await createRecoveryLocationHistoryExport({
        endpointIds,
        from: query.data.from,
        to: query.data.to,
        scope:
          endpointIds?.length === 0 || !endpointIds
            ? "FLEET"
            : endpointIds.length === 1
              ? "SINGLE"
              : "SELECTED",
      });
      req.log.info(
        {
          exportId: exportData.exportId,
          scope: exportData.scope,
          endpointCount: endpointIds?.length ?? 0,
          format: query.data.format,
          observationCount: exportData.observationCount,
        },
        "Recovery location history exported",
      );
      sendLocationHistoryExport(
        res,
        query.data.format,
        `les-location-evidence-${exportData.scope.toLowerCase()}`,
        exportData,
      );
    } catch (error) {
      sendLocationHistoryInputError(req, res, error);
    }
  },
);

router.get(
  "/recovery/incidents",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    try {
      res.set("Cache-Control", "no-store");
      res.json(ListRecoveryIncidentsResponse.parse(await listRecoveryIncidents()));
    } catch (error) {
      req.log.error({ error }, "Could not list recovery incidents");
      res.status(500).json({
        error: "INCIDENTS_UNAVAILABLE",
        message: "Recovery incident records are temporarily unavailable.",
      });
    }
  },
);

router.post(
  "/recovery/incidents",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const body = CreateRecoveryIncidentBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        error: "INVALID_INCIDENT",
        message: "Review the incident title and selected endpoints.",
      });
      return;
    }
    try {
      const snapshot = await getRecoverySnapshot();
      const incident = await createRecoveryIncident(body.data, snapshot);
      req.log.info(
        { incidentId: incident.id, endpointCount: incident.endpointCount },
        "Recovery incident created",
      );
      res.set("Cache-Control", "no-store");
      res.status(201).json(CreateRecoveryIncidentResponse.parse(incident));
    } catch (error) {
      if (error instanceof Action1UnavailableError) {
        sendAction1Unavailable(req, res, error);
        return;
      }
      sendIncidentInputError(req, res, error);
    }
  },
);

router.get(
  "/recovery/incidents/:incidentId",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const params = GetRecoveryIncidentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({
        error: "INVALID_INCIDENT",
        message: "The incident identifier is invalid.",
      });
      return;
    }
    try {
      const incident = await getRecoveryIncidentDetail(params.data.incidentId);
      if (!incident) {
        sendNotFound(res, "The requested recovery incident was not found.");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.json(GetRecoveryIncidentResponse.parse(incident));
    } catch (error) {
      req.log.error({ error }, "Could not retrieve recovery incident");
      res.status(500).json({
        error: "INCIDENTS_UNAVAILABLE",
        message: "Recovery incident records are temporarily unavailable.",
      });
    }
  },
);

router.patch(
  "/recovery/incidents/:incidentId",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const params = UpdateRecoveryIncidentParams.safeParse(req.params);
    const body = UpdateRecoveryIncidentBody.safeParse(req.body);
    if (!params.success || !body.success || Object.keys(body.data ?? {}).length === 0) {
      res.status(400).json({
        error: "INVALID_INCIDENT",
        message: "Provide a valid incident change or note.",
      });
      return;
    }
    try {
      const incident = await updateRecoveryIncident(
        params.data.incidentId,
        body.data,
      );
      if (!incident) {
        sendNotFound(res, "The requested recovery incident was not found.");
        return;
      }
      req.log.info({ incidentId: incident.id }, "Recovery incident updated");
      res.set("Cache-Control", "no-store");
      res.json(UpdateRecoveryIncidentResponse.parse(incident));
    } catch (error) {
      sendIncidentInputError(req, res, error);
    }
  },
);

router.post(
  "/recovery/incidents/:incidentId/export",
  async (req, res): Promise<void> => {
    if (!requireRecoverySession(req, res)) {
      return;
    }
    const params = ExportRecoveryIncidentParams.safeParse(req.params);
    const body = ExportRecoveryIncidentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: "INVALID_EXPORT",
        message: "Choose a valid evidence export format.",
      });
      return;
    }
    const exportState = allowExport(getClientIdentifier(req));
    if (!exportState.allowed) {
      res.set("Retry-After", String(exportState.retryAfterSeconds));
      res.status(429).json({
        error: "RATE_LIMITED",
        message: "Evidence exports are temporarily rate limited. Try again shortly.",
      });
      return;
    }
    try {
      const exportData = await createRecoveryEvidenceExport(params.data.incidentId);
      if (!exportData) {
        sendNotFound(res, "The requested recovery incident was not found.");
        return;
      }
      const filename = `les-recovery-evidence-${exportData.incident.id}`;
      req.log.info(
        { incidentId: exportData.incident.id, exportId: exportData.exportId, format: body.data.format },
        "Recovery evidence exported",
      );
      res.set("Cache-Control", "no-store");
      if (body.data.format === "csv") {
        res.type("text/csv");
        res.attachment(`${filename}.csv`);
        res.send(renderRecoveryEvidenceCsv(exportData));
        return;
      }
      if (body.data.format === "print") {
        res.type("text/html");
        res.send(renderRecoveryEvidencePrintDocument(exportData));
        return;
      }
      res.json(ExportRecoveryIncidentResponse.parse(exportData));
    } catch (error) {
      req.log.error({ error }, "Could not generate recovery evidence export");
      res.status(500).json({
        error: "EXPORT_UNAVAILABLE",
        message: "The evidence export could not be generated. Try again shortly.",
      });
    }
  },
);

export default router;