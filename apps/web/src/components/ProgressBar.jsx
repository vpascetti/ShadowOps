/**
 * ProgressBar: Visual representation of job progress as a horizontal bar
 * value: number between 0 and 1 (0 = 0%, 1 = 100%)
 */
function ProgressBar({ value }) {
  const percentage = (value * 100).toFixed(0)
  
  return (
    <div className="progress-bar-container">
      <div
        className="progress-bar-fill"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export default ProgressBar
