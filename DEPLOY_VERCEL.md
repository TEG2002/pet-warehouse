# คู่มือการ Deploy เว็บไซต์ขึ้น Vercel (ฟรี & อัปเดตอัตโนมัติ)

ระบบจัดการคลังสินค้านี้พร้อมสำหรับ Deploy บน **Vercel** ทันที โดยมีไฟล์ตั้งค่า [`vercel.json`](file:///c:/woking/pet-warehouse-v2/vercel.json), [`package.json`](file:///c:/woking/pet-warehouse-v2/package.json), และ [`.gitignore`](file:///c:/woking/pet-warehouse-v2/.gitignore) รองรับเรียบร้อยแล้ว

---

## 🚀 วิธีที่ 1: Deploy ผ่าน GitHub ➔ Vercel (แนะนำที่สุด ง่ายใน 1 นาที)

เนื่องจากโปรเจกต์นี้เชื่อมกับ GitHub (`https://github.com/TEG2002/pet-warehouse.git`) อยู่แล้ว

### ขั้นตอนที่ 1: Push ไฟล์การตั้งค่า Vercel ขึ้น GitHub
เปิด Terminal แล้วรันคำสั่ง:
```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

### ขั้นตอนที่ 2: เชื่อมต่อและ Deploy บน Vercel
1. เข้าไปที่เว็บ [https://vercel.com](https://vercel.com) แล้วล็อกอินด้วย **GitHub**
2. คลิกปุ่ม **"Add New..."** มุมขวาบน ➔ เลือก **"Project"**
3. ในส่วน **"Import Git Repository"** ค้นหาและกดปุ่ม **"Import"** ที่ Repository `pet-warehouse`
4. ที่หน้าตั้งค่า:
   - **Framework Preset**: เลือก `Other` (หรือปล่อยเป็นค่าเริ่มต้น)
   - **Root Directory**: `./` (ค่าเริ่มต้น)
5. กดปุ่ม **"Deploy"** 🚀
6. รอประมาณ 20-30 วินาที จะได้ URL เว็บไซต์จริง เช่น `https://pet-warehouse.vercel.app` ใช้งานได้ทันทีทั้งบนคอมและมือถือ!

> 💡 **ข้อดีพิเศษ**: เมื่อ Deploy ผ่าน GitHub แล้ว ครั้งต่อไปเวลาที่คุณแก้ไขโค้ดแล้ว `git push` ขึ้น GitHub ทาง Vercel จะอัปเดตเว็บเวอร์ชันใหม่ให้โดยอัตโนมัติทันที ไม่ต้องกด Deploy ซ้ำ

---

## ⚡ วิธีที่ 2: Deploy ผ่าน Vercel CLI (ทางเลือกสำหรับ Terminal)

หากคุณติดตั้ง Vercel CLI ไว้ในเครื่องแล้ว:
```bash
vercel
```
หรือหากต้องการ Deploy ขึ้น Production ทันที:
```bash
vercel --prod
```

---

## 🔒 การเชื่อมต่อ Google Sheets บน Vercel
- ไฟล์ [`script.js`](file:///c:/woking/pet-warehouse-v2/script.js) ได้เชื่อมต่อกับ Google Apps Script Web App ผ่าน HTTPS เรียบร้อยแล้ว
- เมื่อเปิดผ่านโดเมน Vercel (`https://xxx.vercel.app`) ระบบจะสามารถเรียกข้อมูลและซิงค์กับ Google Sheet ได้แบบ 100% ไม่มีปัญหาเรื่อง Mixed Content หรือ CORS

