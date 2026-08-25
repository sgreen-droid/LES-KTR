import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(directory, "..", "api-zod", "src", "index.ts");
const source = await readFile(indexPath, "utf8");
const replacement = `export type { RecoveryIncidentDetail } from "./generated/types/recoveryIncidentDetail";
export type { RecoveryIncidentInput } from "./generated/types/recoveryIncidentInput";
export type { RecoveryIncidentUpdate } from "./generated/types/recoveryIncidentUpdate";`;
const withoutPriorCopies = source.replace(
  /^export type \{ RecoveryIncident(?:Detail|Input|Update) \} from "\.\/generated\/types\/recoveryIncident(?:Detail|Input|Update)";\n/gm,
  "",
);
const next = withoutPriorCopies.replace(
  /export \* from ['"]\.\/generated\/types['"];?/,
  replacement,
);

if (next === withoutPriorCopies) {
  throw new Error("The generated API Zod export index did not contain the expected type wildcard.");
}

await writeFile(indexPath, next);