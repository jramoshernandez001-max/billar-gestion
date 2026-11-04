/**
 * Lista y detalle de deudas para las pantallas de Deudas.
 *
 * Qué hace: separa las deudas en pendientes, pagadas y anuladas, las filtra
 * por cliente, calcula saldo y abonado, y arma el detalle de una deuda con
 * sus abonos y qué acciones permite.
 * Cómo lo hace: parte de `resumirDeudas` (saldo a la fecha de hoy) y de las
 * reglas del dominio: una deuda con abonos vigentes no se anula y una pagada
 * o anulada no recibe abonos.
 * Por qué: el saldo no se guarda, se calcula; las pantallas solo dibujan.
 */
import type { Abono, Deuda } from '../domain/deudas/deudas'
import type { Anulacion } from './anulaciones'
import { resumirDeudas, type EstadoCobro } from './resumenDeudas'

export interface FilaListaDeuda {
  id: string
  cliente: string
  descripcion: string
  fecha: string
  monto: number
  saldo: number
  abonado: number
}

export interface ListaDeudas {
  filas: FilaListaDeuda[]
  /** Suma de los saldos de las filas mostradas (útil en pendientes). */
  total: number
  cuentas: number
  /** Cuántas deudas hay de cada estado (sin aplicar la búsqueda). */
  conteo: Record<EstadoCobro, number>
}

/** Minúsculas y sin tildes, para buscar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export function listarDeudasPorEstado(entrada: {
  deudas: readonly Deuda[]
  abonos: readonly Abono[]
  hoy: string
  estado: EstadoCobro
  busqueda: string
}): ListaDeudas {
  const { filas } = resumirDeudas(entrada.deudas, entrada.abonos, entrada.hoy)
  const conteo: Record<EstadoCobro, number> = { pendiente: 0, pagada: 0, anulada: 0 }
  for (const f of filas) conteo[f.estado] += 1
  const buscado = normalizar(entrada.busqueda)
  const elegidas = filas
    .filter((f) => f.estado === entrada.estado)
    .filter((f) => buscado === '' || normalizar(f.deuda.cliente).includes(buscado))
    .sort((a, b) => b.deuda.fecha.localeCompare(a.deuda.fecha))
    .map((f): FilaListaDeuda => ({
      id: f.deuda.id,
      cliente: f.deuda.cliente,
      descripcion: f.deuda.descripcion,
      fecha: f.deuda.fecha,
      monto: f.deuda.monto,
      saldo: f.saldo,
      abonado: f.deuda.monto - f.saldo,
    }))
  return { filas: elegidas, total: elegidas.reduce((s, f) => s + f.saldo, 0), cuentas: elegidas.length, conteo }
}

export interface DetalleDeuda extends FilaListaDeuda {
  estado: EstadoCobro
  abonos: Abono[]
  puedeAbonar: boolean
  puedeAnular: boolean
  anulacion: Anulacion | null
}

/** Detalle de una deuda; null si no existe. */
export function detalleDeuda(entrada: {
  deudas: readonly Deuda[]
  abonos: readonly Abono[]
  hoy: string
  deudaId: string
  anulaciones: ReadonlyMap<string, Anulacion>
}): DetalleDeuda | null {
  const { filas } = resumirDeudas(entrada.deudas, entrada.abonos, entrada.hoy)
  const fila = filas.find((f) => f.deuda.id === entrada.deudaId)
  if (fila === undefined) return null
  const tieneAbonosVigentes = fila.abonos.some((a) => a.estado === 'vigente')
  return {
    id: fila.deuda.id,
    cliente: fila.deuda.cliente,
    descripcion: fila.deuda.descripcion,
    fecha: fila.deuda.fecha,
    monto: fila.deuda.monto,
    saldo: fila.saldo,
    abonado: fila.deuda.monto - fila.saldo,
    estado: fila.estado,
    abonos: fila.abonos,
    puedeAbonar: fila.estado === 'pendiente',
    puedeAnular: fila.estado !== 'anulada' && !tieneAbonosVigentes,
    anulacion: fila.estado === 'anulada' ? (entrada.anulaciones.get(fila.deuda.id) ?? null) : null,
  }
}
