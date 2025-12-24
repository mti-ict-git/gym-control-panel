import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Admin {
  id: string;
  username: string;
}

interface AuthContextType {
  admin: Admin | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedAdmin = localStorage.getItem('gym_admin');
    if (storedAdmin) {
      setAdmin(JSON.parse(storedAdmin));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Mock authentication - replace with real API call
    if (username === 'admin' && password === 'admin123') {
      const adminData = { id: '1', username };
      setAdmin(adminData);
      localStorage.setItem('gym_admin', JSON.stringify(adminData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem('gym_admin');
  };

  return (
    <AuthContext.Provider value={{ admin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
