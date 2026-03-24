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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await api.post("/auth/login", form);
      login(response.data.token, response.data.user);
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to login.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Sign in to continue collaborating in real time.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={handleChange}
              placeholder="you@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              minLength={6}
              name="password"
              onChange={handleChange}
              placeholder="Your password"
              required
              type="password"
              value={form.password}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-btn" disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <p>
          New here? <Link to="/register">Create your account</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
