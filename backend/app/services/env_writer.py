"""Read and write the backend's .env-style configuration file.

Production stores the env file at /etc/bambu-monitor.env (loaded by systemd's
EnvironmentFile=). The bambu user cannot write to /etc directly, so we shell
out to `sudo tee` for paths outside the user's writable area. Comments and key
order are preserved by parsing line-by-line and rewriting only the values that
changed; new keys are appended at the end.
"""

from __future__ import annotations

import re
import shlex
import subprocess
from pathlib import Path

# KEY=value with optional surrounding quotes. Whitespace tolerated around `=`.
_LINE_RE = re.compile(r"^(?P<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?P<val>.*)$")


def parse_env_file(path: Path) -> dict[str, str]:
    """Return a dict of KEY -> value (unquoted) from a .env-style file."""
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = _LINE_RE.match(line)
        if not m:
            continue
        out[m.group("key")] = _unquote(m.group("val"))
    return out


def render_updated_env(original: str, updates: dict[str, str]) -> str:
    """Return a new .env body with `updates` applied to `original`.

    Comments and unrelated keys keep their position. Updated keys keep their
    line position with only the value rewritten. New keys are appended at the
    end with a leading blank line if the file didn't end with one.
    """
    seen: set[str] = set()
    out_lines: list[str] = []
    for raw in original.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            out_lines.append(raw)
            continue
        m = _LINE_RE.match(stripped)
        if not m:
            out_lines.append(raw)
            continue
        key = m.group("key")
        if key in updates:
            out_lines.append(f"{key}={_quote(updates[key])}")
            seen.add(key)
        else:
            out_lines.append(raw)

    new_keys = [k for k in updates if k not in seen]
    if new_keys:
        if out_lines and out_lines[-1].strip() != "":
            out_lines.append("")
        for k in new_keys:
            out_lines.append(f"{k}={_quote(updates[k])}")

    body = "\n".join(out_lines)
    if not body.endswith("\n"):
        body += "\n"
    return body


def write_env_file(path: Path, updates: dict[str, str]) -> None:
    """Apply updates to the env file, preserving comments and order.

    Uses `sudo tee` when the path is not writable by the current process.
    """
    original = path.read_text(encoding="utf-8") if path.exists() else ""
    new_body = render_updated_env(original, updates)
    _write_maybe_sudo(path, new_body)


def _write_maybe_sudo(path: Path, content: str) -> None:
    if _can_write(path):
        path.write_text(content, encoding="utf-8")
        return
    # Pipe content into sudo tee; sudoers must allow this exact path.
    cmd = ["sudo", "-n", "tee", str(path)]
    proc = subprocess.run(
        cmd,
        input=content,
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise PermissionError(
            f"sudo tee failed for {path}: {proc.stderr.strip() or proc.stdout.strip()}"
            f" (cmd: {shlex.join(cmd)})"
        )


def _can_write(path: Path) -> bool:
    target = path if path.exists() else path.parent
    try:
        # os.access respects effective uid; good enough for our purposes.
        import os

        return os.access(target, os.W_OK)
    except OSError:
        return False


def _unquote(val: str) -> str:
    val = val.strip()
    # Strip an inline comment that follows whitespace, but only if the value
    # is unquoted (otherwise it's part of the string).
    if val and val[0] not in ("'", '"'):
        # Split on first unescaped " #"
        idx = val.find(" #")
        if idx >= 0:
            val = val[:idx].rstrip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
        return val[1:-1]
    return val


def _quote(val: str) -> str:
    # Always double-quote on write for safety: handles spaces, #, etc.
    escaped = val.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'
