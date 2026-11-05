import logging
from typing import Any

from django.http import Http404
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class UnprocessableEntityError(APIException):
    """Raised when request is semantically invalid (e.g., no route found, geocode miss)."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = 'unprocessable_entity'
    default_detail = _('Unable to process route request.')


class UpstreamServiceError(APIException):
    """Raised when an upstream provider (Mapbox, Open-Meteo) fails or returns invalid data."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = 'upstream_error'
    default_detail = _('Upstream service error.')


class UpstreamTimeoutError(APIException):
    """Raised when an upstream provider call times out."""

    status_code = status.HTTP_504_GATEWAY_TIMEOUT
    default_code = 'upstream_timeout'
    default_detail = _('Upstream service timed out.')


class UpstreamRateLimitError(APIException):
    """Raised when an upstream provider rate limits requests."""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_code = 'upstream_rate_limit'
    default_detail = _('Upstream rate limit exceeded.')


def _format_error_detail(detail: Any) -> str:
    """Format DRF error detail structures into a clean human-readable message."""
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        return ', '.join(_format_error_detail(item) for item in detail)
    if isinstance(detail, dict):
        parts = []
        for key, value in detail.items():
            formatted_value = _format_error_detail(value)
            if key in ('non_field_errors', 'detail'):
                parts.append(formatted_value)
            else:
                parts.append(f'{key}: {formatted_value}')
        return '; '.join(parts)
    return str(detail)


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    """Standardize error responses to the AGENTS.md §5 contract:

    { "error": { "code": "...", "message": "..." } }
    """
    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(exc, ValidationError):
            code = 'validation_error'
            message = _format_error_detail(exc.detail)
        elif isinstance(exc, Http404):
            code = 'not_found'
            message = 'Resource not found.'
        else:
            code = getattr(exc, 'default_code', 'error')
            if hasattr(exc, 'detail'):
                message = _format_error_detail(exc.detail)
            else:
                message = str(exc)

        response.data = {
            'error': {
                'code': code,
                'message': message,
            }
        }
        return response

    logger.exception(
        'Unhandled exception occurred while processing request', exc_info=exc
    )
    return Response(
        {
            'error': {
                'code': 'internal_server_error',
                'message': 'An unexpected server error occurred.',
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
