"""FastAPI app: REST API + static dashboard. Optional bearer token (AGENCY_ADMIN_TOKEN) for remote deployments."""
from __future__ import annotations

import hmac
import os
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from ..config import ROOT, load_env
from .routes import r

WEB = ROOT / "web"


def create_app() -> FastAPI:
    app = FastAPI(title="AI Agency OS", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

    @app.middleware("http")
    async def auth(request: Request, call_next):
        # CSRF: a browser sends Origin on cross-site writes; refuse writes coming from another site.
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api/"):
            origin = request.headers.get("origin")
            if origin and urlparse(origin).netloc != request.headers.get("host", ""):
                return JSONResponse({"detail": "cross-origin request refused"}, status_code=403)
        token = load_env().admin_token
        if token and request.url.path.startswith("/api/") and request.url.path != "/api/health":
            sent = request.headers.get("authorization", "").removeprefix("Bearer ").strip() or request.query_params.get("token", "")
            if not hmac.compare_digest(sent.encode(), token.encode()):
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    # DNS-rebinding protection: only answer for known host names (add yours in AGENCY_ALLOWED_HOSTS).
    hosts = ["localhost", "127.0.0.1", "[::1]", *[h.strip() for h in os.environ.get("AGENCY_ALLOWED_HOSTS", "").split(",") if h.strip()]]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    app.include_router(r)
    app.mount("/static", StaticFiles(directory=WEB), name="static")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(WEB / "index.html")

    return app
