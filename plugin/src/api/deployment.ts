import { getSdk } from "../sdk";

export interface ConfigurationDoc {
  revision: string;
  values: Record<string, string>;
  secrets: string[];
  configured: string[];
}

async function command(name: string, args?: string[]): Promise<string> {
  const result = await getSdk().api.exec(name, args);
  if (result.exitCode !== 0)
    throw new Error(
      (result.stderr || result.stdout).trim() || "Configuration command failed",
    );
  return result.stdout;
}

export async function getConfiguration(): Promise<ConfigurationDoc> {
  const value: unknown = JSON.parse(await command("configuration-read"));
  if (
    !value ||
    typeof value !== "object" ||
    !("revision" in value) ||
    typeof value.revision !== "string" ||
    !("values" in value) ||
    !value.values ||
    typeof value.values !== "object" ||
    Array.isArray(value.values) ||
    !Object.values(value.values).every((item) => typeof item === "string") ||
    !("secrets" in value) ||
    !Array.isArray(value.secrets) ||
    !value.secrets.every((item) => typeof item === "string") ||
    !("configured" in value) ||
    !Array.isArray(value.configured) ||
    !value.configured.every((item) => typeof item === "string")
  )
    throw new Error("Invalid deployment configuration response");
  return value as ConfigurationDoc;
}

export async function saveConfiguration(
  revision: string,
  changes: Record<string, string>,
): Promise<void> {
  const requestId = crypto.randomUUID().replaceAll("-", "");
  const path = `/opt/ervisio-todo/.plugin-config/requests/${requestId}.json`;
  const sdk = getSdk();
  await sdk.files.write(path, JSON.stringify({ revision, changes }));
  try {
    await command("configuration-save", [requestId]);
  } catch (error) {
    try {
      await sdk.files.remove(path);
    } catch (cleanupError) {
      if (!(
        cleanupError &&
        typeof cleanupError === "object" &&
        "code" in cleanupError &&
        cleanupError.code === "not_found"
      ))
        throw new Error(
          "Configuration save failed and its private request could not be removed",
          { cause: error },
        );
    }
    throw error;
  }
}

export const applyConfiguration = async (): Promise<void> => {
  await command("configuration-apply");
};
