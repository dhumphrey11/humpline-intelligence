import Link from 'next/link';

export function Navigation() {
  return (
    <nav className="nav-sub">
      <div className="nav-main">
        <Link className="nav-link" href="/">Current Portfolio</Link>
        <Link className="nav-link" href="/models">Historical Models</Link>
        <Link className="nav-link" href="/transactions">Historical Transactions</Link>
        <Link className="nav-link" href="/monitoring">Performance Monitoring</Link>
      </div>
      <div className="nav-admin">
        <Link className="nav-link" href="/admin">Admin</Link>
        <Link className="nav-link" href="/admin/data">Data</Link>
      </div>
    </nav>
  );
}
