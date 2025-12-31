# kuhul_pi_cluster.py
# KUHUL π Cluster Runtime — Multi-Worker Chat Inference

import uuid
import threading
from queue import Queue
from typing import Dict, Optional

from kuhul_pi_chat_r1 import KuhulPiChatR1


class KuhulPiWorker:
    """
    Single inference worker.
    Owns its own model + DeepSeek conversation.
    """

    def __init__(self, worker_id: int):
        self.worker_id = worker_id
        self.engine = KuhulPiChatR1()
        self.lock = threading.Lock()

    def ask(self, text: str) -> str:
        with self.lock:
            return self.engine.ask(text)

    def reset(self):
        with self.lock:
            self.engine.reset()


class KuhulPiClusterRuntime:
    """
    KUHUL π Cluster Runtime

    - Manages multiple inference workers
    - Routes requests
    - Preserves per-session conversation state
    """

    def __init__(self, num_workers: int = 1):
        if num_workers < 1:
            raise ValueError("num_workers must be >= 1")

        self.num_workers = num_workers
        self.workers = [KuhulPiWorker(i) for i in range(num_workers)]

        # Session routing
        self.sessions: Dict[str, int] = {}
        self.worker_queue = Queue()

        for i in range(num_workers):
            self.worker_queue.put(i)

    # -----------------------------
    # SESSION MANAGEMENT
    # -----------------------------

    def new_session(self) -> str:
        session_id = str(uuid.uuid4())
        worker_id = self.worker_queue.get()
        self.sessions[session_id] = worker_id
        return session_id

    def close_session(self, session_id: str):
        worker_id = self.sessions.pop(session_id, None)
        if worker_id is not None:
            self.workers[worker_id].reset()
            self.worker_queue.put(worker_id)

    # -----------------------------
    # INFERENCE
    # -----------------------------

    def ask(self, text: str, session_id: Optional[str] = None) -> str:
        """
        Route inference to the correct worker.
        """

        if session_id is None:
            # Stateless call (round-robin)
            worker_id = self.worker_queue.get()
            try:
                return self.workers[worker_id].ask(text)
            finally:
                self.worker_queue.put(worker_id)

        # Stateful session
        if session_id not in self.sessions:
            raise KeyError(f"Unknown session_id: {session_id}")

        worker_id = self.sessions[session_id]
        return self.workers[worker_id].ask(text)

    # -----------------------------
    # DEBUG / STATUS
    # -----------------------------

    def status(self):
        return {
            "workers": self.num_workers,
            "active_sessions": len(self.sessions),
            "sessions": self.sessions.copy()
        }
