import Link from "next/link";

export default function MeetingNotFound() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <p className="text-sm text-slate-500">This meeting doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/meetings" className="mt-2 inline-block text-sm font-medium text-slate-700 hover:underline">
        Back to meetings
      </Link>
    </div>
  );
}
