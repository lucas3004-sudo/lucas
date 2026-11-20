"""FastAPI app: REST API + static dashboard. Optional bearer token (AGENCY_ADMIN_TOKEN) for remote deployments."""
from __future__ import annotations

import hmac

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ..config import ROOT, load_env
from .routes import r

WEB = ROOT / "web"


def create_app() -> FastAPI:
    app = FastAPI(title="AI Agency OS", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

    @app.middleware("http")
    async def auth(request: Request, call_next):
        token = load_env().admin_token
        if token and request.url.path.startswith("/api/") and request.url.path != "/api/health":
            sent = request.headers.get("authorization", "").removeprefix("Bearer ").strip() or request.query_params.get("token", "")
            if not hmac.compare_digest(sent, token):
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    app.include_router(r)
    app.mount("/static", StaticFiles(directory=WEB), name="static")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(WEB / "index.html")

    return app
