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

/**
 * Prepara el texto de una migración para revisarlo.
 *
 * Qué hace: pasa los fines de línea a \n y quita los comentarios de línea.
 * Cómo lo hace: reemplaza \r\n por \n y borra todo desde -- hasta el fin de
 * la línea.
 * Por qué: en Windows, git puede guardar los archivos con \r\n
 * (core.autocrlf), y los patrones de las pruebas buscan \n; sin normalizar,
 * las pruebas fallarían según el equipo. Los comentarios se quitan para no
 * confundirlos con SQL.
 */
const sinComentarios = (sql: string): string => sql.replace(/\r\n/g, '\n').replace(/--[^\n]*/g, '')

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

/** Funciones creadas: nombre y texto completo de su definición. */
const funciones = sql
  .split(/create function /i)
  .slice(1)
  .map((parte) => ({
    nombre: parte.match(/^public\.(\w+)/i)?.[1] ?? '',
    texto: parte.split(/\n\$\$;/)[0],
  }))

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

  it('la descripción de deudas y abonos no acepta tabulaciones ni saltos de línea', () => {
    const dominio = sql.match(/create domain public\.descripcion_movimiento as text\s+check \(([\s\S]*?)\);/i)?.[1] ?? ''
    expect(dominio).toMatch(/value !~ '\[\\t\\n\\r\\f\\v\]'/)
  })

  it('normalizar_descripcion convierte cualquier grupo de blancos en un solo espacio', () => {
    const funcion = sql.match(/create function public\.normalizar_descripcion[\s\S]*?\$\$;/i)?.[0] ?? ''
    expect(funcion).toMatch(/regexp_replace\([^;]*'\\s\+', ' ', 'g'\)/)
  })

  it('las deudas y los abonos exigen un monto mayor a cero', () => {
    for (const tabla of ['deudas', 'abonos_deuda']) {
      const definicion = sql.match(new RegExp(`create table public\\.${tabla} \\(([\\s\\S]*?)\\n\\);`, 'i'))
      expect(definicion?.[1], tabla).toMatch(/monto bigint not null check \(monto > 0\)/)
    }
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

  it('ninguna tabla da INSERT, UPDATE ni DELETE a authenticated ni anon: solo SELECT', () => {
    const sobreTablas = sentencias.filter((s) => s.startsWith('grant') && !s.includes(' on function '))
    expect(sobreTablas.length).toBeGreaterThan(0)
    for (const grant of sobreTablas) {
      expect(grant).toMatch(/^grant select on public\.\w+ to authenticated$/)
    }
  })

  it('las políticas de authenticated son solo de lectura', () => {
    const deAuthenticated = sentencias.filter((s) => s.startsWith('create policy') && /\bto authenticated\b/.test(s))
    expect(deAuthenticated.length).toBe(tablas.length)
    for (const politica of deAuthenticated) {
      expect(politica).toMatch(/\bfor select to authenticated\b/)
    }
  })

  it('ninguna política permite borrar', () => {
    const politicas = sentencias.filter((s) => s.startsWith('create policy'))
    expect(politicas.length).toBeGreaterThan(0)
    for (const politica of politicas) {
      expect(politica).not.toMatch(/\bfor\s+(delete|all)\b/)
    }
  })

  it('el rol dueño de las funciones (postgres) tiene políticas explícitas para leer y agregar en cada tabla', () => {
    for (const tabla of tablas) {
      expect(sql).toMatch(new RegExp(`on public\\.${tabla} for select to postgres`, 'i'))
      expect(sql).toMatch(new RegExp(`on public\\.${tabla} for insert to postgres`, 'i'))
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

  it('la bitácora no tiene políticas de UPDATE y un disparador impide modificarla', () => {
    for (const politica of sentencias.filter((s) => s.startsWith('create policy'))) {
      if (politica.includes('on public.bitacora')) {
        expect(politica).not.toMatch(/\bfor update\b/)
      }
    }
    expect(sql).toMatch(/create trigger bitacora_sin_modificar before update on public\.bitacora/i)
  })

  it('los movimientos de inventario no se modifican: un error se compensa con otro movimiento', () => {
    // Ninguna función hace UPDATE sobre la tabla; el disparador frena también a postgres.
    expect(sql).toMatch(
      /create trigger movimientos_sin_modificar before update on public\.movimientos_inventario\s+for each row execute function public\.impedir_cambio\(\)/i,
    )
    expect(sql).not.toMatch(/update public\.movimientos_inventario/i)
  })

  it('todas las funciones fijan search_path vacío', () => {
    expect(funciones.length).toBeGreaterThan(0)
    for (const funcion of funciones) {
      expect(funcion.texto, funcion.nombre).toMatch(/set search_path = ''/i)
    }
  })

  it('todas las funciones tienen REVOKE a public y anon', () => {
    for (const funcion of funciones) {
      const revocada = sentencias.some(
        (s) =>
          s.startsWith(`revoke all on function public.${funcion.nombre}(`) &&
          /from public, anon\b/.test(s),
      )
      expect(revocada, funcion.nombre).toBe(true)
    }
  })

  it('es_usuario_autorizado es SECURITY DEFINER, devuelve solo un booleano y tiene dueño explícito', () => {
    const funcion = funciones.find((f) => f.nombre === 'es_usuario_autorizado')
    expect(funcion?.texto).toMatch(/returns boolean/i)
    expect(funcion?.texto).toMatch(/security definer/i)
    expect(sql).toMatch(/alter function public\.es_usuario_autorizado\(\) owner to postgres/i)
  })

  it('los usuarios autorizados pueden leer la lista completa de usuarios_autorizados', () => {
    expect(sql).toMatch(
      /on public\.usuarios_autorizados for select to authenticated\s+using \(\(select public\.es_usuario_autorizado\(\)\)\)/i,
    )
  })

  describe('funciones de escritura (SECURITY DEFINER)', () => {
    /** Las DEFINER, menos es_usuario_autorizado, que es la verificación misma. */
    const definer = funciones.filter(
      (f) => /security definer/i.test(f.texto) && f.nombre !== 'es_usuario_autorizado',
    )

    it('existe una función por cada operación de escritura', () => {
      expect(definer.map((f) => f.nombre).sort()).toEqual(
        [
          'crear_producto',
          'editar_producto',
          'registrar_compra',
          'corregir_costo_compra',
          'anular_compra',
          'registrar_traslado',
          'registrar_venta',
          'anular_venta',
          'registrar_ajuste',
          'registrar_deuda',
          'anular_deuda',
          'registrar_abono',
          'anular_abono',
          'guardar_cierre',
          'recalcular_cierre',
          'corregir_dinero_cierre',
        ].sort(),
      )
    })

    it('su primera instrucción verifica es_usuario_autorizado() y no hay nada que corra antes', () => {
      for (const funcion of definer) {
        const cuerpo = funcion.texto.split(/\nbegin\n/i)[1] ?? ''
        expect(cuerpo.trimStart(), funcion.nombre).toMatch(/^if not public\.es_usuario_autorizado\(\) then\s+raise exception/i)
        // En declare no se asigna nada: una asignación correría antes de la verificación.
        const declaracion = funcion.texto.split(/\nbegin\n/i)[0]
        expect(declaracion, funcion.nombre).not.toMatch(/:=/)
      }
    })

    it('fijan search_path vacío, tienen dueño postgres y solo authenticated las ejecuta', () => {
      for (const funcion of definer) {
        expect(funcion.texto, funcion.nombre).toMatch(/set search_path = ''/i)
        expect(sql, funcion.nombre).toMatch(new RegExp(`alter function public\\.${funcion.nombre}\\([^)]*\\) owner to postgres`, 'i'))
        expect(sql, funcion.nombre).toMatch(new RegExp(`grant execute on function public\\.${funcion.nombre}\\([^)]*\\) to authenticated`, 'i'))
      }
    })

    it('el usuario y creado_por salen del token, nunca de un parámetro', () => {
      for (const funcion of definer) {
        const parametros = funcion.texto.split(/\)\s*returns/i)[0]
        expect(parametros, funcion.nombre).not.toMatch(/p_(usuario|creado_por|correo)\b/i)
      }
      expect(sql).toMatch(/creado_por\s*=\s*auth\.uid\(\)|auth\.uid\(\)/)
    })

    it('registrar_abono bloquea la deuda y no deja pasar abonos de más', () => {
      const abono = definer.find((f) => f.nombre === 'registrar_abono')?.texto ?? ''
      expect(abono).toMatch(/from public\.deudas[\s\S]*for update/i)
      expect(abono).toMatch(/estado = 'vigente'/i)
      expect(abono).toMatch(/raise exception/i)
    })

    it('no puede haber dos productos con el mismo nombre (sin importar mayúsculas ni espacios)', () => {
      expect(sql).toMatch(/create unique index productos_nombre_unico\s+on public\.productos \(lower\(btrim\(nombre\)\)\)/i)
      for (const nombre of ['crear_producto', 'editar_producto']) {
        const texto = definer.find((f) => f.nombre === nombre)?.texto ?? ''
        expect(texto, nombre).toMatch(/Ya existe un producto llamado/i)
      }
    })

    it('corregir_costo_compra rechaza una compra anulada y no registra una corrección sin cambio', () => {
      const texto = definer.find((f) => f.nombre === 'corregir_costo_compra')?.texto ?? ''
      expect(texto).toMatch(/estado = 'anulada'[\s\S]*raise exception/i)
      expect(texto).toMatch(/costo_total = p_costo_nuevo then\s+return;/i)
    })

    it('corregir_dinero_cierre no registra una corrección que deja el mismo dinero', () => {
      const texto = definer.find((f) => f.nombre === 'corregir_dinero_cierre')?.texto ?? ''
      expect(texto).toMatch(/efectivo = p_efectivo and v_antes\.transferencias = p_transferencias then\s+return;/i)
    })

    it('registrar_venta ignora los renglones de cantidad cero', () => {
      const venta = definer.find((f) => f.nombre === 'registrar_venta')?.texto ?? ''
      expect(venta).toMatch(/= 0 then\s+continue/i)
    })
  })

  it('la vista stock_actual respeta RLS con security_invoker', () => {
    expect(sql).toMatch(/create view public\.stock_actual\s+with \(security_invoker = true\)/i)
  })
})
