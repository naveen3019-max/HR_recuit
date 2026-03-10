import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "recruiter"
  });
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(form);
      } else {
        await login(form.email, form.password);
      }
    } catch (apiError) {
      setError(apiError?.response?.data?.message || "Authentication failed");
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>{isRegister ? "Create recruiter account" : "Welcome back"}</h1>
        {isRegister && (
          <input
            className="input"
            placeholder="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="Work email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        {isRegister && (
          <select
            className="input"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            <option value="recruiter">Recruiter</option>
            <option value="admin">Admin</option>
          </select>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn">
          {isRegister ? "Register" : "Login"}
        </button>
        <button
          type="button"
          className="btn btn-link"
          onClick={() => setIsRegister((prev) => !prev)}
        >
          {isRegister ? "Have an account? Login" : "Need an account? Register"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
