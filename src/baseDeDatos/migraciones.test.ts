/**
 * Pruebas de las migraciones SQL de la base de datos.
 *
 * Qué hace: revisa el texto de supabase/migrations para confirmar reglas de
 * seguridad y de coherencia con el dominio: la lista de acciones de la
 * bitácora es la misma de ACCIONES_BITACORA, todas las tablas tienen RLS
 * activada y forzada, no hay DELETE, anon no recibe nada, las funciones fijan
 * search_path y la vista de stock respeta RLS.
 * Cómo lo hace: carga los archivos .sql como texto con import.meta.glob de
 * Vite, les quita los comentarios y busca o descarta patrones.
 * Por qué: el proyecto no se conecta a Supabase en las pruebas, así que el
 * SQL no se ejecuta aquí. Estas revisiones atrapan un descuido (por ejemplo,
 * una tabla nueva sin RLS o una acción agregada solo en el código) antes de
 * que llegue a la base de datos real.
 */
import { describe, it, expect } from 'vitest'
import { ACCIONES_BITACORA } from '../domain/compartido/bitacora'

/** Archivos de migración por ruta, como texto. */
const archivos = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Quita los comentarios de línea (--) para no confundirlos con SQL. */
const sinComentarios = (sql: string): string => sql.replace(/--[^\n]*/g, '')

/** Todo el SQL de las migraciones, en orden, sin comentarios. */
const sql = Object.keys(archivos)
  .sort()
  .map((ruta) => sinComentarios(archivos[ruta]))
  .join('\n')

/** Sentencias separadas por punto y coma, en minúsculas. */
const sentencias = sql
  .split(';')
  .map((sentencia) => sentencia.trim().toLowerCase())
  .filter((sentencia) => sentencia.length > 0)

/** Nombres de las tablas creadas en el esquema public. */
const tablas = [...sql.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1])

describe('migraciones de la base de datos', () => {
  it('existen las cuatro migraciones, en orden', () => {
    expect(Object.keys(archivos).sort().map((ruta) => ruta.split('/').pop())).toEqual([
      '0001_tablas_base.sql',
      '0002_vista_stock_actual.sql',
      '0003_seguridad_rls.sql',
      '0004_operaciones_atomicas.sql',
    ])
  })

  it('la lista de acciones de la bitácora es la misma de ACCIONES_BITACORA', () => {
    const lista = sql.match(/accion text not null check \(accion in \(([\s\S]*?)\)\)/i)
    expect(lista).not.toBeNull()
    const acciones = [...(lista?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect([...acciones].sort()).toEqual([...ACCIONES_BITACORA].sort())
  })

  it('crea las diez tablas del esquema', () => {
    expect([...tablas].sort()).toEqual(
      [
        'usuarios_autorizados',
        'productos',
        'compras',
        'movimientos_inventario',
        'ventas',
        'venta_items',
        'deudas',
        'abonos_deuda',
        'cierres',
        'bitacora',
      ].sort(),
    )
  })

  it('compras, ventas, deudas y abonos tienen estado y no se pueden reactivar', () => {
    for (const tabla of ['compras', 'ventas', 'deudas', 'abonos_deuda']) {
      const definicion = sql.match(new RegExp(`create table public\\.${tabla} \\(([\\s\\S]*?)\\n\\);`, 'i'))
      expect(definicion?.[1]).toMatch(/estado text not null default 'vigente' check \(estado in \('vigente', 'anulada'\)\)/)
      expect(sql).toMatch(new RegExp(`before update of estado on public\\.${tabla}\\s+for each row execute function public\\.impedir_reactivar\\(\\)`, 'i'))
    }
  })

  it('un renglón de venta siempre tiene cantidad y unidades mayores a cero', () => {
    const definicion = sql.match(/create table public\.venta_items \(([\s\S]*?)\n\);/i)?.[1] ?? ''
    expect(definicion).toMatch(/cantidad integer not null check \(cantidad > 0\)/)
    expect(definicion).toMatch(/unidades integer not null check \(unidades > 0\)/)
  })

  it('un cierre guarda cuándo se corrigió su dinero contado', () => {
    const definicion = sql.match(/create table public\.cierres \(([\s\S]*?)\n\);/i)?.[1] ?? ''
    expect(definicion).toMatch(/dinero_corregido_en timestamptz/)
  })

  it('todas las tablas tienen RLS activada y forzada', () => {
    for (const tabla of tablas) {
      expect(sql).toContain(`alter table public.${tabla} enable row level security`)
      expect(sql).toContain(`alter table public.${tabla} force row level security`)
    }
  })

  it('ninguna política ni privilegio permite borrar', () => {
    const politicas = sentencias.filter((s) => s.startsWith('create policy'))
    expect(politicas.length).toBeGreaterThan(0)
    for (const politica of politicas) {
      expect(politica).not.toMatch(/\bfor\s+(delete|all)\b/)
    }
    for (const grant of sentencias.filter((s) => s.startsWith('grant'))) {
      expect(grant).not.toMatch(/\b(delete|truncate|all)\b/)
    }
  })

  it('el rol anon y public no reciben ningún privilegio ni política', () => {
    for (const grant of sentencias.filter((s) => s.startsWith('grant'))) {
      expect(grant).not.toMatch(/\bto\s+(anon|public)\b/)
    }
    for (const politica of sentencias.filter((s) => s.startsWith('create policy'))) {
      expect(politica).toMatch(/\bto\s+(authenticated|postgres)\b/)
    }
  })

  it('la bitácora no tiene privilegios de UPDATE y un disparador impide modificarla', () => {
    for (const grant of sentencias.filter((s) => s.startsWith('grant'))) {
      if (grant.includes('public.bitacora')) {
        expect(grant).not.toMatch(/\bupdate\b/)
      }
    }
    expect(sql).toMatch(/create trigger bitacora_sin_modificar before update on public\.bitacora/i)
  })

  it('todas las funciones fijan search_path y ninguna es SECURITY DEFINER', () => {
    const funciones = sql.split(/create function /i).slice(1)
    expect(funciones.length).toBeGreaterThan(0)
    for (const funcion of funciones) {
      expect(funcion).toMatch(/set search_path = ''/i)
      expect(funcion).not.toMatch(/security definer/i)
    }
  })

  it('la vista stock_actual respeta RLS con security_invoker', () => {
    expect(sql).toMatch(/create view public\.stock_actual\s+with \(security_invoker = true\)/i)
  })
})
