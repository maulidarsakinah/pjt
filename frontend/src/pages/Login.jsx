import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../contexts/useAuth';
import { getMe, login, setSession } from '../services/api';
import './Login.css';

const STATIC_EMAIL = 'pjt@gmail.com';
const STATIC_PASSWORD = 'pjt123456';
const STATIC_ADMIN_EMAIL = 'admin@gmail.com';
const STATIC_ADMIN_PASSWORD = 'admin123456';

const STATIC_SESSION = {
  token: 'static-pjt-session-token',
  user: {
    id: 1,
    name: 'Operator PJT',
    email: STATIC_EMAIL,
    company_name: 'Jasa Tirta',
    roles: ['user-flowmeter'],
    is_demo: true,
  },
};

const STATIC_ADMIN_SESSION = {
  token: 'static-admin-session-token',
  user: {
    id: 99,
    name: 'Admin HydroTrack',
    email: STATIC_ADMIN_EMAIL,
    company_name: 'Jasa Tirta',
    roles: ['administrator'],
    role: 'Administrator',
    is_demo: true,
  },
};

function isAdminUser(user) {
  const roleText = [
    user?.role,
    user?.roles?.join(' '),
    user?.role_name,
  ].filter(Boolean).join(' ').toLowerCase();

  return roleText.includes('admin') || roleText.includes('administrator');
}

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { saveAuthSession } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (email.trim().toLowerCase() === STATIC_EMAIL && password === STATIC_PASSWORD) {
        saveAuthSession(STATIC_SESSION);
        navigate('/dashboard', { replace: true });
        return;
      }

      if (email.trim().toLowerCase() === STATIC_ADMIN_EMAIL && password === STATIC_ADMIN_PASSWORD) {
        saveAuthSession(STATIC_ADMIN_SESSION);
        navigate('/admin', { replace: true });
        return;
      }

      const response = await login(email, password);
      const token = response.token || response.access_token;

      if (!token) {
        throw new Error('Token login tidak ditemukan.');
      }

      setSession({ token, user: response.user || null });

      const profileResponse = await getMe();
      const user = profileResponse.data || response.user;

      saveAuthSession({ token, user });
      navigate(isAdminUser(user) ? '/admin' : '/dashboard', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Email atau password salah.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="left-panel">
        <div className="bg-circle"></div>
        <svg className="bg-waves" viewBox="0 0 1000 300" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 0 120 Q 250 20 500 120 T 1000 80 L 1000 300 L 0 300 Z" fill="rgba(255,255,255,0.03)" />
          <path d="M 0 180 Q 250 80 500 180 T 1000 140 L 1000 300 L 0 300 Z" fill="rgba(255,255,255,0.07)" />
          <path d="M 0 250 Q 250 180 500 250 T 1000 210 L 1000 300 L 0 300 Z" fill="rgba(255,255,255,0.1)" />
        </svg>

        <div className="brand">
          <i className="fa-solid fa-droplet"></i>
          <span>Hydro<b>Track</b></span>
        </div>

        <div className="hero-text">
          <h1>Monitoring Portal</h1>
          <p>Akses pemantauan data debit air dan hidrologi real-time terintegrasi.</p>
        </div>

        <div className="illustration-shell">
          <svg viewBox="0 0 800 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMax meet">
            <g className="panel panel-left" transform="translate(100, 80)" opacity="0.6">
              <rect width="220" height="160" rx="8" fill="#1e293b" stroke="#3A4BCF" strokeWidth="2"/>
              <rect x="15" y="15" width="190" height="25" rx="4" fill="#334155" />
              <rect x="15" y="55" width="190" height="15" rx="4" fill="#0f172a" />
              <rect x="15" y="80" width="190" height="15" rx="4" fill="#0f172a" />
              <rect x="15" y="105" width="190" height="15" rx="4" fill="#0f172a" />
            </g>

            <g className="panel panel-right" transform="translate(450, 70)" opacity="0.7">
              <rect width="200" height="160" rx="8" fill="#0f172a" stroke="#38bdf8" strokeWidth="2"/>
              <rect x="25" y="100" width="20" height="40" rx="3" fill="#3A4BCF" />
              <rect x="60" y="60" width="20" height="80" rx="3" fill="#10b981" />
              <rect x="95" y="30" width="20" height="110" rx="3" fill="#38bdf8" />
              <rect x="130" y="80" width="20" height="60" rx="3" fill="#fcd34d" />
            </g>

            <g className="panel panel-center" transform="translate(210, 130)">
              <path d="M 160 220 L 180 300 L 220 300 L 200 220 Z" fill="#94a3b8" />
              <rect x="140" y="300" width="120" height="10" rx="4" fill="#cbd5e1" />
              <rect x="0" y="0" width="380" height="230" rx="12" fill="#0f172a" />
              <rect x="12" y="12" width="356" height="206" rx="6" fill="#f8fafc" />
              <rect x="12" y="12" width="356" height="30" rx="4" fill="#e2e8f0" />
              <circle cx="30" cy="27" r="5" fill="#ef4444" />
              <circle cx="50" cy="27" r="5" fill="#f59e0b" />
              <circle cx="70" cy="27" r="5" fill="#10b981" />
              <rect x="30" y="60" width="90" height="40" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
              <rect x="140" y="60" width="90" height="40" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
              <rect x="250" y="60" width="90" height="40" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
              <path d="M 40 190 L 40 120" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M 40 190 L 340 190" stroke="#cbd5e1" strokeWidth="2" />
              <g className="chart-graphic">
                <path className="chart-area" d="M 40 190 L 40 170 Q 90 140 160 160 T 260 120 T 340 140 L 340 190 Z" fill="rgba(58, 75, 207, 0.15)" />
                <path className="chart-line" d="M 40 170 Q 90 140 160 160 T 260 120 T 340 140" fill="none" stroke="#3A4BCF" strokeWidth="4" strokeLinecap="round" />
                <circle className="chart-point chart-point-one" cx="160" cy="160" r="5" fill="#ffffff" stroke="#3A4BCF" strokeWidth="3" />
                <circle className="chart-point chart-point-two" cx="260" cy="120" r="5" fill="#ffffff" stroke="#3A4BCF" strokeWidth="3" />
              </g>
            </g>
          </svg>
        </div>
      </div>

      <div className="right-panel">
        <div className="login-container">
          <div className="login-header">
            <h2>Masuk</h2>
            <p>Gunakan akun yang sudah dibuat admin.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-at icon-left"></i>
                <input
                  type="email"
                  placeholder="name@jasatirta.co.id"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-lock icon-left"></i>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Masukkan password" 
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required 
                />
                <i 
                  className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'} icon-right`} 
                  onClick={() => setShowPassword(!showPassword)}
                ></i>
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="btn-login" disabled={isSubmitting}>
              {isSubmitting ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
