import { useState } from "react";
import type { User } from "@shared/schema";
import users from "@/config/users.json";

// We keep auth state in sessionStorage so:
// - It is shared across components/pages
// - It disappears when the browser is fully closed
// - Logout fully clears it

const STORAGE_KEY = "sessionUser";

function loadUserFromSession(): User | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  // Initial value is read from sessionStorage so all pages see same user
  const [user, setUser] = useState<User | null>(() => loadUserFromSession());

  const login = async (email: string, password: string, role: string) => {
    const foundUser = users.find(
      (u) =>
        u.active !== false &&                        // 👈 only active users
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password &&
        u.role === role
    );

    if (!foundUser) {
      return { success: false, message: "Invalid email, password, or role" };
    }

    const userObj: User = {
      id: Date.now().toString(),
      email: foundUser.email,
      firstName: foundUser.firstName,
      lastName: foundUser.lastName,
      role: foundUser.role,
      profileImageUrl: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save into sessionStorage so other pages / hooks see it
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
    } catch {
      // ignore
    }

    setUser(userObj);

    // Optionally tell backend about login (non-blocking)
    try {
      await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, role }),
      }).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true, message: "Login successful" };
  };

  const logout = async () => {
    // Clear frontend session
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);

    // Inform backend (clear session cookie if any)
    try {
      await fetch("/api/logout", {
        method: "GET", // your backend exposes GET /api/logout
        credentials: "include",
      }).catch(() => {});
    } catch {
      // ignore
    }

    // Always go back to landing page
window.location.href = "/";

  };

  const isAuthenticated = !!user;
  const isLoading = false;

  return { user, isAuthenticated, isLoading, login, logout };
}
