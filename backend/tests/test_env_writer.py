from __future__ import annotations

from pathlib import Path

from app.services.env_writer import parse_env_file, render_updated_env, write_env_file


def test_render_preserves_comments_and_order() -> None:
    src = (
        "# header comment\n"
        "PRINTER_IP=1.2.3.4\n"
        "\n"
        "# block about telemetry\n"
        "TELEMETRY_INTERVAL_SECONDS=10\n"
        "LOG_LEVEL=INFO\n"
    )
    out = render_updated_env(src, {"PRINTER_IP": "5.6.7.8", "LOG_LEVEL": "DEBUG"})
    lines = out.splitlines()
    assert lines[0] == "# header comment"
    assert lines[1].startswith('PRINTER_IP="5.6.7.8"')
    assert lines[2] == ""
    assert lines[3] == "# block about telemetry"
    assert lines[4].startswith("TELEMETRY_INTERVAL_SECONDS=")
    assert lines[5].startswith('LOG_LEVEL="DEBUG"')


def test_render_appends_new_keys() -> None:
    src = "EXISTING=1\n"
    out = render_updated_env(src, {"NEW_KEY": "hello"})
    assert "EXISTING=1" in out
    assert 'NEW_KEY="hello"' in out


def test_parse_strips_quotes_and_inline_comments() -> None:
    src = (
        '# comment\n'
        'A="quoted value"\n'
        "B=raw # inline\n"
        "C='single'\n"
    )
    parsed = parse_env_file(_tmp_with(src))
    assert parsed["A"] == "quoted value"
    assert parsed["B"] == "raw"
    assert parsed["C"] == "single"


def test_write_round_trip(tmp_path: Path) -> None:
    src = "# header\nPRINTER_IP=1.1.1.1\nLOG_LEVEL=INFO\n"
    p = tmp_path / "env"
    p.write_text(src, encoding="utf-8")
    write_env_file(p, {"PRINTER_IP": "2.2.2.2"})
    parsed = parse_env_file(p)
    assert parsed["PRINTER_IP"] == "2.2.2.2"
    assert parsed["LOG_LEVEL"] == "INFO"
    text = p.read_text(encoding="utf-8")
    assert text.startswith("# header\n")


def _tmp_with(src: str) -> Path:
    import tempfile

    with tempfile.NamedTemporaryFile(
        "w", suffix=".env", delete=False, encoding="utf-8"
    ) as f:
        f.write(src)
        path = Path(f.name)
    return path
