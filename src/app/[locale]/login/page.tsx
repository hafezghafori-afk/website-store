import { SignInButton, SignOutButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { Container } from "@/components/container";
import { isClerkEnabled } from "@/lib/clerk-config";

export default function LoginPage({ params }: { params: { locale: string } }) {
  const clerkEnabled = isClerkEnabled();

  if (!clerkEnabled) {
    return (
      <Container className="py-14">
        <div className="surface-card mx-auto max-w-lg space-y-4 p-6 text-center">
          <h1 className="text-2xl font-black">Authentication Disabled</h1>
          <p className="text-sm text-slate-600">
            Clerk keys are not configured for this environment. Please set valid Clerk keys in Vercel environment variables.
          </p>
          <div className="flex justify-center">
            <Link href={`/${params.locale}`} className="secondary-btn">
              Back To Home
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-14">
      <div className="surface-card mx-auto max-w-lg space-y-4 p-6 text-center">
        <h1 className="text-2xl font-black">Account Access</h1>
        <p className="text-sm text-slate-600">Use Clerk authentication to access orders and secure downloads.</p>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="primary-btn w-full">Login with Email / Google</button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="space-y-3">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">You are already signed in.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link href={`/${params.locale}/dashboard`} className="secondary-btn text-sm">
                Go To Dashboard
              </Link>
              <Link href={`/${params.locale}/admin`} className="secondary-btn text-sm">
                Open Admin
              </Link>
              <SignOutButton redirectUrl={`/${params.locale}/login`}>
                <button className="secondary-btn text-sm" type="button">
                  Logout
                </button>
              </SignOutButton>
            </div>
          </div>
        </SignedIn>
      </div>
    </Container>
  );
}
