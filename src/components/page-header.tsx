export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy"><span className="page-kicker">Workforce workspace</span><h1>{title}</h1><p>{description}</p></div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}
