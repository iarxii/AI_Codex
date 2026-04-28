import logging
import os
import re
from datetime import datetime
from pathlib import Path

# Ensure logs directory exists at project root (outside backend to prevent uvicorn reload loop)
LOGS_DIR = Path(__file__).resolve().parents[2] / "logs"
LOGS_DIR.mkdir(exist_ok=True)

DEBUG_LOG = LOGS_DIR / "debug.log"

class SensitiveFilter(logging.Filter):
    """Filter that masks sensitive information in logs like tokens and API keys."""
    def filter(self, record):
        # 1. Mask the main message if it's a string
        if isinstance(record.msg, str):
            record.msg = self._mask_string(record.msg)
        
        # 2. Mask arguments (Uvicorn access logs store the request path here)
        if record.args:
            new_args = []
            for arg in record.args:
                if isinstance(arg, str):
                    new_args.append(self._mask_string(arg))
                else:
                    new_args.append(arg)
            record.args = tuple(new_args)
            
        return True

    def _mask_string(self, text: str) -> str:
        # Mask JWT tokens in URLs (e.g., /?token=...)
        text = re.sub(r"token=[a-zA-Z0-9._~%+-]+\.[a-zA-Z0-9._~%+-]+\.[a-zA-Z0-9._~%+-]+", "token=***", text)
        # Mask basic token parameters
        text = re.sub(r"token=[a-zA-Z0-9._-]+", "token=***", text)
        # Mask API keys
        text = re.sub(r"api_key=[a-zA-Z0-9._-]+", "api_key=***", text)
        return text

def setup_debug_logger():
    logger = logging.getLogger("aicodex_debug")
    logger.setLevel(logging.DEBUG)
    
    # File handler
    fh = logging.FileHandler(DEBUG_LOG)
    fh.setLevel(logging.DEBUG)
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    fh.setFormatter(formatter)
    
    # Add sensitivity filter
    fh.addFilter(SensitiveFilter())
    
    logger.addHandler(fh)
    return logger

def mask_uvicorn_logs():
    """Apply sensitivity filters to uvicorn loggers."""
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        logger = logging.getLogger(logger_name)
        logger.addFilter(SensitiveFilter())

debug_logger = setup_debug_logger()
mask_uvicorn_logs()

def log_debug(message: str):
    debug_logger.debug(message)

def log_error(message: str, exc: Exception = None):
    if exc:
        debug_logger.error(f"{message}: {exc}", exc_info=True)
    else:
        debug_logger.error(message)
