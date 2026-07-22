import React, { useState, useEffect } from "react";

// Tiny inline icon replacements — avoids needing to install any package.
const Spinner = () => (
  <span
    style={{
      display: "inline-block",
      width: 14,
      height: 14,
      border: "2px solid rgba(0,0,0,0.15)",
      borderTopColor: "currentColor",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      verticalAlign: "-2px",
    }}
  />
);
const Icon = ({ children, size = 15 }) => <span style={{ fontSize: size, lineHeight: 1, display: "inline-block" }}>{children}</span>;

// ---- Supabase project (from Project Settings -> API) ----
const SUPABASE_URL = "https://veeldtadkieukwqmafvo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZWxkdGFka2lldWt3cW1hZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzI3MDksImV4cCI6MjEwMDIwODcwOX0.QoWn9sWQZa5gYL3b3OC5CCelcSCxaUjzMTm8GgjdrSQ";

// ---- Design tokens (same identity as the earlier СкладСеть prototype) ----
const c = {
  ink: "#1C2128",
  steel: "#4A5568",
  steelLight: "#8A93A3",
  cloud: "#F3F4F7",
  panel: "#FFFFFF",
  border: "#E2E4E9",
  amber: "#E8A93B",
  amberDark: "#C98F22",
  green: "#2F7D5C",
  greenBg: "#E8F3EE",
  red: "#B3432D",
  redBg: "#FBEAE5",
};
const displayFont = "'Space Grotesk', 'Segoe UI', sans-serif";
const bodyFont = "'Inter', 'Segoe UI', sans-serif";
const monoFont = "'IBM Plex Mono', 'Courier New', monospace";

// ---- Thin REST layer over Supabase (no SDK available in this runtime) ----
async function authRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || "Ошибка авторизации");
  return data;
}
async function db(table, { method = "GET", query = "", body, session, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session ? session.access_token : SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ошибка запроса (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${c.border}`,
  fontFamily: bodyFont,
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box",
};
const primaryBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: c.amber,
  color: c.ink,
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontFamily: bodyFont,
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};

// ---- Auth screen ----
function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit() {
    setError("");
    setNotice("");
    if (!email.trim() || password.length < 6) {
      setError("Укажите email и пароль (минимум 6 символов).");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const data = await authRequest("signup", { email, password });
        if (data.access_token) {
          onSignedIn({ access_token: data.access_token, user: data.user });
        } else {
          setNotice("Регистрация прошла. Если в проекте включено подтверждение почты — перейдите по ссылке из письма, затем войдите.");
          setMode("login");
        }
      } else {
        const data = await authRequest("token?grant_type=password", { email, password });
        onSignedIn({ access_token: data.access_token, user: data.user });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.cloud, fontFamily: bodyFont }}>
      <div style={{ width: 380, background: c.panel, border: `1px solid ${c.border}`, borderRadius: 12, padding: 28 }}>
        <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 20, color: c.ink, marginBottom: 4 }}>СкладСеть</div>
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel, marginBottom: 20 }}>
          {mode === "login" ? "Вход в ваш магазин" : "Регистрация нового магазина"}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { key: "login", label: "Вход" },
            { key: "signup", label: "Регистрация" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setMode(t.key);
                setError("");
                setNotice("");
              }}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${mode === t.key ? c.amberDark : c.border}`,
                background: mode === t.key ? "#FDF3E2" : "#fff",
                color: c.ink,
                fontFamily: bodyFont,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 10 }}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Пароль (минимум 6 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 12 }}>
            <Icon size={15}>⚠</Icon>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ background: c.greenBg, color: c.green, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 12 }}>{notice}</div>
        )}

        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, width: "100%", opacity: busy ? 0.7 : 1 }}>
          {busy ? <Spinner /> : mode === "login" ? <Icon size={15}>→</Icon> : <Icon size={15}>+</Icon>}
          {mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ---- Item add/edit form ----
const fieldLabel = { display: "block", fontFamily: bodyFont, fontSize: 11, fontWeight: 600, color: c.steel, marginBottom: 4 };
function Field({ label, children }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function ItemForm({ initial, onSave, onDelete, onCancel }) {
  const empty = { sku: "", alt_sku: "", name: "", model: "", qty: 0, price: 0, purchase_price: 0, min_qty: 5 };
  const [form, setForm] = useState(initial || empty);
  const valid = form.sku.trim() && form.name.trim();

  return (
    <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: displayFont, fontSize: 14.5, fontWeight: 600, color: c.ink }}>{initial ? "Редактировать товар" : "Новый товар"}</div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: c.steel }}>
          <Icon size={17}>✕</Icon>
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Field label="Артикул">
          <input placeholder="Например, 90915-YZZD4" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Артикул замены">
          <input placeholder="Необязательно" value={form.alt_sku} onChange={(e) => setForm({ ...form, alt_sku: e.target.value })} style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Field label="Наименование">
          <input placeholder="Например, Масляный фильтр" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Модель">
          <input placeholder="Например, Camry" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Field label="Количество, шт">
          <input type="number" value={form.qty} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) || 0 })} style={inputStyle} />
        </Field>
        <Field label="Цена продажи, ₸">
          <input type="number" value={form.price} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} style={inputStyle} />
        </Field>
        <Field label="Закупочная цена, ₸">
          <input type="number" value={form.purchase_price} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) || 0 })} style={inputStyle} />
        </Field>
        <Field label="Мин. остаток, шт">
          <input type="number" value={form.min_qty} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, min_qty: Number(e.target.value) || 0 })} style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          {initial && (
            <button
              onClick={() => onDelete(initial.id)}
              style={{ background: c.redBg, color: c.red, border: "none", borderRadius: 8, padding: "9px 14px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
            >
              Удалить
            </button>
          )}
        </div>
        <button disabled={!valid} onClick={() => onSave(form)} style={{ ...primaryBtn, opacity: valid ? 1 : 0.5, cursor: valid ? "pointer" : "not-allowed" }}>
          {initial ? "Сохранить изменения" : "Добавить на склад"}
        </button>
      </div>
    </div>
  );
}

// ---- Stock screen: real CRUD against Supabase ----
function StockScreen({ session, shop }) {
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState(null); // null | "new" | item

  async function load() {
    setError("");
    try {
      const rows = await db("stock", { query: `?shop_id=eq.${shop.id}&order=name.asc`, session });
      setItems(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [shop.id]);

  async function saveItem(form) {
    try {
      if (form.id) {
        await db("stock", {
          method: "PATCH",
          query: `?id=eq.${form.id}`,
          body: { sku: form.sku, alt_sku: form.alt_sku, name: form.name, model: form.model, qty: form.qty, price: form.price, purchase_price: form.purchase_price, min_qty: form.min_qty },
          session,
          prefer: "return=minimal",
        });
      } else {
        await db("stock", {
          method: "POST",
          body: { shop_id: shop.id, sku: form.sku, alt_sku: form.alt_sku, name: form.name, model: form.model, qty: form.qty, price: form.price, purchase_price: form.purchase_price, min_qty: form.min_qty },
          session,
          prefer: "return=minimal",
        });
      }
      setFormMode(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function deleteItem(id) {
    try {
      await db("stock", { method: "DELETE", query: `?id=eq.${id}`, session, prefer: "return=minimal" });
      setFormMode(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink }}>Склад</div>
        <button onClick={() => setFormMode(formMode === "new" ? null : "new")} style={primaryBtn}>
          <Icon size={15}>+</Icon> Добавить товар
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 8, background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
          <Icon size={15}>⚠</Icon>
          {error}
        </div>
      )}

      {formMode === "new" && <ItemForm onSave={saveItem} onCancel={() => setFormMode(null)} />}
      {formMode && formMode !== "new" && <ItemForm initial={formMode} onSave={saveItem} onDelete={deleteItem} onCancel={() => setFormMode(null)} />}

      <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.ink, color: "#B8C0CC", fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 130 }}>Артикул</span>
          <span style={{ flex: 1 }}>Наименование</span>
          <span style={{ width: 100 }}>Модель</span>
          <span style={{ width: 60, textAlign: "right" }}>Кол.</span>
          <span style={{ width: 90, textAlign: "right" }}>Цена</span>
          <span style={{ width: 24 }} />
        </div>

        {items === null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 20, fontFamily: bodyFont, fontSize: 13, color: c.steel }}>
            <Spinner /> Загружаю склад из базы…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {items && items.length === 0 && (
          <div style={{ padding: 24, fontFamily: bodyFont, fontSize: 13.5, color: c.steel, textAlign: "center" }}>
            Склад пуст. Нажмите «Добавить товар» — запись сохранится в вашей базе Supabase.
          </div>
        )}
        {items &&
          items.map((it, i) => (
            <div
              key={it.id}
              onClick={() => setFormMode(it)}
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 14px",
                borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
                fontFamily: bodyFont,
                fontSize: 13,
                cursor: "pointer",
                alignItems: "center",
              }}
            >
              <span style={{ width: 130, fontFamily: monoFont, fontWeight: 600, color: c.ink }}>{it.sku}</span>
              <span style={{ flex: 1, color: c.ink }}>{it.name}</span>
              <span style={{ width: 100, color: c.steel, fontSize: 12 }}>{it.model}</span>
              <span style={{ width: 60, textAlign: "right", fontFamily: monoFont, fontWeight: 600, color: it.qty <= it.min_qty ? c.red : c.ink }}>{it.qty}</span>
              <span style={{ width: 90, textAlign: "right", fontFamily: monoFont, color: c.amberDark, fontWeight: 700 }}>{it.price.toLocaleString("ru-RU")}</span>
              <span style={{ width: 24, textAlign: "right", color: c.steelLight }}>
                <Icon size={13}>✎</Icon>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ---- App shell: bootstraps the shop row for the logged-in user ----
export default function App() {
  const [session, setSession] = useState(null);
  const [shop, setShop] = useState(null);
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    if (!session) return;
    (async () => {
      setBootError("");
      try {
        const rows = await db("shops", { query: `?owner_id=eq.${session.user.id}`, session });
        if (rows.length > 0) {
          setShop(rows[0]);
        } else {
          const created = await db("shops", {
            method: "POST",
            body: { owner_id: session.user.id, name: "Мой магазин" },
            session,
            prefer: "return=representation",
          });
          setShop(created[0]);
        }
      } catch (e) {
        setBootError(e.message);
      }
    })();
  }, [session]);

  if (!session) return <AuthScreen onSignedIn={setSession} />;

  if (bootError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.cloud, fontFamily: bodyFont }}>
        <div style={{ maxWidth: 420, background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: "flex", gap: 8, color: c.red, marginBottom: 8 }}>
            <Icon size={16}>⚠</Icon> <strong>Не удалось загрузить магазин</strong>
          </div>
          <div style={{ fontSize: 12.5, color: c.steel, fontFamily: monoFont }}>{bootError}</div>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.cloud, fontFamily: bodyFont, color: c.steel }}>
        <Spinner /> &nbsp;Готовим ваш магазин…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: c.cloud, fontFamily: bodyFont }}>
      <aside style={{ width: 220, background: c.ink, padding: "22px 14px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <div style={{ padding: "0 10px", marginBottom: 22 }}>
          <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 17, color: "#fff" }}>СкладСеть</div>
          <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: c.steelLight, marginTop: 2 }}>{shop.name || "Мой магазин"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: c.amber, color: c.ink, fontWeight: 600, fontSize: 14 }}>
          <Icon size={17}>📦</Icon> Склад
        </div>
        <div style={{ marginTop: "auto", padding: "10px 14px", fontSize: 11, color: c.steelLight, fontFamily: bodyFont }}>
          Остальные разделы (продажи, заказы, отчёты) подключим следующими.
        </div>
        <button
          onClick={() => {
            setSession(null);
            setShop(null);
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: `1px solid #3A414D`, borderRadius: 8, padding: "9px 14px", color: "#B8C0CC", fontFamily: bodyFont, fontSize: 12.5, cursor: "pointer" }}
        >
          <Icon size={14}>⏻</Icon> Выйти
        </button>
      </aside>

      <main style={{ flex: 1, padding: "26px 32px", minWidth: 0 }}>
        <StockScreen session={session} shop={shop} />
      </main>
    </div>
  );
}