# FinTrader Analytics Lab — Operational & Workflow Guide

The **FinTrader Analytics Lab** is a specialized, administratively isolated agentic workspace within `CodexSpaces`. It bridges a modern React/FastAPI portal with the native MetaTrader 5 (MT5) execution engine. 

Depending on your requirements, the workspace can be run **locally** (native Windows host) or **online/containerized** (Linux server using Wine emulation). Below is the authoritative process, workflows, and limitations for both models.

---

## Workspace Architecture Comparison

```mermaid
graph TD
    subgraph Local Mode (Native Windows)
        A[React Frontend] <-->|REST / WebSockets| B[FastAPI Backend]
        B <-->|Direct IPC via MetaTrader5 library| C[MT5 Windows Terminal]
    end

    subgraph Online/Containerized Mode (Linux + Wine)
        D[React Frontend] <-->|REST / WebSockets| E[FastAPI Backend]
        E <-->|gRPC Broker on Port 50051| F[fintrader-mt5-engine Container]
        F <-->|Wine IPC| G[MT5 Terminal inside Wine]
        H[Developer / Trader VNC] <-->|VNC on Port 5900| F
    end
```

---

## 1. Local Workflow: Native Windows Setup

This is the recommended workflow for **development, strategy backtesting, and low-latency retail trading** where both the agent server and the broker terminal reside on the same Windows machine.

### Intended Workflow
1. **Prepare MetaTrader 5**:
   - Install the official MT5 Desktop Terminal for Windows.
   - Navigate to `Tools` -> `Options` -> `Expert Advisors`.
   - Enable:
     - `[✓] Allow algorithmic trading`
     - `[✓] Allow DLL imports`
   - Log into your Broker account (demo or live).
2. **Start the Backend**:
   - Install dependencies: `pip install MetaTrader5 FastAPI uvicorn`
   - Run the FastAPI server: `uvicorn main:app --port 8000` from an **Administrator command prompt** or the exact same privilege layer as the running MT5 terminal instance.
3. **Start the Frontend**:
   - Run the Vite development server: `npm run dev` (running on port `9173`).
4. **Drawing and Interaction**:
   - Select tools from the `FinTraderPalette` (e.g. Trendline, Fibonacci Channel).
   - Click points directly on the chart canvas. The `AgentDrawingPipelineEngine` converts canvas pixel coordinates `X/Y` into financial coordinates `Time/Price` and pushes them synchronously to the local MT5 terminal via the API.

### Key Advantages
- **Zero Latency**: Direct IPC between Python and the local C++ MT5 process.
- **Full Visual Access**: Standard Windows UI is visible, allowing real-time monitoring of charts, trade executions, and logs.
- **Simpler Setup**: No emulation layer or complex virtual frames required.

### Limitations
- **OS Clamping**: Strictly limited to Windows hosts (the `MetaTrader5` Python library will fail to import on macOS/Linux).
- **Security & Privilege Mismatch**: If Uvicorn (FastAPI) and the MT5 terminal run under different user privilege levels (e.g., one is Administrator, the other is not), the IPC handshake will fail to authenticate.
- **Resource Heavy**: Requires the Windows host to support the graphical overhead of the MT5 application alongside the web servers.

---

## 2. Online/Containerized Workflow: Linux + Wine Setup

This is the recommended workflow for **cloud hosting, automated SaaS scaling, and headless agent pipelines** deployed to cloud infrastructure (e.g., Google Cloud Engine, AWS, or Docker hosts).

### Intended Workflow
1. **Build the MT5 Engine Image**:
   - Use the `mt5_container` directory configuration to build the `fintrader-mt5-engine` image.
   - This packages Wine (Windows compatibility layer), Xvfb (Virtual Framebuffer), and a gRPC Python bridge.
2. **Spin Up the Containers**:
   - Run `docker-compose up -d` in the container directory.
   - Port `50051` is exposed for gRPC broker requests.
   - Port `5900` is exposed for VNC debugging.
3. **Configure the Remote Bridge**:
   - The cloud-hosted FastAPI service connects to `fintrader-mt5-engine:50051` via gRPC.
   - Drawings, data streams, and execution commands are serialized and sent over gRPC to the Wine container, which executes them inside the virtualized MT5 terminal.
4. **Visual Monitoring & Debugging**:
   - Connect via VNC Viewer to `localhost:5900` (or the server's public IP) to manually authorize broker credentials, check terminal logs, or configure indicators.

### Key Advantages
- **Cloud Deployable**: Decoupled from Windows hardware; run anywhere on standard Linux nodes.
- **Headless Scalability**: Ideal for running parallel agents across isolated containers.
- **Persistent State**: Docker volumes persist program directories, logs, and account configurations.

### Limitations
- **Emulation Performance**: Wine virtualization introduces a slight performance overhead. Tight resource controls (`cpus: 1.5`, `memory: 2GB`) are recommended to prevent container leaks.
- **Network Latency**: Adding a gRPC bridge between the web backend and the MT5 container adds latency (usually 5ms - 50ms depending on network distance).
- **Anti-Debugger Blocks**: MetaTrader 5 occasionally detects virtualized Wine environments or active debuggers, requiring specific registry overrides and Wine Mono configurations.
- **Credential Setup**: Initial login and server configuration require manual intervention via VNC.

---

## 3. General Operational Constraints & Rulesets

Regardless of whether you run locally or online, the FinTrader workspace enforces a **Trading Discipline Engine** modeled on professional MQL5 risk standards:

### Strict Validation Enforcements
Before any trade is routed or chart drawing is pushed, the system executes these central control gates:
1. **`IsSymbolAllowed(symbol)`**: Validates if the selected asset class aligns with permitted portfolio parameters.
2. **`IsTradingHoursAllowed(session)`**: Blocks trades during low-liquidity market closures or high-risk weekend gaps.
3. **`IsDailyLimitAllowed()`**: Checks if the account's **Daily Drawdown (DD)** or **Active Exposure** thresholds have been breached. If breached, the **TRADING GATE** locks execution automatically.

### Concurrency Warning
The MT5 terminal engine is **synchronous and single-threaded** by nature. 
- **Web App Mitigation**: The FastAPI backend implements a global Python `threading.Lock` to queue concurrent async web requests (e.g. multiple agents requesting data simultaneously) and routes them sequentially to the MT5 instance to prevent thread lock deadlocks.
