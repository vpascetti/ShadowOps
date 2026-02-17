import '../styles/JobTimeline.css';

export default function JobTimeline({
  startDate,
  dueDate,
  asOfDate,
  projectedCompletionDate,
}) {
  // Calculate total duration in days
  const totalDays = Math.max(1, Math.floor((dueDate - startDate) / (1000 * 60 * 60 * 24)));

  // Helper function to calculate position percentage
  const getPositionPercent = (date) => {
    if (!date) return null;
    const daysSinceStart = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
    const percent = (daysSinceStart / totalDays) * 100;
    return Math.max(0, Math.min(100, percent));
  };

  const asOfDatePercent = getPositionPercent(asOfDate);
  const projectedCompletionPercent = getPositionPercent(projectedCompletionDate);

  return (
    <div className="job-timeline">
      <div className="timeline-track">
        {/* Background track with gradient */}
        <div className="timeline-background" />

        {/* asOfDate marker (current analysis point) */}
        {asOfDatePercent !== null && (
          <div
            className="timeline-marker timeline-marker-asof"
            style={{ left: `${asOfDatePercent}%` }}
            title="Analysis Date"
          >
            <span className="timeline-marker-label">today</span>
          </div>
        )}

        {/* Projected completion marker */}
        {projectedCompletionPercent !== null && (
          <div
            className="timeline-marker timeline-marker-projected"
            style={{ left: `${projectedCompletionPercent}%` }}
            title="Projected Completion"
          >
            <span className="timeline-marker-label">proj</span>
          </div>
        )}

        {/* Due date marker at the end */}
        <div
          className="timeline-marker timeline-marker-due"
          style={{ left: '100%' }}
          title="Due Date"
        >
          <span className="timeline-marker-label">due</span>
        </div>
      </div>
    </div>
  );
}
