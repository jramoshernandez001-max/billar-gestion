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
    iniciarSesionConCodigo: vi.fn(async () => {}),
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
    fireEvent.click(screen.getByRole('button', { name: 'Más' }))
    expect(await screen.findByRole('heading', { name: 'Más' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Más' }).getAttribute('aria-current')).toBe('page')
  })

  it('la ruta #/vender abre la nueva venta y #/mas/ventas el listado de ventas', async () => {
    window.location.hash = '#/vender'
    const { unmount } = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Nueva venta' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Vender' }).getAttribute('aria-current')).toBe('page')
    unmount()
    window.location.hash = '#/mas/ventas'
    render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Más' }).getAttribute('aria-current')).toBe('page')
    window.location.hash = ''
  })

  it('las rutas de inventario abren la lista, trasladar y ajustar con el producto de la ruta', async () => {
    window.location.hash = '#/inventario'
    const primera = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeTruthy()
    primera.unmount()
    window.location.hash = '#/inventario/trasladar/abc'
    const segunda = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Trasladar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Inventario' }).getAttribute('aria-current')).toBe('page')
    segunda.unmount()
    window.location.hash = '#/inventario/ajustar/abc'
    render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Ajustar stock' })).toBeTruthy()
    window.location.hash = ''
  })

  it('las rutas de compras abren nueva compra, historial y corregir costo', async () => {
    window.location.hash = '#/inventario/comprar/abc'
    const a = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Nueva compra' })).toBeTruthy()
    a.unmount()
    window.location.hash = '#/mas/compras'
    const b = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Compras' })).toBeTruthy()
    b.unmount()
    window.location.hash = '#/mas/compras/corregir/abc'
    render(<App servicio={autorizado} servicios={serviciosVacios()} />)
    expect(await screen.findByRole('heading', { name: 'Corregir costo' })).toBeTruthy()
    window.location.hash = ''
  })

  it('las rutas de productos abren lista, nuevo y editar (también desde inventario)', async () => {
    for (const [hash, titulo] of [['#/mas/productos', 'Productos'], ['#/mas/productos/nuevo', 'Nuevo producto'], ['#/mas/productos/editar/abc', 'Editar producto'], ['#/inventario/editar/abc', 'Editar producto']]) {
      window.location.hash = hash
      const r = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
      expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy()
      r.unmount()
    }
    window.location.hash = ''
  })

  it('las rutas de deudas abren lista, nueva, abonar y detalle', async () => {
    for (const [hash, titulo] of [['#/deudas', 'Deudas'], ['#/deudas/nueva', 'Nueva deuda'], ['#/deudas/abonar/abc', 'Abonar'], ['#/deudas/abc', 'Detalle de deuda']]) {
      window.location.hash = hash
      const r = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
      expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Deudas' }).getAttribute('aria-current')).toBe('page')
      r.unmount()
    }
    window.location.hash = ''
  })

  it('las rutas de ventas abren editar venta y las ventas de un día', async () => {
    for (const [hash, titulo] of [['#/mas/ventas/editar/abc', 'Editar venta'], ['#/mas/ventas/dia/2026-11-01', 'Ventas']]) {
      window.location.hash = hash
      const r = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
      expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy()
      r.unmount()
    }
    window.location.hash = ''
  })

  it('las rutas de cierres abren cerrar día, cerrar semana, historial y detalle', async () => {
    for (const [hash, titulo] of [['#/cierres/diario', 'Cerrar día'], ['#/cierres/semanal', 'Cerrar semana'], ['#/mas/cierres', 'Cierres'], ['#/mas/cierres/abc', 'Cierre']]) {
      window.location.hash = hash
      const r = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
      expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy()
      r.unmount()
    }
    window.location.hash = ''
  })

  it('las rutas de Más abren el menú, la bitácora, su detalle y resúmenes', async () => {
    for (const [hash, titulo] of [['#/mas', 'Más'], ['#/mas/bitacora', 'Bitácora'], ['#/mas/bitacora/abc', 'Detalle'], ['#/mas/resumenes', 'Resúmenes']]) {
      window.location.hash = hash
      const r = render(<App servicio={autorizado} servicios={serviciosVacios()} />)
      expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy()
      r.unmount()
    }
    window.location.hash = ''
  })
})
