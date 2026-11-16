
(function () {
  "use strict";

  const STORAGE_KEY = "pf_warehouse_state_v2";
  const THEME_KEY = "pf_warehouse_theme";

  const API_URL = "https://script.google.com/macros/s/AKfycbwVmA6uHLAg5OzaB3w5_1GvfCv9Jm2j6vgT41LWgf4HWjmKQccTvaRoLidiEI-NvqjAfA/exec";
  const SYNC_INTERVAL_MS = 7000;

  function isApiConfigured() {
    return !!API_URL && API_URL.indexOf("วาง_URL") === -1;
  }

  let syncStatus = "offline"; // offline | connecting | online | error
  let busy = false;

  function setBusy(v) {
    busy = v;
    document.body.classList.toggle("busy-sync", v);
  }

  function setSyncStatus(status) {
    syncStatus = status;
    const el = document.getElementById("syncStatusBadge");
    if (!el) return;
    const map = {
      connecting: { cls: "connecting", text: "กำลังซิงค์กับ Google Sheet…", icon: "🔄" },
      online: { cls: "online", text: "ซิงค์กับ Google Sheet แล้ว", icon: "🟢" },
      offline: { cls: "offline", text: "โหมดออฟไลน์ (ยังไม่ตั้งค่า Google Sheet)", icon: "⚪" },
      error: { cls: "error", text: "ซิงค์ล้มเหลว — ใช้ข้อมูลที่บันทึกในเครื่อง", icon: "🔴" }
    };
    const s = map[status] || map.offline;
    el.className = `sync-badge ${s.cls}`;
    el.innerHTML = `<span class="sync-dot">${s.icon}</span><span>${s.text}</span>`;
  }

  async function apiPost(action, payload) {
    if (!isApiConfigured()) throw new Error("ยังไม่ได้ตั้งค่า API_URL — ดู SETUP_GOOGLE_SHEETS.md");
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // เลี่ยง CORS preflight กับ Apps Script
      body: JSON.stringify({ action, ...payload })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
    return json;
  }

  async function syncFromServer(showErrorToast) {
    if (!isApiConfigured()) {
      setSyncStatus("offline");
      return;
    }
    setSyncStatus("connecting");
    try {
      const res = await fetch(API_URL, { method: "GET" });
      const json = await res.json();
      if (!json.products || !json.requests) throw new Error("รูปแบบข้อมูลจาก Sheet ไม่ถูกต้อง");
      state.products = json.products;
      state.requests = json.requests;
      save();
      setSyncStatus("online");
      render();
    } catch (err) {
      console.error(err);
      setSyncStatus("error");
      if (showErrorToast) {
        showToast("ซิงค์ข้อมูลกับ Google Sheet ไม่สำเร็จ ใช้ข้อมูลที่บันทึกไว้ในเครื่องแทน", "warning");
      }
    }
  }

  const ROLES = [
    ["central", "คลังกลาง", "🏢"],
    ["b1", "สาขา 1 (เคหะ)", "🏪"],
    ["b2", "สาขา 2 (ตะวันแดง)", "🏪"],
    ["b3", "สาขา 3 (บ้านสวน)", "🏪"]
  ];

  function defaultState() {
    return {
      role: "central",
      products: [
        { id: "p1", name: "อาหารหมา โปรตีนสูง 5kg", cat: "อาหารหมา", unit: "ถุง", stock: 40, cost: 420, price: 590, minStock: 10, lot: "LOT-2401", exp: "2027-08-31" },
        { id: "p2", name: "อาหารหมา สูตรลูกสุนัข 3kg", cat: "อาหารหมา", unit: "ถุง", stock: 18, cost: 280, price: 390, minStock: 10, lot: "LOT-2402", exp: "2027-05-15" },
        { id: "p3", name: "อาหารแมว ทะเลรวมมิตร 2kg", cat: "อาหารแมว", unit: "ถุง", stock: 25, cost: 210, price: 320, minStock: 10, lot: "LOT-2403", exp: "2027-10-20" },
        { id: "p4", name: "อาหารแมว สูตรลดน้ำหนัก 2kg", cat: "อาหารแมว", unit: "ถุง", stock: 9, cost: 230, price: 350, minStock: 10, lot: "LOT-2404", exp: "2026-12-30" },
        { id: "p5", name: "วิตามินรวมสำหรับสัตว์เลี้ยง", cat: "อาหารเสริมสัตว์", unit: "ขวด", stock: 30, cost: 150, price: 250, minStock: 10, lot: "LOT-2405", exp: "2028-01-10" },
        { id: "p6", name: "ปลอกคอกันเห็บหมัด", cat: "อุปกรณ์ต่าง ๆ", unit: "ชิ้น", stock: 14, cost: 85, price: 160, minStock: 10, lot: "LOT-2406", exp: "2029-12-31" },
        { id: "p7", name: "ชามอาหารสแตนเลสคู่", cat: "อุปกรณ์ต่าง ๆ", unit: "ชุด", stock: 22, cost: 120, price: 220, minStock: 10, lot: "LOT-2407", exp: "" }
      ],
      requests: [
        { id: "req_demo_01", branch: "b1", productId: "p1", qty: 5, note: "หน้าร้านใกล้หมด ขอเบิกด่วน", status: "approved", ts: "16/11/2026 09:30:00", decisionTs: "16/11/2026 09:45:00", receivedTs: "" },
        { id: "req_demo_02", branch: "b2", productId: "p3", qty: 4, note: "ลูกค้าจองไว้ 2 ถุง", status: "pending", ts: "16/11/2026 10:15:00", decisionTs: "", receivedTs: "" }
      ],
      branchStocks: {
        b1: { p1: 15, p2: 6, p3: 10, p4: 4, p5: 12, p6: 5, p7: 8 },
        b2: { p1: 8, p2: 5, p3: 12, p4: 2, p5: 7, p6: 6, p7: 4 },
        b3: { p1: 10, p2: 8, p3: 7, p4: 5, p5: 9, p6: 4, p7: 6 }
      },
      inboundLogs: [
        { id: "in_demo_1", productId: "p1", productName: "อาหารหมา โปรตีนสูง 5kg", qty: 20, prevStock: 20, newStock: 40, lot: "LOT-2401", exp: "2027-08-31", note: "PO-6701 บ.เพ็ทซัพพลาย", ts: "15/11/2026 14:00:00" }
      ],
      adjustmentLogs: [],
      branchSalesLogs: []
    };
  }

  // --- State Persistence & Migration ---
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.products || !Array.isArray(parsed.products) || !parsed.requests || !Array.isArray(parsed.requests)) {
        return defaultState();
      }
      parsed.products = parsed.products.map(p => ({
        cost: 250,
        price: 390,
        minStock: 10,
        lot: "LOT-2401",
        exp: "2027-12-31",
        ...p
      }));
      if (!parsed.branchStocks || typeof parsed.branchStocks !== "object") {
        parsed.branchStocks = {
          b1: { p1: 15, p2: 6, p3: 10, p4: 4, p5: 12, p6: 5, p7: 8 },
          b2: { p1: 8, p2: 5, p3: 12, p4: 2, p5: 7, p6: 6, p7: 4 },
          b3: { p1: 10, p2: 8, p3: 7, p4: 5, p5: 9, p6: 4, p7: 6 }
        };
      }
      if (!parsed.inboundLogs || !Array.isArray(parsed.inboundLogs)) parsed.inboundLogs = [];
      if (!parsed.adjustmentLogs || !Array.isArray(parsed.adjustmentLogs)) parsed.adjustmentLogs = [];
      if (!parsed.branchSalesLogs || !Array.isArray(parsed.branchSalesLogs)) parsed.branchSalesLogs = [];
      return parsed;
    } catch (e) {
      console.error("Failed to load state:", e);
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state:", e);
      showToast("ไม่สามารถบันทึกข้อมูลลงบราวเซอร์ได้", "error");
    }
  }

  let state = load();

  // Temporary UI filter state (not saved in localStorage)
  let uiState = {
    searchQuery: "",
    selectedCategory: "all",
    stockFilter: "all", // "all" | "in_stock" | "reorder" | "near_exp" | "out_of_stock"
    historyTab: "requests", // "requests" | "inbound" | "adjust"
    branchTab: "inventory" // "inventory" | "requisition" | "history"
  };

  let drawerState = {
    isOpen: false,
    mode: "stockIn", // "stockIn" | "adjust" | "addProduct" | "branchSale"
    productId: null
  };

  function getDaysUntilExp(expStr) {
    if (!expStr) return null;
    const expDate = new Date(expStr);
    if (isNaN(expDate.getTime())) return null;
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // --- Helper Functions ---
  function branchLabel(id) {
    const found = ROLES.find(r => r[0] === id);
    return found ? `${found[2]} ${found[1]}` : (id || "ไม่ทราบสาขา");
  }

  function findProduct(id) {
    if (!state.products) return null;
    return state.products.find(p => p.id === id) || null;
  }

  function formatTime(isoOrStr) {
    if (!isoOrStr) return "-";
    return isoOrStr;
  }

  function getCategories() {
    const cats = new Set();
    state.products.forEach(p => {
      if (p.cat) cats.add(p.cat);
    });
    return Array.from(cats);
  }

  // --- Toast Notification System ---
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "warning") icon = "⚠️";
    if (type === "error") icon = "❌";

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("toast-hide");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3200);
  }

  // --- Modal Dialog System ---
  function showModal(title, bodyHtml, onConfirm, confirmText = "ยืนยัน", confirmClass = "btn-primary") {
    const modal = document.getElementById("modalContainer");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl = document.getElementById("modalBody");
    const cancelBtn = document.getElementById("modalCancelBtn");
    const confirmBtn = document.getElementById("modalConfirmBtn");

    if (!modal) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${confirmClass}`;

    modal.classList.remove("hidden");

    function cleanup() {
      modal.classList.add("hidden");
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
    }

    cancelBtn.onclick = cleanup;
    confirmBtn.onclick = () => {
      cleanup();
      if (typeof onConfirm === "function") onConfirm();
    };
  }

  // --- Stock Badge Helper ---
  function stockBadge(stock) {
    if (stock <= 0) {
      return `<span class="badge-stock out-of-stock">● หมดสต็อก (0)</span>`;
    } else if (stock < 10) {
      return `<span class="badge-stock low-stock">⚠️ ใกล้หมด (${stock})</span>`;
    } else {
      return `<span class="badge-stock in-stock">● พร้อมเบิก (${stock})</span>`;
    }
  }

  // --- Status Tag Badge Helper ---
  function statusTag(status) {
    const map = {
      pending: { cls: "pending", text: "รออนุมัติ", icon: "⏳" },
      approved: { cls: "approved", text: "อนุมัติแล้ว", icon: "✓" },
      rejected: { cls: "rejected", text: "ปฏิเสธ", icon: "✕" }
    };
    const s = map[status] || { cls: "pending", text: status || "ไม่ระบุ", icon: "•" };
    return `<span class="badge ${s.cls}"><span class="badge-dot"></span>${s.icon} ${s.text}</span>`;
  }

  // --- Theme Controller ---
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = saved ? saved : (prefersDark ? "dark" : "light");
    applyTheme(initialTheme);

    const toggleBtn = document.getElementById("themeToggleBtn");
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
        showToast(next === "dark" ? "เปลี่ยนเป็นโหมดมืด 🌙" : "เปลี่ยนเป็นโหมดสว่าง ☀️", "info");
      };
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
      btn.innerHTML = `<span class="theme-icon">${theme === "dark" ? "☀️" : "🌙"}</span>`;
      btn.title = theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด";
    }
  }

  // --- Business Logic ---
  async function submitRequest(branch, productId, qty, note = "") {
    if (busy) { showToast("กำลังดำเนินการรายการก่อนหน้าอยู่ กรุณารอสักครู่", "warning"); return; }
    const parsedQty = Math.floor(Number(qty));
    if (!productId) {
      showToast("กรุณาเลือกสินค้าที่ต้องการเบิก", "warning");
      return;
    }
    if (isNaN(parsedQty) || parsedQty <= 0) {
      showToast("จำนวนสินค้าต้องเป็นจำนวนเต็มบวก (อย่างน้อย 1 ชิ้น)", "warning");
      return;
    }

    const prod = findProduct(productId);
    if (!prod) {
      showToast("ไม่พบข้อมูลสินค้าที่เลือก", "error");
      return;
    }

    if (prod.stock <= 0) {
      showToast(`สินค้า "${prod.name}" หมดสต็อกในคลังกลางชั่วคราว`, "warning");
    }

    const ts = new Date().toLocaleString("th-TH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    const cleanNote = (note || "").trim();

    if (!isApiConfigured()) {
      const newReq = {
        id: "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        branch, productId, qty: parsedQty, note: cleanNote, status: "pending", ts
      };
      state.requests.unshift(newReq);
      save();
      showToast(`ส่งคำขอเบิก ${prod.name} จำนวน ${parsedQty} ${prod.unit || "ชิ้น"} สำเร็จ (โหมดออฟไลน์)`, "success");
      render();
      return;
    }

    setBusy(true);
    try {
      await apiPost("submitRequest", { branch, productId, qty: parsedQty, note: cleanNote, ts });
      await syncFromServer(false);
      showToast(`ส่งคำขอเบิก ${prod.name} จำนวน ${parsedQty} ${prod.unit || "ชิ้น"} สำเร็จ`, "success");
    } catch (err) {
      showToast("ส่งคำขอไม่สำเร็จ: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function decide(reqId, approve) {
    if (busy) { showToast("กำลังดำเนินการรายการก่อนหน้าอยู่ กรุณารอสักครู่", "warning"); return; }
    const r = state.requests.find(x => x.id === reqId);
    if (!r) {
      showToast("ไม่พบคำขอที่ระบุ", "error");
      return;
    }
    if (r.status !== "pending") {
      showToast("คำขอนี้ได้รับการตัดสินไปแล้ว", "warning");
      render();
      return;
    }

    const prod = findProduct(r.productId);
    const branchName = branchLabel(r.branch);

    async function runApprove() {
      if (!prod) {
        showToast("ไม่พบข้อมูลสินค้า ไม่สามารถตัดสต็อกได้", "error");
        return;
      }
      if (prod.stock < r.qty) {
        showToast(`สต็อกไม่เพียงพอ! คงเหลือ ${prod.stock} ${prod.unit || "ชิ้น"} แต่มียอดขอ ${r.qty}`, "error");
        return;
      }
      const decisionTs = new Date().toLocaleString("th-TH");

      if (!isApiConfigured()) {
        prod.stock -= r.qty;
        r.status = "approved";
        r.decisionTs = decisionTs;
        save();
        showToast(`อนุมัติคำขอของ ${branchName} สำเร็จ (โหมดออฟไลน์)`, "success");
        render();
        return;
      }

      setBusy(true);
      try {
        await apiPost("decide", { id: r.id, approve: true, productId: r.productId, qty: r.qty, decisionTs });
        await syncFromServer(false);
        showToast(`อนุมัติคำขอของ ${branchName} สำเร็จ (ตัดสต็อกแล้ว ${r.qty} ${prod.unit || "ชิ้น"})`, "success");
      } catch (err) {
        showToast("อนุมัติไม่สำเร็จ: " + err.message, "error");
      } finally {
        setBusy(false);
      }
    }

    async function runReject() {
      const decisionTs = new Date().toLocaleString("th-TH");
      if (!isApiConfigured()) {
        r.status = "rejected";
        r.decisionTs = decisionTs;
        save();
        showToast(`ปฏิเสธคำขอของ ${branchName} เรียบร้อยแล้ว (โหมดออฟไลน์)`, "warning");
        render();
        return;
      }
      setBusy(true);
      try {
        await apiPost("decide", { id: r.id, approve: false, decisionTs });
        await syncFromServer(false);
        showToast(`ปฏิเสธคำขอของ ${branchName} เรียบร้อยแล้ว`, "warning");
      } catch (err) {
        showToast("ปฏิเสธคำขอไม่สำเร็จ: " + err.message, "error");
      } finally {
        setBusy(false);
      }
    }

    if (approve) {
      runApprove();
    } else {
      showModal(
        "ยืนยันการปฏิเสธคำขอ",
        `คุณต้องการปฏิเสธคำขอเบิก <strong>${prod ? prod.name : "สินค้า"}</strong> จำนวน <strong>${r.qty}</strong> จาก <strong>${branchName}</strong> หรือไม่?`,
        runReject,
        "ปฏิเสธคำขอ",
        "btn-danger"
      );
    }
  }

  async function restockProduct(productId, addQty, note, lot, exp) {
    if (busy) { showToast("กำลังดำเนินการรายการก่อนหน้าอยู่ กรุณารอสักครู่", "warning"); return; }
    const prod = findProduct(productId);
    if (!prod) return;
    const qty = Math.max(1, Math.floor(Number(addQty)));
    const refNote = note || "นำเข้าสต็อกเข้าคลังกลาง";
    const prevStock = prod.stock;
    const newStock = prevStock + qty;

    if (lot) prod.lot = lot;
    if (exp) prod.exp = exp;

    const logEntry = {
      id: "in_" + Date.now(),
      productId: prod.id,
      productName: prod.name,
      qty: qty,
      prevStock: prevStock,
      newStock: newStock,
      lot: prod.lot || "",
      exp: prod.exp || "",
      note: refNote,
      ts: new Date().toLocaleString("th-TH")
    };

    if (!isApiConfigured()) {
      prod.stock = newStock;
      if (!state.inboundLogs) state.inboundLogs = [];
      state.inboundLogs.unshift(logEntry);
      save();
      showToast(`📥 นำเข้าสต็อก "${prod.name}" +${qty} ${prod.unit || "ชิ้น"} เรียบร้อย (คงเหลือใหม่: ${newStock})`, "success");
      render();
      return;
    }

    setBusy(true);
    try {
      await apiPost("restock", { productId, qty, note: refNote, lot: prod.lot, exp: prod.exp });
      if (!state.inboundLogs) state.inboundLogs = [];
      state.inboundLogs.unshift(logEntry);
      await syncFromServer(false);
      showToast(`📥 นำเข้าสต็อก "${prod.name}" +${qty} ${prod.unit || "ชิ้น"} เรียบร้อย`, "success");
    } catch (err) {
      showToast("นำเข้าสต็อกไม่สำเร็จ: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function adjustProductStock(productId, delta, type, reason) {
    if (busy) return;
    const prod = findProduct(productId);
    if (!prod) return;
    const prevStock = prod.stock;
    const newStock = Math.max(0, prevStock + delta);
    const nowTs = new Date().toLocaleString("th-TH");

    const logEntry = {
      id: "adj_" + Date.now(),
      productId: productId,
      productName: prod.name,
      delta: delta,
      prevStock: prevStock,
      newStock: newStock,
      type: type,
      reason: reason || "ปรับยอดสต็อก",
      ts: nowTs
    };

    if (!isApiConfigured()) {
      prod.stock = newStock;
      if (!state.adjustmentLogs) state.adjustmentLogs = [];
      state.adjustmentLogs.unshift(logEntry);
      save();
      showToast(`⚖️ ปรับยอด "${prod.name}" เป็น ${newStock} ${prod.unit || "ชิ้น"} เรียบร้อย`, "success");
      render();
      return;
    }

    setBusy(true);
    try {
      await apiPost("adjustStock", { productId, delta, reason });
      if (!state.adjustmentLogs) state.adjustmentLogs = [];
      state.adjustmentLogs.unshift(logEntry);
      await syncFromServer(false);
      showToast(`⚖️ ปรับยอด "${prod.name}" ใน Google Sheet เรียบร้อย`, "success");
    } catch (err) {
      showToast("ปรับยอดไม่สำเร็จ: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function addNewProduct(name, cat, unit, initialStock, cost, price, minStock, lot, exp) {
    if (busy) return;
    let maxIdNum = 0;
    (state.products || []).forEach(p => {
      const match = p.id && p.id.match(/^p(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIdNum) maxIdNum = num;
      }
    });
    const id = "p" + (maxIdNum + 1);
    const stock = Math.max(0, Math.floor(Number(initialStock) || 0));
    const newProd = {
      id,
      name,
      cat,
      unit: unit || "ชิ้น",
      stock,
      cost: cost || 0,
      price: price || 0,
      minStock: minStock || 10,
      lot: lot || ("LOT-24" + Math.floor(10 + Math.random() * 90)),
      exp: exp || "2027-12-31"
    };

    if (!isApiConfigured()) {
      state.products.push(newProd);
      if (stock > 0) {
        if (!state.inboundLogs) state.inboundLogs = [];
        state.inboundLogs.unshift({
          id: "in_" + Date.now(),
          productId: id,
          productName: name,
          qty: stock,
          prevStock: 0,
          newStock: stock,
          lot: newProd.lot,
          exp: newProd.exp,
          note: "สร้างสินค้าใหม่และนำเข้าสต็อกเริ่มต้น",
          ts: new Date().toLocaleString("th-TH")
        });
      }
      save();
      showToast(`➕ เพิ่มสินค้าใหม่ "${name}" (สต็อก: ${stock} ${unit}) เรียบร้อย`, "success");
      render();
      return;
    }

    setBusy(true);
    try {
      await apiPost("addProduct", newProd);
      if (stock > 0) {
        if (!state.inboundLogs) state.inboundLogs = [];
        state.inboundLogs.unshift({
          id: "in_" + Date.now(),
          productId: id,
          productName: name,
          qty: stock,
          prevStock: 0,
          newStock: stock,
          lot: newProd.lot,
          exp: newProd.exp,
          note: "สร้างสินค้าใหม่และนำเข้าสต็อกเริ่มต้น",
          ts: new Date().toLocaleString("th-TH")
        });
      }
      await syncFromServer(false);
      showToast(`➕ เพิ่มสินค้าใหม่ "${name}" ในระบบเรียบร้อย`, "success");
    } catch (err) {
      showToast("เพิ่มสินค้าใหม่ไม่สำเร็จ: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function receiveShipment(reqId) {
    if (busy) return;
    const r = state.requests.find(x => x.id === reqId);
    if (!r) return;
    const prod = findProduct(r.productId);
    const branch = r.branch;
    const branchName = branchLabel(branch);
    const nowTs = new Date().toLocaleString("th-TH");

    setBusy(true);
    try {
      if (isApiConfigured()) {
        await apiPost("receiveAtBranch", { id: reqId, receivedTs: nowTs });
      }
      r.status = "received";
      r.receivedTs = nowTs;
      if (!state.branchStocks) state.branchStocks = {};
      if (!state.branchStocks[branch]) state.branchStocks[branch] = {};
      const cur = state.branchStocks[branch][r.productId] || 0;
      state.branchStocks[branch][r.productId] = cur + r.qty;
      save();
      showToast(`📦 ตรวจรับสินค้า "${prod ? prod.name : r.productId}" +${r.qty} ${prod ? prod.unit : 'ชิ้น'} เข้า ${branchName} เรียบร้อย!`, "success");
      render();
    } catch (err) {
      showToast("ตรวจรับสินค้าไม่สำเร็จ: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function recordBranchSale(branch, productId, qty, note) {
    if (busy) return;
    const prod = findProduct(productId);
    if (!prod) return;
    if (!state.branchStocks) state.branchStocks = {};
    if (!state.branchStocks[branch]) state.branchStocks[branch] = {};
    const cur = state.branchStocks[branch][productId] || 0;
    if (cur < qty) {
      showToast(`สต็อกหน้าร้านไม่พอตัดขาย (มีคงเหลือ ${cur} ${prod.unit || "ชิ้น"})`, "error");
      return;
    }

    state.branchStocks[branch][productId] = cur - qty;
    const totalRev = qty * (prod.price || 0);
    const saleLog = {
      id: "sale_" + Date.now(),
      branch: branch,
      productId: productId,
      productName: prod.name,
      qty: qty,
      price: prod.price || 0,
      total: totalRev,
      note: note || "ขายหน้าร้าน",
      ts: new Date().toLocaleString("th-TH")
    };
    if (!state.branchSalesLogs) state.branchSalesLogs = [];
    state.branchSalesLogs.unshift(saleLog);
    save();
    showToast(`🛒 บันทึกขาย "${prod.name}" x${qty} (฿${totalRev.toLocaleString()}) เรียบร้อย`, "success");
    render();
  }

  function openDrawer(mode, productId) {
    const backdrop = document.getElementById("drawerBackdrop");
    const iconEl = document.getElementById("drawerIcon");
    const titleEl = document.getElementById("drawerTitle");
    const subEl = document.getElementById("drawerSubtitle");
    const bodyEl = document.getElementById("drawerBody");
    if (!backdrop || !bodyEl) return;

    drawerState.isOpen = true;
    drawerState.mode = mode;
    drawerState.productId = productId || (state.products[0] ? state.products[0].id : null);

    const prod = findProduct(drawerState.productId);

    if (mode === "stockIn") {
      iconEl.textContent = "📥";
      titleEl.textContent = "นำเข้าสต็อกสินค้า (Stock In)";
      subEl.textContent = "บันทึกรับสินค้าเข้าคลังกลาง พร้อมระบุล็อตและวันหมดอายุ";

      bodyEl.innerHTML = `
        <form id="drawerForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label" for="drawerProdSelect">เลือกสินค้า <span class="required-mark">*</span></label>
            <select id="drawerProdSelect" class="form-select">
              ${state.products.map(p => `
                <option value="${p.id}" ${p.id === drawerState.productId ? "selected" : ""}>
                  [${p.id}] ${p.name} (คงเหลือ: ${p.stock} ${p.unit || "ชิ้น"})
                </option>
              `).join("")}
            </select>
          </div>

          <div class="stock-calc-preview">
            <div class="calc-card">
              <span class="calc-label">สต็อกเดิม</span>
              <span class="calc-val" id="drawerCurStock">${prod ? prod.stock : 0}</span>
            </div>
            <div class="calc-op">+</div>
            <div class="calc-card highlight">
              <span class="calc-label">นำเข้าเพิ่ม</span>
              <span class="calc-val text-primary" id="drawerAddPreview">+10</span>
            </div>
            <div class="calc-op">=</div>
            <div class="calc-card total">
              <span class="calc-label">สต็อกใหม่สุทธิ</span>
              <span class="calc-val text-success" id="drawerNewPreview">${(prod ? prod.stock : 0) + 10}</span>
            </div>
          </div>

          <div class="form-group" style="margin-top:14px;">
            <label class="form-label" for="drawerQtyInput">จำนวนนำเข้า <span class="required-mark">*</span></label>
            <input type="number" id="drawerQtyInput" class="form-input" min="1" step="1" value="10" required>
            <div class="quick-qty-chips" id="drawerChips">
              <span class="chip-label">เพิ่มด่วน:</span>
              <button type="button" class="chip-btn" data-add="10">+10</button>
              <button type="button" class="chip-btn" data-add="25">+25</button>
              <button type="button" class="chip-btn" data-add="50">+50</button>
              <button type="button" class="chip-btn" data-add="100">+100</button>
              <button type="button" class="chip-btn" data-add="500">+500</button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
            <div class="form-group">
              <label class="form-label" for="drawerLotInput">เลขล็อตผลิต (Lot No.)</label>
              <input type="text" id="drawerLotInput" class="form-input" value="${prod && prod.lot ? prod.lot : 'LOT-24' + Math.floor(10 + Math.random() * 90)}">
            </div>
            <div class="form-group">
              <label class="form-label" for="drawerExpInput">วันหมดอายุ (EXP)</label>
              <input type="date" id="drawerExpInput" class="form-input" value="${prod && prod.exp ? prod.exp : '2027-12-31'}">
            </div>
          </div>

          <div class="form-group" style="margin-top:14px;">
            <label class="form-label" for="drawerRefInput">เลขอ้างอิง / ผู้จัดส่ง (PO / Supplier)</label>
            <input type="text" id="drawerRefInput" class="form-input" placeholder="เช่น PO-6702, บ.สยามเพ็ทจำกัด">
          </div>

          <div class="drawer-footer" style="margin-top:24px;">
            <button type="button" class="btn btn-secondary" onclick="window.__closeDrawer()">ยกเลิก</button>
            <button type="button" id="drawerSubmitBtn" class="btn btn-primary"><span>📥 ยืนยันนำเข้าสต็อก</span></button>
          </div>
        </form>
      `;

      const sel = document.getElementById("drawerProdSelect");
      const qtyIn = document.getElementById("drawerQtyInput");
      function updateInPreview() {
        const p = findProduct(sel.value);
        const cur = p ? p.stock : 0;
        const add = Math.max(1, parseInt(qtyIn.value, 10) || 1);
        const curEl = document.getElementById("drawerCurStock");
        const addEl = document.getElementById("drawerAddPreview");
        const newEl = document.getElementById("drawerNewPreview");
        if (curEl) curEl.textContent = `${cur} ${p ? p.unit : ''}`;
        if (addEl) addEl.textContent = `+${add} ${p ? p.unit : ''}`;
        if (newEl) newEl.textContent = `${cur + add} ${p ? p.unit : ''}`;
      }
      if (sel) sel.onchange = updateInPreview;
      if (qtyIn) qtyIn.oninput = updateInPreview;
      document.querySelectorAll("#drawerChips [data-add]").forEach(btn => {
        btn.onclick = () => {
          const add = parseInt(btn.dataset.add, 10);
          const current = parseInt(qtyIn.value, 10) || 0;
          qtyIn.value = Math.max(1, current + add);
          updateInPreview();
        };
      });

      const submitBtn = document.getElementById("drawerSubmitBtn");
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const pId = sel.value;
          const qty = parseInt(qtyIn.value, 10);
          const lot = document.getElementById("drawerLotInput").value.trim();
          const exp = document.getElementById("drawerExpInput").value.trim();
          const ref = document.getElementById("drawerRefInput").value.trim();
          if (!pId || isNaN(qty) || qty <= 0) {
            showToast("กรุณาระบุจำนวนนำเข้าที่ถูกต้อง", "warning");
            return;
          }
          closeDrawer();
          await restockProduct(pId, qty, ref, lot, exp);
        };
      }
    } else if (mode === "adjust") {
      iconEl.textContent = "⚖️";
      titleEl.textContent = "ปรับยอดสต็อก / ตัดชำรุด (Stock Adjust)";
      subEl.textContent = "ปรับปรุงยอดจากการตรวจนับ สินค้าแตกหัก หรือหมดอายุ";

      bodyEl.innerHTML = `
        <form id="drawerForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label" for="drawerProdSelect">เลือกสินค้าที่ต้องการปรับปรุง <span class="required-mark">*</span></label>
            <select id="drawerProdSelect" class="form-select">
              ${state.products.map(p => `
                <option value="${p.id}" ${p.id === drawerState.productId ? "selected" : ""}>
                  [${p.id}] ${p.name} (คงเหลือปัจจุบัน: ${p.stock} ${p.unit || "ชิ้น"})
                </option>
              `).join("")}
            </select>
          </div>

          <div class="form-group" style="margin-top:14px;">
            <label class="form-label">ประเภทการปรับยอด <span class="required-mark">*</span></label>
            <select id="drawerAdjType" class="form-select">
              <option value="damage">📦 สินค้าชำรุด / แตกหัก / เสียหาย (- ลดยอด)</option>
              <option value="expired">⌛ สินค้าหมดอายุ / เสื่อมสภาพ (- ลดยอด)</option>
              <option value="count_diff">📋 ผลต่างตรวจนับสต็อกจริง (+ หรือ -)</option>
              <option value="other">ℹ️ ปรับปรุงอื่นๆ</option>
            </select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 2fr; gap:12px; margin-top:14px;">
            <div class="form-group">
              <label class="form-label" for="drawerAdjDirection">ทิศทาง</label>
              <select id="drawerAdjDirection" class="form-select">
                <option value="-1">ลดยอด (-)</option>
                <option value="1">เพิ่มยอด (+)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="drawerAdjQty">จำนวนที่ปรับปรุง <span class="required-mark">*</span></label>
              <input type="number" id="drawerAdjQty" class="form-input" min="1" step="1" value="1" required>
            </div>
          </div>

          <div class="stock-calc-preview" style="margin-top:14px;">
            <div class="calc-card">
              <span class="calc-label">สต็อกเดิม</span>
              <span class="calc-val" id="drawerCurStock">${prod ? prod.stock : 0}</span>
            </div>
            <div class="calc-op">➔</div>
            <div class="calc-card highlight">
              <span class="calc-label">ปรับปรุง</span>
              <span class="calc-val text-warning" id="drawerAdjPreview">-1</span>
            </div>
            <div class="calc-op">➔</div>
            <div class="calc-card total">
              <span class="calc-label">สต็อกใหม่สุทธิ</span>
              <span class="calc-val text-primary" id="drawerNewPreview">${Math.max(0, (prod ? prod.stock : 0) - 1)}</span>
            </div>
          </div>

          <div class="form-group" style="margin-top:14px;">
            <label class="form-label" for="drawerAdjReason">เหตุผล / รายละเอียดบันทึก <span class="required-mark">*</span></label>
            <input type="text" id="drawerAdjReason" class="form-input" placeholder="เช่น ถุงฉีกขาดขณะขนย้าย, นับสต็อกประจำงวด" required>
          </div>

          <div class="drawer-footer" style="margin-top:24px;">
            <button type="button" class="btn btn-secondary" onclick="window.__closeDrawer()">ยกเลิก</button>
            <button type="button" id="drawerSubmitBtn" class="btn btn-primary"><span>⚖️ บันทึกการปรับยอด</span></button>
          </div>
        </form>
      `;

      const sel = document.getElementById("drawerProdSelect");
      const dirSel = document.getElementById("drawerAdjDirection");
      const qtyIn = document.getElementById("drawerAdjQty");
      const typeSel = document.getElementById("drawerAdjType");

      function updateAdjPreview() {
        const p = findProduct(sel.value);
        const cur = p ? p.stock : 0;
        const dir = parseInt(dirSel.value, 10);
        const qty = Math.max(1, parseInt(qtyIn.value, 10) || 1);
        const delta = dir * qty;
        const nextStock = Math.max(0, cur + delta);

        const curEl = document.getElementById("drawerCurStock");
        const adjEl = document.getElementById("drawerAdjPreview");
        const newEl = document.getElementById("drawerNewPreview");
        if (curEl) curEl.textContent = `${cur} ${p ? p.unit : ''}`;
        if (adjEl) adjEl.textContent = `${delta > 0 ? '+' : ''}${delta} ${p ? p.unit : ''}`;
        if (newEl) newEl.textContent = `${nextStock} ${p ? p.unit : ''}`;
      }

      if (typeSel) {
        typeSel.onchange = () => {
          if (typeSel.value === "damage" || typeSel.value === "expired") {
            dirSel.value = "-1";
          }
          updateAdjPreview();
        };
      }
      if (sel) sel.onchange = updateAdjPreview;
      if (dirSel) dirSel.onchange = updateAdjPreview;
      if (qtyIn) qtyIn.oninput = updateAdjPreview;

      const submitBtn = document.getElementById("drawerSubmitBtn");
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const pId = sel.value;
          const dir = parseInt(dirSel.value, 10);
          const qty = parseInt(qtyIn.value, 10);
          const delta = dir * qty;
          const reason = document.getElementById("drawerAdjReason").value.trim() || typeSel.options[typeSel.selectedIndex].text;
          closeDrawer();
          await adjustProductStock(pId, delta, typeSel.value, reason);
        };
      }
    } else if (mode === "addProduct") {
      iconEl.textContent = "➕";
      titleEl.textContent = "เพิ่มสินค้าใหม่ (Add New SKU)";
      subEl.textContent = "กำหนดรายการสินค้าใหม่เข้าสู่ระบบ พร้อมต้นทุน ราคาขาย และจุดสั่งซื้อซ้ำ";

      bodyEl.innerHTML = `
        <form id="drawerForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label" for="newProdName">ชื่อสินค้า <span class="required-mark">*</span></label>
            <input type="text" id="newProdName" class="form-input" placeholder="เช่น อาหารสุนัขพันธุ์เล็ก รสเนื้อ 3kg" required>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
            <div class="form-group">
              <label class="form-label" for="newProdCat">หมวดหมู่ <span class="required-mark">*</span></label>
              <input type="text" id="newProdCat" class="form-input" placeholder="เช่น อาหารหมา" list="catDatalist" required>
              <datalist id="catDatalist">${getCategories().map(c => `<option value="${c}">`).join("")}</datalist>
            </div>
            <div class="form-group">
              <label class="form-label" for="newProdUnit">หน่วยนับ <span class="required-mark">*</span></label>
              <input type="text" id="newProdUnit" class="form-input" placeholder="เช่น ถุง, กล่อง, ชิ้น" value="ถุง" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
            <div class="form-group">
              <label class="form-label" for="newProdCost">ราคาต้นทุน (บาท) <span class="required-mark">*</span></label>
              <input type="number" id="newProdCost" class="form-input" min="0" step="1" value="250" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="newProdPrice">ราคาจำหน่าย (บาท) <span class="required-mark">*</span></label>
              <input type="number" id="newProdPrice" class="form-input" min="0" step="1" value="390" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
            <div class="form-group">
              <label class="form-label" for="newProdStock">สต็อกเริ่มต้นนำเข้า <span class="required-mark">*</span></label>
              <input type="number" id="newProdStock" class="form-input" min="0" step="1" value="20" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="newProdMinStock">จุดสั่งซื้อซ้ำขั้นต่ำ (Safety Stock)</label>
              <input type="number" id="newProdMinStock" class="form-input" min="1" step="1" value="10">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
            <div class="form-group">
              <label class="form-label" for="newProdLot">เลขล็อต (Lot No.)</label>
              <input type="text" id="newProdLot" class="form-input" value="LOT-24${Math.floor(10 + Math.random() * 90)}">
            </div>
            <div class="form-group">
              <label class="form-label" for="newProdExp">วันหมดอายุ (EXP)</label>
              <input type="date" id="newProdExp" class="form-input" value="2027-12-31">
            </div>
          </div>

          <div class="drawer-footer" style="margin-top:24px;">
            <button type="button" class="btn btn-secondary" onclick="window.__closeDrawer()">ยกเลิก</button>
            <button type="button" id="drawerSubmitBtn" class="btn btn-primary"><span>➕ บันทึกสินค้าใหม่</span></button>
          </div>
        </form>
      `;

      const submitBtn = document.getElementById("drawerSubmitBtn");
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const name = document.getElementById("newProdName").value.trim();
          const cat = document.getElementById("newProdCat").value.trim();
          const unit = document.getElementById("newProdUnit").value.trim() || "ชิ้น";
          const cost = Number(document.getElementById("newProdCost").value) || 0;
          const price = Number(document.getElementById("newProdPrice").value) || 0;
          const stock = Number(document.getElementById("newProdStock").value) || 0;
          const minStock = Number(document.getElementById("newProdMinStock").value) || 10;
          const lot = document.getElementById("newProdLot").value.trim();
          const exp = document.getElementById("newProdExp").value.trim();

          if (!name || !cat) {
            showToast("กรุณากรอกชื่อและหมวดหมู่สินค้าให้ครบถ้วน", "warning");
            return;
          }
          closeDrawer();
          await addNewProduct(name, cat, unit, stock, cost, price, minStock, lot, exp);
        };
      }
    } else if (mode === "branchSale") {
      const branch = state.role;
      const bStocks = (state.branchStocks && state.branchStocks[branch]) || {};

      iconEl.textContent = "🛒";
      titleEl.textContent = `บันทึกขายหน้าร้าน (${branchLabel(branch)})`;
      subEl.textContent = "ตัดสต็อกหน้าร้านสาขาและบันทึกยอดขายสินค้า";

      bodyEl.innerHTML = `
        <form id="drawerForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label" for="saleProdSelect">เลือกสินค้าที่ขาย <span class="required-mark">*</span></label>
            <select id="saleProdSelect" class="form-select">
              ${state.products.map(p => {
                const onHand = bStocks[p.id] || 0;
                return `
                  <option value="${p.id}" ${p.id === drawerState.productId ? "selected" : ""} ${onHand <= 0 ? "disabled" : ""}>
                    ${p.name} (หน้าร้านมี: ${onHand} ${p.unit} | ราคา ฿${p.price || 0})
                  </option>
                `;
              }).join("")}
            </select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
            <div class="form-group">
              <label class="form-label" for="saleQtyInput">จำนวนที่ขาย <span class="required-mark">*</span></label>
              <input type="number" id="saleQtyInput" class="form-input" min="1" step="1" value="1" required>
            </div>
            <div class="form-group">
              <label class="form-label">ราคาต่อหน่วย</label>
              <input type="text" id="salePriceDisplay" class="form-input" readonly value="${prod ? '฿' + (prod.price || 0) : '฿0'}">
            </div>
          </div>

          <div class="stock-calc-preview" style="margin-top:14px;">
            <div class="calc-card">
              <span class="calc-label">สต็อกหน้าร้านเดิม</span>
              <span class="calc-val" id="saleCurStock">${prod ? (bStocks[prod.id] || 0) : 0}</span>
            </div>
            <div class="calc-op">➔</div>
            <div class="calc-card highlight">
              <span class="calc-label">ตัดขาย</span>
              <span class="calc-val text-primary" id="saleCutQty">-1</span>
            </div>
            <div class="calc-op">➔</div>
            <div class="calc-card total">
              <span class="calc-label">รวมเงินที่ได้รับ</span>
              <span class="calc-val text-success" id="saleTotalRevenue">฿${prod ? (prod.price || 0).toLocaleString() : 0}</span>
            </div>
          </div>

          <div class="form-group" style="margin-top:14px;">
            <label class="form-label" for="saleNoteInput">บันทึกการขาย / ลูกค้า (ไม่บังคับ)</label>
            <input type="text" id="saleNoteInput" class="form-input" placeholder="เช่น ลูกค้าเงินสด / สแกนจ่าย PromptPay">
          </div>

          <div class="drawer-footer" style="margin-top:24px;">
            <button type="button" class="btn btn-secondary" onclick="window.__closeDrawer()">ยกเลิก</button>
            <button type="button" id="drawerSubmitBtn" class="btn btn-primary"><span>🛒 บันทึกตัดสต็อกขาย</span></button>
          </div>
        </form>
      `;

      const sel = document.getElementById("saleProdSelect");
      const qtyIn = document.getElementById("saleQtyInput");
      const priceDisp = document.getElementById("salePriceDisplay");

      function updateSalePreview() {
        const p = findProduct(sel.value);
        const onHand = p && state.branchStocks && state.branchStocks[branch] ? (state.branchStocks[branch][p.id] || 0) : 0;
        const qty = Math.max(1, parseInt(qtyIn.value, 10) || 1);
        const price = p ? (p.price || 0) : 0;
        const total = qty * price;

        if (priceDisp) priceDisp.value = `฿${price.toLocaleString()}`;
        const curEl = document.getElementById("saleCurStock");
        const cutEl = document.getElementById("saleCutQty");
        const revEl = document.getElementById("saleTotalRevenue");
        if (curEl) curEl.textContent = `${onHand} ${p ? p.unit : ''}`;
        if (cutEl) cutEl.textContent = `-${qty} ${p ? p.unit : ''}`;
        if (revEl) revEl.textContent = `฿${total.toLocaleString()}`;
      }

      if (sel) sel.onchange = updateSalePreview;
      if (qtyIn) qtyIn.oninput = updateSalePreview;

      const submitBtn = document.getElementById("drawerSubmitBtn");
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const pId = sel.value;
          const qty = parseInt(qtyIn.value, 10);
          const note = document.getElementById("saleNoteInput").value.trim();
          closeDrawer();
          await recordBranchSale(branch, pId, qty, note);
        };
      }
    }

    backdrop.classList.remove("hidden");
  }

  function closeDrawer() {
    const backdrop = document.getElementById("drawerBackdrop");
    if (backdrop) backdrop.classList.add("hidden");
    drawerState.isOpen = false;
  }
  window.__closeDrawer = closeDrawer;

  function initDrawer() {
    const backdrop = document.getElementById("drawerBackdrop");
    const closeBtn = document.getElementById("closeDrawerBtn");
    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) closeDrawer();
      };
    }
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerState.isOpen) {
        closeDrawer();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const s = document.getElementById("searchInput") || document.getElementById("branchSearchInput");
        if (s) { s.focus(); s.select(); }
      }
    });
  }

  // --- Reset Demo Data ---
  function initResetButton() {
    const resetBtn = document.getElementById("resetDataBtn");
    if (!resetBtn) return;
    resetBtn.onclick = () => {
      showModal(
        "รีเซ็ตข้อมูลระบบ",
        isApiConfigured()
          ? "คุณต้องการรีเซ็ตสต็อกสินค้าและประวัติคำขอใน Google Sheet กลับเป็นค่าเริ่มต้นหรือไม่?<br><span style='color:var(--text-muted); font-size:0.82rem;'>* มีผลกับทุกสาขาที่เชื่อมต่ออยู่ ณ ขณะนี้</span>"
          : "คุณต้องการรีเซ็ตสต็อกสินค้าและประวัติคำขอทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่? (โหมดออฟไลน์)<br><span style='color:var(--text-muted); font-size:0.82rem;'>* ข้อมูลคำขอที่บันทึกไว้ในเบราว์เซอร์จะถูกล้าง</span>",
        async () => {
          if (!isApiConfigured()) {
            state = { ...defaultState(), role: state.role };
            save();
            showToast("รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว (โหมดออฟไลน์)", "success");
            render();
            return;
          }
          setBusy(true);
          try {
            await apiPost("reset", {});
            await syncFromServer(false);
            showToast("รีเซ็ตข้อมูลใน Google Sheet เรียบร้อยแล้ว", "success");
          } catch (err) {
            showToast("รีเซ็ตไม่สำเร็จ: " + err.message, "error");
          } finally {
            setBusy(false);
          }
        },
        "รีเซ็ตข้อมูล",
        "btn-danger"
      );
    };
  }

  // --- Multi-Tab Synchronization ---
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      try {
        state = load();
        render();
        showToast("ข้อมูลสต็อกและคำขอได้รับการอัปเดตจากแท็บอื่น", "info");
      } catch (err) {
        console.error(err);
      }
    }
  });

  // --- Role Navigation Bar ---
  function renderRoleNav() {
    const nav = document.getElementById("roleNav");
    if (!nav) return;
    nav.innerHTML = "";

    const pendingCount = state.requests.filter(r => r.status === "pending").length;

    ROLES.forEach(([id, label, icon]) => {
      const b = document.createElement("button");
      b.className = "role-btn";
      b.setAttribute("aria-pressed", state.role === id ? "true" : "false");

      let badgeHtml = "";
      if (id === "central" && pendingCount > 0) {
        badgeHtml = `<span class="role-btn-badge" title="มีคำขอรออนุมัติ ${pendingCount} รายการ">${pendingCount}</span>`;
      } else if (id !== "central") {
        const branchPending = state.requests.filter(r => r.branch === id && r.status === "pending").length;
        if (branchPending > 0) {
          badgeHtml = `<span class="role-btn-badge" style="background:var(--warning); color:#fff;" title="รออนุมัติ ${branchPending} รายการ">${branchPending}</span>`;
        }
      }

      b.innerHTML = `<span>${icon}</span> <span>${label}</span> ${badgeHtml}`;
      b.onclick = () => {
        if (state.role !== id) {
          state.role = id;
          save();
          render();
        }
      };
      nav.appendChild(b);
    });
  }

  // --- View: Central Warehouse ---
  function renderCentral() {
    const main = document.getElementById("app");
    const pending = state.requests.filter(r => r.status === "pending");
    const history = state.requests.filter(r => r.status !== "pending").slice(0, 20);
    const inboundLogs = (state.inboundLogs || []).slice(0, 20);
    const adjustmentLogs = (state.adjustmentLogs || []).slice(0, 20);

    const totalSkus = state.products.length;
    const inStockProducts = state.products.filter(p => p.stock > 0);
    const inStockCount = inStockProducts.length;
    const totalUnitsInStock = inStockProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalValuation = state.products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0);
    const reorderCount = state.products.filter(p => p.stock <= (p.minStock || 10)).length;
    const nearExpCount = state.products.filter(p => {
      const days = getDaysUntilExp(p.exp);
      return days !== null && days <= 90;
    }).length;
    const outOfStockCount = state.products.filter(p => p.stock <= 0).length;

    // Filter products by search query, category, and stock status
    const filteredProducts = state.products.filter(p => {
      const q = (uiState.searchQuery || "").toLowerCase();
      const matchQuery = !q || 
        p.name.toLowerCase().includes(q) ||
        p.cat.toLowerCase().includes(q) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.lot && p.lot.toLowerCase().includes(q));
      const matchCat = uiState.selectedCategory === "all" || p.cat === uiState.selectedCategory;

      let matchStock = true;
      if (uiState.stockFilter === "in_stock") {
        matchStock = p.stock > 0;
      } else if (uiState.stockFilter === "reorder") {
        matchStock = p.stock <= (p.minStock || 10);
      } else if (uiState.stockFilter === "near_exp") {
        const days = getDaysUntilExp(p.exp);
        matchStock = days !== null && days <= 90;
      } else if (uiState.stockFilter === "out_of_stock") {
        matchStock = p.stock <= 0;
      }

      return matchQuery && matchCat && matchStock;
    });

    const categories = getCategories();

    // Stock Rows
    const stockRows = filteredProducts.length ? filteredProducts.map(p => {
      const isOut = p.stock <= 0;
      const isReorder = p.stock <= (p.minStock || 10);
      const percent = Math.min(100, Math.round((p.stock / 50) * 100));
      const fillClass = isOut ? "critical" : isReorder ? "warning" : "safe";
      const daysLeft = getDaysUntilExp(p.exp);

      let expBadgeHtml = "";
      if (p.exp) {
        if (daysLeft !== null && daysLeft <= 0) {
          expBadgeHtml = `<span class="badge-exp-warn">❌ หมดอายุแล้ว</span>`;
        } else if (daysLeft !== null && daysLeft <= 90) {
          expBadgeHtml = `<span class="badge-exp-warn">⌛ เหลือ ${daysLeft} วัน</span>`;
        } else {
          expBadgeHtml = `<span style="font-size:0.75rem; color:var(--text-muted);">${p.exp}</span>`;
        }
      } else {
        expBadgeHtml = `<span style="font-size:0.75rem; color:var(--text-subtle);">-</span>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--text-main);">${p.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; gap:6px; align-items:center; margin-top:2px;">
              <span>รหัส: ${p.id}</span>
              ${p.lot ? `<span class="badge-lot">${p.lot}</span>` : ""}
            </div>
          </td>
          <td><span class="category-tag">${p.cat}</span></td>
          <td class="qty">
            <div class="stock-status-cell">
              ${stockBadge(p.stock)}
              <div class="stock-health-bar" title="ระดับสต็อก: ${p.stock}">
                <div class="stock-health-fill ${fillClass}" style="width:${Math.max(6, percent)}%;"></div>
              </div>
            </div>
          </td>
          <td>
            <div>${expBadgeHtml}</div>
          </td>
          <td class="qty">
            <span class="stock-val-num ${isOut ? 'text-danger' : isReorder ? 'text-warning' : 'text-success'}">${p.stock}</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">/ min ${p.minStock || 10} ${p.unit || "ชิ้น"}</span>
            ${isReorder && !isOut ? `<div style="margin-top:2px;"><span class="badge-reorder-warn">⚠️ จุดสั่งซื้อ</span></div>` : ""}
          </td>
          <td>
            <div class="price-pill">ทุน: <strong>฿${(p.cost || 0).toLocaleString()}</strong></div>
            <div class="price-pill">ขาย: <strong>฿${(p.price || 0).toLocaleString()}</strong></div>
          </td>
          <td class="actions-cell">
            <button class="btn btn-primary btn-sm btn-table-action" data-open-stockin="${p.id}" title="นำเข้าสต็อกสินค้านี้">
              📥 นำเข้า
            </button>
            <button class="btn btn-secondary btn-sm btn-table-action" data-open-adjust="${p.id}" title="ปรับยอดหรือตัดชำรุด">
              ⚖️ ปรับยอด
            </button>
            <button class="btn btn-secondary btn-sm" data-restock="${p.id}" data-qty="10" title="เพิ่มด่วน +10">+10</button>
            <button class="btn btn-secondary btn-sm" data-restock="${p.id}" data-qty="50" title="เพิ่มด่วน +50">+50</button>
          </td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">ไม่พบรายการสินค้าตามเงื่อนไขที่เลือก</div>
          <div class="empty-sub">ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองสถานะสต็อก/หมวดหมู่อื่น</div>
        </td>
      </tr>
    `;

    // Pending Requests Rows
    const pendingRows = pending.length ? pending.map(r => {
      const p = findProduct(r.productId);
      const enough = p && p.stock >= r.qty;
      return `
        <tr>
          <td><strong>${branchLabel(r.branch)}</strong></td>
          <td>
            <div style="font-weight:600;">${p ? p.name : `<span style="color:var(--danger)">ไม่พบสินค้า (${r.productId})</span>`}</div>
            ${r.note ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">💬 ${r.note}</div>` : ""}
          </td>
          <td class="qty" style="font-size:1.05rem; color:var(--primary); font-weight:700;">${r.qty} ${p ? (p.unit || "ชิ้น") : ""}</td>
          <td class="qty">${p ? stockBadge(p.stock) : "-"}</td>
          <td style="font-size:0.82rem; color:var(--text-muted); white-space:nowrap;">${formatTime(r.ts)}</td>
          <td class="actions-cell">
            <button class="btn btn-success btn-sm" data-approve="${r.id}" ${enough ? "" : "disabled"} title="${enough ? "ตัดสต็อกและอนุมัติเพื่อจัดส่งให้สาขา" : "สต็อกในคลังไม่พอ"}">
              ✓ อนุมัติจัดส่ง
            </button>
            <button class="btn btn-danger btn-sm" data-reject="${r.id}" title="ปฏิเสธคำขอ">
              ✕ ปฏิเสธ
            </button>
          </td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-icon">✨</div>
          <div class="empty-title">ไม่มีคำขอรออนุมัติ</div>
          <div class="empty-sub">เมื่อสาขาส่งคำขอเบิกสินค้า รายการจะปรากฏที่นี่ทันที</div>
        </td>
      </tr>
    `;

    // History Dispatches Rows (เบิกจ่าย)
    const historyRows = history.length ? history.map(r => {
      const p = findProduct(r.productId);
      return `
        <tr>
          <td>${branchLabel(r.branch)}</td>
          <td>
            <div style="font-weight:500;">${p ? p.name : r.productId}</div>
            ${r.note ? `<div style="font-size:0.75rem; color:var(--text-muted);">💬 ${r.note}</div>` : ""}
          </td>
          <td class="qty">${r.qty} ${p ? (p.unit || "ชิ้น") : ""}</td>
          <td>
            ${r.status === 'received' 
              ? `<span class="badge approved">✓ สาขาตรวจรับแล้ว</span>` 
              : statusTag(r.status)}
          </td>
          <td style="font-size:0.82rem; color:var(--text-muted);">${formatTime(r.decisionTs || r.ts)}</td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">ยังไม่มีประวัติการอนุมัติคำขอเบิก</div>
          <div class="empty-sub">ประวัติการอนุมัติหรือปฏิเสธคำขอจะแสดงที่นี่</div>
        </td>
      </tr>
    `;

    // Inbound Logs Rows (ประวัตินำเข้าสต็อก)
    const inboundRows = inboundLogs.length ? inboundLogs.map(log => {
      return `
        <tr>
          <td style="font-size:0.82rem; color:var(--text-muted);">${formatTime(log.ts)}</td>
          <td>
            <div style="font-weight:600;">${log.productName || log.productId}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">รหัส: ${log.productId} ${log.lot ? `· ล็อต ${log.lot}` : ""}</div>
          </td>
          <td class="qty" style="color:var(--success); font-weight:700;">+${log.qty}</td>
          <td class="qty">
            <span style="color:var(--text-muted); font-size:0.82rem;">${log.prevStock}</span>
            <span style="color:var(--text-muted); font-size:0.75rem; margin:0 4px;">➔</span>
            <strong style="color:var(--text-main);">${log.newStock}</strong>
          </td>
          <td style="font-size:0.82rem; color:var(--text-muted);">${log.note || "-"}</td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon">📥</div>
          <div class="empty-title">ยังไม่มีประวัติการนำเข้าสต็อก</div>
          <div class="empty-sub">เมื่อบันทึกนำเข้าสินค้าเข้าคลังกลาง รายการจะแสดงที่นี่</div>
        </td>
      </tr>
    `;

    // Adjustment Logs Rows (ปรับยอดและตัดชำรุด)
    const adjustRows = adjustmentLogs.length ? adjustmentLogs.map(log => {
      return `
        <tr>
          <td style="font-size:0.82rem; color:var(--text-muted);">${formatTime(log.ts)}</td>
          <td>
            <div style="font-weight:600;">${log.productName || log.productId}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">รหัส: ${log.productId}</div>
          </td>
          <td class="qty" style="color:${log.delta >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">
            ${log.delta > 0 ? '+' : ''}${log.delta}
          </td>
          <td class="qty">
            <span style="color:var(--text-muted); font-size:0.82rem;">${log.prevStock}</span>
            <span style="color:var(--text-muted); font-size:0.75rem; margin:0 4px;">➔</span>
            <strong style="color:var(--text-main);">${log.newStock}</strong>
          </td>
          <td style="font-size:0.82rem; color:var(--text-muted);">${log.reason || "-"}</td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon">⚖️</div>
          <div class="empty-title">ยังไม่มีประวัติการปรับยอดสต็อก</div>
          <div class="empty-sub">เมื่อบันทึกปรับยอดหรือตัดสินค้าชำรุด รายการจะแสดงที่นี่</div>
        </td>
      </tr>
    `;

    main.innerHTML = `
      <!-- KPI Stats Bar (Central Analytics) -->
      <section class="kpi-grid">
        <div class="kpi-card green interactive ${uiState.stockFilter === 'in_stock' ? 'active-filter' : ''}" data-kpi-filter="in_stock" title="คลิกเพื่อกรองเฉพาะสินค้าที่มีสต็อกเหลือ">
          <div class="kpi-icon-wrap">🟢</div>
          <div class="kpi-meta">
            <span class="kpi-title">มีสต็อกพร้อมจ่าย</span>
            <span class="kpi-value">${inStockCount} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">รายการ</span></span>
            <span class="kpi-desc">คงเหลือรวม ${totalUnitsInStock.toLocaleString()} ชิ้น</span>
          </div>
        </div>

        <div class="kpi-card blue" title="มูลค่าสต็อกสินค้าคงคลังรวม (คำนวณจากราคาต้นทุน)">
          <div class="kpi-icon-wrap">💰</div>
          <div class="kpi-meta">
            <span class="kpi-title">มูลค่าคลังสินค้าคงคลัง</span>
            <span class="kpi-value" style="font-size:1.35rem;">฿${totalValuation.toLocaleString()}</span>
            <span class="kpi-desc">คำนวณจากต้นทุนสินค้า</span>
          </div>
        </div>

        <div class="kpi-card amber interactive ${uiState.stockFilter === 'reorder' ? 'active-filter' : ''}" data-kpi-filter="reorder" title="คลิกเพื่อกรองสินค้าที่สต็อกต่ำกว่าหรือเท่ากับจุดสั่งซื้อซ้ำ">
          <div class="kpi-icon-wrap">⚠️</div>
          <div class="kpi-meta">
            <span class="kpi-title">ถึงจุดสั่งซื้อซ้ำ (Reorder)</span>
            <span class="kpi-value">${reorderCount} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">รายการ</span></span>
            <span class="kpi-desc">สต็อก ≤ Safety Stock</span>
          </div>
        </div>

        <div class="kpi-card danger interactive ${uiState.stockFilter === 'near_exp' ? 'active-filter' : ''}" data-kpi-filter="near_exp" title="คลิกเพื่อกรองสินค้าที่หมดอายุภายใน 90 วัน">
          <div class="kpi-icon-wrap">⌛</div>
          <div class="kpi-meta">
            <span class="kpi-title">ใกล้หมดอายุ (ภายใน 90 วัน)</span>
            <span class="kpi-value">${nearExpCount} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">รายการ</span></span>
            <span class="kpi-desc">ต้องเร่งจัดส่งตาม FIFO</span>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon-wrap">📥</div>
          <div class="kpi-meta">
            <span class="kpi-title">คำขอนำส่งรออนุมัติ</span>
            <span class="kpi-value">${pending.length} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">คำขอ</span></span>
            <span class="kpi-desc">${pending.length > 0 ? "ต้องการการดำเนินการ" : "ดำเนินการครบถ้วน"}</span>
          </div>
        </div>
      </section>

      <!-- Section: Pending Requests -->
      <section class="card">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-icon">⏳</span>
            <div>
              <h2 class="card-title">คำขอเบิกรอการอนุมัติ</h2>
              <span class="card-subtitle">รายการที่สาขาส่งเข้ามา ต้องได้รับการตรวจสอบและอนุมัติก่อนตัดสต็อก</span>
            </div>
          </div>
          ${pending.length > 0 ? `<span class="badge pending"><span class="badge-dot"></span>รอการอนุมัติ ${pending.length} รายการ</span>` : ""}
        </div>
        <div class="card-body card-body-no-pad">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>สาขาที่ขอเบิก</th>
                  <th>สินค้า</th>
                  <th>จำนวนขอ</th>
                  <th>คงเหลือในคลัง</th>
                  <th>เวลาที่ส่งคำขอ</th>
                  <th style="min-width:170px;">การจัดการ</th>
                </tr>
              </thead>
              <tbody>${pendingRows}</tbody>
            </table>
          </div>
        </div>
        <div class="card-body" style="border-top:1px solid var(--border-subtle); padding:12px 20px;">
          <div class="info-note">
            <span>💡</span>
            <span>เมื่อกด "อนุมัติจัดส่ง" ระบบจะตัดยอดสต็อกในคลังกลาง และส่งรายการไปให้สาขากดตรวจรับเข้าหน้าร้าน</span>
          </div>
        </div>
      </section>

      <!-- Section: Central Inventory -->
      <section class="card">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-icon">📦</span>
            <div>
              <h2 class="card-title">สต็อกสินค้าคลังกลาง (Central Inventory)</h2>
              <span class="card-subtitle">ตรวจสอบจำนวนสินค้าคงคลัง ข้อมูลล็อต วันหมดอายุ และจัดการสต็อก</span>
            </div>
          </div>
          <div class="header-action-group">
            <button id="btnOpenStockInDrawer" class="btn btn-primary" title="บันทึกนำเข้าสต็อกสินค้าใหม่เข้าคลังกลาง">
              <span>📥 นำเข้าสต็อก (Stock In)</span>
            </button>
            <button id="btnOpenAdjustDrawer" class="btn btn-secondary" title="บันทึกปรับยอดสต็อก หรือตัดสินค้าชำรุด">
              <span>⚖️ ปรับยอด / ตัดชำรุด</span>
            </button>
            <button id="btnOpenAddProductDrawer" class="btn btn-outline btn-sm" title="สร้างรายการสินค้า (SKU) ใหม่เข้าสู่ระบบ">
              <span>➕ เพิ่มสินค้าใหม่</span>
            </button>
          </div>
        </div>

        <!-- Unified Command Bar & Filters -->
        <div class="command-bar">
          <div class="command-bar-row">
            <div class="search-input-wrap" style="flex:1; min-width:260px;">
              <span class="search-icon">🔍</span>
              <input type="text" id="searchInput" class="search-input" placeholder="ค้นหาชื่อสินค้า, รหัส SKU, หมวดหมู่, หรือล็อตผลิต... (Ctrl+K)" value="${uiState.searchQuery}">
            </div>
            <div class="segmented-group" id="stockStatusFilters">
              <button class="segmented-btn ${uiState.stockFilter === 'all' ? 'active' : ''}" data-stock-filter="all">
                ทั้งหมด <span class="segmented-badge">${totalSkus}</span>
              </button>
              <button class="segmented-btn ${uiState.stockFilter === 'in_stock' ? 'active' : ''}" data-stock-filter="in_stock">
                🟢 มีสต็อก <span class="segmented-badge">${inStockCount}</span>
              </button>
              <button class="segmented-btn ${uiState.stockFilter === 'reorder' ? 'active' : ''}" data-stock-filter="reorder">
                ⚠️ จุดสั่งซื้อ <span class="segmented-badge">${reorderCount}</span>
              </button>
              <button class="segmented-btn ${uiState.stockFilter === 'near_exp' ? 'active' : ''}" data-stock-filter="near_exp">
                ⌛ ใกล้หมดอายุ <span class="segmented-badge">${nearExpCount}</span>
              </button>
              <button class="segmented-btn ${uiState.stockFilter === 'out_of_stock' ? 'active' : ''}" data-stock-filter="out_of_stock">
                🔴 หมดสต็อก <span class="segmented-badge">${outOfStockCount}</span>
              </button>
            </div>
          </div>

          <div class="filter-pills cat-pills" id="categoryFilters">
            <span class="filter-label">หมวดหมู่:</span>
            <button class="filter-pill ${uiState.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">ทั้งหมด</button>
            ${categories.map(c => `
              <button class="filter-pill ${uiState.selectedCategory === c ? 'active' : ''}" data-cat="${c}">${c}</button>
            `).join("")}
          </div>
        </div>

        <div class="card-body card-body-no-pad">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>สินค้า / รหัส / ล็อต</th>
                  <th>หมวดหมู่</th>
                  <th>ระดับสต็อก</th>
                  <th>วันหมดอายุ (EXP)</th>
                  <th>คงเหลือ / จุดสั่งซื้อ</th>
                  <th>ต้นทุน / ขาย</th>
                  <th style="min-width:240px;">การจัดการสต็อก</th>
                </tr>
              </thead>
              <tbody>${stockRows}</tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Section: Recent History & Inbound Logs -->
      <section class="card">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-icon">🕒</span>
            <div>
              <h2 class="card-title">ประวัติการเคลื่อนไหวสินค้า (Transaction Audit Trail)</h2>
              <span class="card-subtitle">บันทึกประวัติการเบิกจ่ายของสาขา การนำเข้าสต็อก และการปรับยอดคลังกลาง</span>
            </div>
          </div>
        </div>

        <!-- History Tabs -->
        <div class="history-tabs">
          <button class="history-tab-btn ${uiState.historyTab === 'requests' ? 'active' : ''}" id="tabRequestsHistory">
            <span>📋 ประวัติการเบิกจ่ายสินค้า</span>
            <span class="badge" style="font-size:0.75rem; padding:1px 6px;">${history.length}</span>
          </button>
          <button class="history-tab-btn ${uiState.historyTab === 'inbound' ? 'active' : ''}" id="tabInboundHistory">
            <span>📥 ประวัติการนำเข้าสต็อก</span>
            <span class="badge" style="font-size:0.75rem; padding:1px 6px;">${inboundLogs.length}</span>
          </button>
          <button class="history-tab-btn ${uiState.historyTab === 'adjust' ? 'active' : ''}" id="tabAdjustHistory">
            <span>⚖️ ประวัติการปรับยอด/ตัดชำรุด</span>
            <span class="badge" style="font-size:0.75rem; padding:1px 6px;">${adjustmentLogs.length}</span>
          </button>
        </div>

        <div class="card-body card-body-no-pad">
          <div class="table-responsive">
            ${uiState.historyTab === 'requests' ? `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>สาขา</th>
                    <th>สินค้า</th>
                    <th>จำนวน</th>
                    <th>สถานะ</th>
                    <th>เวลาที่ส่งคำขอ</th>
                  </tr>
                </thead>
                <tbody>${historyRows}</tbody>
              </table>
            ` : uiState.historyTab === 'inbound' ? `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>วัน-เวลาที่นำเข้า</th>
                    <th>สินค้า / รหัส</th>
                    <th>จำนวนนำเข้า</th>
                    <th>สต็อกเดิม ➔ สต็อกใหม่</th>
                    <th>เลขอ้างอิง / บันทึกรับของ</th>
                  </tr>
                </thead>
                <tbody>${inboundRows}</tbody>
              </table>
            ` : `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>วัน-เวลาที่ปรับปรุง</th>
                    <th>สินค้า / รหัส</th>
                    <th>ผลต่าง (+/-)</th>
                    <th>สต็อกเดิม ➔ สต็อกใหม่</th>
                    <th>เหตุผลการปรับยอด</th>
                  </tr>
                </thead>
                <tbody>${adjustRows}</tbody>
              </table>
            `}
          </div>
        </div>
      </section>
    `;

    // Bindings: Approve / Reject
    main.querySelectorAll("[data-approve]").forEach(b => {
      b.onclick = () => decide(b.dataset.approve, true);
    });

    main.querySelectorAll("[data-reject]").forEach(b => {
      b.onclick = () => decide(b.dataset.reject, false);
    });

    // Bindings: Quick Restock
    main.querySelectorAll("[data-restock]").forEach(b => {
      b.onclick = () => {
        const prodId = b.dataset.restock;
        const qty = parseInt(b.dataset.qty, 10) || 10;
        restockProduct(prodId, qty, `เติมสต็อกด่วน +${qty}`);
      };
    });

    // Bindings: Open Drawers from table rows
    main.querySelectorAll("[data-open-stockin]").forEach(b => {
      b.onclick = () => openDrawer("stockIn", b.dataset.openStockin);
    });

    main.querySelectorAll("[data-open-adjust]").forEach(b => {
      b.onclick = () => openDrawer("adjust", b.dataset.openAdjust);
    });

    // Bindings: Header Action Buttons
    const btnStockIn = document.getElementById("btnOpenStockInDrawer");
    if (btnStockIn) btnStockIn.onclick = () => openDrawer("stockIn");

    const btnAdjust = document.getElementById("btnOpenAdjustDrawer");
    if (btnAdjust) btnAdjust.onclick = () => openDrawer("adjust");

    const btnAddProd = document.getElementById("btnOpenAddProductDrawer");
    if (btnAddProd) btnAddProd.onclick = () => openDrawer("addProduct");

    // Bindings: KPI Cards Click Filter
    main.querySelectorAll("[data-kpi-filter]").forEach(card => {
      card.onclick = () => {
        const targetFilter = card.dataset.kpiFilter;
        uiState.stockFilter = uiState.stockFilter === targetFilter ? "all" : targetFilter;
        renderCentral();
      };
    });

    // Bindings: Segmented Stock Status Filters
    const stockFiltersWrap = document.getElementById("stockStatusFilters");
    if (stockFiltersWrap) {
      stockFiltersWrap.querySelectorAll("[data-stock-filter]").forEach(btn => {
        btn.onclick = () => {
          uiState.stockFilter = btn.dataset.stockFilter;
          renderCentral();
        };
      });
    }

    // Bindings: Category Filters
    const catContainer = document.getElementById("categoryFilters");
    if (catContainer) {
      catContainer.querySelectorAll("[data-cat]").forEach(p => {
        p.onclick = () => {
          uiState.selectedCategory = p.dataset.cat;
          renderCentral();
        };
      });
    }

    // Bindings: History Tabs
    const tabReq = document.getElementById("tabRequestsHistory");
    const tabInb = document.getElementById("tabInboundHistory");
    const tabAdj = document.getElementById("tabAdjustHistory");
    if (tabReq) tabReq.onclick = () => { uiState.historyTab = "requests"; renderCentral(); };
    if (tabInb) tabInb.onclick = () => { uiState.historyTab = "inbound"; renderCentral(); };
    if (tabAdj) tabAdj.onclick = () => { uiState.historyTab = "adjust"; renderCentral(); };

    // Search Input with Focus Retention
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.oninput = (e) => {
        uiState.searchQuery = e.target.value;
        renderCentral();
        const newSearch = document.getElementById("searchInput");
        if (newSearch) {
          newSearch.focus();
          newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
        }
      };
    }
  }

  // --- View: Branch View ---
  function renderBranch() {
    const main = document.getElementById("app");
    const branch = state.role;
    const ownRequests = state.requests.filter(r => r.branch === branch);

    // Incoming shipments that are approved by Central but NOT yet received at branch
    const incomingShipments = ownRequests.filter(r => r.status === "approved");
    const ownPending = ownRequests.filter(r => r.status === "pending").length;
    const ownReceived = ownRequests.filter(r => r.status === "received").length;

    // Branch stocks
    if (!state.branchStocks) state.branchStocks = {};
    if (!state.branchStocks[branch]) state.branchStocks[branch] = {};
    const bStocks = state.branchStocks[branch];

    // Branch KPIs
    const branchProducts = state.products.map(p => ({
      ...p,
      onHand: bStocks[p.id] || 0
    }));
    const inStockBranchCount = branchProducts.filter(p => p.onHand > 0).length;
    const totalBranchUnits = branchProducts.reduce((sum, p) => sum + p.onHand, 0);
    const totalBranchValue = branchProducts.reduce((sum, p) => sum + (p.onHand * (p.price || 0)), 0);

    // Branch Sales Total
    const branchSales = (state.branchSalesLogs || []).filter(s => s.branch === branch);
    const totalBranchSales = branchSales.reduce((sum, s) => sum + (s.total || 0), 0);

    // Filter reference catalog
    const filteredProducts = state.products.filter(p => {
      const q = (uiState.searchQuery || "").toLowerCase();
      const matchQuery = !q || p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q);
      const matchCat = uiState.selectedCategory === "all" || p.cat === uiState.selectedCategory;
      return matchQuery && matchCat;
    });

    const categories = getCategories();
    const catPillsHtml = `
      <button class="filter-pill ${uiState.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">ทั้งหมด</button>
      ${categories.map(c => `
        <button class="filter-pill ${uiState.selectedCategory === c ? 'active' : ''}" data-cat="${c}">${c}</button>
      `).join("")}
    `;

    // Dropdown options
    const productOptions = state.products.map(p => `
      <option value="${p.id}">${p.name} (คงเหลือที่คลังกลาง: ${p.stock} ${p.unit || "ชิ้น"})</option>
    `).join("");

    // Branch On-Hand Inventory Rows
    const branchStockRows = branchProducts.map(p => {
      const isOut = p.onHand <= 0;
      const isLow = p.onHand > 0 && p.onHand < 5;
      const percent = Math.min(100, Math.round((p.onHand / 20) * 100));
      const fillClass = isOut ? "critical" : isLow ? "warning" : "safe";
      const subtotalVal = p.onHand * (p.price || 0);

      return `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--text-main);">${p.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">รหัส: ${p.id}</div>
          </td>
          <td><span class="category-tag">${p.cat}</span></td>
          <td class="qty">
            <span class="stock-val-num ${isOut ? 'text-danger' : isLow ? 'text-warning' : 'text-success'}">${p.onHand}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:3px;">${p.unit || "ชิ้น"}</span>
            <div class="stock-health-bar">
              <div class="stock-health-fill ${fillClass}" style="width:${Math.max(6, percent)}%;"></div>
            </div>
          </td>
          <td>฿${(p.price || 0).toLocaleString()}</td>
          <td style="font-weight:600; color:var(--text-main);">฿${subtotalVal.toLocaleString()}</td>
          <td class="actions-cell">
            <button class="btn btn-primary btn-sm btn-table-action" data-branch-sale="${p.id}" ${p.onHand <= 0 ? "disabled" : ""} title="ตัดสต็อกขายสินค้าหน้าร้าน">
              🛒 บันทึกขาย
            </button>
            <button class="btn btn-secondary btn-sm btn-table-action" data-quick-req="${p.id}" title="ขอเบิกเพิ่มจากคลังกลาง">
              📝 ขอเบิกเพิ่ม
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Incoming Shipments Banner
    const incomingShipmentsHtml = incomingShipments.length ? `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:1.05rem; font-weight:700; color:var(--text-main); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <span>🚚 สินค้าส่งถึงสาขา รอการตรวจรับ (${incomingShipments.length} รายการ)</span>
        </h3>
        ${incomingShipments.map(r => {
          const p = findProduct(r.productId);
          return `
            <div class="shipment-card">
              <div class="shipment-meta">
                <div class="shipment-icon">📦</div>
                <div>
                  <div class="shipment-title">
                    ${p ? p.name : r.productId} <span style="color:var(--primary); font-weight:700;">+${r.qty} ${p ? p.unit : ''}</span>
                  </div>
                  <div class="shipment-desc">
                    อนุมัติเมื่อ: ${formatTime(r.decisionTs)} ${r.note ? `· หมายเหตุ: ${r.note}` : ""}
                  </div>
                </div>
              </div>
              <button class="btn btn-success" data-receive-req="${r.id}" title="ยืนยันว่าสินค้ามาถึงสาขาแล้ว และนำเข้าสต็อกหน้าร้าน">
                <span>📦 กดยืนยันตรวจรับเข้าสาขา</span>
              </button>
            </div>
          `;
        }).join("")}
      </div>
    ` : "";

    // Own Requests rows
    const ownRows = ownRequests.length ? ownRequests.map(r => {
      const p = findProduct(r.productId);
      return `
        <tr>
          <td>
            <div style="font-weight:600;">${p ? p.name : `<span style="color:var(--danger)">${r.productId}</span>`}</div>
            ${r.note ? `<div style="font-size:0.78rem; color:var(--text-muted);">💬 ${r.note}</div>` : ""}
          </td>
          <td class="qty" style="font-size:1.05rem; font-weight:700;">${r.qty} ${p ? (p.unit || "ชิ้น") : ""}</td>
          <td>
            ${r.status === 'received' 
              ? `<span class="badge approved">✓ ตรวจรับเข้าสาขาแล้ว</span>` 
              : r.status === 'approved'
              ? `<span class="badge" style="background:var(--primary-light); color:var(--primary-text); font-weight:700;">🚚 ส่งของแล้ว รอตรวจรับ</span>`
              : statusTag(r.status)}
          </td>
          <td style="font-size:0.82rem; color:var(--text-muted);">${formatTime(r.ts)}</td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="4" class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-title">${branchLabel(branch)} ยังไม่เคยส่งคำขอเบิก</div>
          <div class="empty-sub">ส่งคำขอเบิกสินค้าจากแบบฟอร์มด้านล่างเพื่อเริ่มเบิกสินค้า</div>
        </td>
      </tr>
    `;

    // Branch Sales Rows
    const salesRows = branchSales.length ? branchSales.map(s => `
      <tr>
        <td style="font-size:0.82rem; color:var(--text-muted);">${formatTime(s.ts)}</td>
        <td>
          <div style="font-weight:600;">${s.productName}</div>
          ${s.note ? `<div style="font-size:0.75rem; color:var(--text-muted);">${s.note}</div>` : ""}
        </td>
        <td class="qty" style="color:var(--danger); font-weight:700;">-${s.qty}</td>
        <td>฿${(s.price || 0).toLocaleString()}</td>
        <td style="font-weight:700; color:var(--success);">฿${(s.total || 0).toLocaleString()}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon">🛒</div>
          <div class="empty-title">ยังไม่มีบันทึกการขายหน้าร้าน</div>
          <div class="empty-sub">เมื่อขายสินค้าหน้าร้านและกด "บันทึกขาย" รายการจะปรากฏที่นี่</div>
        </td>
      </tr>
    `;

    main.innerHTML = `
      <!-- KPI Stats Bar for Branch -->
      <section class="kpi-grid">
        <div class="kpi-card green" title="จำนวนและมูลค่าสต็อกสินค้าที่พร้อมขายหน้าร้านสาขานี้">
          <div class="kpi-icon-wrap">🏪</div>
          <div class="kpi-meta">
            <span class="kpi-title">สต็อกหน้าร้านพร้อมขาย</span>
            <span class="kpi-value">${inStockBranchCount} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">รายการ (${totalBranchUnits} ชิ้น)</span></span>
            <span class="kpi-desc">มูลค่าสต็อกหน้าร้าน ฿${totalBranchValue.toLocaleString()}</span>
          </div>
        </div>

        <div class="kpi-card ${incomingShipments.length > 0 ? 'amber' : 'blue'}" title="สินค้าที่คลังกลางอนุมัติแล้ว รอสาขาตรวจรับ">
          <div class="kpi-icon-wrap">🚚</div>
          <div class="kpi-meta">
            <span class="kpi-title">รอตรวจรับเข้าสาขา</span>
            <span class="kpi-value">${incomingShipments.length} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">รายการ</span></span>
            <span class="kpi-desc">${incomingShipments.length > 0 ? "มีของมาถึง รอตรวจรับ" : "ไม่มีของค้างส่ง"}</span>
          </div>
        </div>

        <div class="kpi-card amber" title="คำขอที่ส่งไปยังคลังกลางและรอการอนุมัติ">
          <div class="kpi-icon-wrap">⏳</div>
          <div class="kpi-meta">
            <span class="kpi-title">คำขอที่รออนุมัติ</span>
            <span class="kpi-value">${ownPending} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">คำขอ</span></span>
            <span class="kpi-desc">ส่งไปยังคลังกลางแล้ว</span>
          </div>
        </div>

        <div class="kpi-card green" title="ยอดขายรวมหน้าร้านของสาขานี้">
          <div class="kpi-icon-wrap">💰</div>
          <div class="kpi-meta">
            <span class="kpi-title">ยอดขายหน้าร้านรวม</span>
            <span class="kpi-value" style="font-size:1.35rem;">฿${totalBranchSales.toLocaleString()}</span>
            <span class="kpi-desc">จาก ${branchSales.length} รายการขาย</span>
          </div>
        </div>
      </section>

      <!-- Section: Incoming Shipments (Ready for Receipt) -->
      ${incomingShipmentsHtml}

      <!-- Section: Branch On-Hand Inventory Table -->
      <section class="card">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-icon">📦</span>
            <div>
              <h2 class="card-title">สต็อกสินค้าคงเหลือหน้าร้าน (${branchLabel(branch)})</h2>
              <span class="card-subtitle">รายการสินค้าที่พร้อมจำหน่ายหน้าร้านสาขา และปุ่มตัดสต็อกขาย</span>
            </div>
          </div>
        </div>
        <div class="card-body card-body-no-pad">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>สินค้า / รหัส</th>
                  <th>หมวดหมู่</th>
                  <th>คงเหลือหน้าร้าน</th>
                  <th>ราคาขาย</th>
                  <th>มูลค่าสต็อกสาขา</th>
                  <th style="min-width:180px;">การจัดการหน้าร้าน</th>
                </tr>
              </thead>
              <tbody>${branchStockRows}</tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Section: Request Form -->
      <section class="card">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-icon">📝</span>
            <div>
              <h2 class="card-title">แบบฟอร์มขอเบิกสินค้าจากคลังกลาง</h2>
              <span class="card-subtitle">ส่งคำขอไปยังคลังกลางเพื่อรอการตรวจสอบและอนุมัติตัดสต็อก</span>
            </div>
          </div>
        </div>
        <div class="card-body">
          <form id="reqForm">
            <div class="request-form-grid">
              <!-- Left: Inputs -->
              <div class="form-inputs">
                <div class="form-group">
                  <label for="prod" class="form-label">
                    เลือกสินค้า <span class="form-label-desc">*เลือกรายการที่ต้องการเบิก</span>
                  </label>
                  <select id="prod" class="form-select">
                    ${productOptions}
                  </select>
                </div>

                <div class="form-group">
                  <label for="qty" class="form-label">
                    จำนวนที่ต้องการเบิก <span class="form-label-desc">*ต้องเป็นจำนวนเต็มบวก</span>
                  </label>
                  <div class="qty-control-row">
                    <button type="button" id="qtyMinusBtn" class="stepper-btn" title="ลด 1">−</button>
                    <input type="number" id="qty" class="form-input" min="1" value="1" style="text-align:center; font-size:1.1rem; font-weight:700;">
                    <button type="button" id="qtyPlusBtn" class="stepper-btn" title="เพิ่ม 1">+</button>
                  </div>
                  <div class="quick-qty-chips">
                    <span style="font-size:0.75rem; color:var(--text-muted); align-self:center;">ด่วน:</span>
                    <button type="button" class="chip-btn" data-add-qty="1">+1</button>
                    <button type="button" class="chip-btn" data-add-qty="5">+5</button>
                    <button type="button" class="chip-btn" data-add-qty="10">+10</button>
                    <button type="button" class="chip-btn" id="chipMaxBtn">เบิกหมดสต็อก</button>
                  </div>
                </div>

                <div class="form-group">
                  <label for="reqNote" class="form-label">
                    หมายเหตุ / เหตุผลการเบิก <span class="form-label-desc">(ไม่บังคับ)</span>
                  </label>
                  <input type="text" id="reqNote" class="form-input" placeholder="เช่น หน้าร้านของหมด, ลูกค้าสั่งจองล่วงหน้า" maxlength="80">
                </div>

                <button type="submit" id="submitReqBtn" class="btn btn-primary" style="width:100%; padding:12px; font-size:0.95rem;">
                  🚀 ส่งคำขอขออนุมัติเบิกสินค้า
                </button>
              </div>

              <!-- Right: Live Preview & Stock Check -->
              <div class="live-preview-card" id="livePreviewBox">
                <div>
                  <div class="live-preview-header">
                    <div class="live-preview-title">สถานะสินค้าที่เลือก</div>
                    <div class="live-preview-name" id="previewProdName">-</div>
                    <div id="previewProdCat" style="margin-top:4px;"></div>
                  </div>

                  <div class="live-preview-stats">
                    <div class="preview-stat-item">
                      <span class="preview-stat-label">คงเหลือที่คลังกลาง:</span>
                      <span class="preview-stat-val" id="previewCentralStock">-</span>
                    </div>
                    <div class="preview-stat-item">
                      <span class="preview-stat-label">คงเหลือหลังเบิก:</span>
                      <span class="preview-stat-val" id="previewRemainingStock">-</span>
                    </div>
                  </div>

                  <div id="previewAlertBox" class="stock-alert-box ok">
                    <span>✓ สต็อกเพียงพอสำหรับการเบิก</span>
                  </div>
                </div>

                <div class="info-note" style="margin-top:16px;">
                  <span>🔒</span>
                  <span>เมื่อคลังกลางอนุมัติ สาขาต้องกด "ตรวจรับเข้าสาขา" เพื่อเพิ่มสินค้าเข้าสต็อกหน้าร้าน</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      <!-- Section: Branch Activity History Tabs -->
      <section class="card">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-icon">📋</span>
            <div>
              <h2 class="card-title">ประวัติการทำรายการของ ${branchLabel(branch)}</h2>
              <span class="card-subtitle">รายการขอเบิกสินค้า และประวัติการบันทึกขายหน้าร้าน</span>
            </div>
          </div>
        </div>

        <div class="history-tabs">
          <button class="history-tab-btn ${uiState.branchTab !== 'sales' ? 'active' : ''}" id="tabBranchReq">
            <span>📋 ประวัติการเบิกสินค้า</span>
            <span class="badge" style="font-size:0.75rem; padding:1px 6px;">${ownRequests.length}</span>
          </button>
          <button class="history-tab-btn ${uiState.branchTab === 'sales' ? 'active' : ''}" id="tabBranchSales">
            <span>🛒 ประวัติการขายหน้าร้าน</span>
            <span class="badge" style="font-size:0.75rem; padding:1px 6px;">${branchSales.length}</span>
          </button>
        </div>

        <div class="card-body card-body-no-pad">
          <div class="table-responsive">
            ${uiState.branchTab === 'sales' ? `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>วัน-เวลาขาย</th>
                    <th>สินค้าที่ขาย</th>
                    <th>จำนวน</th>
                    <th>ราคา/หน่วย</th>
                    <th>ยอดขายรวม</th>
                  </tr>
                </thead>
                <tbody>${salesRows}</tbody>
              </table>
            ` : `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>สินค้า / หมายเหตุ</th>
                    <th>จำนวนที่ขอ</th>
                    <th>สถานะคำขอ</th>
                    <th>เวลาที่ส่งคำขอ</th>
                  </tr>
                </thead>
                <tbody>${ownRows}</tbody>
              </table>
            `}
          </div>
        </div>
      </section>
    `;

    // Event Bindings: Receive incoming shipments
    main.querySelectorAll("[data-receive-req]").forEach(btn => {
      btn.onclick = () => {
        const reqId = btn.dataset.receiveReq;
        receiveShipment(reqId);
      };
    });

    // Event Bindings: Branch sale button
    main.querySelectorAll("[data-branch-sale]").forEach(btn => {
      btn.onclick = () => {
        const prodId = btn.dataset.branchSale;
        openDrawer("branchSale", prodId);
      };
    });

    // Event Bindings: Quick request from branch stock row
    main.querySelectorAll("[data-quick-req]").forEach(btn => {
      btn.onclick = () => {
        const prodId = btn.dataset.quickReq;
        const prodSel = document.getElementById("prod");
        if (prodSel) {
          prodSel.value = prodId;
          updateLivePreview();
          document.getElementById("reqForm").scrollIntoView({ behavior: "smooth" });
        }
      };
    });

    // Event Bindings: Branch History Tabs
    const tabBReq = document.getElementById("tabBranchReq");
    const tabBSales = document.getElementById("tabBranchSales");
    if (tabBReq) tabBReq.onclick = () => { uiState.branchTab = "req"; renderBranch(); };
    if (tabBSales) tabBSales.onclick = () => { uiState.branchTab = "sales"; renderBranch(); };

    // --- Interactive Form Preview & Stepper Logic ---
    const prodSelect = document.getElementById("prod");
    const qtyInput = document.getElementById("qty");
    const minusBtn = document.getElementById("qtyMinusBtn");
    const plusBtn = document.getElementById("qtyPlusBtn");
    const chipMax = document.getElementById("chipMaxBtn");
    const previewName = document.getElementById("previewProdName");
    const previewCat = document.getElementById("previewProdCat");
    const previewCentralStock = document.getElementById("previewCentralStock");
    const previewRemainingStock = document.getElementById("previewRemainingStock");
    const alertBox = document.getElementById("previewAlertBox");

    function updateLivePreview() {
      if (!prodSelect || !qtyInput) return;
      const selectedId = prodSelect.value;
      const prod = findProduct(selectedId);
      const reqQty = Math.max(1, parseInt(qtyInput.value, 10) || 1);

      if (!prod) {
        if (previewName) previewName.textContent = "ไม่ได้เลือกสินค้า";
        return;
      }

      if (previewName) previewName.textContent = prod.name;
      if (previewCat) previewCat.innerHTML = `<span class="category-tag">${prod.cat}</span>`;
      if (previewCentralStock) previewCentralStock.textContent = `${prod.stock} ${prod.unit || "ชิ้น"}`;

      const remaining = prod.stock - reqQty;
      if (previewRemainingStock) {
        previewRemainingStock.textContent = `${remaining} ${prod.unit || "ชิ้น"}`;
        previewRemainingStock.style.color = remaining < 0 ? "var(--danger)" : (remaining < 10 ? "var(--warning)" : "var(--text-main)");
      }

      if (alertBox) {
        if (prod.stock <= 0) {
          alertBox.className = "stock-alert-box danger";
          alertBox.innerHTML = "<span>⚠️ สินค้าหมดสต็อกในคลังกลาง (อาจไม่ได้รับการอนุมัติ)</span>";
        } else if (remaining < 0) {
          alertBox.className = "stock-alert-box danger";
          alertBox.innerHTML = `<span>⚠️ จำนวนที่ขอ (${reqQty}) มากกว่าสต็อกในคลัง (${prod.stock})</span>`;
        } else if (remaining < 5) {
          alertBox.className = "stock-alert-box warn";
          alertBox.innerHTML = "<span>⚠️ การเบิกนี้จะทำให้สต็อกในคลังกลางใกล้หมด</span>";
        } else {
          alertBox.className = "stock-alert-box ok";
          alertBox.innerHTML = "<span>✓ สต็อกเพียงพอสำหรับการเบิก</span>";
        }
      }
    }

    if (prodSelect) prodSelect.onchange = updateLivePreview;
    if (qtyInput) {
      qtyInput.oninput = () => {
        if (parseInt(qtyInput.value, 10) < 1) qtyInput.value = 1;
        updateLivePreview();
      };
    }

    if (minusBtn) {
      minusBtn.onclick = () => {
        const cur = parseInt(qtyInput.value, 10) || 1;
        if (cur > 1) {
          qtyInput.value = cur - 1;
          updateLivePreview();
        }
      };
    }

    if (plusBtn) {
      plusBtn.onclick = () => {
        const cur = parseInt(qtyInput.value, 10) || 1;
        qtyInput.value = cur + 1;
        updateLivePreview();
      };
    }

    main.querySelectorAll("[data-add-qty]").forEach(btn => {
      btn.onclick = () => {
        const add = parseInt(btn.dataset.addQty, 10) || 1;
        const cur = parseInt(qtyInput.value, 10) || 1;
        qtyInput.value = cur + add;
        updateLivePreview();
      };
    });

    if (chipMax) {
      chipMax.onclick = () => {
        const prod = findProduct(prodSelect.value);
        if (prod) {
          qtyInput.value = Math.max(1, prod.stock);
          updateLivePreview();
        }
      };
    }

    // Form submission
    const form = document.getElementById("reqForm");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const prodId = prodSelect ? prodSelect.value : "";
        const qty = qtyInput ? qtyInput.value : 1;
        const note = document.getElementById("reqNote") ? document.getElementById("reqNote").value : "";
        submitRequest(branch, prodId, qty, note);
      };
    }

    // Initial trigger for live preview
    updateLivePreview();
  }

  // --- Main Render Dispatcher ---
  function render() {
    renderRoleNav();
    if (state.role === "central") {
      renderCentral();
    } else {
      renderBranch();
    }
  }

  // --- Initialize App ---
  initTheme();
  initResetButton();
  initDrawer();
  render();

  if (isApiConfigured()) {
    setSyncStatus("connecting");
    syncFromServer(true);
    setInterval(() => syncFromServer(false), SYNC_INTERVAL_MS);
  } else {
    setSyncStatus("offline");
  }

})();
