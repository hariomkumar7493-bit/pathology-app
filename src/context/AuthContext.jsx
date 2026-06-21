import { createContext, useContext, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('pathlab_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email, password) => {
    try {
      const response = await api.login(email, password);
      const userData = response.user || response;
      setUser(userData);
      localStorage.setItem('pathlab_user', JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Invalid email or password' };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await api.register(name, email, password);
      const userData = response.user || response;
      setUser(userData);
      localStorage.setItem('pathlab_user', JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pathlab_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
