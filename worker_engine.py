import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List
import httpx
from dotenv import load_dotenv
from security import MallSecurityGuard

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)


SAFE_PYTHON_BUILTINS: Dict[str, Any] = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "float": float,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "max": max,
    "min": min,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
}


class SelgoAgentContext(dict):
    """
    Passed as `ctx` into `AgentWorker.run(self, ctx, payload)`.
    Provides `ctx.ask_llm()`, `ctx.get_memory()`, `ctx.set_memory()`,
    and `ctx.knowledge_base` containing the subscribing company's uploaded data.
    """

    def __init__(
        self,
        business_name: str,
        business_goal: str,
        knowledge_base: str,
        agent_name: str,
        system_prompt: str,
        memory_state: Dict[str, Any],
    ) -> None:
        super().__init__(
            platform="Selgo Cloud",
            business_name=business_name,
            business_goal=business_goal,
            knowledge_base=knowledge_base,
            agent_name=agent_name,
        )
        self.business_name = business_name
        self.business_goal = business_goal
        self.knowledge_base = knowledge_base
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.memory: Dict[str, Any] = dict(memory_state)

    def get_memory(self, key: str, default: Any = None) -> Any:
        return self.memory.get(key, default)

    def set_memory(self, key: str, value: Any) -> None:
        self.memory[str(key)] = value

    def ask_llm(self, user_prompt: str, custom_system: str | None = None) -> str:
        sys_msg = custom_system or self.system_prompt
        if self.knowledge_base:
            sys_msg = f"{sys_msg}\n\nCOMPANY KNOWLEDGE BASE:\n{self.knowledge_base}"
        return SelgoWorkerEngine.call_managed_llm_sync(sys_msg, user_prompt)


class SelgoWorkerEngine:
    GROQ_MODELS = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "qwen/qwen3-32b",
    ]

    @staticmethod
    def _get_api_credentials() -> tuple[str, str]:
        load_dotenv(dotenv_path=ENV_PATH, override=True)
        groq_key = (os.getenv("GROQ_API_KEY") or "").strip().strip('"').strip("'")
        openai_key = (os.getenv("OPENAI_API_KEY") or "").strip().strip('"').strip("'")
        if not groq_key and openai_key.startswith("gsk_"):
            groq_key = openai_key
        if groq_key:
            return "https://api.groq.com/openai/v1", groq_key
        if openai_key:
            return "https://api.openai.com/v1", openai_key
        return "", ""

    @classmethod
    def call_managed_llm_sync(
        cls,
        system_prompt: str,
        user_prompt: str,
        history: List[Dict[str, str]] | None = None,
    ) -> str:
        base_url, api_key = cls._get_api_credentials()
        if not api_key:
            return f"Processed request for your business: {user_prompt}"

        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if history:
            for turn in history[-8:]:
                if turn.get("role") in ("user", "assistant") and turn.get("content"):
                    messages.append({"role": turn["role"], "content": str(turn["content"])})
        messages.append({"role": "user", "content": user_prompt})

        try:
            with httpx.Client(timeout=20.0) as client:
                models_to_try = cls.GROQ_MODELS if "groq" in base_url else ["gpt-4o-mini", "gpt-4o"]
                if "groq" in base_url:
                    m_resp = client.get(
                        f"{base_url}/models",
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    if m_resp.status_code == 200:
                        avail = {str(x.get("id")) for x in m_resp.json().get("data", []) if x.get("id")}
                        prioritized = [m for m in cls.GROQ_MODELS if m in avail]
                        for m_id in avail:
                            if (
                                m_id not in prioritized
                                and "whisper" not in m_id.lower()
                                and "guard" not in m_id.lower()
                                and "orpheus" not in m_id.lower()
                            ):
                                prioritized.append(m_id)
                        if prioritized:
                            models_to_try = prioritized

                for model_name in models_to_try:
                    resp = client.post(
                        f"{base_url}/chat/completions",
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
                    if resp.status_code == 200:
                        return str(resp.json()["choices"][0]["message"]["content"]).strip()
        except Exception:
            pass

        return f"Task executed for '{user_prompt}'."

    @classmethod
    def run_agent_conversation_or_task(
        cls,
        *,
        python_code: str,
        expected_sha256: str,
        agent_name: str,
        agent_industry: str,
        agent_description: str,
        agent_system_prompt: str,
        business_name: str,
        business_goal: str,
        knowledge_base: str = "",
        user_message: str,
        chat_history: List[Dict[str, str]],
        agent_memory: Dict[str, Any],
        voice_mode: bool = False,
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()

        code_check = MallSecurityGuard.check_developer_code(python_code)
        if not code_check.is_safe:
            return {
                "status": "SECURITY_CUTOFF",
                "reason": "Code failed Selgo AST Security check: " + "; ".join(code_check.reasons),
                "duration_ms": 0,
                "agent_reply": "",
                "structured_output": {},
                "updated_memory": agent_memory,
            }

        if code_check.sha256_fingerprint != expected_sha256:
            return {
                "status": "SECURITY_CUTOFF",
                "reason": "Code tampering detected! Fingerprint mismatch.",
                "duration_ms": 0,
                "agent_reply": "",
                "structured_output": {},
                "updated_memory": agent_memory,
            }

        ctx = SelgoAgentContext(
            business_name=business_name,
            business_goal=business_goal,
            knowledge_base=knowledge_base,
            agent_name=agent_name,
            system_prompt=agent_system_prompt,
            memory_state=agent_memory,
        )

        payload = {
            "message": user_message,
            "item": user_message,
            "used": int(ctx.get_memory("tasks_run_count", 0)) + 1,
            "business_name": business_name,
            "business_goal": business_goal,
            "knowledge_base": knowledge_base,
        }

        try:
            locked_room: Dict[str, Any] = {"__builtins__": SAFE_PYTHON_BUILTINS}
            exec(compile(python_code, "<selgo_worker>", "exec"), locked_room)

            worker_class = locked_room.get("AgentWorker")
            if worker_class is None:
                return {
                    "status": "ERROR",
                    "reason": "AgentWorker class missing.",
                    "duration_ms": 0,
                    "agent_reply": "",
                    "structured_output": {},
                    "updated_memory": agent_memory,
                }

            worker = worker_class()
            raw_output = worker.run(ctx, payload)

            if not isinstance(raw_output, dict):
                raw_output = {"result": str(raw_output)}

            ctx.set_memory("tasks_run_count", int(ctx.get_memory("tasks_run_count", 0)) + 1)

        except Exception as err:
            return {
                "status": "ERROR",
                "reason": f"Agent runtime error: {str(err)}",
                "duration_ms": 0,
                "agent_reply": "",
                "structured_output": {},
                "updated_memory": agent_memory,
            }

        leak_check = MallSecurityGuard.check_message_for_leaks(raw_output)
        if not leak_check.is_safe:
            return {
                "status": "SECURITY_CUTOFF",
                "reason": "Spam/Leak detected in agent output: " + "; ".join(leak_check.reasons),
                "duration_ms": 0,
                "agent_reply": "",
                "structured_output": {},
                "updated_memory": agent_memory,
            }

        explicit_reply = raw_output.get("reply") or raw_output.get("response")
        style_rule = (
            "Speak naturally in 2-3 concise, warm, conversational sentences suitable for a live voice call. Do not use markdown bullet symbols."
            if voice_mode
            else "Respond clearly, warm and natural like an expert specialist working inside their team."
        )

        kb_section = (
            f"\nUPLOADED COMPANY KNOWLEDGE BASE & DATA:\n{knowledge_base}\n"
            if knowledge_base.strip()
            else "\n(No custom knowledge base uploaded yet.)\n"
        )

        persona_prompt = (
            f"You are '{agent_name}', a specialized AI Agent in the '{agent_industry}' sector ({agent_description}).\n"
            f"Developer instructions: {agent_system_prompt}\n"
            f"You are deployed for '{business_name}' whose primary goal is: '{business_goal}'.\n"
            f"{kb_section}"
            f"Your Python execution engine computed this live data for their message: {json.dumps(raw_output, ensure_ascii=False)}\n"
            f"Workspace memory: {json.dumps(ctx.memory, ensure_ascii=False)}\n"
            f"STYLE RULE: {style_rule}\n"
            "Use the uploaded company knowledge base if relevant, address the user directly, and help execute their workflow."
        )

        if explicit_reply and len(str(explicit_reply)) > 40:
            conversational_reply = str(explicit_reply)
        else:
            conversational_reply = cls.call_managed_llm_sync(
                system_prompt=persona_prompt,
                user_prompt=user_message,
                history=chat_history,
            )

        reply_leak_check = MallSecurityGuard.check_message_for_leaks({"reply": conversational_reply})
        if not reply_leak_check.is_safe:
            return {
                "status": "SECURITY_CUTOFF",
                "reason": "Spam/Leak detected in agent conversation: " + "; ".join(reply_leak_check.reasons),
                "duration_ms": 0,
                "agent_reply": "",
                "structured_output": {},
                "updated_memory": agent_memory,
            }

        duration_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "status": "SUCCESS",
            "reason": None,
            "duration_ms": duration_ms,
            "agent_reply": conversational_reply,
            "structured_output": raw_output,
            "updated_memory": ctx.memory,
        }