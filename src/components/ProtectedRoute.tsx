"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Role } from "@/types/user";

interface Props {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === undefined) return;

    // Not logged in
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(false);
  }, [user, router]);

  if (loading) return null;

  if (!user) return null;

  // 🚀 Allow ADMIN everywhere (recommended)
  if (user.role === "ADMIN") {
    return <>{children}</>;
  }

  // Role restriction
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <h1 className="text-2xl font-bold">Access Denied</h1>
      </div>
    );
  }

  return <>{children}</>;
}
