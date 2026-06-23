import * as runtime from "react/jsx-runtime";

/**
 * Renderiza MDX compilado por Velite. Es Server Component a propósito:
 * el `new Function(code)` se ejecuta en el servidor/SSG, NUNCA en el navegador,
 * por lo que no requiere 'unsafe-eval' en la CSP del cliente.
 */

const sharedComponents = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-primary underline underline-offset-4" {...props} />
  ),
};

function useMDXComponent(code: string) {
  const fn = new Function(code);
  return fn({ ...runtime }).default as React.ComponentType<{
    components?: Record<string, React.ComponentType>;
  }>;
}

export function MDXContent({ code }: { code: string }) {
  const Component = useMDXComponent(code);
  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert">
      <Component components={sharedComponents} />
    </div>
  );
}
