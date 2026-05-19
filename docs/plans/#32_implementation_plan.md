# Global Chart Module Improvements

We want to upgrade the client-side `TradingChart` component in the `AI_Codex` sub-module to support:
1. **Time-Series X-Axis Labeled Timeline**: Drawing chronological tick mark labels along the bottom of the SVG canvas.
2. **Finer Range Filtering Controls**: Introducing timeframe resolution preset buttons (`1D`, `1W`, `1M`, `3M`, `All`) as preferred by the user.
3. **Instrument Class Switching**: Upgrading the single-symbol display to support multi-asset switching categorized by Asset Class (Equities, Forex, Cryptocurrencies, Commodities, Indices).
4. **Live Real-Time Data**: Transitioning from client-side mock simulations to a real-time data stream (either using a MetaTrader 5 local terminal bridge or a public web market data API).

---

## User Review Required

> [!IMPORTANT]
> To support **live real-time data**, we must implement a backend data service in the FastAPI project. We present two options for the real-time data architecture:
> 
> *   **Option A: MetaTrader 5 (MT5) Bridge (Requires Windows & MT5 Desktop Terminal)**
>     *   Integrates with a locally running MT5 application using the `MetaTrader5` Python package.
>     *   Pros: Matches the project's original design blueprints; allows actual order execution/signals directly.
>     *   Cons: Requires the MT5 client to be open on the system and configured with a broker account.
> *   **Option B: Standalone Public Market Data API (No Desktop Terminal Required)**
>     *   Fetches real-time and historical data from public APIs (e.g., Yahoo Finance via `yfinance` or Binance WebSocket/REST for crypto).
>     *   Pros: Easy setup, works out of the box without installing and running a desktop MT5 terminal.
>     *   Cons: Cannot execute trades or MQL5 signals directly.
> 
> **Please advise which option you prefer to implement.**

> [!NOTE]
> Based on your feedback, we will refactor the SVG chart to use relative container sizing and scale CSS dimensions dynamically, preventing display constraints when rendering longer timeframes.

---

## Open Questions

> [!IMPORTANT]
> 1. Which real-time data architecture would you like to pursue? (Option A: MT5 Bridge, or Option B: Standalone Public APIs).
> 2. For default Take Profit (TP) and Stop Loss (SL) values, should we calculate them as a percentage of the live entry price when switching instruments? (e.g., TP = +2.0%, SL = -1.0% of entry price).

---

## Proposed Changes

### 1. Backend (FastAPI Integration)

If **Option A (MT5 Bridge)** is selected:
#### [MODIFY] [requirements.txt](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/requirements.txt)
*   Add `MetaTrader5` package.

#### [NEW] [market.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/market.py)
*   Create endpoints `/api/v1/market/history` to query historical candles for a specific symbol/timeframe preset.
*   Add a WebSocket endpoint `/ws/market/live` that streams tick data.
*   Implement `mt5.initialize()` check and sync locks for thread safety.

If **Option B (Public APIs)** is selected:
#### [MODIFY] [requirements.txt](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/requirements.txt)
*   Add `yfinance` package.

#### [NEW] [market.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/market.py)
*   Create endpoints `/api/v1/market/history` retrieving data using `yfinance` history methods and converting it to OHLC JSON format.
*   Optionally stream live ticks via an SSE/WebSocket loop querying current ticker values.

---

### 2. Client (React Frontend)

#### [MODIFY] [TradingChart.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/TradingChart.tsx)

1. **Relative SVG Layout**:
   - Refactor the hardcoded `svgWidth = 520` and `svgHeight = 220` to use a responsive grid with `viewBox` matching container dimensions.
   - Allocate `paddingBottom = 30` to hold x-axis labels.

2. **Time-series X-Axis rendering**:
   - Iterate through the history array and render tick labels at calculated spacing intervals (e.g. every 6-8 bars depending on zoom):
     ```tsx
     <text x={getX(i)} y={svgHeight - 10} fill="white" fillOpacity="0.4" fontSize="8" textAnchor="middle" fontFamily="monospace">
       {c.time}
     </text>
     ```

3. **Timeframe Presets**:
   - Add preset buttons `1D`, `1W`, `1M`, `3M`, `All` at the top of the chart control toolbar.
   - On button click, trigger a fetch request to the backend `/api/v1/market/history` for the selected timeframe.

4. **Live Data Hook**:
   - Establish a WebSocket/SSE subscription to the backend live feed channel upon mounting.
   - When a tick is received, update `currentPrice` and merge the tick values into the last candle's `high`/`low`/`close` fields.

#### [MODIFY] [TradingSpaceHeader.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/spaces/trading/TradingSpaceHeader.tsx)

1. **Categorized Dropdown Selector**:
   - Create a dropdown menu grouped by **Asset Class** (Equities, Forex, Cryptocurrencies, Commodities, Indices).
   - Hook dropdown changes to update the active symbol in `activeChart`, resetting values to match the live feed.

---

## Verification Plan

### Automated Tests
*   Verify the fastAPI backend server compiles with new dependencies:
    ```powershell
    python -m pip install -r backend/requirements.txt
    ```
*   Verify React frontend compiles:
    ```powershell
    npm run build
    ```

### Manual Verification
*   Test timeframe switching by clicking `1D`, `1W`, `1M` etc. and checking if x-axis labels render correctly without overlaps.
*   Switch symbols across asset classes (e.g., `EURUSD` to `AAPL`) to confirm decimals and scale adapt properly to real price data.
