interface SignalBadgeProps {
  signal: string;
}

export function SignalBadge({ signal }: SignalBadgeProps) {
  const className = signal === 'BUY' ? 'badge green' : signal === 'SELL' ? 'badge' : 'badge';
  return <span className={className}>{signal}</span>;
}
