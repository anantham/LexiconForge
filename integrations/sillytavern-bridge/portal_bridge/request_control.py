from __future__ import annotations

import asyncio
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
import math
import time
from typing import Generic, TypeVar

from .errors import BridgeError


ResultT = TypeVar("ResultT")


@dataclass
class _Entry(Generic[ResultT]):
    fingerprint: str
    task: asyncio.Task[ResultT]
    completed_at: float | None = None


class CreationGate(Generic[ResultT]):
    """Coalesce exact retries and permit only one artifact-creation job at a time."""

    def __init__(self, ttl_seconds: float, max_entries: int, cooldown_seconds: float = 2.0) -> None:
        if ttl_seconds <= 0:
            raise ValueError("idempotency ttl_seconds must be positive")
        if max_entries < 1:
            raise ValueError("idempotency max_entries must be at least one")
        if cooldown_seconds < 0:
            raise ValueError("creation cooldown_seconds cannot be negative")
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._cooldown_seconds = cooldown_seconds
        self._entries: OrderedDict[str, _Entry[ResultT]] = OrderedDict()
        self._active_key: str | None = None
        self._last_started_at: float | None = None
        self._lock = asyncio.Lock()

    async def run(
        self,
        key: str,
        fingerprint: str,
        operation: Callable[[], Awaitable[ResultT]],
    ) -> ResultT:
        async with self._lock:
            self._prune_completed()
            existing = self._entries.get(key)
            if existing is not None:
                if existing.fingerprint != fingerprint:
                    raise BridgeError(
                        "idempotency_conflict",
                        "Idempotency-Key was already used with a different request body.",
                        409,
                    )
                self._entries.move_to_end(key)
                task = existing.task
            else:
                if self._active_key is not None:
                    raise BridgeError(
                        "creation_busy",
                        "Another portal scene is being created; retry this request shortly with the same Idempotency-Key.",
                        429,
                        headers={"Retry-After": "2"},
                    )
                now = time.monotonic()
                if self._last_started_at is not None:
                    remaining = self._cooldown_seconds - (now - self._last_started_at)
                    if remaining > 0:
                        raise BridgeError(
                            "creation_rate_limited",
                            "Portal scenes are being created too quickly; retry this request shortly with the same Idempotency-Key.",
                            429,
                            headers={"Retry-After": str(max(1, math.ceil(remaining)))},
                        )
                self._make_room()
                task = asyncio.create_task(self._execute(key, operation))
                self._entries[key] = _Entry(fingerprint=fingerprint, task=task)
                self._active_key = key
                self._last_started_at = now

        return await asyncio.shield(task)

    async def _execute(
        self,
        key: str,
        operation: Callable[[], Awaitable[ResultT]],
    ) -> ResultT:
        try:
            return await operation()
        finally:
            async with self._lock:
                entry = self._entries.get(key)
                if entry is not None:
                    entry.completed_at = time.monotonic()
                if self._active_key == key:
                    self._active_key = None

    def _prune_completed(self) -> None:
        cutoff = time.monotonic() - self._ttl_seconds
        stale_keys = [
            key
            for key, entry in self._entries.items()
            if entry.completed_at is not None and entry.completed_at < cutoff
        ]
        for key in stale_keys:
            self._entries.pop(key, None)

    def _make_room(self) -> None:
        while len(self._entries) >= self._max_entries:
            oldest_key, oldest_entry = next(iter(self._entries.items()))
            if oldest_entry.completed_at is None:
                raise BridgeError(
                    "creation_busy",
                    "Another portal scene is being created; retry this request shortly with the same Idempotency-Key.",
                    429,
                    headers={"Retry-After": "2"},
                )
            self._entries.pop(oldest_key)
