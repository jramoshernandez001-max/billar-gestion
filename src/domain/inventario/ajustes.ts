/**
 * Ajustes de inventario por conteo físico.
 *
 * Qué hace: construye el movimiento de ajuste de un producto en una
 * ubicación y su registro de bitácora con el motivo.
 * Cómo lo hace: función pura que valida las unidades (enteras, con signo y
 * distintas de cero) y el motivo, y reutiliza crearRegistroBitacora con la
 * acción registrar-ajuste.
 * Por qué: el stock nunca se edita; si el conteo físico no coincide con la
 * suma de movimientos, se agrega un ajuste por la diferencia y queda en la
 * bitácora quién lo hizo y por qué. El inventario inicial no usa ajustes:
 * se registra como compras con la fecha que elija el usuario, para que
 * tenga costo y la utilidad se pueda calcular.
 */
import { crearRegistroBitacora, type RegistroBitacora } from '../compartido/bitacora'
import type { Movimiento, Ubicacion } from './stock'

/** Datos para registrar un ajuste. */
export interface DatosAjuste {
  productoId: string
  ubicacion: Ubicacion
  /** Diferencia del conteo: positiva si sobran unidades, negativa si faltan. */
  unidades: number
  /** Por qué se ajusta; obligatorio. */
  motivo: string
  usuario: string
  momento: Date
}

/** Lo que queda en la bitácora de un ajuste. */
export interface Ajuste {
  productoId: string
  ubicacion: Ubicacion
  unidades: number
  motivo: string
}

/** Movimiento de ajuste y su registro de bitácora. */
export interface AjusteRegistrado {
  movimiento: Movimiento
  registro: RegistroBitacora<Ajuste>
}

/**
 * Construye un ajuste de inventario.
 *
 * Qué hace: devuelve el movimiento de tipo ajuste y su registro.
 * Cómo lo hace: valida unidades y motivo, arma el movimiento con las mismas
 * unidades con signo y el registro con antes nulo (es algo nuevo) y el
 * ajuste como valor después.
 * Por qué: un ajuste de cero no corrige nada, y uno sin motivo no se puede
 * auditar.
 *
 * @throws Error si las unidades son cero o no son enteras, si el motivo está
 * vacío, o si falla alguna validación de la bitácora.
 */
export function crearAjuste(datos: DatosAjuste): AjusteRegistrado {
  if (!Number.isInteger(datos.unidades) || datos.unidades === 0) {
    throw new Error('Las unidades del ajuste deben ser un entero distinto de cero')
  }
  const motivo = datos.motivo.trim()
  if (motivo.length === 0) {
    throw new Error('El motivo del ajuste es obligatorio')
  }

  const ajuste: Ajuste = {
    productoId: datos.productoId,
    ubicacion: datos.ubicacion,
    unidades: datos.unidades,
    motivo,
  }
  return {
    movimiento: {
      productoId: datos.productoId,
      tipo: 'ajuste',
      ubicacion: datos.ubicacion,
      unidades: datos.unidades,
    },
    registro: crearRegistroBitacora({
      usuario: datos.usuario,
      momento: datos.momento,
      accion: 'registrar-ajuste',
      antes: null,
      despues: ajuste,
    }),
  }
}
