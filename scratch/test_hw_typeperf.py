
import subprocess
import re

def test_typeperf():
    try:
        # typeperf is often the fastest way to get a single sample
        cmd = 'typeperf "\\GPU Engine(*)\\Utilization Percentage" -sc 1'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
        # Output is CSV like: "04/29/2026 17:05:00.000","0.000000","95.000000",...
        matches = re.findall(r'"(\d+\.\d+)"', result.stdout)
        if matches:
            vals = [float(m) for m in matches]
            return max(vals)
        return 0.0
    except Exception as e:
        print(f"Typeperf Error: {e}")
        return 0.0

if __name__ == "__main__":
    print(f"Testing typeperf...")
    gpu = test_typeperf()
    print(f"GPU Util: {gpu}%")
