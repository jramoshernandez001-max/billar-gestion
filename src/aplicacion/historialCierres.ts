/**
 * Historial de cierres para la pantalla de cierres.
 *
 * Qué hace: arma una tarjeta por cierre con título, periodo, estado del
 * cuadre, dinero y si está desactualizado, del más reciente al más antiguo.
 * Cómo lo hace: lee el resultado con `describirCierre` y cruza los ids con la
 * lista de cierres desactualizados.
 * Por qué: saber cuál hay que recalcular es lo principal; un cierre nunca se
 * recalcula solo.
 */
import type { CierreLeido } from '../datos/cierres'
import { describirCierre, type EstadoCuadre } from './vistaCierre'

export type FiltroCierres = 'todos' | 'diario' | 'semanal'

export interface TarjetaCierre {
  id: string
  tipo: 'diario' | 'semanal'
  titulo: string
  desde: string
  hasta: string
  estado: EstadoCuadre
  monto: number
  dineroTotal: number
  desactualizado: boolean
}

export function resumirCierres(cierres: readonly CierreLeido[], desactualizados: readonly string[], filtro: FiltroCierres): TarjetaCierre[] {
  const marcados = new Set(desactualizados)
  return cierres
    .filter((c) => filtro === 'todos' || c.tipo === filtro)
    .sort((a, b) => b.hasta.localeCompare(a.hasta) || b.calculadoEn.localeCompare(a.calculadoEn))
    .map((c) => {
      const vista = describirCierre(c.tipo, c.resultado, { efectivo: c.efectivo, transferencias: c.transferencias }, new Map())
      return {
        id: c.id,
        tipo: c.tipo,
        titulo: c.tipo === 'diario' ? 'Cierre diario' : 'Cierre semanal',
        desde: c.desde,
        hasta: c.hasta,
        estado: vista.estado,
        monto: vista.monto,
        dineroTotal: vista.dineroTotal,
        desactualizado: marcados.has(c.id),
      }
    })
}
