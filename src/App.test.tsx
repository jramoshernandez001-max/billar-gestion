// @vitest-environment jsdom
/**
 * Pruebas de la pantalla principal.
 *
 * Qué hace: verifica que la app muestre su contenido solo al usuario
 * autorizado, la pantalla de entrar con Google a quien no tiene sesión, y que
 * la navegación inferior cambie de pantalla.
 * Cómo lo hace: renderiza App con un servicio de acceso falso y servicios de
 * datos vacíos.
 * Por qué: App es lo que conecta el control de acceso, las rutas y las
 * pantallas.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { serviciosVacios } from './interfaz/apoyoPruebas'
import type { EstadoAcceso, ServicioAcceso } from './autenticacion/servicioAcceso'

beforeEach(() => {
  window.location.hash = ''
})
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

const autorizado = servicioCon({ tipo: 'autorizado', correo: 'ana@ejemplo.com', nombre: 'Ana' })

describe('App', () => {
  it('a un usuario autorizado le muestra el inicio con su nombre y la navegación', async () => {
    render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByText('Hola, Ana')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeTruthy()
  })

  it('sin sesión solo ofrece entrar con Google, sin navegación', () => {
    render(<App servicio={servicioCon({ tipo: 'sin-sesion' })} servicios={serviciosVacios()} />)
    expect(screen.getByRole('button', { name: /google/i })).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('un usuario no autorizado no ve nada de la app', () => {
    render(<App servicio={servicioCon({ tipo: 'no-autorizado', correo: 'x@ejemplo.com' })} servicios={serviciosVacios()} />)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByText(/Hola/)).toBeNull()
  })

  it('la navegación cambia de pantalla y resalta la pestaña', async () => {
    render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    await screen.findByText('Hola, Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Deudas' }))
    expect(await screen.findByText(/está en construcción/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Deudas' }).getAttribute('aria-current')).toBe('page')
  })
})
