import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuth from '../context/useAuth';
import './AuthPage.css';

function OAuthCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusMessage, setStatusMessage] = useState('Please wait while we complete your login.');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatusMessage('Authentication failed. Redirecting to login...');
      setTimeout(() => navigate('/auth'), 2000);
      return;
    }

    if (!code) {
      navigate('/auth');
      return;
    }

    const exchangeAuthorizationCode = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
        const response = await fetch(`${API_BASE.replace(/\/$/, '')}/auth/exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (response.ok && data.success && data.token && data.user) {
          login(data.token, data.user);
          // Redirect based on actual user role
          if (data.user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        } else {
          setStatusMessage(data.message || 'Authentication exchange failed.');
          setTimeout(() => navigate('/auth'), 2000);
        }
      } catch (err) {
        setStatusMessage('Network error during authentication exchange.');
        setTimeout(() => navigate('/auth'), 2000);
      }
    };

    exchangeAuthorizationCode();
  }, [searchParams, login, navigate]);

  return (
    <div className="auth-page">
      <div className="container">
        <div className="form-container">
          <div className="auth-form">
            <h1>Processing Authentication...</h1>
            <p>{statusMessage}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OAuthCallback;
