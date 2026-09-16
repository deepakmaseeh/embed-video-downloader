import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
]);

function ipVersion(ip: string): 4 | 6 | 0 {
  if (net.isIP(ip) === 4) return 4;
  if (net.isIP(ip) === 6) return 6;
  return 0;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is required");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are allowed");
  }
  parsed.hash = "";
  return parsed.toString();
}

export async function assertSafeUrl(input: string): Promise<string> {
  const url = normalizeUrl(input);
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("This host is blocked for security");
  }

  if (ipVersion(host) === 4 && isPrivateIpv4(host)) {
    throw new Error("Private IP addresses are blocked");
  }
  if (ipVersion(host) === 6 && isPrivateIpv6(host)) {
    throw new Error("Private IP addresses are blocked");
  }

  // Resolve hostname and check all answers
  if (!ipVersion(host)) {
    let addresses: string[] = [];
    try {
      const result = await dns.lookup(host, { all: true });
      addresses = result.map((r) => r.address);
    } catch {
      throw new Error("Could not resolve host");
    }
    for (const addr of addresses) {
      if (ipVersion(addr) === 4 && isPrivateIpv4(addr)) {
        throw new Error("URL resolves to a private network address");
      }
      if (ipVersion(addr) === 6 && isPrivateIpv6(addr)) {
        throw new Error("URL resolves to a private network address");
      }
    }
  }

  return url;
}
