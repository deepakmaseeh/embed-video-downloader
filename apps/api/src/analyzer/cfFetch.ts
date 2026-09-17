import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

function pythonBin(): string {
  return os.platform() === "win32" ? "py" : "python3";
}

function pythonArgs(scriptArgs: string[]): string[] {
  if (os.platform() === "win32") {
    return ["-3.12", ...scriptArgs];
  }
  return scriptArgs;
}

export type CfFetchResult = {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
  impersonate?: string;
};

/** Chrome-TLS fetch via curl_cffi (best chance past Cloudflare from cloud hosts). */
export async function cfFetch(url: string, accept?: string): Promise<CfFetchResult> {
  const script = path.join(process.cwd(), "scripts", "cf_fetch.py");
  const args = pythonArgs([script, url, ...(accept ? [accept] : [])]);
  try {
    const { stdout, stderr } = await execFileAsync(pythonBin(), args, {
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024,
      windowsHide: true,
      timeout: 60000,
    });
    const line = (stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "";
    if (!line) {
      return { ok: false, error: stderr?.trim() || "empty cf_fetch response" };
    }
    return JSON.parse(line) as CfFetchResult;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function cfFetchText(url: string, accept?: string): Promise<string> {
  const result = await cfFetch(url, accept);
  if (!result.ok || !result.body) {
    throw new Error(result.error || "cf_fetch failed");
  }
  return result.body;
}

export async function withRetries<T>(
  label: string,
  attempts: number,
  fn: (attempt: number) => Promise<T>
): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      last = err;
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 1200 * i));
      }
    }
  }
  throw new Error(
    `${label} failed after ${attempts} tries: ${last instanceof Error ? last.message : String(last)}`
  );
}
