"use client";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@/i18n/navigation";

export default function Logout({
  children,
  className,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/auth/login"); // redirect to login page
        },
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(
        "cursor-pointer",
        disabled && "cursor-not-allowed",
        className,
      )}
    >
      {children}
    </button>
  );
}
