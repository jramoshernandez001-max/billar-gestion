/**
 * Resumen de la bitácora para sus pantallas.
 *
 * Qué hace: da a cada entrada un título en español y un grupo (ventas,
 * compras, inventario, deudas, cierres, productos), filtra por grupo y
 * usuario, ordena del más reciente al más antiguo, pagina, y compara el
 * "antes" y el "después" de un registro con nombres y valores legibles.
 * Cómo lo hace: tablas de traducción fijas; la comparación omite ids y marcas
 * internas y solo muestra lo que cambió (o todo el registro si es nuevo).
 * Por qué: la bitácora guarda JSON con nombres de columnas de la base; la
 * persona necesita leer "Costo total: $ 96.000 → $ 100.000", no `costo_total`.
 */
import type { EntradaBitacora } from '../datos/bitacora'
import type { AccionBitacora } from '../domain/compartido/bitacora'
import { formatoPesos } from '../interfaz/formato'
import { fraseDe, type ProductoBitacora } from './frasesBitacora'

export type GrupoBitacora = 'todos' | 'ventas' | 'compras' | 'inventario' | 'deudas' | 'cierres' | 'productos'

const TITULOS: Record<AccionBitacora, string> = {
  'registrar-compra': 'Compra registrada',
  'corregir-costo-compra': 'Costo de compra corregido',
  'registrar-traslado': 'Traslado registrado',
  'registrar-ajuste': 'Ajuste de inventario',
  'registrar-venta': 'Venta registrada',
  'registrar-cierre-diario': 'Cierre diario registrado',
  'registrar-cierre-semanal': 'Cierre semanal registrado',
  'corregir-dinero-cierre': 'Dinero de cierre corregido',
  'registrar-deuda': 'Deuda registrada',
  'registrar-abono': 'Abono registrado',
  'cambiar-precio': 'Precio cambiado',
  'crear-producto': 'Producto creado',
  'editar-producto': 'Producto editado',
  'anular-registro': 'Registro anulado',
  'recalcular-cierre-diario': 'Cierre diario recalculado',
  'recalcular-cierre-semanal': 'Cierre semanal recalculado',
}

/** Título de "anular-registro" según la tabla del registro. */
const ANULADOS: Record<string, string> = {
  ventas: 'Venta anulada',
  compras: 'Compra anulada',
  deudas: 'Deuda anulada',
  abonos_deuda: 'Abono anulado',
}

const GRUPO_POR_TABLA: Record<string, GrupoBitacora> = {
  ventas: 'ventas',
  compras: 'compras',
  deudas: 'deudas',
  abonos_deuda: 'deudas',
  cierres: 'cierres',
  productos: 'productos',
  movimientos_inventario: 'inventario',
}

const GRUPO_POR_ACCION: Partial<Record<AccionBitacora, GrupoBitacora>> = {
  'registrar-compra': 'compras',
  'corregir-costo-compra': 'compras',
  'registrar-traslado': 'inventario',
  'registrar-ajuste': 'inventario',
  'registrar-venta': 'ventas',
  'registrar-cierre-diario': 'cierres',
  'registrar-cierre-semanal': 'cierres',
  'corregir-dinero-cierre': 'cierres',
  'recalcular-cierre-diario': 'cierres',
  'recalcular-cierre-semanal': 'cierres',
  'registrar-deuda': 'deudas',
  'registrar-abono': 'deudas',
  'cambiar-precio': 'productos',
  'crear-producto': 'productos',
  'editar-producto': 'productos',
}

export function tituloDe(entrada: EntradaBitacora): string {
  if (entrada.accion === 'anular-registro') return ANULADOS[entrada.tabla ?? ''] ?? TITULOS['anular-registro']
  return TITULOS[entrada.accion]
}

export function grupoDe(entrada: EntradaBitacora): GrupoBitacora {
  return GRUPO_POR_ACCION[entrada.accion] ?? GRUPO_POR_TABLA[entrada.tabla ?? ''] ?? 'todos'
}

export interface TarjetaBitacora {
  id: string
  titulo: string
  /** Lo que pasó contado en una frase; undefined si la acción no tiene frase. */
  frase: string | undefined
  /** Sección y registro afectado, p. ej. "Compras · Águila · C-007". */
  donde: string
  /** Lo que cambió, campo por campo, con antes y después. */
  cambios: CambioBitacora[]
  usuario: string
  /** ISO UTC; la pantalla la muestra en hora local. */
  momento: string
  motivo: string | null
}

export function resumirBitacora(entrada: {
  entradas: readonly EntradaBitacora[]
  grupo: GrupoBitacora
  usuario: string | null
  limite: number
  /** Nombre de cada producto por id, para decir dónde fue el cambio. */
  nombres?: ReadonlyMap<string, string>
  /** Datos de cada producto por id, para contar en cajas o botellas. */
  productos?: ReadonlyMap<string, ProductoBitacora>
}): { tarjetas: TarjetaBitacora[]; total: number; usuarios: string[] } {
  const nombres = entrada.nombres ?? new Map<string, string>()
  const usuarios = [...new Set(entrada.entradas.map((e) => e.usuario))].sort()
  const filtradas = entrada.entradas
    .filter((e) => entrada.grupo === 'todos' || grupoDe(e) === entrada.grupo)
    .filter((e) => entrada.usuario === null || e.usuario === entrada.usuario)
    .sort((a, b) => b.momento.localeCompare(a.momento))
  return {
    total: filtradas.length,
    usuarios,
    tarjetas: filtradas.slice(0, entrada.limite).map((e) => ({
      id: e.id,
      titulo: tituloDe(e),
      frase: fraseDe(e, entrada.productos),
      donde: dondeDe(e, nombres),
      cambios: comparar(e.antes, e.despues, nombres),
      usuario: e.usuario,
      momento: e.momento,
      motivo: e.motivo,
    })),
  }
}

/** Campos internos que no se muestran. */
// Los cálculos guardados de un cierre (resultado, costos) son JSON interno:
// el cambio que importa se ve en el dinero y en el periodo.
const OCULTOS = new Set([
  'id', 'creado_en', 'creado_por', 'producto_id', 'compra_id', 'venta_id', 'deuda_id', 'compensa_a', 'traslado_id',
  'resultado', 'costos_usados', 'costos_manuales', 'calculado_en', 'dinero_corregido_en',
])
const ES_DINERO = new Set(['costo_total', 'monto', 'efectivo', 'transferencias', 'precio_unidad', 'precio_caja', 'precio_cobrado', 'total'])
const NOMBRES: Record<string, string> = {
  costo_total: 'Costo total',
  maneja_sixpack: 'Maneja sixpack',
  unidades_por_caja: 'Unidades por caja',
  precio_unidad: 'Precio de la unidad',
  precio_caja: 'Precio de la caja',
}

export interface CambioBitacora {
  campo: string
  antes: string
  despues: string
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function nombreDeCampo(clave: string): string {
  return NOMBRES[clave] ?? mayuscula(clave.replace(/_/g, ' '))
}

/** Texto de un id de producto: su nombre, o "producto" si ya no se conoce. */
function nombreDeProducto(id: unknown, nombres: ReadonlyMap<string, string>): string | undefined {
  return typeof id === 'string' ? nombres.get(id) : undefined
}

/**
 * Describe los renglones de una venta.
 *
 * Qué hace: devuelve "2 × caja Águila, 3 × unidad Poker".
 * Cómo lo hace: toma cantidad, presentación y el nombre de cada producto.
 * Por qué: la bitácora guarda los renglones como JSON con ids; así se lee
 * qué se vendió sin abrir la venta.
 */
function textoDeRenglones(renglones: unknown[], nombres: ReadonlyMap<string, string>): string {
  return renglones
    .map((r) => {
      const fila = (r ?? {}) as Record<string, unknown>
      const producto = nombreDeProducto(fila.producto_id, nombres) ?? 'producto'
      return `${String(fila.cantidad ?? '?')} × ${String(fila.presentacion ?? '')} ${producto}`.replace(/\s+/g, ' ')
    })
    .join(', ')
}

function textoDeValor(clave: string, valor: unknown, nombres: ReadonlyMap<string, string>): string {
  if (valor === null || valor === undefined) return '—'
  if (clave === 'renglones' && Array.isArray(valor)) return textoDeRenglones(valor, nombres)
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'number') return ES_DINERO.has(clave) ? formatoPesos(valor) : String(valor)
  if (typeof valor === 'string') return clave === 'estado' ? mayuscula(valor) : valor
  return JSON.stringify(valor)
}

/**
 * Compara el antes y el después de un registro.
 *
 * Qué hace: devuelve, campo por campo, cómo estaba y cómo quedó; si el
 * registro es nuevo (sin antes), todos sus campos con antes "—".
 * Cómo lo hace: omite ids y datos internos, salta los campos iguales y pasa
 * cada valor a texto legible (pesos, Sí/No, renglones con nombres).
 * Por qué: la persona necesita ver qué cambió sin buscar la diferencia a ojo.
 */
export function comparar(
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown>,
  nombres: ReadonlyMap<string, string> = new Map(),
): CambioBitacora[] {
  const claves = Object.keys(despues).filter((k) => !OCULTOS.has(k))
  const cambios: CambioBitacora[] = []
  for (const clave of claves) {
    const valorAntes = antes === null ? undefined : antes[clave]
    if (antes !== null && JSON.stringify(valorAntes) === JSON.stringify(despues[clave])) continue
    cambios.push({
      campo: nombreDeCampo(clave),
      antes: textoDeValor(clave, valorAntes, nombres),
      despues: textoDeValor(clave, despues[clave], nombres),
    })
  }
  return cambios
}

const SECCIONES: Record<Exclude<GrupoBitacora, 'todos'>, string> = {
  ventas: 'Ventas',
  compras: 'Compras',
  inventario: 'Inventario',
  deudas: 'Deudas',
  cierres: 'Cierres',
  productos: 'Productos',
}

/** Texto si el valor es un texto no vacío; si no, undefined. */
const texto = (valor: unknown): string | undefined => (typeof valor === 'string' && valor.trim() !== '' ? valor : undefined)

/** Número de compra con el formato de la app (7 → "C-007"). */
const numeroCompra = (valor: unknown): string | undefined =>
  typeof valor === 'number' ? `C-${String(valor).padStart(3, '0')}` : undefined

/**
 * Detalle del registro afectado, según la tabla o la acción.
 *
 * Qué hace: devuelve las partes que dicen exactamente qué registro cambió.
 * Cómo lo hace: lee del "después" (o del "antes" si falta) los datos que
 * identifican el registro: producto, número de compra, ubicación, fecha,
 * cliente o periodo del cierre.
 * Por qué: cada tabla se identifica distinto; una sola función lo concentra.
 */
function detalleDe(entrada: EntradaBitacora, nombres: ReadonlyMap<string, string>): (string | undefined)[] {
  const r = { ...(entrada.antes ?? {}), ...entrada.despues }
  const producto = nombreDeProducto(r.producto_id, nombres)
  if (entrada.accion === 'registrar-traslado') return [producto, 'Bodega → Nevera']
  if (entrada.accion === 'registrar-ajuste') return [producto, texto(r.ubicacion) && mayuscula(String(r.ubicacion))]
  switch (entrada.tabla) {
    case 'productos':
      return [texto(r.nombre) ?? producto]
    case 'compras':
      return [producto, numeroCompra(r.numero)]
    case 'ventas': {
      const renglones = Array.isArray(r.renglones) ? r.renglones : []
      const vendidos = [...new Set(renglones.map((x) => nombreDeProducto((x as Record<string, unknown>)?.producto_id, nombres)))]
      return [texto(r.fecha), vendidos.filter((n) => n !== undefined).join(', ') || undefined]
    }
    case 'deudas':
      return [texto(r.cliente)]
    case 'abonos_deuda':
      return ['Abono']
    case 'cierres': {
      const tipo = r.tipo === 'diario' ? 'Diario' : r.tipo === 'semanal' ? 'Semanal' : undefined
      const desde = texto(r.desde)
      const hasta = texto(r.hasta)
      const periodo = desde === undefined ? undefined : hasta === undefined || hasta === desde ? desde : `${desde} a ${hasta}`
      return [[tipo, periodo].filter(Boolean).join(' ') || undefined]
    }
    default:
      return [producto]
  }
}

/**
 * Dónde ocurrió un cambio de la bitácora.
 *
 * Qué hace: devuelve la sección y el registro afectado, separados por " · ",
 * p. ej. "Compras · Águila · C-007" o "Inventario · Poker · Bodega → Nevera".
 * Cómo lo hace: la sección sale del grupo de la entrada y el detalle de los
 * datos del registro; lo que no se conoce (un producto sin nombre) se omite.
 * Por qué: el título dice qué pasó, pero no a qué producto, venta o deuda;
 * sin esto había que abrir cada entrada para saberlo.
 */
export function dondeDe(entrada: EntradaBitacora, nombres: ReadonlyMap<string, string> = new Map()): string {
  const grupo = grupoDe(entrada)
  const seccion = grupo === 'todos' ? undefined : SECCIONES[grupo]
  return [seccion, ...detalleDe(entrada, nombres)].filter((p): p is string => typeof p === 'string' && p !== '').join(' · ')
}
