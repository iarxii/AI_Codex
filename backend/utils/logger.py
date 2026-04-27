import logging
import os
from datetime import datetime
from pathlib import Path

# Ensure logs directory exists at project root (outside backend to prevent uvicorn reload loop)
LOGS_DIR = Path(__file__).resolve().parents[2] / "logs"
LOGS_DIR.mkdir(exist_ok=True)

DEBUG_LOG = LOGS_DIR / "debug.log"

def setup_debug_logger():
    logger = logging.getLogger("aicodex_debug")
    logger.setLevel(logging.DEBUG)
    
    # File handler
    fh = logging.FileHandler(DEBUG_LOG)
    fh.setLevel(logging.DEBUG)
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    fh.setFormatter(formatter)
    
    logger.addHandler(fh)
    return logger

debug_logger = setup_debug_logger()

def log_debug(message: str):
    debug_logger.debug(message)

def log_error(message: str, exc: Exception = None):
    if exc:
        debug_logger.error(f"{message}: {exc}", exc_info=True)
    else:
        debug_logger.error(message)
