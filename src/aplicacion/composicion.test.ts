/**
 * Pruebas de la composición de servicios.
 *
 * Qué hace: verifica que, con un cliente de datos, se arme todo lo que la app
 * necesita (repositorios y servicio de cierres) y que quede conectado.
 * Cómo lo hace: un cliente falso que registra las llamadas; se ejecuta una
 * operación de cada repositorio para ver que llega a la base.
 * Por qué: es el único lugar donde se conectan las piezas de datos; un
 * cableado equivocado dejaría una pantalla hablando con la función incorrecta.
 */
import { describe, it, expect, vi } from 'vitest'
import { crearServicios } from './composicion'
import type { ClienteDatos } from '../datos/clienteDatos'

function clienteEspia() {
  const rpc = vi.fn<ClienteDatos['rpc']>(async () => ({ data: '11111111-1111-1111-1111-111111111111', error: null }))
  const leidas: string[] = []
  const cliente: ClienteDatos = {
    rpc,
    from: (tabla) => ({
      select: async () => {
        leidas.push(tabla)
        return { data: [], error: null }
      },
    }),
  }
  return { cliente, rpc, leidas }
}

describe('crearServicios', () => {
  it('arma los repositorios y el servicio de cierres sobre el mismo cliente', async () => {
    const { cliente, rpc, leidas } = clienteEspia()
    const s = crearServicios(cliente)
    await s.ventas.anularVenta('11111111-1111-1111-1111-111111111111', 'error')
    await s.deudas.anularDeuda('11111111-1111-1111-1111-111111111111', 'error')
    await s.inventario.anularCompra('11111111-1111-1111-1111-111111111111', 'error')
    await s.cierres.corregirDineroCierre('11111111-1111-1111-1111-111111111111', 0, 0)
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['anular_venta', 'anular_deuda', 'anular_compra', 'corregir_dinero_cierre'])
    await s.cierres.listarCierres()
    expect(leidas).toEqual(['cierres'])
  })

  it('el servicio de cierres usa los mismos repositorios', async () => {
    const { cliente, leidas } = clienteEspia()
    await expect(crearServicios(cliente).servicioCierres.recalcularCierre('x')).rejects.toThrow(/no existe/i)
    expect(leidas).toEqual(['cierres'])
  })

  it('el detector de desactualizados lee cierres y bitácora', async () => {
    const { cliente, leidas } = clienteEspia()
    expect(await crearServicios(cliente).desactualizados.idsDesactualizados()).toEqual([])
    expect(leidas.sort()).toEqual(['bitacora', 'cierres'])
  })
})
