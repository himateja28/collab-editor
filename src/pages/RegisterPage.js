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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await api.post("/auth/register", form);
      login(response.data.token, response.data.user);
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to register.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>Create account</h1>
        <p>Start writing together with your team in seconds.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Full name
            <input
              name="name"
              onChange={handleChange}
              placeholder="Alex Johnson"
              required
              value={form.name}
            />
          </label>

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
              autoComplete="new-password"
              minLength={6}
              name="password"
              onChange={handleChange}
              placeholder="At least 6 characters"
              required
              type="password"
              value={form.password}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-btn" disabled={submitting} type="submit">
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
