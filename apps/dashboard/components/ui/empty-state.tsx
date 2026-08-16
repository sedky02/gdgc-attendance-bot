export function EmptyState({ message }: { message: string }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{message}</p>;
}
