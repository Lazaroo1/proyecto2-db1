import { useEffect, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:3000'
const GTQ_FORMATTER = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  minimumFractionDigits: 2,
})

const emptyClientForm = {
  id: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
}

const emptyProductForm = {
  id: '',
  nombre: '',
  precio: '',
  stock: '',
  idCategoria: '',
  idProveedor: '',
}

const initialSaleForm = {
  clientId: '',
  employeeId: '',
  productId: '',
  quantity: 1,
}

const initialLoginForm = {
  username: '',
  password: '',
}

function formatCurrency(value) {
  const number = Number(value)
  if (Number.isNaN(number)) {
    return value
  }

  return GTQ_FORMATTER.format(number)
}

function formatCellValue(columnKey, value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const currencyColumns = ['precio', 'subtotal', 'total', 'ingresos', 'promedio', 'total_mes']

  if (currencyColumns.some((token) => columnKey.includes(token))) {
    return formatCurrency(value)
  }

  return value
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(payload.error || 'La solicitud no se pudo completar.')
    error.status = response.status
    throw error
  }

  return payload
}

function DataTable({ columns, rows }) {
  if (!rows.length) {
    return <p className="empty-state">No hay datos para mostrar en esta consulta.</p>
  }

  return (
    <div className="table-shell">
      <table className="query-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[columns[0].key] ?? 'row'}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{formatCellValue(column.key, row[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [authStatus, setAuthStatus] = useState('checking')
  const [user, setUser] = useState(null)
  const [loginForm, setLoginForm] = useState(initialLoginForm)
  const [loginFeedback, setLoginFeedback] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [sections, setSections] = useState([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [report, setReport] = useState({
    metrics: null,
    topCategories: [],
    recentSales: [],
  })
  const [options, setOptions] = useState({
    clients: [],
    employees: [],
    products: [],
    categories: [],
    providers: [],
  })
  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [saleForm, setSaleForm] = useState(initialSaleForm)
  const [clientForm, setClientForm] = useState(emptyClientForm)
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submittingSale, setSubmittingSale] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [saleFeedback, setSaleFeedback] = useState(null)
  const [clientFeedback, setClientFeedback] = useState(null)
  const [productFeedback, setProductFeedback] = useState(null)

  async function loadAppData(showLoader = true) {
    if (showLoader) {
      setLoading(true)
    }

    try {
      setError('')

      const [dashboardData, optionsData, clientsData, productsData, reportData] = await Promise.all([
        fetchJson('/api/dashboard'),
        fetchJson('/api/options'),
        fetchJson('/api/clients'),
        fetchJson('/api/products'),
        fetchJson('/api/reports/overview'),
      ])

      setSections(dashboardData.sections ?? [])
      setGeneratedAt(dashboardData.generatedAt ?? '')
      setOptions(optionsData)
      setClients(clientsData)
      setProducts(productsData)
      setReport(reportData)
    } catch (loadError) {
      if (loadError.status === 401) {
        setAuthStatus('unauthenticated')
        setUser(null)
        setLoginFeedback({
          type: 'error',
          message: 'Tu sesion expiro. Vuelve a iniciar sesion.',
        })
      } else {
        setError(loadError.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function bootstrapSession() {
    setAuthStatus('checking')

    try {
      const payload = await fetchJson('/api/auth/me', {
        headers: {},
      })
      setUser(payload.user)
      setAuthStatus('authenticated')
      await loadAppData()
    } catch (sessionError) {
      if (sessionError.status === 401) {
        setAuthStatus('unauthenticated')
        setUser(null)
        setLoading(false)
      } else {
        setAuthStatus('unauthenticated')
        setError(sessionError.message)
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    bootstrapSession()
  }, [])

  useEffect(() => {
    if (!options.clients.length || !options.employees.length || !options.products.length) {
      return
    }

    setSaleForm((currentForm) => ({
      clientId:
        options.clients.some((client) => String(client.id_cliente) === String(currentForm.clientId))
          ? currentForm.clientId
          : String(options.clients[0].id_cliente),
      employeeId:
        options.employees.some(
          (employee) => String(employee.id_empleado) === String(currentForm.employeeId)
        )
          ? currentForm.employeeId
          : String(options.employees[0].id_empleado),
      productId:
        options.products.some((product) => String(product.id_producto) === String(currentForm.productId))
          ? currentForm.productId
          : String(options.products[0].id_producto),
      quantity: currentForm.quantity || 1,
    }))
  }, [options.clients, options.employees, options.products])

  useEffect(() => {
    if (!options.categories.length || !options.providers.length) {
      return
    }

    setProductForm((currentForm) => ({
      ...currentForm,
      idCategoria:
        currentForm.idCategoria ||
        String(options.categories[0].id_categoria),
      idProveedor:
        currentForm.idProveedor ||
        String(options.providers[0].id_proveedor),
    }))
  }, [options.categories, options.providers])

  function resetClientForm() {
    setClientForm(emptyClientForm)
  }

  function resetProductForm() {
    setProductForm({
      ...emptyProductForm,
      idCategoria: options.categories[0] ? String(options.categories[0].id_categoria) : '',
      idProveedor: options.providers[0] ? String(options.providers[0].id_proveedor) : '',
    })
  }

  function handleLoginFieldChange(event) {
    const { name, value } = event.target
    setLoginForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  function handleClientFieldChange(event) {
    const { name, value } = event.target
    setClientForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  function handleProductFieldChange(event) {
    const { name, value } = event.target
    setProductForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  function handleSaleFieldChange(event) {
    const { name, value } = event.target
    setSaleForm((currentForm) => ({
      ...currentForm,
      [name]: name === 'quantity' ? Number(value) : value,
    }))
  }

  async function handleLoginSubmit(event) {
    event.preventDefault()
    setLoggingIn(true)
    setLoginFeedback(null)

    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setLoginFeedback({
        type: 'error',
        message: 'Debes ingresar usuario y contraseña.',
      })
      setLoggingIn(false)
      return
    }

    try {
      const payload = await fetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })

      setUser(payload.user)
      setAuthStatus('authenticated')
      setLoginForm(initialLoginForm)
      setLoginFeedback({
        type: 'success',
        message: `Bienvenido, ${payload.user.nombreMostrar}.`,
      })
      await loadAppData()
    } catch (loginError) {
      setLoginFeedback({
        type: 'error',
        message: loginError.message,
      })
      setAuthStatus('unauthenticated')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)

    try {
      await fetchJson('/api/auth/logout', {
        method: 'POST',
        headers: {},
      })
    } catch (logoutError) {
      console.error(logoutError)
    } finally {
      setLoggingOut(false)
      setAuthStatus('unauthenticated')
      setUser(null)
      setSections([])
      setReport({ metrics: null, topCategories: [], recentSales: [] })
      setClients([])
      setProducts([])
    }
  }

  async function handleExportPdf() {
    setDownloadingPdf(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/reports/overview/pdf`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const error = new Error(payload.error || 'No se pudo exportar el PDF.')
        error.status = response.status
        throw error
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'reporte-ejecutivo-tienda.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (pdfError) {
      if (pdfError.status === 401) {
        setAuthStatus('unauthenticated')
        setUser(null)
      } else {
        setError(pdfError.message)
      }
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function handleSubmitSale(event) {
    event.preventDefault()
    setSubmittingSale(true)
    setSaleFeedback(null)

    try {
      const payload = await fetchJson('/api/transactions/sales', {
        method: 'POST',
        body: JSON.stringify({
          clientId: Number(saleForm.clientId),
          employeeId: Number(saleForm.employeeId),
          productId: Number(saleForm.productId),
          quantity: Number(saleForm.quantity),
        }),
      })

      setSaleFeedback({
        type: 'success',
        message: `Venta #${payload.saleId} registrada. Stock restante: ${payload.stockRestante}.`,
      })

      await loadAppData(false)
    } catch (submitError) {
      setSaleFeedback({
        type: 'error',
        message: submitError.message,
      })
    } finally {
      setSubmittingSale(false)
    }
  }

  async function handleSubmitClient(event) {
    event.preventDefault()
    setSavingClient(true)
    setClientFeedback(null)

    if (!clientForm.nombre.trim()) {
      setClientFeedback({ type: 'error', message: 'Debes ingresar el nombre del cliente.' })
      setSavingClient(false)
      return
    }

    if (!clientForm.apellido.trim()) {
      setClientFeedback({ type: 'error', message: 'Debes ingresar el apellido del cliente.' })
      setSavingClient(false)
      return
    }

    if (!clientForm.email.trim()) {
      setClientFeedback({ type: 'error', message: 'Debes ingresar el correo del cliente.' })
      setSavingClient(false)
      return
    }

    try {
      const isEditing = Boolean(clientForm.id)
      const payload = await fetchJson(
        isEditing ? `/api/clients/${clientForm.id}` : '/api/clients',
        {
          method: isEditing ? 'PUT' : 'POST',
          body: JSON.stringify({
            nombre: clientForm.nombre,
            apellido: clientForm.apellido,
            email: clientForm.email,
            telefono: clientForm.telefono,
          }),
        }
      )

      setClientFeedback({
        type: 'success',
        message: payload.message,
      })
      resetClientForm()
      await loadAppData(false)
    } catch (submitError) {
      setClientFeedback({
        type: 'error',
        message: submitError.message,
      })
    } finally {
      setSavingClient(false)
    }
  }

  async function handleSubmitProduct(event) {
    event.preventDefault()
    setSavingProduct(true)
    setProductFeedback(null)

    if (!productForm.nombre.trim()) {
      setProductFeedback({ type: 'error', message: 'Debes ingresar el nombre del producto.' })
      setSavingProduct(false)
      return
    }

    if (!productForm.precio || Number(productForm.precio) <= 0) {
      setProductFeedback({ type: 'error', message: 'El precio debe ser mayor a cero.' })
      setSavingProduct(false)
      return
    }

    if (productForm.stock === '' || Number(productForm.stock) < 0) {
      setProductFeedback({
        type: 'error',
        message: 'El stock debe ser un entero mayor o igual a cero.',
      })
      setSavingProduct(false)
      return
    }

    try {
      const isEditing = Boolean(productForm.id)
      const payload = await fetchJson(
        isEditing ? `/api/products/${productForm.id}` : '/api/products',
        {
          method: isEditing ? 'PUT' : 'POST',
          body: JSON.stringify({
            nombre: productForm.nombre,
            precio: Number(productForm.precio),
            stock: Number(productForm.stock),
            idCategoria: Number(productForm.idCategoria),
            idProveedor: Number(productForm.idProveedor),
          }),
        }
      )

      setProductFeedback({
        type: 'success',
        message: payload.message,
      })
      resetProductForm()
      await loadAppData(false)
    } catch (submitError) {
      setProductFeedback({
        type: 'error',
        message: submitError.message,
      })
    } finally {
      setSavingProduct(false)
    }
  }

  function startEditingClient(client) {
    setClientFeedback(null)
    setClientForm({
      id: String(client.id_cliente),
      nombre: client.nombre,
      apellido: client.apellido ?? '',
      email: client.email ?? '',
      telefono: client.telefono ?? '',
    })
  }

  function startEditingProduct(product) {
    setProductFeedback(null)
    setProductForm({
      id: String(product.id_producto),
      nombre: product.nombre,
      precio: String(product.precio),
      stock: String(product.stock),
      idCategoria: String(product.idCategoria),
      idProveedor: String(product.idProveedor),
    })
  }

  async function handleDeleteClient(client) {
    const confirmed = window.confirm(`Eliminar a ${client.nombre} ${client.apellido}?`)
    if (!confirmed) {
      return
    }

    setClientFeedback(null)

    try {
      const payload = await fetchJson(`/api/clients/${client.id_cliente}`, {
        method: 'DELETE',
        headers: {},
      })

      setClientFeedback({ type: 'success', message: payload.message })
      if (String(client.id_cliente) === clientForm.id) {
        resetClientForm()
      }
      await loadAppData(false)
    } catch (deleteError) {
      setClientFeedback({ type: 'error', message: deleteError.message })
    }
  }

  async function handleDeleteProduct(product) {
    const confirmed = window.confirm(`Eliminar el producto ${product.nombre}?`)
    if (!confirmed) {
      return
    }

    setProductFeedback(null)

    try {
      const payload = await fetchJson(`/api/products/${product.id_producto}`, {
        method: 'DELETE',
        headers: {},
      })

      setProductFeedback({ type: 'success', message: payload.message })
      if (String(product.id_producto) === productForm.id) {
        resetProductForm()
      }
      await loadAppData(false)
    } catch (deleteError) {
      setProductFeedback({ type: 'error', message: deleteError.message })
    }
  }

  const selectedProduct = options.products.find(
    (product) => String(product.id_producto) === String(saleForm.productId)
  )

  const reportCards = report.metrics
    ? [
        {
          label: 'Productos activos',
          value: report.metrics.total_productos,
          detail: 'Items registrados en inventario.',
        },
        {
          label: 'Clientes registrados',
          value: report.metrics.total_clientes,
          detail: 'Base de clientes disponible para ventas.',
        },
        {
          label: 'Unidades en stock',
          value: report.metrics.unidades_en_stock,
          detail: 'Suma del stock actual de todos los productos.',
        },
        {
          label: 'Ventas del mes',
          value: formatCurrency(report.metrics.ventas_mes_actual),
          detail: 'Ingresos acumulados en el mes actual.',
        },
      ]
    : []

  const categoryCount = sections.reduce((accumulator, section) => {
    accumulator[section.category] = (accumulator[section.category] || 0) + 1
    return accumulator
  }, {})

  if (authStatus === 'checking') {
    return (
      <div className="auth-shell">
        <article className="auth-card">
          <p className="eyebrow">Verificando sesion</p>
          <h1>Cargando panel de la tienda...</h1>
          <p className="hero-text">Estamos comprobando si ya tienes una sesion activa.</p>
        </article>
      </div>
    )
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="auth-shell">
        <article className="auth-card">
          <p className="eyebrow">Acceso protegido</p>
          <h1>Inicio de sesión </h1>
          <p className="hero-text">
            Esta version incluye autenticacion con login/logout y sesion persistida por
            cookie HttpOnly.
          </p>

          <form className="login-form" onSubmit={handleLoginSubmit}>
            <label className="field">
              <span>Usuario</span>
              <input
                name="username"
                type="text"
                value={loginForm.username}
                onChange={handleLoginFieldChange}
                required
              />
            </label>

            <label className="field">
              <span>Contraseña</span>
              <input
                name="password"
                type="password"
                value={loginForm.password}
                onChange={handleLoginFieldChange}
                required
              />
            </label>

            <button className="primary-btn" disabled={loggingIn} type="submit">
              {loggingIn ? 'Entrando...' : 'Iniciar sesion'}
            </button>
          </form>

          {loginFeedback ? (
            <div className={`status-banner ${loginFeedback.type}`}>{loginFeedback.message}</div>
          ) : null}

          <div className="demo-credentials">
            <h3>Credenciales de prueba</h3>
            <p>
              <strong>Usuario:</strong> <code>admin</code>
            </p>
            <p>
              <strong>Contraseña:</strong> <code>tienda2026</code>
            </p>
            <p className="hint">También funcionan: "ventas" e "inventario" con la misma contraseña</p>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Proyecto 2 DB1 - Lázaro Díaz 24713</p>
          <h1>Inventario, ventas y reportes exportables</h1>
          <p className="hero-text">
            Esta interfaz incluye autenticación con login/logout y sesion, exportacion del
            reporte ejecutivo a PDF, CRUD de clientes y productos, y el dashboard SQL completo.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-chip user-chip">
            <span>Sesion activa</span>
            <strong>{user?.nombreMostrar}</strong>
            <small>{user?.username} · {user?.cargo}</small>
          </div>
          <div className="meta-chip">
            <span>Consultas SQL visibles</span>
            <strong>{sections.length}</strong>
          </div>
          <div className="meta-chip">
            <span>Ultima carga</span>
            <strong>{generatedAt ? new Date(generatedAt).toLocaleString('es-GT') : 'Pendiente'}</strong>
          </div>
          <div className="top-actions">
            <button className="secondary-btn" type="button" onClick={() => loadAppData()}>
              Recargar aplicacion
            </button>
            <button className="ghost-btn" disabled={loggingOut} type="button" onClick={handleLogout}>
              {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </header>

      <section className="report-panel">
        <div className="section-heading report-heading">
          <div>
            <span className="pill pill-report">REPORTE</span>
            <h2>Reporte ejecutivo con datos reales</h2>
            <p>
              Este reporte se alimenta desde la base de datos y ahora puede exportarse a PDF
              directamente desde la interfaz.
            </p>
          </div>

          <button className="primary-btn" disabled={downloadingPdf} type="button" onClick={handleExportPdf}>
            {downloadingPdf ? 'Generando PDF...' : 'Exportar reporte a PDF'}
          </button>
        </div>

        <div className="summary-grid">
          {reportCards.map((card) => (
            <article className="summary-card" key={card.label}>
              <span className="summary-label">{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        <div className="report-grid">
          <article className="mini-card">
            <h3>Top categorias por ingresos</h3>
            <div className="mini-list">
              {report.topCategories?.map((item) => (
                <div className="mini-list-item" key={item.categoria}>
                  <span>{item.categoria}</span>
                  <strong>{formatCurrency(item.ingresos)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="mini-card">
            <h3>Ventas recientes</h3>
            <div className="mini-list">
              {report.recentSales?.map((sale) => (
                <div className="mini-list-item" key={sale.id_venta}>
                  <span>
                    Venta #{sale.id_venta} - {sale.cliente}
                  </span>
                  <strong>{formatCurrency(sale.total_venta)}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="crud-grid">
        <article className="management-card">
          <div className="section-heading">
            <span className="pill pill-crud">CRUD</span>
            <h2>Gestion de clientes</h2>
            <p>
              Crea, edita, lista y elimina clientes desde la interfaz. Los mensajes de validacion
              y error se muestran aqui mismo.
            </p>
          </div>

          <form className="entity-form" onSubmit={handleSubmitClient}>
            <div className="entity-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  name="nombre"
                  type="text"
                  value={clientForm.nombre}
                  onChange={handleClientFieldChange}
                  required
                />
              </label>

              <label className="field">
                <span>Apellido</span>
                <input
                  name="apellido"
                  type="text"
                  value={clientForm.apellido}
                  onChange={handleClientFieldChange}
                  required
                />
              </label>

              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  value={clientForm.email}
                  onChange={handleClientFieldChange}
                  required
                />
              </label>

              <label className="field">
                <span>Telefono</span>
                <input
                  name="telefono"
                  type="text"
                  value={clientForm.telefono}
                  onChange={handleClientFieldChange}
                />
              </label>
            </div>

            <div className="entity-actions">
              <button className="primary-btn" disabled={savingClient} type="submit">
                {savingClient
                  ? 'Guardando...'
                  : clientForm.id
                    ? 'Actualizar cliente'
                    : 'Crear cliente'}
              </button>
              <button className="ghost-btn" type="button" onClick={resetClientForm}>
                Limpiar formulario
              </button>
            </div>
          </form>

          {clientFeedback ? (
            <div className={`status-banner ${clientFeedback.type}`}>{clientFeedback.message}</div>
          ) : null}

          <div className="table-shell">
            <table className="query-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Telefono</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id_cliente}>
                    <td>
                      {client.nombre} {client.apellido}
                    </td>
                    <td>{client.email}</td>
                    <td>{client.telefono || '-'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-btn" type="button" onClick={() => startEditingClient(client)}>
                          Editar
                        </button>
                        <button
                          className="mini-btn danger"
                          type="button"
                          onClick={() => handleDeleteClient(client)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="management-card">
          <div className="section-heading">
            <span className="pill pill-crud">CRUD</span>
            <h2>Gestion de productos</h2>
            <p>
              Administra productos, precio, stock, categoria y proveedor desde la interfaz sin
              salir del navegador.
            </p>
          </div>

          <form className="entity-form" onSubmit={handleSubmitProduct}>
            <div className="entity-grid">
              <label className="field field-wide">
                <span>Nombre</span>
                <input
                  name="nombre"
                  type="text"
                  value={productForm.nombre}
                  onChange={handleProductFieldChange}
                  required
                />
              </label>

              <label className="field">
                <span>Precio</span>
                <input
                  min="0.01"
                  name="precio"
                  step="0.01"
                  type="number"
                  value={productForm.precio}
                  onChange={handleProductFieldChange}
                  required
                />
              </label>

              <label className="field">
                <span>Stock</span>
                <input
                  min="0"
                  name="stock"
                  step="1"
                  type="number"
                  value={productForm.stock}
                  onChange={handleProductFieldChange}
                  required
                />
              </label>

              <label className="field">
                <span>Categoria</span>
                <select
                  name="idCategoria"
                  value={productForm.idCategoria}
                  onChange={handleProductFieldChange}
                  required
                >
                  {options.categories.map((category) => (
                    <option key={category.id_categoria} value={category.id_categoria}>
                      {category.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Proveedor</span>
                <select
                  name="idProveedor"
                  value={productForm.idProveedor}
                  onChange={handleProductFieldChange}
                  required
                >
                  {options.providers.map((provider) => (
                    <option key={provider.id_proveedor} value={provider.id_proveedor}>
                      {provider.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="entity-actions">
              <button className="primary-btn" disabled={savingProduct} type="submit">
                {savingProduct
                  ? 'Guardando...'
                  : productForm.id
                    ? 'Actualizar producto'
                    : 'Crear producto'}
              </button>
              <button className="ghost-btn" type="button" onClick={resetProductForm}>
                Limpiar formulario
              </button>
            </div>
          </form>

          {productFeedback ? (
            <div className={`status-banner ${productFeedback.type}`}>{productFeedback.message}</div>
          ) : null}

          <div className="table-shell">
            <table className="query-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Proveedor</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id_producto}>
                    <td>{product.nombre}</td>
                    <td>{product.categoria}</td>
                    <td>{product.proveedor}</td>
                    <td>{formatCurrency(product.precio)}</td>
                    <td>{product.stock}</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-btn" type="button" onClick={() => startEditingProduct(product)}>
                          Editar
                        </button>
                        <button
                          className="mini-btn danger"
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="summary-grid query-summary-grid">
        {Object.entries(categoryCount).map(([category, total]) => (
          <article className="summary-card" key={category}>
            <span className="summary-label">{category}</span>
            <strong>{total}</strong>
            <p>Consultas visibles en la UI para esta categoria.</p>
          </article>
        ))}
      </section>

      <section className="transaction-panel">
        <div className="section-heading">
          <span className="pill pill-transaction">TRANSACCION</span>
          <h2>Registrar una venta con BEGIN / COMMIT / ROLLBACK</h2>
          <p>
            Esta accion inserta en <code>venta</code>, inserta en <code>detalle_venta</code> y
            descuenta stock en <code>producto</code>. Si algo falla, el backend hace{' '}
            <code>ROLLBACK</code>.
          </p>
        </div>

        <form className="sale-form" onSubmit={handleSubmitSale}>
          <div className="form-grid">
            <label className="field">
              <span>Cliente</span>
              <select name="clientId" value={saleForm.clientId} onChange={handleSaleFieldChange} required>
                {options.clients.map((client) => (
                  <option key={client.id_cliente} value={client.id_cliente}>
                    {client.cliente}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Empleado</span>
              <select
                name="employeeId"
                value={saleForm.employeeId}
                onChange={handleSaleFieldChange}
                required
              >
                {options.employees.map((employee) => (
                  <option key={employee.id_empleado} value={employee.id_empleado}>
                    {employee.empleado}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-wide">
              <span>Producto</span>
              <select
                name="productId"
                value={saleForm.productId}
                onChange={handleSaleFieldChange}
                required
              >
                {options.products.map((product) => (
                  <option key={product.id_producto} value={product.id_producto}>
                    {product.producto}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Cantidad</span>
              <input
                min="1"
                name="quantity"
                type="number"
                value={saleForm.quantity}
                onChange={handleSaleFieldChange}
                required
              />
            </label>
          </div>

          <div className="sale-side-note">
            <p>
              Producto seleccionado:{' '}
              <strong>{selectedProduct ? selectedProduct.producto : 'Sin producto'}</strong>
            </p>
            <p>Precio actual: {selectedProduct ? formatCurrency(selectedProduct.precio) : '-'}</p>
            <p>Stock disponible: {selectedProduct ? selectedProduct.stock : '-'}</p>
            <p className="hint">
              Tip: si pruebas una cantidad mayor al stock, veras el error y el backend hara
              ROLLBACK.
            </p>
          </div>

          <button className="primary-btn" disabled={submittingSale} type="submit">
            {submittingSale ? 'Registrando venta...' : 'Registrar venta'}
          </button>
        </form>

        {saleFeedback ? (
          <div className={`status-banner ${saleFeedback.type}`}>
            {saleFeedback.message}
          </div>
        ) : null}
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}

      <main className="query-grid">
        {loading ? (
          <article className="query-card loading-card">
            <h2>Cargando aplicacion...</h2>
            <p>Esperando respuesta del backend y la base de datos.</p>
          </article>
        ) : (
          sections.map((section) => (
            <article className="query-card" key={section.id}>
              <div className="section-heading">
                <span className="pill">{section.category}</span>
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>
              <DataTable columns={section.columns} rows={section.rows} />
            </article>
          ))
        )}
      </main>
    </div>
  )
}

export default App
