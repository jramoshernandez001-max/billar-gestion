/**
 * Listado de ventas para la pantalla "Ventas".
 *
 * Qué hace: arma las tarjetas de las ventas de un día (con filtro por estado)
 * y el resumen de las vigentes: cuántas son, cuántas unidades y cuánto suman.
 * Cómo lo hace: numera todas las ventas por orden de registro (V-1, V-2…),
 * se queda con las del día, calcula el valor de cada renglón con el precio
 * cobrado guardado y cuenta unidades con el dominio; el resumen siempre es de
 * las vigentes del día, sin importar el filtro; ordena de la más reciente a
 * la más antigua y corta en el límite pedido.
 * Por qué: la pantalla solo dibuja este resultado. El número V-n no existe en
 * la base; como nada se borra, el orden de registro da un número estable.
 * El motivo de una anulación vive en la bitácora, por eso llega aparte.
 */
import { aUnidades } from '../domain/inventario/conversiones'
import { valorItem } from '../domain/ventas/valorVenta'
import type { EntradaBitacora } from '../datos/bitacora'
import type { VentaRegistrada } from '../datos/ventas'
import { fechaLocalIso, formatoPesos, horaLocal } from '../interfaz/formato'

/** Qué ventas listar. */
export type FiltroVentas = 'todas' | 'vigentes' | 'anuladas'

/** Nombre de cada producto por id. */
export type NombresProductos = ReadonlyMap<string, string>

/** Por qué y cuándo se anuló una venta (viene de la bitácora). */
export interface AnulacionVenta {
  motivo: string
  /** Día de la anulación, AAAA-MM-DD. */
  fecha: string
}

/** Un renglón listo para mostrar. */
export interface RenglonTarjeta {
  /** "Águila · Unidad × 10". */
  descripcion: string
  /** "$ 3.000 c/u · $ 30.000". */
  detalle: string
}

/** Una venta lista para mostrar. */
export interface TarjetaVenta {
  id: string
  /** "V-108". */
  numero: string
  /** "16:20". */
  hora: string
  estado: VentaRegistrada['estado']
  renglones: RenglonTarjeta[]
  total: number
  /** Solo en las anuladas con registro en la bitácora. */
  anulacion: AnulacionVenta | null
}

/** Lo que dibuja la pantalla. */
export interface ResumenVentas {
  /** Ventas vigentes del día. */
  vigentes: number
  /** Unidades vendidas en las vigentes del día. */
  unidades: number
  /** Valor de las vigentes del día. */
  total: number
  tarjetas: TarjetaVenta[]
  /** Ventas del día que cumplen el filtro (para "4 de 9 · Cargar más"). */
  totalMovimientos: number
}

/** Datos de entrada del resumen. */
export interface EntradaResumenVentas {
  ventas: readonly VentaRegistrada[]
  nombres: NombresProductos
  anulaciones: ReadonlyMap<string, AnulacionVenta>
  /** Día a listar, AAAA-MM-DD. */
  fecha: string
  filtro: FiltroVentas
  /** Máximo de tarjetas a devolver. */
  limite: number
}

const NOMBRE_PRESENTACION = { unidad: 'Unidad', sixpack: 'Sixpack', caja: 'Caja' } as const

/** Orden por momento de registro y, si empatan, por id (para que sea estable). */
function porRegistro(a: VentaRegistrada, b: VentaRegistrada): number {
  return a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id)
}

/** Valor de una venta: suma de cantidad por precio cobrado de cada renglón. */
function totalDe(venta: VentaRegistrada): number {
  return venta.renglones.reduce((suma, r) => suma + valorItem(r), 0)
}

/** Unidades físicas de una venta. */
function unidadesDe(venta: VentaRegistrada): number {
  return venta.renglones.reduce((suma, r) => suma + aUnidades(r.producto, r.presentacion, r.cantidad), 0)
}

/** Arma la tarjeta de una venta. */
function aTarjeta(
  venta: VentaRegistrada,
  numero: number,
  nombres: NombresProductos,
  anulaciones: ReadonlyMap<string, AnulacionVenta>,
): TarjetaVenta {
  return {
    id: venta.id,
    numero: `V-${numero}`,
    hora: horaLocal(venta.creadoEn),
    estado: venta.estado,
    renglones: venta.renglones.map((r) => ({
      descripcion: `${nombres.get(r.productoId) ?? 'Producto'} · ${NOMBRE_PRESENTACION[r.presentacion]} × ${r.cantidad}`,
      detalle: `${formatoPesos(r.precioCobrado ?? 0)} c/u · ${formatoPesos(valorItem(r))}`,
    })),
    total: totalDe(venta),
    anulacion: venta.estado === 'anulada' ? (anulaciones.get(venta.id) ?? null) : null,
  }
}

/** Resume las ventas de un día para la pantalla. */
export function resumirVentas(entrada: EntradaResumenVentas): ResumenVentas {
  const numeros = new Map([...entrada.ventas].sort(porRegistro).map((v, i) => [v.id, i + 1] as const))
  const delDia = entrada.ventas.filter((v) => v.fecha === entrada.fecha)
  const vigentes = delDia.filter((v) => v.estado === 'vigente')
  const mostradas = delDia
    .filter((v) => entrada.filtro === 'todas' || v.estado === (entrada.filtro === 'vigentes' ? 'vigente' : 'anulada'))
    .sort((a, b) => porRegistro(b, a))
  return {
    vigentes: vigentes.length,
    unidades: vigentes.reduce((suma, v) => suma + unidadesDe(v), 0),
    total: vigentes.reduce((suma, v) => suma + totalDe(v), 0),
    tarjetas: mostradas
      .slice(0, entrada.limite)
      .map((v) => aTarjeta(v, numeros.get(v.id) ?? 0, entrada.nombres, entrada.anulaciones)),
    totalMovimientos: mostradas.length,
  }
}

/**
 * Saca de la bitácora el motivo y el día de cada anulación de venta.
 *
 * Qué hace: devuelve un mapa venta → {motivo, fecha}.
 * Cómo lo hace: solo mira entradas "anular-registro" de la tabla ventas que
 * traigan registro y motivo; el día es el del reloj local.
 * Por qué: la base guarda el estado de la venta, pero el motivo vive en la
 * bitácora, escrito en la misma transacción que la anulación.
 */
export function anulacionesDeVentas(entradas: readonly EntradaBitacora[]): Map<string, AnulacionVenta> {
  const mapa = new Map<string, AnulacionVenta>()
  for (const e of entradas) {
    if (e.accion !== 'anular-registro' || e.tabla !== 'ventas' || e.registroId === null || e.motivo === null) continue
    mapa.set(e.registroId, { motivo: e.motivo, fecha: fechaLocalIso(new Date(e.momento)) })
  }
  return mapa
}
