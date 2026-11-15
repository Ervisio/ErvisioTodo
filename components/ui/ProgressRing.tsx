const RADIUS = 22,
  CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Done/total ring shown in the list header; the arc takes the theme accent. */
export function ProgressRing({
  done,
  total,
  label,
  caption,
}: {
  done: number;
  total: number;
  label: string;
  caption: string;
}) {
  const share = total ? Math.min(done / total, 1) : 0;
  return (
    <div className="progress-ring">
      <div className="progress-ring-dial" role="img" aria-label={label}>
        <svg viewBox="0 0 52 52" aria-hidden="true">
          <circle className="progress-track" cx="26" cy="26" r={RADIUS} />
          <circle
            className="progress-arc"
            cx="26"
            cy="26"
            r={RADIUS}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - share)}
            transform="rotate(-90 26 26)"
          />
        </svg>
        <span aria-hidden="true">
          {done}/{total}
        </span>
      </div>
      <span className="progress-caption">{caption}</span>
    </div>
  );
}
