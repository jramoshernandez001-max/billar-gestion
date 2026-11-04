/**
 * Pruebas del formulario de producto.
 *
 * Qué hace: verifica la validación de nombre, unidades por caja y precios, y
 * la conversión a los datos que recibe el repositorio.
 * Cómo lo hace: entradas de texto (como las escribe la persona) con casos
 * válidos e inválidos.
 * Por qué: la base rechaza un nombre repetido o un monto inválido; validar
 * antes da el mensaje junto al campo en vez de un error al guardar.
 */
import { describe, it, expect } from 'vitest'
import { validarProducto, nombreNormalizado, type EntradaProducto } from './formularioProducto'

const valida: EntradaProducto = { nombre: ' Cerveza  Ejemplo ', unidadesPorCaja: '24', manejaSixpack: true, precioUnidad: '3000', precioCaja: '60000' }

describe('validarProducto', () => {
  it('convierte una entrada válida a datos limpios', () => {
    expect(validarProducto(valida, [])).toEqual({
      datos: { nombre: 'Cerveza Ejemplo', unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
      errores: {},
      puedeGuardar: true,
    })
  })

  it('exige nombre', () => {
    const r = validarProducto({ ...valida, nombre: '   ' }, [])
    expect(r.errores.nombre).toMatch(/nombre/i)
    expect(r.puedeGuardar).toBe(false)
  })

  it('rechaza un nombre repetido sin importar mayúsculas ni espacios', () => {
    const r = validarProducto({ ...valida, nombre: 'cerveza   EJEMPLO' }, ['Cerveza Ejemplo'])
    expect(r.errores.nombre).toMatch(/ya existe/i)
  })

  it('unidades por caja debe ser entero mayor a cero', () => {
    expect(validarProducto({ ...valida, unidadesPorCaja: '0' }, []).errores.unidadesPorCaja).toBeDefined()
    expect(validarProducto({ ...valida, unidadesPorCaja: '' }, []).errores.unidadesPorCaja).toBeDefined()
    expect(validarProducto({ ...valida, unidadesPorCaja: '2.5' }, []).errores.unidadesPorCaja).toBeDefined()
  })

  it('los precios son pesos enteros mayores a cero', () => {
    const r = validarProducto({ ...valida, precioUnidad: '', precioCaja: '0' }, [])
    expect(r.errores.precioUnidad).toBeDefined()
    expect(r.errores.precioCaja).toBeDefined()
    expect(r.datos).toBeNull()
  })

  it('avisa si la caja cuesta menos que una sola unidad', () => {
    const r = validarProducto({ ...valida, precioUnidad: '5000', precioCaja: '4000' }, [])
    expect(r.errores.precioCaja).toMatch(/caja/i)
  })
})

describe('nombreNormalizado', () => {
  it('pasa a minúsculas y junta espacios', () => {
    expect(nombreNormalizado('  Agua   CRISTAL ')).toBe('agua cristal')
  })
})
