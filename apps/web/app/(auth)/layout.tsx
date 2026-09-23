// Auth layout — a single centred card on the neutral canvas.
// No session check here — users must be able to reach /login unauthenticated.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[400px] rounded-3xl bg-surface p-8 shadow-[0_2px_20px_rgb(0_0_0/0.06)] ring-1 ring-hairline sm:p-10">
        {children}
      </div>
    </div>
  );
}
