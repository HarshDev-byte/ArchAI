"""
FastAPI dependency injection helpers.

Usage in a router:
    from dependencies import CurrentUser

    @router.get("/me")
    async def get_me(user_id: str = Depends(CurrentUser)):
        ...
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from utils.auth import AuthError, extract_bearer_token, verify_supabase_jwt


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> str:
    """
    FastAPI dependency that extracts and verifies the Supabase JWT from the
    Authorization header.

    Returns:
        The authenticated user's UUID (auth.users.id).

    Raises:
        HTTP 401 if token is missing, expired, or invalid.
    """
    try:
        token = extract_bearer_token(authorization)
        user_id = verify_supabase_jwt(token)
        return user_id
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=exc.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# Convenience alias
CurrentUser = Depends(get_current_user)
