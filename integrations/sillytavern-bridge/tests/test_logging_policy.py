import logging
from pathlib import Path
from unittest.mock import Mock

import pytest

from portal_bridge import logging_policy
from portal_bridge.logging_policy import BoundedFormatter, RejectionLog, rotating_handler


def test_rejection_flood_is_aggregated_with_count_and_no_details() -> None:
    logger = Mock()
    now = [0.0]
    log = RejectionLog(logger, clock=lambda: now[0])
    for _ in range(10_000):
        log.record("owner_required", 401)
    assert logger.warning.call_count == 1
    now[0] = 60.0
    log.record("owner_required", 401)
    assert logger.warning.call_count == 2
    assert logger.warning.call_args.args == (
        "portal_request_failed code=%s status=%d suppressed=%d", "owner_required", 401, 9999,
    )


def test_rejection_code_state_is_bounded() -> None:
    logger = Mock()
    log = RejectionLog(logger, clock=lambda: 0.0)
    for index in range(1000):
        log.record(f"synthetic_{index}", 400)
    log.record("private\ncontent", 400)
    assert len(log.entries) <= 33
    assert logger.warning.call_count <= 33
    assert "private" not in str(logger.warning.call_args_list)


def test_formatter_bounds_utf8_and_removes_multiline_injection() -> None:
    record = logging.LogRecord("test", logging.ERROR, "", 0, "\n\r" + "界" * 10_000, (), None)
    text = BoundedFormatter("%(message)s").format(record)
    assert len((text + "\n").encode("utf-8")) <= logging_policy.MAX_RECORD_BYTES
    assert "\n" not in text and "\r" not in text
    assert text.endswith("[truncated]")


def test_unicode_flood_respects_file_count_and_total_byte_quota(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(logging_policy, "MAX_LOG_BYTES", 16 * 1024)
    path = tmp_path / "bridge.log"
    handler = rotating_handler(path)
    logger = logging.getLogger("rotation-fixture")
    logger.propagate = False
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    try:
        for _ in range(200):
            logger.error("界" * 10_000)
        files = list(tmp_path.glob("bridge.log*"))
        assert len(files) == logging_policy.LOG_BACKUPS + 1
        assert all(file.stat().st_size <= logging_policy.MAX_LOG_BYTES for file in files)
        assert sum(file.stat().st_size for file in files) <= logging_policy.MAX_LOG_BYTES * (logging_policy.LOG_BACKUPS + 1)
    finally:
        logger.removeHandler(handler)
        handler.close()


def test_adopts_and_bounds_old_oversized_logs(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(logging_policy, "MAX_LOG_BYTES", 8192)
    path = tmp_path / "bridge.log"
    for suffix in ("", ".1", ".2", ".3"):
        Path(f"{path}{suffix}").write_bytes(b"x" * 50_000)
    handler = rotating_handler(path)
    handler.close()
    assert all(file.stat().st_size <= 8192 for file in tmp_path.iterdir())


def test_symlink_logs_fail_without_modifying_destination(tmp_path: Path) -> None:
    destination = tmp_path / "keep"
    destination.write_bytes(b"preserved")
    path = tmp_path / "bridge.log"
    path.symlink_to(destination)
    with pytest.raises(ValueError, match="regular files"):
        rotating_handler(path)
    assert destination.read_bytes() == b"preserved"


def test_windows_runner_uses_shared_rotation_and_no_access_logging(tmp_path: Path, monkeypatch) -> None:
    from portal_bridge import run_bridge
    import uvicorn
    handler = rotating_handler(tmp_path / "bridge.log")
    root = logging.getLogger()
    old_handlers, old_level = root.handlers[:], root.level
    names = ("uvicorn", "uvicorn.error", "uvicorn.access")
    saved = {name: (logging.getLogger(name).handlers[:], logging.getLogger(name).propagate) for name in names}
    run = Mock()
    monkeypatch.setattr(run_bridge, "rotating_handler", lambda _path: handler)
    monkeypatch.setattr(uvicorn, "run", run)
    try:
        run_bridge.main()
        assert run.call_args.kwargs == {
            "host": "127.0.0.1", "port": 5001, "proxy_headers": False,
            "access_log": False, "log_config": None,
        }
        assert root.handlers == [handler]
        assert all(logging.getLogger(name).propagate and not logging.getLogger(name).handlers for name in names)
    finally:
        root.handlers = old_handlers
        root.setLevel(old_level)
        for name, (handlers, propagate) in saved.items():
            logging.getLogger(name).handlers = handlers
            logging.getLogger(name).propagate = propagate
        handler.close()
