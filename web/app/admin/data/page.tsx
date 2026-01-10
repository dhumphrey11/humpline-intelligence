import { getAdminDataOverview, getCurrentUser } from '../../../lib/api';
import { DataViewer } from '../../../components/data-viewer';

export default async function AdminDataPage() {
  const user = await getCurrentUser();
  const role = user?.role ?? 'guest';
  if (role !== 'admin') {
    return (
      <section className="grid">
        <div className="card">
          <div className="label">Admin Access</div>
          <div className="stat">Access denied</div>
          <p className="footer-note">Admin-only data explorer.</p>
        </div>
      </section>
    );
  }

  const data = await getAdminDataOverview();

  return (
    <section className="grid">
      <DataViewer
        candles={data?.recent_candles ?? []}
        signals={data?.recent_signals ?? []}
        trades={data?.recent_trades ?? []}
        portfolios={data?.recent_portfolios ?? []}
      />
    </section>
  );
}
