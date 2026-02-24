"use client";

import Link from "next/link";
import { SignOutButton, SignedIn, SignedOut } from "@clerk/nextjs";

type NavbarAuthControlsProps = {
  locale: string;
  clerkEnabled: boolean;
  showAdminLink: boolean;
  labels: {
    login: string;
    dashboard: string;
    admin: string;
    logout: string;
  };
};

export function NavbarAuthControls({ locale, clerkEnabled, showAdminLink, labels }: NavbarAuthControlsProps) {
  if (!clerkEnabled) {
    return (
      <Link href={`/${locale}/login`} className="secondary-btn text-sm">
        {labels.login}
      </Link>
    );
  }

  return (
    <>
      <SignedOut>
        <Link href={`/${locale}/login`} className="secondary-btn text-sm">
          {labels.login}
        </Link>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/dashboard`} className="secondary-btn text-sm">
            {labels.dashboard}
          </Link>
          {showAdminLink ? (
            <Link href={`/${locale}/admin`} className="secondary-btn hidden text-sm md:inline-flex">
              {labels.admin}
            </Link>
          ) : null}
          <SignOutButton redirectUrl={`/${locale}`}>
            <button type="button" className="secondary-btn text-sm">
              {labels.logout}
            </button>
          </SignOutButton>
        </div>
      </SignedIn>
    </>
  );
}
