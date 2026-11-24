"""In-memory admission control for POST /api/v1/route.

State lives in one process only: it is not a shared ORS quota and does not
protect multiple workers or replicas. A restart resets it.
"""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Callable, Deque, Optional

MAX_ATTEMPTS = 10
WINDOW_SECONDS = 60.0
BUSY_RETRY_AFTER_SECONDS = 1


@dataclass(frozen=True)
class Rejection:
    code: str
    message: str
    retry_after: int


class RouteGuard:
    def __init__(
        self,
        *,
        max_attempts: int = MAX_ATTEMPTS,
        window_seconds: float = WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_attempts = max_attempts
        self._window_seconds = window_seconds
        self._clock = clock
        self._slot = threading.Lock()
        self._state_lock = threading.Lock()
        self._attempts: Deque[float] = deque()

    def try_acquire(self) -> Optional[Rejection]:
        """Return None when admitted (caller must release()), else a Rejection."""
        if not self._slot.acquire(blocking=False):
            return Rejection(
                "route_busy",
                "A route request is already in progress",
                BUSY_RETRY_AFTER_SECONDS,
            )

        admitted = False
        try:
            with self._state_lock:
                now = self._clock()
                while self._attempts and now - self._attempts[0] >= self._window_seconds:
                    self._attempts.popleft()
                if len(self._attempts) >= self._max_attempts:
                    wait = self._attempts[0] + self._window_seconds - now
                    return Rejection(
                        "route_rate_limited",
                        "Route request limit reached",
                        max(1, math.ceil(wait)),
                    )
                self._attempts.append(now)
                admitted = True
                return None
        finally:
            if not admitted:
                self._slot.release()

    def release(self) -> None:
        self._slot.release()
