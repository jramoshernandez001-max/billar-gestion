// @vitest-environment jsdom
/**
 * Pruebas del aviso de operaciones pendientes.
 *
 * Qué hace: verifica el texto, el botón de enviar y los botones de las
 * operaciones rechazadas.
 * Cómo lo hace: un servicio falso con estado y suscripción simples.
 * Por qué: es lo único que le dice a la persona que una venta hecha sin
 * internet todavía no está en la base.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AvisoPendientes } from './AvisoPendientes'
import type { EstadoSincronizacion } from '../../sincronizacion/servicioSincronizacion'

afterEach(cleanup)

function servicioCon(inicial: EstadoSincronizacion) {
  let estado = inicial
  const oyentes = new Set<() => void>()
  return {
    estado: () => estado,
    suscribir: (o: () => void) => {
      oyentes.add(o)
      return () => void oyentes.delete(o)
    },
    sincronizar: vi.fn().mockResolvedValue(undefined),
    reintentar: vi.fn(),
    descartar: vi.fn(),
    poner: (nuevo: EstadoSincronizacion) => {
      estado = nuevo
      oyentes.forEach((o) => o())
    },
  }
}

const rechazada = { clave: 'k1', funcion: 'registrar_abono', argumentos: {}, creadoEn: '2026-11-04T06:00:00.000Z', error: 'El abono supera la deuda' }

describe('AvisoPendientes', () => {
  it('no muestra nada si no hay pendientes ni rechazadas', () => {
    render(<AvisoPendientes servicio={servicioCon({ pendientes: 0, rechazadas: [], sincronizando: false })} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('muestra la cantidad en singular y plural', () => {
    const s = servicioCon({ pendientes: 1, rechazadas: [], sincronizando: false })
    render(<AvisoPendientes servicio={s} />)
    expect(screen.getByRole('status').textContent).toMatch(/1 registro pendiente de enviar/)
    act(() => s.poner({ pendientes: 3, rechazadas: [], sincronizando: false }))
    expect(screen.getByRole('status').textContent).toMatch(/3 registros pendientes de enviar/)
  })

  it('"Enviar ahora" fuerza la sincronización y se desactiva mientras envía', () => {
    const s = servicioCon({ pendientes: 2, rechazadas: [], sincronizando: false })
    render(<AvisoPendientes servicio={s} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))
    expect(s.sincronizar).toHaveBeenCalledWith(true)
    act(() => s.poner({ pendientes: 2, rechazadas: [], sincronizando: true }))
    expect((screen.getByRole('button', { name: 'Enviando…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('una rechazada muestra qué fue, el motivo, y permite reintentar o descartar', () => {
    const s = servicioCon({ pendientes: 0, rechazadas: [rechazada], sincronizando: false })
    render(<AvisoPendientes servicio={s} />)
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toMatch(/abono/i)
    expect(alerta.textContent).toMatch(/El abono supera la deuda/)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(s.reintentar).toHaveBeenCalledWith('k1')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(s.descartar).toHaveBeenCalledWith('k1')
  })
})
