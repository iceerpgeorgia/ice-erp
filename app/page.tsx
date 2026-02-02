// app/page.tsx
"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();

  return (
    <main>
      <h1>Next.js + Postgres + Google Sign-In</h1>
      <p className="card">
        Status: <b>{status}</b>
      </p>

      {session ? (
        <div className="card">
          <p>Signed in as <b>{session.user?.email}</b></p>
          <p><Link href="/dictionaries/bank-transactions-test">Open Bank Transactions Test</Link></p>
          <p><Link href="/dictionaries">Open Dictionaries</Link></p>
          {session.user?.role === 'system_admin' && (
            <p><Link href="/admin/users">Manage Users (Admin)</Link></p>
          )}
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      ) : (
        <div className="card">
          <button onClick={() => signIn("google")}>Sign in with Google</button>
        </div>
      )}
    </main>
  );
}
