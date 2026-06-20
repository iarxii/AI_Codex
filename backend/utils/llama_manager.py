import os
import subprocess
import time
import requests
import logging

logger = logging.getLogger("aicodex.llama_manager")

MODEL_MAPPING = {
    "gemma-4": "Google/gemma-4-E4B_q4_0-it.gguf",
    "gemma-4-e4b_q4_0-it": "Google/gemma-4-E4B_q4_0-it.gguf",
    "google/gemma-4-e4b-it-qat-q4_0-gguf": "Google/gemma-4-E4B_q4_0-it.gguf",
    "qwen2.5-coder": "Qwen/qwen2.5-coder-7b-instruct-q4_k_m.gguf",
    "qwen2.5-coder-7b-instruct-q4_k_m": "Qwen/qwen2.5-coder-7b-instruct-q4_k_m.gguf",
    "deepseek-r1-distill": "DeepSeek/DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf",
    "deepseek-r1-distill-llama-8b-q4_k_m": "DeepSeek/DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf",
    "deepseek-r1": "DeepSeek/DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf",
}

class LlamaServerManager:
    _process = None
    _current_model_path = None

    @classmethod
    def kill_existing_servers(cls, port=8080):
        """Ensures the specified port is free by terminating any occupying process."""
        logger.info(f"[LlamaManager] Ensuring port {port} is free...")
        if os.name == 'nt':
            # Windows port cleaning
            try:
                out = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
                pids = set()
                for line in out.splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 5 and parts[1].endswith(f":{port}"):
                        pids.add(parts[-1])
                for pid in pids:
                    logger.info(f"[LlamaManager] Killing Windows process {pid} occupying port {port}...")
                    subprocess.run(f"taskkill /f /pid {pid}", shell=True)
            except Exception as e:
                logger.debug(f"[LlamaManager] Port check exception (probably no process): {e}")
        else:
            # Linux port cleaning (fuser / tcp)
            try:
                subprocess.run(f"fuser -k {port}/tcp", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                logger.info(f"[LlamaManager] Port {port} cleared via fuser.")
            except Exception as e:
                logger.debug(f"[LlamaManager] Linux fuser exception: {e}")

    @classmethod
    def find_model_file(cls, model_name: str, base_dir: str) -> str:
        """Finds the model file on disk based on the requested model name."""
        if not base_dir or not os.path.exists(base_dir):
            return None

        name_lower = model_name.lower()
        # 1. Exact match mapping
        for key, rel_path in MODEL_MAPPING.items():
            if key in name_lower or name_lower in key:
                full_path = os.path.join(base_dir, rel_path)
                if os.path.exists(full_path):
                    return full_path

        # 2. Fuzzy recursive lookup for any GGUF file matching the name prefix
        first_token = name_lower.split("-")[0].split(":")[0]
        for root, dirs, files in os.walk(base_dir):
            for file in files:
                if file.endswith(".gguf") and first_token in file.lower():
                    return os.path.join(root, file)

        return None

    @classmethod
    def ensure_model_loaded(cls, model_name: str) -> bool:
        """Dynamic hot-reloading: checks if requested model is active; swaps if different."""
        if not model_name:
            return False

        # If it's a generic request like 'local' or 'default', skip dynamic reloading
        if model_name in ["local", "default"]:
            return False

        # Read environment configurations
        binary_path = os.environ.get("LLAMACPP_BINARY_PATH")
        open_models_dir = os.environ.get("OPEN_MODELS_DIR")

        # Fallback to local default locations if not set
        if not binary_path:
            if os.name == 'nt':
                binary_path = r".\llama-cpp-turboquant\build\bin\Release\llama-server.exe"
            else:
                binary_path = "/content/llama-cpp-turboquant/build/bin/llama-server"

        if not open_models_dir:
            if os.name == 'nt':
                open_models_dir = r"g:\My Drive\open_models"
            else:
                open_models_dir = "/content/drive/MyDrive/open_models"

        # Verify binary exists. If not, we cannot manage the server lifecycle
        if not os.path.exists(binary_path):
            logger.warning(f"[LlamaManager] llama-server binary not found at '{binary_path}'. Dynamic model hot-swapping is disabled.")
            return False

        # Locate model GGUF file
        model_path = cls.find_model_file(model_name, open_models_dir)
        if not model_path:
            logger.warning(f"[LlamaManager] Model GGUF file for '{model_name}' not found under '{open_models_dir}'. Skipping swap.")
            return False

        # Check if already loaded
        if cls._current_model_path == model_path:
            # Check if server is actually responding
            try:
                resp = requests.get("http://localhost:8080/v1/models", timeout=2)
                if resp.status_code == 200:
                    logger.info(f"[LlamaManager] Model '{model_name}' is already loaded and active.")
                    return True
            except Exception:
                pass

        logger.info(f"[LlamaManager] Hot-reloading requested model flavor: '{model_name}' -> '{model_path}'")
        
        # Kill existing server processes
        cls.kill_existing_servers(8080)
        time.sleep(1)

        # Launch new server
        cmd = [
            binary_path,
            "-m", model_path,
            "--port", "8080",
            "--host", "0.0.0.0",
            "-ngl", "99"
        ]

        # Apply optimized RotorQuant KV Cache flags for Gemma or Qwen models
        if "gemma" in model_name.lower() or "qwen" in model_name.lower():
            cmd.extend(["--cache-type-k", "planar3", "--cache-type-v", "planar3"])

        logger.info(f"[LlamaManager] Spawning process: {' '.join(cmd)}")
        try:
            cls._process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                preexec_fn=None if os.name == 'nt' else os.setsid
            )

            # Wait and check health
            for i in range(15):
                try:
                    resp = requests.get("http://localhost:8080/v1/models", timeout=2)
                    if resp.status_code == 200:
                        logger.info(f"[LlamaManager] Hot swap successful. '{model_name}' is now active on port 8080.")
                        cls._current_model_path = model_path
                        return True
                except Exception:
                    pass
                time.sleep(2)

            logger.error("[LlamaManager] llama-server process failed to respond within timeout.")
            return False
        except Exception as e:
            logger.error(f"[LlamaManager] Failed to launch llama-server: {e}")
            return False
