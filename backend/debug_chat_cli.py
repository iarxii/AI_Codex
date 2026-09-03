"""Interactive CLI for debugging the AICodex backend agent WebSocket, modeled on how the
web client (client/src/pages/Workspace.tsx) drives /api/chat/ws/agent.

Usage:
    # Local dev backend
    python backend/debug_chat_cli.py --username me --password secret

    # Production 'aicodex-be' (URL auto-resolved from route_map.json)
    python backend/debug_chat_cli.py --target be --username me --password secret

    # Production 'aicodex-premium' (auto-resolved URL + handshake from env var)
    AICODEX_COLAB_SECRET=... python backend/debug_chat_cli.py --target premium --username me --password secret

    # Skip login entirely if you already have a JWT
    python backend/debug_chat_cli.py --target be --token eyJhbGciOi...

Credentials can also come from AICODEX_DEBUG_USERNAME / AICODEX_DEBUG_PASSWORD env vars (or
backend/.env.debug, auto-loaded if present) instead of --username/--password, to avoid putting
production passwords in shell history.

In-session commands (type at the "You:" prompt):
    /provider <name>      Switch provider (e.g. openai, groq, local, azure_foundry, ollama_cloud)
    /model <name>         Switch model
    /models               List available models for the current provider (queries /api/models)
    /apikey <key>         Set the API key sent with each request
    /baseurl <url>        Set the base URL header (required by ollama_cloud, azure_foundry, etc.)
    /conv <id>            Reuse an existing conversation_id instead of starting a new one
    /raw <json>           Send a raw JSON payload verbatim (bypasses the message wrapper)
    /quit                 Close the connection and exit

Every inbound WebSocket message is printed with a `[type]` prefix so you can see exactly what the
backend is streaming (token, status, tool_call, tool_result, a2ui_artifact, done, model_switch,
error) instead of only the final assembled reply — this is the same event stream the web client
consumes, so a bug reproducible here is reproducible in the UI, and vice versa.

Each turn's time-to-first-token and total round-trip time are printed after the reply. Any "error"
event (or connection failure) is appended to the failure log (--failure-log, default
backend/debug_chat_failures.log) with the provider/model/message that triggered it.
"""

from __future__ import annotations

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


def _select_production_model(models: list[dict]) -> Optional[str]:
    available = [str(model.get("id")) for model in models if model.get("id")]
    preferred = ["gpt-oss:20b", "gemma4:31b", "nemotron-3-nano:30b"]
    return next((model for model in preferred if model in available), available[0] if available else None)


def _to_ws_url(http_url: str) -> str:
    if http_url.startswith("https://"):
        return "wss://" + http_url[len("https://"):]
    if http_url.startswith("http://"):
        return "ws://" + http_url[len("http://"):]
    return http_url


def _resolve_backend_url(target: str, explicit_url: Optional[str], route_map_path: Path) -> str:
    """Resolve the backend URL for --target from route_map.json, unless --backend-url overrides it."""
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


@dataclass
class SessionState:
    """Mutable state shared between the send loop and the receiver task."""
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
    close_requested: bool = False

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
        print(f"\n[logged failure -> {self.failure_log_path}]")


def _print_event(data: dict[str, Any], session: SessionState) -> None:
    etype = data.get("type", "?")
    if etype in ("token", "token_delta"):
        if not session.seen_first_token and session.last_send_time is not None:
            ttft = time.monotonic() - session.last_send_time
            print(f"\n[ttft] {ttft:.2f}s")
            session.seen_first_token = True
        # Streamed text — print inline without a newline so replies read naturally.
        content = data.get("delta") if etype == "token_delta" else data.get("content")
        print(content or "", end="", flush=True)
    elif etype == "status":
        print(f"\n[status] node={data.get('node')} — {data.get('status')}")
    elif etype == "tool_call":
        print(f"\n[tool_call] {json.dumps(data.get('tool_calls'), indent=2)}")
    elif etype == "tool_result":
        print(f"\n[tool_result] id={data.get('tool_call_id')} -> {data.get('content')}")
    elif etype == "a2ui_artifact":
        print(f"\n[a2ui_artifact] {json.dumps(data, indent=2)[:500]}")
    elif etype == "model_switch":
        print(f"\n[model_switch] {data}")
    elif etype == "error":
        elapsed = f"{time.monotonic() - session.last_send_time:.2f}s" if session.last_send_time else "?"
        print(f"\n[ERROR] ({elapsed}) {data.get('message')}")
        session.log_failure(str(data.get("message")))
    elif etype == "done":
        rtt = f"{time.monotonic() - session.last_send_time:.2f}s" if session.last_send_time else "?"
        print(f"\n[done] final_length={data.get('final_length')} final_seq={data.get('final_seq')} client_rtt={rtt}")
        session.seen_first_token = False
    elif etype == "telemetry":
        print(f"\n[telemetry] {data}")
    else:
        print(f"\n[{etype}] {data}")


async def receiver(ws, session: SessionState) -> None:
    try:
        async for raw in ws:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                print(f"\n[raw non-JSON frame] {raw!r}")
                continue
            _print_event(data, session)
    except websockets.ConnectionClosed as e:
        print("\n[connection closed by server]")
        session.connection_closed.set()
        if not session.close_requested:
            session.log_failure(f"WebSocket connection closed unexpectedly: {e}")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--target", choices=["local", "be", "premium"], default="local", help="Which deployment to hit; 'be'/'premium' auto-resolve the URL from route_map.json")
    parser.add_argument("--backend-url", default=None, help="Explicit backend base URL (http/https), overrides --target")
    parser.add_argument("--route-map", default=str(REPO_ROOT / "route_map.json"), help="Path to route_map.json used to resolve --target be/premium")
    parser.add_argument("--username", default=os.environ.get("AICODEX_DEBUG_USERNAME"))
    parser.add_argument("--password", default=os.environ.get("AICODEX_DEBUG_PASSWORD"))
    parser.add_argument("--token", default=None, help="Skip login and use an existing JWT access token directly")
    parser.add_argument("--provider", default=None, help="Provider; defaults to local for --target local and ollama_cloud for production targets")
    parser.add_argument("--model", default=None, help="Model ID; production auto-selects a preferred available model when omitted")
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--base-url", default=None, help="X-Base-Url header, required by ollama_cloud/azure_foundry/alibaba_ecs")
    parser.add_argument("--conversation-id", type=int, default=None)
    parser.add_argument("--handshake", default=os.environ.get("AICODEX_COLAB_SECRET"), help="COLAB_SECRET, only needed against the premium instance (defaults to $AICODEX_COLAB_SECRET)")
    parser.add_argument("--client-type", default="web")
    parser.add_argument("--failure-log", default=str(Path(__file__).resolve().parent / "debug_chat_failures.log"), help="Path to append failure entries (JSON lines)")
    args = parser.parse_args()

    backend_url = _resolve_backend_url(args.target, args.backend_url, Path(args.route_map))
    args.provider = args.provider or _default_provider(args.target)
    args.api_key = args.api_key or _default_api_key(args.provider)
    args.base_url = args.base_url or _default_base_url(args.provider)
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

    if args.conversation_id is None:
        args.conversation_id = await create_conversation(backend_url, token)
        print(f"Created conversation {args.conversation_id}.")

    if args.model is None:
        if args.target == "local":
            args.model = "default"
        else:
            models = await list_models(backend_url, token, args.provider, args.base_url, args.api_key)
            if not models:
                raise SystemExit(
                    f"No models available for provider '{args.provider}'. "
                    "Pass --model explicitly or configure the provider first."
                )
            args.model = _select_production_model(models)
            if not args.model:
                raise SystemExit(
                    f"No usable model IDs returned for provider '{args.provider}'. "
                    "Pass --model explicitly or configure the provider first."
                )
            print(f"Selected production model {args.model}.")

    ws_base = _to_ws_url(backend_url)
    handshake_qs = f"&handshake={args.handshake}" if args.handshake else ""
    ws_url = f"{ws_base}/api/chat/ws/agent?token={token}{handshake_qs}"

    session = SessionState(
        provider=args.provider,
        model=args.model,
        api_key=args.api_key,
        base_url=args.base_url,
        conversation_id=args.conversation_id,
        failure_log_path=Path(args.failure_log),
    )

    async with websockets.connect(ws_url, max_size=None) as ws:
        recv_task = asyncio.create_task(receiver(ws, session))
        print("Connected. Type /quit to exit. Commands: /provider /model /models /apikey /baseurl /conv /raw\n")

        loop = asyncio.get_event_loop()
        try:
            while True:
                line = await loop.run_in_executor(None, input, "You: ")
                if not line.strip():
                    continue
                if line.startswith("/"):
                    parts = line.split(maxsplit=1)
                    cmd = parts[0].lower()
                    arg = parts[1] if len(parts) > 1 else ""
                    if cmd == "/quit":
                        session.close_requested = True
                        break
                    elif cmd == "/provider":
                        value = arg.strip()
                        if not value:
                            print("Usage: /provider <name>")
                            continue
                        session.provider = value
                        print(f"(provider set to {session.provider})")
                        continue
                    elif cmd == "/model":
                        value = arg.strip()
                        if not value:
                            print("Usage: /model <name>")
                            continue
                        session.model = value
                        print(f"(model set to {session.model})")
                        continue
                    elif cmd == "/models":
                        try:
                            models = await list_models(
                                backend_url, token, session.provider, session.base_url, session.api_key
                            )
                            print(f"\nAvailable models for '{session.provider}':")
                            for m in models:
                                print(f"  - {m.get('id')}  ({m.get('name', '')})")
                        except Exception as e:
                            print(f"\nFailed to list models: {e}")
                        continue
                    elif cmd == "/apikey":
                        value = arg.strip()
                        if not value:
                            print("Usage: /apikey <key>")
                            continue
                        session.api_key = value
                        print("(api key set)")
                        continue
                    elif cmd == "/baseurl":
                        value = arg.strip()
                        if not value:
                            print("Usage: /baseurl <url>")
                            continue
                        session.base_url = value
                        print(f"(base_url set to {session.base_url})")
                        continue
                    elif cmd == "/conv":
                        value = arg.strip()
                        try:
                            conversation_id = int(value)
                        except ValueError:
                            print("Usage: /conv <integer conversation id>")
                            continue
                        session.conversation_id = conversation_id
                        print(f"(conversation_id set to {session.conversation_id})")
                        continue
                    elif cmd == "/raw":
                        raw_payload = arg.strip()
                        if not raw_payload:
                            print("Usage: /raw <json>")
                            continue
                        try:
                            json.loads(raw_payload)
                        except json.JSONDecodeError as e:
                            print(f"Invalid JSON for /raw: {e.msg}")
                            continue
                        try:
                            await ws.send(raw_payload)
                        except websockets.ConnectionClosed as e:
                            session.connection_closed.set()
                            session.log_failure(f"Failed to send raw payload: {e}")
                            break
                        continue
                    else:
                        print(f"Unknown command: {cmd}")
                        continue

                if session.connection_closed.is_set():
                    print("WebSocket is closed; exiting.")
                    break

                session.last_user_message = line
                session.seen_first_token = False
                payload = {
                    "conversation_id": session.conversation_id,
                    "message": line,
                    "provider": session.provider,
                    "model": session.model,
                    "api_key": session.api_key,
                    "api_keys": {session.provider: session.api_key} if session.api_key else {},
                    "base_url": session.base_url,
                    "agent_mode": True,
                    "local_backend_mode": "ollama",
                    "client_type": args.client_type,
                }
                session.last_send_time = time.monotonic()
                try:
                    await ws.send(json.dumps(payload))
                except websockets.ConnectionClosed as e:
                    session.log_failure(f"Failed to send message: {e}")
                    break
                print()  # spacer before streamed tokens
        except (KeyboardInterrupt, EOFError):
            pass
        except Exception as e:
            session.log_failure(f"Unhandled CLI exception: {e}")
            raise
        finally:
            recv_task.cancel()
            await ws.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
