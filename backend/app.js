"use strict";

const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const LOCAL_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
];
const ALLOWED_ORIGINS = new Set(
    (process.env.ALLOWED_ORIGINS || LOCAL_ORIGINS.join(","))
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
);

const TABLES = Object.freeze({
    pelanggan: {
        id: "id_pelanggan",
        fields: {
            nama_pelanggan: { type: "string", required: true, max: 100 },
            no_ktp: { type: "string", required: true, max: 30 },
            no_telp: { type: "string", nullable: true, max: 20 },
            alamat: { type: "string", nullable: true }
        }
    },
    kendaraan: {
        id: "id_kendaraan",
        fields: {
            merk: { type: "string", required: true, max: 60 },
            model: { type: "string", required: true, max: 80 },
            tahun: { type: "integer", required: true, min: 1950, max: 2100 },
            warna: { type: "string", nullable: true, max: 40 },
            harga: { type: "number", required: true, min: 0 }
        }
    },
    penjualan: {
        id: "id_penjualan",
        fields: {
            id_pelanggan: { type: "integer", required: true, min: 1 },
            id_kendaraan: { type: "integer", required: true, min: 1 },
            tanggal_penjualan: { type: "date", required: true },
            harga_jual: { type: "number", required: true, min: 0 },
            uang_muka: { type: "number", required: true, min: 0 }
        }
    },
    pembayaran: {
        id: "id_pembayaran",
        fields: {
            id_penjualan: { type: "integer", required: true, min: 1 },
            tanggal_pembayaran: { type: "date", required: true },
            jumlah_bayar: { type: "number", required: true, min: 0.01 },
            keterangan: { type: "string", nullable: true, max: 150 }
        }
    }
});

function responseHeaders(origin) {
    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Vary": "Origin"
    };

    if (origin && ALLOWED_ORIGINS.has(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    }

    return headers;
}

function send(res, status, data, origin) {
    res.writeHead(status, responseHeaders(origin));
    res.end(JSON.stringify(data));
}

function success(res, status, data, origin) {
    send(res, status, { ok: true, data }, origin);
}

function failure(res, status, message, origin) {
    send(res, status, { ok: false, error: message }, origin);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        let exceeded = false;

        req.on("data", chunk => {
            if (exceeded) return;
            raw += chunk;

            if (Buffer.byteLength(raw, "utf8") > 1_000_000) {
                exceeded = true;
                reject(new Error("Ukuran request terlalu besar (maksimal 1 MB)."));
            }
        });

        req.on("end", () => {
            if (exceeded) return;
            if (!raw.trim()) {
                reject(new Error("Body JSON wajib diisi."));
                return;
            }

            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error("Format JSON tidak valid."));
            }
        });

        req.on("error", error => {
            if (!exceeded) reject(error);
        });
    });
}

function validatePayload(table, payload, isCreate) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Body harus berupa objek JSON.");
    }

    const fields = TABLES[table].fields;
    const keys = Object.keys(payload);
    if (!keys.length) throw new Error("Body tidak boleh kosong.");

    for (const key of keys) {
        const rule = fields[key];
        if (!rule) throw new Error(`Kolom '${key}' tidak diizinkan.`);
        const value = payload[key];

        if (value === null && rule.nullable) continue;
        if (rule.type === "string") {
            if (typeof value !== "string" || !value.trim()) {
                throw new Error(`Kolom '${key}' harus berupa teks yang tidak kosong.`);
            }
            if (rule.max && value.length > rule.max) {
                throw new Error(`Kolom '${key}' maksimal ${rule.max} karakter.`);
            }
        } else if (rule.type === "number" || rule.type === "integer") {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new Error(`Kolom '${key}' harus berupa angka yang valid.`);
            }
            if (rule.type === "integer" && !Number.isInteger(value)) {
                throw new Error(`Kolom '${key}' harus berupa bilangan bulat.`);
            }
            if (value < rule.min || (rule.max !== undefined && value > rule.max)) {
                throw new Error(`Nilai kolom '${key}' berada di luar batas yang diizinkan.`);
            }
        } else if (rule.type === "date") {
            const timestamp = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
                ? Date.parse(`${value}T00:00:00.000Z`)
                : NaN;
            if (!Number.isFinite(timestamp) ||
                new Date(timestamp).toISOString().slice(0, 10) !== value) {
                throw new Error(`Kolom '${key}' harus berisi tanggal yang valid (YYYY-MM-DD).`);
            }
        }
    }

    if (isCreate) {
        for (const [key, rule] of Object.entries(fields)) {
            if (rule.required && !Object.prototype.hasOwnProperty.call(payload, key)) {
                throw new Error(`Kolom '${key}' wajib diisi.`);
            }
        }
    }

    if (table === "penjualan" &&
        payload.harga_jual !== undefined &&
        payload.uang_muka !== undefined &&
        payload.uang_muka > payload.harga_jual) {
        throw new Error("Uang muka tidak boleh melebihi harga jual.");
    }

    return payload;
}

function databaseErrorMessage(data) {
    if (!data || typeof data !== "object") return "Permintaan ke database Supabase gagal.";
    return data.message || data.details || data.hint || "Permintaan ke database Supabase gagal.";
}

async function database(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || "GET",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: options.prefer || "return=representation"
        },
        body: options.body
    });

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        const error = new Error(databaseErrorMessage(data));
        error.status = response.status;
        error.code = typeof data?.code === "string" ? data.code : "";
        throw error;
    }

    return data;
}

async function supabaseAuth(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
        method: options.method || "POST",
        headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: options.authorization || `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    return { response, data };
}

async function authenticatedAdmin(req) {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !ADMIN_EMAIL) {
        return { status: 500, message: "Konfigurasi autentikasi backend belum lengkap." };
    }

    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")?.[1];
    if (!token) return { status: 401, message: "Silakan login untuk melanjutkan." };

    try {
        const { response, data } = await supabaseAuth("user", {
            method: "GET",
            authorization: `Bearer ${token}`
        });
        if (!response.ok) return { status: 401, message: "Sesi login tidak valid atau sudah berakhir." };

        if (String(data?.email || "").trim().toLowerCase() !== ADMIN_EMAIL) {
            return { status: 403, message: "Akun ini tidak diizinkan mengakses data showroom." };
        }

        return { user: { email: data.email } };
    } catch {
        return { status: 502, message: "Tidak dapat memverifikasi sesi melalui Supabase Auth." };
    }
}

function databaseStatus(error) {
    if (error.code === "23505" || error.code === "23503") return 409;
    if (error.code === "23514") return 422;
    if (error.code === "23502" || error.code === "22P02" || error.code === "22003") return 422;
    if (error.status === 401 || error.status === 403) return 502;
    return error.status >= 400 && error.status < 500 ? 422 : 502;
}

const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return failure(res, 403, "Origin tidak diizinkan oleh konfigurasi CORS.", null);
    }

    if (req.method === "OPTIONS") {
        res.writeHead(204, responseHeaders(origin));
        return res.end();
    }

    let url;
    try {
        url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    } catch {
        return failure(res, 400, "URL request tidak valid.", origin);
    }

    if (url.pathname === "/api/health" && req.method === "GET") {
        return success(res, 200, { status: "API aktif" }, origin);
    }

    const authMatch = url.pathname.match(/^\/api\/auth\/(login|refresh|logout)$/);
    if (authMatch) {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST, OPTIONS");
            return failure(res, 405, "Metode tidak didukung untuk endpoint autentikasi ini.", origin);
        }
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !ADMIN_EMAIL) {
            return failure(res, 500, "Konfigurasi autentikasi backend belum lengkap.", origin);
        }
        if (authMatch[1] === "logout") {
            const auth = await authenticatedAdmin(req);
            if (auth.status) return failure(res, auth.status, auth.message, origin);
            const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")[1];
            try {
                const { response } = await supabaseAuth("logout", {
                    method: "POST",
                    authorization: `Bearer ${token}`
                });
                if (!response.ok) return failure(res, 401, "Sesi tidak dapat ditutup. Silakan login kembali.", origin);
                return success(res, 200, { message: "Sesi berhasil ditutup." }, origin);
            } catch {
                return failure(res, 502, "Tidak dapat menghubungi Supabase Auth.", origin);
            }
        }

        if (!req.headers["content-type"]?.toLowerCase().includes("application/json")) {
            return failure(res, 415, "Content-Type harus application/json.", origin);
        }

        let body;
        try {
            body = await readBody(req);
        } catch (error) {
            return failure(res, 400, error.message, origin);
        }

        let authPath;
        let authBody;
        if (authMatch[1] === "login") {
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
                typeof body.password !== "string" || !body.password) {
                return failure(res, 400, "Masukkan email dan password yang valid.", origin);
            }
            if (email !== ADMIN_EMAIL) {
                return failure(res, 403, "Akun ini tidak diizinkan mengakses data showroom.", origin);
            }
            authPath = "token?grant_type=password";
            authBody = { email, password: body.password };
        } else {
            if (typeof body.refresh_token !== "string" || !body.refresh_token.trim()) {
                return failure(res, 400, "Refresh token tidak valid.", origin);
            }
            authPath = "token?grant_type=refresh_token";
            authBody = { refresh_token: body.refresh_token };
        }

        try {
            const { response, data } = await supabaseAuth(authPath, { body: authBody });
            if (!response.ok) {
                return failure(
                    res,
                    response.status === 400 || response.status === 401 ? 401 : 502,
                    authMatch[1] === "login"
                        ? "Login gagal. Periksa email dan password akun Supabase Auth."
                        : "Sesi sudah berakhir. Silakan login kembali.",
                    origin
                );
            }

            if (!data?.access_token || !data?.refresh_token || !data?.user?.email ||
                String(data.user.email).trim().toLowerCase() !== ADMIN_EMAIL) {
                return failure(res, 403, "Akun ini tidak diizinkan mengakses data showroom.", origin);
            }

            return success(res, 200, {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in: Number(data.expires_in) || 3600,
                user: { email: data.user.email }
            }, origin);
        } catch {
            return failure(res, 502, "Tidak dapat menghubungi Supabase Auth.", origin);
        }
    }

    const match = url.pathname.match(
        /^\/api\/(pelanggan|kendaraan|penjualan|pembayaran)(?:\/([1-9]\d*))?$/
    );
    if (!match) return failure(res, 404, "Endpoint tidak ditemukan.", origin);

    const [, table, id] = match;
    const spec = TABLES[table];
    const collectionMethods = ["GET", "POST"];
    const itemMethods = ["GET", "PUT", "DELETE"];
    if ((id && !itemMethods.includes(req.method)) ||
        (!id && !collectionMethods.includes(req.method))) {
        res.setHeader("Allow", id ? itemMethods.join(", ") : collectionMethods.join(", "));
        return failure(res, 405, "Metode tidak didukung untuk endpoint ini.", origin);
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return failure(res, 500, "Konfigurasi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur.", origin);
    }

    try {
        const auth = await authenticatedAdmin(req);
        if (auth.status) return failure(res, auth.status, auth.message, origin);

        if (req.method === "GET") {
            const query = new URLSearchParams({ select: "*", order: `${spec.id}.desc` });
            if (id) query.set(spec.id, `eq.${id}`);
            const rows = await database(`${table}?${query}`);

            if (id && !rows.length) return failure(res, 404, "Data tidak ditemukan.", origin);
            return success(res, 200, id ? rows[0] : rows, origin);
        }

        if (req.method === "POST" || req.method === "PUT") {
            if (req.method === "POST" && id) {
                return failure(res, 405, "Gunakan endpoint koleksi untuk menambah data.", origin);
            }
            if (req.method === "PUT" && !id) {
                return failure(res, 405, "ID data wajib disertakan untuk mengubah data.", origin);
            }
            if (!req.headers["content-type"]?.toLowerCase().includes("application/json")) {
                return failure(res, 415, "Content-Type harus application/json.", origin);
            }

            let payload;
            try {
                payload = validatePayload(table, await readBody(req), req.method === "POST");
            } catch (error) {
                return failure(res, 400, error.message, origin);
            }

            const query = new URLSearchParams();
            if (id) query.set(spec.id, `eq.${id}`);
            const path = id ? `${table}?${query}` : table;
            const rows = await database(path, {
                method: req.method === "PUT" ? "PATCH" : "POST",
                body: JSON.stringify(payload)
            });

            if (id && !rows.length) return failure(res, 404, "Data tidak ditemukan.", origin);
            return success(res, req.method === "POST" ? 201 : 200, id ? rows[0] : rows, origin);
        }

        if (req.method === "DELETE") {
            const query = new URLSearchParams({ [spec.id]: `eq.${id}` });
            const rows = await database(`${table}?${query}`, {
                method: "DELETE",
                prefer: "return=representation"
            });

            if (!rows.length) return failure(res, 404, "Data tidak ditemukan.", origin);
            return success(res, 200, rows[0], origin);
        }

        return failure(res, 405, "Metode tidak didukung.", origin);
    } catch (error) {
        const status = Number.isInteger(error.status) || error.code
            ? databaseStatus(error)
            : 502;
        return failure(res, status, error.message || "Terjadi kesalahan saat mengakses Supabase.", origin);
    }
});

server.listen(PORT, () => {
    console.log(`Showroom AR API berjalan pada port ${PORT}`);
});
