/**
 * Pruebas del borrador de venta.
 *
 * Qué hace: verifica los cambios del formulario de "Nueva venta" (agregar,
 * cambiar y quitar renglones), el cálculo de subtotales y total, los
 * problemas que impiden registrar y la conversión a los datos de la venta.
 * Cómo lo hace: funciones puras con un catálogo de productos inventado.
 * Por qué: la pantalla solo debe dibujar este estado; así la lógica se prueba
 * sin pantalla y el diseño de Figma se puede cambiar sin tocarla.
 */
import { describe, it, expect } from 'vitest'
import {
  agregarAdicional,
  agregarRenglon,
  aDatosVenta,
  cambiarAdicional,
  quitarAdicional,
  borradorVacio,
  calcularBorrador,
  cambiarRenglon,
  quitarRenglon,
} from './borradorVenta'

const catalogo = new Map([
  ['cerveza', { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }],
  ['aguardiente', { unidadesPorCaja: 1, manejaSixpack: false, categoria: 'licor' as const, precioUnidad: 50000, precioCaja: 50000 }],
  ['gaseosa', { unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 2000, precioCaja: 22000 }],
])

const base = () => agregarRenglon(borradorVacio('2026-11-03'), 'r1')

describe('edición del borrador', () => {
  it('un borrador nuevo no tiene renglones; agregar crea uno sin producto', () => {
    expect(borradorVacio('2026-11-03').renglones).toEqual([])
    expect(base().renglones).toEqual([{ clave: 'r1', productoId: null, presentacion: 'unidad', cantidad: 1 }])
  })

  it('el renglón nuevo queda arriba, antes de los que ya había', () => {
    const b = agregarRenglon(agregarRenglon(base(), 'r2'), 'r3')
    expect(b.renglones.map((r) => r.clave)).toEqual(['r3', 'r2', 'r1'])
  })

  it('no repite la clave de un renglón', () => {
    expect(() => agregarRenglon(base(), 'r1')).toThrow(/clave/i)
  })

  it('cambia un renglón sin modificar el borrador original', () => {
    const original = base()
    const nuevo = cambiarRenglon(original, 'r1', { productoId: 'cerveza', cantidad: 3 })
    expect(nuevo.renglones[0]).toMatchObject({ productoId: 'cerveza', cantidad: 3 })
    expect(original.renglones[0].productoId).toBeNull()
  })

  it('al cambiar la presentación se descarta el precio cobrado anterior', () => {
    let b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', precioCobrado: 2500 })
    b = cambiarRenglon(b, 'r1', { presentacion: 'caja' })
    expect(b.renglones[0].precioCobrado).toBeUndefined()
  })

  it('cambiar de producto a uno sin sixpack devuelve la presentación a unidad', () => {
    let b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', presentacion: 'sixpack' })
    b = cambiarRenglon(b, 'r1', { productoId: 'gaseosa' }, catalogo)
    expect(b.renglones[0].presentacion).toBe('unidad')
  })

  it('cambiar o quitar un renglón inexistente da error; quitar elimina el renglón', () => {
    expect(() => cambiarRenglon(base(), 'x', { cantidad: 2 })).toThrow(/renglón/i)
    expect(() => quitarRenglon(base(), 'x')).toThrow(/renglón/i)
    expect(quitarRenglon(base(), 'r1').renglones).toEqual([])
  })

  it('conserva la fecha al cambiar un renglón', () => {
    expect(cambiarRenglon(base(), 'r1', {}).fecha).toBe('2026-11-03')
  })
})

describe('presentación del licor', () => {
  it('al elegir un licor, una caja o sixpack pasa a botella (unidad)', () => {
    let b = base()
    b = cambiarRenglon(b, 'r1', { presentacion: 'caja' })
    b = cambiarRenglon(b, 'r1', { productoId: 'aguardiente' }, catalogo)
    expect(b.renglones[0].presentacion).toBe('unidad')
  })
})

describe('calcularBorrador', () => {
  it('calcula precio de lista, subtotal y total', () => {
    let b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', cantidad: 2 })
    b = cambiarRenglon(agregarRenglon(b, 'r2'), 'r2', { productoId: 'cerveza', presentacion: 'sixpack', cantidad: 1 })
    const c = calcularBorrador(b, catalogo)
    expect(c.renglones.map((r) => [r.precioLista, r.subtotal])).toEqual([[18000, 18000], [3000, 6000]])
    expect(c.total).toBe(24000)
    expect(c.problemas).toEqual([])
    expect(c.puedeRegistrar).toBe(true)
  })

  it('usa el precio cobrado cuando se edita', () => {
    const b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', presentacion: 'caja', cantidad: 1, precioCobrado: 55000 })
    const c = calcularBorrador(b, catalogo)
    expect(c.renglones[0]).toMatchObject({ precioLista: 60000, subtotal: 55000 })
  })

  it('un renglón de cantidad cero vale cero y se ignora; si todos son cero no se puede registrar', () => {
    const b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', cantidad: 0 })
    const c = calcularBorrador(b, catalogo)
    expect(c.total).toBe(0)
    expect(c.puedeRegistrar).toBe(false)
    expect(c.problemas.join(' ')).toMatch(/nada que vender/i)
  })

  it('avisa los problemas de cada renglón sin lanzar error', () => {
    let b = agregarRenglon(base(), 'r2')
    b = cambiarRenglon(b, 'r2', { productoId: 'inexistente' })
    b = cambiarRenglon(agregarRenglon(b, 'r3'), 'r3', { productoId: 'gaseosa', presentacion: 'sixpack' })
    b = cambiarRenglon(agregarRenglon(b, 'r4'), 'r4', { productoId: 'cerveza', cantidad: 1.5 })
    b = cambiarRenglon(agregarRenglon(b, 'r5'), 'r5', { productoId: 'cerveza', precioCobrado: -1 })
    const c = calcularBorrador(b, catalogo)
    // El último agregado va de primero: r5, r4, r3, r2, r1.
    expect(c.renglones.map((r) => r.problema)).toEqual([
      expect.stringMatching(/precio/i),
      expect.stringMatching(/cantidad/i),
      expect.stringMatching(/sixpack/i),
      expect.stringMatching(/producto/i),
      expect.stringMatching(/producto/i),
    ])
    expect(c.puedeRegistrar).toBe(false)
  })

  it('un borrador sin renglones no se puede registrar', () => {
    expect(calcularBorrador(borradorVacio('2026-11-03'), catalogo).puedeRegistrar).toBe(false)
  })

  it('una fecha inválida impide registrar', () => {
    const b = { ...cambiarRenglon(base(), 'r1', { productoId: 'cerveza' }), fecha: '3/11/2026' }
    const c = calcularBorrador(b, catalogo)
    expect(c.puedeRegistrar).toBe(false)
    expect(c.problemas.join(' ')).toMatch(/fecha/i)
  })
})

describe('unidades del borrador', () => {
  it('cuenta las unidades de cada renglón y del total (caja, sixpack y unidad)', () => {
    let b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', presentacion: 'caja', cantidad: 1 })
    b = cambiarRenglon(agregarRenglon(b, 'r2'), 'r2', { productoId: 'cerveza', presentacion: 'sixpack', cantidad: 2 })
    b = cambiarRenglon(agregarRenglon(b, 'r3'), 'r3', { productoId: 'gaseosa', cantidad: 3 })
    const c = calcularBorrador(b, catalogo)
    expect(c.renglones.map((r) => r.unidades)).toEqual([3, 12, 24])
    expect(c.unidades).toBe(39)
  })

  it('un renglón con problema no suma unidades', () => {
    const c = calcularBorrador(base(), catalogo)
    expect(c.renglones[0].unidades).toBe(0)
    expect(c.unidades).toBe(0)
  })
})

describe('aDatosVenta', () => {
  it('convierte el borrador en los datos del repositorio', () => {
    let b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', cantidad: 2, precioCobrado: 2800 })
    b = cambiarRenglon(agregarRenglon(b, 'r2'), 'r2', { productoId: 'gaseosa', cantidad: 0 })
    expect(aDatosVenta(b, catalogo)).toEqual({
      fecha: '2026-11-03',
      renglones: [
        { productoId: 'gaseosa', presentacion: 'unidad', cantidad: 0 },
        { productoId: 'cerveza', presentacion: 'unidad', cantidad: 2, precioCobrado: 2800 },
      ],
    })
  })

  it('rechaza un borrador que no se puede registrar', () => {
    expect(() => aDatosVenta(base(), catalogo)).toThrow(/producto/i)
  })
})

describe('productos adicionales ("Otros")', () => {
  const soloOtros = () => agregarAdicional(borradorVacio('2026-11-03'), 'a1')

  it('agregar crea un adicional vacío con cantidad 1, arriba de los demás', () => {
    const b = agregarAdicional(soloOtros(), 'a2')
    expect(b.adicionales?.map((a) => a.clave)).toEqual(['a2', 'a1'])
    expect(b.adicionales?.[1]).toEqual({ clave: 'a1', descripcion: '', cantidad: 1, valor: null })
    expect(() => agregarAdicional(b, 'a1')).toThrow()
  })

  it('cambiar y quitar un adicional', () => {
    const b = cambiarAdicional(soloOtros(), 'a1', { descripcion: 'Hidratante', cantidad: 5, valor: 25000 })
    expect(b.adicionales).toEqual([{ clave: 'a1', descripcion: 'Hidratante', cantidad: 5, valor: 25000 }])
    expect(quitarAdicional(b, 'a1').adicionales).toEqual([])
    expect(() => cambiarAdicional(b, 'zz', {})).toThrow()
    expect(() => quitarAdicional(b, 'zz')).toThrow()
  })

  it('suma el valor de los adicionales al total, sin contarlos como unidades del inventario', () => {
    let b = cambiarRenglon(base(), 'r1', { productoId: 'cerveza', cantidad: 2 }, catalogo)
    b = cambiarAdicional(agregarAdicional(b, 'a1'), 'a1', { descripcion: 'Hidratante', cantidad: 5, valor: 25000 })
    const calculado = calcularBorrador(b, catalogo)
    expect(calculado.total).toBe(31000)
    expect(calculado.unidades).toBe(2)
    expect(calculado.adicionales).toEqual([{ clave: 'a1', problema: null }])
    expect(calculado.puedeRegistrar).toBe(true)
  })

  it('una venta solo con adicionales se puede registrar', () => {
    const b = cambiarAdicional(soloOtros(), 'a1', { descripcion: 'Hidratante', cantidad: 1, valor: 5000 })
    expect(calcularBorrador(b, catalogo).puedeRegistrar).toBe(true)
  })

  it('un adicional sin nombre o sin valor impide registrar', () => {
    const sinNombre = calcularBorrador(cambiarAdicional(soloOtros(), 'a1', { valor: 5000 }), catalogo)
    expect(sinNombre.puedeRegistrar).toBe(false)
    expect(sinNombre.adicionales[0].problema).toMatch(/nombre/i)
    const sinValor = calcularBorrador(cambiarAdicional(soloOtros(), 'a1', { descripcion: 'Maní' }), catalogo)
    expect(sinValor.adicionales[0].problema).toMatch(/valor/i)
    expect(sinValor.total).toBe(0)
  })

  it('aDatosVenta manda los adicionales con el nombre limpio', () => {
    const b = cambiarAdicional(soloOtros(), 'a1', { descripcion: ' Hidratante ', cantidad: 5, valor: 25000 })
    expect(aDatosVenta(b, catalogo)).toEqual({
      fecha: '2026-11-03',
      renglones: [],
      adicionales: [{ descripcion: 'Hidratante', cantidad: 5, valor: 25000 }],
    })
  })
})
