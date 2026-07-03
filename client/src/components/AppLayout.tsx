import { NavLink, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>BTC Mega Indicator</h1>
          <p className="subtitle">Polymarket Decision Dashboard — BITSTAMP:BTCUSD</p>
        </div>
        <nav className="app-nav" aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/analysis"
            className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
          >
            Indicator Analysis
          </NavLink>
        </nav>
      </header>

      <Outlet />

      <footer className="footer">
        Data sourced from TradingView scanner API. For personal Polymarket decision support only. Not investment advice.
      </footer>
    </div>
  );
}
