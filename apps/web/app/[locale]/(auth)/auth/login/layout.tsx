import { cookies } from "next/headers";

import { BetaSplash } from "./_components/beta-splash";

type Props = {
  children: React.ReactNode;
};

export default async function LoginLayout({ children }: Props) {
  const cookieStore = await cookies();
  // Skip the splash when resuming a pending 2FA challenge.
  const pendingTwoFactor = cookieStore
    .getAll()
    .some((cookie) => /(^|\.)two_factor$/.test(cookie.name));

  return (
    <>
      <BetaSplash skipSplash={pendingTwoFactor} />
      {children}
    </>
  );
}
