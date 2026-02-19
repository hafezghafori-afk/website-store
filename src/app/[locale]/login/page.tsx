import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Container } from "@/components/container";
import { isClerkEnabled } from "@/lib/clerk-config";

export default function LoginPage({ params }: { params: { locale: string } }) {
  const clerkEnabled = isClerkEnabled();

  if (!clerkEnabled) {
    redirect(`/${params.locale}/dashboard`);
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
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">You are already signed in.</p>
        </SignedIn>
      </div>
    </Container>
  );
}
