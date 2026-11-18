import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { takeNext } from "@/lib/nextPath";

/** After Google/Lovable sign-in returns to the homepage, continue to the page the visitor wanted. */
export default function PostLoginRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user || window.location.pathname !== "/") return;
    const next = takeNext();
    if (next) navigate(next, { replace: true });
  }, [user, navigate]);
  return null;
}
