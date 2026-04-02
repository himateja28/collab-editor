import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="topbar" id="main-topbar">
      <Link className="topbar-logo" to="/dashboard">
        <span className="topbar-logo-mark">CI</span>
        Collab Ink
      </Link>

      <nav className="topbar-nav">
        <Link to="/dashboard" className={isActive("/dashboard") ? "active" : ""}>
          Documents
        </Link>
      </nav>

      <div className="topbar-spacer" />

      <div className="topbar-right">
        <span className="user-pill">
          <span
            className="user-avatar"
            style={{ backgroundColor: user?.avatarColor || "#6366f1" }}
          >
            {(user?.name || "U").charAt(0).toUpperCase()}
          </span>
          {user?.name || "User"}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={handleLogout} type="button" id="logout-btn">
          Log out
        </button>
      </div>
    </header>
  );
};

export default Navbar;
