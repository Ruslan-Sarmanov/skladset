import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";

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

function StatCard({ label, value, tone }) {
  return (
    <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: "18px 20px", flex: 1, minWidth: 160, minHeight: 96, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel, lineHeight: 1.35, minHeight: 32 }}>{label}</div>
      <div style={{ fontFamily: displayFont, fontSize: 30, fontWeight: 600, color: tone || c.ink, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function downloadPriceList(stock) {
  const header = "Артикул;Субс/аналог;Наименование;Модель;Кол-во;Цена, ₸";
  const rows = stock.map((p) => [p.sku, p.alt_sku, p.name, p.model, p.qty, p.price].join(";"));
  const csv = "\uFEFF" + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "прайс-лист.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Dashboard: overview stats + low-stock attention list, real stock data ----
function DashboardScreen({ session, shop }) {
  const [stock, setStock] = useState(null);
  const [error, setError] = useState("");
  const [shopCount, setShopCount] = useState(null);

  async function load() {
    setError("");
    try {
      const rows = await db("stock", { query: `?shop_id=eq.${shop.id}&order=name.asc`, session });
      setStock(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  async function loadShopCount() {
    try {
      // RLS only exposes shops that are network-visible plus your own —
      // this counts how many shops are currently reachable in the network.
      const rows = await db("shops", { query: `?select=id`, session });
      setShopCount(rows.length);
    } catch (e) {
      // non-critical, ignore silently
    }
  }
  useEffect(() => {
    load();
    loadShopCount();
    // eslint-disable-next-line
  }, [shop.id]);

  if (stock === null) {
    return (
      <div style={{ display: "flex", gap: 8, color: c.steel, fontSize: 13, padding: 12 }}>
        <Spinner /> Загружаю дашборд…
      </div>
    );
  }

  const low = stock.filter((i) => i.qty <= i.min_qty);

  return (
    <div>
      {error && (
        <div style={{ display: "flex", gap: 8, background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
          <Icon size={15}>⚠</Icon> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch", marginBottom: 18 }}>
        <StatCard label="Позиций на складе" value={stock.length} />
        <StatCard label="Ниже минимального остатка" value={low.length} tone={low.length ? c.red : c.ink} />
        <StatCard
          label="Видимость сети"
          value={shop.network_visible ? "Открыт" : "Закрыт"}
          tone={shop.network_visible ? c.green : c.steel}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel }}>
          Зарегистрировано магазинов в сети: <strong style={{ color: c.ink }}>{shopCount === null ? "…" : shopCount}</strong>
        </div>
        <button
          onClick={() => downloadPriceList(stock)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            background: "transparent",
            color: c.ink,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          <Icon size={14}>⬇</Icon> Скачать прайс-лист
        </button>
      </div>

      <div style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 600, color: c.ink, marginBottom: 10 }}>Требует внимания</div>
      <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
        {low.length === 0 && (
          <div style={{ padding: 18, fontFamily: bodyFont, fontSize: 13.5, color: c.steel }}>Все остатки выше минимального уровня.</div>
        )}
        {low.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: i === 0 ? "none" : `1px solid ${c.border}` }}>
            <span title={`Остаток ${item.qty} шт ниже минимального порога (${item.min_qty} шт). Пора заказать ещё.`} style={{ cursor: "help", display: "inline-flex" }}>
              <Icon size={16}>⚠</Icon>
            </span>
            <div style={{ fontFamily: monoFont, fontSize: 12.5, color: c.steel, width: 130 }}>{item.sku}</div>
            <div style={{ fontFamily: bodyFont, fontSize: 13.5, color: c.ink, flex: 1 }}>{item.name}</div>
            <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel }}>{item.model}</div>
            <div style={{ fontFamily: monoFont, fontSize: 13, color: c.red, fontWeight: 600, width: 60, textAlign: "right" }}>{item.qty} шт</div>
          </div>
        ))}
      </div>
    </div>
  );
}


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
        <Field label="Субс / аналог">
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
// ---- Network search: real cross-shop stock via the `network_stock` view ----
// ---- Shop profile: name, phone, address (shown to network when contacted) ----
// ---- Contacts: list + create/edit against real `counterparties` table ----
// ---- Orders: queue of pending purchases, real `orders` table ----
function OrdersScreen({ session, shop }) {
  const [view, setView] = useState("list"); // "list" | "new" | order id
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  // ---- new order builder ----
  const [stockItems, setStockItems] = useState(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [comment, setComment] = useState("");
  const [counterpartyModalOpen, setCounterpartyModalOpen] = useState(false);

  // ---- existing order detail ----
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editComment, setEditComment] = useState("");
  const [addItemQuery, setAddItemQuery] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function loadList() {
    setError("");
    try {
      const rows = await db("orders", { query: `?shop_id=eq.${shop.id}&order=date.desc,created_at.desc`, session });
      setList(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  async function loadStock() {
    try {
      const rows = await db("stock", { query: `?shop_id=eq.${shop.id}&order=name.asc`, session });
      setStockItems(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    loadList();
    // eslint-disable-next-line
  }, [shop.id]);

  function startNew() {
    setCart([]);
    setComment("");
    setQuery("");
    if (!stockItems) loadStock();
    setView("new");
  }
  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((r) => r.stock_id === item.id);
      if (existing) return prev.map((r) => (r.stock_id === item.id ? { ...r, qty: r.qty + 1 } : r));
      return [...prev, { stock_id: item.id, sku: item.sku, name: item.name, qty: 1, price: item.price }];
    });
  }
  function removeFromCart(stock_id) {
    setCart((prev) => prev.filter((r) => r.stock_id !== stock_id));
  }
  async function createOrder(counterparty) {
    const qty = cart.reduce((s, r) => s + r.qty, 0);
    const sum = cart.reduce((s, r) => s + r.qty * r.price, 0);
    try {
      await db("orders", {
        method: "POST",
        body: {
          shop_id: shop.id,
          doc_number: genDocNumber("O"),
          date: new Date().toISOString().slice(0, 10),
          counterparty_id: counterparty.id,
          counterparty_name: counterparty.name,
          counterparty_kind: counterparty.kind,
          status: "Открыт",
          qty,
          sum,
          comment,
          items: cart.map((r) => ({ sku: r.sku, name: r.name, qty: r.qty, price: r.price })),
        },
        session,
        prefer: "return=minimal",
      });
      setCounterpartyModalOpen(false);
      setView("list");
      loadList();
    } catch (e) {
      setError(e.message);
    }
  }

  const order = typeof view === "string" && view !== "list" && view !== "new" ? (list || []).find((o) => o.id === view) : null;

  function openOrder(o) {
    setEditing(false);
    setView(o.id);
  }
  function startEdit() {
    setEditItems(order.items.map((it) => ({ ...it })));
    setEditComment(order.comment || "");
    setAddItemQuery("");
    if (!stockItems) loadStock();
    setEditing(true);
  }
  async function saveEdit() {
    const qty = editItems.reduce((s, it) => s + it.qty, 0);
    const sum = editItems.reduce((s, it) => s + it.qty * it.price, 0);
    try {
      await db("orders", { method: "PATCH", query: `?id=eq.${order.id}`, body: { items: editItems, qty, sum, comment: editComment }, session, prefer: "return=minimal" });
      setEditing(false);
      loadList();
    } catch (e) {
      setError(e.message);
    }
  }
  async function finalizeSale(method) {
    try {
      await db("sales_log", {
        method: "POST",
        body: {
          shop_id: shop.id,
          doc_number: genDocNumber("S"),
          type: "Продажа",
          date: new Date().toISOString().slice(0, 10),
          counterparty_id: order.counterparty_id,
          counterparty_name: order.counterparty_name,
          counterparty_kind: order.counterparty_kind,
          payment_method: method,
          qty: order.qty,
          sum: order.sum,
          comment: order.comment,
          items: order.items,
        },
        session,
        prefer: "return=minimal",
      });
      for (const it of order.items) {
        const stockRow = (stockItems || []).find((s) => s.sku === it.sku);
        if (stockRow) {
          const newQty = Math.max(0, stockRow.qty - it.qty);
          await db("stock", { method: "PATCH", query: `?id=eq.${stockRow.id}`, body: { qty: newQty }, session, prefer: "return=minimal" });
        }
      }
      await db("orders", { method: "DELETE", query: `?id=eq.${order.id}`, session, prefer: "return=minimal" });
      setPaymentOpen(false);
      setView("list");
      loadList();
    } catch (e) {
      setError(e.message);
    }
  }
  async function deleteOrder() {
    try {
      await db("orders", { method: "DELETE", query: `?id=eq.${order.id}`, session, prefer: "return=minimal" });
      setConfirmDelete(false);
      setView("list");
      loadList();
    } catch (e) {
      setError(e.message);
    }
  }

  const filteredStock = (stockItems || []).filter((s) => !query.trim() || s.sku.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase()));
  const cartSum = cart.reduce((s, r) => s + r.qty * r.price, 0);
  const filteredAddStock = (stockItems || []).filter((s) => addItemQuery.trim() && (s.sku.toLowerCase().includes(addItemQuery.toLowerCase()) || s.name.toLowerCase().includes(addItemQuery.toLowerCase())));

  // ---- Order detail view ----
  if (order) {
    return (
      <div>
        <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: c.steel, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>
          ← К списку заказов
        </button>

        {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 600, color: c.ink }}>{order.doc_number} · {order.counterparty_name}</div>
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel, marginTop: 2 }}>
                от {order.date} · статус: <span style={{ fontWeight: 700, color: c.amberDark }}>{order.status}</span>
              </div>
            </div>
            {!editing && (
              <button onClick={startEdit} style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "7px 12px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12, cursor: "pointer", color: c.ink }}>
                ✎ Редактировать
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.cloud, color: c.steel, fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 130 }}>Артикул</span>
            <span style={{ flex: 1 }}>Наименование</span>
            <span style={{ width: 60, textAlign: "right" }}>Кол.</span>
            <span style={{ width: 90, textAlign: "right" }}>Цена</span>
            <span style={{ width: 100, textAlign: "right" }}>Сумма</span>
            {editing && <span style={{ width: 20 }} />}
          </div>
          {(editing ? editItems : order.items).map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5 }}>
              <span style={{ width: 130, fontFamily: monoFont, color: c.steel }}>{it.sku}</span>
              <span style={{ flex: 1, color: c.ink }}>{it.name}</span>
              {editing ? (
                <input
                  type="number"
                  value={it.qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEditItems((prev) => prev.map((p, pi) => (pi === i ? { ...p, qty: Math.max(1, Number(e.target.value) || 1) } : p)))}
                  style={{ width: 50, textAlign: "right", padding: "3px 6px", borderRadius: 5, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }}
                />
              ) : (
                <span style={{ width: 60, textAlign: "right", fontFamily: monoFont }}>{it.qty}</span>
              )}
              {editing ? (
                <input
                  type="number"
                  value={it.price}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEditItems((prev) => prev.map((p, pi) => (pi === i ? { ...p, price: Math.max(0, Number(e.target.value) || 0) } : p)))}
                  style={{ width: 80, textAlign: "right", padding: "3px 6px", borderRadius: 5, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }}
                />
              ) : (
                <span style={{ width: 90, textAlign: "right", fontFamily: monoFont }}>{it.price.toLocaleString("ru-RU")}</span>
              )}
              <span style={{ width: 100, textAlign: "right", fontFamily: monoFont, fontWeight: 600 }}>{(it.qty * it.price).toLocaleString("ru-RU")}</span>
              {editing && (
                <button onClick={() => setEditItems((prev) => prev.filter((_, pi) => pi !== i))} style={{ width: 20, background: "none", border: "none", color: c.steelLight, cursor: "pointer" }}>
                  ✕
                </button>
              )}
            </div>
          ))}

          {editing && (
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${c.border}`, background: c.cloud }}>
              <input value={addItemQuery} onChange={(e) => setAddItemQuery(e.target.value)} placeholder="Добавить позицию — артикул или название" style={{ ...inputStyle, marginBottom: addItemQuery.trim() ? 6 : 0 }} />
              {addItemQuery.trim() && (
                <div style={{ background: "#fff", border: `1px solid ${c.border}`, borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
                  {filteredAddStock.map((s, i) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setEditItems((prev) => {
                          const existing = prev.find((p) => p.sku === s.sku);
                          if (existing) return prev.map((p) => (p.sku === s.sku ? { ...p, qty: p.qty + 1 } : p));
                          return [...prev, { sku: s.sku, name: s.name, qty: 1, price: s.price }];
                        });
                        setAddItemQuery("");
                      }}
                      style={{ display: "flex", gap: 8, padding: "7px 10px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, cursor: "pointer", fontFamily: bodyFont, fontSize: 12.5 }}
                    >
                      <span style={{ fontFamily: monoFont, color: c.steel, width: 110 }}>{s.sku}</span>
                      <span style={{ flex: 1 }}>{s.name}</span>
                    </div>
                  ))}
                  {filteredAddStock.length === 0 && <div style={{ padding: 10, color: c.steel, fontSize: 12 }}>Ничего не найдено.</div>}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", padding: "8px 14px", borderTop: `1px solid ${c.border}`, background: c.cloud }}>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 12.5 }}>Итого</span>
            <span style={{ fontFamily: monoFont, fontWeight: 700 }}>
              {(editing ? editItems.reduce((s, it) => s + it.qty * it.price, 0) : order.sum).toLocaleString("ru-RU")}
            </span>
          </div>

          {editing ? (
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${c.border}` }}>
              <label style={fieldLabel}>Комментарий</label>
              <input value={editComment} onChange={(e) => setEditComment(e.target.value)} style={inputStyle} />
            </div>
          ) : (
            order.comment && <div style={{ padding: "10px 14px", borderTop: `1px solid ${c.border}`, color: c.steel, fontSize: 12.5 }}>Комментарий: {order.comment}</div>
          )}

          {editing ? (
            <div style={{ display: "flex", gap: 8, padding: 14, borderTop: `1px solid ${c.border}` }}>
              <button onClick={saveEdit} style={primaryBtn}>Сохранить изменения</button>
              <button onClick={() => setEditing(false)} style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 16px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: c.ink }}>
                Отмена
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 14, borderTop: `1px solid ${c.border}`, flexWrap: "wrap" }}>
              <button onClick={() => setPaymentOpen(true)} style={primaryBtn}>Провести продажу</button>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {confirmDelete ? (
                  <>
                    <span style={{ color: c.red, fontSize: 12.5, alignSelf: "center" }}>Удалить безвозвратно?</span>
                    <button onClick={deleteOrder} style={{ background: c.red, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontFamily: bodyFont, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Да, удалить</button>
                    <button onClick={() => setConfirmDelete(false)} style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "9px 14px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: c.ink }}>Отмена</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} style={{ background: "transparent", color: c.red, border: `1px solid ${c.redBg}`, borderRadius: 8, padding: "9px 16px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
                    Удалить заказ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {paymentOpen && <PaymentMethodModal onSelect={finalizeSale} onClose={() => setPaymentOpen(false)} counterpartyKind={order.counterparty_kind} />}
      </div>
    );
  }

  // ---- New order builder ----
  if (view === "new") {
    return (
      <div>
        <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: c.steel, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>
          ← К списку заказов
        </button>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink, marginBottom: 14 }}>Новый заказ</div>

        {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 55%", minWidth: 0 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по артикулу или названию…" style={{ ...inputStyle, marginBottom: 10 }} />
            <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", maxHeight: 420, overflowY: "auto" }}>
              {stockItems === null && (
                <div style={{ display: "flex", gap: 8, padding: 18, color: c.steel, fontSize: 13 }}>
                  <Spinner /> Загружаю склад…
                </div>
              )}
              {filteredStock.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5 }}>
                  <span style={{ width: 110, fontFamily: monoFont, fontWeight: 600, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sku}</span>
                  <span style={{ flex: 1, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <span style={{ width: 80, textAlign: "right", fontFamily: monoFont, fontWeight: 700, color: c.amberDark }}>{s.price.toLocaleString("ru-RU")}</span>
                  <button onClick={() => addToCart(s)} style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: c.amber, color: c.ink, cursor: "pointer", flexShrink: 0 }}>+</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: "1 1 45%", minWidth: 0, background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontFamily: displayFont, fontSize: 14.5, fontWeight: 600, color: c.ink, marginBottom: 10 }}>Состав заказа</div>
            {cart.length === 0 && <div style={{ color: c.steel, fontSize: 12.5, marginBottom: 14 }}>Добавьте товары слева, кнопкой «+».</div>}
            {cart.map((r) => (
              <div key={r.stock_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${c.border}`, fontSize: 12.5 }}>
                <span style={{ flex: 1, color: c.ink }}>{r.name}</span>
                <input
                  type="number"
                  value={r.qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCart((prev) => prev.map((p) => (p.stock_id === r.stock_id ? { ...p, qty: Math.max(1, Number(e.target.value) || 1) } : p)))}
                  style={{ width: 44, textAlign: "right", padding: "3px 6px", borderRadius: 5, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }}
                />
                <span style={{ width: 70, textAlign: "right", fontFamily: monoFont }}>{(r.qty * r.price).toLocaleString("ru-RU")}</span>
                <button onClick={() => removeFromCart(r.stock_id)} style={{ background: "none", border: "none", color: c.steelLight, cursor: "pointer" }}>✕</button>
              </div>
            ))}
            {cart.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 13 }}>
                  <span>Итого</span>
                  <span style={{ fontFamily: monoFont }}>{cartSum.toLocaleString("ru-RU")} ₸</span>
                </div>
                <input placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                <button onClick={() => setCounterpartyModalOpen(true)} style={{ ...primaryBtn, width: "100%" }}>Оформить заказ</button>
              </>
            )}
          </div>
        </div>

        {counterpartyModalOpen && <CounterpartyModal session={session} shop={shop} onSelect={createOrder} onClose={() => setCounterpartyModalOpen(false)} />}
      </div>
    );
  }

  // ---- List view ----
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink }}>Заказы</div>
        <button onClick={startNew} style={primaryBtn}>
          <Icon size={15}>+</Icon> Новый заказ
        </button>
      </div>

      {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

      {list === null && (
        <div style={{ display: "flex", gap: 8, color: c.steel, fontSize: 13, padding: 12 }}>
          <Spinner /> Загружаю…
        </div>
      )}
      {list && list.length === 0 && (
        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 24, textAlign: "center", color: c.steel, fontSize: 13.5 }}>
          Заказов пока нет — нажмите «Новый заказ».
        </div>
      )}
      {list && list.length > 0 && (
        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.ink, color: "#B8C0CC", fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 100 }}>№</span>
            <span style={{ width: 90 }}>Дата</span>
            <span style={{ flex: 1 }}>Контрагент</span>
            <span style={{ width: 50, textAlign: "right" }}>Кол.</span>
            <span style={{ width: 100, textAlign: "right" }}>Сумма</span>
            <span style={{ width: 90 }}>Статус</span>
          </div>
          {list.map((o, i) => (
            <div key={o.id} onClick={() => openOrder(o)} style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 13, cursor: "pointer" }}>
              <span style={{ width: 100, fontFamily: monoFont, fontWeight: 600 }}>{o.doc_number}</span>
              <span style={{ width: 90, fontFamily: monoFont, color: c.steel }}>{o.date}</span>
              <span style={{ flex: 1, color: c.ink }}>{o.counterparty_name}</span>
              <span style={{ width: 50, textAlign: "right", fontFamily: monoFont }}>{o.qty}</span>
              <span style={{ width: 100, textAlign: "right", fontFamily: monoFont, fontWeight: 700 }}>{o.sum.toLocaleString("ru-RU")}</span>
              <span style={{ width: 90 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: c.amberDark, background: "#FDF3E2", padding: "2px 8px", borderRadius: 4 }}>{o.status}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactsScreen({ session, shop }) {
  const emptyForm = { kind: "Физлицо", category: "", name: "", full_name: "", phone1: "", phone2: "", phone3: "", email: "", bin: "", address: "", legal_address: "", actual_address: "", comment: "" };
  const [list, setList] = useState(null);
  const [openId, setOpenId] = useState(null); // null | "new" | id
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("name"); // "name" | "kind"
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"
  const [kindFilter, setKindFilter] = useState("all"); // "all" | "Физлицо" | "Юрлицо"

  async function load() {
    setError("");
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
  }, [shop.id]);

  function openNew() {
    setForm(emptyForm);
    setOpenId("new");
  }
  function openDetail(cp) {
    setForm({
      kind: cp.kind || "Физлицо",
      category: cp.category || "",
      name: cp.name || "",
      full_name: cp.full_name || "",
      phone1: (cp.phones && cp.phones[0]) || "",
      phone2: (cp.phones && cp.phones[1]) || "",
      phone3: (cp.phones && cp.phones[2]) || "",
      email: cp.email || "",
      bin: cp.bin || "",
      address: cp.address || "",
      legal_address: cp.legal_address || "",
      actual_address: cp.actual_address || "",
      comment: cp.comment || "",
    });
    setOpenId(cp.id);
  }

  function bodyFromForm() {
    return {
      shop_id: shop.id,
      kind: form.kind,
      category: form.kind === "Юрлицо" ? form.category : "",
      name: form.name,
      full_name: form.kind === "Юрлицо" ? form.full_name : "",
      phones: [form.phone1, form.phone2, form.phone3],
      email: form.email,
      bin: form.bin,
      address: form.kind === "Физлицо" ? form.address : "",
      legal_address: form.kind === "Юрлицо" ? form.legal_address : "",
      actual_address: form.kind === "Юрлицо" ? form.actual_address : "",
      comment: form.comment,
    };
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (openId === "new") {
        await db("counterparties", { method: "POST", body: bodyFromForm(), session, prefer: "return=minimal" });
      } else {
        await db("counterparties", { method: "PATCH", query: `?id=eq.${openId}`, body: bodyFromForm(), session, prefer: "return=minimal" });
      }
      setOpenId(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setSaving(true);
    try {
      await db("counterparties", { method: "DELETE", query: `?id=eq.${openId}`, session, prefer: "return=minimal" });
      setOpenId(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const pill = (active) => ({
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${active ? c.amberDark : c.border}`,
    background: active ? "#FDF3E2" : "#fff",
    fontFamily: bodyFont,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    color: c.ink,
  });

  if (openId) {
    return (
      <div style={{ maxWidth: 560 }}>
        <button onClick={() => setOpenId(null)} style={{ background: "none", border: "none", color: c.steel, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>
          ← К списку контрагентов
        </button>

        {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {["Физлицо", "Юрлицо"].map((k) => (
              <button key={k} onClick={() => setForm({ ...form, kind: k })} style={pill(form.kind === k)}>
                {k}
              </button>
            ))}
          </div>

          {form.kind === "Юрлицо" && (
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLabel}>Категория</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["ТОО", "АО", "ИП"].map((cat) => (
                  <button key={cat} onClick={() => setForm({ ...form, category: cat })} style={{ ...pill(form.category === cat), flex: "0 0 70px" }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>{form.kind === "Юрлицо" ? "Организация (короткое наименование)" : "ФИО"}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </div>

          {form.kind === "Юрлицо" && (
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLabel}>Полное наименование организации</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={inputStyle} />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={fieldLabel}>Телефон 1</label>
              <input value={form.phone1} onChange={(e) => setForm({ ...form, phone1: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Телефон 2</label>
              <input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Телефон 3</label>
              <input value={form.phone3} onChange={(e) => setForm({ ...form, phone3: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>{form.kind === "Юрлицо" ? "БИН" : "ИИН"}</label>
            <input value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} style={inputStyle} />
          </div>

          {form.kind === "Физлицо" ? (
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLabel}>Адрес</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={fieldLabel}>Юридический адрес</label>
                <input value={form.legal_address} onChange={(e) => setForm({ ...form, legal_address: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={fieldLabel}>Фактический адрес</label>
                <input value={form.actual_address} onChange={(e) => setForm({ ...form, actual_address: e.target.value })} style={inputStyle} />
              </div>
            </>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={fieldLabel}>Комментарий</label>
            <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              {openId !== "new" && (
                <button
                  onClick={remove}
                  disabled={saving}
                  style={{ background: c.redBg, color: c.red, border: "none", borderRadius: 8, padding: "9px 14px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
                >
                  Удалить
                </button>
              )}
            </div>
            <button onClick={save} disabled={saving || !form.name.trim()} style={{ ...primaryBtn, opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
              {saving ? <Spinner /> : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredSorted = (list || [])
    .filter((cp) => kindFilter === "all" || cp.kind === kindFilter)
    .filter((cp) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const phones = (cp.phones || []).join(" ").toLowerCase();
      return cp.name.toLowerCase().includes(q) || phones.includes(q) || (cp.email || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "kind") return (a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)) * mult;
      return a.name.localeCompare(b.name) * mult;
    });

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function sortArrow(key) {
    if (sortKey !== key) return <span style={{ opacity: 0.3, marginLeft: 4 }}>▲</span>;
    return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink }}>Контрагенты</div>
        <button onClick={openNew} style={primaryBtn}>
          <Icon size={15}>+</Icon> Добавить контрагента
        </button>
      </div>

      {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени, телефону или email…"
          style={{ ...inputStyle, flex: "1 1 260px" }}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={{ ...inputStyle, width: 150 }}>
          <option value="all">Все типы</option>
          <option value="Физлицо">Физлицо</option>
          <option value="Юрлицо">Юрлицо</option>
        </select>
      </div>

      <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.ink, color: "#B8C0CC", fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
          <span onClick={() => toggleSort("name")} style={{ flex: 1, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center" }}>
            Наименование {sortArrow("name")}
          </span>
          <span onClick={() => toggleSort("kind")} style={{ width: 100, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center" }}>
            Тип {sortArrow("kind")}
          </span>
          <span style={{ width: 150 }}>Телефон</span>
          <span style={{ width: 170 }}>Email</span>
        </div>
        {list === null && (
          <div style={{ display: "flex", gap: 8, padding: 18, color: c.steel, fontSize: 13 }}>
            <Spinner /> Загружаю…
          </div>
        )}
        {list && list.length === 0 && <div style={{ padding: 24, textAlign: "center", color: c.steel, fontSize: 13.5 }}>Контрагентов пока нет.</div>}
        {list && list.length > 0 && filteredSorted.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: c.steel, fontSize: 13.5 }}>Ничего не найдено по этому запросу.</div>
        )}
        {filteredSorted.map((cp, i) => (
            <div
              key={cp.id}
              onClick={() => openDetail(cp)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 13, cursor: "pointer" }}
            >
              <span style={{ flex: 1, color: c.ink }}>
                {cp.name}
                {cp.kind === "Юрлицо" && cp.category ? ` (${cp.category})` : ""}
              </span>
              <span style={{ width: 100, color: c.steel, fontSize: 12 }}>{cp.kind}</span>
              <span style={{ width: 150, fontFamily: monoFont, fontSize: 12, color: c.steel }}>{(cp.phones && cp.phones[0]) || "—"}</span>
              <span style={{ width: 170, fontSize: 12, color: c.steel }}>{cp.email || "—"}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function SettingsScreen({ session, shop, onShopUpdate }) {
  const existingPhones = shop.phones || ["", "", ""];
  const [form, setForm] = useState({
    name: shop.name || "",
    phone1: existingPhones[0] || "",
    phone2: existingPhones[1] || "",
    phone3: existingPhones[2] || "",
    store_address: shop.store_address || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await db("shops", {
        method: "PATCH",
        query: `?id=eq.${shop.id}`,
        body: { name: form.name, phones: [form.phone1, form.phone2, form.phone3], store_address: form.store_address },
        session,
        prefer: "return=representation",
      });
      onShopUpdate(updated[0]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink, marginBottom: 4 }}>Настройки</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel, marginBottom: 18 }}>
        Название и контакты видны другим магазинам, если они найдут ваш товар в поиске по сети.
      </div>

      {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

      <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Название магазина</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Телефон 1</label>
          <input value={form.phone1} onChange={(e) => setForm({ ...form, phone1: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Телефон 2 (необязательно)</label>
          <input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Телефон 3 (необязательно)</label>
          <input value={form.phone3} onChange={(e) => setForm({ ...form, phone3: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={fieldLabel}>Адрес</label>
          <input value={form.store_address} onChange={(e) => setForm({ ...form, store_address: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Spinner /> : "Сохранить"}
          </button>
          {saved && <span style={{ color: c.green, fontSize: 12.5, fontFamily: bodyFont }}>Сохранено</span>}
        </div>
      </div>
    </div>
  );
}

// ---- Small contact-info popover ----
function ContactModal({ shopName, phones, address, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,33,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: c.panel, borderRadius: 12, width: 340, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 600, color: c.ink }}>{shopName}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.steel }}>
            <Icon size={17}>✕</Icon>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: bodyFont, fontSize: 13.5, color: c.ink }}>
          {(phones || []).filter((p) => p && p.trim()).length === 0 ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>📞</span> Телефон не указан
            </div>
          ) : (
            (phones || [])
              .filter((p) => p && p.trim())
              .map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>📞</span> {p}
                </div>
              ))
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span>📍</span> {address || "Адрес не указан"}
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkSearchScreen({ session, shop, onShopUpdate }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);

  async function search() {
    setError("");
    setRows(null);
    try {
      const filter = query.trim()
        ? `&or=(sku.ilike.*${encodeURIComponent(query)}*,name.ilike.*${encodeURIComponent(query)}*)`
        : "";
      const data = await db("network_stock", { query: `?select=*${filter}&order=shop_name.asc&limit=200`, session });
      setRows(data);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    search();
    // eslint-disable-next-line
  }, []);

  async function toggleVisible() {
    setToggling(true);
    try {
      const updated = await db("shops", {
        method: "PATCH",
        query: `?id=eq.${shop.id}`,
        body: { network_visible: !shop.network_visible },
        session,
        prefer: "return=representation",
      });
      onShopUpdate(updated[0]);
    } catch (e) {
      setError(e.message);
    } finally {
      setToggling(false);
    }
  }

  const [contact, setContact] = useState(null);
  const own = (rows || []).filter((r) => r.shop_id === shop.id);
  const others = (rows || []).filter((r) => r.shop_id !== shop.id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink }}>Поиск по сети</div>
        <button
          onClick={toggleVisible}
          disabled={toggling}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: shop.network_visible ? c.greenBg : c.cloud,
            color: shop.network_visible ? c.green : c.steel,
            border: `1px solid ${shop.network_visible ? c.green : c.border}`,
            borderRadius: 8,
            padding: "8px 14px",
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          {shop.network_visible ? "✓ Ваш склад виден сети" : "Ваш склад скрыт от сети"}
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 8, background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
          <Icon size={15}>⚠</Icon> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Артикул или название детали…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={search} style={primaryBtn}>
          Найти
        </button>
      </div>

      {rows === null && (
        <div style={{ display: "flex", gap: 8, color: c.steel, fontSize: 13, padding: 12 }}>
          <Spinner /> Ищу по сети…
        </div>
      )}

      {rows && rows.length === 0 && (
        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: 24, textAlign: "center", color: c.steel, fontSize: 13.5 }}>
          Ничего не найдено — либо позиции нет, либо другие магазины ещё не открыли доступ к своему складу.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.ink, color: "#B8C0CC", fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 120 }}>Артикул</span>
            <span style={{ flex: 1 }}>Наименование</span>
            <span style={{ width: 180 }}>Склад / магазин</span>
            <span style={{ width: 60, textAlign: "right" }}>Кол.</span>
            <span style={{ width: 90, textAlign: "right" }}>Цена</span>
            <span style={{ width: 90 }} />
          </div>
          {[...own, ...others].map((r, i) => (
            <div
              key={r.stock_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
                fontFamily: bodyFont,
                fontSize: 12.5,
                background: r.shop_id === shop.id ? "#FDF6EA" : "#fff",
              }}
            >
              <span style={{ width: 120, fontFamily: monoFont, fontWeight: 700, color: c.ink }}>{r.sku}</span>
              <span style={{ flex: 1, color: c.ink }}>{r.name}</span>
              <span style={{ width: 180, color: r.shop_id === shop.id ? c.ink : c.steel, fontWeight: r.shop_id === shop.id ? 600 : 400 }}>
                {r.shop_id === shop.id ? `Ваш склад — ${r.shop_name}` : r.shop_name}
              </span>
              <span style={{ width: 60, textAlign: "right", fontFamily: monoFont }}>{r.qty}</span>
              <span style={{ width: 90, textAlign: "right", fontFamily: monoFont, fontWeight: 700, color: c.amberDark }}>{r.price.toLocaleString("ru-RU")}</span>
              <span style={{ width: 90, textAlign: "right" }}>
                {r.shop_id !== shop.id && (
                  <button
                    onClick={() => setContact({ shopName: r.shop_name, phones: r.shop_phones, address: r.shop_address })}
                    style={{ border: `1px solid ${c.border}`, background: "transparent", borderRadius: 6, padding: "4px 9px", fontFamily: bodyFont, fontSize: 11.5, fontWeight: 600, color: c.ink, cursor: "pointer" }}
                  >
                    Контакты
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {contact && <ContactModal shopName={contact.shopName} phones={contact.phones} address={contact.address} onClose={() => setContact(null)} />}
    </div>
  );
}

// ---- Excel import: real parsing (xlsx lib), flexible header matching, bulk insert ----
const EXCEL_HEADER_MAP = {
  sku: ["артикул", "sku", "код"],
  alt_sku: ["субс", "аналог", "артикул2", "артикул 2", "субс / аналог", "заменитель"],
  name: ["наименование", "название", "name"],
  model: ["модель", "model"],
  qty: ["кол-во", "количество", "кол.", "qty"],
  purchase_price: ["закуп", "закупочная", "закупочная цена", "цена закупа"],
  price: ["цена", "цена продажи", "розница", "розничная"],
};
function matchColumn(header) {
  const h = String(header || "").trim().toLowerCase();
  for (const key of Object.keys(EXCEL_HEADER_MAP)) {
    if (EXCEL_HEADER_MAP[key].some((alias) => h.includes(alias))) return key;
  }
  return null;
}

// ---- Excel import, embedded as a tab inside the Склад operation panel ----
// ---- Return flow: pick the original sale this return is based on ----
function ReturnSourceModal({ salesLog, cartSkus, onSelect, onClose }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const candidates = (salesLog || []).filter((d) => {
    if (d.type !== "Продажа") return false;
    if (dateFrom && d.date < dateFrom) return false;
    if (dateTo && d.date > dateTo) return false;
    return (d.items || []).some((it) => cartSkus.includes(it.sku));
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,33,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: c.panel, borderRadius: 12, width: 480, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 600, color: c.ink }}>Из какой продажи возврат?</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.steel }}>
            <Icon size={17}>✕</Icon>
          </button>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel, marginBottom: 10 }}>
            Показаны продажи, где встречается хотя бы одна из позиций текущей операции.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel }}>с</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }} />
            <span style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel }}>по</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }} />
          </div>

          <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
            {candidates.length === 0 && (
              <div style={{ padding: 16, fontFamily: bodyFont, fontSize: 12.5, color: c.steel }}>Продаж с этой позицией за выбранный период не найдено.</div>
            )}
            {candidates.map((d, i) => (
              <div
                key={d.id}
                onClick={() => onSelect(d)}
                style={{ padding: "10px 12px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 3 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: bodyFont, fontWeight: 600, fontSize: 13, color: c.ink }}>{d.counterparty_name}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 12, color: c.steel }}>{d.date}</span>
                </div>
                <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: c.steel }}>
                  {d.doc_number} · {d.qty} шт на {d.sum.toLocaleString("ru-RU")} ₸{d.payment_method ? ` · ${d.payment_method}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Журнал продаж: date range + sku search + totals + detail/print ----
function SalesLogPanel({ salesLog, shop }) {
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [skuQuery, setSkuQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  const list = salesLog || [];
  const filtered = list.filter((d) => {
    if (dateFrom && d.date < dateFrom) return false;
    if (dateTo && d.date > dateTo) return false;
    if (skuQuery.trim() && !(d.items || []).some((it) => it.sku.toLowerCase().includes(skuQuery.toLowerCase()))) return false;
    return true;
  });
  const opened = list.find((d) => d.id === openId);

  const totals = filtered.reduce(
    (acc, d) => {
      if (d.type === "Продажа") {
        acc.sales += d.sum;
        acc.salesQty += d.qty;
      } else if (d.type === "Возврат от покупателя") {
        acc.returns += d.sum;
      } else if (d.type === "Списание") {
        acc.writeoff += d.sum;
      }
      return acc;
    },
    { sales: 0, returns: 0, writeoff: 0, salesQty: 0 }
  );
  const netTotal = totals.sales - totals.returns - totals.writeoff;

  function typeColor(t) {
    if (t === "Продажа") return c.green;
    if (t === "Возврат от покупателя") return c.amberDark;
    return c.red;
  }
  function typeBg(t) {
    if (t === "Продажа") return c.greenBg;
    if (t === "Возврат от покупателя") return "#FDF3E2";
    return c.redBg;
  }

  if (opened) {
    return (
      <div style={{ padding: 14 }}>
        <button
          onClick={() => setOpenId(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: c.steel, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}
        >
          ← К журналу продаж
        </button>
        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 600, color: c.ink }}>{opened.doc_number}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: typeColor(opened.type), background: typeBg(opened.type), padding: "2px 8px", borderRadius: 4 }}>{opened.type}</span>
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel, marginTop: 4 }}>
                {opened.date} · {opened.counterparty_name}
                {opened.payment_method ? ` · ${opened.payment_method}` : ""}
              </div>
            </div>
            <button
              onClick={() => setPrintOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", color: c.ink, border: `1px solid ${c.border}`, borderRadius: 8, padding: "8px 14px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
            >
              🖨 Печать накладной
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.cloud, color: c.steel, fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 130 }}>Артикул</span>
            <span style={{ flex: 1 }}>Наименование</span>
            <span style={{ width: 50, textAlign: "right" }}>Кол.</span>
            <span style={{ width: 90, textAlign: "right" }}>Цена</span>
            <span style={{ width: 100, textAlign: "right" }}>Сумма</span>
          </div>
          {(opened.items || []).map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5 }}>
              <span style={{ width: 130, fontFamily: monoFont, color: c.steel }}>{it.sku}</span>
              <span style={{ flex: 1, color: c.ink }}>{it.name}</span>
              <span style={{ width: 50, textAlign: "right", fontFamily: monoFont }}>{it.qty}</span>
              <span style={{ width: 90, textAlign: "right", fontFamily: monoFont }}>{it.price.toLocaleString("ru-RU")}</span>
              <span style={{ width: 100, textAlign: "right", fontFamily: monoFont, fontWeight: 600 }}>{(it.qty * it.price).toLocaleString("ru-RU")}</span>
            </div>
          ))}
          <div style={{ display: "flex", padding: "8px 10px", borderTop: `1px solid ${c.border}`, background: c.cloud }}>
            <span style={{ flex: 1, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, color: c.ink }}>Итого</span>
            <span style={{ width: 100, textAlign: "right", fontFamily: monoFont, fontSize: 12.5, fontWeight: 700, color: c.ink }}>{opened.sum.toLocaleString("ru-RU")}</span>
          </div>
          {opened.comment && (
            <div style={{ padding: "10px 18px", borderTop: `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5, color: c.steel }}>Комментарий: {opened.comment}</div>
          )}
        </div>

        {printOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(28,33,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={() => setPrintOpen(false)}>
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #print-area-doc, #print-area-doc * { visibility: visible; }
                #print-area-doc { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 24px; box-shadow: none; border: none; }
                .no-print { display: none !important; }
              }
            `}</style>
            <div onClick={(e) => e.stopPropagation()} style={{ background: c.panel, borderRadius: 12, width: 520, maxHeight: "85vh", overflowY: "auto" }}>
              <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${c.border}` }}>
                <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 600, color: c.ink }}>Накладная</span>
                <button onClick={() => setPrintOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: c.steel }}>
                  <Icon size={17}>✕</Icon>
                </button>
              </div>

              <div id="print-area-doc" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, paddingBottom: 14, borderBottom: `2px solid ${c.ink}` }}>
                  <div>
                    <div style={{ fontFamily: displayFont, fontSize: 19, fontWeight: 700, color: c.ink }}>{shop.name || "Магазин"}</div>
                    {shop.store_address && <div style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, marginTop: 3 }}>{shop.store_address}</div>}
                    {shop.phones && shop.phones.filter((p) => p && p.trim()).length > 0 && (
                      <div style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, marginTop: 2 }}>{shop.phones.filter((p) => p && p.trim()).join(" · ")}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 700, color: c.ink }}>Накладная № {opened.doc_number}</div>
                    <div style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, marginTop: 3 }}>{opened.date}</div>
                    <div style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, marginTop: 2 }}>Получатель: {opened.counterparty_name}</div>
                  </div>
                </div>

                <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 8, padding: "8px 10px", background: c.cloud, color: c.steel, fontFamily: bodyFont, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ width: 100 }}>Артикул</span>
                    <span style={{ flex: 1 }}>Наименование</span>
                    <span style={{ width: 40, textAlign: "right" }}>Кол.</span>
                    <span style={{ width: 80, textAlign: "right" }}>Цена</span>
                    <span style={{ width: 90, textAlign: "right" }}>Сумма</span>
                  </div>
                  {(opened.items || []).map((it, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "8px 10px", borderTop: `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5 }}>
                      <span style={{ width: 100, fontFamily: monoFont, color: c.steel }}>{it.sku}</span>
                      <span style={{ flex: 1 }}>{it.name}</span>
                      <span style={{ width: 40, textAlign: "right", fontFamily: monoFont }}>{it.qty}</span>
                      <span style={{ width: 80, textAlign: "right", fontFamily: monoFont }}>{it.price.toLocaleString("ru-RU")}</span>
                      <span style={{ width: 90, textAlign: "right", fontFamily: monoFont, fontWeight: 700 }}>{(it.qty * it.price).toLocaleString("ru-RU")}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", padding: "10px 10px", borderTop: `1px solid ${c.border}`, background: c.cloud, fontWeight: 700, fontSize: 14 }}>
                    <span style={{ flex: 1 }}>Итого</span>
                    <span style={{ fontFamily: monoFont }}>{opened.sum.toLocaleString("ru-RU")} ₸</span>
                  </div>
                </div>

                <div className="no-print">
                  <button onClick={() => window.print()} style={{ ...primaryBtn, width: "100%" }}>
                    🖨 Печать
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel }}>с</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12.5 }} />
        <span style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel }}>по</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12.5 }} />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "5px 10px", fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: c.ink, cursor: "pointer" }}
          >
            Показать всё
          </button>
        )}
        <input
          value={skuQuery}
          onChange={(e) => setSkuQuery(e.target.value)}
          placeholder="Поиск по артикулу…"
          style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5, width: 160 }}
        />
        <span style={{ marginLeft: "auto", fontFamily: bodyFont, fontSize: 12, color: c.steel }}>{filtered.length} записей</span>
      </div>

      <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: c.cloud, color: c.steel, fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 80 }}>Дата</span>
          <span style={{ width: 150 }}>Тип</span>
          <span style={{ flex: 1 }}>Контрагент</span>
          <span style={{ width: 50, textAlign: "right" }}>Кол.</span>
          <span style={{ width: 90, textAlign: "right" }}>Сумма</span>
          <span style={{ width: 140 }}>Комментарий</span>
        </div>
        {salesLog === null && (
          <div style={{ display: "flex", gap: 8, padding: 20, color: c.steel, fontSize: 13 }}>
            <Spinner /> Загружаю журнал…
          </div>
        )}
        {salesLog && filtered.length === 0 && <div style={{ padding: 16, fontFamily: bodyFont, fontSize: 12.5, color: c.steel }}>Нет записей за выбранный период.</div>}
        {filtered.map((d, i) => (
          <div
            key={d.id}
            onClick={() => setOpenId(d.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5, cursor: "pointer" }}
          >
            <span style={{ width: 80, fontFamily: monoFont, color: c.steel }}>{d.date}</span>
            <span style={{ width: 150 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: typeColor(d.type), background: typeBg(d.type), padding: "2px 8px", borderRadius: 4 }}>{d.type}</span>
            </span>
            <span style={{ flex: 1, color: c.ink }}>
              {d.counterparty_name}
              {d.payment_method ? ` · ${d.payment_method}` : ""}
            </span>
            <span style={{ width: 50, textAlign: "right", fontFamily: monoFont, color: c.ink }}>{d.qty}</span>
            <span style={{ width: 90, textAlign: "right", fontFamily: monoFont, fontWeight: 600, color: c.ink }}>{d.sum.toLocaleString("ru-RU")}</span>
            <span style={{ width: 140, fontSize: 11.5, color: c.steel, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.comment || "—"}</span>
          </div>
        ))}
        {filtered.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderTop: `1px solid ${c.border}`, background: c.cloud }}>
            <span style={{ width: 80 }} />
            <span style={{ width: 150 }} />
            <span style={{ flex: 1, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 700, color: c.ink }}>Итого за период</span>
            <span style={{ width: 50, textAlign: "right", fontFamily: monoFont, fontWeight: 700, color: c.ink }}>{totals.salesQty}</span>
            <span style={{ width: 90, textAlign: "right", fontFamily: monoFont, fontWeight: 700, color: c.ink }}>{netTotal.toLocaleString("ru-RU")}</span>
            <span style={{ width: 140 }} />
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: c.steel }}>Продажи</div>
            <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 700, color: c.green }}>{totals.sales.toLocaleString("ru-RU")} ₸</div>
          </div>
          <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: c.steel }}>Возвраты</div>
            <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 700, color: c.amberDark }}>{totals.returns.toLocaleString("ru-RU")} ₸</div>
          </div>
          <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: c.steel }}>Списания</div>
            <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 700, color: c.red }}>{totals.writeoff.toLocaleString("ru-RU")} ₸</div>
          </div>
          <div style={{ background: c.ink, borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: "#B8C0CC" }}>Итого (чистыми)</div>
            <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 700, color: "#fff" }}>{netTotal.toLocaleString("ru-RU")} ₸</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExcelImportInline({ session, shop, onImported }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (data.length < 2) {
          setError("В файле не найдено строк с данными.");
          return;
        }
        const header = data[0];
        const colIndex = {};
        header.forEach((h, i) => {
          const key = matchColumn(h);
          if (key && !(key in colIndex)) colIndex[key] = i;
        });
        if (colIndex.sku === undefined || colIndex.name === undefined) {
          setError('Не нашёл колонки "Артикул" и "Наименование" — проверьте заголовки первой строки файла.');
          return;
        }
        const parsed = data
          .slice(1)
          .filter((r) => r[colIndex.sku])
          .map((r) => ({
            sku: String(r[colIndex.sku]).trim(),
            alt_sku: colIndex.alt_sku !== undefined ? String(r[colIndex.alt_sku] || "").trim() || "—" : "—",
            name: String(r[colIndex.name] || "").trim(),
            model: colIndex.model !== undefined ? String(r[colIndex.model] || "").trim() : "",
            qty: colIndex.qty !== undefined ? Number(r[colIndex.qty]) || 0 : 0,
            purchase_price: colIndex.purchase_price !== undefined ? Number(r[colIndex.purchase_price]) || 0 : 0,
            price: colIndex.price !== undefined ? Number(r[colIndex.price]) || 0 : 0,
            min_qty: 5,
          }));
        setRows(parsed);
      } catch (err) {
        setError("Не удалось прочитать файл: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function runImport() {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    setError("");
    setDone(0);
    const chunkSize = 50;
    try {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((r) => ({ ...r, shop_id: shop.id }));
        await db("stock", { method: "POST", body: chunk, session, prefer: "return=minimal" });
        setDone(Math.min(rows.length, i + chunkSize));
      }
      setRows(null);
      setFileName("");
      onImported();
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: c.steel, marginBottom: 14 }}>
        Первая строка файла — заголовки. Понимаю колонки: Артикул, Субс / аналог, Наименование, Модель, Кол-во, Закуп, Цена — в любом порядке, по ключевым словам в названии.
      </div>

      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ marginBottom: 14 }} />

      {error && <div style={{ background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

      {rows && (
        <>
          <div style={{ background: c.greenBg, color: c.green, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            Файл «{fileName}» — распознано {rows.length} позиций.
          </div>
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, padding: "7px 10px", background: c.cloud, color: c.steel, fontFamily: bodyFont, fontSize: 10.5, fontWeight: 600 }}>
              <span style={{ width: 100 }}>Артикул</span>
              <span style={{ flex: 1 }}>Наименование</span>
              <span style={{ width: 40, textAlign: "right" }}>Кол.</span>
              <span style={{ width: 70, textAlign: "right" }}>Цена</span>
            </div>
            {rows.slice(0, 12).map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 10px", borderTop: `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12 }}>
                <span style={{ width: 100, fontFamily: monoFont, color: c.steel, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sku}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ width: 40, textAlign: "right", fontFamily: monoFont }}>{r.qty}</span>
                <span style={{ width: 70, textAlign: "right", fontFamily: monoFont }}>{r.price.toLocaleString("ru-RU")}</span>
              </div>
            ))}
            {rows.length > 12 && <div style={{ padding: "6px 10px", color: c.steel, fontSize: 11.5, borderTop: `1px solid ${c.border}` }}>…и ещё {rows.length - 12}</div>}
          </div>
          <button onClick={runImport} disabled={importing} style={{ ...primaryBtn, opacity: importing ? 0.7 : 1 }}>
            {importing ? <Spinner /> : `Импортировать ${rows.length} позиций`}
            {importing && ` (${done}/${rows.length})`}
          </button>
        </>
      )}
    </div>
  );
}

function StockScreen({ session, shop }) {
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState(null); // null | "new" | item
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [showPurchase, setShowPurchase] = useState(false);
  const [markupPct, setMarkupPct] = useState("");
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  // ---- operation panel (Новая операция / Журнал продаж / Загрузка из Excel) ----
  const [opTab, setOpTab] = useState("new");
  const [cart, setCart] = useState([]);
  const [comment, setComment] = useState("");
  const [opDiscount, setOpDiscount] = useState(0);
  const [postFlow, setPostFlow] = useState(null); // { type, step: "counterparty" | "payment" }
  const [flowCounterparty, setFlowCounterparty] = useState(null);
  const [notice, setNotice] = useState("");
  const [opError, setOpError] = useState("");
  const [salesLog, setSalesLog] = useState(null);

  async function load() {
    setError("");
    try {
      const rows = await db("stock", { query: `?shop_id=eq.${shop.id}&order=name.asc`, session });
      setItems(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  async function loadLog() {
    try {
      const rows = await db("sales_log", { query: `?shop_id=eq.${shop.id}&order=date.desc,created_at.desc`, session });
      setSalesLog(rows);
    } catch (e) {
      setOpError(e.message);
    }
  }
  useEffect(() => {
    load();
    loadLog();
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

  async function applyMarkup() {
    const pct = Number(markupPct);
    if (!pct || pct <= 0 || !items) return;
    try {
      for (const it of items) {
        const newPrice = Math.round((it.purchase_price * (1 + pct / 100)) / 10) * 10;
        await db("stock", { method: "PATCH", query: `?id=eq.${it.id}`, body: { price: newPrice }, session, prefer: "return=minimal" });
      }
      setMarkupPct("");
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function roundPricesUp() {
    if (!items) return;
    try {
      for (const it of items) {
        const rounded = Math.ceil(it.price / 100) * 100;
        if (rounded !== it.price) {
          await db("stock", { method: "PATCH", query: `?id=eq.${it.id}`, body: { price: rounded }, session, prefer: "return=minimal" });
        }
      }
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function sortArrow(key) {
    if (sortKey !== key) return <span style={{ opacity: 0.3, marginLeft: 4 }}>▲</span>;
    return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  const filteredSorted = (items || [])
    .filter((it) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        it.sku.toLowerCase().includes(q) ||
        (it.alt_sku || "").toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.model || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "sku") return a.sku.localeCompare(b.sku) * mult;
      if (sortKey === "alt_sku") return (a.alt_sku || "").localeCompare(b.alt_sku || "") * mult;
      if (sortKey === "qty") return (a.qty - b.qty) * mult;
      if (sortKey === "price") return (a.price - b.price) * mult;
      if (sortKey === "purchase_price") return (a.purchase_price - b.purchase_price) * mult;
      return a.name.localeCompare(b.name) * mult;
    });

  // ---- cart / operation logic ----
  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((r) => r.stock_id === item.id);
      if (existing) return prev.map((r) => (r.stock_id === item.id ? { ...r, qty: r.qty + 1 } : r));
      return [...prev, { stock_id: item.id, sku: item.sku, name: item.name, qty: 1, price: item.price }];
    });
    setOpTab("new");
  }
  function updateQty(stock_id, qty) {
    setCart((prev) => prev.map((r) => (r.stock_id === stock_id ? { ...r, qty: Math.max(1, qty) } : r)));
  }
  function updatePrice(stock_id, price) {
    setCart((prev) => prev.map((r) => (r.stock_id === stock_id ? { ...r, price: Math.max(0, price) } : r)));
  }
  function removeFromCart(stock_id) {
    setCart((prev) => prev.filter((r) => r.stock_id !== stock_id));
  }

  function checkStockAvailability() {
    for (const row of cart) {
      const stockItem = (items || []).find((s) => s.id === row.stock_id);
      const available = stockItem ? stockItem.qty : 0;
      if (row.qty > available) {
        setOpError(`Недостаточно товара «${row.name}»: на складе ${available} шт, в операции ${row.qty} шт.`);
        return false;
      }
    }
    return true;
  }

  function startPost(type) {
    if (cart.length === 0) return;
    setOpError("");
    if ((type === "Продажа" || type === "Списание") && !checkStockAvailability()) return;
    if (type === "Списание") {
      commit(type, null, null);
      return;
    }
    if (type === "Возврат от покупателя") {
      setPostFlow({ type, step: "returnSource" });
      return;
    }
    setPostFlow({ type, step: "counterparty" });
  }
  function handleCounterpartySelected(cp) {
    setFlowCounterparty(cp);
    if (postFlow.type === "Продажа") setPostFlow({ ...postFlow, step: "payment" });
    else commit(postFlow.type, cp, null);
  }
  function handleReturnSourceSelected(sale) {
    const cp = { id: sale.counterparty_id, name: sale.counterparty_name, kind: sale.counterparty_kind };
    commit("Возврат от покупателя", cp, null);
  }
  function handlePaymentSelected(method) {
    commit(postFlow.type, flowCounterparty, method);
  }

  async function commit(type, counterparty, paymentMethod) {
    const qty = cart.reduce((s, r) => s + r.qty, 0);
    const itemsPayload = cart.map((r) => {
      const lineRaw = r.qty * r.price;
      const lineDiscount = Math.round((lineRaw * (opDiscount || 0)) / 100);
      const netUnitPrice = r.qty > 0 ? Math.round((lineRaw - lineDiscount) / r.qty) : r.price;
      return { sku: r.sku, name: r.name, qty: r.qty, price: netUnitPrice };
    });
    const sum = itemsPayload.reduce((s, it) => s + it.qty * it.price, 0);
    try {
      if (type === "Заказ покупателя") {
        await db("orders", {
          method: "POST",
          body: {
            shop_id: shop.id,
            doc_number: genDocNumber("O"),
            date: new Date().toISOString().slice(0, 10),
            counterparty_id: counterparty.id,
            counterparty_name: counterparty.name,
            counterparty_kind: counterparty.kind,
            status: "Открыт",
            qty,
            sum,
            comment,
            items: itemsPayload,
          },
          session,
          prefer: "return=minimal",
        });
        setNotice(`«Заказ покупателя» оформлен: ${qty} шт на ${sum.toLocaleString("ru-RU")} ₸`);
      } else {
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
            items: itemsPayload,
          },
          session,
          prefer: "return=minimal",
        });
        // Adjust stock: sales/write-offs reduce qty, returns add it back.
        const sign = type === "Возврат от покупателя" ? 1 : -1;
        for (const row of cart) {
          const current = (items || []).find((s) => s.id === row.stock_id);
          const newQty = Math.max(0, (current ? current.qty : 0) + sign * row.qty);
          await db("stock", { method: "PATCH", query: `?id=eq.${row.stock_id}`, body: { qty: newQty }, session, prefer: "return=minimal" });
        }
        setNotice(`«${type}» проведена: ${qty} шт на ${sum.toLocaleString("ru-RU")} ₸`);
      }
      setCart([]);
      setComment("");
      setOpDiscount(0);
      setPostFlow(null);
      setFlowCounterparty(null);
      load();
      loadLog();
    } catch (e) {
      setOpError(e.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 600, color: c.ink }}>Склад</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setOpTab("excel")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: c.ink }}
          >
            <Icon size={14}>📄</Icon> Загрузить из Excel
          </button>
          <button onClick={() => setFormMode(formMode === "new" ? null : "new")} style={primaryBtn}>
            <Icon size={15}>+</Icon> Добавить товар
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 8, background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
          <Icon size={15}>⚠</Icon>
          {error}
        </div>
      )}

      {formMode === "new" && <ItemForm onSave={saveItem} onCancel={() => setFormMode(null)} />}
      {formMode && formMode !== "new" && <ItemForm initial={formMode} onSave={saveItem} onDelete={deleteItem} onCancel={() => setFormMode(null)} />}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel }}>Наценка на весь ассортимент, %</span>
        <input
          type="number"
          value={markupPct}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setMarkupPct(e.target.value)}
          placeholder="30"
          style={{ width: 60, padding: "6px 8px", borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12.5 }}
        />
        <button
          onClick={applyMarkup}
          disabled={!markupPct}
          style={{
            background: markupPct ? c.amber : c.border,
            color: markupPct ? c.ink : c.steelLight,
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: 12,
            cursor: markupPct ? "pointer" : "not-allowed",
          }}
        >
          Применить
        </button>
        <button
          onClick={roundPricesUp}
          style={{ background: "transparent", color: c.ink, border: `1px solid ${c.border}`, borderRadius: 6, padding: "6px 12px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
        >
          Округлить до сотен
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по артикулу, субс/аналогу, названию или модели…" style={{ ...inputStyle, flex: 1 }} />
        <button
          onClick={() => setShowPurchase(!showPurchase)}
          title={showPurchase ? "Скрыть закупочную цену" : "Показать закупочную цену"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: showPurchase ? c.cloud : "transparent",
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            padding: "0 14px",
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
            color: c.steel,
            whiteSpace: "nowrap",
          }}
        >
          {showPurchase ? "🙈 Скрыть закуп" : "👁 Показать закуп"}
        </button>
      </div>

      <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: c.ink, color: "#B8C0CC", fontFamily: bodyFont, fontSize: 11, fontWeight: 600, letterSpacing: 0.2 }}>
          <span onClick={() => toggleSort("sku")} style={{ width: 120, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center" }}>
            Артикул {sortArrow("sku")}
          </span>
          <span onClick={() => toggleSort("alt_sku")} style={{ width: 100, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center" }}>
            Субс / аналог {sortArrow("alt_sku")}
          </span>
          <span onClick={() => toggleSort("name")} style={{ flex: 1, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center" }}>
            Наименование {sortArrow("name")}
          </span>
          <span style={{ width: 90 }}>Модель</span>
          <span onClick={() => toggleSort("qty")} style={{ width: 60, textAlign: "right", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            Кол. {sortArrow("qty")}
          </span>
          <span onClick={() => toggleSort("price")} style={{ width: 84, textAlign: "right", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            Цена {sortArrow("price")}
          </span>
          <span onClick={() => toggleSort("purchase_price")} style={{ width: 84, textAlign: "right", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            Закуп {sortArrow("purchase_price")}
          </span>
          <span style={{ width: 24 }} />
          <span style={{ width: 28 }} />
        </div>

        {items === null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 20, fontFamily: bodyFont, fontSize: 13, color: c.steel }}>
            <Spinner /> Загружаю склад из базы…
          </div>
        )}
        {items && items.length === 0 && (
          <div style={{ padding: 24, fontFamily: bodyFont, fontSize: 13.5, color: c.steel, textAlign: "center" }}>
            Склад пуст. Нажмите «Добавить товар» или загрузите список из Excel.
          </div>
        )}
        {items && items.length > 0 && filteredSorted.length === 0 && (
          <div style={{ padding: 24, fontFamily: bodyFont, fontSize: 13.5, color: c.steel, textAlign: "center" }}>Ничего не найдено по этому запросу.</div>
        )}
        {filteredSorted.map((it, i) => (
          <div
            key={it.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 16px",
              borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
              background: i % 2 === 1 ? c.cloud : "#fff",
              fontFamily: bodyFont,
              fontSize: 13,
            }}
          >
            <span style={{ width: 120, fontFamily: monoFont, fontWeight: 600, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.sku}</span>
            <span style={{ width: 100, fontFamily: monoFont, fontSize: 12, color: c.steel, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.alt_sku || "—"}</span>
            <span style={{ flex: 1, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{it.name}</span>
            <span style={{ width: 90, color: c.steel, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.model}</span>
            <span style={{ width: 60, textAlign: "right", fontFamily: monoFont, fontWeight: 600, color: it.qty <= it.min_qty ? c.red : c.ink }}>{it.qty}</span>
            <span style={{ width: 84, textAlign: "right", fontFamily: monoFont, color: c.amberDark, fontWeight: 700 }}>{it.price.toLocaleString("ru-RU")}</span>
            <span style={{ width: 84, textAlign: "right", fontFamily: monoFont, color: c.steel, letterSpacing: showPurchase ? 0 : 1 }}>
              {showPurchase ? it.purchase_price.toLocaleString("ru-RU") : "••••"}
            </span>
            <button onClick={() => setFormMode(it)} style={{ width: 24, background: "none", border: "none", color: c.steelLight, cursor: "pointer", padding: 0 }}>
              <Icon size={13}>✎</Icon>
            </button>
            <button
              onClick={() => addToCart(it)}
              title="Добавить в операцию"
              style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: c.amber, color: c.ink, cursor: "pointer", flexShrink: 0, fontWeight: 700, fontSize: 15 }}
            >
              +
            </button>
          </div>
        ))}
      </div>

      {/* ---- Operation panel: Новая операция / Журнал продаж / Загрузка из Excel ---- */}
      <div style={{ display: "flex", gap: 8, margin: "20px 0 14px" }}>
        {[
          { key: "new", label: "Новая операция" },
          { key: "log", label: "Журнал продаж" },
          { key: "excel", label: "Загрузка из Excel" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setOpTab(t.key)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${opTab === t.key ? c.amberDark : c.border}`,
              background: opTab === t.key ? "#FDF3E2" : "#fff",
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

      {opError && (
        <div style={{ display: "flex", gap: 8, background: c.redBg, color: c.red, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
          <Icon size={15}>⚠</Icon> {opError}
        </div>
      )}

      <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
        {opTab === "excel" && <ExcelImportInline session={session} shop={shop} onImported={load} />}

        {opTab === "log" && <SalesLogPanel salesLog={salesLog} shop={shop} />}

        {opTab === "new" && (
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ background: c.cloud, color: c.ink, fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, padding: "6px 10px", borderRadius: 6 }}>Черновик</span>
              <span style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel }}>Скидка на операцию, %</span>
              <input
                type="number"
                value={opDiscount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setOpDiscount(Number(e.target.value) || 0)}
                style={{ width: 56, padding: "5px 8px", borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12.5 }}
              />
              {cart.length > 0 && (
                <button
                  onClick={() => setPrintPreviewOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "6px 12px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12, cursor: "pointer", color: c.ink }}
                >
                  🖨 Печать предварительного списка
                </button>
              )}
              {cart.length === 0 && (
                <span style={{ marginLeft: "auto", fontFamily: bodyFont, fontSize: 12, color: c.steel }}>Нажмите «+» у товара выше, чтобы добавить его в операцию.</span>
              )}
            </div>

            {notice && <div style={{ background: c.greenBg, color: c.green, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 12 }}>{notice}</div>}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button
                onClick={() => startPost("Продажа")}
                disabled={cart.length === 0}
                style={{ ...primaryBtn, opacity: cart.length === 0 ? 0.5 : 1, cursor: cart.length === 0 ? "not-allowed" : "pointer" }}
              >
                Провести продажу
              </button>
              <button
                onClick={() => startPost("Возврат от покупателя")}
                disabled={cart.length === 0}
                style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 16px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: cart.length === 0 ? "not-allowed" : "pointer", color: cart.length === 0 ? c.steelLight : c.ink }}
              >
                Возврат от покупателя
              </button>
              <button
                onClick={() => startPost("Заказ покупателя")}
                disabled={cart.length === 0}
                style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 16px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: cart.length === 0 ? "not-allowed" : "pointer", color: cart.length === 0 ? c.steelLight : c.ink }}
              >
                Заказ покупателя
              </button>
              <button
                onClick={() => startPost("Списание")}
                disabled={cart.length === 0}
                style={{ background: "transparent", border: `1px solid ${cart.length === 0 ? c.border : c.redBg}`, borderRadius: 8, padding: "10px 16px", fontFamily: bodyFont, fontWeight: 600, fontSize: 12.5, cursor: cart.length === 0 ? "not-allowed" : "pointer", color: cart.length === 0 ? c.steelLight : c.red }}
              >
                Списание
              </button>
            </div>

            <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: c.cloud, color: c.steel, fontFamily: bodyFont, fontSize: 11, fontWeight: 600 }}>
                <span style={{ width: 28 }}>№</span>
                <span style={{ width: 100 }}>Артикул</span>
                <span style={{ flex: 1 }}>Номенклатура</span>
                <span style={{ width: 50, textAlign: "right" }}>Кол.</span>
                <span style={{ width: 70, textAlign: "right" }}>Цена</span>
                <span style={{ width: 70, textAlign: "right" }}>Скидка</span>
                <span style={{ width: 90, textAlign: "right" }}>Сумма</span>
                <span style={{ width: 20 }} />
              </div>
              {cart.length === 0 && <div style={{ padding: 18, textAlign: "center", color: c.steel, fontSize: 13 }}>Операция пуста</div>}
              {cart.map((r, i) => {
                const lineRaw = r.qty * r.price;
                const lineDiscount = Math.round((lineRaw * (opDiscount || 0)) / 100);
                const lineNet = lineRaw - lineDiscount;
                return (
                  <div key={r.stock_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5 }}>
                    <span style={{ width: 28, color: c.steel, fontFamily: monoFont }}>{i + 1}</span>
                    <span style={{ width: 100, fontFamily: monoFont, color: c.steel, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sku}</span>
                    <span style={{ flex: 1, color: c.ink }}>{r.name}</span>
                    <input
                      type="number"
                      value={r.qty}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateQty(r.stock_id, Number(e.target.value) || 1)}
                      style={{ width: 42, textAlign: "right", padding: "3px 6px", borderRadius: 5, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }}
                    />
                    <input
                      type="number"
                      value={r.price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updatePrice(r.stock_id, Number(e.target.value) || 0)}
                      style={{ width: 70, textAlign: "right", padding: "3px 6px", borderRadius: 5, border: `1px solid ${c.border}`, fontFamily: monoFont, fontSize: 12 }}
                    />
                    <span style={{ width: 70, textAlign: "right", fontFamily: monoFont, color: lineDiscount > 0 ? c.red : c.steelLight }}>
                      {lineDiscount > 0 ? `−${lineDiscount.toLocaleString("ru-RU")}` : "—"}
                    </span>
                    <span style={{ width: 90, textAlign: "right", fontFamily: monoFont, fontWeight: 700 }}>{lineNet.toLocaleString("ru-RU")}</span>
                    <button onClick={() => removeFromCart(r.stock_id)} style={{ width: 20, background: "none", border: "none", color: c.steelLight, cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                );
              })}
              {cart.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, padding: "8px 12px", borderTop: `1px solid ${c.border}`, background: c.cloud, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 700 }}>
                  <span>Итого</span>
                  <span style={{ fontFamily: monoFont }}>
                    {cart
                      .reduce((s, r) => {
                        const lineRaw = r.qty * r.price;
                        const lineDiscount = Math.round((lineRaw * (opDiscount || 0)) / 100);
                        return s + (lineRaw - lineDiscount);
                      }, 0)
                      .toLocaleString("ru-RU")}{" "}
                    ₸
                  </span>
                </div>
              )}
              {(() => {
                const belowCost = cart.filter((r) => {
                  const stockItem = (items || []).find((s) => s.id === r.stock_id);
                  return stockItem && r.price < stockItem.purchase_price;
                });
                if (belowCost.length === 0) return null;
                return (
                  <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: `1px solid ${c.border}`, background: c.redBg, color: c.red, fontFamily: bodyFont, fontSize: 12.5 }}>
                    <Icon size={15}>⚠</Icon>
                    Цена ниже закупочной: {belowCost.map((r) => r.name).join(", ")}
                  </div>
                );
              })()}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: `1px solid ${c.border}` }}>
                <span style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, width: 100, flexShrink: 0 }}>Комментарий</span>
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" style={{ ...inputStyle, flex: 1 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {postFlow?.step === "counterparty" && <CounterpartyModal session={session} shop={shop} onSelect={handleCounterpartySelected} onClose={() => setPostFlow(null)} />}
      {postFlow?.step === "returnSource" && (
        <ReturnSourceModal salesLog={salesLog} cartSkus={cart.map((r) => r.sku)} onSelect={handleReturnSourceSelected} onClose={() => setPostFlow(null)} />
      )}
      {postFlow?.step === "payment" && (
        <PaymentMethodModal onSelect={handlePaymentSelected} onClose={() => setPostFlow(null)} counterpartyKind={flowCounterparty?.kind} />
      )}

      {printPreviewOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,33,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={() => setPrintPreviewOpen(false)}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #print-area-op, #print-area-op * { visibility: visible; }
              #print-area-op { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 24px; box-shadow: none; border: none; }
              .no-print { display: none !important; }
            }
          `}</style>
          <div onClick={(e) => e.stopPropagation()} style={{ background: c.panel, borderRadius: 12, width: 520, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${c.border}` }}>
              <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 600, color: c.ink }}>Предварительный список</span>
              <button onClick={() => setPrintPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: c.steel }}>
                <Icon size={17}>✕</Icon>
              </button>
            </div>

            <div id="print-area-op" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, paddingBottom: 14, borderBottom: `2px solid ${c.ink}` }}>
                <div>
                  <div style={{ fontFamily: displayFont, fontSize: 19, fontWeight: 700, color: c.ink }}>{shop.name || "Магазин"}</div>
                  {shop.store_address && <div style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, marginTop: 3 }}>{shop.store_address}</div>}
                  {shop.phones && shop.phones.filter((p) => p && p.trim()).length > 0 && (
                    <div style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, marginTop: 2 }}>
                      {shop.phones.filter((p) => p && p.trim()).join(" · ")}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 700, color: c.ink }}>Предварительный список</div>
                  <div style={{ fontFamily: bodyFont, fontSize: 12, color: c.steel, marginTop: 3 }}>{new Date().toLocaleDateString("ru-RU")}</div>
                </div>
              </div>

              <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, padding: "8px 10px", background: c.cloud, color: c.steel, fontFamily: bodyFont, fontSize: 11, fontWeight: 700 }}>
                  <span style={{ width: 90 }}>Артикул</span>
                  <span style={{ flex: 1 }}>Наименование</span>
                  <span style={{ width: 36, textAlign: "right" }}>Кол.</span>
                  <span style={{ width: 70, textAlign: "right" }}>Цена</span>
                  <span style={{ width: 65, textAlign: "right" }}>Скидка</span>
                  <span style={{ width: 85, textAlign: "right" }}>Сумма</span>
                </div>
                {cart.map((r, i) => {
                  const lineRaw = r.qty * r.price;
                  const lineDiscount = Math.round((lineRaw * (opDiscount || 0)) / 100);
                  const lineNet = lineRaw - lineDiscount;
                  return (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "8px 10px", borderTop: `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12.5 }}>
                      <span style={{ width: 90, fontFamily: monoFont, color: c.steel }}>{r.sku}</span>
                      <span style={{ flex: 1 }}>{r.name}</span>
                      <span style={{ width: 36, textAlign: "right", fontFamily: monoFont }}>{r.qty}</span>
                      <span style={{ width: 70, textAlign: "right", fontFamily: monoFont }}>{r.price.toLocaleString("ru-RU")}</span>
                      <span style={{ width: 65, textAlign: "right", fontFamily: monoFont, color: lineDiscount > 0 ? c.red : c.steelLight }}>
                        {lineDiscount > 0 ? `−${lineDiscount.toLocaleString("ru-RU")}` : "—"}
                      </span>
                      <span style={{ width: 85, textAlign: "right", fontFamily: monoFont, fontWeight: 700 }}>{lineNet.toLocaleString("ru-RU")}</span>
                    </div>
                  );
                })}
                {(() => {
                  const rawTotal = cart.reduce((s, r) => s + r.qty * r.price, 0);
                  const discountTotal = Math.round((rawTotal * (opDiscount || 0)) / 100);
                  const netTotal = rawTotal - discountTotal;
                  return (
                    <>
                      {discountTotal > 0 && (
                        <div style={{ display: "flex", padding: "6px 10px", borderTop: `1px solid ${c.border}`, fontFamily: bodyFont, fontSize: 12, color: c.steel }}>
                          <span style={{ flex: 1 }}>Скидка {opDiscount}%</span>
                          <span style={{ fontFamily: monoFont, color: c.red }}>−{discountTotal.toLocaleString("ru-RU")} ₸</span>
                        </div>
                      )}
                      <div style={{ display: "flex", padding: "10px 10px", borderTop: `1px solid ${c.border}`, background: c.cloud, fontWeight: 700, fontSize: 14 }}>
                        <span style={{ flex: 1 }}>Итого к оплате</span>
                        <span style={{ fontFamily: monoFont }}>{netTotal.toLocaleString("ru-RU")} ₸</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="no-print">
                <button onClick={() => window.print()} style={{ ...primaryBtn, width: "100%" }}>
                  🖨 Печать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- App shell: bootstraps the shop row for the logged-in user ----
export default function App() {
  const [session, setSession] = useState(null);
  const [shop, setShop] = useState(null);
  const [bootError, setBootError] = useState("");
  const [tab, setTab] = useState("dash");

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
          onClick={() => setTab("dash")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "dash" ? c.amber : "transparent", color: tab === "dash" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>📊</Icon> Дашборд
        </div>
        <div
          onClick={() => setTab("stock")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "stock" ? c.amber : "transparent", color: tab === "stock" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>📦</Icon> Склад
        </div>
        <div
          onClick={() => setTab("network")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "network" ? c.amber : "transparent", color: tab === "network" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>🔎</Icon> Поиск по сети
        </div>
        <div
          onClick={() => setTab("contacts")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "contacts" ? c.amber : "transparent", color: tab === "contacts" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>👥</Icon> Контрагенты
        </div>
        <div
          onClick={() => setTab("orders")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "orders" ? c.amber : "transparent", color: tab === "orders" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>🛒</Icon> Заказы
        </div>
        <div
          onClick={() => setTab("settings")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: tab === "settings" ? c.amber : "transparent", color: tab === "settings" ? c.ink : "#B8C0CC", fontWeight: 600, fontSize: 14 }}
        >
          <Icon size={17}>⚙️</Icon> Настройки
        </div>
        <div style={{ marginTop: "auto", padding: "10px 14px", fontSize: 11, color: c.steelLight, fontFamily: bodyFont }}>
          Остальные разделы (документы, отчёты) подключим следующими.
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
        {tab === "dash" && <DashboardScreen session={session} shop={shop} />}
        {tab === "stock" && <StockScreen session={session} shop={shop} />}
        {tab === "network" && <NetworkSearchScreen session={session} shop={shop} onShopUpdate={setShop} />}
        {tab === "contacts" && <ContactsScreen session={session} shop={shop} />}
        {tab === "orders" && <OrdersScreen session={session} shop={shop} />}
        {tab === "settings" && <SettingsScreen session={session} shop={shop} onShopUpdate={setShop} />}
      </main>
    </div>
  );
}
