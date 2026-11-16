# api/app/ai.py
"""The one place that talks to the AI model (Groq).

Set GROQ_API_KEY in api/.env to get real answers. Without a key the mentor
runs in demo mode: it answers with a fixed message so everything else can be
built and tested first.

To switch models, set GROQ_MODEL in api/.env. Nothing else needs to change.
"""

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Dict, List, Optional

from fastapi import HTTPException, status

logger = logging.getLogger("uvicorn.error")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b"
REQUEST_TIMEOUT_SECONDS = 45


class AIError(Exception):
    """The AI model could not produce a reply."""


def ai_is_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY", "").strip())


def _demo_reply(message: str) -> str:
    preview = message if len(message) <= 120 else message[:117] + "..."
    return (
        "Selgo is in demo mode because no AI key is set yet. "
        "Add GROQ_API_KEY to api/.env to get real answers. "
        f'You said: "{preview}"'
    )


def main_model() -> str:
    """The model that powers the mentor and the agents."""
    return os.getenv("GROQ_MODEL", "").strip() or DEFAULT_MODEL


def generate_reply(
    system_prompt: str,
    history: List[Dict[str, str]],
    message: str,
    model: Optional[str] = None,
) -> str:
    """Sends the conversation to the model and returns its reply as plain text.

    history is a list of {"role": "user" | "assistant", "content": "..."} in
    the order the messages were sent, not including the new message.
    model defaults to the main model; the tracker passes its reviewer model.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return _demo_reply(message)

    model = model or main_model()

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for turn in history:
        role = "assistant" if turn["role"] == "assistant" else "user"
        messages.append({"role": role, "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    body = json.dumps({"model": model, "messages": messages}).encode("utf-8")
    request = urllib.request.Request(
        GROQ_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # Groq rejects Python's default User-Agent with a 403, so we name ourselves.
            "User-Agent": "selgo-api/0.1",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:300]
        raise AIError(f"Groq returned HTTP {error.code}: {detail}") from error
    except (OSError, ValueError) as error:
        raise AIError(f"Could not reach Groq: {error}") from error

    try:
        text = (data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, TypeError, AttributeError) as error:
        raise AIError("Groq sent a response in an unexpected shape.") from error

    if not text:
        raise AIError("Groq returned an empty reply.")
    return text


def reply_or_502(system_prompt: str, history: List[Dict[str, str]], message: str) -> str:
    """generate_reply for use inside routes: if the AI fails, the reason is
    written to the server log and the user gets a clean "try again" error."""
    try:
        return generate_reply(system_prompt, history, message)
    except AIError as error:
        logger.warning("AI call failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI is not available right now. Please try again in a moment.",
        )
