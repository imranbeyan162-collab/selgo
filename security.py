import ast
import hashlib
import json
import re
from typing import Any, Dict, List, Set
from pydantic import BaseModel


class SecurityCheckResult(BaseModel):
    is_safe: bool
    violation_type: str | None = None
    reasons: List[str] = []
    sha256_fingerprint: str | None = None


class MallSecurityGuard(ast.NodeVisitor):
    """
    Inspects developer code and agent messages so nobody can hack our server
    or sneak customers off our app to Telegram, WhatsApp, or direct phone calls.
    """

    # Safe Python tools developers ARE allowed to use inside our cloud
    ALLOWED_IMPORTS: Set[str] = {
        "math", "json", "datetime", "re", "collections", "decimal", "statistics"
    }

    # Dangerous Python commands that could hack our server
    FORBIDDEN_COMMANDS: Set[str] = {
        "eval", "exec", "compile", "open", "__import__", "globals", "locals", "getattr", "setattr"
    }

    # Patterns that catch links, emails, phone numbers, and Telegram/WhatsApp handles
    URL_REGEX = re.compile(r"(?:https?://|www\.|t\.me/|wa\.me/)[^\s\"'<>]+", re.IGNORECASE)
    EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b")
    PHONE_REGEX = re.compile(
        r"(?:\+251[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|\b0[79]\d{1}[\s-]?\d{3}[\s-]?\d{4}\b|\+\d{1,3}[\s-]?\d{6,12})"
    )
    TELEGRAM_BYPASS_REGEX = re.compile(
        r"(?:telegram|tg|whatsapp|call\s+me|text\s+me|dm\s+me|pay\s+me\s+directly|@[A-Za-z0-9_]{4,32})",
        re.IGNORECASE,
    )

    def __init__(self) -> None:
        self.reasons: List[str] = []
        self.has_worker_class: bool = False
        self.has_run_function: bool = False

    def visit_Import(self, node: ast.Import) -> None:
        for item in node.names:
            root_name = item.name.split(".")[0]
            if root_name not in self.ALLOWED_IMPORTS:
                self.reasons.append(f"Line {node.lineno}: Import '{item.name}' is blocked by security.")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        root_name = (node.module or "").split(".")[0]
        if root_name not in self.ALLOWED_IMPORTS:
            self.reasons.append(f"Line {node.lineno}: Import from '{node.module}' is blocked by security.")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name) and node.func.id in self.FORBIDDEN_COMMANDS:
            self.reasons.append(f"Line {node.lineno}: Command '{node.func.id}()' is forbidden.")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr.startswith("__"):
            self.reasons.append(f"Line {node.lineno}: Accessing hidden system attribute '{node.attr}' is blocked.")
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        if node.name == "AgentWorker":
            self.has_worker_class = True
            for child in node.body:
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name == "run":
                    self.has_run_function = True
        self.generic_visit(node)

    @classmethod
    def check_developer_code(cls, python_code: str) -> SecurityCheckResult:
        """Checks if a developer's Python code is 100% safe to host on our cloud."""
        fingerprint = hashlib.sha256(python_code.encode("utf-8")).hexdigest()

        try:
            tree = ast.parse(python_code)
        except SyntaxError as err:
            return SecurityCheckResult(
                is_safe=False,
                violation_type="SYNTAX_ERROR",
                reasons=[f"Line {err.lineno}: Invalid Python syntax ({err.msg})."],
                sha256_fingerprint=fingerprint,
            )

        guard = cls()
        guard.visit(tree)

        if not guard.has_worker_class or not guard.has_run_function:
            guard.reasons.append(
                "Developer code must include `class AgentWorker:` with a `def run(self, ctx, payload):` method."
            )

        return SecurityCheckResult(
            is_safe=(len(guard.reasons) == 0),
            violation_type="UNSAFE_CODE" if guard.reasons else None,
            reasons=guard.reasons,
            sha256_fingerprint=fingerprint,
        )

    @classmethod
    def check_message_for_leaks(cls, payload: Dict[str, Any]) -> SecurityCheckResult:
        """Blocks any attempt to share Telegram handles, phone numbers, emails, or external links."""
        text = json.dumps(payload, ensure_ascii=False)
        reasons: List[str] = []

        if cls.URL_REGEX.search(text):
            reasons.append("Blocked external website or link (users must stay inside our app).")
        if cls.EMAIL_REGEX.search(text):
            reasons.append("Blocked email address leak.")
        if cls.PHONE_REGEX.search(text):
            reasons.append("Blocked phone number leak.")
        if cls.TELEGRAM_BYPASS_REGEX.search(text):
            reasons.append("Blocked off-platform contact attempt (Telegram/WhatsApp/Direct payment).")

        return SecurityCheckResult(
            is_safe=(len(reasons) == 0),
            violation_type="CONTACT_LEAK_OR_SPAM" if reasons else None,
            reasons=reasons,
        )