import asyncio

import pytest

from portal_bridge.errors import BridgeError
from portal_bridge.request_control import CreationGate


async def test_distinct_key_is_retryably_busy_while_creation_is_active() -> None:
    gate: CreationGate[str] = CreationGate(ttl_seconds=60, max_entries=4, cooldown_seconds=0)
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow_operation() -> str:
        started.set()
        await release.wait()
        return "created"

    first = asyncio.create_task(gate.run("portal-request-0001", "body-a", slow_operation))
    await started.wait()

    with pytest.raises(BridgeError) as raised:
        await gate.run("portal-request-0002", "body-b", slow_operation)

    assert raised.value.status_code == 429
    assert raised.value.headers == {"Retry-After": "2"}
    release.set()
    assert await first == "created"


async def test_same_key_joins_one_active_creation() -> None:
    gate: CreationGate[str] = CreationGate(ttl_seconds=60, max_entries=4, cooldown_seconds=0)
    started = asyncio.Event()
    release = asyncio.Event()
    calls = 0

    async def slow_operation() -> str:
        nonlocal calls
        calls += 1
        started.set()
        await release.wait()
        return "created"

    first = asyncio.create_task(gate.run("portal-request-0001", "body-a", slow_operation))
    await started.wait()
    retry = asyncio.create_task(gate.run("portal-request-0001", "body-a", slow_operation))
    await asyncio.sleep(0)
    release.set()

    assert await first == "created"
    assert await retry == "created"
    assert calls == 1


async def test_waiter_cancellation_does_not_cancel_accepted_creation() -> None:
    gate: CreationGate[str] = CreationGate(ttl_seconds=60, max_entries=4, cooldown_seconds=0)
    started = asyncio.Event()
    release = asyncio.Event()
    completed = asyncio.Event()

    async def slow_operation() -> str:
        started.set()
        await release.wait()
        completed.set()
        return "created"

    waiter = asyncio.create_task(gate.run("portal-request-0001", "body-a", slow_operation))
    await started.wait()
    waiter.cancel()
    with pytest.raises(asyncio.CancelledError):
        await waiter

    release.set()
    await asyncio.wait_for(completed.wait(), timeout=1)
    assert await gate.run("portal-request-0001", "body-a", slow_operation) == "created"


async def test_distinct_sequential_creation_is_rate_limited() -> None:
    gate: CreationGate[str] = CreationGate(ttl_seconds=60, max_entries=4, cooldown_seconds=10)

    async def operation() -> str:
        return "created"

    assert await gate.run("portal-request-0001", "body-a", operation) == "created"

    with pytest.raises(BridgeError) as raised:
        await gate.run("portal-request-0002", "body-b", operation)

    assert raised.value.code == "creation_rate_limited"
    assert raised.value.status_code == 429
    assert raised.value.headers == {"Retry-After": "10"}
