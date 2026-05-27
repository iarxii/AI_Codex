import asyncio
import logging
from typing import Dict, Any, Optional
from backend.integrations.mt5_server import mt5_client

logger = logging.getLogger("market_pipeline")

class MarketPipeline:
    """
    Unified Pipeline that polls market ticks from the MT5 socket bridge
    and caches symbol prices for instant retrieval by WebSockets or APIs.
    """
    def __init__(self):
        self.active = False
        self.quote_cache: Dict[str, Dict[str, Any]] = {}
        self._loop_task: Optional[asyncio.Task] = None

    async def start(self):
        """
        Starts the polling loop in the background.
        """
        if self.active:
            return
        self.active = True
        self._loop_task = asyncio.create_task(self._poll_loop())
        logger.info("Market data polling pipeline started.")

    async def stop(self):
        """
        Stops the polling loop.
        """
        self.active = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("Market data polling pipeline stopped.")

    async def _poll_loop(self):
        """
        Continuous background thread polling active ticks.
        """
        while self.active:
            try:
                # Poll the MT5 bridge for active asset pricing
                response = await mt5_client.send_command({"action": "get_all_ticks"})
                if response.get("status") == "success":
                    ticks = response.get("data", {})
                    for symbol, tick_data in ticks.items():
                        self.quote_cache[symbol] = {
                            "symbol": symbol,
                            "bid": tick_data.get("bid"),
                            "ask": tick_data.get("ask"),
                            "timestamp": tick_data.get("time")
                        }
            except Exception as e:
                # Graceful degradation if MT5 bridge is temporarily unreachable
                logger.debug(f"MarketPipeline MT5 polling heartbeat skipped: {e}")
            
            await asyncio.sleep(1.0)  # Polling frequency

    def get_latest_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Fetch latest cached pricing.
        """
        return self.quote_cache.get(symbol)

# Singleton instance
market_pipeline = MarketPipeline()
