import os
import sys
import argparse
import asyncio
import time
import json
from datetime import datetime

# Adjust Python path to resolve backend modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

try:
    from dotenv import load_dotenv
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv(env_path)
except ImportError:
    pass

from langchain_core.messages import HumanMessage
from backend.agent.nodes import reason_node
import backend.agent.nodes as agent_nodes

def setup_mocks(primary_provider, simulate_error):
    """
    Monkey-patches get_dynamic_llm to throw a simulated 429 Rate Limit error
    for the primary provider, forcing the self-healing loop to trigger.
    """
    original_get_dynamic_llm = agent_nodes.get_dynamic_llm
    
    async def mock_get_dynamic_llm(config, bind_tools=True):
        provider = config.get("configurable", {}).get("provider")
        if provider == primary_provider and simulate_error:
            class MockLLM:
                async def ainvoke(self, messages, **kwargs):
                    raise Exception("HTTP 429: Rate limit exceeded or quota exhausted (Simulated)")
            return MockLLM()
        return await original_get_dynamic_llm(config, bind_tools)
        
    agent_nodes.get_dynamic_llm = mock_get_dynamic_llm

def log_test_run(metrics):
    """
    Appends a single line JSON log of the test run to logs/token_switching_test.log.
    Highly compute-resource efficient.
    """
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "token_switching_test.log")
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(metrics) + "\n")

async def run_test(args):
    primary_provider = args.primary.lower()
    primary_model = args.model
    simulate_error = args.simulate_error
    prompt = args.prompt
    
    # Resolve API keys from env variables
    api_keys = {}
    for prov in ["groq", "gemini", "openrouter"]:
        key_name = f"{prov.upper()}_API_KEY"
        val = os.getenv(key_name)
        if val:
            api_keys[prov] = val
            
    print("=" * 60)
    print(" TOKEN USAGE & PROVIDER SWITCHING TEST CLI ")
    print("=" * 60)
    print(f"Primary Provider : {primary_provider}")
    print(f"Primary Model    : {primary_model}")
    print(f"Simulate 429 Err : {simulate_error}")
    print(f"Prompt           : '{prompt}'")
    print(f"Available Keys   : {list(api_keys.keys())}")
    print("-" * 60)
    
    if simulate_error:
        setup_mocks(primary_provider, simulate_error)
        
    state = {
        "messages": [HumanMessage(content=prompt)],
        "telemetry": {}
    }
    
    config = {
        "configurable": {
            "provider": primary_provider,
            "model": primary_model,
            "api_keys": api_keys,
            "api_key": api_keys.get(primary_provider),
            "conversation_id": "test_session",
            "agent_mode": True
        }
    }
    
    start_time = time.perf_counter()
    status = "SUCCESS"
    error_detail = None
    response_content = ""
    
    try:
        result = await reason_node(state, config)
        latency = time.perf_counter() - start_time
        
        telemetry = result.get("telemetry", {})
        attempts = telemetry.get("provider_attempts", [])
        tokens = telemetry.get("tokens", {})
        
        if result.get("messages"):
            msg = result["messages"][-1]
            response_content = getattr(msg, "content", "")
            if response_content.startswith("❌"):
                status = "FAILED"
                error_detail = response_content
                
    except Exception as e:
        status = "FAILED"
        latency = time.perf_counter() - start_time
        error_detail = str(e)
        attempts = [f"{primary_provider} (failed: {error_detail})"]
        tokens = {"input": 0, "output": 0}
        
    # Build metrics entry
    metrics = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": status,
        "latency_sec": round(latency, 4),
        "primary_provider": primary_provider,
        "primary_model": primary_model,
        "simulate_error": simulate_error,
        "attempts": attempts,
        "input_tokens": tokens.get("input", 0),
        "output_tokens": tokens.get("output", 0),
        "error_detail": error_detail
    }
    
    # Log to flat file
    log_test_run(metrics)
    
    # Display results
    print(f"Run Status       : {status}")
    print(f"Elapsed Time     : {metrics['latency_sec']:.2f}s")
    print(f"Fallback Route   : {' -> '.join(attempts)}")
    print(f"Input Tokens     : {metrics['input_tokens']}")
    print(f"Output Tokens    : {metrics['output_tokens']}")
    print("-" * 60)
    
    if status == "SUCCESS":
        print("Response Preview:")
        print(response_content[:300] + ("..." if len(response_content) > 300 else ""))
    else:
        print(f"Error Encountered:\n{error_detail}")
    print("=" * 60)
    print(f"Metrics written to logs/token_switching_test.log")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test token usage and model provider switching.")
    parser.add_argument("--primary", "-p", default="groq", help="Primary model provider to target (e.g. groq, gemini)")
    parser.add_argument("--model", "-m", default="llama3-8b-8192", help="Model name (e.g. llama3-8b-8192)")
    parser.add_argument("--simulate-error", "-s", action="store_true", help="Simulate a rate limit error on the primary provider")
    parser.add_argument("--prompt", "-d", default="Explain recursion in 1 sentence.", help="Human prompt text")
    
    args = parser.parse_args()
    asyncio.run(run_test(args))
