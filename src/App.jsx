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
function genDocNumber(prefix) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
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

// ---- Pick or quickly create a counterparty (real data from `counterparties`) ----
function CounterpartyModal({ session, shop, onSelect, onClose }) {
  const [list, setList] = useState(null);
  const [mode, setMode] = useState("list"); // "list" | "form"
  const [form, setForm] = useState({ kind: "Физлицо", name: "", phone: "" });
  const [error, setError] = useState("");

  async function load() {
    try {
      const rows = await db("counterparties", { query: `?shop_id=eq.${shop.id}&order=name.asc`, session });
      setList(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  async function save() {
    if (!form.name.trim()) return;
    try {
      const created = await db("counterparties", {
        method: "POST",
        body: { shop_id: shop.id, kind: form.kind, name: form.name, phones: [form.phone, "", ""] },
        session,
        prefer: "return=representation",
      });
      onSelect(created[0]);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,33,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: c.panel, borderRadius: 12, width: 400, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 600, color: c.ink }}>Контрагент</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.steel }}>
            <Icon size={17}>✕</Icon>
          </button>
        </div>
        <div style={{ padding: 18 }}>
          {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "8px 10px", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {mode === "list" ? (
            <>
              <button
                onClick={() => setMode("form")}
                style={{ ...primaryBtn, background: c.ink, color: "#fff", width: "100%", marginBottom: 12 }}
              >
                <Icon size={14}>+</Icon> Новый контрагент
              </button>
              {list === null && (
                <div style={{ display: "flex", gap: 8, color: c.steel, fontSize: 13 }}>
                  <Spinner /> Загружаю…
                </div>
              )}
              {list && list.length === 0 && <div style={{ color: c.steel, fontSize: 13 }}>Контрагентов пока нет — добавьте нового.</div>}
              {list &&
                list.map((cp, i) => (
                  <div
                    key={cp.id}
                    onClick={() => onSelect(cp)}
                    style={{
                      padding: "10px 12px",
                      borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: c.ink }}>{cp.name}</div>
                      <div style={{ fontSize: 11.5, color: c.steel }}>{cp.kind}</div>
                    </div>
                  </div>
                ))}
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {["Физлицо", "Юрлицо"].map((k) => (
                  <button
                    key={k}
                    onClick={() => setForm({ ...form, kind: k })}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${form.kind === k ? c.amberDark : c.border}`,
                      background: form.kind === k ? "#FDF3E2" : "#fff",
                      fontFamily: bodyFont,
                      fontWeight: 600,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <input placeholder="Имя / название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => setMode("list")} style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "9px 14px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
                  Отмена
                </button>
                <button onClick={save} style={primaryBtn}>
                  Сохранить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Payment method picker ----
function PaymentMethodModal({ onSelect, onClose, counterpartyKind }) {
  const methods = [
    { key: "Наличные", emoji: "💵" },
    { key: "Безналичный (юрлицо)", emoji: "🏦", disabled: counterpartyKind === "Физлицо" },
    { key: "Терминал", emoji: "💳" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,33,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: c.panel, borderRadius: 12, width: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 600, color: c.ink }}>Способ оплаты</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.steel }}>
            <Icon size={17}>✕</Icon>
          </button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {methods.map((m) => (
            <button
              key={m.key}
              disabled={m.disabled}
              onClick={() => !m.disabled && onSelect(m.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: m.disabled ? c.cloud : "#fff",
                cursor: m.disabled ? "not-allowed" : "pointer",
                fontFamily: bodyFont,
                fontWeight: 600,
                fontSize: 13.5,
                color: m.disabled ? c.steelLight : c.ink,
                textAlign: "left",
              }}
            >
              <span>{m.emoji}</span> {m.key}
              {m.disabled && <span style={{ marginLeft: "auto", fontSize: 10.5 }}>только юрлицо</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ---- Sales screen: build an operation, post it, and browse the sales log ----
function SalesScreen({ session, shop }) {
  const [tab, setTab] = useState("new"); // "new" | "log"
  const [stockItems, setStockItems] = useState(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]); // [{stock_id, sku, name, qty, price}]
  const [comment, setComment] = useState("");
  const [postFlow, setPostFlow] = useState(null); // { type, step: "counterparty" | "payment" }
  const [flowCounterparty, setFlowCounterparty] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [salesLog, setSalesLog] = useState(null);

  async function loadStock() {
    try {
      const rows = await db("stock", { query: `?shop_id=eq.${shop.id}&order=name.asc`, session });
      setStockItems(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  async function loadLog() {
    try {
      const rows = await db("sales_log", { query: `?shop_id=eq.${shop.id}&order=date.desc,created_at.desc`, session });
      setSalesLog(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    loadStock();
    loadLog();
    // eslint-disable-next-line
  }, [shop.id]);

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((r) => r.stock_id === item.id);
      if (existing) return prev.map((r) => (r.stock_id === item.id ? { ...r, qty: r.qty + 1 } : r));
      return [...prev, { stock_id: item.id, sku: item.sku, name: item.name, qty: 1, price: item.price }];
    });
  }
  function updateQty(stock_id, qty) {
    setCart((prev) => prev.map((r) => (r.stock_id === stock_id ? { ...r, qty: Math.max(1, qty) } : r)));
  }
  function removeFromCart(stock_id) {
    setCart((prev) => prev.filter((r) => r.stock_id !== stock_id));
  }

  function startPost(type) {
    if (cart.length === 0) return;
    setError("");
    if (type === "Списание") {
      commit(type, null, null);
      return;
    }
    setPostFlow({ type, step: "counterparty" });
  }
  function handleCounterpartySelected(cp) {
    setFlowCounterparty(cp);
    if (postFlow.type === "Продажа") setPostFlow({ ...postFlow, step: "payment" });
    else commit(postFlow.type, cp, null);
  }
  function handlePaymentSelected(method) {
    commit(postFlow.type, flowCounterparty, method);
  }

  async function commit(type, counterparty, paymentMethod) {
    const qty = cart.reduce((s, r) => s + r.qty, 0);
    const sum = cart.reduce((s, r) => s + r.qty * r.price, 0);
    const items = cart.map((r) => ({ sku: r.sku, name: r.name, qty: r.qty, price: r.price }));
    try {
      await db("sales_log", {
        method: "POST",
        body: {
          shop_id: shop.id,
          doc_number: genDocNumber("S"),
          type,
          date: new Date().toISOString().slice(0, 10),
          counterparty_id: counterparty ? counterparty.id : null,
          counterparty_name: counterparty ? counterparty.name : "—",
          counterparty_kind: counterparty ? counterparty.kind : null,
          payment_method: paymentMethod,
          qty,
          sum,
          comment,
          items,
        },
        session,
        prefer: "return=minimal",
      });
      // Adjust stock: sales/write-offs reduce qty, returns add it back.
      const sign = type === "Возврат от покупателя" ? 1 : -1;
      for (const row of cart) {
        const current = stockItems.find((s) => s.id === row.stock_id);
        const newQty = Math.max(0, (current ? current.qty : 0) + sign * row.qty);
        await db("stock", { method: "PATCH", query: `?id=eq.${row.stock_id}`, body: { qty: newQty }, session, prefer: "return=minimal" });
      }
      setNotice(`«${type}» проведена: ${qty} шт на ${sum.toLocaleString("ru-RU")} ₸`);
      setCart([]);
      setComment("");
      setPostFlow(null);
      setFlowCounterparty(null);
      loadStock();
      loadLog();
    } catch (e) {
      setError(e.message);
    }
  }

  const filteredStock = (stockItems || []).filter(
    (s) => !query.trim() || s.sku.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase())
  );
  const cartSum = cart.reduce((s, r) => s + r.qty * r.price, 0);

  return (
    <div>
      <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink, marginBottom: 14 }}>Продажи</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { key: "new", label: "Новая операция" },
          { key: "log", label: "Журнал продаж" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${tab === t.key ? c.amberDark : c.border}`,
              background: tab === t.key ? "#FDF3E2" : "#fff",
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer",
              color: c.ink,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ display: "flex", gap: 8, background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
          <Icon size={15}>⚠</Icon> {error}
        </div>
      )}

      {tab === "log" ? (
        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.ink, color: "#B8C0CC", fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 90 }}>Дата</span>
            <span style={{ width: 140 }}>Тип</span>
            <span style={{ flex: 1 }}>Контрагент</span>
            <span style={{ width: 50, textAlign: "right" }}>Кол.</span>
            <span style={{ width: 100, textAlign: "right" }}>Сумма</span>
          </div>
          {salesLog === null && (
            <div style={{ display: "flex", gap: 8, padding: 20, color: c.steel, fontSize: 13 }}>
              <Spinner /> Загружаю журнал…
            </div>
          )}
          {salesLog && salesLog.length === 0 && <div style={{ padding: 24, textAlign: "center", color: c.steel, fontSize: 13.5 }}>Записей пока нет.</div>}
          {salesLog &&
            salesLog.map((d, i) => (
              <div key={d.id} style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 13 }}>
                <span style={{ width: 90, fontFamily: monoFont, color: c.steel }}>{d.date}</span>
                <span style={{ width: 140 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 4,
                      color: d.type === "Продажа" ? c.green : d.type === "Возврат от покупателя" ? c.amberDark : c.red,
                      background: d.type === "Продажа" ? c.greenBg : d.type === "Возврат от покупателя" ? "#FDF3E2" : c.redBg,
                    }}
                  >
                    {d.type}
                  </span>
                </span>
                <span style={{ flex: 1, color: c.ink }}>
                  {d.counterparty_name}
                  {d.payment_method ? ` · ${d.payment_method}` : ""}
                </span>
                <span style={{ width: 50, textAlign: "right", fontFamily: monoFont }}>{d.qty}</span>
                <span style={{ width: 100, textAlign: "right", fontFamily: monoFont, fontWeight: 700, color: c.ink }}>{d.sum.toLocaleString("ru-RU")}</span>
              </div>
            ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 55%", minWidth: 0 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по артикулу или названию…"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", maxHeight: 420, overflowY: "auto" }}>
              {stockItems === null && (
                <div style={{ display: "flex", gap: 8, padding: 18, color: c.steel, fontSize: 13 }}>
                  <Spinner /> Загружаю склад…
                </div>
              )}
              {filteredStock.map((s, i) => (
                <div
                  key={s.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5 }}
                >
                  <span style={{ width: 110, fontFamily: monoFont, fontWeight: 600, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sku}</span>
                  <span style={{ flex: 1, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <span style={{ width: 40, textAlign: "right", fontFamily: monoFont, color: c.steel }}>{s.qty}</span>
                  <span style={{ width: 80, textAlign: "right", fontFamily: monoFont, fontWeight: 700, color: c.amberDark }}>{s.price.toLocaleString("ru-RU")}</span>
                  <button
                    onClick={() => addToCart(s)}
                    style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: c.amber, color: c.ink, cursor: "pointer", flexShrink: 0 }}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: "1 1 45%", minWidth: 0, background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontFamily: displayFont, fontSize: 14.5, fontWeight: 600, color: c.ink, marginBottom: 10 }}>Операция</div>

            {notice && <div style={{ background: c.greenBg, color: c.green, borderRadius: 8, padding: "8px 10px", fontSize: 12, marginBottom: 10 }}>{notice}</div>}

            {cart.length === 0 && <div style={{ color: c.steel, fontSize: 12.5, marginBottom: 14 }}>Добавьте товары слева, кнопкой «+».</div>}
            {cart.map((r) => (
              <div key={r.stock_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${c.border}`, fontSize: 12.5 }}>
                <span style={{ flex: 1, color: c.ink }}>{r.name}</span>
                <input
                  type="number"
                  value={r.qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => updateQty(r.stock_id, Number(e.target.value) || 1)}
                  style={{ width: 44, textAlign: "right", padding: "3px 6px", borderRadius: 5, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }}
                />
                <span style={{ width: 70, textAlign: "right", fontFamily: monoFont }}>{(r.qty * r.price).toLocaleString("ru-RU")}</span>
                <button onClick={() => removeFromCart(r.stock_id)} style={{ background: "none", border: "none", color: c.steelLight, cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            ))}
            {cart.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 13 }}>
                  <span>Итого</span>
                  <span style={{ fontFamily: monoFont }}>{cartSum.toLocaleString("ru-RU")} ₸</span>
                </div>
                <input placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => startPost("Продажа")} style={primaryBtn}>
                    Провести продажу
                  </button>
                  <button
                    onClick={() => startPost("Возврат от покупателя")}
                    style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 16px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: c.ink }}
                  >
                    Возврат от покупателя
                  </button>
                  <button
                    onClick={() => startPost("Списание")}
                    style={{ background: "transparent", border: `1px solid ${c.redBg}`, borderRadius: 8, padding: "10px 16px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: c.red }}
                  >
                    Списание
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {postFlow?.step === "counterparty" && <CounterpartyModal session={session} shop={shop} onSelect={handleCounterpartySelected} onClose={() => setPostFlow(null)} />}
      {postFlow?.step === "payment" && (
        <PaymentMethodModal onSelect={handlePaymentSelected} onClose={() => setPostFlow(null)} counterpartyKind={flowCounterparty?.kind} />
      )}
    </div>
  );
}

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
  const [tab, setTab] = useState("stock"); // "stock" | "sales"

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
        <div
          onClick={() => setTab("stock")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "stock" ? c.amber : "transparent", color: tab === "stock" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>📦</Icon> Склад
        </div>
        <div
          onClick={() => setTab("sales")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "sales" ? c.amber : "transparent", color: tab === "sales" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>🧾</Icon> Продажи
        </div>
        <div style={{ marginTop: "auto", padding: "10px 14px", fontSize: 11, color: c.steelLight, fontFamily: bodyFont }}>
          Остальные разделы (заказы, контрагенты, документы, отчёты) подключим следующими.
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
        {tab === "stock" ? <StockScreen session={session} shop={shop} /> : <SalesScreen session={session} shop={shop} />}
      </main>
    </div>
  );
}
