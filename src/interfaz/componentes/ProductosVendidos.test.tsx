// @vitest-environment jsdom
/**
 * Pruebas de la lista de productos vendidos.
 *
 * Qué hace: verifica el aviso cuando no hubo ventas y la fila y totales
 * cuando sí.
 * Cómo lo hace: renderiza con datos ya calculados.
 * Por qué: el detalle del cierre depende de que estos dos casos se vean bien.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ProductosVendidos } from './ProductosVendidos'

afterEach(cleanup)

describe('ProductosVendidos', () => {
  it('sin ventas lo dice y no muestra total', () => {
    render(<ProductosVendidos datos={{ filas: [], totalUnidades: 0, totalValor: 0, ventas: 0, cajasCerveza: { cajas: 0, sueltas: 0 } }} />)
    expect(screen.getByText('No hubo ventas vigentes en este periodo.')).toBeTruthy()
    expect(screen.queryByText(/^Total/)).toBeNull()
  })

  it('con ventas muestra cada producto con su desglose y el total', () => {
    render(
      <ProductosVendidos
        datos={{
          filas: [{ productoId: 'p', nombre: 'Ron Ejemplo', categoria: 'licor', unidades: 2, valor: 100000, desglose: '2 botellas' }],
          totalUnidades: 2,
          totalValor: 100000,
          ventas: 1,
          cajasCerveza: { cajas: 0, sueltas: 0 },
        }}
      />,
    )
    expect(screen.getByText(/Ron Ejemplo/)).toBeTruthy()
    expect(screen.getByText(/2 botellas/)).toBeTruthy()
    expect(screen.getByText('Total · 2 unidades')).toBeTruthy()
    expect(screen.getAllByText('$ 100.000')).toHaveLength(2)
  })

  describe('cajas de cerveza de la semana', () => {
    const datos = {
      filas: [{ productoId: 'c', nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const, unidades: 77, valor: 231000, desglose: '3 cajas · 5 unidades' }],
      totalUnidades: 77,
      totalValor: 231000,
      ventas: 2,
      cajasCerveza: { cajas: 3, sueltas: 5 },
    }

    it('con mostrarCajas muestra el total de cajas y las sueltas', () => {
      render(<ProductosVendidos datos={datos} mostrarCajas />)
      expect(screen.getByText('Cajas de cerveza vendidas')).toBeTruthy()
      expect(screen.getByText('3 cajas + 5 unidades')).toBeTruthy()
    })

    it('sin sueltas no las menciona, y en singular dice caja', () => {
      render(<ProductosVendidos datos={{ ...datos, cajasCerveza: { cajas: 1, sueltas: 0 } }} mostrarCajas />)
      expect(screen.getByText('1 caja')).toBeTruthy()
    })

    it('sin mostrarCajas (cierre diario) no aparece', () => {
      render(<ProductosVendidos datos={datos} />)
      expect(screen.queryByText('Cajas de cerveza vendidas')).toBeNull()
    })
  })
})
