// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Nueva venta".
 *
 * Qué hace: verifica armar una venta (elegir producto, presentación,
 * cantidad y precio), los totales, los renglones extra, el registro y los
 * errores.
 * Cómo lo hace: servicios falsos con dos productos inventados y funciones
 * espía; se interactúa como una persona (clics y texto).
 * Por qué: es la pantalla que más se usa; el registro debe mandar exactamente
 * lo que se ve en pantalla.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Vender, type ServiciosVender } from './Vender'

afterEach(cleanup)

const aguila = { id: 'p1', nombre: 'Cerveza Águila', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const agua = { id: 'p2', nombre: 'Agua Cristal', categoria: 'cerveza' as const, unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 2000, precioCaja: 22000 }

const aguardiente = { id: 'p3', nombre: 'Ron Ejemplo', categoria: 'licor' as const, unidadesPorCaja: 1, manejaSixpack: false, precioUnidad: 50000, precioCaja: 50000 }

function armar(sobre: { registrarVenta?: ServiciosVender['ventas']['registrarVenta'] } = {}) {
  const registrarVenta = vi.fn(sobre.registrarVenta ?? (async () => 'venta-nueva'))
  const servicios: ServiciosVender = {
    inventario: {
      listarProductos: async () => [aguila, agua, aguardiente],
      obtenerStock: async () => new Map([
        ['p1', { bodega: 10, nevera: 4, total: 14 }],
        ['p2', { bodega: 0, nevera: 12, total: 12 }],
        ['p3', { bodega: 2, nevera: 3, total: 5 }],
      ]),
    },
    ventas: { registrarVenta, listarVentas: async () => [], editarVenta: async () => 'x' },
  }
  const alIr = vi.fn()
  render(<Vender servicios={servicios} hoy="2026-11-03" alIr={alIr} />)
  return { registrarVenta, alIr }
}

/** Abre el selector del primer renglón y elige un producto. */
async function elegir(nombre: RegExp, indice = 0) {
  fireEvent.click((await screen.findAllByRole('button', { name: /Producto del renglón/ }))[indice])
  fireEvent.click(await screen.findByRole('radio', { name: nombre }))
}

describe('Vender', () => {
  it('empieza con un renglón vacío y sin poder registrar', async () => {
    armar()
    expect(await screen.findByRole('heading', { name: 'Nueva venta' })).toBeTruthy()
    expect(screen.getByText('Se descuenta de la nevera')).toBeTruthy()
    expect(screen.getByText('Hoy, 03/11/2026')).toBeTruthy()
    expect(screen.getByText('Elegir producto')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Registrar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('al elegir un producto muestra su nombre, stock y el total en unidades', async () => {
    armar()
    await elegir(/Águila/)
    expect(screen.getByText('Cerveza Águila')).toBeTruthy()
    expect(screen.getByText('24 unid/caja · 4 en nevera')).toBeTruthy()
    expect(screen.getByText('Total · 1 unidad')).toBeTruthy()
    expect(screen.getAllByText('$ 3.000').length).toBeGreaterThan(0)
    expect((screen.getByRole('button', { name: 'Registrar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('cambia la cantidad con + y − y no baja de uno', async () => {
    armar()
    await elegir(/Águila/)
    fireEvent.click(screen.getByRole('button', { name: 'Más cantidad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Más cantidad' }))
    expect(screen.getByText('Total · 3 unidades')).toBeTruthy()
    expect(screen.getByText('$ 9.000', { selector: '.dato__total' })).toBeTruthy()
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Menos cantidad' }))
    expect(screen.getByText('Total · 1 unidad')).toBeTruthy()
  })

  it('cambia de presentación y recalcula unidades y total', async () => {
    armar()
    await elegir(/Águila/)
    fireEvent.click(screen.getByRole('radio', { name: 'Sixpack' }))
    expect(screen.getByText('Total · 6 unidades')).toBeTruthy()
    expect(screen.getByText('$ 18.000', { selector: '.dato__total' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Caja' }))
    expect(screen.getByText('Total · 24 unidades')).toBeTruthy()
    expect(screen.getByText('$ 60.000', { selector: '.dato__total' })).toBeTruthy()
  })

  it('un producto sin sixpack no deja elegir sixpack', async () => {
    armar()
    await elegir(/Agua/)
    expect((screen.getByRole('radio', { name: 'Sixpack' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('usa el precio escrito en lugar del de lista', async () => {
    armar()
    await elegir(/Águila/)
    fireEvent.change(screen.getByRole('textbox', { name: 'Precio · opcional' }), { target: { value: '2500' } })
    expect(screen.getByText('$ 2.500', { selector: '.dato__total' })).toBeTruthy()
  })

  it('agrega el renglón nuevo arriba y quita renglones', async () => {
    armar()
    await elegir(/Águila/)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar renglón' }))
    expect(screen.getAllByRole('button', { name: /Producto del renglón/ })).toHaveLength(2)
    // El renglón nuevo es el primero; el de Águila bajó al segundo lugar.
    expect(screen.getAllByRole('button', { name: /Producto del renglón/ })[1].textContent).toMatch(/Águila/)
    await elegir(/Agua/, 0)
    expect(screen.getByText('Total · 2 unidades')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar renglón' })[0])
    expect(screen.getAllByRole('button', { name: /Producto del renglón/ })).toHaveLength(1)
    expect(screen.getByText('$ 3.000', { selector: '.dato__total' })).toBeTruthy()
  })

  it('registra la venta con lo que se ve y pasa a la lista de ventas', async () => {
    const { registrarVenta, alIr } = armar()
    await elegir(/Águila/)
    fireEvent.click(screen.getByRole('button', { name: 'Más cantidad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('mas/ventas'))
    expect(registrarVenta).toHaveBeenCalledWith({
      fecha: '2026-11-03',
      renglones: [{ productoId: 'p1', presentacion: 'unidad', cantidad: 2 }],
    })
  })

  it('manda el precio cobrado solo si se escribió', async () => {
    const { registrarVenta } = armar()
    await elegir(/Águila/)
    fireEvent.change(screen.getByRole('textbox', { name: 'Precio · opcional' }), { target: { value: '2500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(registrarVenta).toHaveBeenCalled())
    expect(registrarVenta.mock.calls[0][0].renglones[0]).toMatchObject({ precioCobrado: 2500 })
  })

  it('si la base rechaza la venta, muestra el motivo y se queda', async () => {
    const { alIr } = armar({ registrarVenta: async () => { throw new Error('Sin conexión') } })
    await elegir(/Águila/)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Sin conexión/)
    expect(alIr).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Registrar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('la flecha de volver regresa al inicio', async () => {
    const { alIr } = armar()
    await screen.findByRole('heading', { name: 'Nueva venta' })
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(alIr).toHaveBeenCalledWith('inicio')
  })

  it('si no cargan los productos, lo dice y deja reintentar', async () => {
    const servicios: ServiciosVender = {
      inventario: { listarProductos: async () => { throw new Error('sin red') }, obtenerStock: async () => new Map() },
      ventas: { registrarVenta: async () => 'x', listarVentas: async () => [], editarVenta: async () => 'x' },
    }
    render(<Vender servicios={servicios} hoy="2026-11-03" alIr={() => {}} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
    expect(within(document.body).getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('un licor se vende por botella: solo esa opción y sin unidades por caja', async () => {
    const { registrarVenta } = armar()
    await elegir(/Ron/)
    expect(screen.getByText('Botella · 3 en nevera')).toBeTruthy()
    expect(screen.getAllByRole('radio', { name: /^(Botella|Unidad|Sixpack|Caja)$/ }).map((r) => r.textContent)).toEqual(['Botella'])
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(registrarVenta).toHaveBeenCalled())
    expect(registrarVenta.mock.calls[0][0].renglones[0]).toMatchObject({ productoId: 'p3', presentacion: 'unidad', cantidad: 1 })
  })

  describe('editar una venta', () => {
    const aguilaVendible = { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
    const guardada = (estado: 'vigente' | 'anulada' = 'vigente') => ({
      id: 'v9',
      fecha: '2026-11-01',
      estado,
      creadoEn: '2026-11-02T03:00:00.000Z',
      renglones: [{ productoId: 'p1', producto: aguilaVendible, presentacion: 'unidad' as const, cantidad: 5, precioCobrado: 3000 }],
    })

    function armarEdicion(estado: 'vigente' | 'anulada' = 'vigente', editarVenta = vi.fn(async () => 'v10')) {
      const registrarVenta = vi.fn(async () => 'x')
      const servicios: ServiciosVender = {
        inventario: { listarProductos: async () => [aguila, agua, aguardiente], obtenerStock: async () => new Map() },
        ventas: { registrarVenta, listarVentas: async () => [guardada(estado)], editarVenta },
      }
      const alIr = vi.fn()
      render(<Vender servicios={servicios} hoy="2026-11-03" ventaId="v9" alIr={alIr} />)
      return { editarVenta, registrarVenta, alIr }
    }

    it('abre la venta ya llena con su fecha y sus renglones', async () => {
      armarEdicion()
      expect(await screen.findByRole('heading', { name: 'Editar venta' })).toBeTruthy()
      expect(await screen.findByText('Cerveza Águila')).toBeTruthy()
      expect(screen.getByText('5', { selector: '.cantidad__valor' })).toBeTruthy()
      expect(screen.getByText(/01\/11\/2026/)).toBeTruthy()
    })

    it('guarda los cambios con el motivo y vuelve a las ventas de ese día', async () => {
      const { editarVenta, registrarVenta, alIr } = armarEdicion()
      await screen.findByText('Cerveza Águila')
      fireEvent.click(screen.getByRole('button', { name: 'Menos cantidad' }))
      fireEvent.change(screen.getByLabelText('Motivo · opcional'), { target: { value: 'Se contó mal' } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(editarVenta).toHaveBeenCalled())
      expect(editarVenta).toHaveBeenCalledWith('v9', { fecha: '2026-11-01', renglones: [{ productoId: 'p1', presentacion: 'unidad', cantidad: 4 }] }, 'Se contó mal')
      expect(registrarVenta).not.toHaveBeenCalled()
      expect(alIr).toHaveBeenCalledWith('mas/ventas/dia/2026-11-01')
    })

    it('sin motivo escrito usa "Venta editada"', async () => {
      const { editarVenta } = armarEdicion()
      await screen.findByText('Cerveza Águila')
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(editarVenta).toHaveBeenCalled())
      expect((editarVenta.mock.calls[0] as unknown[])[2]).toBe('Venta editada')
    })

    it('si la base rechaza la edición muestra el error y no sale', async () => {
      const { alIr } = armarEdicion('vigente', vi.fn(async () => { throw new Error('Sin conexión') }))
      await screen.findByText('Cerveza Águila')
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      expect((await screen.findByRole('alert')).textContent).toMatch(/Sin conexión/)
      expect(alIr).not.toHaveBeenCalled()
    })

    it('una venta anulada no se puede editar', async () => {
      armarEdicion('anulada')
      expect((await screen.findByRole('alert')).textContent).toMatch(/anulada/)
    })

    it('la flecha de volver regresa a las ventas', async () => {
      const { alIr } = armarEdicion()
      await screen.findByRole('heading', { name: 'Editar venta' })
      fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
      expect(alIr).toHaveBeenCalledWith('mas/ventas')
    })
  })
})
