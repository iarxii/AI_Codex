"""Shared FastAPI dependencies — single import point for all routers."""

from backend.api.deps.auth import (
    create_access_token,
    get_current_active_user,
    get_current_user,
    get_current_user_optional,
    get_user_from_token,
    oauth2_scheme,
    oauth2_scheme_optional,
)
from backend.db.session import get_db, pwd_context
from backend.config import settings

__all__ = [
    # Auth
    "oauth2_scheme",
    "oauth2_scheme_optional",
    "create_access_token",
    "get_current_user",
    "get_current_active_user",
    "get_current_user_optional",
    "get_user_from_token",
    # DB
    "get_db",
    "pwd_context",
    # Config
    "settings",
]