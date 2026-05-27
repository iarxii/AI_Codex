import os
import json
import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger("mt5_server")

class MT5Client:
    """
    Communicates with the MetaTrader 5 container or desktop bridge via TCP sockets.
    Sends JSON-RPC styled actions and returns structured responses.
    """
    def __init__(self):
        self.host = os.getenv("MT5_BRIDGE_HOST", "localhost")
        self.port = int(os.getenv("MT5_BRIDGE_PORT", "8090"))
        self.timeout = float(os.getenv("MT5_BRIDGE_TIMEOUT", "5.0"))

    async def send_command(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends a command JSON packet over TCP socket and waits for a response packet.
        """
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=self.timeout
            )
        except Exception as e:
            logger.error(f"Failed to connect to MT5 bridge ({self.host}:{self.port}): {e}")
            raise ConnectionError(f"MT5 bridge is offline or unreachable: {str(e)}")

        try:
            # Send message terminated with a newline
            message = json.dumps(payload) + "\n"
            writer.write(message.encode("utf-8"))
            await writer.drain()

            # Read response
            response_data = await asyncio.wait_for(
                reader.readline(),
                timeout=self.timeout
            )
            if not response_data:
                raise ConnectionError("Empty response received from MT5 bridge.")

            response_str = response_data.decode("utf-8").strip()
            return json.loads(response_str)
        except Exception as e:
            logger.error(f"Error during MT5 command execution: {e}")
            raise
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except:
                pass

    async def ping(self) -> bool:
        """
        Performs a heartbeat check to see if the MT5 bridge is active.
        """
        try:
            res = await self.send_command({"action": "ping"})
            return res.get("status") == "success"
        except Exception:
            return False

# Singleton instance
mt5_client = MT5Client()
