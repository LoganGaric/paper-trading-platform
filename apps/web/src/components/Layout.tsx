import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps): JSX.Element => {
  return (
    <div>
      <header style={{ background: '#fff', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div className="container">
          <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <h1 style={{ margin: 0, color: '#333' }}>Paper Trading Platform</h1>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/order-ticket" style={{ textDecoration: 'none', color: '#007bff' }}>Order Ticket</Link>
              <Link to="/blotter" style={{ textDecoration: 'none', color: '#007bff' }}>Blotter</Link>
              <Link to="/fills" style={{ textDecoration: 'none', color: '#007bff' }}>Fills</Link>
              <Link to="/positions" style={{ textDecoration: 'none', color: '#007bff' }}>Positions</Link>
              <Link to="/account" style={{ textDecoration: 'none', color: '#007bff' }}>Account</Link>
              <Link to="/settings" style={{ textDecoration: 'none', color: '#007bff' }}>Settings</Link>
            </div>
          </nav>
        </div>
      </header>
      <main className="container">
        {children}
      </main>
    </div>
  );
};