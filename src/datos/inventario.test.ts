/**
 * Pruebas del repositorio de inventario.
 *
 * Qué hace: verifica que cada operación valide sus datos antes de llamar a la
 * base, mande los parámetros con los nombres exactos de las funciones SQL,
 * convierta las respuestas a los tipos de la app y traduzca los errores.
 * Cómo lo hace: usa un cliente de datos falso que registra las llamadas, y
 * compara los nombres de parámetros con los de las migraciones.
 * Por qué: es la costura entre la app y la base de datos. Un nombre mal
 * escrito solo fallaría en producción; aquí falla en las pruebas.
 */
import { describe, it, expect, vi } from 'vitest'
import { crearRepositorioInventario } from './inventario'
import type { ClienteDatos } from './clienteDatos'

const ID = '11111111-1111-1111-1111-111111111111'
const ID2 = '22222222-2222-2222-2222-222222222222'

/** Migraciones como texto, para leer los parámetros de cada función. */
const migraciones = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const sql = Object.values(migraciones).join('\n').replace(/\r\n/g, '\n')

/** Nombres de parámetros de una función SQL, en orden. */
function parametrosSql(funcion: string): string[] {
  const definicion = sql.match(new RegExp(`create function public\\.${funcion}\\(([\\s\\S]*?)\\)\\s*returns`, 'i'))
  expect(definicion, `no se encontró la función ${funcion}`).not.toBeNull()
  return [...(definicion?.[1] ?? '').matchAll(/\bp_\w+/g)].map((m) => m[0])
}

/** Cliente falso: respuesta de rpc y filas por tabla configurables. */
function clienteFalso(respuesta: { data?: unknown; error?: string } = { data: ID }, filas: Record<string, unknown[]> = {}) {
  const rpc = vi.fn<ClienteDatos['rpc']>(async () => ({
    data: respuesta.data ?? null,
    error: respuesta.error ? { message: respuesta.error } : null,
  }))
  const cliente: ClienteDatos = {
    rpc,
    from: (tabla: string) => ({
      select: async () => ({ data: filas[tabla] ?? [], error: null }),
    }),
  }
  return { cliente, rpc }
}

const producto = {
  nombre: 'Cerveza Ejemplo',
  unidadesPorCaja: 24,
  manejaSixpack: true,
  precioUnidad: 3000,
  precioCaja: 60000,
}

describe('crearProducto y editarProducto', () => {
  it('llama a crear_producto con los parámetros de la función SQL y devuelve el id', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    expect(await crearRepositorioInventario(cliente).crearProducto(producto)).toBe(ID)
    const [nombre, argumentos] = rpc.mock.calls[0]
    expect(nombre).toBe('crear_producto')
    expect(Object.keys(argumentos).sort()).toEqual(parametrosSql('crear_producto').sort())
    expect(argumentos).toMatchObject({ p_nombre: 'Cerveza Ejemplo', p_unidades_por_caja: 24, p_maneja_sixpack: true })
  })

  it('llama a editar_producto con los parámetros de la función SQL', async () => {
    const { cliente, rpc } = clienteFalso({ data: null })
    await crearRepositorioInventario(cliente).editarProducto(ID, producto)
    const [nombre, argumentos] = rpc.mock.calls[0]
    expect(nombre).toBe('editar_producto')
    expect(Object.keys(argumentos).sort()).toEqual(parametrosSql('editar_producto').sort())
    expect(argumentos.p_producto_id).toBe(ID)
  })

  it('rechaza datos inválidos sin llamar a la base', async () => {
    const { cliente, rpc } = clienteFalso()
    const repo = crearRepositorioInventario(cliente)
    await expect(repo.crearProducto({ ...producto, nombre: '   ' })).rejects.toThrow(/nombre/i)
    await expect(repo.crearProducto({ ...producto, unidadesPorCaja: 0 })).rejects.toThrow(/unidades por caja/i)
    await expect(repo.crearProducto({ ...producto, unidadesPorCaja: 2.5 })).rejects.toThrow(/unidades por caja/i)
    await expect(repo.crearProducto({ ...producto, precioUnidad: -1 })).rejects.toThrow(/precio/i)
    await expect(repo.crearProducto({ ...producto, precioCaja: 1.5 })).rejects.toThrow(/precio/i)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('compras', () => {
  const compra = { productoId: ID, presentacion: 'caja' as const, cantidad: 2, costoTotal: 100000, fecha: '2026-11-02' }

  it('registrarCompra usa los parámetros de registrar_compra y devuelve el id', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID2 })
    expect(await crearRepositorioInventario(cliente).registrarCompra(compra)).toBe(ID2)
    const [nombre, argumentos] = rpc.mock.calls[0]
    expect(nombre).toBe('registrar_compra')
    expect(Object.keys(argumentos).sort()).toEqual(parametrosSql('registrar_compra').sort())
    expect(argumentos).toMatchObject({ p_presentacion: 'caja', p_cantidad: 2, p_costo_total: 100000, p_fecha: '2026-11-02' })
  })

  it('rechaza una compra inválida sin llamar a la base', async () => {
    const { cliente, rpc } = clienteFalso()
    const repo = crearRepositorioInventario(cliente)
    await expect(repo.registrarCompra({ ...compra, cantidad: 0 })).rejects.toThrow(/cantidad/i)
    await expect(repo.registrarCompra({ ...compra, cantidad: 1.5 })).rejects.toThrow(/cantidad/i)
    await expect(repo.registrarCompra({ ...compra, costoTotal: -5 })).rejects.toThrow(/costo/i)
    await expect(repo.registrarCompra({ ...compra, fecha: '02/11/2026' })).rejects.toThrow(/fecha/i)
    await expect(repo.registrarCompra({ ...compra, presentacion: 'docena' as never })).rejects.toThrow(/presentación/i)
    await expect(repo.registrarCompra({ ...compra, productoId: '' })).rejects.toThrow(/producto/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('corregirCostoCompra usa los parámetros de corregir_costo_compra', async () => {
    const { cliente, rpc } = clienteFalso({ data: null })
    await crearRepositorioInventario(cliente).corregirCostoCompra(ID, 110000)
    const [nombre, argumentos] = rpc.mock.calls[0]
    expect(nombre).toBe('corregir_costo_compra')
    expect(Object.keys(argumentos).sort()).toEqual(parametrosSql('corregir_costo_compra').sort())
  })

  it('anularCompra exige un motivo y usa los parámetros de anular_compra', async () => {
    const { cliente, rpc } = clienteFalso({ data: null })
    const repo = crearRepositorioInventario(cliente)
    await expect(repo.anularCompra(ID, '   ')).rejects.toThrow(/motivo/i)
    expect(rpc).not.toHaveBeenCalled()
    await repo.anularCompra(ID, '  compra mal hecha ')
    const [nombre, argumentos] = rpc.mock.calls[0]
    expect(nombre).toBe('anular_compra')
    expect(Object.keys(argumentos).sort()).toEqual(parametrosSql('anular_compra').sort())
    expect(argumentos.p_motivo).toBe('compra mal hecha')
  })
})

describe('traslados y ajustes', () => {
  it('registrarTraslado usa los parámetros de registrar_traslado y devuelve el aviso', async () => {
    const { cliente, rpc } = clienteFalso({ data: { traslado_id: ID2, suficiente: false, faltan: 5 } })
    const resultado = await crearRepositorioInventario(cliente).registrarTraslado(ID, 30)
    expect(resultado).toEqual({ trasladoId: ID2, suficiente: false, faltan: 5 })
    const [nombre, argumentos] = rpc.mock.calls[0]
    expect(nombre).toBe('registrar_traslado')
    expect(Object.keys(argumentos).sort()).toEqual(parametrosSql('registrar_traslado').sort())
  })

  it('rechaza un traslado de unidades no positivas o no enteras', async () => {
    const { cliente, rpc } = clienteFalso()
    const repo = crearRepositorioInventario(cliente)
    await expect(repo.registrarTraslado(ID, 0)).rejects.toThrow(/unidades/i)
    await expect(repo.registrarTraslado(ID, 2.5)).rejects.toThrow(/unidades/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rechaza una respuesta de traslado con forma inesperada', async () => {
    const { cliente } = clienteFalso({ data: { otra: 'cosa' } })
    await expect(crearRepositorioInventario(cliente).registrarTraslado(ID, 3)).rejects.toThrow(/respuesta/i)
  })

  it('registrarAjuste usa los parámetros de registrar_ajuste', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID2 })
    const id = await crearRepositorioInventario(cliente).registrarAjuste({
      productoId: ID,
      ubicacion: 'nevera',
      unidades: -2,
      motivo: ' conteo físico ',
    })
    expect(id).toBe(ID2)
    const [nombre, argumentos] = rpc.mock.calls[0]
    expect(nombre).toBe('registrar_ajuste')
    expect(Object.keys(argumentos).sort()).toEqual(parametrosSql('registrar_ajuste').sort())
    expect(argumentos.p_motivo).toBe('conteo físico')
  })

  it('rechaza un ajuste en cero, sin motivo o con una ubicación inválida', async () => {
    const { cliente, rpc } = clienteFalso()
    const repo = crearRepositorioInventario(cliente)
    const base = { productoId: ID, ubicacion: 'nevera' as const, unidades: 1, motivo: 'conteo' }
    await expect(repo.registrarAjuste({ ...base, unidades: 0 })).rejects.toThrow(/unidades/i)
    await expect(repo.registrarAjuste({ ...base, unidades: 1.5 })).rejects.toThrow(/unidades/i)
    await expect(repo.registrarAjuste({ ...base, motivo: '  ' })).rejects.toThrow(/motivo/i)
    await expect(repo.registrarAjuste({ ...base, ubicacion: 'patio' as never })).rejects.toThrow(/ubicación/i)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('errores de la base de datos', () => {
  it('muestra el mensaje de la base cuando una operación falla', async () => {
    const { cliente } = clienteFalso({ error: 'No autorizado: el correo de esta sesión no está en la lista' })
    await expect(
      crearRepositorioInventario(cliente).registrarCompra({
        productoId: ID,
        presentacion: 'caja',
        cantidad: 1,
        costoTotal: 1000,
        fecha: '2026-11-02',
      }),
    ).rejects.toThrow(/No autorizado/)
  })

  it('rechaza un id de respuesta que no es texto', async () => {
    const { cliente } = clienteFalso({ data: 42 })
    await expect(crearRepositorioInventario(cliente).crearProducto(producto)).rejects.toThrow(/respuesta/i)
  })
})

describe('lecturas', () => {
  it('listarProductos convierte las filas a productos de la app', async () => {
    const { cliente } = clienteFalso(
      {},
      {
        productos: [
          {
            id: ID,
            nombre: 'Cerveza Ejemplo',
            unidades_por_caja: 24,
            maneja_sixpack: true,
            precio_unidad: 3000,
            precio_caja: 60000,
          },
        ],
      },
    )
    expect(await crearRepositorioInventario(cliente).listarProductos()).toEqual([
      { id: ID, nombre: 'Cerveza Ejemplo', unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
    ])
  })

  it('listarProductos rechaza una fila con forma inesperada', async () => {
    const { cliente } = clienteFalso({}, { productos: [{ id: ID, nombre: 'x' }] })
    await expect(crearRepositorioInventario(cliente).listarProductos()).rejects.toThrow(/fila/i)
  })

  it('obtenerStock junta bodega y nevera por producto', async () => {
    const { cliente } = clienteFalso(
      {},
      {
        stock_actual: [
          { producto_id: ID, ubicacion: 'bodega', unidades: 48 },
          { producto_id: ID, ubicacion: 'nevera', unidades: 12 },
          { producto_id: ID2, ubicacion: 'nevera', unidades: -3 },
        ],
      },
    )
    const stock = await crearRepositorioInventario(cliente).obtenerStock()
    expect(stock.get(ID)).toEqual({ bodega: 48, nevera: 12, total: 60 })
    expect(stock.get(ID2)).toEqual({ bodega: 0, nevera: -3, total: -3 })
  })

  it('un error de lectura se muestra con su mensaje', async () => {
    const cliente: ClienteDatos = {
      rpc: async () => ({ data: null, error: null }),
      from: () => ({ select: async () => ({ data: null, error: { message: 'sin permisos' } }) }),
    }
    await expect(crearRepositorioInventario(cliente).listarProductos()).rejects.toThrow(/sin permisos/)
  })
})
