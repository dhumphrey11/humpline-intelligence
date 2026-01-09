import Link from 'next/link';

export function Navigation() {
  return (
    <nav className="nav">
      <Link href="/">Current Portfolio</Link>
      <Link href="/models">Historical Models</Link>
      <Link href="/transactions">Historical Transactions</Link>
      <Link href="/monitoring">Performance Monitoring</Link>
      <Link href="/admin">Admin</Link>
    </nav>
  );
}
