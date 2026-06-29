# Agentes del proyecto — JYGASOFT Energy

Subagentes especializados para este CRM (Next.js 15 / React 19 / TS / Drizzle + Postgres).
Las definiciones son archivos `*.md` planos (formato Claude Code, auto-descubiertos).
Cada agente tiene su **memoria** en `memory/<agente>.md`: léela antes de actuar y
añade aprendizajes no obvios al terminar.

| Agente | Para qué |
|--------|----------|
| planner | Planificar features/refactors complejos |
| architect | Diseño de sistema y contratos |
| typescript-reviewer | Revisión de código TS/React |
| security-reviewer | Seguridad (foco: compartimentación por vendedor) |
| database-reviewer | Migraciones/esquema/consultas Postgres |
| build-error-resolver | Arreglar fallos de build/typecheck |
| tdd-guide | Test-first (Vitest/Playwright) |
| e2e-runner | E2E de flujos críticos |
| refactor-cleaner | Código muerto / consolidación |
| doc-updater | Docs y CHANGELOG de BD |
