import re
from typing import TypedDict


class RoutingClassification(TypedDict):
    process_mode: str
    reason: str
    client_type: str
    action_indicators: list[str]
    prompt_length: int


_GREETINGS = {
    "hi",
    "hello",
    "hey",
    "hola",
    "greetings",
    "good morning",
    "good afternoon",
    "good evening",
    "yo",
}
_ACKNOWLEDGMENTS = {
    "thanks",
    "thank you",
    "ok",
    "okay",
    "yes",
    "no",
    "cool",
    "perfect",
    "bye",
    "goodbye",
    "awesome",
}
_ACTION_WORDS = {
    "add",
    "build",
    "code",
    "create",
    "delete",
    "fix",
    "generate",
    "implement",
    "make",
    "modify",
    "remove",
    "run",
    "update",
    "write",
}
_FILE_EXTENSIONS = {
    ".bat",
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".py",
    ".sh",
    ".ts",
    ".yaml",
    ".yml",
}


def _starts_with_phrase(value: str, phrases: set[str]) -> bool:
    return value in phrases or any(value.startswith(f"{phrase} ") for phrase in phrases)


def classify_prompt(raw_prompt: str, client_type: str = "web") -> RoutingClassification:
    prompt = str(raw_prompt or "").strip()
    normalized_prompt = prompt.lower()
    normalized_client = str(client_type or "web").strip().lower()
    indicators: list[str] = []

    action_words = sorted(
        word for word in _ACTION_WORDS if re.search(rf"\b{re.escape(word)}\b", normalized_prompt)
    )
    if action_words:
        indicators.extend(f"action:{word}" for word in action_words)

    has_extension = any(
        re.search(rf"\{re.escape(extension)}(?:\b|$)", normalized_prompt)
        for extension in _FILE_EXTENSIONS
    )
    if has_extension:
        indicators.append("file_extension")

    has_path = bool(
        re.search(r"(?:^|[\s'\"`])(?:\.\.?[\\/]|[a-z]:[\\/]|/)[^\s'\"`]+", normalized_prompt)
    )
    if has_path:
        indicators.append("path")

    if _starts_with_phrase(normalized_prompt, _GREETINGS):
        return {
            "process_mode": "short",
            "reason": "greeting",
            "client_type": normalized_client,
            "action_indicators": indicators,
            "prompt_length": len(prompt),
        }

    if _starts_with_phrase(normalized_prompt, _ACKNOWLEDGMENTS):
        return {
            "process_mode": "short",
            "reason": "acknowledgment",
            "client_type": normalized_client,
            "action_indicators": indicators,
            "prompt_length": len(prompt),
        }

    if normalized_client in {"vscode", "aidock"} and len(prompt) < 45:
        if indicators:
            reason = "explicit_action" if any(item.startswith("action:") for item in indicators) else "file_or_path_indicator"
            process_mode = "long"
        else:
            reason = "short_client_question"
            process_mode = "short"
    else:
        reason = "default_long_process"
        process_mode = "long"

    return {
        "process_mode": process_mode,
        "reason": reason,
        "client_type": normalized_client,
        "action_indicators": indicators,
        "prompt_length": len(prompt),
    }