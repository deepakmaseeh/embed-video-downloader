import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import os from "os";

/** Cross-platform yt-dlp launcher (Windows `py -3.12` or Linux `python3`). */
export function spawnYtDlp(
  ytdlpArgs: string[],
  options?: { windowsHide?: boolean }
): ChildProcessWithoutNullStreams {
  const isWin = os.platform() === "win32";
  if (isWin) {
    return spawn("py", ["-3.12", "-m", "yt_dlp", ...ytdlpArgs], {
      windowsHide: options?.windowsHide !== false,
    });
  }
  return spawn("python3", ["-m", "yt_dlp", ...ytdlpArgs]);
}

export function curlBinary(): string {
  return os.platform() === "win32" ? "curl.exe" : "curl";
}
