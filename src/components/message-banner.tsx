export function MessageBanner({ error, message, warning }: { error?: string; message?: string; warning?: string }) {
  if (error) return <div className="banner error" role="alert">{error}</div>;
  if (warning) return <div className="banner warning" role="alert">{warning}</div>;
  if (message) return <div className="banner success" role="status">{message}</div>;
  return null;
}
