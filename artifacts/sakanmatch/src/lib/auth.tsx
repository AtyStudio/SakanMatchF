import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import type { UserResponse } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import "./fetch-interceptor"; // Ensure interceptor is loaded

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("sakanmatch_token"));
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isQueryLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  const isLoading = !!token && isQueryLoading;

  const logout = useCallback(() => {
    localStorage.removeItem("sakanmatch_token");
    setToken(null);
    queryClient.cancelQueries().then(() => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    });
    setLocation("/login");
  }, [queryClient, setLocation]);

  const login = useCallback((newToken: string, newUser: UserResponse) => {
    localStorage.setItem("sakanmatch_token", newToken);
    setToken(newToken);
    queryClient.setQueryData(["/api/auth/me"], newUser);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [queryClient]);

  // If token is invalid/expired (API returned an error), log out
  useEffect(() => {
    if (token && isError) {
      logout();
    }
  }, [token, isError, logout]);

  return (
    <AuthContext.Provider value={{ user: user || null, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
