export function MessageBanner({ error, message }: { error?: string; message?: string }) {
  if (error) return <div className="banner error" role="alert">{error}</div>;
  if (message) return <div className="banner success" role="status">{message}</div>;
  return null;
}
