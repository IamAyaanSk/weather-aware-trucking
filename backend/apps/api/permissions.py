"""Custom DRF permissions for site demo access."""

from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.api.auth import verify_token


class HasSiteAccess(BasePermission):
    """Enforce valid X-Site-Access-Token header for demo routing endpoints."""

    message = 'Access denied. Please enter the valid showcase passphrase.'

    def has_permission(self, request: Request, _view: APIView | Any) -> bool:
        token = request.headers.get('x-site-access-token')
        return verify_token(token)
