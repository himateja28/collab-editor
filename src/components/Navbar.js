import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="topbar">
      <Link className="logo" to="/dashboard">
        Collab Ink
      </Link>
      <div className="topbar-right">
        <span className="user-chip">
          <span
            className="avatar-dot"
            style={{ backgroundColor: user?.avatarColor || "#0f766e" }}
          />
          {user?.name || "User"}
        </span>
        <button className="ghost-btn" onClick={handleLogout} type="button">
          Log out
        </button>
      </div>
    </header>
  );
};

export default Navbar;
