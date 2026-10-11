
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const API = (
    window.SHOWROOM_API_URL ||
    (LOCAL_HOSTS.includes(window.location.hostname) ? "http://localhost:3000/api" : "")
).replace(/\/+$/, "");
const state = {
    pelanggan: [],
    kendaraan: [],
    penjualan: [],
    pembayaran: []
};

const $ = id => document.getElementById(id);

const rupiah = value => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
}).format(Number(value || 0));

const tanggal = value => value
    ? new Date(value + "T00:00:00").toLocaleDateString("id-ID", {
        day: "2-digit", month: "short", year: "numeric"
    })
    : "-";

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
}[char]));

const today = () => new Date().toLocaleDateString("en-CA");

function toast(message, error = false) {
    const el = document.createElement("div");
    el.className = "toast" + (error ? " error" : "");
    el.textContent = message;
    $("toastHost").appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

async function api(table, method = "GET", id = "", body = null) {
    if (!API) {
        throw new Error("URL backend production belum diatur di frontend/js/config.js.");
    }

    const headers = {};
    if (body) headers["Content-Type"] = "application/json";

    let response;

    try {
        response = await fetch(
            `${API}/${table}${id ? "/" + id : ""}`,
            {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            }
        );
    } catch {
        throw new Error(
            "Backend tidak terhubung. Jalankan backend/app.js terlebih dahulu."
        );
    }

    const text = await response.text();
    let result;
    try {
        result = text ? JSON.parse(text) : null;
    } catch {
        throw new Error("Respons backend bukan JSON yang valid.");
    }

    if (!response.ok || result?.ok !== true) {
        throw new Error(result?.error || "Permintaan gagal.");
    }

    return result.data;
}

function pelanggan(id) {
    return state.pelanggan.find(x => Number(x.id_pelanggan) === Number(id));
}

function kendaraan(id) {
    return state.kendaraan.find(x => Number(x.id_kendaraan) === Number(id));
}

function penjualan(id) {
    return state.penjualan.find(x => Number(x.id_penjualan) === Number(id));
}

function namaMobil(id) {
    const v = kendaraan(id);
    return v ? `${v.merk} ${v.model} (${v.tahun})` : "-";
}

function namaPelanggan(id) {
    return pelanggan(id)?.nama_pelanggan || "-";
}

function piutangAwal(s) {
    return Number(s.harga_jual) - Number(s.uang_muka);
}

function totalCicilan(id) {
    return state.pembayaran
        .filter(p => Number(p.id_penjualan) === Number(id))
        .reduce((sum, p) => sum + Number(p.jumlah_bayar), 0);
}

function sisaPiutang(s) {
    return Math.max(0, Number(s.sisa_piutang || 0));
}

function badge(status) {
    const css = status === "LUNAS" || status === "TERSEDIA"
        ? "badge-lunas"
        : "badge-belum";

    return `<span class="badge ${css}">${escapeHTML(status)}</span>`;
}

function emptyRow(columns, message = "Belum ada data.") {
    return `<tr><td colspan="${columns}" class="empty-cell">${escapeHTML(message)}</td></tr>`;
}

// Navigasi
const titles = {
    dashboard: "Dashboard",
    pelanggan: "Data Pelanggan",
    kendaraan: "Data Kendaraan",
    penjualan: "Penjualan",
    pembayaran: "Pembayaran",
    laporan: "Laporan Piutang"
};

function showPage(page) {
    document.querySelectorAll(".page").forEach(el => {
        el.classList.toggle("active", el.id === `page-${page}`);
    });

    document.querySelectorAll(".nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.page === page);
    });

    $("pageTitle").textContent = titles[page] || "Dashboard";
}

document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.go));
});

document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
        $(button.dataset.close).hidden = true;
    });
});

function openForm(panelId, formId, titleId, title) {
    $(formId).reset();
    $(formId).querySelectorAll('input[type="hidden"]').forEach(input => {
        input.value = "";
    });

    $(titleId).textContent = title;
    $(panelId).hidden = false;
    $(panelId).scrollIntoView({ behavior: "smooth", block: "start" });
}

$("addPelanggan").onclick = () =>
    openForm("formPanelPelanggan", "formPelanggan", "pelangganFormTitle", "Tambah pelanggan");

$("addKendaraan").onclick = () =>
    openForm("formPanelKendaraan", "formKendaraan", "kendaraanFormTitle", "Tambah kendaraan");

$("addPenjualan").onclick = async () => {
    if (!await loadAll()) return;
    openForm("formPanelPenjualan", "formPenjualan", "penjualanFormTitle", "Catat penjualan");
    fillPelanggan();
    fillKendaraan();
    $("tanggalPenjualan").value = today();
    $("uangMuka").value = 0;
};

$("addPembayaran").onclick = async () => {
    if (!await loadAll()) return;
    openForm("formPanelPembayaran", "formPembayaran", "pembayaranFormTitle", "Catat pembayaran");
    fillPenjualan();
    $("tanggalPembayaran").value = today();
};

// Memuat empat entitas dari backend.
async function loadAll() {
    const refreshButton = $("refreshDashboard");
    const originalLabel = refreshButton.textContent;
    refreshButton.disabled = true;
    refreshButton.textContent = "Memuat...";
    $("backendStatus").textContent = "Memuat data...";
    $("backendStatusDetail").textContent = "Menghubungkan ke backend";

    try {
        const [p, k, j, b] = await Promise.all([
            api("pelanggan"),
            api("kendaraan"),
            api("penjualan"),
            api("pembayaran")
        ]);

        if (![p, k, j, b].every(Array.isArray)) {
            throw new Error("Backend mengirim format data yang tidak sesuai.");
        }

        state.pelanggan = p || [];
        state.kendaraan = k || [];
        state.penjualan = j || [];
        state.pembayaran = b || [];

        renderAll();
        $("backendStatus").textContent = "Backend terhubung";
        $("backendStatusDetail").textContent = "Mode demo publik · data contoh";
        $("backendStatusDot").classList.remove("offline");
        return true;
    } catch (error) {
        $("backendStatus").textContent = "Backend tidak terhubung";
        $("backendStatusDetail").textContent = error.message;
        $("backendStatusDot").classList.add("offline");
        toast(error.message, true);
        return false;
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = originalLabel;
    }
}

function renderAll() {
    renderPelanggan();
    renderKendaraan();
    renderPenjualan();
    renderPembayaran();
    renderDashboard();
    renderLaporan();
}

// PELANGGAN
function renderPelanggan() {
    const q = ($("searchPelanggan").value || "").toLowerCase();

    const rows = state.pelanggan.filter(p =>
        [p.nama_pelanggan, p.no_ktp, p.no_telp, p.alamat]
            .some(v => String(v || "").toLowerCase().includes(q))
    );

    $("countPelanggan").textContent = `${rows.length} pelanggan`;

    $("tablePelanggan").innerHTML = rows.length
        ? rows.map(p => `<tr>
            <td><div class="cell-primary">${escapeHTML(p.nama_pelanggan)}</div>
                <div class="cell-secondary">ID ${p.id_pelanggan}</div></td>
            <td>${escapeHTML(p.no_ktp)}</td>
            <td>${escapeHTML(p.no_telp || "-")}</td>
            <td>${escapeHTML(p.alamat || "-")}</td>
            <td><div class="actions">
                <button class="action-btn" data-edit="pelanggan" data-id="${p.id_pelanggan}">Edit</button>
                <button class="action-btn danger" data-delete="pelanggan" data-id="${p.id_pelanggan}">Hapus</button>
            </div></td>
        </tr>`).join("")
        : emptyRow(5);
}

$("formPelanggan").onsubmit = async e => {
    e.preventDefault();

    const id = $("pelangganId").value;
    const body = {
        nama_pelanggan: $("namaPelanggan").value.trim(),
        no_ktp: $("ktpPelanggan").value.trim(),
        no_telp: $("telpPelanggan").value.trim() || null,
        alamat: $("alamatPelanggan").value.trim() || null
    };

    await saveData("pelanggan", id, body, "formPanelPelanggan");
};

// KENDARAAN
function renderKendaraan() {
    const q = ($("searchKendaraan").value || "").toLowerCase();
    const filter = $("filterKendaraan").value;

    const rows = state.kendaraan.filter(v =>
        `${v.merk} ${v.model} ${v.tahun} ${v.warna || ""}`.toLowerCase().includes(q)
        && (!filter || v.status === filter)
    );

    $("countKendaraan").textContent = `${rows.length} kendaraan`;

    $("tableKendaraan").innerHTML = rows.length
        ? rows.map(v => `<tr>
            <td><div class="cell-primary">${escapeHTML(v.merk)} ${escapeHTML(v.model)}</div>
                <div class="cell-secondary">ID ${v.id_kendaraan}</div></td>
            <td>${v.tahun}</td>
            <td>${escapeHTML(v.warna || "-")}</td>
            <td>${rupiah(v.harga)}</td>
            <td>${badge(v.status)}</td>
            <td><div class="actions">
                <button class="action-btn" data-edit="kendaraan" data-id="${v.id_kendaraan}">Edit</button>
                <button class="action-btn danger" data-delete="kendaraan" data-id="${v.id_kendaraan}">Hapus</button>
            </div></td>
        </tr>`).join("")
        : emptyRow(6);
}

$("formKendaraan").onsubmit = async e => {
    e.preventDefault();

    const id = $("kendaraanId").value;
    const body = {
        merk: $("merkKendaraan").value.trim(),
        model: $("modelKendaraan").value.trim(),
        tahun: Number($("tahunKendaraan").value),
        warna: $("warnaKendaraan").value.trim() || null,
        harga: Number($("hargaKendaraan").value)
    };

    await saveData("kendaraan", id, body, "formPanelKendaraan");
};

// PENJUALAN
function fillPelanggan(selected = "") {
    $("pilihPelanggan").innerHTML =
        '<option value="">Pilih pelanggan</option>' +
        state.pelanggan.map(p => `
            <option value="${p.id_pelanggan}" ${String(selected) === String(p.id_pelanggan) ? "selected" : ""}>
                ${escapeHTML(p.nama_pelanggan)} — ${escapeHTML(p.no_ktp)}
            </option>`).join("");
}

function fillKendaraan(selected = "") {
    const current = selected ? kendaraan(selected) : null;
    const available = state.kendaraan.filter(v =>
        v.status === "TERSEDIA" || Number(v.id_kendaraan) === Number(current?.id_kendaraan)
    );

    $("pilihKendaraan").innerHTML =
        '<option value="">Pilih kendaraan</option>' +
        available.map(v => `
            <option value="${v.id_kendaraan}" ${String(selected) === String(v.id_kendaraan) ? "selected" : ""}>
                ${escapeHTML(v.merk)} ${escapeHTML(v.model)} — ${rupiah(v.harga)}
            </option>`).join("");
}

$("pilihKendaraan").addEventListener("change", () => {
    const v = kendaraan($("pilihKendaraan").value);
    if (v) $("hargaJual").value = v.harga;
});

function renderPenjualan() {
    const q = ($("searchPenjualan").value || "").toLowerCase();
    const filter = $("filterPenjualan").value;

    const rows = state.penjualan.filter(s =>
        `${namaPelanggan(s.id_pelanggan)} ${namaMobil(s.id_kendaraan)} ${s.id_penjualan}`.toLowerCase().includes(q)
        && (!filter || s.status === filter)
    );

    $("countPenjualan").textContent = `${rows.length} transaksi`;

    $("tablePenjualan").innerHTML = rows.length
        ? rows.map(s => `<tr>
            <td>PJ-${s.id_penjualan}</td>
            <td>${tanggal(s.tanggal_penjualan)}</td>
            <td>${escapeHTML(namaPelanggan(s.id_pelanggan))}</td>
            <td>${escapeHTML(namaMobil(s.id_kendaraan))}</td>
            <td>${rupiah(s.harga_jual)}</td>
            <td>${rupiah(s.sisa_piutang)}</td>
            <td>${badge(s.status)}</td>
            <td><div class="actions">
                <button class="action-btn" data-detail="${s.id_penjualan}">Detail</button>
                <button class="action-btn" data-edit="penjualan" data-id="${s.id_penjualan}">Edit</button>
                <button class="action-btn danger" data-delete="penjualan" data-id="${s.id_penjualan}">Hapus</button>
            </div></td>
        </tr>`).join("")
        : emptyRow(8);
}

$("formPenjualan").onsubmit = async e => {
    e.preventDefault();

    const id = $("penjualanId").value;
    const body = {
        id_pelanggan: Number($("pilihPelanggan").value),
        id_kendaraan: Number($("pilihKendaraan").value),
        tanggal_penjualan: $("tanggalPenjualan").value,
        harga_jual: Number($("hargaJual").value),
        uang_muka: Number($("uangMuka").value)
    };

    if (!body.id_pelanggan || !body.id_kendaraan) {
        return toast("Pilih pelanggan dan kendaraan.", true);
    }

    if (body.uang_muka < 0 || body.harga_jual < body.uang_muka) {
        return toast("Periksa harga jual dan uang muka.", true);
    }

    await saveData("penjualan", id, body, "formPanelPenjualan");
};

// PEMBAYARAN
function fillPenjualan(selected = "") {
    const rows = state.penjualan.filter(s =>
        Number(s.sisa_piutang) > 0 || Number(s.id_penjualan) === Number(selected)
    );

    $("pilihPenjualan").innerHTML =
        '<option value="">Pilih transaksi</option>' +
        rows.map(s => `
            <option value="${s.id_penjualan}" ${String(selected) === String(s.id_penjualan) ? "selected" : ""}>
                PJ-${s.id_penjualan} · ${escapeHTML(namaPelanggan(s.id_pelanggan))}
                · Sisa ${rupiah(s.sisa_piutang)}
            </option>`).join("");

    updatePaymentBalance();
}

function updatePaymentBalance() {
    const s = penjualan($("pilihPenjualan").value);
    $("paymentBalanceNote").textContent = s
        ? `Sisa piutang: ${rupiah(s.sisa_piutang)}`
        : "Pilih transaksi untuk melihat sisa piutang.";

    $("jumlahBayar").max = s ? s.sisa_piutang : "";
}

$("pilihPenjualan").addEventListener("change", updatePaymentBalance);

function renderPembayaran() {
    const q = ($("searchPembayaran").value || "").toLowerCase();

    const rows = state.pembayaran.filter(p => {
        const s = penjualan(p.id_penjualan);
        return `${namaPelanggan(s?.id_pelanggan)} ${namaMobil(s?.id_kendaraan)} ${p.keterangan || ""}`
            .toLowerCase().includes(q);
    });

    $("countPembayaran").textContent = `${rows.length} pembayaran`;

    $("tablePembayaran").innerHTML = rows.length
        ? rows.map(p => {
            const s = penjualan(p.id_penjualan);
            return `<tr>
                <td>BYR-${p.id_pembayaran}</td>
                <td>${tanggal(p.tanggal_pembayaran)}</td>
                <td><div class="cell-primary">${escapeHTML(namaPelanggan(s?.id_pelanggan))}</div>
                    <div class="cell-secondary">${escapeHTML(namaMobil(s?.id_kendaraan))}</div></td>
                <td>${rupiah(p.jumlah_bayar)}</td>
                <td>${escapeHTML(p.keterangan || "-")}</td>
                <td><div class="actions">
                    <button class="action-btn" data-edit="pembayaran" data-id="${p.id_pembayaran}">Edit</button>
                    <button class="action-btn danger" data-delete="pembayaran" data-id="${p.id_pembayaran}">Hapus</button>
                </div></td>
            </tr>`;
        }).join("")
        : emptyRow(6);
}

$("formPembayaran").onsubmit = async e => {
    e.preventDefault();

    const id = $("pembayaranId").value;
    const selectedSale = Number($("pilihPenjualan").value);
    const s = penjualan(selectedSale);
    const old = id ? state.pembayaran.find(p => Number(p.id_pembayaran) === Number(id)) : null;

    const body = {
        id_penjualan: selectedSale,
        tanggal_pembayaran: $("tanggalPembayaran").value,
        jumlah_bayar: Number($("jumlahBayar").value),
        keterangan: $("keteranganPembayaran").value.trim() || null
    };

    if (!s) return toast("Pilih transaksi penjualan.", true);
    if (body.jumlah_bayar <= 0) return toast("Pembayaran harus lebih dari nol.", true);

    const batas = Number(s.sisa_piutang) +
        (old && Number(old.id_penjualan) === selectedSale ? Number(old.jumlah_bayar) : 0);

    if (body.jumlah_bayar > batas) {
        return toast("Pembayaran melebihi sisa piutang.", true);
    }

    await saveData("pembayaran", id, body, "formPanelPembayaran");
};

// SIMPAN, EDIT, DAN HAPUS
async function saveData(table, id, body, panelId) {
    const submitButton = $(panelId).querySelector('button[type="submit"], button:not([type])');
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Menyimpan...";

    try {
        await api(table, id ? "PUT" : "POST", id, body);
        $(panelId).hidden = true;
        toast(id ? "Data berhasil diperbarui." : "Data berhasil ditambahkan.");
        await loadAll();
    } catch (error) {
        toast(error.message, true);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
    }
}

function editData(table, id) {
    const configs = {
        pelanggan: {
            find: () => pelanggan(id),
            panel: "formPanelPelanggan", form: "formPelanggan", title: "pelangganFormTitle",
            heading: "Edit pelanggan",
            fields: { pelangganId:"id_pelanggan", namaPelanggan:"nama_pelanggan", ktpPelanggan:"no_ktp", telpPelanggan:"no_telp", alamatPelanggan:"alamat" }
        },
        kendaraan: {
            find: () => kendaraan(id),
            panel: "formPanelKendaraan", form: "formKendaraan", title: "kendaraanFormTitle",
            heading: "Edit kendaraan",
            fields: { kendaraanId:"id_kendaraan", merkKendaraan:"merk", modelKendaraan:"model", tahunKendaraan:"tahun", warnaKendaraan:"warna", hargaKendaraan:"harga" }
        },
        penjualan: {
            find: () => penjualan(id),
            panel: "formPanelPenjualan", form: "formPenjualan", title: "penjualanFormTitle",
            heading: "Edit penjualan",
            fields: { penjualanId:"id_penjualan", tanggalPenjualan:"tanggal_penjualan", hargaJual:"harga_jual", uangMuka:"uang_muka" }
        },
        pembayaran: {
            find: () => state.pembayaran.find(p => Number(p.id_pembayaran) === Number(id)),
            panel: "formPanelPembayaran", form: "formPembayaran", title: "pembayaranFormTitle",
            heading: "Edit pembayaran",
            fields: { pembayaranId:"id_pembayaran", tanggalPembayaran:"tanggal_pembayaran", jumlahBayar:"jumlah_bayar", keteranganPembayaran:"keterangan" }
        }
    };

    const c = configs[table];
    const item = c?.find();
    if (!item) return;

    openForm(c.panel, c.form, c.title, c.heading);

    if (table === "penjualan") {
        fillPelanggan(item.id_pelanggan);
        fillKendaraan(item.id_kendaraan);
        $("pilihPelanggan").value = item.id_pelanggan;
        $("pilihKendaraan").value = item.id_kendaraan;
    }

    if (table === "pembayaran") {
        fillPenjualan(item.id_penjualan);
        $("pilihPenjualan").value = item.id_penjualan;
        updatePaymentBalance();
    }

    Object.entries(c.fields).forEach(([elementId, key]) => {
        $(elementId).value = item[key] ?? "";
    });
}

document.addEventListener("click", async e => {
    const button = e.target.closest("button");
    if (!button) return;

    if (button.dataset.edit) {
        editData(button.dataset.edit, button.dataset.id);
        return;
    }

    if (button.dataset.detail) {
        const s = penjualan(button.dataset.detail);
        if (!s) return;

        const payments = state.pembayaran.filter(
            p => Number(p.id_penjualan) === Number(s.id_penjualan)
        );

        alert(
            `DETAIL PENJUALAN PJ-${s.id_penjualan}\n\n` +
            `Pelanggan: ${namaPelanggan(s.id_pelanggan)}\n` +
            `Kendaraan: ${namaMobil(s.id_kendaraan)}\n` +
            `Tanggal: ${tanggal(s.tanggal_penjualan)}\n` +
            `Harga jual: ${rupiah(s.harga_jual)}\n` +
            `Uang muka: ${rupiah(s.uang_muka)}\n` +
            `Piutang awal: ${rupiah(piutangAwal(s))}\n` +
            `Total cicilan: ${rupiah(totalCicilan(s.id_penjualan))}\n` +
            `Sisa piutang: ${rupiah(s.sisa_piutang)}\n` +
            `Status: ${s.status}\n\n` +
            `RIWAYAT PEMBAYARAN\n` +
            (payments.length
                ? payments.map(p => `${tanggal(p.tanggal_pembayaran)} — ${rupiah(p.jumlah_bayar)}`).join("\n")
                : "Belum ada pembayaran.")
        );
        return;
    }

    if (button.dataset.delete) {
        const table = button.dataset.delete;
        const id = button.dataset.id;

        if (!confirm("Yakin ingin menghapus data ini?")) return;

        try {
            await api(table, "DELETE", id);
            toast("Data berhasil dihapus.");
            await loadAll();
        } catch (error) {
            toast(error.message, true);
        }
    }
});

// DASHBOARD
function formatChartValue(value) {
    if (value >= 1_000_000_000) {
        return `Rp${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
    }
    if (value >= 1_000_000) {
        return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} jt`;
    }
    return rupiah(value);
}

function renderCashflowChart() {
    const now = new Date();
    const months = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months.push({
            key,
            label: date.toLocaleDateString("id-ID", { month: "short" }),
            sales: 0,
            payments: 0
        });
    }

    const buckets = new Map(months.map(month => [month.key, month]));
    const monthKey = value => String(value || "").slice(0, 7);

    state.penjualan.forEach(sale => {
        const month = buckets.get(monthKey(sale.tanggal_penjualan));
        if (month) month.sales += Number(sale.harga_jual) || 0;
    });

    state.pembayaran.forEach(payment => {
        const month = buckets.get(monthKey(payment.tanggal_pembayaran));
        if (month) month.payments += Number(payment.jumlah_bayar) || 0;
    });

    const chart = $("cashflowChart");
    const width = 760;
    const height = 242;
    const plot = { left: 76, right: 744, top: 16, bottom: 184 };
    const maxValue = Math.max(0, ...months.flatMap(month => [month.sales, month.payments]));
    const roughStep = maxValue > 0 ? maxValue / 4 : 1;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const fraction = roughStep / magnitude;
    const stepScale = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    const step = stepScale * magnitude;
    const maxScale = step * 4;
    const x = index => plot.left + (plot.right - plot.left) * index / (months.length - 1);
    const y = value => plot.bottom - (value / maxScale) * (plot.bottom - plot.top);
    const pointsFor = field => months.map((month, index) => ({
        x: x(index),
        y: y(month[field]),
        value: month[field],
        label: month.label
    }));
    const pathFor = points => points
        .map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(" ");
    const salesPoints = pointsFor("sales");
    const paymentPoints = pointsFor("payments");
    const salesPath = pathFor(salesPoints);
    const paymentPath = pathFor(paymentPoints);
    const areaPath = `${salesPath} L ${plot.right} ${plot.bottom} L ${plot.left} ${plot.bottom} Z`;
    const hasData = maxValue > 0;

    const grid = Array.from({ length: 5 }, (_, index) => {
        const value = maxScale * (4 - index) / 4;
        const lineY = y(value);
        return `<g>
            <line class="chart-grid-line" x1="${plot.left}" y1="${lineY}" x2="${plot.right}" y2="${lineY}"></line>
            <text class="chart-axis-label" x="${plot.left - 12}" y="${lineY + 4}" text-anchor="end">${formatChartValue(value)}</text>
        </g>`;
    }).join("");

    const points = (items, className, seriesName) => items.map(point => `
        <circle class="chart-point ${className}" cx="${point.x}" cy="${point.y}" r="4">
            <title>${seriesName} · ${point.label}: ${rupiah(point.value)}</title>
        </circle>`).join("");

    chart.innerHTML = `
        <svg class="cashflow-svg" viewBox="0 0 ${width} ${height}" role="img"
            aria-label="Grafik nilai penjualan dan pembayaran untuk enam bulan terakhir">
            <defs>
                <linearGradient id="salesAreaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#5f8a6b" stop-opacity=".2"></stop>
                    <stop offset="100%" stop-color="#5f8a6b" stop-opacity="0"></stop>
                </linearGradient>
            </defs>
            ${grid}
            <path class="chart-area" d="${areaPath}"></path>
            <path class="chart-line sales-line" d="${salesPath}"></path>
            <path class="chart-line payments-line" d="${paymentPath}"></path>
            ${points(salesPoints, "sales-point", "Penjualan")}
            ${points(paymentPoints, "payments-point", "Pembayaran")}
            ${months.map((month, index) => `
                <text class="chart-month-label" x="${x(index)}" y="218" text-anchor="middle">${escapeHTML(month.label)}</text>
            `).join("")}
            ${!hasData ? `<text class="chart-empty-label" x="${(plot.left + plot.right) / 2}" y="${(plot.top + plot.bottom) / 2}" text-anchor="middle">Belum ada transaksi dalam enam bulan terakhir</text>` : ""}
        </svg>`;
}

function renderDashboard() {
    const totalAwal = state.penjualan.reduce((n, s) => n + piutangAwal(s), 0);
    const totalBayar = state.pembayaran.reduce((n, p) => n + Number(p.jumlah_bayar), 0);
    const totalSisa = state.penjualan.reduce((n, s) => n + sisaPiutang(s), 0);
    const lunas = state.penjualan.filter(s => s.status === "LUNAS").length;
    const belum = state.penjualan.length - lunas;

    $("statKendaraan").textContent = state.kendaraan.length;
    $("statKendaraanSub").textContent =
        `${state.kendaraan.filter(v => v.status === "TERSEDIA").length} unit tersedia`;
    $("statPenjualan").textContent = state.penjualan.length;
    $("statPiutang").textContent = rupiah(totalAwal);
    $("statSisa").textContent = rupiah(totalSisa);

    $("balanceAwal").textContent = rupiah(totalAwal);
    $("balanceBayar").textContent = rupiah(totalBayar);
    $("balanceSisa").textContent = rupiah(totalSisa);

    const progress = totalAwal ? Math.min(100, totalBayar / totalAwal * 100) : 0;
    $("collectionProgress").style.width = `${progress}%`;
    $("collectionLabel").textContent = `${progress.toFixed(1)}% dari piutang awal sudah tertagih`;

    $("countLunas").textContent = lunas;
    $("countBelum").textContent = belum;

    const total = Math.max(1, state.penjualan.length);
    $("barLunas").style.width = `${lunas / total * 100}%`;
    $("barBelum").style.width = `${belum / total * 100}%`;
    $("statusHint").textContent = `${lunas} lunas · ${belum} belum lunas`;

    renderCashflowChart();

    const latest = [...state.penjualan]
        .sort((a, b) => String(b.tanggal_penjualan).localeCompare(String(a.tanggal_penjualan)))
        .slice(0, 5);

    $("recentSales").innerHTML = latest.length
        ? latest.map(s => `<tr>
            <td>${tanggal(s.tanggal_penjualan)}</td>
            <td>${escapeHTML(namaPelanggan(s.id_pelanggan))}</td>
            <td>${escapeHTML(namaMobil(s.id_kendaraan))}</td>
            <td>${rupiah(s.harga_jual)}</td>
            <td>${rupiah(s.sisa_piutang)}</td>
            <td>${badge(s.status)}</td>
        </tr>`).join("")
        : emptyRow(6, "Belum ada transaksi.");
}

// LAPORAN
function renderLaporan() {
    const q = ($("searchLaporan").value || "").toLowerCase();
    const filter = $("filterLaporan").value;

    const rows = state.penjualan.filter(s =>
        `${namaPelanggan(s.id_pelanggan)} ${namaMobil(s.id_kendaraan)}`.toLowerCase().includes(q)
        && (!filter || s.status === filter)
    );

    $("reportAwal").textContent = rupiah(rows.reduce((n, s) => n + piutangAwal(s), 0));
    $("reportBayar").textContent = rupiah(rows.reduce((n, s) => n + totalCicilan(s.id_penjualan), 0));
    $("reportSisa").textContent = rupiah(rows.reduce((n, s) => n + sisaPiutang(s), 0));

    $("tableLaporan").innerHTML = rows.length
        ? rows.map(s => `<tr>
            <td>PJ-${s.id_penjualan}</td>
            <td>${tanggal(s.tanggal_penjualan)}</td>
            <td>${escapeHTML(namaPelanggan(s.id_pelanggan))}</td>
            <td>${escapeHTML(namaMobil(s.id_kendaraan))}</td>
            <td>${rupiah(s.harga_jual)}</td>
            <td>${rupiah(s.uang_muka)}</td>
            <td>${rupiah(totalCicilan(s.id_penjualan))}</td>
            <td>${rupiah(s.sisa_piutang)}</td>
            <td>${badge(s.status)}</td>
        </tr>`).join("")
        : emptyRow(9);
}

// Pencarian dan filter
$("searchPelanggan").addEventListener("input", renderPelanggan);
$("searchKendaraan").addEventListener("input", renderKendaraan);
$("searchPenjualan").addEventListener("input", renderPenjualan);
$("searchPembayaran").addEventListener("input", renderPembayaran);
$("searchLaporan").addEventListener("input", renderLaporan);

$("filterKendaraan").addEventListener("change", renderKendaraan);
$("filterPenjualan").addEventListener("change", renderPenjualan);
$("filterLaporan").addEventListener("change", renderLaporan);
$("refreshDashboard").addEventListener("click", loadAll);
$("printReport").addEventListener("click", () => {
    showPage("laporan");
    window.print();
});

loadAll();
