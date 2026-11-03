// @vitest-environment jsdom
/**
 * Pruebas de la pantalla principal.
 *
 * Qué hace: verifica que la app muestre su contenido solo al usuario
 * autorizado y la pantalla de entrar con Google a quien no tiene sesión.
 * Cómo lo hace: renderiza App con un servicio de acceso falso.
 * Por qué: App es lo que conecta el control de acceso con el contenido.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import App from './App'
import type { EstadoAcceso, ServicioAcceso } from './autenticacion/servicioAcceso'

afterEach(cleanup)

const servicioCon = (estado: EstadoAcceso): ServicioAcceso => ({
  resolverEstado: vi.fn(async () => estado),
  suscribir: vi.fn((alCambiar) => {
    alCambiar(estado)
    return () => {}
  }),
  iniciarSesion: vi.fn(async () => {}),
  cerrarSesion: vi.fn(async () => {}),
})

describe('App', () => {
  it('a un usuario autorizado le muestra la app con su correo', () => {
    render(<App servicio={servicioCon({ tipo: 'autorizado', correo: 'ana@ejemplo.com' })} />)
    expect(screen.getByText(/ana@ejemplo\.com/)).toBeTruthy()
  })

  it('sin sesión solo ofrece entrar con Google', () => {
    render(<App servicio={servicioCon({ tipo: 'sin-sesion' })} />)
    expect(screen.getByRole('button', { name: /google/i })).toBeTruthy()
    expect(screen.queryByText(/Sesión iniciada/)).toBeNull()
  })
})
