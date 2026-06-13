"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { User } from "@/types/user";
import { setAuthToken } from "@/services/api";

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Restore user + token on refresh
  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    const storedToken = sessionStorage.getItem("_t");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    if (storedToken) {
      setAuthToken(storedToken);
    }
  }, []);

  const login = (userData: User) => {
    const { token, ...userWithoutToken } = userData as any;
    setUser(userWithoutToken);
    setAuthToken(token);
    sessionStorage.setItem("user", JSON.stringify(userWithoutToken));
    if (token) sessionStorage.setItem("_t", token);
    Cookies.set("token", token, { expires: 7 });
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("_t");
    Cookies.remove("token");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}