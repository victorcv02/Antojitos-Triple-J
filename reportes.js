// reportes.js

// Aseguramos la existencia de las variables de estado en el objeto global window
if (typeof window.listaCierres === "undefined") window.listaCierres = [];
if (typeof window.ventasDetalleMaestro === "undefined") window.ventasDetalleMaestro = [];
if (typeof window.datosFiltradosGlobal === "undefined") window.datosFiltradosGlobal = [];
if (typeof window.modoEdicionActivo === "undefined") window.modoEdicionActivo = false;
if (typeof window.fechaEdicionOriginal === "undefined") window.fechaEdicionOriginal = "";
if (typeof window.desglosePrevioEdicion === "undefined") window.desglosePrevioEdicion = [];

const filtroPeriodo = document.getElementById('filtro-periodo');
const colDiaEspecifico = document.getElementById('col-dia-especifico');
const colDesde = document.getElementById('col-desde');
const colHasta = document.getElementById('col-hasta');
const filtroDiaUnico = document.getElementById('filtro-dia-unico');
const filtroDesde = document.getElementById('filtro-desde');
const filtroHasta = document.getElementById('filtro-hasta');

if (filtroPeriodo) {
    filtroPeriodo.addEventListener('change', () => {
        const valor = filtroPeriodo.value;
        if(colDiaEspecifico) colDiaEspecifico.classList.add('hidden'); 
        if(colDesde) colDesde.classList.add('hidden'); 
        if(colHasta) colHasta.classList.add('hidden');
        
        if (valor === 'dia-especifico' && colDiaEspecifico) {
            colDiaEspecifico.classList.remove('hidden');
        } else if (valor === 'personalizado' && colDesde && colHasta) {
            colDesde.classList.remove('hidden'); 
            colHasta.classList.remove('hidden'); 
        }
        filtrarYAplicarDatos();
    });
}

[filtroDiaUnico, filtroDesde, filtroHasta].forEach(input => {
    if (input) input.addEventListener('input', filtrarYAplicarDatos);
});

// ==========================================
// CARGA DE DATOS DESDE SUPABASE
// ==========================================
async function cargarHistorialReal() {
    const { data: dataCierres } = await supabaseApp.from('cierres_caja').select('*').order('fecha', { ascending: false });
    const { data: dataDetalles } = await supabaseApp.from('ventas_gaseosas_detalle').select('*');
    
    window.listaCierres = dataCierres || [];
    window.ventasDetalleMaestro = dataDetalles || [];
    filtrarYAplicarDatos();
}

// ==========================================
// MOTOR PRINCIPAL DE FILTRADO Y RENDERIZADO
// ==========================================
function filtrarYAplicarDatos() {
    if (!filtroPeriodo) return;
    const filtro = filtroPeriodo.value;
    const hoyStr = typeof obtenerFechaLocalPeru === "function" ? obtenerFechaLocalPeru() : new Date().toISOString().split('T')[0];
    let datosFiltrados = [...window.listaCierres];

    if (filtro === 'hoy') {
        datosFiltrados = window.listaCierres.filter(c => c.fecha === hoyStr);
    } else if (filtro === 'semana') {
        const lim = new Date(); 
        lim.setDate(lim.getDate() - 7); 
        const limStr = lim.toISOString().split('T')[0];
        datosFiltrados = window.listaCierres.filter(c => c.fecha >= limStr);
    } else if (filtro === 'mes') {
        const ahora = new Date();
        const m = ahora.getMonth(); 
        const a = ahora.getFullYear(); 
        datosFiltrados = window.listaCierres.filter(c => { 
            const f = new Date(c.fecha + "T00:00:00"); 
            return f.getMonth() === m && f.getFullYear() === a; 
        });
    } else if (filtro === 'dia-especifico') {
        const d = filtroDiaUnico ? filtroDiaUnico.value : null; 
        datosFiltrados = d ? window.listaCierres.filter(c => c.fecha === d) : [];
    } else if (filtro === 'personalizado') {
        const desdeVal = filtroDesde ? filtroDesde.value : null; 
        const hastaVal = filtroHasta ? filtroHasta.value : null; 
        if (desdeVal) datosFiltrados = datosFiltrados.filter(c => c.fecha >= desdeVal); 
        if (hastaVal) datosFiltrados = datosFiltrados.filter(c => c.fecha <= hastaVal); 
    }

    // Guardamos estrictamente en el espacio global para que los exportadores lo lean
    window.datosFiltradosGlobal = datosFiltrados;

    const tableElement = document.getElementById('reporte-tbody') ? document.getElementById('reporte-tbody').parentElement : null;
    if (!tableElement) return;

    // Estilo visual claro y profesional arreglado
    tableElement.innerHTML = `
        <thead class="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider border-b border-slate-300">
            <tr>
                <th class="px-5 py-3 text-center">Fecha</th>
                <th class="px-4 py-3 text-center">Yape</th>
                <th class="px-4 py-3 text-center">Plin</th>
                <th class="px-4 py-3 text-center">Efectivo</th>
                <th class="px-4 py-3 text-center">Gaseosas</th>
                <th class="px-4 py-3 text-center text-red-200">Gastos</th>
                <th class="px-4 py-3 text-right bg-sky-900 text-sky-100 font-bold border-x border-slate-700">Venta Bruta</th>
                <th class="px-4 py-3 text-right bg-emerald-900 text-emerald-100 font-bold">Saldo Neto</th>
                <th class="px-5 py-3 text-center">Acciones</th>
            </tr>
        </thead>
        <tbody id="reporte-tbody" class="divide-y divide-slate-200 bg-white text-slate-700"></tbody>
    `;

    const tbody = document.getElementById('reporte-tbody');
    let acBruto = 0, acNeto = 0, sumEfectivo = 0, sumDigital = 0, sumGaseosas = 0, sumGananciaGaseosas = 0;

    if (datosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-8 text-center text-slate-400 text-xs font-medium bg-slate-50">No se registran operaciones en el rango seleccionado.</td></tr>`;
    } else {
        datosFiltrados.forEach(c => {
            const filaVentaBruta = (Number(c.yape) + Number(c.plin) + Number(c.efectivo) + Number(c.gaseosas)) + Number(c.gastos);
            const filaSaldoNeto = (Number(c.yape) + Number(c.plin) + Number(c.efectivo) + Number(c.gaseosas));

            acBruto += filaVentaBruta;
            acNeto += filaSaldoNeto;
            sumEfectivo += Number(c.efectivo); 
            sumDigital += (Number(c.yape) + Number(c.plin)); 
            sumGaseosas += Number(c.gaseosas);
            
            const det = window.ventasDetalleMaestro.filter(d => d.fecha === c.fecha);
            det.forEach(d => { 
                sumGananciaGaseosas += (d.cantidad * (d.precio_venta_historico - d.precio_compra_historico)); 
            });

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 text-xs transition-colors border-b border-slate-200">
                    <td class="px-5 py-3 text-center font-semibold text-slate-900">${c.fecha.split('-').reverse().join('/')}</td>
                    <td class="px-4 py-3 text-center text-slate-600">S/ ${Number(c.yape).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center text-slate-600">S/ ${Number(c.plin).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center text-slate-600">S/ ${Number(c.efectivo).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-medium text-indigo-600">S/ ${Number(c.gaseosas).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center text-red-600 font-medium bg-red-50/50">S/ ${Number(c.gastos).toFixed(2)}</td>
                    <td class="px-4 py-3 text-right bg-sky-50 text-sky-700 font-bold border-x border-sky-100">S/ ${filaVentaBruta.toFixed(2)}</td>
                    <td class="px-4 py-3 text-right bg-emerald-50 text-emerald-700 font-bold">S/ ${filaSaldoNeto.toFixed(2)}</td>
                    <td class="px-5 py-3 text-center space-x-1 whitespace-nowrap">
                        <button onclick="prepararEdicionCierre('${c.fecha}')" class="px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded font-medium cursor-pointer transition-colors">Editar</button>
                        <button onclick="eliminarCierreCompleto('${c.fecha}')" class="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded font-medium cursor-pointer transition-colors">Eliminar</button>
                    </td>
                </tr>
            `;
        });
    }

    const kpiTotal = document.getElementById('kpi-total');
    if (kpiTotal) kpiTotal.textContent = `S/ ${acNeto.toFixed(2)}`;
    if (document.getElementById('kpi-efectivo')) document.getElementById('kpi-efectivo').textContent = `S/ ${sumEfectivo.toFixed(2)}`;
    if (document.getElementById('kpi-digital')) document.getElementById('kpi-digital').textContent = `S/ ${sumDigital.toFixed(2)}`;
    if (document.getElementById('kpi-gaseosas')) document.getElementById('kpi-gaseosas').textContent = `S/ ${sumGaseosas.toFixed(2)}`;
    if (document.getElementById('kpi-ganancia-gaseosas')) document.getElementById('kpi-ganancia-gaseosas').textContent = `S/ ${sumGananciaGaseosas.toFixed(2)}`;
}

// ==========================================
// MODIFICACIÓN Y RECALCULO DIARIO
// ==========================================
function prepararEdicionCierre(fechaCierre) {
    const cierre = window.listaCierres.find(c => c.fecha === fechaCierre);
    if (!cierre) return;

    modoEdicionActivo = true;
    fechaEdicionOriginal = fechaCierre;
    desglosePrevioEdicion = window.ventasDetalleMaestro.filter(d => d.fecha === fechaCierre);

    document.getElementById('titulo-formulario-caja').textContent = "Corregir Datos del Cuadrante Diario";
    document.getElementById('badge-modo-edicion').classList.remove('hidden');
    document.getElementById('btn-cancelar-edicion').classList.remove('hidden');
    document.getElementById('btn-submit-caja').textContent = "Aplicar y Modificar Balance";

    document.getElementById('caja-fecha').value = cierre.fecha;
    document.getElementById('caja-fecha').disabled = true;
    document.getElementById('caja-yape').value = cierre.yape;
    document.getElementById('caja-plin').value = cierre.plin;
    document.getElementById('caja-efectivo').value = cierre.efectivo;
    document.getElementById('caja-gastos').value = cierre.gastos;

    document.querySelectorAll('.input-gaseosa-unidad').forEach(input => input.value = "");

    desglosePrevioEdicion.forEach(d => {
        const input = document.getElementById(`input-prod-id-${d.producto_id}`);
        if (input) {
            input.value = d.cantidad;
            const stockSeguro = parseInt(input.dataset.stock) || 0;
            document.getElementById(`label-stock-id-${d.producto_id}`).textContent = `Stock disponible: ${stockSeguro + d.cantidad} u. (Editando)`;
        }
    });

    if (typeof calcularBalance === "function") calcularBalance();
    if (typeof cambiarPestaña === "function") {
        cambiarPestaña('mod-registro', document.getElementById('btn-nav-registro'));
    }
}

function desactivarModoEdicion() {
    modoEdicionActivo = false;
    fechaEdicionOriginal = "";
    desglosePrevioEdicion = [];

    document.getElementById('titulo-formulario-caja').textContent = "Declaración de Ingresos y Egresos";
    document.getElementById('badge-modo-edicion').classList.add('hidden');
    document.getElementById('btn-cancelar-edicion').classList.add('hidden');
    document.getElementById('btn-submit-caja').textContent = "Guardar Cierre de Caja";
    
    document.getElementById('caja-fecha').disabled = false;
    document.getElementById('form-caja').reset();
    document.getElementById('caja-fecha').value = typeof obtenerFechaLocalPeru === "function" ? obtenerFechaLocalPeru() : new Date().toISOString().split('T')[0];
    
    if (window.listaProductos) {
        window.listaProductos.forEach(p => {
            const lbl = document.getElementById(`label-stock-id-${p.id}`);
            if (lbl) lbl.textContent = `Stock disponible: ${p.stock || 0} u.`;
        });
    }
    if (typeof calcularBalance === "function") calcularBalance();
}

if (document.getElementById('btn-cancelar-edicion')) {
    document.getElementById('btn-cancelar-edicion').addEventListener('click', desactivarModoEdicion);
}

async function eliminarCierreCompleto(fechaFormateada) {
    if (confirm(`¿Seguro que deseas eliminar por completo el registro del día ${fechaFormateada.split('-').reverse().join('/')}? Esto restablecerá el stock vendido.`)) {
        const detallesABorrar = window.ventasDetalleMaestro.filter(d => d.fecha === fechaFormateada);
        const promesasDevolucion = detallesABorrar.map(d => {
            const prod = window.listaProductos.find(p => p.id == d.producto_id);
            const stockActual = prod ? prod.stock : 0;
            return supabaseApp.from('productos').update({ stock: stockActual + d.cantidad }).eq('id', d.producto_id);
        });

        if (promesasDevolucion.length > 0) await Promise.all(promesasDevolucion);

        await supabaseApp.from('ventas_gaseosas_detalle').delete().eq('fecha', fechaFormateada);
        await supabaseApp.from('cierres_caja').delete().eq('fecha', fechaFormateada);
        
        await cargarProductosMaestros();
        await cargarHistorialReal();
    }
}

// ==========================================
// SECCIÓN: EXPORTACIÓN DE REPORTES A PDF
// ==========================================

// REPARACIÓN BOTÓN 1: Formato Estándar/Detallado Interno
const btnPdfDetailed = document.getElementById('btn-pdf-detailed');
if (btnPdfDetailed) {
    // Eliminamos cualquier listener fantasma previo y asignamos de forma limpia
    btnPdfDetailed.replaceWith(btnPdfDetailed.cloneNode(true));
    document.getElementById('btn-pdf-detailed').addEventListener('click', () => {
        const datos = window.datosFiltradosGlobal || [];
        if (datos.length === 0) {
            alert("No hay información en el rango actual para generar el PDF.");
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text("REPORTE DETALLADO DE CONTROL DE INGRESOS", 40, 50);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 40, 70);
        
        let filas = [];
        datos.forEach(c => {
            const bruto = (Number(c.yape) + Number(c.plin) + Number(c.efectivo) + Number(c.gaseosas)) + Number(c.gastos);
            const neto = (Number(c.yape) + Number(c.plin) + Number(c.efectivo) + Number(c.gaseosas));
            filas.push([
                c.fecha.split('-').reverse().join('/'),
                `S/ ${Number(c.yape).toFixed(2)}`,
                `S/ ${Number(c.plin).toFixed(2)}`,
                `S/ ${Number(c.efectivo).toFixed(2)}`,
                `S/ ${Number(c.gaseosas).toFixed(2)}`,
                `S/ ${Number(c.gastos).toFixed(2)}`,
                `S/ ${bruto.toFixed(2)}`,
                `S/ ${neto.toFixed(2)}`
            ]);
        });
        
        pdf.autoTable({
            startY: 90,
            head: [['Fecha', 'Yape', 'Plin', 'Efectivo', 'Gaseosas', 'Gastos', 'V. Bruta', 'S. Neto']],
            body: filas,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59] },
            styles: { fontSize: 8, halign: 'center' }
        });
        
        pdf.save(`Reporte_Detallado_Caja_${new Date().toISOString().split('T')[0]}.pdf`);
    });
}

// REPARACIÓN BOTÓN 2: Tu formato específico enviado previamente (Minka/Estructura Personalizada)
const btnPdfMinka = document.getElementById('btn-pdf-minka') || document.getElementById('btn-pdf-specific');
if (btnPdfMinka) {
    const idReal = btnPdfMinka.id;
    btnPdfMinka.replaceWith(btnPdfMinka.cloneNode(true));
    document.getElementById(idReal).addEventListener('click', () => {
        const datos = window.datosFiltradosGlobal || [];
        if (datos.length === 0) {
            alert("No hay registros disponibles para procesar este formato específico.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');

        // Renderizado del formato específico estructurado
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(14, 116, 144); // Color cyan corporativo
        pdf.text("FORMATO ESPECÍFICO DE COMPROBACIÓN DIARIA", 40, 50);

        pdf.setDrawColor(200, 200, 200);
        pdf.line(40, 65, 550, 65);

        let totalYape = 0, totalPlin = 0, totalEfectivo = 0, totalGaseosas = 0, totalGastos = 0, totalNetoGeneral = 0;

        datos.forEach(c => {
            totalYape += Number(c.yape);
            totalPlin += Number(c.plin);
            totalEfectivo += Number(c.efectivo);
            totalGaseosas += Number(c.gaseosas);
            totalGastos += Number(c.gastos);
            totalNetoGeneral += (Number(c.yape) + Number(c.plin) + Number(c.efectivo) + Number(c.gaseosas));
        });

        pdf.setFontSize(11);
        pdf.setTextColor(50, 50, 50);
        pdf.setFont("helvetica", "bold");
        pdf.text("RESUMEN DE CONSOLIDACIÓN:", 40, 95);

        pdf.setFont("helvetica", "normal");
        pdf.text(`• Total Recaudado Yape: S/ ${totalYape.toFixed(2)}`, 50, 115);
        pdf.text(`• Total Recaudado Plin: S/ ${totalPlin.toFixed(2)}`, 50, 130);
        pdf.text(`• Total Efectivo en Caja: S/ ${totalEfectivo.toFixed(2)}`, 50, 145);
        pdf.text(`• Subtotal Venta de Gaseosas: S/ ${totalGaseosas.toFixed(2)}`, 50, 160);
        pdf.text(`• Total Egresos / Gastos: S/ ${totalGastos.toFixed(2)}`, 50, 175);

        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(240, 253, 250);
        pdf.rect(40, 195, 510, 30, 'F');
        pdf.setTextColor(15, 118, 110);
        pdf.text(`SALDO NETO DISPONIBLE CONSOLIDADO: S/ ${totalNetoGeneral.toFixed(2)}`, 55, 214);

        // Tabla inferior con desglose cronológico
        let cuerpoDesglose = datos.map(c => [
            c.fecha.split('-').reverse().join('/'),
            `S/ ${(Number(c.yape) + Number(c.plin)).toFixed(2)}`,
            `S/ ${Number(c.efectivo).toFixed(2)}`,
            `S/ ${Number(c.gaseosas).toFixed(2)}`,
            `S/ ${Number(c.gastos).toFixed(2)}`,
            `S/ ${(Number(c.yape) + Number(c.plin) + Number(c.efectivo) + Number(c.gaseosas)).toFixed(2)}`
        ]);

        pdf.setTextColor(50, 50, 50);
        pdf.text("CRONOLOGÍA DE REPORTES ASOCIADOS:", 40, 260);

        pdf.autoTable({
            startY: 275,
            head: [['Fecha', 'Total Digital', 'Efectivo', 'Gaseosas', 'Gastos', 'Neto']],
            body: cuerpoDesglose,
            theme: 'grid',
            headStyles: { fillColor: [14, 116, 144] },
            styles: { fontSize: 8, halign: 'center' }
        });

        pdf.save(`Formato_Especifico_Caja_${new Date().toISOString().split('T')[0]}.pdf`);
    });
}