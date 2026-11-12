/**
 * Pruebas del repositorio de ventas.
 *
 * Qué hace: verifica que registrar y anular ventas valide los datos, mande
 * los parámetros con los nombres de las funciones SQL y traduzca errores.
 * Cómo lo hace: usa el cliente falso compartido y compara con las migraciones.
 * Por qué: una venta mal armada descuadra inventario y cierres.
 */
import { describe, it, expect } from 'vitest'
import { crearRepositorioVentas } from './ventas'
import { clienteFalso, parametrosSql } from './apoyoPruebas'

const ID = '11111111-1111-1111-1111-111111111111'
const ID2 = '22222222-2222-2222-2222-222222222222'
const renglon = { productoId: ID2, presentacion: 'unidad' as const, cantidad: 2 }

describe('registrarVenta', () => {
  it('manda fecha y renglones con los nombres de la base y devuelve el id', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    const id = await crearRepositorioVentas(cliente).registrarVenta({
      fecha: '2026-11-03',
      renglones: [renglon, { ...renglon, presentacion: 'caja', cantidad: 1, precioCobrado: 55000 }],
    })
    expect(id).toBe(ID)
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('registrar_venta')
    expect(Object.keys(args)).toEqual(parametrosSql('registrar_venta'))
    expect(args.p_fecha).toBe('2026-11-03')
    expect(args.p_items).toEqual([
      { producto_id: ID2, presentacion: 'unidad', cantidad: 2 },
      { producto_id: ID2, presentacion: 'caja', cantidad: 1, precio_cobrado: 55000 },
    ])
  })

  it('ignora los renglones con cantidad cero', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    await crearRepositorioVentas(cliente).registrarVenta({
      fecha: '2026-11-03',
      renglones: [renglon, { ...renglon, cantidad: 0 }],
    })
    expect(rpc.mock.calls[0][1].p_items).toHaveLength(1)
  })

  it('rechaza una venta donde todos los renglones son cero o no hay renglones', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    const repo = crearRepositorioVentas(cliente)
    await expect(repo.registrarVenta({ fecha: '2026-11-03', renglones: [{ ...renglon, cantidad: 0 }] })).rejects.toThrow(/nada que registrar/i)
    await expect(repo.registrarVenta({ fecha: '2026-11-03', renglones: [] })).rejects.toThrow(/nada que registrar/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rechaza datos inválidos sin llamar a la base', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    const repo = crearRepositorioVentas(cliente)
    const venta = { fecha: '2026-11-03', renglones: [renglon] }
    await expect(repo.registrarVenta({ ...venta, fecha: '03/11/2026' })).rejects.toThrow()
    await expect(repo.registrarVenta({ ...venta, renglones: [{ ...renglon, productoId: ' ' }] })).rejects.toThrow(/producto/i)
    await expect(repo.registrarVenta({ ...venta, renglones: [{ ...renglon, presentacion: 'barril' as 'caja' }] })).rejects.toThrow(/presentación/i)
    await expect(repo.registrarVenta({ ...venta, renglones: [{ ...renglon, cantidad: -1 }] })).rejects.toThrow(/cantidad/i)
    await expect(repo.registrarVenta({ ...venta, renglones: [{ ...renglon, cantidad: 1.5 }] })).rejects.toThrow(/cantidad/i)
    await expect(repo.registrarVenta({ ...venta, renglones: [{ ...renglon, precioCobrado: -5 }] })).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propaga el mensaje de la base y valida la respuesta', async () => {
    const venta = { fecha: '2026-11-03', renglones: [renglon] }
    await expect(crearRepositorioVentas(clienteFalso({ error: 'No autorizado' }).cliente).registrarVenta(venta)).rejects.toThrow('No autorizado')
    await expect(crearRepositorioVentas(clienteFalso({ data: 5 }).cliente).registrarVenta(venta)).rejects.toThrow(/respuesta/i)
  })
})

describe('anularVenta', () => {
  it('manda id y motivo con los nombres de la base', async () => {
    const { cliente, rpc } = clienteFalso()
    await crearRepositorioVentas(cliente).anularVenta(ID, '  error de digitación ')
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('anular_venta')
    expect(Object.keys(args)).toEqual(parametrosSql('anular_venta'))
    expect(args).toEqual({ p_venta_id: ID, p_motivo: 'error de digitación' })
  })

  it('exige id y motivo, y propaga errores', async () => {
    const { cliente, rpc } = clienteFalso()
    const repo = crearRepositorioVentas(cliente)
    await expect(repo.anularVenta('', 'x')).rejects.toThrow(/venta/i)
    await expect(repo.anularVenta(ID, '  ')).rejects.toThrow(/motivo/i)
    expect(rpc).not.toHaveBeenCalled()
    await expect(crearRepositorioVentas(clienteFalso({ error: 'La venta ya está anulada' }).cliente).anularVenta(ID, 'x')).rejects.toThrow('ya está anulada')
  })
})

describe('listarVentas', () => {
  const productoFila = { id: ID2, unidades_por_caja: 24, maneja_sixpack: true, precio_unidad: 3000, precio_caja: 60000 }
  const ventaFila = { id: ID, fecha: '2026-11-03', estado: 'vigente', creado_en: '2026-11-03T21:20:00.123456+00:00' }
  const itemFila = { venta_id: ID, producto_id: ID2, presentacion: 'caja', cantidad: 1, precio_cobrado: 55000 }

  it('arma cada venta con sus renglones, el producto y el precio cobrado', async () => {
    const { cliente } = clienteFalso({}, {
      ventas: [ventaFila, { ...ventaFila, id: 'v2', estado: 'anulada' }],
      venta_items: [itemFila],
      productos: [productoFila],
    })
    const ventas = await crearRepositorioVentas(cliente).listarVentas()
    expect(ventas).toEqual([
      {
        id: ID,
        fecha: '2026-11-03',
        estado: 'vigente',
        creadoEn: '2026-11-03T21:20:00.123Z',
        renglones: [{
          productoId: ID2,
          producto: { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
          presentacion: 'caja',
          cantidad: 1,
          precioCobrado: 55000,
        }],
      },
      { id: 'v2', fecha: '2026-11-03', estado: 'anulada', creadoEn: '2026-11-03T21:20:00.123Z', renglones: [] },
    ])
  })

  it('falla con filas mal formadas o un producto inexistente', async () => {
    const base = { ventas: [ventaFila], venta_items: [itemFila], productos: [productoFila] }
    for (const tablas of [
      { ...base, ventas: [{ ...ventaFila, estado: 'x' }] },
      { ...base, ventas: [{ ...ventaFila, creado_en: 'ayer' }] },
      { ...base, venta_items: [{ ...itemFila, cantidad: 'dos' }] },
      { ...base, venta_items: [{ ...itemFila, producto_id: 'otro' }] },
      { ...base, productos: [{ id: ID2 }] },
    ]) {
      await expect(crearRepositorioVentas(clienteFalso({}, tablas).cliente).listarVentas()).rejects.toThrow()
    }
  })
})

describe('editarVenta', () => {
  it('manda la venta, la fecha, los renglones y el motivo con los nombres de la base y devuelve el id nuevo', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID2 })
    const id = await crearRepositorioVentas(cliente).editarVenta(ID, {
      fecha: '2026-11-03',
      renglones: [renglon, { ...renglon, cantidad: 0 }],
    }, 'Se contó mal')
    expect(id).toBe(ID2)
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('editar_venta')
    expect(Object.keys(args).sort()).toEqual([...parametrosSql('editar_venta')].sort())
    expect(args).toEqual({
      p_venta_id: ID,
      p_fecha: '2026-11-03',
      p_items: [{ producto_id: ID2, presentacion: 'unidad', cantidad: 2 }],
      p_motivo: 'Se contó mal',
    })
  })

  it('rechaza una venta corregida sin nada que registrar, sin llamar a la base', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID2 })
    await expect(
      crearRepositorioVentas(cliente).editarVenta(ID, { fecha: '2026-11-03', renglones: [{ ...renglon, cantidad: 0 }] }, 'x'),
    ).rejects.toThrow(/nada que registrar/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('exige el motivo', async () => {
    const { cliente } = clienteFalso({ data: ID2 })
    await expect(crearRepositorioVentas(cliente).editarVenta(ID, { fecha: '2026-11-03', renglones: [renglon] }, '  ')).rejects.toThrow()
  })
})
