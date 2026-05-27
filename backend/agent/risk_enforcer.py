import os
import logging
from typing import Tuple

logger = logging.getLogger("risk_enforcer")

class RiskEnforcer:
    """
    Enforces local risk parameters and safety guardrails on trading signals.
    Validates trade direction, lot size (volume), and stop-loss placement.
    """
    def __init__(self):
        # Default safety boundaries, customizable via environment variables
        self.max_lot_size = float(os.getenv("MT5_MAX_LOT_SIZE", "1.0"))
        self.stoploss_required = os.getenv("MT5_STOPLOSS_REQUIRED", "True").lower() == "true"
        self.max_daily_drawdown_pct = float(os.getenv("MT5_MAX_DAILY_DRAWDOWN_PCT", "2.0"))

    def validate_trade(
        self, 
        symbol: str, 
        tp: float, 
        sl: float, 
        entry: float, 
        direction: str, 
        volume: float = 0.1
    ) -> Tuple[bool, str]:
        """
        Validates trade parameters. Returns a tuple of (is_safe: bool, reason: str).
        """
        direction_clean = direction.lower().strip()
        
        # 1. Validate direction
        if direction_clean not in ["buy", "sell"]:
            return False, f"Invalid trade direction '{direction}'. Must be 'buy' or 'sell'."

        # 2. Validate entry price
        if entry <= 0:
            return False, f"Invalid entry price: {entry}. Must be positive."

        # 3. Validate volume/lot size limits
        if volume <= 0:
            return False, f"Volume must be greater than zero, got {volume}."
        if volume > self.max_lot_size:
            return False, f"Trade volume {volume} exceeds safety limit of {self.max_lot_size} lots."

        # 4. Enforce Stop-Loss requirements
        if self.stoploss_required:
            if not sl or sl <= 0:
                return False, "Stop loss (SL) is required but was not specified or is zero."
            
            # Buy check: Stop Loss must be below entry
            if direction_clean == "buy" and sl >= entry:
                return False, f"Risk Violation: Buy Stop Loss ({sl}) must be strictly below entry price ({entry})."
            
            # Sell check: Stop Loss must be above entry
            if direction_clean == "sell" and sl <= entry:
                return False, f"Risk Violation: Sell Stop Loss ({sl}) must be strictly above entry price ({entry})."

        # 5. Take Profit logic check (optional but highly recommended)
        if tp > 0:
            if direction_clean == "buy" and tp <= entry:
                return False, f"Take Profit ({tp}) for Buy order must be strictly above entry ({entry})."
            if direction_clean == "sell" and tp >= entry:
                return False, f"Take Profit ({tp}) for Sell order must be strictly below entry ({entry})."

        return True, "Trade complies with all active risk protocols."

# Singleton instance
risk_enforcer = RiskEnforcer()
