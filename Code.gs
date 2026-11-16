/**
 * Pet Warehouse Management — Google Sheets Backend
 * วางไฟล์นี้ใน Extensions > Apps Script ของ Google Sheet ที่สร้างตาม SETUP_GOOGLE_SHEETS.md
 * แล้ว Deploy เป็น Web App (ดูขั้นตอนในไฟล์เดียวกัน)
 */

const SHEET_PRODUCTS = "Products";
const SHEET_REQUESTS = "Requests";

// ข้อมูลตั้งต้น ใช้ตอนกดปุ่ม "รีเซ็ตข้อมูล" ในหน้าเว็บ
const DEFAULT_PRODUCTS = [
  ["p1", "อาหารหมา โปรตีนสูง 5kg", "อาหารหมา", "ถุง", 40],
  ["p2", "อาหารหมา สูตรลูกสุนัข 3kg", "อาหารหมา", "ถุง", 18],
  ["p3", "อาหารแมว ทะเลรวมมิตร 2kg", "อาหารแมว", "ถุง", 25],
  ["p4", "อาหารแมว สูตรลดน้ำหนัก 2kg", "อาหารแมว", "ถุง", 9],
  ["p5", "วิตามินรวมสำหรับสัตว์เลี้ยง", "อาหารเสริมสัตว์", "ขวด", 30],
  ["p6", "ปลอกคอกันเห็บหมัด", "อุปกรณ์ต่าง ๆ", "ชิ้น", 14],
  ["p7", "ชามอาหารสแตนเลสคู่", "อุปกรณ์ต่าง ๆ", "ชุด", 22]
];

function doGet(e) {
  return respond(getAllData());
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result = {};

    if (action === "submitRequest") {
      result = submitRequest(body);
    } else if (action === "decide") {
      result = decideRequest(body);
    } else if (action === "receiveAtBranch") {
      result = receiveAtBranch(body);
    } else if (action === "restock") {
      result = restockProduct(body);
    } else if (action === "adjustStock") {
      result = adjustStock(body);
    } else if (action === "addProduct") {
      result = addProduct(body);
    } else if (action === "reset") {
      result = resetData();
    } else {
      throw new Error("ไม่รู้จักคำสั่ง: " + action);
    }

    return respond({ ok: true, data: getAllData(), result: result });
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error("ไม่พบชีท: " + name + " — ตรวจสอบชื่อแท็บให้ตรงกับ SETUP_GOOGLE_SHEETS.md");
  return sh;
}

function getAllData() {
  return { products: readProducts(), requests: readRequests() };
}

function readProducts() {
  const sh = getSheet(SHEET_PRODUCTS);
  const rows = sh.getDataRange().getValues();
  rows.shift(); // ตัดแถวหัวตาราง
  return rows
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return {
        id: r[0],
        name: r[1],
        cat: r[2],
        unit: r[3],
        stock: Number(r[4]) || 0,
        cost: Number(r[5]) || 0,
        price: Number(r[6]) || 0,
        minStock: Number(r[7]) || 10,
        lot: r[8] || "",
        exp: r[9] || ""
      };
    });
}

function readRequests() {
  const sh = getSheet(SHEET_REQUESTS);
  const rows = sh.getDataRange().getValues();
  rows.shift();
  return rows
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return {
        id: r[0], branch: r[1], productId: r[2], qty: Number(r[3]) || 0,
        note: r[4] || "", status: r[5] || "pending", ts: r[6] || "", decisionTs: r[7] || "",
        receivedTs: r[8] || ""
      };
    })
    .reverse(); // ให้รายการล่าสุดอยู่บนสุด เหมือนฝั่งหน้าเว็บ
}

function findRowById(sh, id) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1; // เลขแถวจริงใน sheet (1-indexed, +1 เพราะมีหัวตาราง)
  }
  return -1;
}

function submitRequest(body) {
  const sh = getSheet(SHEET_REQUESTS);
  const id = "req_" + new Date().getTime() + "_" + Math.random().toString(36).substring(2, 6);
  sh.appendRow([id, body.branch, body.productId, body.qty, body.note || "", "pending", body.ts || "", ""]);
  return { id: id };
}

function decideRequest(body) {
  const reqSh = getSheet(SHEET_REQUESTS);
  const row = findRowById(reqSh, body.id);
  if (row < 0) throw new Error("ไม่พบคำขอนี้ในชีท");

  const currentStatus = reqSh.getRange(row, 6).getValue();
  if (currentStatus !== "pending") throw new Error("คำขอนี้ถูกตัดสินไปแล้ว (" + currentStatus + ")");

  if (body.approve) {
    const prodSh = getSheet(SHEET_PRODUCTS);
    const prow = findRowById(prodSh, body.productId);
    if (prow < 0) throw new Error("ไม่พบสินค้าในคลัง ไม่สามารถตัดสต็อกได้");

    const stockCell = prodSh.getRange(prow, 5);
    const currentStock = Number(stockCell.getValue()) || 0;
    const qty = Number(body.qty) || 0;
    if (currentStock < qty) throw new Error("สต็อกไม่เพียงพอ (คงเหลือ " + currentStock + ")");

    stockCell.setValue(currentStock - qty);
    reqSh.getRange(row, 6).setValue("approved");
  } else {
    reqSh.getRange(row, 6).setValue("rejected");
  }

  reqSh.getRange(row, 8).setValue(body.decisionTs || new Date().toLocaleString("th-TH"));
  return {};
}

function receiveAtBranch(body) {
  const reqSh = getSheet(SHEET_REQUESTS);
  const row = findRowById(reqSh, body.id);
  if (row < 0) throw new Error("ไม่พบคำขอนี้ในชีท");

  const currentStatus = reqSh.getRange(row, 6).getValue();
  if (currentStatus !== "approved") {
    throw new Error("คำขอนี้ต้องได้รับการอนุมัติจากคลังกลางก่อนตรวจรับ (สถานะปัจจุบัน: " + currentStatus + ")");
  }

  reqSh.getRange(row, 6).setValue("received");
  reqSh.getRange(row, 9).setValue(body.receivedTs || new Date().toLocaleString("th-TH"));
  return {};
}

function restockProduct(body) {
  const sh = getSheet(SHEET_PRODUCTS);
  const row = findRowById(sh, body.productId);
  if (row < 0) throw new Error("ไม่พบสินค้านี้ในคลัง");
  const stockCell = sh.getRange(row, 5);
  const current = Number(stockCell.getValue()) || 0;
  const newStock = current + (Number(body.qty) || 0);
  stockCell.setValue(newStock);
  return { newStock: newStock };
}

function adjustStock(body) {
  const sh = getSheet(SHEET_PRODUCTS);
  const row = findRowById(sh, body.productId);
  if (row < 0) throw new Error("ไม่พบสินค้านี้ในคลัง");
  const stockCell = sh.getRange(row, 5);
  const current = Number(stockCell.getValue()) || 0;
  const delta = Number(body.delta) || 0;
  const newStock = Math.max(0, current + delta);
  stockCell.setValue(newStock);
  return { previousStock: current, newStock: newStock };
}

function addProduct(body) {
  const sh = getSheet(SHEET_PRODUCTS);
  const id = body.id || ("p" + (sh.getLastRow()));
  const name = body.name || "สินค้าใหม่";
  const cat = body.cat || "ทั่วไป";
  const unit = body.unit || "ชิ้น";
  const stock = Number(body.stock) || 0;
  const cost = Number(body.cost) || 0;
  const price = Number(body.price) || 0;
  const minStock = Number(body.minStock) || 10;
  const lot = body.lot || "";
  const exp = body.exp || "";
  sh.appendRow([id, name, cat, unit, stock, cost, price, minStock, lot, exp]);
  return { id: id };
}

// รีเซ็ตสต็อกสินค้ากลับเป็นค่าเริ่มต้น และล้างประวัติคำขอทั้งหมด
function resetData() {
  const prodSh = getSheet(SHEET_PRODUCTS);
  prodSh.getRange(2, 1, Math.max(prodSh.getLastRow() - 1, 0), 5).clearContent();
  prodSh.getRange(2, 1, DEFAULT_PRODUCTS.length, 5).setValues(DEFAULT_PRODUCTS);

  const reqSh = getSheet(SHEET_REQUESTS);
  if (reqSh.getLastRow() > 1) {
    reqSh.getRange(2, 1, reqSh.getLastRow() - 1, 8).clearContent();
  }
  return {};
}
