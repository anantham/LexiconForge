"""Bounded operational logs; request bodies and rejection details stay out."""
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from threading import Lock
import time


MAX_LOG_BYTES = 2 * 1024 * 1024
LOG_BACKUPS = 3
MAX_RECORD_BYTES = 4096


class BoundedFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        text = super().format(record).replace("\r", "\\r").replace("\n", "\\n")
        encoded = text.encode("utf-8", errors="replace")
        if len(encoded) > MAX_RECORD_BYTES - 1:
            text = encoded[:MAX_RECORD_BYTES - 16].decode("utf-8", errors="ignore") + " [truncated]"
        return text


class ByteRotatingHandler(RotatingFileHandler):
    def shouldRollover(self, record: logging.LogRecord) -> bool:
        if self.stream is None:
            self.stream = self._open()
        self.stream.seek(0, 2)
        size = len((self.format(record) + "\n").encode("utf-8"))
        return self.stream.tell() + size >= self.maxBytes


def rotating_handler(log_path: Path) -> RotatingFileHandler:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    # Enforce the quota even when adopting logs created by the old launcher.
    for index in range(LOG_BACKUPS + 1):
        file = log_path if index == 0 else Path(f"{log_path}.{index}")
        if file.is_symlink() or (file.exists() and not file.is_file()):
            raise ValueError("Bridge log paths must be regular files")
        if file.exists() and file.stat().st_size > MAX_LOG_BYTES:
            with file.open("rb") as source:
                source.seek(-MAX_LOG_BYTES, 2)
                tail = source.read(MAX_LOG_BYTES)
            file.write_bytes(tail)
    handler = ByteRotatingHandler(
        log_path, maxBytes=MAX_LOG_BYTES, backupCount=LOG_BACKUPS, encoding="utf-8",
    )
    handler.setFormatter(BoundedFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    return handler


class RejectionLog:
    """One record per code/minute; bounded state and summaries on next activity."""

    def __init__(self, logger: logging.Logger, clock=time.monotonic) -> None:
        self.logger = logger
        self.clock = clock
        self.entries: dict[str, tuple[float, int]] = {}
        self.lock = Lock()

    def record(self, code: str, status: int) -> None:
        # Codes are application constants; never retain attacker-supplied strings.
        if not code.isascii() or not code.replace("_", "").isalnum() or len(code) > 64:
            code = "other"
        with self.lock:
            if code not in self.entries and len(self.entries) >= 32:
                code = "other"
            now = self.clock()
            previous = self.entries.get(code)
            if previous and now - previous[0] < 60:
                self.entries[code] = (previous[0], previous[1] + 1)
                return
            suppressed = previous[1] if previous else 0
            self.entries[code] = (now, 0)
        self.logger.warning(
            "portal_request_failed code=%s status=%d suppressed=%d", code, status, suppressed,
        )
