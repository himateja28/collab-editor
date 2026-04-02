import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/auth/login", form);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to login.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page" id="login-page">
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-logo">✏️</div>
          <h1>Collab Ink</h1>
          <p>Real-time collaborative document editing. Write, review, and co-create with your team — all in one place.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to continue collaborating.</p>

          <form onSubmit={handleSubmit} className="auth-form" id="login-form">
            <div className="input-group">
              <label htmlFor="login-email">Email address</label>
              <input className="input-field" id="login-email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" value={form.email} onChange={handleChange} />
            </div>

            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <input className="input-field" id="login-password" name="password" type="password" placeholder="Enter your password" required minLength={6} autoComplete="current-password" value={form.password} onChange={handleChange} />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button className="btn btn-primary" disabled={submitting} type="submit" id="login-submit" style={{ width: "100%", padding: "12px" }}>
              {submitting ? <><span className="spinner" /> Signing in…</> : "Sign in"}
            </button>
          </form>

          <p className="auth-footer">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
