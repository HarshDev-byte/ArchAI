"""
JWT authentication utilities for FastAPI.

Verifies Supabase-issued JWTs using the project's JWT secret (HS256).
The secret is available at: Supabase Dashboard → Settings → API → JWT Secret.
"""
from __future__ import annotations

import os
import logging
from functools import lru_cache

import jwt
from jwt.exceptions import InvalidTokenError

logger = logging.getLogger(__name__)


class AuthError(Exception):
    """Raised when a JWT cannot be verified."""
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


@lru_cache(maxsize=1)
def _get_jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise RuntimeError(
            "SUPABASE_JWT_SECRET is not set. "
            "Find it at: Supabase Dashboard → Settings → API → JWT Secret"
        )
    return secret


def verify_supabase_jwt(token: str) -> str:
    """
    Verify a Supabase-issued JWT and return the user's UUID.

    Supabase uses HS256 with the project JWT secret. The token payload
    always contains the `sub` claim which is the auth.users UUID.

    Args:
        token: Raw JWT string (without 'Bearer ' prefix).

    Returns:
        The authenticated user's UUID string (= auth.users.id).

    Raises:
        AuthError: If the token is missing, malformed, expired, or has
                   an invalid signature.
    """
    if not token:
        raise AuthError("No token provided.")

    try:
        secret = _get_jwt_secret()
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={
                "require": ["sub", "exp", "iat"],
                "verify_exp": True,
            },
            # Supabase sets aud = "authenticated" for logged-in users
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("Token has expired. Please sign in again.")
    except jwt.InvalidAudienceError:
        raise AuthError("Token audience is invalid.")
    except jwt.InvalidSignatureError:
        raise AuthError("Token signature verification failed.")
    except InvalidTokenError as exc:
        logger.debug("JWT decode error: %s", exc)
        raise AuthError(f"Invalid token: {exc}")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise AuthError("Token missing 'sub' claim.")

    return user_id


def extract_bearer_token(authorization_header: str | None) -> str:
    """
    Extract the raw JWT from an 'Authorization: Bearer <token>' header.

    Args:
        authorization_header: Value of the HTTP Authorization header.

    Returns:
        The raw JWT string.

    Raises:
        AuthError: If the header is missing or malformed.
    """
    if not authorization_header:
        raise AuthError("Authorization header is missing.")
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Authorization header must be 'Bearer <token>'.")
    return parts[1]
