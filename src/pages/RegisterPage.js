import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/auth/register", form);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to register.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page" id="register-page">
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-logo">🚀</div>
          <h1>Get Started</h1>
          <p>Join thousands of teams who collaborate, co-write, and ship faster together with Collab Ink.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Create account</h2>
          <p className="subtitle">Start writing together in seconds.</p>

          <form className="auth-form" id="register-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="register-name">Full name</label>
              <input className="input-field" id="register-name" name="name" placeholder="Alex Johnson" required value={form.name} onChange={handleChange} />
            </div>

            <div className="input-group">
              <label htmlFor="register-email">Email address</label>
              <input className="input-field" id="register-email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" value={form.email} onChange={handleChange} />
            </div>

            <div className="input-group">
              <label htmlFor="register-password">Password</label>
              <input className="input-field" id="register-password" name="password" type="password" placeholder="Min 6 characters" required minLength={6} autoComplete="new-password" value={form.password} onChange={handleChange} />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button className="btn btn-primary" disabled={submitting} type="submit" id="register-submit" style={{ width: "100%", padding: "12px" }}>
              {submitting ? <><span className="spinner" /> Creating account…</> : "Create account"}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
