import React from 'react';
import { Cpu, Database, Activity, Code } from 'lucide-react';
import './StatusPanel.css';

const StatusPanel: React.FC = () => {
  return (
    <div className="status-panel">
      <div className="status-section">
        <h3 className="status-title">Active Intelligence</h3>
        <div className="status-card glass">
          <div className="card-header">
            <Cpu size={20} className="icon-blue" />
            <span className="model-name">Llama 3.2 3B</span>
          </div>
          <div className="metrics">
            <div className="metric">
              <span>Latency</span>
              <span className="value green">42ms</span>
            </div>
            <div className="metric">
              <span>Throughput</span>
              <span className="value">12 t/s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="status-section">
        <h3 className="status-title">Hardware Acceleration</h3>
        <div className="status-card glass">
          <div className="card-header">
            <Activity size={20} className="icon-purple" />
            <span className="tier-name">Intel NPU Tier</span>
          </div>
          <div className="progress-container">
            <div className="progress-label">
              <span>NPU Load</span>
              <span>15%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '15%' }}></div>
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
          <div className="context-item">
            <Code size={16} />
            <span>frontend/App.tsx</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
