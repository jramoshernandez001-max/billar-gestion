/**
 * Pruebas de la carga de datos del inicio.
 *
 * Qué hace: verifica que se reúnan ventas, deudas, stock y cierres para armar
 * el resumen del inicio con sus avisos.
 * Cómo lo hace: repositorios falsos con datos inventados.
 * Por qué: el inicio junta cuatro fuentes; si una se conecta mal, el aviso
 * (deuda, stock negativo, cierre desactualizado) mostraría un número falso.
 */
import { describe, it, expect } from 'vitest'
import { cargarInicio } from './cargarInicio'
import type { ServiciosInicio } from './cargarInicio'

const producto = { categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }

function serviciosFalsos(): ServiciosInicio {
  return {
    ventas: {
      listarVentas: async () => [
        { id: 'v', fecha: '2026-11-03', estado: 'vigente', renglones: [{ productoId: 'p1', producto, presentacion: 'unidad', cantidad: 2, precioCobrado: 3000 }] },
      ],
    },
    deudas: {
      listarDeudas: async () => [
        { id: 'd1', cliente: 'Ana', fecha: '2026-11-01', monto: 50000, descripcion: 'Fiado', estado: 'vigente' },
        { id: 'd2', cliente: 'Beto', fecha: '2026-11-02', monto: 15000, descripcion: 'Fiado', estado: 'vigente' },
        { id: 'd3', cliente: 'Caro', fecha: '2026-11-02', monto: 9000, descripcion: 'Fiado', estado: 'vigente' },
      ],
      listarAbonos: async () => [{ id: 'a', deudaId: 'd3', fecha: '2026-11-03', monto: 9000, descripcion: 'Pagó', estado: 'vigente' }],
    },
    inventario: {
      listarProductos: async () => [
        { id: 'p1', nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
        { id: 'p2', nombre: 'Gaseosa Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 2000, precioCaja: 22000 },
      ],
      obtenerStock: async () => new Map([['p1', { bodega: 10, nevera: -2, total: 8 }], ['p2', { bodega: 5, nevera: 5, total: 10 }]]),
    },
    cierres: {
      listarCierres: async () => [
        { id: 'c1', tipo: 'diario', desde: '2026-11-02', hasta: '2026-11-02', calculadoEn: '2026-11-02T23:00:00.000Z', efectivo: 0, transferencias: 0, dineroCorregidoEn: null, costosManuales: {}, costosUsados: [], resultado: {} },
      ],
    },
    desactualizados: { idsDesactualizados: async () => ['c1'] },
  }
}

describe('cargarInicio', () => {
  it('reúne el resumen y los avisos', async () => {
    const datos = await cargarInicio(serviciosFalsos(), '2026-11-03')
    expect(datos.resumen.hoy).toEqual({ total: 6000, cantidadVentas: 1, unidades: 2 })
    expect(datos.resumen.ultimosDias).toHaveLength(7)
    // d1 debe 50000, d2 15000, d3 pagada → 65000 en 2 cuentas
    expect(datos.resumen.avisos).toEqual({ deudaPendiente: 65000, productosNegativos: 1, cierresDesactualizados: 1 })
    expect(datos.cuentasConDeuda).toBe(2)
    expect(datos.primerCierreDesactualizado).toEqual({ id: 'c1', tipo: 'diario', desde: '2026-11-02' })
  })

  it('sin cierres desactualizados no hay primer cierre', async () => {
    const servicios = serviciosFalsos()
    servicios.desactualizados = { idsDesactualizados: async () => [] }
    expect((await cargarInicio(servicios, '2026-11-03')).primerCierreDesactualizado).toBeNull()
  })

  it('si una fuente falla, el error llega a quien llama', async () => {
    const servicios = serviciosFalsos()
    servicios.ventas = { listarVentas: async () => { throw new Error('sin permisos') } }
    await expect(cargarInicio(servicios, '2026-11-03')).rejects.toThrow('sin permisos')
  })
})
