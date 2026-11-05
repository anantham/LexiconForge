"""Windows foreground launcher with a finite operational log budget."""
from __future__ import annotations

import logging
from pathlib import Path

from .logging_policy import rotating_handler


def main() -> None:
    handler = rotating_handler(Path(__file__).parents[1] / "deploy/windows/logs/bridge.log")
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    # Uvicorn and application errors share the same quota. Avoid a per-request
    # access log, including for rejections before owner admission.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True
    import uvicorn
    uvicorn.run(
        "portal_bridge.app:app", host="127.0.0.1", port=5001,
        proxy_headers=False, access_log=False, log_config=None,
    )


if __name__ == "__main__":
    main()
