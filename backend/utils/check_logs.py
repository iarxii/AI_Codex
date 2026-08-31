import argparse
import subprocess
import sys

# Configuration
SERVICES = {
    "backend": "aicodex-be",
    "frontend": "aicodex-lab"
}
REGION = "us-central1"
PROJECT = "aicodex-lab"

def check_logs(service_key: str, limit: int, tail: bool):
    if service_key not in SERVICES and service_key != "all":
        print(f"Error: Unknown service '{service_key}'. Choose from: {list(SERVICES.keys())} or 'all'")
        sys.exit(1)

    targets = list(SERVICES.keys()) if service_key == "all" else [service_key]

    for target in targets:
        service_name = SERVICES[target]
        print(f"\n{'='*50}")
        print(f" Fetching logs for: {target.upper()} ({service_name})")
        print(f"{'='*50}\n")
        
        cmd = [
            "gcloud", "run", "services", "logs", "read", service_name,
            f"--region={REGION}",
            f"--project={PROJECT}"
        ]
        
        if tail:
            print(f"Tailing logs for {service_name}... (Press Ctrl+C to stop)")
            cmd.append("--tail")
            # When tailing, we typically only do one service at a time, or it blocks.
            if service_key == "all":
                print("Warning: Tailing 'all' will block on the first service. Please tail services individually.")
        else:
            cmd.append(f"--limit={limit}")

        try:
            # Use subprocess to run the gcloud command
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            print(f"\nError fetching logs for {service_name}. Is gcloud authenticated?")
            print(e)
        except KeyboardInterrupt:
            print("\nStopped log tailing.")
            break

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Google Cloud Run logs for AI Codex services.")
    parser.add_argument(
        "service", 
        nargs="?", 
        default="backend", 
        choices=["backend", "frontend", "all"],
        help="The service to fetch logs for (default: backend)"
    )
    parser.add_argument(
        "-n", "--lines", 
        type=int, 
        default=50, 
        help="Number of log entries to fetch (default: 50)"
    )
    parser.add_argument(
        "-t", "--tail", 
        action="store_true", 
        help="Continuously tail the logs instead of just fetching recent lines."
    )

    args = parser.parse_args()
    check_logs(args.service, args.lines, args.tail)
