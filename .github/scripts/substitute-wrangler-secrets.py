#!/usr/bin/env python3
"""
Substitute wrangler config placeholders with real values from GitHub Secrets.

Auto-detects ALL_CAPS_SNAKE_CASE placeholder values in wrangler.jsonc and
substitutes them from SECRETS_JSON (the full GitHub secrets bag). No explicit
key list, no per-secret env vars, no mapping table.

The only configuration needed per app:
    1. Use placeholder values in wrangler.jsonc (e.g. "database_id": "D1_DATABASE_ID")
    2. Add the corresponding GitHub Secret (D1_DATABASE_ID = <real-uuid>)
    That's it.

Multi-app support:
    - Same placeholder value across apps → same GitHub Secret → same real ID → shared resource
    - Different values → isolated (prefixing like APP_1_D1_DATABASE_ID is a convention, not required)

Usage:
    SECRETS_JSON='{"D1_DATABASE_ID":"abc123","KV_NAMESPACE_ID":"def456"}' \
    TARGET_ENV=production \
    OUTPUT_FILE=wrangler.production.jsonc \
    python substitute-wrangler-secrets.py

List-only mode (for Verify step; outputs placeholders to stdout, one per line):
    TARGET_ENV=production \
    WRANGLER_CONFIG=apps/my-app/wrangler.jsonc \
    python substitute-wrangler-secrets.py --list-only

Required env vars (normal mode):
    SECRETS_JSON   - JSON object of all GitHub Secrets (via ${{ toJson(secrets) }})
    TARGET_ENV     - Which wrangler env section to scan: "production" or "preview"
    OUTPUT_FILE    - Output path for generated config
    WRANGLER_CONFIG - Input config path (default: wrangler.jsonc)
"""

import json
import os
import re
import sys
from pathlib import Path

# Matches JSON string values that look like placeholder secret names:
# - Fully uppercase letters, digits, underscores
# - Must contain at least one underscore (real secret names are compound: D1_DATABASE_ID, not PENDING)
# Excludes known non-placeholder prefixes (binding names, env names, etc.)
PLACEHOLDER_RE = re.compile(r'":\s*"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"')
SKIP_PREFIXES = ("OBCF_", "NODE_", "UTF", "HTTP")


def log(msg: str, stream=sys.stderr) -> None:
    """Print to stderr (visible in workflow logs, not captured as output)."""
    print(msg, file=stream)
    stream.flush()


def err_exit(msg: str, code: int = 1) -> None:
    """Log error and exit with code."""
    log(f"\n{msg}")
    sys.exit(code)


def find_placeholders(content: str) -> list[str]:
    """Find all ALL_CAPS_SNAKE_CASE values in JSON string fields."""
    matches = PLACEHOLDER_RE.findall(content)
    seen = set()
    result = []
    for m in matches:
        if m not in seen and not any(m.startswith(p) for p in SKIP_PREFIXES):
            seen.add(m)
            result.append(m)
    return result


def extract_env_section(content: str, env_name: str) -> tuple[int, int] | None:
    """Extract the start and end positions of a specific env section.

    Finds the "production": { ... } block inside "env": { ... } by matching
    braces. Returns (start, end) character positions or None if not found.
    """
    # Find "env" key, then find the target environment within it
    env_pattern = re.compile(rf'"env"\s*:\s*\{{', re.IGNORECASE)
    env_match = env_pattern.search(content)
    if not env_match:
        return None

    # Find the target env inside the env block
    target_pattern = re.compile(rf'"{env_name}"\s*:\s*\{{', re.IGNORECASE)
    target_match = target_pattern.search(content, env_match.start())
    if not target_match:
        return None

    # Find the opening brace of the target section and match to its close
    brace_start = content.index("{", target_match.start() + len(env_name))
    depth = 0
    for i in range(brace_start, len(content)):
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                return (brace_start, i + 1)
    return None


def main() -> None:
    list_only = "--list-only" in sys.argv
    config_path = os.environ.get("WRANGLER_CONFIG", "wrangler.jsonc").strip()
    output_path = os.environ.get("OUTPUT_FILE", "").strip()
    secrets_json = os.environ.get("SECRETS_JSON", "").strip()
    target_env = os.environ.get("TARGET_ENV", "").strip()

    # List-only mode: output placeholders to stdout for workflow Verify step (no SECRETS_JSON/OUTPUT_FILE needed)
    if list_only:
        if not target_env:
            err_exit("❌ ERROR: TARGET_ENV required for --list-only")
        input_file = Path(config_path)
        if not input_file.exists():
            err_exit(
                f"❌ ERROR: Wrangler configuration file not found\n  Expected: {input_file.absolute()}"
            )
        content = input_file.read_text(encoding="utf-8")
        bounds = extract_env_section(content, target_env)
        if not bounds:
            err_exit(f"❌ ERROR: env.{target_env} section not found in {config_path}")
        env_text = content[bounds[0] : bounds[1]]
        placeholders = find_placeholders(env_text)
        for p in placeholders:
            print(p)
        return

    if not output_path:
        err_exit(
            "❌ ERROR: OUTPUT_FILE is required.\n"
            "  Example: OUTPUT_FILE=wrangler.production.jsonc"
        )

    if not secrets_json:
        err_exit(
            "❌ ERROR: SECRETS_JSON is required.\n"
            "  Pass all GitHub Secrets via: SECRETS_JSON: ${{ toJson(secrets) }}"
        )

    if not target_env:
        err_exit(
            "❌ ERROR: TARGET_ENV is required.\n"
            "  Set to 'production' or 'preview' to indicate which env section to scan."
        )

    # Parse secrets
    try:
        secrets: dict[str, str] = json.loads(secrets_json)
    except json.JSONDecodeError as e:
        err_exit(f"❌ ERROR: SECRETS_JSON is not valid JSON.\n  {e}")

    # Resolve paths
    input_file = Path(config_path)
    output_file = Path(output_path)

    if not input_file.exists():
        err_exit(
            f"❌ ERROR: Wrangler configuration file not found\n\n"
            f"  Expected: {input_file.absolute()}\n"
            f"  Current dir: {Path.cwd()}\n\n"
            "  Make sure your app has a wrangler.jsonc in its root."
        )

    content = input_file.read_text(encoding="utf-8")

    # Extract the target env section to find placeholders
    bounds = extract_env_section(content, target_env)
    if not bounds:
        err_exit(
            f"❌ ERROR: env.{target_env} section not found in {config_path}\n\n"
            f"  Make sure wrangler.jsonc has an \"env\": {{ \"{target_env}\": {{ ... }} }} block."
        )

    env_start, env_end = bounds
    env_text = content[env_start:env_end]

    # Auto-detect placeholders from the env section only
    placeholders = find_placeholders(env_text)

    if not placeholders:
        log(f"⚠️  No placeholders detected in env.{target_env}. Nothing to substitute.")
        output_file.write_text(content, encoding="utf-8")
        log(f"✅ Configuration written (unchanged): {output_file}")
        return

    log(f"🔍 Detected {len(placeholders)} placeholder(s) in env.{target_env}: {', '.join(placeholders)}")

    # Substitute placeholders ONLY within the target env section (not the whole file).
    # This prevents: (1) leaking secrets into comments, (2) cross-env collision if
    # production and preview share a placeholder name but with different secrets.
    substituted = []
    missing = []

    for key in placeholders:
        value = secrets.get(key, "")
        if not value:
            missing.append(key)
            continue
        env_text = env_text.replace(key, value)
        substituted.append(key)

    # Reassemble file: before env section + substituted env section + after env section
    content = content[:env_start] + env_text + content[env_end:]

    if missing:
        err_exit(
            f"❌ ERROR: Secret substitution incomplete\n\n"
            f"  Placeholders detected in env.{target_env} but no matching GitHub Secret:\n"
            + "".join(f"    • {m}\n" for m in missing)
            + "\n"
            f"  Add the missing secrets in GitHub repository settings:\n"
            f"  Settings → Secrets and variables → Actions → New repository secret"
        )

    # Basic validity check
    if "{" not in content:
        err_exit(
            f"❌ ERROR: Generated config appears invalid\n\n"
            f"  Output does not contain valid JSON structure.\n"
            f"  Check source: {input_file}"
        )

    output_file.write_text(content, encoding="utf-8")
    log(f"✅ Configuration generated: {output_file}")
    log(f"  Substituted: {', '.join(substituted)}")


if __name__ == "__main__":
    main()
