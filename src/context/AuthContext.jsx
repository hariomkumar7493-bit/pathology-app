import { createContext, useContext, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('pathlab_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (phone, password) => {
    try {
      const response = await api.login(phone, password);
      const userData = response.user || response;
      setUser(userData);
      localStorage.setItem('pathlab_user', JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Invalid phone or password' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pathlab_user');
    api.logout();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
