
import subprocess

def test_wmi_gpu():
    try:
        # WMI query is often faster than Get-Counter
        cmd = 'powershell "Get-WmiObject Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -like \'*engtype_Compute*\' -or $_.Name -like \'*engtype_3D*\' } | Select-Object -ExpandProperty UtilizationPercentage"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        vals = [int(v) for v in result.stdout.strip().split('\n') if v.strip()]
        if vals:
            return max(vals)
        return 0
    except Exception as e:
        print(f"WMI Error: {e}")
        return 0

if __name__ == "__main__":
    print(f"Testing GPU WMI...")
    gpu = test_wmi_gpu()
    print(f"GPU Util: {gpu}%")
