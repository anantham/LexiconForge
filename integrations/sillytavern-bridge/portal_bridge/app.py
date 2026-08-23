from __future__ import annotations

import hashlib
import logging
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import Settings
from .errors import BridgeError
from .models import ErrorResponse, HealthResponse, SelfInsertRequest, SelfInsertSuccess
from .request_control import CreationGate
from .security import authorize_owner, require_idempotency_key
from .service import PortalService


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
LOGGER = logging.getLogger("lexiconforge.portal")


async def _read_bounded_json(request: Request, max_request_bytes: int) -> bytes:
    content_type = request.headers.get("Content-Type", "").split(";", 1)[0].strip().casefold()
    if content_type != "application/json":
        raise BridgeError(
            "unsupported_media_type",
            "Self-insert requests must use Content-Type: application/json.",
            415,
        )

    raw_content_length = request.headers.get("Content-Length")
    if raw_content_length:
        try:
            content_length = int(raw_content_length)
        except ValueError as error:
            raise BridgeError(
                "invalid_content_length",
                "Content-Length must be a non-negative integer.",
                400,
            ) from error
        if content_length < 0:
            raise BridgeError(
                "invalid_content_length",
                "Content-Length must be a non-negative integer.",
                400,
            )
        if content_length > max_request_bytes:
            raise BridgeError(
                "request_too_large",
                f"Self-insert request exceeds the {max_request_bytes}-byte limit.",
                413,
            )

    chunks: list[bytes] = []
    total_bytes = 0
    async for chunk in request.stream():
        total_bytes += len(chunk)
        if total_bytes > max_request_bytes:
            raise BridgeError(
                "request_too_large",
                f"Self-insert request exceeds the {max_request_bytes}-byte limit.",
                413,
            )
        chunks.append(chunk)
    body = b"".join(chunks)
    if not body:
        raise BridgeError("invalid_request", "Self-insert request body is empty.", 422)
    return body


def create_app(
    settings: Settings | None = None,
    service_factory: Callable[[], PortalService] | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings.from_environment()
    factory = service_factory or (lambda: PortalService(resolved_settings))
    creation_gate: CreationGate[SelfInsertSuccess] = CreationGate(
        ttl_seconds=resolved_settings.idempotency_ttl_seconds,
        max_entries=resolved_settings.idempotency_max_entries,
        cooldown_seconds=resolved_settings.creation_cooldown_seconds,
    )
    application = FastAPI(title="LexiconForge SillyTavern Bridge", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", "Idempotency-Key"],
    )

    @application.exception_handler(BridgeError)
    async def bridge_error_handler(_request: Request, error: BridgeError) -> JSONResponse:
        LOGGER.error("portal_request_failed code=%s message=%s", error.code, error.message)
        payload = ErrorResponse(error=error.code, message=error.message)
        return JSONResponse(
            status_code=error.status_code,
            content=payload.model_dump(),
            headers=error.headers,
        )

    @application.get("/", response_model=HealthResponse)
    @application.get("/health", response_model=HealthResponse)
    async def health(request: Request) -> HealthResponse:
        authorize_owner(request, resolved_settings)
        return await factory().health()

    @application.post(
        "/api/self-insert",
        response_model=SelfInsertSuccess,
        responses={
            400: {"model": ErrorResponse},
            401: {"model": ErrorResponse},
            403: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            413: {"model": ErrorResponse},
            415: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            429: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    async def self_insert(request: Request) -> SelfInsertSuccess:
        authorize_owner(request, resolved_settings)
        idempotency_key = require_idempotency_key(request)
        body = await _read_bounded_json(request, resolved_settings.max_request_bytes)
        try:
            parsed_request = SelfInsertRequest.model_validate_json(body)
        except ValidationError as error:
            details = "; ".join(
                f"{'.'.join(map(str, item['loc']))}: {item['msg']}" for item in error.errors()
            )
            raise BridgeError(
                "invalid_request",
                f"Invalid self-insert request: {details}",
                422,
            ) from error

        fingerprint = hashlib.sha256(body).hexdigest()
        return await creation_gate.run(
            idempotency_key,
            fingerprint,
            lambda: factory().self_insert(parsed_request),
        )

    return application


app = create_app()
