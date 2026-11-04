import logging
import time
from typing import Any

import httpx
from django.conf import settings

from apps.api.exceptions import (
    UpstreamRateLimitError,
    UpstreamServiceError,
    UpstreamTimeoutError,
)

logger = logging.getLogger(__name__)

DEFAULT_MAX_RETRIES = 2
DEFAULT_BACKOFF_FACTOR = 0.5


def request_with_retry(
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: float | None = None,
    max_retries: int = DEFAULT_MAX_RETRIES,
    backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
) -> httpx.Response:
    """Execute an HTTP request with bounded retry for transient failures (429, 5xx, timeouts).

    Fails immediately without retrying on client/auth errors (401, 403, 4xx).    
    """
    request_timeout = (
        timeout
        if timeout is not None
        else getattr(settings, 'HTTP_TIMEOUT_SECONDS', 15.0)
    )

    last_exception: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            with httpx.Client(timeout=request_timeout) as client:
                response = client.request(
                    method=method,
                    url=url,
                    params=params,
                    headers=headers,
                )

            # Check status codes
            if response.status_code in (401, 403):
                logger.error('Upstream auth failed with HTTP %d', response.status_code)
                raise UpstreamServiceError('Upstream service authentication failed.')

            if response.status_code == 429:
                if attempt < max_retries:
                    time.sleep(backoff_factor * (2**attempt))
                    continue
                raise UpstreamRateLimitError('Upstream rate limit exceeded.')

            if response.status_code >= 500:
                if attempt < max_retries:
                    time.sleep(backoff_factor * (2**attempt))
                    continue
                raise UpstreamServiceError(
                    f'Upstream service returned error {response.status_code}.'
                )

            return response

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            last_exception = exc
            if attempt < max_retries:
                time.sleep(backoff_factor * (2**attempt))
                continue

    if isinstance(last_exception, httpx.TimeoutException):
        raise UpstreamTimeoutError('Upstream service timed out.')

    raise UpstreamServiceError('Upstream network connection failed.')
