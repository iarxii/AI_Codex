import asyncio
import datetime
import random
import yfinance as yf
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query

router = APIRouter()

# Map standard symbols to yfinance symbols
SYMBOL_MAP = {
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "SPX500": "^GSPC",
    "TSLA": "TSLA",
    "XAUUSD": "GC=F",
    "USOIL": "CL=F",
}

# Standard fallback prices if yfinance fails or is rate-limited
FALLBACK_BASE_PRICES = {
    "BTCUSD": 95000.0,
    "ETHUSD": 3400.0,
    "EURUSD": 1.0850,
    "GBPUSD": 1.2650,
    "SPX500": 5300.0,
    "TSLA": 245.0,
    "XAUUSD": 2400.0,
    "USOIL": 78.0,
}

def get_fallback_candles(symbol: str, range_preset: str) -> list:
    """Generates realistic fallback mock data if the API fails."""
    candles = []
    base_price = FALLBACK_BASE_PRICES.get(symbol, 100.0)
    vol = base_price * 0.005 # 0.5% volatility
    
    # Determine count and formatting based on range
    if range_preset == "1D":
        count = 24
        delta = datetime.timedelta(hours=1)
        time_fmt = "%I:%M %p"
    elif range_preset == "1W":
        count = 7
        delta = datetime.timedelta(days=1)
        time_fmt = "%a"
    elif range_preset == "1M":
        count = 30
        delta = datetime.timedelta(days=1)
        time_fmt = "%b %d"
    elif range_preset == "3M":
        count = 90
        delta = datetime.timedelta(days=1)
        time_fmt = "%b %d"
    else: # "All" or 1Y
        count = 52
        delta = datetime.timedelta(weeks=1)
        time_fmt = "%b %Y"

    now = datetime.datetime.now()
    current_base = base_price - (vol * (count / 2))
    
    for i in range(count):
        candle_time = now - (count - i) * delta
        open_price = current_base + (random.random() - 0.5) * vol
        close_price = open_price + (random.random() - 0.45) * vol * 1.1 # slight bullish bias
        high_price = max(open_price, close_price) + random.random() * (vol * 0.4)
        low_price = min(open_price, close_price) - random.random() * (vol * 0.4)
        
        # Ensure prices remain positive
        open_price = max(0.0001, open_price)
        close_price = max(0.0001, close_price)
        high_price = max(open_price, close_price, high_price)
        low_price = max(0.0001, min(open_price, close_price, low_price))
        
        candles.append({
            "time": candle_time.strftime(time_fmt),
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close_price
        })
        current_base = close_price
        
    return candles

@router.get("/history")
async def get_market_history(
    symbol: str = Query("BTCUSD"),
    range: str = Query("1D")
):
    yf_symbol = SYMBOL_MAP.get(symbol, symbol)
    
    # Resolve range to yfinance period & interval
    if range == "1D":
        period, interval, time_fmt = "1d", "15m", "%I:%M %p"
    elif range == "1W":
        period, interval, time_fmt = "7d", "1h", "%a %I %p"
    elif range == "1M":
        period, interval, time_fmt = "1mo", "1d", "%b %d"
    elif range == "3M":
        period, interval, time_fmt = "3mo", "1d", "%b %d"
    elif range == "All":
        period, interval, time_fmt = "1y", "1d", "%b %d"
    else:
        period, interval, time_fmt = "1d", "15m", "%I:%M %p"
        
    try:
        # Fetch using yfinance in a threadpool to prevent blocking the async loop
        ticker = yf.Ticker(yf_symbol)
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(None, lambda: ticker.history(period=period, interval=interval))
        
        if df.empty:
            print(f"Warning: yfinance returned empty DataFrame for {yf_symbol}, using fallback generator.")
            return get_fallback_candles(symbol, range)
            
        candles = []
        for index, row in df.iterrows():
            # Format time label
            time_str = index.strftime(time_fmt)
            candles.append({
                "time": time_str,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"])
            })
        return candles
        
    except Exception as e:
        print(f"Error fetching market history for {symbol} ({yf_symbol}): {e}. Using fallback generator.")
        return get_fallback_candles(symbol, range)

@router.websocket("/live")
async def market_live_ws(websocket: WebSocket, symbol: str = Query("BTCUSD")):
    print(f"DEBUG: Live market WebSocket connection attempt for symbol: {symbol}")
    await websocket.accept()
    
    yf_symbol = SYMBOL_MAP.get(symbol, symbol)
    last_price = FALLBACK_BASE_PRICES.get(symbol, 100.0)
    
    # Initial price fetch
    try:
        ticker = yf.Ticker(yf_symbol)
        loop = asyncio.get_event_loop()
        # info can be slow, try fast history fetch of last 1 day
        df = await loop.run_in_executor(None, lambda: ticker.history(period="1d"))
        if not df.empty:
            last_price = float(df["Close"].iloc[-1])
    except Exception as e:
        print(f"Error fetching initial price for {symbol}: {e}")
        
    print(f"DEBUG: Live WebSocket connected for symbol: {symbol} starting at: {last_price}")
    
    # Send initial price
    await websocket.send_json({"symbol": symbol, "price": last_price})
    
    # Setup random walk parameters for sub-second smooth ticks
    vol = last_price * 0.0005 # 0.05% change per tick
    ticks_since_sync = 0
    
    try:
        while True:
            # Generate simulated micro-tick
            change = (random.random() - 0.49) * vol  # slight bullish bias
            last_price = max(0.0001, last_price + change)
            
            # Send live update
            await websocket.send_json({
                "symbol": symbol,
                "price": last_price
            })
            
            # Sleep 1 second before next tick
            await asyncio.sleep(1)
            ticks_since_sync += 1
            
            # Every 15 seconds, attempt to sync with real price in the background to prevent drift
            if ticks_since_sync >= 15:
                ticks_since_sync = 0
                try:
                    # Non-blocking fetch of latest price
                    df = await loop.run_in_executor(None, lambda: ticker.history(period="1d"))
                    if not df.empty:
                        real_price = float(df["Close"].iloc[-1])
                        # Smoothly adjust towards real price instead of a hard jump
                        last_price = (last_price * 0.3) + (real_price * 0.7)
                except Exception:
                    pass
                    
    except WebSocketDisconnect:
        print(f"DEBUG: Live market WebSocket disconnected for symbol: {symbol}")
    except Exception as e:
        print(f"Market Live WS Error for {symbol}: {e}")
