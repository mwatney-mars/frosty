import time
import asyncio
from collections import defaultdict
from typing import Dict, List
from fastapi import Request, HTTPException, status

class InMemoryRateLimiter:
    """
    Sliding-window IP-based rate limiter for FastAPI endpoints.
    Cleans up old request timestamps automatically to avoid memory leaks.
    """
    def __init__(self):
        self._records: Dict[str, List[float]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._cleanup_counter = 0

    async def check_rate_limit(self, key: str, max_requests: int, window_seconds: float) -> bool:
        now = time.time()
        cutoff = now - window_seconds

        async with self._lock:
            # Periodic cleanup every 100 checks
            self._cleanup_counter += 1
            if self._cleanup_counter >= 100:
                self._cleanup_counter = 0
                expired_keys = []
                for k, timestamps in self._records.items():
                    valid = [t for t in timestamps if t > cutoff]
                    if valid:
                        self._records[k] = valid
                    else:
                        expired_keys.append(k)
                for k in expired_keys:
                    self._records.pop(k, None)

            timestamps = [t for t in self._records[key] if t > cutoff]
            if len(timestamps) >= max_requests:
                self._records[key] = timestamps
                return False

            timestamps.append(now)
            self._records[key] = timestamps
            return True

limiter = InMemoryRateLimiter()

def rate_limit(max_requests: int, window_seconds: float):
    """
    FastAPI dependency to rate limit by client IP.
    """
    async def dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        endpoint_key = f"{client_ip}:{request.url.path}"
        
        allowed = await limiter.check_rate_limit(endpoint_key, max_requests, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Rate limit exceeded ({max_requests} requests per {window_seconds}s). Please try again later.",
                headers={"Retry-After": str(int(window_seconds))}
            )
    return dependency
