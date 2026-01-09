interface MiniChartProps {
  points: number[];
  stroke?: string;
}

export function MiniChart({ points, stroke = '#1f6f78' }: MiniChartProps) {
  if (points.length === 0) {
    return null;
  }
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const span = points.length - 1 || 1;
  const path = points
    .map((point, index) => {
      const x = (index / span) * 100;
      const y = 100 - ((point - min) / range) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="chart" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}
