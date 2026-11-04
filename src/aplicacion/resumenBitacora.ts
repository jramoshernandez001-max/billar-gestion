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
}): { tarjetas: TarjetaBitacora[]; total: number; usuarios: string[] } {
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
      usuario: e.usuario,
      momento: e.momento,
      motivo: e.motivo,
    })),
  }
}

/** Campos internos que no se muestran. */
const OCULTOS = new Set(['id', 'creado_en', 'creado_por', 'producto_id', 'compra_id', 'venta_id', 'deuda_id', 'compensa_a'])
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

function textoDeValor(clave: string, valor: unknown): string {
  if (valor === null || valor === undefined) return '—'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'number') return ES_DINERO.has(clave) ? formatoPesos(valor) : String(valor)
  if (typeof valor === 'string') return clave === 'estado' ? mayuscula(valor) : valor
  return JSON.stringify(valor)
}

export function comparar(antes: Record<string, unknown> | null, despues: Record<string, unknown>): CambioBitacora[] {
  const claves = Object.keys(despues).filter((k) => !OCULTOS.has(k))
  const cambios: CambioBitacora[] = []
  for (const clave of claves) {
    const valorAntes = antes === null ? undefined : antes[clave]
    if (antes !== null && JSON.stringify(valorAntes) === JSON.stringify(despues[clave])) continue
    cambios.push({ campo: nombreDeCampo(clave), antes: textoDeValor(clave, valorAntes), despues: textoDeValor(clave, despues[clave]) })
  }
  return cambios
}
