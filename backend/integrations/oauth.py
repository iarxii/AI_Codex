"""OAuth 2.0 core with PKCE support for provider integrations.

Handles the full OAuth flow:
- Generate PKCE challenge/verifier
- Build authorization URL
- Exchange authorization code for tokens
- Refresh expired access tokens
- Fernet-encrypt tokens at rest
"""

from __future__ import annotations

import base64
import hashlib
import secrets
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

from cryptography.fernet import Fernet
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Token data models
# ---------------------------------------------------------------------------

class OAuthTokens(BaseModel):
    """Decrypted OAuth token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None  # seconds
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    expires_at: Optional[datetime] = None  # UTC datetime

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.utcnow() >= self.expires_at

    @property
    def can_refresh(self) -> bool:
        return self.refresh_token is not None and not self.is_expired


# ---------------------------------------------------------------------------
# PKCE helpers
# ---------------------------------------------------------------------------

def _base64url_encode(data: bytes) -> str:
    """Encode bytes to URL-safe base64 (no padding)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_code_verifier(length: int = 32) -> str:
    """Generate a random PKCE code verifier (PLAIN text, 43-128 chars)."""
    return _base64url_encode(secrets.token_bytes(length))


def generate_code_challenger(code_verifier: str) -> str:
    """Generate PKCE code challenge (SHA-256 hash, base64url-encoded)."""
    return _base64url_encode(hashlib.sha256(code_verifier.encode("utf-8")).digest())


# ---------------------------------------------------------------------------
# Fernet encryption (key derived from SECRET_KEY)
# ---------------------------------------------------------------------------

_cipher: Optional[Fernet] = None


def _get_cipher() -> Fernet:
    """Lazily initialise the Fernet cipher from the application SECRET_KEY."""
    global _cipher
    if _cipher is None:
        from backend.config import settings
        secret = settings.SECRET_KEY
        # Fernet requires a 32-byte url-safe base64 key
        if len(secret) < 32:
            secret = secret.encode("utf-8") + b"\x00" * (32 - len(secret))
        _cipher = Fernet(base64.urlsafe_b64encode(secret[:32]))
    return _cipher


def encrypt_token(token_str: str) -> str:
    """Encrypt a token string for safe storage."""
    return _get_cipher().encrypt(token_str.encode("utf-8")).decode("ascii")


def decrypt_token(enc_str: str) -> str:
    """Decrypt a token string from storage."""
    return _get_cipher().decrypt(enc_str.encode("utf-8")).decode("utf-8")


# ---------------------------------------------------------------------------
# Authorization URL builder
# ---------------------------------------------------------------------------

class AuthURLParams(BaseModel):
    client_id: str
    redirect_uri: str
    scope: str
    state: str
    code_challenge: str
    code_challenge_method: str = "S256"  # S256 or PLAIN


def build_authorization_url(params: AuthURLParams) -> str:
    """Build the OAuth 2.0 authorization URL with PKCE."""
    params_dict = {
        "client_id": params.client_id,
        "redirect_uri": params.redirect_uri,
        "response_type": "code",
        "scope": params.scope,
        "state": params.state,
        "code_challenge": params.code_challenge,
        "code_challenge_method": params.code_challenge_method,
    }
    query_string = urllib.parse.urlencode(params_dict)
    # Google uses its own endpoint path; keep generic for now
    return f"https://accounts.google.com/o/oauth2/auth?{query_string}"


# ---------------------------------------------------------------------------
# Token exchange
# ---------------------------------------------------------------------------

class TokenExchangeError(BaseModel):
    """Raised when token exchange fails."""
    detail: str


async def exchange_code_for_tokens(
    *,
    code: str,
    code_verifier: str,
    client_id: str,
    client_secret: str,  # may be empty for public clients
    token_endpoint: str,
    redirect_uri: str,
) -> OAuthTokens:
    """Exchange an authorization code for OAuth tokens (PKCE flow)."""
    import httpx

    payload = {
        "code": code,
        "code_verifier": code_verifier,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "client_id": client_id,
    }
    if client_secret:
        payload["client_secret"] = client_secret

    async with httpx.AsyncClient() as client:
        resp = await client.post(token_endpoint, data=payload, timeout=30)

    if resp.status_code != 200:
        raise TokenExchangeError(
            detail=f"Token exchange failed: {resp.status_code} {resp.text}"
        )

    data = resp.json()
    expires_at = None
    if data.get("expires_in"):
        expires_at = datetime.utcnow() + timedelta(seconds=data["expires_in"])

    return OAuthTokens(
        access_token=data["access_token"],
        token_type=data.get("token_type", "bearer"),
        expires_in=data.get("expires_in"),
        refresh_token=data.get("refresh_token"),
        scope=data.get("scope"),
        expires_at=expires_at,
    )


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

async def refresh_access_token(
    *,
    refresh_token: str,
    client_id: str,
    client_secret: str,
    token_endpoint: str,
) -> OAuthTokens:
    """Refresh an expired access token using a refresh token."""
    import httpx

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
    }
    if client_secret:
        payload["client_secret"] = client_secret

    async with httpx.AsyncClient() as client:
        resp = await client.post(token_endpoint, data=payload, timeout=30)

    if resp.status_code != 200:
        raise TokenExchangeError(
            detail=f"Token refresh failed: {resp.status_code} {resp.text}"
        )

    data = resp.json()
    expires_at = None
    if data.get("expires_in"):
        expires_at = datetime.utcnow() + timedelta(seconds=data["expires_in"])

    return OAuthTokens(
        access_token=data["access_token"],
        token_type=data.get("token_type", "bearer"),
        expires_in=data.get("expires_in"),
        refresh_token=data.get("refresh_token", refresh_token),
        scope=data.get("scope"),
        expires_at=expires_at,
    )


# ---------------------------------------------------------------------------
# Provider configuration (seed data)
# ---------------------------------------------------------------------------

class IntegrationProviderConfig(BaseModel):
    """Configuration for a single OAuth provider."""
    name: str
    slug: str
    oauth_authorize_url: str
    oauth_token_url: str
    scopes: list[str]
    icon: str | None = None
    client_kwargs: dict[str, Any] = Field(default_factory=dict)


# Pre-seeded providers — extend via DB integration_providers table later
PROVIDERS: dict[str, IntegrationProviderConfig] = {
    "google": IntegrationProviderConfig(
        name="Google",
        slug="google",
        oauth_authorize_url="https://accounts.google.com/o/oauth2/auth",
        oauth_token_url="https://oauth2.googleapis.com/token",
        scopes=[
            "profile",
            "email",
            "openid",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
        ],
        icon="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_2020.svg",
    ),
    "github": IntegrationProviderConfig(
        name="GitHub",
        slug="github",
        oauth_authorize_url="https://github.com/login/oauth/authorize",
        oauth_token_url="https://github.com/login/oauth/access_token",
        scopes=[
            "read:user",
            "repo",
            "read:repo",
            "workflow",
        ],
        icon="https://github.githubassets.com/favicons/favicon.svg",
    ),
    "slack": IntegrationProviderConfig(
        name="Slack",
        slug="slack",
        oauth_authorize_url="https://slack.com/oauth/v2/authorize",
        oauth_token_url="https://slack.com/api/oauth.v2.access",
        scopes=[
            "channels:read",
            "chat:write",
            "files:read",
            "im:read",
        ],
        icon="https://platform.slack-edge.com/img/default_application_icon.png",
    ),
}


def get_provider_config(slug: str) -> IntegrationProviderConfig:
    """Look up a provider configuration by slug."""
    if slug not in PROVIDERS:
        msg = f"Unknown provider slug: {slug}"
        raise ValueError(msg)
    return PROVIDERS[slug]


# ---------------------------------------------------------------------------
# Token storage CRUD (sync over DB session — caller provides session)
# ---------------------------------------------------------------------------

def store_user_connection(
    *,
    db_session,
    user_id: int,
    provider_slug: str,
    access_token: str,
    refresh_token: str | None,
    scopes: list[str] | None,
) -> None:
    """Encrypt and store a user's OAuth connection row."""
    from backend.db.models import UserConnection, IntegrationProvider

    # Ensure provider exists
    provider = db_session.query(IntegrationProvider).filter_by(id=provider_slug).first()
    if not provider:
        provider = IntegrationProvider(id=provider_slug, name=provider_slug.title())
        db_session.add(provider)
        db_session.flush()

    enc_access = encrypt_token(access_token)
    enc_refresh = encrypt_token(refresh_token) if refresh_token else None
    scopes_json = ",".join(scopes) if scopes else None

    conn = UserConnection(
        user_id=user_id,
        provider_id=provider_slug,
        access_token_enc=enc_access,
        refresh_token_enc=enc_refresh,
        scopes=scopes_json,
        expires_at=None,  # will be set if token response includes expires_in
        status="active",
    )
    db_session.add(conn)


def get_user_connection(
    *,
    db_session,
    user_id: int,
    provider_slug: str,
) -> Optional[UserConnection]:
    """Retrieve a user's encrypted OAuth connection row."""
    from backend.db.models import UserConnection

    return (
        db_session.query(UserConnection)
        .filter_by(user_id=user_id, provider_id=provider_slug)
        .first()
    )


def retrieve_decrypted_tokens(
    *,
    db_connection,
    user_id: int,
    provider_slug: str,
) -> Optional[OAuthTokens]:
    """Fetch and decrypt tokens, returning an OAuthTokens model (or None)."""
    conn = get_user_connection(db_session=db_connection, user_id=user_id, provider_slug=provider_slug)
    if not conn:
        return None

    try:
        access = decrypt_token(conn.access_token_enc)
    except Exception:
        return None

    refresh = None
    if conn.refresh_token_enc:
        try:
            refresh = decrypt_token(conn.refresh_token_enc)
        except Exception:
            pass

    return OAuthTokens(
        access_token=access,
        refresh_token=refresh,
        scopes=conn.scopes.split(",") if conn.scopes else None,
        expires_at=conn.expires_at,  # stored as datetime if set
    )


def update_connection_status(
    *,
    db_session,
    connection_id: int,
    status: str,
) -> None:
    """Update a connection status (e.g., 'revoked', 'expired')."""
    from backend.db.models import UserConnection

    conn = db_session.get(UserConnection, connection_id)
    if conn:
        conn.status = status
        conn.updated_at = datetime.utcnow()