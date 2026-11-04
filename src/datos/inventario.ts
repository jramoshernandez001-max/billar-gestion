/**
 * Repositorio de inventario.
 *
 * Qué hace: ofrece a la app las operaciones de productos, compras, traslados
 * y ajustes, y la lectura de productos y stock, hablando con las funciones
 * de la base de datos.
 * Cómo lo hace: cada operación valida sus datos con las reglas del dominio,
 * llama a la función SQL con los parámetros por nombre y convierte la
 * respuesta a los tipos de la app. Una prueba compara los nombres de los
 * parámetros con los de las migraciones.
 * Por qué: toda escritura pasa por funciones de la base (verifican al usuario,
 * guardan la bitácora y son atómicas); este archivo es la única puerta de la
 * app hacia ellas para inventario. Si algo falla, el mensaje de la base llega
 * tal cual a quien llama.
 */
import type { Presentacion } from '../domain/inventario/conversiones'
import type { Compra } from '../domain/inventario/compras'
import type { Stock, Ubicacion } from '../domain/inventario/stock'
import { validarFecha, validarMonto } from '../domain/compartido/validaciones'
import { leerFilas, llamarFuncion, type ClienteDatos } from './clienteDatos'
import { COLUMNAS_PRODUCTO, filaAProductoVendible } from './filasProducto'
import {
  esEntero,
  esObjeto,
  exigirEnteroNoCero,
  exigirEnteroPositivo,
  exigirId,
  exigirIdRespuesta,
  exigirTexto,
  exigirUnoDe,
  respuestaInesperada,
} from './entradas'

/** Presentaciones y ubicaciones válidas. */
const PRESENTACIONES: readonly Presentacion[] = ['unidad', 'sixpack', 'caja']
const UBICACIONES: readonly Ubicacion[] = ['bodega', 'nevera']

/** Producto tal como lo usa la app. */
export interface Producto {
  id: string
  nombre: string
  unidadesPorCaja: number
  manejaSixpack: boolean
  /** Precio de lista de una unidad, en pesos. */
  precioUnidad: number
  /** Precio de lista de la caja, en pesos (editable aparte). */
  precioCaja: number
}

/** Datos para crear o editar un producto. */
export type DatosProducto = Omit<Producto, 'id'>

/** Datos de una compra. */
export interface DatosCompra {
  productoId: string
  presentacion: Presentacion
  cantidad: number
  /** Lo que se pagó en total, en pesos. */
  costoTotal: number
  /** Día de la compra, AAAA-MM-DD. */
  fecha: string
}

/** Datos de un ajuste de inventario por conteo físico. */
export interface DatosAjusteInventario {
  productoId: string
  ubicacion: Ubicacion
  /** Unidades con signo, distintas de cero. */
  unidades: number
  motivo: string
}

/** Respuesta de un traslado: avisa si la bodega alcanzaba. */
export interface ResultadoTraslado {
  trasladoId: string
  suficiente: boolean
  /** Unidades que faltaban en la bodega (0 si alcanzaba). */
  faltan: number
}

/** Operaciones de inventario. */
export interface RepositorioInventario {
  listarProductos(): Promise<Producto[]>
  crearProducto(datos: DatosProducto): Promise<string>
  editarProducto(id: string, datos: DatosProducto): Promise<void>
  registrarCompra(datos: DatosCompra): Promise<string>
  corregirCostoCompra(compraId: string, costoNuevo: number, motivo: string): Promise<void>
  anularCompra(compraId: string, motivo: string): Promise<void>
  registrarTraslado(productoId: string, unidades: number): Promise<ResultadoTraslado>
  registrarAjuste(datos: DatosAjusteInventario): Promise<string>
  /** Stock por producto: bodega, nevera y total. */
  obtenerStock(): Promise<Map<string, Stock>>
  /** Compras (vigentes y anuladas) como las usa el dominio. */
  listarCompras(): Promise<Compra[]>
}

/**
 * Valida un producto y arma los parámetros de crear_producto y editar_producto.
 *
 * Qué hace: devuelve los parámetros ya limpios y con los nombres de SQL.
 * Cómo lo hace: exige nombre, unidades por caja enteras mayores a cero y
 * precios enteros no negativos (validarMonto del dominio).
 * Por qué: crear y editar comparten las mismas reglas de los datos.
 */
function parametrosProducto(datos: DatosProducto): Record<string, unknown> {
  validarMonto('El precio de la unidad', datos.precioUnidad)
  validarMonto('El precio de la caja', datos.precioCaja)
  return {
    p_nombre: exigirTexto('El nombre del producto', datos.nombre),
    p_unidades_por_caja: exigirEnteroPositivo('Las unidades por caja', datos.unidadesPorCaja),
    p_maneja_sixpack: datos.manejaSixpack === true,
    p_precio_unidad: datos.precioUnidad,
    p_precio_caja: datos.precioCaja,
  }
}

/**
 * Convierte una fila de la tabla productos a Producto.
 *
 * Qué hace: devuelve el producto de la app.
 * Cómo lo hace: revisa que cada campo tenga el tipo esperado y renombra de
 * snake_case a camelCase.
 * Por qué: si la base cambia y llega algo raro, falla aquí con un mensaje
 * claro y no más adelante con un número equivocado.
 */
function filaAProducto(fila: unknown): Producto {
  if (
    !esObjeto(fila) ||
    typeof fila.id !== 'string' ||
    typeof fila.nombre !== 'string' ||
    !esEntero(fila.unidades_por_caja) ||
    typeof fila.maneja_sixpack !== 'boolean' ||
    !esEntero(fila.precio_unidad) ||
    !esEntero(fila.precio_caja)
  ) {
    throw new Error('Una fila de productos no tiene la forma esperada')
  }
  return {
    id: fila.id,
    nombre: fila.nombre,
    unidadesPorCaja: fila.unidades_por_caja,
    manejaSixpack: fila.maneja_sixpack,
    precioUnidad: fila.precio_unidad,
    precioCaja: fila.precio_caja,
  }
}

/**
 * Crea el repositorio de inventario.
 *
 * Qué hace: devuelve las operaciones de inventario sobre un cliente de datos.
 * Cómo lo hace: cierra sobre el cliente; cada operación valida, llama y
 * convierte.
 * Por qué: recibir el cliente por parámetro permite probarlo sin Supabase.
 */
export function crearRepositorioInventario(cliente: ClienteDatos): RepositorioInventario {
  return {
    async listarProductos() {
      const filas = await leerFilas(
        cliente,
        'productos',
        'id, nombre, unidades_por_caja, maneja_sixpack, precio_unidad, precio_caja',
      )
      return filas.map(filaAProducto)
    },

    async crearProducto(datos) {
      const id = await llamarFuncion(cliente, 'crear_producto', parametrosProducto(datos))
      return exigirIdRespuesta(id)
    },

    async editarProducto(id, datos) {
      await llamarFuncion(cliente, 'editar_producto', {
        p_producto_id: exigirId('El producto', id),
        ...parametrosProducto(datos),
      })
    },

    async registrarCompra(datos) {
      validarMonto('El costo total de la compra', datos.costoTotal)
      validarFecha('La fecha de la compra', datos.fecha)
      const id = await llamarFuncion(cliente, 'registrar_compra', {
        p_producto_id: exigirId('El producto', datos.productoId),
        p_presentacion: exigirUnoDe('La presentación', datos.presentacion, PRESENTACIONES),
        p_cantidad: exigirEnteroPositivo('La cantidad de la compra', datos.cantidad),
        p_costo_total: datos.costoTotal,
        p_fecha: datos.fecha,
      })
      return exigirIdRespuesta(id)
    },

    async corregirCostoCompra(compraId, costoNuevo, motivo) {
      validarMonto('El costo nuevo de la compra', costoNuevo)
      await llamarFuncion(cliente, 'corregir_costo_compra', {
        p_compra_id: exigirId('La compra', compraId),
        p_costo_nuevo: costoNuevo,
        p_motivo: exigirTexto('El motivo', motivo),
      })
    },

    async anularCompra(compraId, motivo) {
      await llamarFuncion(cliente, 'anular_compra', {
        p_compra_id: exigirId('La compra', compraId),
        p_motivo: exigirTexto('El motivo', motivo),
      })
    },

    async registrarTraslado(productoId, unidades) {
      const respuesta = await llamarFuncion(cliente, 'registrar_traslado', {
        p_producto_id: exigirId('El producto', productoId),
        p_unidades: exigirEnteroPositivo('Las unidades del traslado', unidades),
      })
      if (
        !esObjeto(respuesta) ||
        typeof respuesta.traslado_id !== 'string' ||
        typeof respuesta.suficiente !== 'boolean' ||
        !esEntero(respuesta.faltan)
      ) {
        throw respuestaInesperada()
      }
      return { trasladoId: respuesta.traslado_id, suficiente: respuesta.suficiente, faltan: respuesta.faltan }
    },

    async registrarAjuste(datos) {
      const id = await llamarFuncion(cliente, 'registrar_ajuste', {
        p_producto_id: exigirId('El producto', datos.productoId),
        p_ubicacion: exigirUnoDe('La ubicación', datos.ubicacion, UBICACIONES),
        p_unidades: exigirEnteroNoCero('Las unidades del ajuste', datos.unidades),
        p_motivo: exigirTexto('El motivo', datos.motivo),
      })
      return exigirIdRespuesta(id)
    },

    async obtenerStock() {
      const filas = await leerFilas(cliente, 'stock_actual', 'producto_id, ubicacion, unidades')
      const stock = new Map<string, Stock>()
      for (const fila of filas) {
        if (
          !esObjeto(fila) ||
          typeof fila.producto_id !== 'string' ||
          !esEntero(fila.unidades) ||
          (fila.ubicacion !== 'bodega' && fila.ubicacion !== 'nevera')
        ) {
          throw new Error('Una fila de stock no tiene la forma esperada')
        }
        const actual = stock.get(fila.producto_id) ?? { bodega: 0, nevera: 0, total: 0 }
        actual[fila.ubicacion] += fila.unidades
        actual.total += fila.unidades
        stock.set(fila.producto_id, actual)
      }
      return stock
    },

    async listarCompras() {
      const [compras, productos] = await Promise.all([
        leerFilas(cliente, 'compras', 'id, numero, producto_id, presentacion, cantidad, costo_total, fecha, estado, creado_en'),
        leerFilas(cliente, 'productos', COLUMNAS_PRODUCTO),
      ])
      const porProducto = new Map(productos.map((fila) => {
        const p = filaAProductoVendible(fila)
        return [p.id, p.producto] as const
      }))
      return compras.map((fila): Compra => {
        if (
          !esObjeto(fila) ||
          typeof fila.id !== 'string' ||
          !esEntero(fila.numero) ||
          typeof fila.producto_id !== 'string' ||
          !PRESENTACIONES.includes(fila.presentacion as Presentacion) ||
          !esEntero(fila.cantidad) ||
          !esEntero(fila.costo_total) ||
          typeof fila.fecha !== 'string' ||
          (fila.estado !== 'vigente' && fila.estado !== 'anulada') ||
          typeof fila.creado_en !== 'string' ||
          Number.isNaN(new Date(fila.creado_en).getTime())
        ) {
          throw new Error('Una fila de compras no tiene la forma esperada')
        }
        const producto = porProducto.get(fila.producto_id)
        if (producto === undefined) throw new Error(`El producto ${fila.producto_id} de una compra no existe`)
        return {
          id: fila.id,
          numero: fila.numero,
          productoId: fila.producto_id,
          producto: { unidadesPorCaja: producto.unidadesPorCaja, manejaSixpack: producto.manejaSixpack },
          presentacion: fila.presentacion as Presentacion,
          cantidad: fila.cantidad,
          costoTotal: fila.costo_total,
          fecha: fila.fecha,
          registradoEn: new Date(fila.creado_en).toISOString(),
          estado: fila.estado,
        }
      })
    },
  }
}
