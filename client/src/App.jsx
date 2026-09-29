import Dashboard from "./Dashboard";
import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      setLoggedIn(true);
    }
  }, []);

  if (loggedIn) {
    return <Dashboard />;
  }

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setMessage("");
    setName("");
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const response = await axios.post(
          "http://localhost:5000/api/auth/login",
          {
            email,
            password,
          },
        );

        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        setLoggedIn(true);

        setMessage("Login successful!");
      } else {
        const response = await axios.post(
          "http://localhost:5000/api/auth/signup",
          {
            name,
            email,
            password,
          },
        );

        setMessage(response.data.message);
        setIsLogin(true);
        setName("");
        setPassword("");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="background-orb orb-one"></div>
      <div className="background-orb orb-two"></div>
      <div className="background-orb orb-three"></div>

      <div className="grid-background"></div>

      <div className="auth-layout">
        <section className="brand-section">
          <div className="brand-content">
            <div className="brand-logo">
              <span>✦</span>
            </div>

            <div className="brand-name">
              SEMANTIC<span>SEARCH</span>
            </div>

            <h1>
              Search by meaning.
              <br />
              <span>Find what matters.</span>
            </h1>

            <p className="brand-description">
              An intelligent knowledge discovery platform that understands what
              users mean, not just what they type.
            </p>

            <div className="feature-list">
              <div className="feature">
                <div className="feature-icon">⌁</div>
                <div>
                  <strong>Semantic Understanding</strong>
                  <p>Search beyond exact keywords</p>
                </div>
              </div>

              <div className="feature">
                <div className="feature-icon">◈</div>
                <div>
                  <strong>Knowledge Domains</strong>
                  <p>Organize information by domain</p>
                </div>
              </div>

              <div className="feature">
                <div className="feature-icon">◎</div>
                <div>
                  <strong>Intelligent Retrieval</strong>
                  <p>Discover relevant resources faster</p>
                </div>
              </div>
            </div>
          </div>

          <div className="floating-card card-one">
            <span>Meaning</span>
            <div className="mini-line"></div>
          </div>

          <div className="floating-card card-two">
            <span>Similarity</span>
            <strong>94.8%</strong>
          </div>

          <div className="floating-card card-three">
            <span>Relevant Result</span>
            <div className="result-dot"></div>
          </div>
        </section>

        <section className="form-section">
          <div className="auth-card">
            <div className="mobile-logo">
              <div className="brand-logo">
                <span>✦</span>
              </div>
            </div>

            <div className="form-header">
              <h2>{isLogin ? "Welcome back" : "Create account"}</h2>
              <p>
                {isLogin
                  ? "Sign in to continue to your knowledge workspace."
                  : "Start building your intelligent knowledge workspace."}
              </p>
            </div>

            <div className="auth-tabs">
              <button
                className={isLogin ? "active" : ""}
                onClick={() => switchMode(true)}
                type="button"
              >
                Sign In
              </button>

              <button
                className={!isLogin ? "active" : ""}
                onClick={() => switchMode(false)}
                type="button"
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off">
              {!isLogin && (
                <div className="input-group">
                  <label>Full Name</label>
                  <div className="input-wrapper">
                    <span>◯</span>
                    <input
                      type="text"
                      name="name"
                      autoComplete="off"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <span>✉</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="off"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <span>⌑</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {isLogin && (
                <div className="form-options">
                  <label className="remember">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>

                  <button type="button" className="forgot">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={loading}
              >
                <span>
                  {loading
                    ? "Please wait..."
                    : isLogin
                      ? "Sign In"
                      : "Create Account"}
                </span>
                {!loading && <span className="arrow">→</span>}
              </button>
            </form>

            {message && <div className="message">{message}</div>}

            <div className="auth-footer">
              {isLogin ? (
                <p>
                  Don't have an account?
                  <button type="button" onClick={() => switchMode(false)}>
                    Create one
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?
                  <button type="button" onClick={() => switchMode(true)}>
                    Sign in
                  </button>
                </p>
              )}
            </div>

            <div className="security-note">
              <span>◇</span>
              Secure authentication powered by JWT
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
