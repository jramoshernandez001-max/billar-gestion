/**
 * Pruebas de la carga de la bitácora con nombres de producto.
 *
 * Qué hace: verifica que se devuelvan las entradas y el mapa id → nombre.
 * Cómo lo hace: repositorios falsos con datos inventados.
 * Por qué: la lista y el detalle dependen de este mapa para nombrar productos.
 */
import { describe, it, expect } from 'vitest'
import { cargarBitacoraConNombres } from './cargarBitacora'

describe('cargarBitacoraConNombres', () => {
  it('devuelve las entradas y el nombre de cada producto por id', async () => {
    const r = await cargarBitacoraConNombres({
      bitacora: { listarBitacora: async () => [] },
      inventario: {
        listarProductos: async () => [
          { id: 'p1', nombre: 'Cerveza Ejemplo', categoria: 'cerveza', unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
        ],
      },
    })
    expect(r.entradas).toEqual([])
    expect(r.nombres.get('p1')).toBe('Cerveza Ejemplo')
  })
})
