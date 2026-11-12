import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List
import httpx
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)


SYSTEM_PROMPT = """You are Selgo, a world-class AI Business Mentor and Systems Architect.

Your role is to have a deep, natural, multi-turn mentorship conversation with the user.
- AUTOMATIC MULTILINGUAL INTELLIGENCE: Automatically detect the language of the user's message (English, Amharic, Afaan Oromo, Arabic, French, Spanish, or any other language on Earth) and ALWAYS reply fluently in that exact same language. If the user switches languages mid-conversation, switch with them seamlessly.
- DO NOT rush the user or cut them off. Let them explain their full business situation across multiple messages.
- Ask thoughtful, concrete diagnostic questions to truly understand:
  1. Who they are and what their business or role does.
  2. Their current daily workflow, team size, or how they handle operations.
  3. The exact root cause of their struggle or growth bottleneck.
- Give genuine, strategic advice in every reply.
- You will also be given the list of REAL, developer-deployed AI agents currently live on the Selgo Marketplace.
- Only set "can_show_marketplace_button" to true AFTER you have had a thorough exchange (at least 2-3 detailed turns or when the user explicitly asks to see matching agents) AND you fully understand their problem.

Return ONLY valid JSON matching this exact structure:
{
  "owner_name": "Extracted first name or null",
  "industry": "Detected business sector or null",
  "pain_point": "Detailed summary of their business struggle or null",
  "can_show_marketplace_button": false,
  "recommended_agent_ids": [1, 2],
  "reply": "Your natural, insightful mentor response in the exact same language the user used."
}
"""


class SelgoMentorBrain:
    GROQ_CANDIDATE_MODELS = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "qwen/qwen3-32b",
    ]

    @staticmethod
    def _clean_api_key(raw_key: str | None) -> str:
        if not raw_key:
            return ""
        cleaned = raw_key.strip().strip('"').strip("'").strip()
        if cleaned.lower().startswith("bearer "):
            cleaned = cleaned[7:].strip()
        return cleaned

    @staticmethod
    def _extract_json_object(raw_text: str) -> Dict[str, Any]:
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = cleaned[start_idx : end_idx + 1]
        return json.loads(cleaned)

    @classmethod
    async def _discover_active_groq_models(
        cls, client: httpx.AsyncClient, api_key: str
    ) -> List[str]:
        try:
            resp = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                available_ids = {str(item.get("id")) for item in data if item.get("id")}
                ordered = [m for m in cls.GROQ_CANDIDATE_MODELS if m in available_ids]
                for m_id in available_ids:
                    if (
                        m_id not in ordered
                        and "whisper" not in m_id.lower()
                        and "guard" not in m_id.lower()
                        and "orpheus" not in m_id.lower()
                    ):
                        ordered.append(m_id)
                if ordered:
                    return ordered
        except Exception:
            pass
        return cls.GROQ_CANDIDATE_MODELS

    @classmethod
    async def analyze_conversation(
        cls,
        user_message: str,
        memory: Dict[str, Any],
        history: List[Dict[str, str]],
        available_developer_agents: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        load_dotenv(dotenv_path=ENV_PATH, override=True)
        groq_key = cls._clean_api_key(os.getenv("GROQ_API_KEY"))
        openai_key = cls._clean_api_key(os.getenv("OPENAI_API_KEY"))

        if not groq_key and openai_key.startswith("gsk_"):
            groq_key = openai_key

        if not groq_key and not openai_key:
            return {
                "memory": memory,
                "can_show_marketplace_button": False,
                "recommended_agent_ids": [],
                "ai_reply": "Please add your GROQ_API_KEY inside .env and save.",
            }

        combined_system_prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"CURRENT USER PROFILE MEMORY:\n{json.dumps(memory, ensure_ascii=False)}\n\n"
            f"REAL DEVELOPER AGENTS CURRENTLY IN SELGO MARKETPLACE:\n{json.dumps(available_developer_agents, ensure_ascii=False)}"
        )

        messages: List[Dict[str, str]] = [{"role": "system", "content": combined_system_prompt}]
        for turn in history[-12:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": str(turn["content"])})
        messages.append({"role": "user", "content": user_message})

        async with httpx.AsyncClient(timeout=25.0) as client:
            if groq_key:
                endpoint = "https://api.groq.com/openai/v1/chat/completions"
                api_key = groq_key
                candidate_models = await cls._discover_active_groq_models(client, groq_key)
            else:
                endpoint = "https://api.openai.com/v1/chat/completions"
                api_key = openai_key
                candidate_models = ["gpt-4o-mini", "gpt-4o"]

            for model_name in candidate_models:
                try:
                    response = await client.post(
                        endpoint,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model_name,
                            "messages": messages,
                            "temperature": 0.35,
                        },
                    )
                    if response.status_code != 200:
                        continue

                    raw_content = response.json()["choices"][0]["message"]["content"]
                    parsed = cls._extract_json_object(raw_content)

                    for key in ("owner_name", "industry", "pain_point"):
                        val = parsed.get(key)
                        if val and str(val).lower() not in ("null", "none", ""):
                            memory[key] = str(val).strip()

                    return {
                        "memory": memory,
                        "can_show_marketplace_button": bool(parsed.get("can_show_marketplace_button", False)),
                        "recommended_agent_ids": parsed.get("recommended_agent_ids") or [],
                        "ai_reply": str(parsed.get("reply", "Tell me more about your business.")),
                    }
                except Exception:
                    continue

            return {
                "memory": memory,
                "can_show_marketplace_button": False,
                "recommended_agent_ids": [],
                "ai_reply": "Could not reach LLM model. Please try sending your message again.",
            }