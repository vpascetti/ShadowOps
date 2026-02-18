import React, { useState, useEffect } from 'react';
import MachineHealthPanel from './MachineHealthPanel';
import '../styles/plant-pulse.css';

export default function PlantPulse({ onBack }) {
  const [jobs, setJobs] = useState([]);
  const [realtimeData, setRealtimeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
    
    // Refresh every 60 seconds
    const interval = setInterval(() => {
      loadData();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load jobs and realtime data in parallel
      const [jobsRes, realtimeRes] = await Promise.all([
        fetch('/jobs'),
        fetch('/realtime/part-numbers')
      ]);

      if (!jobsRes.ok || !realtimeRes.ok) {
        throw new Error('Failed to load data');
      }

      const jobsData = await jobsRes.json();
      const realtimePayload = await realtimeRes.json();

      setJobs(Array.isArray(jobsData) ? jobsData : jobsData.data || []);
      setRealtimeData(Array.isArray(realtimePayload.data) ? realtimePayload.data : []);
      setLoading(false);
    } catch (err) {
      console.error('[PlantPulse] Error loading data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="plant-pulse">
        <div className="plant-pulse-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>Plant Pulse</h1>
          <p className="subtitle">Real-time Machine Health & Predictive Maintenance</p>
        </div>
        <div className="loading-message">Loading plant data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plant-pulse">
        <div className="plant-pulse-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>Plant Pulse</h1>
          <p className="subtitle">Real-time Machine Health & Predictive Maintenance</p>
        </div>
        <div className="error-message">
          Error loading data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="plant-pulse">
      <div className="plant-pulse-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>Plant Pulse</h1>
        <p className="subtitle">Real-time Machine Health & Predictive Maintenance</p>
        <div className="last-updated">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="plant-pulse-content">
        <MachineHealthPanel jobs={jobs} realtimeData={realtimeData} />
      </div>
    </div>
  );
}
