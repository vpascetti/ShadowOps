import React from 'react';
import '../styles/unified-header.css';

export default function UnifiedHeader({ 
  currentView, 
  onViewChange, 
  showSubtitle = false,
  subtitle = null 
}) {
  return (
    <header className="unified-header">
      <div className="unified-header__content">
        <div className="unified-header__title">
          <h1 className="unified-header__main-title">ShadowOps</h1>
          {showSubtitle && subtitle && (
            <p className="unified-header__subtitle">{subtitle}</p>
          )}
        </div>
        
        <nav className="unified-header__nav">
          <button
            className={`unified-header__nav-btn ${currentView === 'briefing' ? 'active' : ''}`}
            onClick={() => onViewChange('briefing')}
          >
            Executive Briefing
          </button>
          <button
            className={`unified-header__nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => onViewChange('dashboard')}
          >
            Operations Intelligence
          </button>
          <button
            className={`unified-header__nav-btn ${currentView === 'plant-pulse' ? 'active' : ''}`}
            onClick={() => onViewChange('plant-pulse')}
            title="View machine health & predictive maintenance"
          >
            Plant Pulse
          </button>
          <button
            className={`unified-header__nav-btn ${currentView === 'actions' ? 'active' : ''}`}
            onClick={() => onViewChange('actions')}
            title="View action items"
          >
            Action Items
          </button>
          <button
            className={`unified-header__nav-btn ${currentView === 'financial' ? 'active' : ''}`}
            onClick={() => onViewChange('financial')}
            title="View financial summary"
          >
            Financial Summary
          </button>
        </nav>
      </div>
    </header>
  );
}
