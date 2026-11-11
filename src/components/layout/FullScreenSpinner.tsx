export function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="Carregando">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
