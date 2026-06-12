// inventario.js

// Aseguramos la existencia de la variable global en el objeto window
if (!window.listaProductos) {
    window.listaProductos = [];
}

async function cargarProductosMaestros() {
    console.log("=== Iniciando carga de productos desde Supabase ===");
    
    // Solicitud limpia a Supabase
    const { data, error } = await supabaseApp
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });
        
    if (error) {
        console.error(" Error crítico al consultar la tabla 'productos':", error);
        alert("Error de conexión con inventario: " + error.message);
        return;
    }
    
    // Guardamos globalmente
    window.listaProductos = data || [];
    console.log(" Productos recuperados con éxito:", window.listaProductos);
    
    // Forzar renderizado de la sección de administración de inventario
    renderizarSeccionInventario();
    
    // Forzar renderizado del formulario de ventas (Pestaña Registros)
    if (typeof renderizarFormularioVentaGaseosas === "function") {
        console.log("Llamando a renderizarFormularioVentaGaseosas con los datos frescos.");
        renderizarFormularioVentaGaseosas();
    } else {
        console.warn("La función renderizarFormularioVentaGaseosas aún no está disponible en el DOM.");
    }
}

function renderizarSeccionInventario() {
    const tbody = document.getElementById('inventario-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    if (window.listaProductos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-slate-400 text-xs">No hay productos en la base de datos de Supabase.</td></tr>`;
        return;
    }
    
    window.listaProductos.forEach(p => {
        const margen = p.precio_venta - p.precio_compra;
        const stockActual = p.stock !== undefined && p.stock !== null ? p.stock : 0;
        
        tbody.innerHTML += `
            <tr class="text-xs border-b border-slate-100 hover:bg-slate-50 transition-colors" id="fila-producto-${p.id}">
                <td class="px-6 py-2.5 font-medium text-slate-900">${p.nombre}</td>
                <td class="px-4 py-2.5 text-center font-bold ${stockActual <= 3 ? 'text-red-600 bg-red-50' : 'text-slate-700'}">${stockActual} u.</td>
                <td class="px-4 py-2.5 text-center text-slate-600">S/ ${Number(p.precio_compra).toFixed(2)}</td>
                <td class="px-4 py-2.5 text-center text-slate-600">S/ ${Number(p.precio_venta).toFixed(2)}</td>
                <td class="px-4 py-2.5 text-center font-semibold text-emerald-600">S/ ${margen.toFixed(2)}</td>
                <td class="px-6 py-2.5 text-center space-x-3">
                    <button onclick="activarEdicionProducto(${p.id})" class="text-indigo-600 hover:text-indigo-900 font-medium cursor-pointer transition-colors">Editar</button>
                    <button onclick="eliminarProducto(${p.id})" class="text-red-500 hover:text-red-700 font-medium cursor-pointer transition-colors">Eliminar</button>
                </td>
            </tr>
        `;
    });
}

function activarEdicionProducto(id) {
    const prod = window.listaProductos.find(p => p.id === id);
    const fila = document.getElementById(`fila-producto-${id}`);
    if (!prod || !fila) return;
    
    fila.innerHTML = `
        <td class="px-6 py-2"><input type="text" id="edit-nombre-${id}" class="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" value="${prod.nombre}"></td>
        <td class="px-4 py-2 text-center"><input type="number" id="edit-stock-${id}" class="w-16 px-2 py-1 border border-slate-300 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" value="${prod.stock || 0}"></td>
        <td class="px-4 py-2 text-center"><input type="number" step="0.01" id="edit-compra-${id}" class="w-20 px-2 py-1 border border-slate-300 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" value="${prod.precio_compra}"></td>
        <td class="px-4 py-2 text-center"><input type="number" step="0.01" id="edit-venta-${id}" class="w-20 px-2 py-1 border border-slate-300 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" value="${prod.precio_venta}"></td>
        <td class="px-4 py-2 text-center text-slate-400 font-medium">-</td>
        <td class="px-6 py-2 text-center space-x-2 whitespace-nowrap">
            <button onclick="guardarEdicionProducto(${id})" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium cursor-pointer transition-colors">Guardar</button>
            <button onclick="renderizarSeccionInventario()" class="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-medium cursor-pointer transition-colors">X</button>
        </td>
    `;
}

async function guardarEdicionProducto(id) {
    const nombre = document.getElementById(`edit-nombre-${id}`).value;
    const stock = parseInt(document.getElementById(`edit-stock-${id}`).value) || 0;
    const precio_compra = parseFloat(document.getElementById(`edit-compra-${id}`).value) || 0;
    const precio_venta = parseFloat(document.getElementById(`edit-venta-${id}`).value) || 0;

    await supabaseApp.from('productos').update({ nombre, stock, precio_compra, precio_venta }).eq('id', id);
    
    await cargarProductosMaestros();
    if (typeof filtrarYAplicarDatos === "function") filtrarYAplicarDatos();
}

document.getElementById('form-nuevo-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('prod-nombre').value;
    const precio_compra = parseFloat(document.getElementById('prod-compra').value) || 0;
    const precio_venta = parseFloat(document.getElementById('prod-venta').value) || 0;
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;

    await supabaseApp.from('productos').insert({ nombre, precio_compra, precio_venta, stock });
    
    document.getElementById('form-nuevo-producto').reset();
    document.getElementById('prod-stock').value = "0";
    
    await cargarProductosMaestros();
});

async function eliminarProducto(id) {
    if (confirm("¿Seguro de eliminar este producto?")) {
        await supabaseApp.from('productos').delete().eq('id', id);
        await cargarProductosMaestros();
        if (typeof filtrarYAplicarDatos === "function") filtrarYAplicarDatos();
    }
}