import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Database, Activity, Code } from 'lucide-react';
import './StatusPanel.css';

interface Metrics {
  cpu: number;
  ram: number;
  npu: number;
  model: string;
  latency: string;
}

const StatusPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    cpu: 0,
    ram: 0,
    npu: 0,
    model: 'Initializing...',
    latency: '--'
  });
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = '127.0.0.1:8000';
    const path = '/api/metrics/ws/metrics';
    const url = `${protocol}//${host}${path}`;

    console.log('Connecting to Metrics WebSocket:', url);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Metrics WebSocket Connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMetrics((prev) => ({ ...prev, ...data }));
      } catch (err) {
        console.error('Failed to parse metrics message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Metrics WebSocket Disconnected');
      setIsConnected(false);
      setTimeout(connect, 5000); // Reconnect every 5 seconds
    };
  };

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="status-panel">
      <div className="status-section">
        <h3 className="status-title">Active Intelligence</h3>
        <div className="status-card glass">
          <div className="card-header">
            <Cpu size={20} className="icon-blue" />
            <span className="model-name">{metrics.model}</span>
          </div>
          <div className="metrics">
            <div className="metric">
              <span>Latency</span>
              <span className="value green">{metrics.latency}</span>
            </div>
            <div className="metric">
              <span>CPU Load</span>
              <span className="value">{Math.round(metrics.cpu)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="status-section">
        <h3 className="status-title">Hardware Acceleration</h3>
        <div className="status-card glass">
          <div className="card-header">
            <Activity size={20} className="icon-purple" />
            <span className="tier-name">System Performance</span>
          </div>
          <div className="progress-container">
            <div className="progress-label">
              <span>RAM Usage</span>
              <span>{Math.round(metrics.ram)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${metrics.ram}%` }}></div>
            </div>
          </div>
          <div className="progress-container">
            <div className="progress-label">
              <span>NPU Load</span>
              <span>{metrics.npu}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${metrics.npu}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="status-section">
        <h3 className="status-title">Active Context</h3>
        <div className="context-list">
          <div className="context-item">
            <Database size={16} />
            <span>Local VectorDB (Qdrant)</span>
          </div>
          <div className="context-item">
            <Code size={16} />
            <span>backend/main.py</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
