import time
import datetime
from concurrent import futures
import threading
import logging
import grpc
import MetaTrader5 as mt5

# Generated gRPC stubs
import bridge_pb2
import bridge_pb2_grpc

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MT5 is synchronous and single-threaded for modifications. We lock updates.
mt5_lock = threading.Lock()

class MT5BridgeServicer(bridge_pb2_grpc.MT5BridgeServicer):
    
    def __init__(self):
        # Initialize connection to MT5
        with mt5_lock:
            if not mt5.initialize():
                logger.error(f"MT5 Initialization failed. Error code: {mt5.last_error()}")
            else:
                logger.info("MT5 successfully initialized inside Wine prefix.")

    def GetHistoricalTicks(self, request, context):
        logger.info(f"Fetching ticks for {request.symbol} from {request.start_time} to {request.end_time}")
        
        utc_start = datetime.datetime.fromtimestamp(request.start_time, datetime.timezone.utc)
        utc_end = datetime.datetime.fromtimestamp(request.end_time, datetime.timezone.utc)
        
        with mt5_lock:
            ticks = mt5.copy_ticks_range(request.symbol, utc_start, utc_end, mt5.COPY_TICKS_ALL)
            
        if ticks is None or len(ticks) == 0:
            logger.warning(f"No ticks returned for {request.symbol}. Error: {mt5.last_error()}")
            return
        
        for tick in ticks:
            yield bridge_pb2.TickResponse(
                time=int(tick['time']),
                bid=float(tick['bid']),
                ask=float(tick['ask']),
                last=float(tick['last']),
                volume=int(tick['volume'])
            )

    def ExecuteOrder(self, request, context):
        logger.info(f"Received order execution request: {request.order_type} {request.volume} {request.symbol}")
        
        order_type_map = {
            "BUY": mt5.ORDER_TYPE_BUY,
            "SELL": mt5.ORDER_TYPE_SELL
        }
        
        mql_order_type = order_type_map.get(request.order_type.upper())
        if mql_order_type is None:
            return bridge_pb2.OrderResponse(success=False, comment=f"Invalid order type: {request.order_type}")

        order_request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": request.symbol,
            "volume": request.volume,
            "type": mql_order_type,
            "price": request.price if request.price > 0 else (mt5.symbol_info_tick(request.symbol).ask if request.order_type == "BUY" else mt5.symbol_info_tick(request.symbol).bid),
            "deviation": request.slippage,
            "magic": 20260520,
            "comment": "AI Harness Order",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        with mt5_lock:
            result = mt5.order_send(order_request)

        if result is None:
            return bridge_pb2.OrderResponse(success=False, comment="Order send returned None")
            
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Order failed. Retcode: {result.retcode}, Comment: {result.comment}")
            return bridge_pb2.OrderResponse(success=False, ticket=0, comment=f"Retcode: {result.retcode}, {result.comment}")

        logger.info(f"Order executed successfully. Ticket: {result.order}")
        return bridge_pb2.OrderResponse(
            success=True,
            ticket=result.order,
            comment=result.comment,
            price=result.price
        )

    def GetAccountInfo(self, request, context):
        with mt5_lock:
            account_info = mt5.account_info()
            
        if account_info is None:
            return bridge_pb2.AccountResponse(login=0, balance=0.0, equity=0.0, broker="Unknown (Error)")
            
        return bridge_pb2.AccountResponse(
            login=account_info.login,
            balance=account_info.balance,
            equity=account_info.equity,
            broker=account_info.company
        )

def serve():
    # Compile Protobuf if not already compiled (on startup inside Wine)
    import subprocess
    logger.info("Compiling protobuf files...")
    subprocess.run([
        "C:\\Python310\\python.exe", "-m", "grpc_tools.protoc",
        "-I/home/trader/app",
        "--python_out=/home/trader/app",
        "--grpc_python_out=/home/trader/app",
        "/home/trader/app/bridge.proto"
    ], check=True)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
    bridge_pb2_grpc.add_MT5BridgeServicer_to_server(MT5BridgeServicer(), server)
    server.add_insecure_port('[::]:50051')
    logger.info("Starting gRPC MT5 Bridge server on port 50051...")
    server.start()
    try:
        while True:
            time.sleep(86400)
    except KeyboardInterrupt:
        server.stop(0)
        with mt5_lock:
            mt5.shutdown()

if __name__ == '__main__':
    serve()
