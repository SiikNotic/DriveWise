import { Link } from "@/i18n/navigation";

/** The minimal centered shell shared by every unauthenticated auth screen. */
export function AuthChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        DriveWise
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
