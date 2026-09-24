# YC เพื่อนที่ปรึกษา

LINE bot สำหรับนักเรียน ใช้ Next.js 14 App Router, TypeScript, LINE SDK และ Gemini ตอบจาก FAQ ที่ครูตรวจแล้วเท่านั้น

## เริ่มใช้งาน

ใช้ Node.js 22 ขึ้นไป และ pnpm 11.19.0

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

ใส่ค่า `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `GEMINI_API_KEY`, `SHEET_CSV_URL` ใน `.env.local` สำหรับเครื่องตัวเอง และใน Vercel Environment Variables สำหรับ production ห้าม commit ค่าจริง ไม่มีการเรียกบริการภายนอกระหว่าง build

## FAQ

Google Sheet ต้องเผยแพร่เป็น CSV ผ่าน HTTPS โดยมีคอลัมน์ `id,question,keywords,answer,action,enabled` (สลับลำดับได้) รหัสต้องไม่ซ้ำ `action` เป็น `answer` หรือ `handoff` และ `enabled` เป็น `TRUE` หรือ `FALSE` เฉพาะตัวพิมพ์ใหญ่ รองรับ comma, เครื่องหมายคำพูด และหลายบรรทัดในช่องเดียวตามมาตรฐาน CSV

ไม่มีข้อมูลตัวอย่างเกี่ยวกับโรงเรียนที่แต่งขึ้น: ให้ครูใส่คำถามและคำตอบที่ตรวจแล้วก่อนใช้งานจริง หากไม่มีแถวเปิดใช้ ระบบจะใช้ข้อความสำรอง Cache มีอายุ 60 วินาทีต่อ instance และไม่ใช้ข้อมูลหมดอายุเมื่อดึง Sheet ไม่สำเร็จ Sheet สาธารณะต้องไม่มีข้อมูลนักเรียนหรือเรื่องปรึกษา

## การทำงาน

- `app/api/line-webhook/route.ts`: ตรวจลายเซ็นจาก body ต้นฉบับก่อนอ่าน JSON รองรับ verification ที่ไม่มี event และประมวลผล text event
- `lib/sheet.ts`: ตรวจรูปแบบ CSV และ cache
- `lib/prompt.ts`: บทบาท น้ำเสียง ข้อจำกัด และ FAQ ก่อนคำถาม แยกข้อมูลออกจาก system instruction การ escape แท็กช่วยป้องกันการเปลี่ยนโครงสร้าง แต่ไม่ได้รับประกันว่าจะป้องกัน prompt injection ได้ทั้งหมด
- `lib/gemini.ts`: `gemini-3.5-flash`, temperature 1.0, maxOutputTokens 1024 ตามบรีฟ เก็บ finishReason และจำนวน token โดยไม่เก็บข้อความนักเรียน คำตอบต้องจบด้วย STOP และมีข้อความจึงส่งได้
- `lib/handoff.ts`: จุดเชื่อมระบบรับเรื่องของครู ขณะนี้คืนค่าไม่พร้อมใช้งานและแจ้งนักเรียนตามจริง
- `lib/dedupe.ts`: กัน event ซ้ำภายใน instance เป็นเวลา 24 ชั่วโมง

ตั้งเวลาทำงานรวมเป้าหมาย 9.5 วินาที โดย Sheet ไม่เกิน 2 วินาที สงวน 2.5 วินาทีสำหรับส่งต่อและตอบ LINE Gemini ยกเลิกด้วย AbortSignal และไม่ retry อัตโนมัติ LINE SDK ไม่รองรับ AbortSignal จึงหยุดรอเมื่อถึงเวลา แต่คำขอที่ส่งแล้วอาจยังทำงานต่อ ห้าม retry reply token ที่ไม่ทราบผลส่ง ระบบ log ความล้มเหลวแล้วตอบรับ webhook เพื่อไม่สร้างการส่งต่อซ้ำโดยไม่ทราบผล

## สิ่งที่ต้องเชื่อมก่อนใช้งานเต็มรูปแบบ

1. **การส่งต่อครูยังไม่พร้อม** ต้องมีช่องทางรับเรื่องที่ยืนยันตัวตนและบันทึกเรื่องจริง เชื่อมผ่าน HandoffAdapter ใช้ eventId กันส่งซ้ำ และคืน true เมื่อได้รับการยืนยันรับเรื่องเท่านั้น ส่งข้อมูลนักเรียนเฉพาะที่จำเป็นไปยังครูที่มีสิทธิ์ ห้ามใช้ public Sheet รับเรื่อง
2. **การกันซ้ำข้าม Vercel instance ยังไม่พร้อม** ต้องแทนที่ claimEvent ด้วย shared durable store ที่จอง event แบบ atomic และเก็บสถานะการส่งต่อ/ตอบกลับ ห้ามอ้างว่า memory cache กันซ้ำได้ทั่วทั้งระบบ
3. ทดสอบน้ำเสียงและความถูกต้องกับ FAQ จริงที่ครูอนุมัติ การทดสอบอัตโนมัติไม่ได้ยืนยันความถูกต้องของคำตอบ Gemini จริง

## Vercel

Import repository นี้ ตั้ง Root Directory เป็นราก repository (ไม่ใช่ github2 เพราะ github2 เป็นชื่อโฟลเดอร์ในเครื่อง) ไฟล์ `vercel.json` กำหนด `framework: nextjs`, build และ install command ชัดเจน ใช้ Node.js 22 หรือ 24

ตั้ง LINE webhook URL เป็น `https://<production-domain>/api/line-webhook` เปิด Use webhook และตรวจ Verify หลัง deploy ตั้งค่าข้อความตอบอัตโนมัติใน LINE OA ให้ไม่ตอบซ้ำกับบอท

หาก Vercel เชื่อม GitHub ไว้แล้ว การ push จะเริ่ม deploy ตรวจว่า deployment ตรงกับ commit ที่ส่งและเป็น Ready ก่อนทดสอบ LINE จริง

## ตรวจโปรเจกต์

```sh
pnpm test
pnpm run typecheck
pnpm run build
```

การทดสอบใช้ข้อมูลจำลอง ไม่ส่งข้อความให้นักเรียนหรือครู และไม่เรียก Gemini จริง

เอกสารอ้างอิง: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [LINE signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/), [Gemini SDK](https://googleapis.github.io/js-genai/)
