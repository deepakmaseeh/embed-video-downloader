#!/usr/bin/env python3
"""Fetch a URL with Chrome TLS fingerprint (curl_cffi) to reduce Cloudflare blocks."""
from __future__ import annotations

import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: cf_fetch.py <url> [accept]", file=sys.stderr)
        return 2

    url = sys.argv[1]
    accept = sys.argv[2] if len(sys.argv) > 2 else "text/html,application/xhtml+xml"

    try:
        from curl_cffi import requests
    except ImportError:
        print(json.dumps({"ok": False, "error": "curl_cffi not installed"}))
        return 1

    headers = {
        "Accept": accept,
        "Accept-Language": "en-US,en;q=0.9",
    }

    last_err = None
    for impersonate in ("chrome131", "chrome124", "chrome120", "safari17_0"):
        try:
            res = requests.get(
                url,
                impersonate=impersonate,
                headers=headers,
                timeout=45,
                allow_redirects=True,
            )
            text = res.text or ""
            challenged = bool(
                (
                    "just a moment" in text.lower()
                    or "challenge-platform" in text.lower()
                    or "cf-browser-verification" in text.lower()
                )
                and "__NEXT_DATA__" not in text
                and '"data"' not in text[:500]
            )
            if challenged or res.status_code in (403, 503):
                last_err = f"challenge status={res.status_code} via {impersonate}"
                continue
            print(
                json.dumps(
                    {
                        "ok": True,
                        "status": res.status_code,
                        "impersonate": impersonate,
                        "body": text,
                    }
                )
            )
            return 0
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
            continue

    print(json.dumps({"ok": False, "error": last_err or "all impersonate attempts failed"}))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
