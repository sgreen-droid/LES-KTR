import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

const action1TimestampPattern =
  /^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})(?:\.(\d{1,3}))?$/;

export function parseRecoveryDate(value: string | null | undefined): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();
  const action1Timestamp = action1TimestampPattern.exec(trimmed);
  const normalized = action1Timestamp
    ? `${action1Timestamp[1]}T${action1Timestamp[2]}:${action1Timestamp[3]}:${action1Timestamp[4]}${
        action1Timestamp[5] ? `.${action1Timestamp[5].padEnd(3, "0")}` : ""
      }Z`
    : trimmed;
  const parsed = parseISO(normalized);

  return isValid(parsed) ? parsed : null;
}

export function formatRecoveryDate(
  value: string | null | undefined,
  pattern: string,
  fallback = "Unavailable",
): string {
  const parsed = parseRecoveryDate(value);
  return parsed ? format(parsed, pattern) : fallback;
}

export function formatRecoveryDistance(
  value: string | null | undefined,
  fallback = "Unavailable",
): string {
  const parsed = parseRecoveryDate(value);
  return parsed ? formatDistanceToNow(parsed, { addSuffix: true }) : fallback;
}