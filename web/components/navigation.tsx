import Link from 'next/link';

export function Navigation() {
  return (
    <nav className="nav-sub">
      <div className="nav-main">
        <Link className="nav-link" href="/">Dashboard</Link>
        <Link className="nav-link" href="/models">Models</Link>
        <Link className="nav-link" href="/performance">Performance</Link>
      </div>
      <div className="nav-admin">
        <Link className="nav-link" href="/admin">Admin</Link>
        <Link className="nav-link" href="/admin/data">Data</Link>
      </div>
    </nav>
  );
}
