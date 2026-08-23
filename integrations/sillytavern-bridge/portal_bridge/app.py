from __future__ import annotations

import logging
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .errors import BridgeError
from .models import ErrorResponse, HealthResponse, SelfInsertRequest, SelfInsertSuccess
from .service import PortalService


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
LOGGER = logging.getLogger("lexiconforge.portal")


def create_app(
    settings: Settings | None = None,
    service_factory: Callable[[], PortalService] | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings.from_environment()
    factory = service_factory or (lambda: PortalService(resolved_settings))
    application = FastAPI(title="LexiconForge SillyTavern Bridge", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @application.exception_handler(BridgeError)
    async def bridge_error_handler(_request: Request, error: BridgeError) -> JSONResponse:
        LOGGER.error("portal_request_failed code=%s message=%s", error.code, error.message)
        payload = ErrorResponse(error=error.code, message=error.message)
        return JSONResponse(status_code=error.status_code, content=payload.model_dump())

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(_request: Request, error: RequestValidationError) -> JSONResponse:
        details = "; ".join(
            f"{'.'.join(map(str, item['loc']))}: {item['msg']}" for item in error.errors()
        )
        payload = ErrorResponse(
            error="invalid_request",
            message=f"Invalid self-insert request: {details}",
        )
        return JSONResponse(status_code=422, content=payload.model_dump())

    @application.get("/", response_model=HealthResponse)
    @application.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return await factory().health()

    @application.post(
        "/api/self-insert",
        response_model=SelfInsertSuccess,
        responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    )
    async def self_insert(request: SelfInsertRequest) -> SelfInsertSuccess:
        return await factory().self_insert(request)

    return application


app = create_app()
