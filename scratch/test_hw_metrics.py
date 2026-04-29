
import subprocess
import json
import re

def get_gpu_utilization():
    try:
        # PowerShell command to get GPU utilization percentage
        cmd = 'powershell "Get-Counter \'\\GPU Engine(*)\\Utilization Percentage\' | Select-Object -ExpandProperty CounterSamples | Where-Object {$_.InstanceName -like \'*engtype_3D*\' -or $_.InstanceName -like \'*engtype_Compute*\'} | ForEach-Object {$_.CookedValue}"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
        values = [float(v) for v in result.stdout.strip().split('\n') if v.strip()]
        if values:
            return max(values)
        return 0.0
    except Exception as e:
        print(f"GPU Error: {e}")
        return 0.0

def get_npu_utilization():
    try:
        # NPU counters are newer, might not be available on all systems or drivers
        # We try to find any counter with 'NPU' in the name
        cmd = 'powershell "Get-Counter -ListSet NPU* | Select-Object -ExpandProperty Paths"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
        paths = [p.strip() for p in result.stdout.strip().split('\n') if p.strip()]
        
        if not paths:
            return 0.0
            
        # If we found paths, sample them
        sample_cmd = f'powershell "Get-Counter \'{paths[0]}\' | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue"'
        sample_result = subprocess.run(sample_cmd, shell=True, capture_output=True, text=True, timeout=5)
        val = sample_result.stdout.strip()
        if val:
            return float(val)
        return 0.0
    except Exception as e:
        print(f"NPU Error: {e}")
        return 0.0

if __name__ == "__main__":
    print(f"Testing GPU utilization...")
    gpu = get_gpu_utilization()
    print(f"GPU: {gpu}%")
    
    print(f"Testing NPU utilization...")
    npu = get_npu_utilization()
    print(f"NPU: {npu}%")
