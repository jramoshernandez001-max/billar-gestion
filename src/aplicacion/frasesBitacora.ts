/**
 * Frases de la bitácora.
 *
 * Qué hace: convierte cada entrada de la bitácora en una frase que se lee
 * de corrido, p. ej. "Se compraron 3 cajas de Águila (90 unidades) por
 * $ 240.000. Compra C-007 del 2026-11-08."
 * Cómo lo hace: una función por tipo de acción lee los datos guardados (el
 * "antes" y el "después") y los cuenta con palabras: cantidades en cajas y
 * unidades (o botellas para el licor), nombres de producto y pesos.
 * Por qué: la lista de campos "antes → después" es exacta pero cuesta
 * leerla; quien revisa la bitácora quiere saber qué pasó, en una línea.
 */
import type { EntradaBitacora } from '../datos/bitacora'
import type { CategoriaProducto } from '../domain/inventario/categorias'
import { formatoPesos } from '../interfaz/formato'

/** Lo que la frase necesita saber de un producto. */
export interface ProductoBitacora {
  nombre: string
  categoria: CategoriaProducto
  unidadesPorCaja: number
}

type Registro = Record<string, unknown>
type Productos = ReadonlyMap<string, ProductoBitacora>

// --- Ayudas de lectura -------------------------------------------------------

const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const pesos = (v: unknown): string => formatoPesos(numero(v) ?? 0)

/** Plural sencillo: 1 caja, 3 cajas. */
const contar = (n: number, singular: string, plural: string) => `${n} ${Math.abs(n) === 1 ? singular : plural}`

/** "Se compró" o "Se compraron" según la cantidad. */
const verbo = (n: number, singular: string, plural: string) => (Math.abs(n) === 1 ? singular : plural)

/** Une partes como en español: "a", "a y b", "a, b y c". */
function unir(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** Número de compra con el formato de la app (7 → "C-007"). */
const numeroCompra = (v: unknown) => `C-${String(numero(v) ?? 0).padStart(3, '0')}`

/** Producto por id, si se conoce. */
const productoDe = (id: unknown, productos: Productos) => (typeof id === 'string' ? productos.get(id) : undefined)

/** Nombre del producto, o "un producto" si ya no se conoce. */
const nombreDe = (id: unknown, productos: Productos) => productoDe(id, productos)?.nombre ?? 'un producto'

const esLicor = (p: ProductoBitacora | undefined) => p?.categoria === 'licor'

// --- Cantidades --------------------------------------------------------------

/**
 * Cantidad de una presentación: "3 cajas", "1 sixpack", "6 botellas".
 *
 * Por qué: el licor no tiene cajas ni unidades para quien lo vende; se
 * cuenta en botellas.
 */
function cantidadPresentacion(cantidad: number, presentacion: unknown, producto: ProductoBitacora | undefined): string {
  if (esLicor(producto)) return contar(cantidad, 'botella', 'botellas')
  if (presentacion === 'caja') return contar(cantidad, 'caja', 'cajas')
  if (presentacion === 'sixpack') return contar(cantidad, 'sixpack', 'sixpacks')
  return contar(cantidad, 'unidad', 'unidades')
}

/**
 * Unidades sueltas contadas en cajas: "2 cajas y 5 unidades", "1 caja", "5 unidades".
 *
 * Qué hace: devuelve el texto y si hace falta aclarar el total en unidades.
 * Por qué: un traslado de 65 unidades se entiende mejor como "2 cajas y 5".
 */
function enCajas(unidades: number, producto: ProductoBitacora | undefined): { texto: string; aclarar: boolean } {
  if (esLicor(producto)) return { texto: contar(unidades, 'botella', 'botellas'), aclarar: false }
  const porCaja = producto?.unidadesPorCaja ?? 1
  const cajas = porCaja > 1 ? Math.trunc(unidades / porCaja) : 0
  const sueltas = unidades - cajas * porCaja
  if (cajas === 0) return { texto: contar(sueltas, 'unidad', 'unidades'), aclarar: false }
  const textoCajas = contar(cajas, 'caja', 'cajas')
  return { texto: sueltas === 0 ? textoCajas : `${textoCajas} y ${contar(sueltas, 'unidad', 'unidades')}`, aclarar: true }
}

/** Renglones de una venta en palabras y el total cobrado. */
function renglonesEnPalabras(registro: Registro, productos: Productos): { partes: string[]; total: number; cantidad: number } {
  const renglones = Array.isArray(registro.renglones) ? (registro.renglones as Registro[]) : []
  let total = 0
  let cantidad = 0
  const partes = renglones.map((r) => {
    const n = numero(r.cantidad) ?? 0
    total += n * (numero(r.precio_cobrado) ?? 0)
    cantidad += n
    return `${cantidadPresentacion(n, r.presentacion, productoDe(r.producto_id, productos))} de ${nombreDe(r.producto_id, productos)}`
  })
  return { partes, total, cantidad }
}

/** "del día 2026-11-08" o "de la semana del 2026-11-02 al 2026-11-08". */
function periodoCierre(r: Registro): string {
  return r.tipo === 'semanal'
    ? `de la semana del ${String(r.desde)} al ${String(r.hasta)}`
    : `del día ${String(r.desde)}`
}

/** Resultado del cuadre en palabras: "Cuadró.", "Faltaron $ 5.000.", "Sobraron $ 2.000.". */
function resultadoCuadre(r: Registro): string {
  const resultado = (r.resultado ?? {}) as Registro
  if ((numero(resultado.faltante) ?? 0) > 0) return ` Faltaron ${pesos(resultado.faltante)}.`
  if ((numero(resultado.sobrante) ?? 0) > 0) return ` Sobraron ${pesos(resultado.sobrante)}.`
  if (resultado.cuadra === true) return ' Cuadró.'
  return ''
}

// --- Una frase por acción ----------------------------------------------------

function fraseCompra(d: Registro, productos: Productos): string {
  const producto = productoDe(d.producto_id, productos)
  const cantidad = numero(d.cantidad) ?? 0
  const unidades = numero(d.unidades)
  const aclarar = !esLicor(producto) && d.presentacion !== 'unidad' && unidades !== undefined
  return (
    `${verbo(cantidad, 'Se compró', 'Se compraron')} ${cantidadPresentacion(cantidad, d.presentacion, producto)} ` +
    `de ${nombreDe(d.producto_id, productos)}${aclarar ? ` (${unidades} unidades)` : ''} por ${pesos(d.costo_total)}. ` +
    `Compra ${numeroCompra(d.numero)} del ${String(d.fecha)}.`
  )
}

function fraseCorregirCosto(a: Registro, d: Registro, productos: Productos): string {
  return (
    `Se corrigió el costo de la compra ${numeroCompra(d.numero)} de ${nombreDe(d.producto_id, productos)}: ` +
    `pasó de ${pesos(a.costo_total)} a ${pesos(d.costo_total)}.`
  )
}

function fraseTraslado(d: Registro, productos: Productos): string {
  const producto = productoDe(d.producto_id, productos)
  const unidades = numero(d.unidades) ?? 0
  const cantidad = enCajas(unidades, producto)
  const unaSola = cantidad.texto.startsWith('1 ') && !cantidad.texto.includes(' y ')
  return (
    `${unaSola ? 'Se pasó' : 'Se pasaron'} ${cantidad.texto} de ${nombreDe(d.producto_id, productos)}` +
    `${cantidad.aclarar ? ` (${unidades} unidades)` : ''} de la bodega a la nevera.`
  )
}

function fraseAjuste(d: Registro, productos: Productos): string {
  const producto = productoDe(d.producto_id, productos)
  const unidades = numero(d.unidades) ?? 0
  const cuanto = esLicor(producto)
    ? contar(Math.abs(unidades), 'botella', 'botellas')
    : contar(Math.abs(unidades), 'unidad', 'unidades')
  const accion = unidades >= 0 ? verbo(unidades, 'se sumó', 'se sumaron') : verbo(unidades, 'se quitó', 'se quitaron')
  return `Se ajustó el inventario de ${nombreDe(d.producto_id, productos)} en la ${String(d.ubicacion)}: ${accion} ${cuanto}.`
}

function fraseVenta(d: Registro, productos: Productos): string {
  const { partes, total, cantidad } = renglonesEnPalabras(d, productos)
  return `${verbo(cantidad, 'Se vendió', 'Se vendieron')} ${unir(partes)} por ${formatoPesos(total)} (venta del ${String(d.fecha)}).`
}

function fraseDeuda(d: Registro): string {
  return `${String(d.cliente)} quedó debiendo ${pesos(d.monto)} el ${String(d.fecha)} por: ${String(d.descripcion)}.`
}

function fraseAbono(d: Registro): string {
  return `Se recibió un abono de ${pesos(d.monto)} el ${String(d.fecha)} por: ${String(d.descripcion)}.`
}

function fraseCierre(verboCierre: string, d: Registro): string {
  return (
    `${verboCierre} el cierre ${periodoCierre(d)}: se contaron ${pesos(d.efectivo)} en efectivo ` +
    `y ${pesos(d.transferencias)} en transferencias.${resultadoCuadre(d)}`
  )
}

function fraseCorregirDinero(a: Registro, d: Registro): string {
  const cambios: string[] = []
  if (a.efectivo !== d.efectivo) cambios.push(`el efectivo pasó de ${pesos(a.efectivo)} a ${pesos(d.efectivo)}`)
  if (a.transferencias !== d.transferencias) {
    cambios.push(`las transferencias pasaron de ${pesos(a.transferencias)} a ${pesos(d.transferencias)}`)
  }
  return `Se corrigió el dinero del cierre ${periodoCierre(d)}: ${cambios.length > 0 ? unir(cambios) : 'sin cambios'}.`
}

function fraseCambiarPrecio(a: Registro, d: Registro): string {
  const cambios: string[] = []
  if (a.precio_unidad !== d.precio_unidad) cambios.push(`la unidad pasó de ${pesos(a.precio_unidad)} a ${pesos(d.precio_unidad)}`)
  if (a.precio_caja !== d.precio_caja) {
    const caja = `de ${pesos(a.precio_caja)} a ${pesos(d.precio_caja)}`
    cambios.push(cambios.length > 0 ? `la caja ${caja}` : `la caja pasó ${caja}`)
  }
  return `Se cambió el precio de ${String(d.nombre)}: ${cambios.length > 0 ? unir(cambios) : 'sin cambios'}.`
}

function fraseCrearProducto(d: Registro): string {
  if (d.categoria === 'licor') return `Se creó el licor ${String(d.nombre)}: botella a ${pesos(d.precio_unidad)}.`
  return (
    `Se creó el producto ${String(d.nombre)} (${String(d.categoria ?? 'cerveza')}, caja de ${String(d.unidades_por_caja)} unidades): ` +
    `unidad a ${pesos(d.precio_unidad)} y caja a ${pesos(d.precio_caja)}.`
  )
}

/** Campos de producto que se cuentan al editarlo, con su nombre en palabras. */
const CAMPOS_PRODUCTO: Record<string, string> = {
  nombre: 'nombre',
  categoria: 'categoría',
  unidades_por_caja: 'unidades por caja',
  maneja_sixpack: 'maneja sixpack',
}

/** Valor de un campo de producto en palabras (textos entre comillas, Sí/No). */
function valorProducto(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'string') return `"${v}"`
  return String(v)
}

function fraseEditarProducto(a: Registro, d: Registro): string {
  const cambios = Object.entries(CAMPOS_PRODUCTO)
    .filter(([campo]) => a[campo] !== d[campo] && d[campo] !== undefined)
    .map(([campo, nombre]) => `${nombre} de ${valorProducto(a[campo])} a ${valorProducto(d[campo])}`)
  return `Se editó el producto ${String(d.nombre)}${cambios.length > 0 ? `: ${unir(cambios)}` : ''}.`
}

function fraseAnulado(tabla: string | null, a: Registro, d: Registro, productos: Productos): string | undefined {
  const r = { ...a, ...d }
  switch (tabla) {
    case 'ventas': {
      const { partes, total } = renglonesEnPalabras(r, productos)
      return `Se anuló la venta del ${String(r.fecha)} (${unir(partes)}) por ${formatoPesos(total)}. Sus unidades volvieron a la nevera.`
    }
    case 'compras': {
      const producto = productoDe(r.producto_id, productos)
      return (
        `Se anuló la compra ${numeroCompra(r.numero)}: ${cantidadPresentacion(numero(r.cantidad) ?? 0, r.presentacion, producto)} ` +
        `de ${nombreDe(r.producto_id, productos)} por ${pesos(r.costo_total)}. Sus unidades se descontaron del inventario.`
      )
    }
    case 'deudas':
      return `Se anuló la deuda de ${String(r.cliente)} por ${pesos(r.monto)}.`
    case 'abonos_deuda':
      return `Se anuló el abono de ${pesos(r.monto)} del ${String(r.fecha)}.`
    default:
      return undefined
  }
}

/**
 * Frase de una entrada de la bitácora.
 *
 * Qué hace: devuelve la frase de la acción, o undefined si la acción no
 * tiene frase propia (entonces la pantalla muestra solo el título).
 * Cómo lo hace: elige la frase según la acción; las anulaciones según la
 * tabla. Usa el "después" y, donde hay corrección, también el "antes".
 * Por qué: un solo lugar decide cómo se cuenta cada acción.
 */
export function fraseDe(entrada: EntradaBitacora, productos: Productos = new Map()): string | undefined {
  const a: Registro = entrada.antes ?? {}
  const d: Registro = entrada.despues
  switch (entrada.accion) {
    case 'registrar-compra':
      return fraseCompra(d, productos)
    case 'corregir-costo-compra':
      return fraseCorregirCosto(a, d, productos)
    case 'registrar-traslado':
      return fraseTraslado(d, productos)
    case 'registrar-ajuste':
      return fraseAjuste(d, productos)
    case 'registrar-venta':
      return fraseVenta(d, productos)
    case 'registrar-deuda':
      return fraseDeuda(d)
    case 'registrar-abono':
      return fraseAbono(d)
    case 'registrar-cierre-diario':
    case 'registrar-cierre-semanal':
      return fraseCierre('Se hizo', d)
    case 'recalcular-cierre-diario':
    case 'recalcular-cierre-semanal':
      return fraseCierre('Se recalculó', d)
    case 'corregir-dinero-cierre':
      return fraseCorregirDinero(a, d)
    case 'cambiar-precio':
      return fraseCambiarPrecio(a, d)
    case 'crear-producto':
      return fraseCrearProducto(d)
    case 'editar-producto':
      return fraseEditarProducto(a, d)
    case 'anular-registro':
      return fraseAnulado(entrada.tabla, a, d, productos)
    default:
      return undefined
  }
}
