// @vitest-environment jsdom
/**
 * Pruebas de la pantalla de cierre (diario y semanal).
 *
 * Qué hace: verifica los campos, la vista previa, los costos manuales de
 * productos sin costo y el guardado.
 * Cómo lo hace: servicio de cierres falso que devuelve resultados hechos a
 * mano según el dinero escrito.
 * Por qué: el cierre es lo más delicado de la app; se ve el resultado antes
 * de guardarlo y los productos sin costo nunca se toman como cero.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Cerrar, type ServiciosCerrar } from './Cerrar'

afterEach(cleanup)

const cuadre = (dineroTotal: number, vendido: number) => {
  const diferencia = dineroTotal - vendido
  return { dineroTotal, diferencia, cuadra: diferencia >= 0, faltante: diferencia < 0 ? -diferencia : 0, sobrante: diferencia > 0 ? diferencia : 0 }
}

function servicios(sobre: Partial<ServiciosCerrar['servicioCierres']> = {}): ServiciosCerrar {
  return {
    inventario: { listarProductos: async () => [{ id: 'p2', nombre: 'Agua Ejemplo', unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 1500, precioCaja: 15000 }] },
    servicioCierres: {
      vistaPreviaCierre: vi.fn(async (d) => ({
        hasta: d.tipo === 'diario' ? d.desde : '2026-11-08',
        costosUsados: [],
        resultado: d.tipo === 'diario'
          ? cuadre(d.efectivo + d.transferencias, 60000)
          : { completo: false, costoReposicion: 1, productosSinCosto: d.costosManuales?.p2 === undefined ? ['p2'] : [], ventasSinCosto: 12000, comprasUsadas: [], costosUsados: [], utilidadEsperada: 20000, cuadre: cuadre(d.efectivo + d.transferencias, 60000) },
      })),
      cerrarPeriodo: vi.fn(async () => 'nuevo'),
      ...sobre,
    },
  }
}

const dibujar = (s: ServiciosCerrar, tipo: 'diario' | 'semanal', alIr = vi.fn()) => render(<Cerrar servicios={s} tipo={tipo} hoy="2026-11-04" alIr={alIr} />)

describe('Cerrar', () => {
  it('diario: calcula la vista previa con el dinero escrito', async () => {
    const s = servicios()
    dibujar(s, 'diario')
    fireEvent.change(await screen.findByLabelText('Efectivo'), { target: { value: '40000' } })
    fireEvent.change(screen.getByLabelText('Transferencias'), { target: { value: '15000' } })
    expect(await screen.findByText('Faltante de $ 5.000')).toBeTruthy()
    expect(s.servicioCierres.vistaPreviaCierre).toHaveBeenLastCalledWith({ tipo: 'diario', desde: '2026-11-04', efectivo: 40000, transferencias: 15000, costosManuales: {} })
  })

  it('guarda el cierre y va a su detalle', async () => {
    const s = servicios()
    const alIr = vi.fn()
    dibujar(s, 'diario', alIr)
    fireEvent.change(await screen.findByLabelText('Efectivo'), { target: { value: '60000' } })
    await screen.findByText('Cuadra')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar día' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('mas/cierres/nuevo'))
    expect(s.servicioCierres.cerrarPeriodo).toHaveBeenCalledWith({ tipo: 'diario', desde: '2026-11-04', efectivo: 60000, transferencias: 0, costosManuales: {} })
  })

  it('semanal: usa el lunes de la semana de hoy', async () => {
    const s = servicios()
    dibujar(s, 'semanal')
    await waitFor(() => expect(s.servicioCierres.vistaPreviaCierre).toHaveBeenCalled())
    expect(vi.mocked(s.servicioCierres.vistaPreviaCierre).mock.calls[0][0].desde).toBe('2026-11-02')
    expect(await screen.findByText('02/11 – 08/11')).toBeTruthy()
  })

  it('semanal incompleto pide el costo por unidad de cada producto sin costo', async () => {
    const s = servicios()
    dibujar(s, 'semanal')
    const campo = await screen.findByLabelText('Costo por unidad · Agua Ejemplo')
    fireEvent.change(campo, { target: { value: '800' } })
    await waitFor(() => expect(vi.mocked(s.servicioCierres.vistaPreviaCierre).mock.calls.at(-1)?.[0].costosManuales).toEqual({ p2: 800 }))
  })

  it('cambiar de tipo cambia la ruta', async () => {
    const alIr = vi.fn()
    dibujar(servicios(), 'diario', alIr)
    fireEvent.click(await screen.findByRole('radio', { name: 'Semanal' }))
    expect(alIr).toHaveBeenCalledWith('cierres/semanal')
  })

  it('si falla el cálculo o el guardado muestra el error', async () => {
    dibujar(servicios({ vistaPreviaCierre: async () => { throw new Error('sin red') } }), 'diario')
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
    cleanup()
    dibujar(servicios({ cerrarPeriodo: async () => { throw new Error('ya existe un cierre') } }), 'diario')
    fireEvent.change(await screen.findByLabelText('Efectivo'), { target: { value: '60000' } })
    await screen.findByText('Cuadra')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar día' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya existe/)
  })
})
