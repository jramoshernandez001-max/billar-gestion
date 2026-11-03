# Dudas pendientes de reglas de negocio

Reglas que no están definidas en `CLAUDE.md` ni en los datos privados del negocio. El código no las resuelve: donde hace falta, lanza un error claro en vez de suponer una respuesta. Cada una necesita la decisión del dueño.

## Compras (`src/domain/inventario/compras.ts`)

1. **Dos compras del mismo producto el mismo día.** Las fechas no tienen hora. Si el último día con compras tiene dos o más compras del mismo producto (por ejemplo, con costos distintos), ¿cuál es "la última compra"? ¿La registrada de último, un promedio ponderado de ese día u otra cosa? Hoy `ultimaCompraDe` lanza un error en ese caso.
