export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-prose text-muted-foreground">{description}</p>
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Módulo en construcción. La capa de datos (Drizzle + esquema) ya existe;
        falta la UI de listado/detalle y sus acciones.
      </div>
    </div>
  );
}
