type Props = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <div className="card p-8 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="muted mt-1 text-sm">{description}</p>
    </div>
  );
}
