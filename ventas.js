// ventas.js

function renderizarFormularioVentaGaseosas() {
    const contenedor = document.getElementById('contenedor-ventas-gaseosas');
    if (!contenedor) return;
    
    // Forzamos la lectura limpia desde el objeto global window
    const productos = window.listaProductos || [];
    
    console.log("Renderizando formulario de ventas. Cantidad de productos detectados:", productos.length);
    
    if (productos.length === 0) {
        contenedor.innerHTML = `
            <div class="col-span-full p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <p class="text-xs text-amber-700 font-medium">No se detectaron productos en memoria.</p>
                <button onclick="cargarProductosMaestros()" class="mt-2 px-3 py-1 bg-amber-600 text-white rounded text-[11px] font-semibold tracking-wide hover:bg-amber-700 transition-colors cursor-pointer">
                    Forzar Sincronización con Base de Datos
                </button>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = "";
    productos.forEach(p => {
        const stockActual = p.stock || 0;
        contenedor.innerHTML += `
            <div class="flex flex-col text-xs bg-white p-2 rounded-lg border border-slate-100 space-y-1 shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="font-medium text-slate-700">${p.nombre} <span class="text-slate-400 font-normal">(S/ ${Number(p.precio_venta).toFixed(2)})</span></span>
                    <input type="number" id="input-prod-id-${p.id}" data-id="${p.id}" data-venta="${p.precio_venta}" data-stock="${stockActual}" min="0" class="input-gaseosa-unidad w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="0">
                </div>
                <span id="label-stock-id-${p.id}" class="text-[10px] text-right text-slate-400 font-medium">Stock disponible: ${stockActual} u.</span>
            </div>
        `;
    });
    
    // Re-vincular los eventos de escucha para el cálculo dinámico en tiempo real
    document.querySelectorAll('.input-gaseosa-unidad').forEach(i => {
        i.removeEventListener('input', calcularBalance); // Evitamos duplicaciones
        i.addEventListener('input', calcularBalance);
    });
}

function calcularBalance() {
    const yape = parseFloat(document.getElementById('caja-yape').value) || 0;
    const plin = parseFloat(document.getElementById('caja-plin').value) || 0;
    const efectivo = parseFloat(document.getElementById('caja-efectivo').value) || 0;
    const gastos = parseFloat(document.getElementById('caja-gastos').value) || 0;

    let subtotalGaseosas = 0;
    document.querySelectorAll('.input-gaseosa-unidad').forEach(input => {
        const cant = parseInt(input.value) || 0;
        const precio = parseFloat(input.dataset.venta) || 0;
        subtotalGaseosas += (cant * precio);
    });

    const subGaseosasEl = document.getElementById('subtotal-gaseosas-preview');
    if (subGaseosasEl) subGaseosasEl.textContent = `S/ ${subtotalGaseosas.toFixed(2)}`;
    
    const totalNeto = (yape + plin + efectivo + subtotalGaseosas) - gastos;
    
    const previewTotal = document.getElementById('caja-total-preview');
    if (previewTotal) {
        previewTotal.textContent = `S/ ${totalNeto.toFixed(2)}`;
        previewTotal.className = totalNeto < 0 ? "text-2xl font-bold tracking-tight text-red-500" : "text-2xl font-bold tracking-tight text-emerald-500";
    }
    return totalNeto;
}

document.querySelectorAll('.input-calculo').forEach(i => i.addEventListener('input', calcularBalance));

document.getElementById('form-caja').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fecha = document.getElementById('caja-fecha').value;
    const yape = parseFloat(document.getElementById('caja-yape').value) || 0;
    const plin = parseFloat(document.getElementById('caja-plin').value) || 0;
    const efectivo = parseFloat(document.getElementById('caja-efectivo').value) || 0;
    const gastos = parseFloat(document.getElementById('caja-gastos').value) || 0;

    let totalGaseosas = 0;
    let arreglosVentasDetalle = [];
    let actualizacionesStockPromesas = [];
    let stockInsuficiente = false;
    
    const productos = window.listaProductos || [];

    for (let input of document.querySelectorAll('.input-gaseosa-unidad')) {
        const cantidadNueva = parseInt(input.value) || 0;
        const prodId = input.dataset.id;
        const prodMaster = productos.find(p => p.id == prodId);
        const stockEnBaseDatos = prodMaster ? prodMaster.stock : 0;

        const registroViejo = typeof modoEdicionActivo !== 'undefined' && modoEdicionActivo ? desglosePrevioEdicion.find(d => d.producto_id == prodId) : null;
        const cantidadVieja = registroViejo ? registroViejo.cantidad : 0;
        
        const stockVirtualDisponible = stockEnBaseDatos + cantidadVieja;

        if (cantidadNueva > 0 || cantidadVieja > 0) {
            if (cantidadNueva > stockVirtualDisponible) {
                alert(`Inventario insuficiente para ${prodMaster.nombre}. Intentas registrar ${cantidadNueva} unidades pero el stock máximo disponible es de ${stockVirtualDisponible}.`);
                stockInsuficiente = true;
                break;
            }

            if (cantidadNueva > 0) {
                totalGaseosas += (cantidadNueva * prodMaster.precio_venta);
                arreglosVentasDetalle.push({
                    fecha: fecha,
                    producto_id: prodId,
                    cantidad: cantidadNueva,
                    precio_compra_historico: prodMaster.precio_compra,
                    precio_venta_historico: prodMaster.precio_venta
                });
            }

            const stockFinalCalculado = stockVirtualDisponible - cantidadNueva;
            actualizacionesStockPromesas.push(
                supabaseApp.from('productos').update({ stock: stockFinalCalculado }).eq('id', prodId)
            );
        }
    }

    if (stockInsuficiente) return;

    const totalNeto = (yape + plin + efectivo + totalGaseosas) - gastos;

    await supabaseApp.from('cierres_caja').upsert({
        usuario_email: usuarioActualEmail, fecha, yape, plin, efectivo, gaseosas: totalGaseosas, gastos, total_neto: totalNeto
    }, { onConflict: 'fecha' });

    await supabaseApp.from('ventas_gaseosas_detalle').delete().eq('fecha', fecha);
    if (arreglosVentasDetalle.length > 0) {
        await supabaseApp.from('ventas_gaseosas_detalle').insert(arreglosVentasDetalle);
    }

    if (actualizacionesStockPromesas.length > 0) {
        await Promise.all(actualizacionesStockPromesas);
    }

    alert(typeof modoEdicionActivo !== 'undefined' && modoEdicionActivo ? "¡El reporte diario ha sido modificado y el stock recalculado con éxito!" : "¡Cierre diario guardado e inventario descontado!");
    
    if (typeof desactivarModoEdicion === "function") desactivarModoEdicion();
    await cargarProductosMaestros();
    await cargarHistorialReal();
});