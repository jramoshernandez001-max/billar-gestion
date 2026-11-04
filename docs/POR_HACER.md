# Por hacer

Lista de mejoras acordadas que aún no se construyen. Se actualiza al terminar o agregar algo.

## Funcionalidades

1. **Resúmenes y gráficos**: utilidad por semana, ventas por producto y gastos. Hoy la pantalla muestra "Próximamente".
2. **Gastos**: registrar los gastos del negocio para incluirlos en los resúmenes.
3. **Stock mínimo**: definir un mínimo por producto y avisar cuando el stock quede por debajo. (No se agrega "tamaño del producto": se descartó.)

## Diseño

4. **Figma**: pantallas que se construyeron sin diseño (categoría del producto, filtro por categoría, bloque "Productos vendidos" y ventana de anulación). Mientras tanto, las pantallas hechas en código sirven de referencia. El servidor de Figma está limitado por el plan Starter.

## Tareas de Juan (después)

5. Agregar el correo de la segunda persona a `usuarios_autorizados` e instalar la PWA en los dos celulares.
6. Cargar el catálogo real y el inventario inicial (como compras con la fecha elegida).

## Operación

7. **Copias de seguridad automáticas** de Supabase: una Action programada en un repositorio privado con `pg_dump`; la cadena de conexión la guarda Juan como secreto de GitHub (nunca se comparte). Alternativa: copias diarias del plan Pro de Supabase.
8. **Dependabot**: revisar las alertas en la pestaña Security → Dependabot alerts y los PR semanales de actualización (`.github/dependabot.yml`).
