import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Instead of reading a persisted token out
  // of localStorage (which any injected script could also read), ask the
  // backend to restore the session from the httpOnly cookie. The cookie
  // itself is never visible to this JavaScript — only the server can read
  // it and hand back a fresh in-memory token for this tab's lifetime.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await axios.get('/api/users/session', { withCredentials: true });
        const { user: restoredUser, token: restoredToken } = response.data?.data || {};

        if (restoredUser && restoredToken) {
          setUser(restoredUser);
          setToken(restoredToken);
        }
      } catch {
        // No valid session to restore — treat as logged out, no error needed.
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = (newToken, userData) => {
    // The token is kept ONLY in React state (memory) for this tab.
    // It is intentionally NOT written to localStorage/sessionStorage —
    // it disappears when the tab is closed or the page is hard-reloaded,
    // and gets safely re-established via /users/session
    // using the httpOnly cookie the backend already set at login time.
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await axios.post('/api/users/logout', {}, { withCredentials: true });
    } catch {
      // Even if the network call fails, still clear local state below.
    }
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    login,
    logout,
    loading,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;