# diffy: แผนและความคืบหน้า

อัปเดตล่าสุด: 2026-10-24 (หลังทำ F7)
เอกสารนี้สรุปว่า diffy คืออะไร ออกแบบอย่างไร ตอนนี้ทำถึงไหน อะไรยืนยันแล้ว อะไรยังไม่ได้ยืนยัน และเหลืออะไรต้องทำ

---

## 1. diffy คืออะไร

AI รีวิว pull request แบบ open source ที่ผู้ใช้รันเองบนเครื่องตัวเอง

1. ผู้ใช้ clone repo ใส่ URL ฐานข้อมูลใน `.env` แล้วรัน `pnpm install && pnpm start`
2. เปิด http://localhost:3000 แล้วตั้งค่าที่เหลือในเบราว์เซอร์: GitHub token, ผู้ให้บริการ LLM (OpenAI, Anthropic, Gemini, OpenRouter) พร้อมคีย์และโมเดล, และ repo ที่จะเฝ้า
3. เซิร์ฟเวอร์ poll repo ที่เฝ้าทุก 1 นาที เมื่อมี PR ใหม่หรือมี commit ใหม่ จะให้ LLM รีวิว diff แล้วโพสต์ **รีวิวเดียว** ลง GitHub ประกอบด้วย
   - ข้อความสรุป (finding จัดกลุ่มตามความรุนแรง)
   - คอมเมนต์ inline: ความรุนแรง, คำอธิบาย, "fix prompt" ที่คัดลอกไปให้ coding agent ได้, และ block `suggestion` เมื่อแก้ได้แน่นอน
   - finding ที่ชี้บรรทัดนอก diff (GitHub ปฏิเสธ) จะย้ายไปอยู่ในข้อความสรุปแทน
4. หน้าประวัติแสดงรีวิวที่ผ่านมาพร้อม finding

หลักออกแบบ: **ทุกส่วนเรียบง่ายที่สุดเท่าที่ยังใช้งานจริงได้** ไม่มี GitHub App, webhook, Docker image, ระบบล็อกอิน หรือกฎกำหนดเอง ใน v1

---

## 2. สถานะภาพรวม

| Phase | เนื้อหา | สถานะ |
|---|---|---|
| A | `packages/core` ทำงานได้จากสคริปต์ (A1–A11) | เสร็จ |
| B | โครง NestJS, Prisma, Swagger/OpenAPI, เข้ารหัสความลับ (B1–B4) | เสร็จ |
| C | Settings API (C1–C4) | เสร็จ |
| D | Repos API (D1–D3) | เสร็จ |
| E | Reviews API และ worker (E1–E7) | เสร็จ |
| F | หน้าเว็บ (Next.js) F1–F7 | **F1–F7 เสร็จ** (เว็บครบ) |
| S | diffy เป็นบริการกลาง diffy[bot] S0–S7 (หัวข้อ 9, Phase S) | **S0–S4a, S3 ทั้งหมดเสร็จ**, ต่อ S5/S6/S7 |
| G | ~~self-host: process เดียวและเอกสาร~~ ยกเลิก (เลิกโหมด self-host) G1 อยู่ใน stash ใช้ต่อใน S6 | ยกเลิก |
| R | ทำให้รีวิวละเอียดขึ้น R1–R7 (หัวข้อ 9, Phase R) | **R1–R5 และ R2c เสร็จ (R2b เหลือทดสอบรวม)** |

จำนวน test ที่ผ่าน ณ วันที่เขียน: `shared` 8, `core` 74, `server` 227, `web` 29

**ขั้นถัดไปคือ G1** (เสิร์ฟเว็บจาก process เดียว + `pnpm start`) ฝั่ง API ของ v1 ครบแล้ว ดูหัวข้อ 9

---

## 3. สถาปัตยกรรม

### 3.1 โครงโฟลเดอร์

```
diffy/
├─ docs/PLAN.md                 ไฟล์นี้
├─ .env  /  .env.example        ไฟล์ .env ไฟล์เดียวที่ root (ไม่ถูก commit)
├─ package.json                 สคริปต์: build, test, dev, api:dev, web:dev, gen:api, db:up, db:down
├─ apps/
│  ├─ server/                   NestJS (CommonJS)
│  │  ├─ openapi.json           สร้างจากโค้ด ใช้เป็นอินพุตของ Orval ฝั่งเว็บ
│  │  ├─ prisma/schema/*.prisma schema แยกไฟล์ + prisma/migrations/
│  │  └─ src/
│  │     ├─ infra/              config, prisma, crypto, github errors, security (redact)
│  │     └─ module/             health, settings, repos, reviews, profiles
│  └─ web/                      Next.js 16 (static export), Tailwind 4, shadcn/ui (หน้าเปล่าทุกหน้าแล้ว)
└─ packages/
   ├─ shared/                   Zod schema ของโดเมน: Finding, Severity, LlmProvider, ReviewStatus
   └─ core/                     ตรรกะรีวิวเป็นฟังก์ชัน TypeScript ล้วน (ไม่รู้จัก Nest/Prisma)
```

ความสัมพันธ์ของแพ็กเกจ: `core` พึ่ง `shared`, `server` พึ่ง `core` และ `shared`, `web` จะพึ่ง API ผ่าน client ที่ Orval สร้างจาก `openapi.json` ไม่ import `shared` ตรง ๆ ทั้งสามแพ็กเกจ build เป็น `dist/` ด้วย `tsc` เพราะ Nest ไม่ compile TypeScript ใน `node_modules` (ทำงานได้เพราะ Node 22+ `require()` ไฟล์ ESM ได้)

### 3.2 สายงานของหนึ่งรีวิว

```
POST /api/reviews                        (ผู้ใช้กด)  หรือ  poller (E5)
   │ อ่าน head SHA จาก GitHub แล้วสร้างแถว Review (queued)
   │ unique(repository, PR, SHA) กันรีวิว commit เดียวซ้ำ   ← ฐานข้อมูลเป็นผู้ตัดสิน
   ▼
ReviewQueueWorker   คิวใน memory เก็บแค่ id รันทีละรีวิว
   ▼
RunReviewWorker     claim (queued→running) → โหลด token/LLM → ดึง PR
   │                 ถ้า PR ขยับไป commit ใหม่แล้ว → skipped
   ▼
core.reviewPullRequest
   ├─ ดึงไฟล์ที่เปลี่ยน (แบ่งหน้า) → กรอง lockfile/generated/ไบนารี + จำกัดขนาด ~60k ตัวอักษร (ทีละไฟล์เต็ม)
   ├─ แปะเลขบรรทัดฝั่งไฟล์ใหม่หน้าทุกบรรทัดของ diff
   ├─ LLM (AI SDK + structured output ตาม Zod schema)
   ├─ ตรวจเลขบรรทัดกับ hunk ของ diff → inline หรือ summary
   ├─ render markdown
   └─ pulls.createReview ครั้งเดียว (event COMMENT, ปัก commit_id) ถ้า 422 ลองใหม่โดยย้ายทุกอย่างไปไว้ใน summary
   ▼
บันทึกผล: Review + Finding ใน transaction เดียว (posted/skipped) หรือ failed พร้อมข้อความ (ซ่อนคีย์)
```

### 3.3 การตรวจเลขบรรทัด (สิ่งที่ทำให้รีวิวไม่พัง)

GitHub จะปฏิเสธรีวิวทั้งก้อนถ้ามีคอมเมนต์ inline แม้อันเดียวที่ชี้ไปบรรทัดนอก diff การป้องกันมี 2 ชั้น

1. `parsePatch` แตก diff เป็น hunk และสร้างดัชนีบรรทัดที่คอมเมนต์ได้ (บรรทัดที่เพิ่มและบรรทัดบริบทฝั่งไฟล์ใหม่) `placeFindings` จึงตัดสินว่า finding ไหน inline ไหน summary
   - ช่วงบรรทัดที่ข้าม hunk หรือเริ่มนอก diff ถูกย่อเหลือบรรทัดเดียว และ **ทิ้ง suggestion** (suggestion เขียนมาแทนทั้งช่วง ถ้าช่วงเปลี่ยน การกด Commit suggestion จะทำให้โค้ดพัง)
   - เรียงตามความรุนแรงและตัดเหลือ 25 รายการ
2. ถ้า GitHub ยังตอบ 422 ลองใหม่ครั้งเดียวโดยย้ายทุก finding ไปไว้ใน summary รีวิวจึงไม่หาย

---

## 4. กติกาโค้ดของ `apps/server`

ผู้ใช้กำหนดไว้ระหว่างทำ (บันทึกในความจำของ Claude ด้วย)

- โมดูลอยู่ที่ `src/module/<ชื่อ>/` ส่วนโค้ดข้ามส่วนอยู่ที่ `src/infra/`
- **ทุก endpoint** = เมธอดใน controller + `usecase/<ชื่อ>.usecase.ts` 1 ไฟล์ + `dto/<ชื่อ>.dto.ts` 1 ไฟล์ + repository ของโมดูล controller ไม่มีตรรกะ มีแต่ repository ที่แตะ Prisma
- ตรรกะที่ **โมดูลอื่นต้องใช้** อยู่ใน `<ชื่อ>.service.ts` ไฟล์เดียวที่ root ของโมดูล (เช่น `SettingsService.getGithubToken()`) โมดูล export เฉพาะ service นั้น โมดูลอื่น inject service ตรง ๆ **ห้าม** export หรือ inject repository ของโมดูลอื่น
  - usecase = ทางเข้า HTTP ที่ controller เรียก ส่วน service = ความสามารถที่โค้ดอื่นเรียก controller ไม่เรียก service ตรง ๆ
  - ส่วนที่ไม่ใช่ทั้งสองอย่างคือ **worker**: ตื่นเอง (ตัวจับเวลา คิว หรือตอน server บูต ไม่ได้เริ่มจาก request ของผู้ใช้) และถือสถานะข้ามหลาย request อยู่ใน `worker/` ของโมดูล ชื่อไฟล์ลงท้าย `.worker.ts` และชื่อคลาสลงท้าย `Worker` (`PollerWorker`, `ReviewQueueWorker`, `RunReviewWorker` ในโมดูล reviews และ `ProfileBuilderWorker` ในโมดูล profiles) worker เก็บสถานะในหน่วยความจำ จึงใช้ได้กับ server ตัวเดียว (ดูหัวข้อ v2)
- mapper (แปลงแถว DB เป็นรูปแบบ API เช่น `Date` เป็น ISO string) ใช้ไฟล์เดียว `<ชื่อโมดูล>.mapper.ts`
- ค่า enum ของ Prisma เป็น **ตัวพิมพ์เล็ก** (`openai`, `queued`, `critical`, `inline`) จึงเหมือนกันทุกที่: ฐานข้อมูล, Prisma client, API และ `@diffy/shared` ไม่ต้องมีตัวแปลง มี test (`enums-in-sync.test.ts`) คอยตรวจว่าสองฝั่งตรงกัน
- ความปลอดภัยของ type ตั้งแต่ต้นจนปลาย: Zod DTO (nestjs-zod) → `openapi.json` → Orval สร้าง client และ hook ให้เว็บ
- ตัวกรอง response (`ZodSerializerInterceptor`) ตัดฟิลด์ที่ไม่อยู่ใน DTO และ usecase ยังคัดลอกฟิลด์ทีละตัวเอง ความลับที่เข้ารหัสไว้จึงไม่มีทางหลุดไปเบราว์เซอร์
- migration ที่อยู่ใน git แล้ว **ห้ามแก้** ให้เพิ่มอันใหม่เสมอ

---

## 5. API

### ทำแล้ว (16 endpoint: API ของ v1 ครบ)

| Method | Path | ทำอะไร |
|---|---|---|
| GET | `/api/health` | ตรวจ server และฐานข้อมูล |
| GET | `/api/settings` | สถานะการตั้งค่า (`configured`, login, provider, model) **ไม่ส่งคีย์กลับ** |
| PUT | `/api/settings/github` | ตรวจ token กับ GitHub แล้วเก็บแบบเข้ารหัส |
| PUT | `/api/settings/llm` | บันทึก provider/model/คีย์ (ไม่ส่งคีย์ = ใช้คีย์เดิม แต่เปลี่ยน provider ต้องส่งคีย์ใหม่) |
| POST | `/api/settings/llm/test` | เรียก LLM จริงด้วยคำขอเล็ก ๆ ตอบ `ok`/`error`/`latencyMs` |
| GET | `/api/repos/available?q=` | repo ที่ token เข้าถึงได้ (ไม่รวม archived) |
| GET | `/api/repos` | repo ที่เฝ้าอยู่ |
| POST | `/api/repos` | เพิ่ม repo (ตรวจกับ GitHub ก่อน เก็บตัวพิมพ์ตาม GitHub และจด baseline: ดูหัวข้อ 6) |
| PATCH | `/api/repos/:id` | หยุด/เริ่มเฝ้า (`enabled`) |
| DELETE | `/api/repos/:id` | ลบแบบซ่อน (เก็บประวัติรีวิว เพิ่มซ้ำจะฟื้นแถวเดิม) |
| POST | `/api/reviews/poll` | "ตรวจตอนนี้" body `{ repositoryId }` ตอบ `{ queued, error }` (poll ที่ล้มก็ตอบ 200 พร้อมเหตุผล) |
| POST | `/api/reviews` | ขอรีวิวด้วยมือ สร้างแถว `queued` และเข้าคิว |
| GET | `/api/reviews` | ประวัติ แบ่งหน้าด้วย cursor กรองด้วย `repositoryId`/`status` มี `findingCounts` |
| GET | `/api/reviews/status` | สถานะ worker: คิว (กี่รายการรอ, กำลังรันอะไร) และ poller (รอบล่าสุด, รอบถัดไป) |
| GET | `/api/reviews/:id` | รายละเอียดรีวิว + findings เรียงตามความรุนแรง |
| POST | `/api/reviews/:id/retry` | ลองใหม่ **เฉพาะรีวิวที่ `failed`** (อย่างอื่นตอบ 409) |

เอกสารเชิงโต้ตอบ: `/api/docs` (Swagger UI)

ไม่เหลือแล้ว ฝั่ง API ของ v1 ครบ

หมายเหตุ: `status` อยู่ใต้ `/reviews` ไม่ใช่ `/api/status` ตามแผนเดิม (ให้ `ReviewsController` ถือทุกอย่างของรีวิวและการตรวจ PR) และตอบเฉพาะสถานะของ worker ส่วน "การตั้งค่าครบหรือยัง" ให้หน้าเว็บประกอบเองจาก `GET /settings` และ `GET /repos`

---|---|---|
| GET | `/api/status` | E7 |

---

## 6. ข้อมูล (Prisma, ฐานข้อมูล Postgres)

schema แยกไฟล์ใน `apps/server/prisma/schema/`: `base`, `enums`, `settings`, `repository`, `review`, `finding`

- **Settings**: แถวเดียว (id = 1) เก็บ token และคีย์ **แบบเข้ารหัส** (AES-256-GCM รูปแบบ `v1:iv:tag:ciphertext` กุญแจจาก `ENCRYPTION_KEY`) ถ้าเปลี่ยน `ENCRYPTION_KEY` ค่าที่เก็บไว้ถอดไม่ได้ ผู้ใช้ต้องกรอกใหม่ (ระบบแจ้งข้อความชัดเจน)
- **Repository**: `baselineShas` = head commit ของ PR ที่เปิดอยู่ตอนเพิ่ม repo (poller ไม่รีวิวเอง) `enabled` = หยุดชั่วคราว (ยังเห็นในรายการ) ส่วน `removedAt` = ผู้ใช้ลบ (ซ่อน แต่เก็บประวัติ) สองสถานะนี้แยกกัน
- **Review**: `unique(repositoryId, prNumber, headSha)` คือกลไกกันรีวิว commit เดียวซ้ำ สถานะ `queued → running → posted | failed | skipped`
- **Finding**: ผูกกับ Review (ลบตามกัน)
- ต่อฐานข้อมูล 2 URL: `DATABASE_URL` (ตอนรัน, Supabase transaction pooler :6543) และ `DIRECT_URL` (ตอน migrate, session pooler :5432 หรือ direct) ตอนนี้ dev ใช้ Postgres ใน Docker ตัวเดียวกันทั้งสอง URL

Migration ที่มี: `init`, `add_repository_removed_at`, `lowercase_enums`, `add_repository_baseline_shas`

---

## 7. สิ่งที่เปลี่ยนจากแผนเดิม (และเหตุผล)

| เรื่อง | แผนเดิม | ที่ทำจริง | เหตุผล |
|---|---|---|---|
| NestJS | 11 (ในแผน) ติดตั้งได้ 12 | ใช้ **11** | `nestjs-zod` ยังไม่รองรับ 12 |
| Prisma | 7 | ตรึง **7.10.1** | ค่าเริ่มต้นของ `pnpm add` ให้ CLI รุ่น 8 rc ไม่ตรงกับ client |
| AI SDK | v6 | **v7** | เป็นรุ่นที่ได้ตอนติดตั้ง API ที่ใช้เหมือนกัน |
| `temperature: 0` | ตั้งไว้ | **ไม่ตั้ง** | โมเดลรุ่นใหม่บางตัวไม่รับค่านี้ |
| timeout เรียก LLM | ไม่มี | **10 นาที** (ตั้งเองได้) | กันผู้ให้บริการที่ค้างจนคิวติดทั้งแถว |
| baseline ตอนเพิ่ม repo | แถว `skipped` ในตาราง Review | คอลัมน์ **`baselineShas`** ที่ repo | แผนเดิมต้องให้โมดูล repos เขียนตารางของ reviews (หรือเรียกกลับจนเป็นวงกลม) และประวัติจะเต็มไปด้วยแถว skipped พฤติกรรมเหมือนเดิม: PR เก่าไม่ถูกรีวิว แต่ commit ใหม่และ PR ใหม่ถูกรีวิว |
| ลบ repo | `enabled = false` | คอลัมน์ **`removedAt`** | `enabled` ใช้เป็นสวิตช์หยุดชั่วคราวอยู่แล้ว |
| enum ใน DB | ตัวพิมพ์ใหญ่ | **ตัวพิมพ์เล็ก** | ตัด mapper ที่ต้องมีถึง 4 ตัว |
| OpenAPI | (ค่าเริ่มต้น 3.0) | **3.1** | nestjs-zod สร้าง schema แบบ 3.1 ต้องให้หัวไฟล์ตรงกัน |
| ตัวจับเวลา poller | `@nestjs/schedule` | **`setInterval`** ตัวเดียว | ความถี่มาจาก `.env` (decorator ของแพ็กเกจรับได้เฉพาะค่าตายตัว) และไม่ต้องเพิ่ม dependency |
| `tsc` incremental | ใส่ไว้ | **เอาออก** | Nest ลบ `dist` ทุกครั้ง แคชของ tsc ทำให้ build ครั้งที่สองขาดไฟล์เงียบ ๆ |
| DB สำหรับ dev | Supabase cloud/local | **Postgres ใน Docker** (`pnpm db:up`, พอร์ต 54322) | ผู้ใช้เลือก ยังไม่ได้ลอง Supabase จริง |
| ฟอนต์ของเว็บ | Geist จาก Google Fonts (ค่าเริ่มต้นของ shadcn) | **ฟอนต์ของระบบ** | `next/font/google` ดาวน์โหลดตอน build ถ้าเข้าเน็ตไม่ได้ build ล้ม |
| TypeScript ของเว็บ | (ไม่ระบุ) | ตรึง **5.9** | `pnpm add` ให้ 7.0 (คอมไพเลอร์ตัวใหม่) ต่างรุ่นกับส่วนอื่นของ repo |
| หน้ารายละเอียดรีวิว | `/reviews/[id]` | **`/reviews/view?id=`** | static export ของ Next.js ใช้ route แบบ dynamic ไม่ได้ |

---

## 8. สิ่งที่ยืนยันแล้ว และยังไม่ได้ยืนยัน

### ยืนยันแล้ว (ทดสอบกับของจริง)
- ดึง PR และไฟล์จาก GitHub, แยก diff, แปะเลขบรรทัด, เรียก LLM แบบ structured output (เจ้าของโปรเจกต์ลอง `--dry-run` กับ Gemini แล้ว)
- ตรวจ token ปลอมกับ GitHub, ตรวจคีย์ปลอมกับ Anthropic/OpenAI/Google (ได้ข้อความ error ที่อ่านรู้เรื่อง)
- ดึงรายการ repo จริง (114 repo), เพิ่ม repo พร้อมตรวจกับ GitHub (404, archived, ซ้ำ, ตัวพิมพ์ต่าง)
- unique constraint กันรีวิวซ้ำ **รวมกรณียิง 3 คำขอพร้อมกัน** (ได้ 1 แถว) และผ่าน driver adapter ของ Prisma
- การเคลมรีวิว: 5 ตัวแย่งกัน ชนะ 1 ตัว
- บันทึกผลรีวิวพร้อม findings ใน transaction, pagination ที่เวลาเท่ากันเป๊ะไม่ซ้ำไม่ตก
- ทั้งสาย POST → คิว → ตัวรัน → GitHub จริง → LLM (คีย์ปลอม) จบที่ `failed` พร้อมข้อความ

### ยังไม่ได้ยืนยัน
- **เส้นทางสำเร็จเต็มเส้นผ่าน server** (LLM ตอบจริง → โพสต์รีวิวขึ้น PR → บันทึก `posted`) แต่ละส่วนทดสอบแยกแล้ว (สคริปต์ `core --post` และการบันทึกผลฝั่ง server) แต่ยังไม่เคยต่อกันด้วยคีย์ที่มีเครดิตจริง
- ปุ่ม **Commit suggestion** ของ GitHub ว่าใช้ได้กับบรรทัดที่คอมเมนต์จริง
- **Supabase** (cloud และ local) และพฤติกรรมของ pooler `:6543`/`:5432` จะลองตอน G2
- การซ่อนคีย์ใน error: ทดสอบด้วย unit test เท่านั้น (ผู้ให้บริการที่ลองจริงไม่ส่งคีย์กลับมา)
- `POST /api/repos` และ `GET /api/repos/available` ผ่าน HTTP ด้วย token ที่เก็บเข้ารหัสใน DB จริง (ทดสอบผ่านคลาสจริงด้วย token จาก environment)

### ข้อจำกัดที่ยอมรับใน v1
- คิวอยู่ใน memory เก็บแค่ id ข้อมูลจริงอยู่ใน DB ดับแล้วคิวหาย ตอนเริ่มระบบใหม่จะกู้จาก DB
- **รีวิวซ้ำบน GitHub ได้ในช่องแคบ ๆ**: ถ้า server ดับหลังโพสต์รีวิวขึ้น GitHub สำเร็จแต่ก่อนบันทึกผลลง DB การกู้ตอนเริ่มระบบจะรีวิว commit เดียวกันอีกครั้ง (ทางเลือกที่ปลอดภัยกว่า: ทำเครื่องหมาย `failed` แล้วให้ผู้ใช้กดลองใหม่เอง)
- **รันได้ instance เดียว** ถ้าเปิดสองตัวชี้ DB เดียวกัน การเคลมยังกันซ้ำได้ แต่การกู้ตอนเริ่มระบบ (E4) อาจดึงงานของอีกตัวมารันซ้ำ ต้องระบุใน README
- ไม่มีระบบล็อกอินหน้าเว็บ จึงตั้งให้ฟังที่ `127.0.0.1` เท่านั้น ห้ามเปิดให้เครือข่ายภายนอกเข้าถึง
- รีวิวโพสต์ในนามเจ้าของ token และใช้ `COMMENT` เสมอ (GitHub ไม่ให้ request changes/approve PR ของตัวเอง)
- ไม่มี retry อัตโนมัติ ล้มแล้วอยู่ที่ `failed` จนกดลองใหม่เอง
- ไม่มีการหมุนกุญแจเข้ารหัส (เวอร์ชัน `v1:` ในค่าที่เก็บเผื่อไว้)
- ไฟล์เดียวที่ใหญ่เกินงบ ~60k ตัวอักษรจะไม่ถูกรีวิว (บันทึกเหตุผลไว้)
- `cursor` ที่ไม่มีอยู่จริงได้รายการว่าง ไม่ใช่ 400

---

## 9. ขั้นที่เหลือ

แต่ละขั้นทำและทดสอบทีละขั้น ตามที่ผู้ใช้ต้องการ

### Phase E (ต่อ)
- ~~**E4 retry และกู้งานค้าง**~~ **เสร็จแล้ว**: `POST /reviews/:id/retry` (failed → queued แล้วเข้าคิว; ใช้ conditional update จึงยิงพร้อมกัน 25 คำขอชนะ 1) และตอนเริ่ม server เปลี่ยนแถว `running` ที่ค้างกลับเป็น `queued` แล้วเข้าคิวทั้งหมดของ `queued` เรียงเก่าก่อน ทดสอบโดยตั้ง DB ให้เหมือน server ดับกลางคัน แล้วเปิดใหม่: ทั้งสามรีวิวที่ค้างถูกหยิบไปทำ ส่วนรีวิวที่ `failed`/`posted` อยู่แล้วไม่ถูกแตะ
- ~~**E5 poller**~~ **เสร็จแล้ว**: `PollerWorker` poll ทันทีตอนเริ่ม แล้วทุก `POLL_INTERVAL_SECONDS` วนทุก repo ที่ `removedAt = null AND enabled = true` ดึง PR ที่เปิดอยู่ ข้าม draft และบอท สร้างแถว `queued` ให้ commit ที่ยังไม่มีรีวิว (ซ้ำถูกกันด้วย unique constraint) และบันทึก `lastPolledAt`/`lastError` ต่อ repo repo ที่พังไม่ทำให้ repo อื่นหยุด ทดสอบกับ GitHub จริง: repo ปกติ, repo ที่ไม่มีอยู่ (บันทึก error), repo ที่หยุด/ลบ (ไม่ถูกแตะ) และรอบที่สองไม่สร้างรีวิวซ้ำ
- ~~**E6 poll ทันที และ baseline**~~ **เสร็จแล้ว**: `POST /reviews/poll` (ส่ง `repositoryId` ใน body; วางใน `ReviewsController` เพราะ reviews พึ่ง repos อยู่แล้ว ถ้าวางใน repos จะเป็นวงกลม) และเมื่อเพิ่ม repo (รวมถึงฟื้น repo ที่เคยลบ) จะอ่าน PR ที่เปิดอยู่แล้วจด head commit เป็น baseline ก่อนบันทึก ถ้าอ่านไม่ได้จะ **ไม่เพิ่ม repo** (ไม่งั้นจะรีวิวทุก PR พร้อมกัน) ต้องทำตอนเพิ่ม ไม่ใช่ตอน poll รอบแรก เพราะผู้ใช้ที่เพิ่ม repo แล้วเปิด PR ทดสอบทันทีจะถูกข้ามเงียบ ๆ ทดสอบกับ GitHub จริง: เพิ่ม repo ที่มี PR #1 เปิดอยู่ → poll แล้วไม่มีรีวิว; เมื่อ PR มี commit ใหม่ (จำลอง) → ถูกรีวิว 1 ครั้ง
- ~~**E7 สถานะ**~~ **เสร็จแล้ว**: `GET /reviews/status` เป็นสถานะสดในหน่วยความจำของ process นี้ จึงมีความหมายเมื่อรัน instance เดียว

### Phase F: เว็บ (Next.js `output: 'export'`, Tailwind, shadcn/ui, Orval + React Query)
- ~~F1 โครงเว็บ~~ **เสร็จแล้ว**: Next.js 16 `output: 'export'` + `trailingSlash` (ได้ `settings/index.html` ซึ่ง static server ธรรมดาเสิร์ฟได้), Tailwind 4, shadcn/ui (สไตล์ `radix-nova`, มี `button` `card` `badge`), เมนูหลัก (ไฮไลต์หน้าปัจจุบัน), ธีมมืด/สว่างตามระบบ และหน้าเปล่า 5 หน้าบอกว่าจะแสดงอะไร (`/`, `/settings`, `/repos`, `/reviews`, `/reviews/view?id=`) ตรวจแล้ว: build ได้ 7 หน้า ขนาดรวม ~1 MB ไม่มีการเรียก URL ภายนอก และในเบราว์เซอร์จริงอ่าน `?id=` ได้ เมนูไฮไลต์ถูก
  - `shadcn` รุ่นนี้ใช้แพ็กเกจ `cn` (ของ shadcn เอง) แทน `clsx` + `tailwind-merge` ตรวจแล้วว่าเจ้าของและ repo ตรงกับ shadcn
- ~~F2 ต่อ Orval~~ **เสร็จแล้ว**: `orval.config.ts` อ่าน `apps/server/openapi.json` สร้าง client + React Query hook 16 ตัว (`useGetStatus`, `useListReviews`, `useAddRepo`, ...) ไว้ที่ `apps/web/src/api/generated/` (**ไม่ commit** สร้างตอน `prebuild` และด้วย `pnpm gen:api` ที่ root)
  - `src/api/fetcher.ts` เป็นทางผ่านเดียวของทุกคำขอ: โยน `ApiError` (พร้อมข้อความที่แสดงให้ผู้ใช้ได้ เช่น "Could not reach the diffy server. Is it running?" และรวม error ของ Zod validation) เมื่อเครือข่ายล้มหรือ HTTP ไม่ใช่ 2xx ทำให้ hook เข้าสถานะ error จริง `.env.development` ตั้ง `NEXT_PUBLIC_API_URL` ให้ `next dev`; build จริงเว้นว่างเพื่อเรียก API origin เดียวกัน
  - `Providers` (React Query) ไม่ retry error 4xx
  - **CORS ที่ server เปิดเฉพาะตอนพัฒนา** และเฉพาะ origin `localhost:3000`/`127.0.0.1:3000` (เว็บ dev) (ไม่ใช่ `*` เพราะไม่มีระบบล็อกอิน) ปิดเมื่อ `NODE_ENV=production` (สคริปต์ `pnpm start` ใน G1 ต้องตั้งค่านี้)
  - ปิด `agentRules` ใน `next.config.ts` เพราะ `next dev` เขียนไฟล์ `AGENTS.md` (คำแนะนำสำหรับ AI tool) ลงโปรเจกต์เอง
  - ตรวจแล้ว: เปลี่ยนชื่อฟิลด์ใน DTO ของ server → `pnpm gen:api` → หน้าเว็บ compile ไม่ผ่านทันที; ในเบราว์เซอร์จริงแดชบอร์ดแสดง live และเมื่อหยุด API ขึ้น "unreachable"
  - ข้อควรระวังสำหรับ F7: React Query เก็บข้อมูลล่าสุดไว้ตอน error ข้อมูลเก่าจึงยังค้างใต้ข้อความ error ควรจางหรือซ่อน
- ~~F3 `/settings`~~ **เสร็จแล้ว**: การ์ด GitHub (กรอก token → ตรวจกับ GitHub → ขึ้น "Connected as @login" พร้อมปุ่ม Replace/Cancel; token ถูกล้างออกจากหน้าทันทีที่บันทึกและไม่ถูกแสดงอีก) และการ์ดโมเดล (provider, model พร้อมตัวอย่างชื่อ, API key, ปุ่ม Save และ Test)
  - กฎที่หน้าบังคับตรงกับ server: เปลี่ยน provider ต้องกรอกคีย์ใหม่ (มีคำอธิบายและปุ่ม Save ปิด), เว้นคีย์ว่างเมื่อ provider เดิม = ใช้คีย์เดิม, Test ใช้ได้เฉพาะค่าที่บันทึกแล้วและผลทดสอบจะซ่อนทันทีที่แก้ฟอร์ม
  - ใช้ `useState` ธรรมดา (ไม่ใช้ไลบรารีฟอร์ม) เพราะมีแค่ 1 และ 3 ช่อง
  - ตรวจในเบราว์เซอร์จริง (ด้วยค่าปลอมเท่านั้น): token ปลอม → ข้อความจาก GitHub จริงแสดงสีแดง, บันทึก LLM → ขึ้น Configured และช่องคีย์ถูกล้าง, Test → `invalid x-api-key` จาก Anthropic, เปลี่ยน provider → ต้องกรอกคีย์ใหม่, รีโหลดแล้วข้อมูลกลับมา **ไม่ได้ทดสอบ:** กรณี token ถูกต้องจริงผ่านหน้าเว็บ (จำลองสถานะเชื่อมต่อด้วยแถวใน DB) เพราะไม่ควรกรอก token จริงของผู้ใช้ลงฟอร์ม
  - ต้องเปลี่ยน Orval ให้คืนเฉพาะ body ของคำตอบสำเร็จ (`includeHttpResponseReturnType: false`): ชนิดเดิมรวมสถานะ error ที่ประกาศไว้ (`void`) ทำให้ `data` เป็น `ผลลัพธ์ | void` ทั้งที่ fetcher โยน error ไปแล้ว หน้าจึงใช้ `settings.data?.github` ไม่ใช่ `.data.data`
  - **พบและแก้ข้อผิดพลาดใน `openapi.json`:** ฟิลด์ระดับบนสุดของ DTO ที่เป็น `z.string().nullable()` ถูก `@nestjs/swagger` อธิบายผิดเป็น "array ของ string" (7 จุด เช่น `lastError`, `nextCursor`) และ client ที่ generate ก็ผิดตามโดยยัง compile ผ่าน แก้โดยใส่ `.describe()` ให้ string (Zod จึงเขียนเป็น `anyOf`) และมี test `openapi.test.ts` คอยตรวจ (ทดสอบแล้วว่าจับได้) **กติกาสำหรับ DTO ใหม่:** string ที่ nullable ต้องมี `.describe(...)`
- ~~F4 `/repos`~~ **เสร็จแล้ว**: ตาราง "Watching" (สวิตช์หยุด/เริ่ม, ป้าย Paused, "ตรวจล่าสุด" เป็น "5 minutes ago", error ล่าสุดสีแดง, ปุ่ม Check now ที่บอกผล "Queued N reviews" หรือ "The check failed", ปุ่ม Remove สองจังหวะ Confirm/Cancel) และการ์ด "Add a repository" (ค้นหาแบบ debounce 300 ms, ป้าย private, "Watching" สำหรับที่เฝ้าอยู่แล้ว, ข้อความ error ของ server เช่น archived/ซ้ำ, ลิงก์ไป Settings ถ้ายังไม่เชื่อม GitHub)
  - **ไม่มี cache** (ผู้ใช้ตัดสิน): ทุกการค้นหาถาม GitHub ใหม่ จึงใช้เวลาหลายวินาทีเมื่อมี repo เป็นร้อย (วัดจริง ~4 วินาทีกับ 114 repo) หน้าเว็บรอให้ผู้ใช้หยุดพิมพ์ 300 ms ก่อนส่ง และแสดง "Searching…" ระหว่างรอ โดยยังโชว์ผลเก่าไว้ ถ้ารู้สึกช้าเกินไป ทางออกที่เบาที่สุดคือเก็บรายการไว้ที่ server สั้น ๆ (เคยทำและถอดออกแล้ว)
  - เพิ่ม `vitest` ให้ `apps/web` สำหรับตรรกะล้วน (`lib/time.ts`: `timeAgo` พร้อมกรณีเวลาในอนาคตและค่าที่ไม่ใช่วันที่) และ hook `useDebouncedValue`
  - **วิธีทดสอบ:** ใช้ API จำลองนอกโปรเจกต์ที่ตอบข้อมูลสมมุติรูปแบบเดียวกับของจริง เพราะรายการ repo ต้องใช้ token จริงของผู้ใช้ ซึ่งไม่ควรใส่ในฟอร์มหรือ DB ทดสอบ: ค้นหา, เพิ่ม (รวม error archived), สวิตช์, Check now (สำเร็จและล้มเหลว), ลบ และตรวจกับ **API จริง** ที่ยังไม่มี token (ข้อความและลิงก์ไป Settings) การเพิ่ม repo จริงกับ GitHub ทดสอบแล้วใน D1–D3 ฝั่ง server **ยังไม่ได้เห็นหน้านี้กับ GitHub จริงต่อกันครบ** (ลองเองได้เมื่อมี token)
  - ระหว่างทดสอบเจอ error ของ React เรื่อง key ซ้ำ: เป็นบั๊กของ API จำลอง (id ซ้ำ) ไม่ใช่ของแอป; และเจอจริงหนึ่งอย่างที่แก้แล้ว คือข้อความ error ของการ "Add" ครั้งก่อนค้างอยู่ใต้คำค้นใหม่ (ตอนนี้ล้างเมื่อพิมพ์)
- ~~F5 `/reviews`~~ **เสร็จแล้ว**: ตารางประวัติ (เวลา "x ชั่วโมงที่แล้ว", repo, PR ที่เปิดไป GitHub ได้, commit 7 ตัว, สถานะเป็นป้ายสี, จำนวน finding แยกตามความรุนแรง, ข้อผิดพลาดของรีวิวที่ล้มใต้ชื่อ PR, ลิงก์ Open ไป `/reviews/view/?id=`), ตัวกรอง repo และสถานะ (ใช้ร่วมกันได้) พร้อมปุ่ม Clear filters, ปุ่ม Load more ด้วย cursor (`useInfiniteQuery`) และสถานะว่างสองแบบ ("ยังไม่มีรีวิว" กับ "ไม่มีรีวิวตรงตัวกรอง")
  - **อัปเดตเองขณะรอ:** ตราบใดที่มีรายการ queued/running ในรายการที่โหลดอยู่ หน้าจะถามซ้ำทุก 5 วินาที (ทุกหน้าที่โหลดไว้ เรียงตาม cursor ใหม่) จนทุกรายการนิ่ง แล้วหยุดถามเอง
  - `ReviewStatusBadge` และ `SeverityBadge` อยู่ใน `src/components/` เพราะ F6 ใช้ด้วย (สีมีคำกำกับเสมอ ไม่พึ่งสีอย่างเดียว)
  - ตรวจใน Chrome ด้วย API จำลอง (รีวิว 45 รายการ, cursor, ตัวกรอง; รายการ "Running" เปลี่ยนเป็น "Posted" เองภายใน ~12 วินาทีโดยไม่รีเฟรช; Load more 3 ครั้งจนครบ 45 ไม่ซ้ำไม่ตก) และกับ API จริงที่ DB ว่าง คอนโซลสะอาด **ยังไม่ได้ดูกับรีวิวจริงที่ผ่าน LLM**
- **ปรับหน้า `/reviews` หลัง F7**: การ์ดสถิติ 4 ใบด้านบน (ทั้งหมด / เดือนนี้ / สัปดาห์นี้ / 24 ชม.) กดแล้วเป็นตัวกรองเวลา กดซ้ำเพื่อกลับไปทั้งหมด, ช่องค้นหา (ชื่อ PR, repo, `#เลข`, ต้นของ commit), ตารางทั้งแถวกดเข้ารายละเอียดได้ พร้อมปุ่ม Re-review ท้ายแถวที่ `failed` (ใช้ `POST /reviews/:id/retry`). ฝั่ง API เพิ่ม `GET /reviews/stats` และพารามิเตอร์ `period` (`day`/`week`/`month`; สัปดาห์เริ่มวันจันทร์, เดือนเริ่มวันที่ 1, ตามเวลาของเครื่องที่รัน server) กับ `q` ใน `GET /reviews`
- ~~F6 `/reviews/view?id=`~~ **เสร็จแล้ว**: หัวหน้า (PR, สถานะ, repo, commit, เวลาเริ่ม+ใช้เวลานานเท่าไร, โมเดล+token, ลิงก์ไปดูรีวิวบน GitHub), สรุป, findings จัดกลุ่มตามความรุนแรง (critical→low) การ์ดละหนึ่งอัน มี path:line, ป้าย inline/summary, คำอธิบาย, โค้ดที่แนะนำ, fix prompt พร้อมปุ่ม Copy; รีวิวที่ `failed` แสดงกล่อง error และปุ่ม Retry; รีวิวที่ยังทำอยู่รีเฟรชเองทุก 4 วินาที; ข้อความจากโมเดลแสดงเป็นข้อความธรรมดาเสมอ (ไม่ render HTML); มีสถานะ ไม่มี id / ไม่พบรีวิว / error
- ~~F7 `/` แดชบอร์ด~~ **เสร็จแล้ว**: เช็กลิสต์ตั้งค่า 3 ข้อ (GitHub, โมเดล, repo; ซ่อนเองเมื่อครบ), กล่อง "Right now" (รีวิวที่กำลังทำ, คิว, poller รอบล่าสุด รีเฟรชทุก 5 วินาที; ถ้า server ไม่ตอบจะแสดงตัวเลขเก่าแบบจางพร้อมป้าย "Server unreachable"), 10 รีวิวล่าสุด (ตารางเดียวกับหน้า Reviews ผ่าน `ReviewsTable`/`ReviewRow` ใน `src/components/`)
- ตัดสินแล้ว: **ไม่ commit client ที่ Orval สร้าง** commit เฉพาะ `openapi.json` ผู้ใช้ที่ clone มา build ได้เลยเพราะ `prebuild` สร้างให้ และ diff ของ PR ไม่ถูกกลบด้วยโค้ดที่สร้างอัตโนมัติ

### Phase G: ส่งมอบ
- **G1 process เดียว**: `ServeStaticModule` เสิร์ฟ `apps/web/out` ที่ `/` (ยกเว้น `/api`) และสคริปต์ root `pnpm start` = build → `prisma migrate deploy` → start (ตอนนี้ **ยังไม่มี** `pnpm start`)
- **G2 เอกสารและทดสอบ clone ใหม่**: README พร้อมขั้นตอน Supabase cloud และ local ทดสอบทั้งสองแบบ รวมการตั้งค่า pooler

### Phase R: ทำให้รีวิวละเอียดขึ้น (วางแผน 26 ต.ค. 2026)
**หลักคิด** ตัวที่ละเอียด (CodeRabbit, PR-Agent/Qodo, Greptile, Devin Review) ละเอียดเพราะให้โมเดลเห็น **context มากกว่า diff** และมีรอบตรวจสอบก่อนโพสต์ ไม่ใช่เพราะ prompt เก่งกว่า ก่อนเริ่มทำ diffy ส่งแค่ diff กับคำอธิบาย PR

**ตัดสินใจแล้ว**
- `.diffy.yaml` อ่านจาก **branch หลัก (default branch) ไม่ใช่จาก PR** กันคนเปิด PR แก้ไฟล์เพื่อปิดการรีวิวของตัวเอง
- ภาษาเริ่มต้นเมื่อไม่มีไฟล์ = `en` และ **fix prompt เป็นภาษาอังกฤษเสมอ** (coding agent ทำงานกับภาษาอังกฤษดีกว่า) `language` กระทบแค่สรุป ชื่อ และคำอธิบายของ finding
- ลำดับความสำคัญของกฎ: สิ่งที่คนเขียน (`.diffy.yaml`, instructions) > ไฟล์กฎของโปรเจกต์ > profile ที่ LLM สรุป ถ้าขัดกันข้อที่คนเขียนชนะ
- เอกสารจาก repo ถูกห่อเป็นข้อมูล ไม่ใช่คำสั่ง (กัน prompt injection) ยกเว้น instructions ใน `.diffy.yaml` ซึ่งมาจากผู้ดูแลบน branch หลัก

**ขั้นตอน (ทำทีละขั้น ทดสอบแล้วค่อยไปต่อ)**
- ~~**R1 `.diffy.yaml`**~~ **เสร็จแล้ว** ต่อ repo: `language` (th/en), `profile` (chill/assertive), `instructions`, `instructions_file`, `path_instructions` (path + instructions), `ignore` (glob) ตรวจด้วย Zod ค่าที่ผิดไม่ทำให้รีวิวล้ม แต่รายงานในสรุปของรีวิว
- ~~**R2 README และไฟล์กฎ**~~ **เสร็จแล้ว** (ตั้งงบด้วย `MAX_CONTEXT_CHARS` ค่าเริ่มต้น 30,000 ตัวอักษร 0 = ปิด ไฟล์ละไม่เกิน 10,000 เรียง: `context_files` > `AGENTS.md`/`CLAUDE.md`/`.cursorrules`/`copilot-instructions.md` > README > CONTRIBUTING ไฟล์ที่เนื้อหาซ้ำกันอ่านครั้งเดียว รีวิวบอกท้ายสรุปว่าอ่านไฟล์ไหน) อ่าน `README.md` ทุกครั้ง บวกไฟล์กฎที่ตรวจเจอเอง (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`) และ `context_files` ใน `.diffy.yaml` ใช้งบแยกจากงบ diff
- **R2b project profile** (ในหน้าเว็บและท้ายรีวิวเรียกว่า **"project brief"** ในโค้ดและ API ยังใช้ชื่อ profile) ตอนเพิ่ม repo ให้ LLM อ่านแบบเลือก (**ไม่อ่านทั้ง repo** เพราะแพงและไม่ได้คุณภาพเพิ่มตาม) แล้วสรุปเป็นเอกสารสั้น (ไม่เกิน 6,000 ตัวอักษร: ภาพรวม, สถาปัตยกรรม, convention, จุดที่มักพัง) เก็บใน DB ต่อ repo แนบทุกครั้งที่รีวิว แบ่งเป็น 4 ขั้นย่อย:
  - ~~**R2b-1 ตัวสร้าง profile ใน `packages/core`**~~ **เสร็จแล้ว** (`profile-files.ts` เลือกไฟล์: โครงโฟลเดอร์, README/ไฟล์กฎ/ARCHITECTURE, config (package.json, tsconfig, eslint, workflow, prisma/drizzle...), ไฟล์ตัวอย่างโค้ดไฟล์ละโฟลเดอร์ (ไฟล์ขนาดกลาง ไม่ใช่ใหญ่สุด) 12 โฟลเดอร์ที่คึกคักที่สุด, test ตัวอย่าง 3 ไฟล์, PR ที่ merge ล่าสุด 15 อัน; `profile.ts` เรียก LLM ครั้งเดียวแบบ structured output ทุก convention/pitfall ต้องระบุไฟล์หลักฐาน แล้วตรวจว่าไฟล์มีจริง กฎที่อ้างไฟล์ที่ไม่มีถูกทิ้ง) ทดสอบกับ `cuatclub-web` (385 ไฟล์): อ่าน 30 ไฟล์ ราว 63,000 ตัวอักษร (~16k token) ต่ำกว่าที่ประเมินไว้เดิม 150–300k token มาก
  - ~~**R2b-2 DB และ server**~~ **เสร็จแล้ว** ตาราง `RepoProfile` (migration `20261026000000_add_repo_profile`, enum `ProfileStatus` อยู่ใน `@diffy/shared` ด้วย) โมดูล `profiles` (`ProfilesService` เป็น API สาธารณะ, `ProfileBuilderWorker` สร้างทีละ repo ในหน่วยความจำ เริ่มใหม่ตอนบูตถ้าค้างอยู่) **poller เริ่มสร้าง profile ให้ repo ที่ยังไม่มี** (รอจน GitHub กับโมเดลตั้งค่าครบ ไม่สร้างซ้ำอัตโนมัติถ้าล้ม เพราะอาจเสียค่าโมเดล ต้องกด Rebuild) endpoint: `GET /repos/:id/profile` (404 ถ้ายังไม่มี), `PUT /repos/:id/profile/notes` (ไม่เกิน 10,000 ตัวอักษร), `POST /repos/:id/profile/rebuild` (409 ถ้ากำลังสร้าง) Rebuild ไม่แตะ notes และ profile เดิมคงอยู่จนอันใหม่เสร็จ (ล้มก็ไม่หาย) รีวิวแนบ profile (เฉพาะเมื่อมีเนื้อหา) และ notes (ถือเป็น instructions ของผู้ดูแลต่อท้าย `.diffy.yaml`) ท้ายรีวิวบน GitHub บอก "Read for context: the project profile, ..." **ทดสอบจริงแล้ว** ด้วย repo ทั้ง 4 ของผู้ใช้: ทุกอันสร้างเสร็จภายใน ~20 วินาที (12–23k token เข้า, ~1k ออก, `gemini-3.5-flash-lite`) profile ของ `cuatclub-web` ตรงกับ `AGENTS.md` และรีวิวซ้ำบน `diffy-sandbox` PR #3 ใช้ profile จริง
  - ~~**R2b-3 หน้าเว็บ**~~ **เสร็จแล้ว** หน้า Repositories มีคอลัมน์ Brief (ป้าย Building/Ready/Failed/Not yet) **กดที่แถวไหนก็เปิด panel ด้านขวาได้** (เคอร์เซอร์เป็น pointer มีลูกศรท้ายแถว สวิตช์ ปุ่ม และ dialog ลบไม่เปิด panel): สถานะ เวลาที่สร้าง โมเดลที่เขียน commit ที่ใช้ token ปุ่ม Rebuild (หมุนระหว่างสร้าง) เนื้อหา profile (แปลง markdown เป็น element เองด้วย `lib/profileMarkdown.ts` ไม่ใช้ HTML) กล่อง error ถ้าสร้างล้ม (บอกว่ารีวิวยังใช้ตัวเก่า) และช่อง "Your notes" (ไม่เกิน 10,000 ตัวอักษร พร้อมตัวนับ, Save/Discard) ฝั่ง API เพิ่ม `GET /repos/profiles` (สถานะของทุก repo ในครั้งเดียว ไม่ต้องยิงทีละ repo ที่ได้ 404 เต็ม console)
  - **R2b-4 ทดสอบจริง** กับ `diffy-sandbox` ผ่านแอป
- ~~**R2c อัปเดต brief อัตโนมัติ**~~ **เสร็จแล้ว** (`profile-freshness.ts` + `ProfileFreshnessWorker`) วันละครั้งต่อ repo (poller เรียกต่อจากสร้าง brief ที่ขาด) เทียบ commit ที่สร้าง brief กับหัว branch ผ่าน compare API ของ GitHub (1 call) ถือว่าเก่าเมื่อ: ไฟล์ที่บอกว่าโปรเจกต์เป็นอะไร/เขียนอย่างไรเปลี่ยน (README, AGENTS.md, CLAUDE.md, CONTRIBUTING, เอกสาร architecture/design/conventions, config ตามรายการของ profile, workflow, prisma schema) หรือไฟล์ทั่วไปเปลี่ยน ≥ 60 ไฟล์ (ไม่นับ lockfile/ไฟล์ build) หรือ GitHub เทียบไม่ได้ (404/422 เช่น force-push) ข้อผิดพลาดอื่น (rate limit, เครือข่าย) ไม่ถือว่าเก่า แล้วลองใหม่รอบถัดไป brief ที่สร้างไม่ถึงวัน/กำลังสร้าง/ล้มเหลวจะไม่ถูกแตะ สร้างใหม่ทั้งชุด (ไม่ใช่แก้ทีละส่วน เพราะไม่เกินวันละครั้ง ~20 วินาที 12–23k token) เนื้อหาเก่ากับ Notes คงอยู่จนกว่าชุดใหม่เสร็จ เวลาที่ตรวจล่าสุดเก็บในหน่วยความจำ (รีสตาร์ทอาจตรวจซ้ำอีกหนึ่ง call)
- ~~**R3 context ทั้งฟังก์ชัน**~~ **เสร็จแล้ว** (`context-expand.ts`) แทนที่ 3 บรรทัดรอบการแก้ของ GitHub ด้วย: ฟังก์ชัน/เมธอด/คลาสที่ครอบการแก้ (หาจากการเยื้องและบรรทัดประกาศ รองรับ TS/JS, Python, Go, Java และอื่น ๆ พร้อมคอมเมนต์และ decorator ที่อยู่เหนือมัน ค้นขึ้นไปไม่เกิน 60 บรรทัด) บวก 3 บรรทัดข้างล่าง และ **ไฟล์เล็ก (ไม่เกิน 5,000 ตัวอักษร) แสดงทั้งไฟล์** อ่านไฟล์จาก commit ของ PR (พร้อมกันทีละ 5 ไฟล์) ใช้งบ `MAX_DIFF_CHARS` เดียวกัน (ไม่ทำให้รีวิวใหญ่เกินงบ) ใช้งบกับไฟล์โค้ดก่อน test ก่อนไฟล์อื่น (เล็กก่อน) ไฟล์ที่อ่านไม่ได้หรือไม่พอที่ก็ใช้ patch เดิม ปิดได้ด้วย `EXPAND_DIFF_CONTEXT=false` prompt บอกโมเดลว่าบรรทัดที่ไม่มี `+` คือบริบท ห้ามรายงานปัญหาที่มีอยู่แล้วในบรรทัดเดิม ทดสอบกับ PR จริงของ cuatclub/se-project: ขนาด prompt ของ diff เพิ่มเป็น 1.2–2.2 เท่า (เช่น PR #192: 27k → 60k ตัวอักษร ~15k token) ใช้เวลาอ่านไฟล์ 1–6 วินาที **ยังไม่ได้ทำ** (เก็บไว้ทีหลัง): ตาม import ไปดู signature ของสิ่งที่เรียกใช้
- ~~**R4 walkthrough**~~ **เสร็จแล้ว** โมเดลตอบเพิ่มอีกฟิลด์ `walkthrough` (ใน `LlmReview` ของ `@diffy/shared`): แบ่งไฟล์ของ PR เป็น 2–8 กลุ่มที่เกี่ยวข้องกัน แต่ละกลุ่มมีชื่อ คำอธิบาย 1–2 ประโยค ไฟล์ และความเสี่ยง (high/medium/low) `verifyWalkthrough` ตรวจว่าไฟล์มีอยู่จริงใน diff แต่ละไฟล์อยู่กลุ่มเดียว (กลุ่มที่เสี่ยงที่สุดที่อ้างถึงมัน) เรียงกลุ่มเสี่ยงสุดก่อน รวมไฟล์ที่ไม่มีกลุ่มเป็น "Other files" และ **ไม่ทำ walkthrough ให้ PR ที่แก้ไม่เกิน 2 ไฟล์** `renderWalkthrough` เขียนเป็นตาราง "Look closely / What changed / Files" ต่อจากสรุปในรีวิวบน GitHub (กัน `|` และขึ้นบรรทัดใหม่ในเซลล์ แสดงไฟล์ไม่เกิน 4 ต่อกลุ่ม) ภาษาตาม `language` ของ `.diffy.yaml` **ยังไม่ได้เก็บใน DB และยังไม่แสดงในหน้าเว็บ** (เห็นเฉพาะบน GitHub)
- ~~**R5 รอบตรวจสอบ**~~ **เสร็จแล้ว** (`verify.ts`) หลังโมเดลรีวิวเสร็จ เรียกโมเดลอีกครั้งให้ "พยายามหักล้าง" แต่ละ finding กับโค้ดของไฟล์ที่ finding อ้างถึง (ตรวจว่าโค้ดทำตามที่อ้างจริงไหม มีที่อื่นจัดการแล้วไหม เป็นปัญหาเดิมในบรรทัดที่ไม่ได้แก้ไหม หรือเป็นแค่การเดา) ตอบ `real` + `confidence` 0–100 ทิ้งข้อที่ไม่ real หรือมั่นใจต่ำกว่า 60 finding ที่ไม่มี verdict หรือไฟล์ไม่อยู่ใน prompt จะถูกเก็บไว้ (เงียบไม่ใช่การหักล้าง) ถ้าการตรวจล้มเหลวทั้งรอบ เก็บทุกข้อ รีวิวไม่พัง token ของรอบตรวจรวมในยอดของรีวิว footer บน GitHub บอก "N findings dropped after a second check" ปิดได้ด้วย `VERIFY_FINDINGS=false` (ไม่เรียกเลยถ้าไม่มี finding)
- **R6 แบ่งรีวิว PR ใหญ่ (เลื่อนไว้: ยังไม่มี use case ที่ diff ใหญ่ขนาดนั้น ทำเมื่อมีคนเจอจริง)** แบ่งไฟล์เป็นกลุ่มพอดีงบ รีวิวทีละกลุ่ม แล้วรวมเป็นสรุปเดียว แทนการตัดไฟล์ทิ้ง
- **R7 context ภายนอก** แบ่งเป็น 3 ส่วน:
  - ~~**R7a issue ที่ PR อ้างถึง**~~ **เสร็จแล้ว** (`linked-issues.ts`) อ่าน `Closes/Fixes/Resolves #N` (และรูป `owner/repo#N`, URL ของ issue, รวม `closed/fixed/resolved`, มี `:` ได้) จาก description ของ PR เฉพาะ repo เดียวกัน ไม่เกิน 3 ข้อ ไม่นับตัว PR เอง ดึง title + description (ตัดที่ 2,000 ตัวอักษร) ใส่ `<linked_issues>` ใน prompt ให้โมเดลรายงานเมื่อโค้ดทำต่างจากที่ issue ขอหรือขาดสิ่งที่ issue ต้องการ issue ที่อ่านไม่ได้ (ลบแล้ว/ไม่มีสิทธิ์) หรือจริง ๆ เป็น PR ถูกข้ามเงียบ ๆ footer บอก "issue #12" ในรายการที่อ่านเพื่อเป็น context **ยังไม่ทำ**: issue ที่ผูกผ่านแถบข้าง (Development) ของ GitHub โดยไม่เขียนใน description (ต้องใช้ GraphQL `closingIssuesReferences`)
  - ~~**R7b ผล CI ที่ล้ม**~~ **เสร็จแล้ว** (`ci-checks.ts`) อ่าน check run ของ head commit ที่ `failure`/`timed_out` (ไม่เกิน 3 ตัว) พร้อม title/summary (ตัดที่ 600 ตัวอักษร) และ annotation (ไฟล์:บรรทัด: ข้อความ ไม่เกิน 10 ต่อ check) ใส่ `<failed_checks>` ใน prompt ให้โมเดลหาสาเหตุในโค้ดที่แก้ ห้ามทวน log หรือรายงานความล้มเหลวที่สาเหตุไม่อยู่ใน diff อ่านไม่ได้ (token ไม่มีสิทธิ์ **Checks: read**, repo ไม่มี CI) ก็ข้ามเงียบ ๆ **ข้อจำกัด**: diffy ไม่รอ CI ที่ยังรันอยู่ ถ้ารีวิวเกิดตอน push ใหม่ ๆ มักยังไม่มีอะไรล้ม ได้ผลเมื่อกด Review again หลัง CI จบ **ยังไม่ทำ**: commit status แบบเก่า (ไม่ใช่ check run)
  - **R7c จำ finding ที่ทีมกดปิด** (ยังไม่ทำ) ต้องเก็บสถานะ comment ที่ถูก resolve/👎 ลง DB ก่อน

**ค่าใช้จ่าย** R2, R2b, R3, R5, R6 เพิ่ม token ต่อรีวิวทั้งหมด R3 กับ R6 มากที่สุด ใส่ค่าจำกัดใน `.diffy.yaml` และ `.env` ให้คุมได้ ตัวเลขใน Dashboard เห็นผลทันที

**ที่ทำแล้วก่อน Phase R** (ปรับให้รีวิว PR ใหญ่ดีขึ้น): ตัวกรองไฟล์ที่ระบบสร้างเองกว้างขึ้นและอ่าน `.gitattributes` (`linguist-generated`), เลือกไฟล์โค้ดก่อน test ก่อนไฟล์อื่น (เล็กก่อน), งบ diff 150,000 ตัวอักษร ตั้งได้ด้วย `MAX_DIFF_CHARS`

### Phase S — diffy เป็นบริการกลาง (diffy[bot])

ตัดสินใจแล้ว (28 ต.ค. 2026): **เลิกโหมด self-host** diffy เป็นบริการที่เปิดให้ทุกคนบน GitHub ใช้ มี GitHub App ตัวเดียว (`diffy`, แบบ public) ที่เจ้าของโปรเจกต์ถือ private key รีวิวขึ้นเป็น `diffy[bot]` ผู้ใช้ล็อกอินด้วย GitHub ติดตั้ง App บน account/org แล้วเลือก repo เอง **ผู้ใช้ใส่ API key ของ LLM เอง** ต่อ account (diffy ไม่จ่ายค่าโมเดล) host ยังไม่ตัดสินใจ (ตัวเลือก: Fly.io, Railway, Render + Supabase)

```
ผู้ใช้ ──login with GitHub──▶ เว็บ diffy (URL สาธารณะ)
   └──install diffy──▶ GitHub ──webhook (PR เปิด/push)──▶ server diffy
                                                       ├─ installation token → อ่าน diff
                                                       ├─ LLM (key ของผู้ใช้) → รีวิว
                                                       └─ โพสต์เป็น diffy[bot]
```

- **S0 GitHub App** (เจ้าของโปรเจกต์ทำเอง ขั้นตอนด้านล่าง) สร้าง 2 ตัว: `diffy-dev` สำหรับพัฒนา (webhook ผ่าน smee.io) และ `diffy` ตัวจริง (ทำตอน S6)
- ~~**S0**~~ **เสร็จแล้ว** (ทดสอบกับ GitHub จริง: App `diffy-dev-natsilp` ยืนยันตัวตนด้วย id + private key ได้, เห็น installation บน `NatSilprasert` แบบเลือก repo และ repo `diffy-sandbox` ผ่าน installation token)
- ~~**S1 webhook + installation**~~ **เสร็จแล้ว** core: `github-app.ts` (`createGithubApp`, `getAppIdentity`, `listAppInstallations`, `getInstallationClient`, `getRepoInstallationClient`, `listInstallationRepos`) server: `POST /api/github/webhook` (`module/github`) ตรวจลายเซ็น HMAC-SHA256 จาก raw body (`timingSafeEqual`) ก่อนอ่านข้อมูล: 503 ถ้ายังไม่ตั้ง `GITHUB_WEBHOOK_SECRET`, 401 ถ้าลายเซ็นผิด/ไม่มี รับ `ping`, `installation` (created/new_permissions_accepted → upsert, deleted → `removedAt`, suspend/unsuspend → `suspendedAt`) และ `installation_repositories` (อัปเดต selection) event อื่นตอบ 200 `handled:false` ตาราง `GithubInstallation` (migration `20261028000000`) เก็บเฉพาะ installation ส่วนรายการ repo อ่านสดจาก GitHub ด้วย `listInstallationRepos` (ไม่ต้อง sync) env `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, `GITHUB_WEBHOOK_SECRET` เป็น optional จนกว่า S2 ตัดโหมด token ทดสอบจริง: GitHub redeliver event `installation` ผ่าน smee → server → แถวใน DB ถูกต้อง; ลายเซ็นผิดได้ 401
- **S2a เสร็จ (โค้ด+ทดสอบรายการ repo จริง)**: `GithubService` (`module/github`) เป็นทางเดียวที่โค้ดอื่นได้ GitHub client: `getAccess(owner, repo)` (ผ่าน installation ของ repo ถ้าตั้ง `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY_PATH` ไม่เช่นนั้นใช้ token ที่บันทึกไว้เหมือนเดิม) และ `listRepos()` แทน `getGithubToken` ทั้ง 8 จุด (poller, create-review, run-review, add-repo, list-available-repos, profile builder/freshness) `toGithubHttpException` ส่งต่อ error ของ diffy เอง (HttpException) ไม่ซ่อนเป็น 502 `SettingsService.isConfigured({githubViaApp})` ยังไม่ทำ: ข้อความ error ที่พูดถึง "saved token" (ปรับตอนตัดโหมด token) และการรีวิวจริงในนามบอท
- **S2b เสร็จ (โค้ด+ทดสอบ webhook จำลองกับ server จริง)**: webhook `pull_request` (opened, synchronize, reopened, ready_for_review) → หา repo ที่เฝ้าอยู่ตามชื่อ (ไม่สนตัวพิมพ์, ต้องเปิดใช้งานและไม่ถูกลบ) → `ReviewsService.queueReview` ตามกติกาเดียวกับ poller (`review-eligibility.ts`: ข้าม draft, บอท, commit ที่เปิดอยู่ตอนเพิ่ม repo) → คิวรีวิว commit เดียวกันที่ webhook กับ poller เห็นพร้อมกันไม่ซ้ำ (unique key) action อื่น (closed, edited, labeled ...) และ repo ที่ไม่ได้เฝ้าไม่ทำอะไร controller/usecase ของ webhook อยู่ใน `module/webhooks` (อยู่เหนือ github/repos/reviews จะได้เรียกตรงตามกฎ "คุยกันผ่าน service ที่ export" และไม่วนเป็นวงจร; เคยลองให้ `github` ส่ง event ให้ผู้ฟังแล้วเลิก เพราะ event จะหายเงียบถ้าไม่มีใครลงทะเบียน) `GithubService` เพิ่ม `recordInstallation`/`markInstallation` **ทดสอบจริงแล้ว**: รีวิว PR #3 ของ `diffy-sandbox` ด้วยมือ ผู้รีวิวบน GitHub คือ `diffy-dev-natsilp[bot]` (รีวิวหลัก + คอมเมนต์ inline) **ยังไม่ได้ทดสอบ**: event `pull_request` จริงจาก GitHub ผ่าน smee (ต้อง push commit ใน PR)
- **S2c เสร็จ**: ตัดโหมด token ทั้งหมด: `PUT /settings/github`, `getGithubToken`, ทางเลือก token ใน `GithubService` (ต้องมี App เสมอ), ฟอร์มวาง token ในหน้าเว็บ `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, `GITHUB_WEBHOOK_SECRET` **จำเป็น** (ไม่มี = server ไม่เริ่มและบอกว่าขาดอะไร) `SettingsService.isLlmConfigured` แทน `isConfigured` `GithubModule` ไม่ต้องพึ่ง `SettingsModule` แล้ว (SettingsModule พึ่ง GithubModule แทน) `GET /settings` ส่ง `github: {configured (มี installation ที่ใช้งานอยู่), appName, installUrl, accounts[{login,type,repositorySelection}]}` (ชื่อ App มาจาก GitHub ครั้งเดียวแล้วจำ ถ้า GitHub ตอบไม่ได้ หน้ายังโหลดแต่ไม่มีชื่อ) หน้า Settings แสดงว่าติดตั้งบนบัญชีไหน แบบไหน และปุ่มไปติดตั้งเพิ่ม (ตรวจในเบราว์เซอร์จริงแล้ว) poller เป็นตัวกวาดสำรอง `POLL_INTERVAL_SECONDS` ค่าเริ่มต้น 900 (เดิม 60) ข้อความ error ปรับให้พูดถึง App ไม่ใช่ token **ที่เหลือ**: คอลัมน์ `githubTokenEnc`/`githubLogin` ใน `Settings` ไม่ถูกใช้แล้วแต่ยังไม่ได้ลบ (ลบใน S3 ตอนจัด `Settings` ใหม่ต่อ account)
- **S3 หลายผู้ใช้ + S4 ล็อกอิน (ทำรวมกัน ตัดสินใจ 30 ต.ค. 2026)**: ข้อมูลเดิมที่ผูกกับ token (repo 5, รีวิว 12, brief 4) **ลบทิ้ง** repo ที่ผู้ใช้ให้สิทธิ์ตอนติดตั้ง App **เฝ้าอัตโนมัติ** (PR ที่เปิดอยู่เป็น baseline) และ account ปัจจุบันมาจาก session (ไม่มี header ชั่วคราว) ลำดับ:
  - ~~**S3a**~~ **เสร็จแล้ว**: ตาราง `Account` (id ของ GitHub, login, type) `GithubInstallation.accountId`, `Repository.accountId` (migration `20261030000000` ลบ repo/installation เดิม) โมดูล `accounts` (`AccountsService.recordAccount/findById/findByLogin`) webhook `installation` สร้าง/อัปเดต account ทุกครั้ง `add-repo` ผูก repo กับ account เจ้าของ (ไม่มี account = 404 บอกให้ติดตั้ง App) ทดสอบจริง: redeliver event แล้วได้ `NatSilprasert` (githubId 198521346) + installation; เพิ่ม `diffy-sandbox` ได้ เพิ่ม `cuatclub/cuatclub-web` ไม่ได้ (404)
  - ~~**S4a**~~ **เสร็จ (โค้ด+ทดสอบทุกอย่างยกเว้นการกด Authorize บน GitHub)**: ล็อกอินด้วย GitHub (user-to-server OAuth ของ App) `GET /api/auth/github/login` (state สุ่มใน cookie httpOnly 10 นาที → ส่งไป GitHub) `GET /api/auth/github/callback` (ตรวจ state แลก code เป็น token ถามว่าเป็นใครและเข้า account ไหนได้ (`GET /user/installations`) แล้ว**ทิ้ง token** ไม่เก็บ; สร้าง `User`, `Membership` (ตั้งใหม่ทั้งชุดทุกครั้งที่ล็อกอิน) และ `Session` อายุ 30 วัน cookie `diffy_session` httpOnly SameSite=Lax (Secure เมื่อ `PUBLIC_URL` เป็น https) ในฐานข้อมูลเก็บเฉพาะ **hash ของ token**) `GET /auth/me`, `PUT /auth/account` (สลับ account เฉพาะที่เป็นสมาชิก ไม่งั้น 403), `POST /auth/logout` `AuthGuard` เป็น `APP_GUARD` ทั้งแอป: ทุก route ต้องล็อกอิน ยกเว้น `@Public()` (health, webhook, login, callback) `@CurrentAuth()` ให้ route รู้ `{userId, accountId}` (account ปัจจุบัน = ที่เลือกไว้ ถ้ายังเข้าได้ ไม่งั้นตัวแรก ไม่มีเลย = null) env ใหม่: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (จำเป็น), `PUBLIC_URL`, `WEB_URL` (ไม่จำเป็น; `pnpm dev` ตั้ง `WEB_URL=http://localhost:3000`) CORS ตอน dev เปิด `credentials` เว็บ: `AuthGate` (หน้า Sign in ถ้า 401), เมนู account ท้าย sidebar (รูป, ชื่อ, สลับ account, ออกจากระบบ) ทดสอบจริง: ไม่ล็อกอินได้ 401 ทุก endpoint ยกเว้น health/webhook/login, login redirect ไป GitHub ถูกต้อง, หน้าเว็บแสดง Sign in **ยังไม่ได้ทดสอบ**: ล็อกอินจนจบกับ GitHub จริง (ต้องตั้ง Callback URL ของ App ให้ตรงกับ `PUBLIC_URL`) ข้อมูลยังไม่กรองตาม account (S3c)
  - ~~**S3b**~~ **เสร็จแล้ว**: การตั้งค่าโมเดลผูกกับ account (`Settings.accountId` เป็น primary key; migration `20261030020000` ย้ายค่าเดิมไปให้ account เมื่อมี account เดียว ไม่งั้นลบ; ลบคอลัมน์ token เดิม) `SettingsService.getLlmConfig(accountId)` / `isLlmConfigured(accountId)` `WatchedRepo.accountId` run-review และ profile builder ใช้โมเดลของ account เจ้าของ repo `ProfilesService.startMissing/refreshStale` รับ repo และถามแต่ละ account ครั้งเดียว (account ที่ยังไม่ตั้งโมเดลถูกข้าม) endpoint `GET/PUT /settings`, `POST /settings/llm/test` ใช้ account ปัจจุบันจาก session: `@CurrentAuth()` (GET: คนที่ยังไม่มี account ยังเห็นวิธีติดตั้ง) และ `@CurrentAccountId()` (ใหม่ใน `infra/decorator/`: ถ้าไม่มี account ตอบ 403 "Install the diffy GitHub App...") ทดสอบกับ DB จริง: Gemini key ของคุณย้ายไปอยู่ที่ account `NatSilprasert` ถูกต้อง
  - ~~**S3c**~~ **เสร็จแล้ว**: ทุก endpoint ที่แตะข้อมูลกรองด้วย account ปัจจุบัน (`@CurrentAccountId()`): repos (list, available, add, pause, remove), reviews (list, get, create, retry, poll, stats, usage, status), briefs (list, get, notes, rebuild), settings ข้อมูลของ account อื่นตอบ **404** เหมือนไม่มีอยู่ (ไม่บอกว่ามี; ลองแก้/ลบ/รันซ้ำ แล้วข้อมูลไม่เปลี่ยน) ชั้นล่าง: `ReposService.getAccountRepo(id, accountId)` สำหรับ usecase ของผู้ใช้ (`getActiveRepo` เหลือไว้ให้ worker ซึ่งทำงานข้ามทุก account), `ReviewsRepository` ทุกคำสั่งที่เป็นของผู้ใช้กรอง `repository.accountId`, `GithubService.listRepos(accountId)` อ่านเฉพาะ installation ของ account, `add-repo` ต้องเป็น repo ของ account ที่กำลังดูอยู่ (ของ org ให้สลับ account ก่อน), `GET /reviews/status` แสดงงานที่กำลังรีวิวเฉพาะของ account ตัวเอง (จำนวนคิวรวมยังเห็นร่วมกัน) **ทดสอบกับ DB จริง**: สร้าง account อีกตัวพร้อม repo/รีวิว/brief/โมเดลของมัน แล้วเรียกชั้น repository ในฐานะ account ของคุณ 22 ข้อ ผ่านทั้งหมด (ไม่เห็นใน list, ค้นด้วยชื่อ title ไม่เจอ, ดึงด้วย id ไม่ได้, แก้/ลบไม่ได้, ยอด token/จำนวนรีวิวของคุณไม่เปลี่ยนตอนของเขาโผล่) แล้วลบข้อมูลทดสอบทิ้ง **ยังไม่ได้ทดสอบ**: ผ่าน HTTP ด้วย session ของผู้ใช้สองคนจริง (ต้องล็อกอินจริงก่อน)
  - ~~**S3d**~~ **เสร็จแล้ว**: เฝ้า repo อัตโนมัติจาก webhook: `installation` `created` → เฝ้า repo ที่ให้สิทธิ์ตอนติดตั้ง; `installation_repositories` → เพิ่ม = เฝ้า (ถ้าผู้ใช้เคยเอาออกจะกลับมา เพราะการให้สิทธิ์ใหม่ = ขอให้เฝ้า), ถอด = เอาออก (ประวัติรีวิวอยู่); `installation` `deleted` → เอา repo ทั้งหมดของ account ออก ทุก repo ที่เฝ้าเริ่มด้วย baseline เป็น PR ที่เปิดอยู่ (ไม่รีวิวย้อนหลัง) repo ที่ archived หรืออ่านไม่ได้ถูกข้ามพร้อม log ไม่กระทบตัวอื่น งานเฝ้าทำหลังตอบ webhook (GitHub รอคำตอบไม่กี่วินาที) `ReposService.lookupOnGithub/autoWatch/unwatch/unwatchAll`; `add-repo` ใช้ `lookupOnGithub` ตัวเดียวกัน ทดสอบจริง: เอา `diffy-sandbox` ออกใน DB แล้ว redeliver event → กลับมาเฝ้าพร้อม baseline 3 PR จาก GitHub จริง **ข้อจำกัด**: ถ้าเซิร์ฟเวอร์ปิดอยู่ตอนติดตั้ง event หายและ repo ไม่ถูกเฝ้า (ยังมีปุ่ม Add) ตัวกวาดสำรองที่จะเติม repo ที่ขาดยังไม่ทำ; `repositories` ใน event `created` ของ GitHub อาจไม่ครบถ้า account มี repo จำนวนมาก
  - **S5** หน้าเว็บ: ล็อกอิน, สลับ account, onboarding
- **S4 ล็อกอิน** OAuth ของ GitHub App (user-to-server) → session cookie (httpOnly, secure, SameSite) → guard ทุก endpoint; สิทธิ์เห็น account มาจาก `GET /user/installations` ของผู้ใช้คนนั้น
- **S5 เว็บ** หน้าล็อกอิน, onboarding (ติดตั้ง App → ใส่ LLM key → เสร็จ), ตัวสลับ account, ลบหน้าวาง GitHub token
- **S6 deploy** process เดียว (G1 ที่ stash ไว้), Supabase, host, โดเมน, App ตัวจริงชี้ webhook ไปที่โดเมน
- **S7 ก่อนเปิดสาธารณะ** ลบข้อมูลเมื่อถอน App, จำกัดจำนวนรีวิวต่อ account (กันใช้ server เกิน แม้ค่าโมเดลเป็นของผู้ใช้), privacy policy (โค้ดผ่าน server diffy และผู้ให้บริการ LLM ของผู้ใช้), log/alert

ผลต่อของเดิม: pipeline รีวิว (Phase R), `.diffy.yaml`, brief และหน้าเว็บส่วนใหญ่ใช้ต่อได้; Phase G (README ติดตั้งเอง, `HOST=127.0.0.1`) ยกเลิก ส่วน G1 ใช้ใน S6; คิวในหน่วยความจำยังพอสำหรับ server ตัวเดียว (กู้จาก DB ได้)

#### S0: สร้าง GitHub App สำหรับพัฒนา (`diffy-dev`)

1. เปิด https://smee.io → **Start a new channel** เก็บ URL ไว้ (เช่น `https://smee.io/AbCd123`) เป็นทางส่ง webhook จาก GitHub มาเครื่อง
2. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**
   - GitHub App name: `diffy-dev-<ชื่อคุณ>` (ต้องไม่ซ้ำทั้ง GitHub)
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/api/auth/github/callback` และติ๊ก **Request user authorization (OAuth) during installation**
   - Webhook: ติ๊ก **Active**, Webhook URL = URL ของ smee, Webhook secret = ค่าสุ่ม (`openssl rand -hex 32`)
   - Repository permissions: **Pull requests: Read and write**, **Contents: Read-only**, **Issues: Read-only**, **Checks: Read-only**, Metadata: Read-only (บังคับ)
   - Subscribe to events: **Pull request** (event การติดตั้งส่งมาเองเสมอ)
   - Where can this GitHub App be installed: **Only on this account** (ตัว dev) ส่วนตัวจริงเลือก Any account
3. หลังสร้าง: จด **App ID** และ **Client ID**, กด **Generate a new client secret**, กด **Generate a private key** (ได้ไฟล์ `.pem`)
4. ใส่ใน `.env` (ห้าม commit): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH` (path ของ `.pem` เก็บไว้นอก repo), `GITHUB_WEBHOOK_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SMEE_URL`
5. ติดตั้ง App บน account ของคุณ เลือก repo ทดสอบ 1 ตัว

### คำถามที่ยังเปิดอยู่
1. **รีวิวซ้ำทุกครั้งที่ push**: ข้อเสนอคือข้าม finding ที่ `(path, title)` เหมือนที่เคยโพสต์ใน PR นั้นแล้ว (รีวิวเฉพาะส่วนที่เปลี่ยนจริงเก็บไว้ v2)
2. ข้าม draft และบอทเป็นค่าตายตัวใน v1 หรือไม่ (ข้อเสนอ: ใช่ ถ้า draft ถูกเปลี่ยนเป็น ready แล้ว head ยังไม่เคยรีวิว จะถูกรีวิว)
3. เพดานขนาดรีวิว: ตอนนี้ไฟล์ที่เกินงบถูกข้าม ควรรีวิวบางส่วนพร้อมหมายเหตุแทนหรือไม่
4. `GET /repos/available` ช้า ~4 วินาทีเมื่อมี 100+ repo (GitHub ส่งทีละ 100): ตัดสินแล้วว่า **ไม่ใส่ cache** ใช้ debounce และป้าย "Searching…" แทน (ดู F4)
5. รีวิวขึ้นในนามเจ้าของ token ยอมรับได้ใน v1 หรือไม่ (GitHub App ใน v2 แก้เรื่องนี้)

---

## 10. วิธีรันและทดสอบตอนนี้

ต้องมี Node 22.12+, pnpm และ Docker

```bash
pnpm install
pnpm db:up                                   # Postgres ใน Docker (พอร์ต 54322)
cp .env.example .env                         # แล้วใส่ ENCRYPTION_KEY (openssl rand -base64 32)
                                             # DATABASE_URL และ DIRECT_URL ให้ใช้ค่าของ Postgres ในเครื่อง
pnpm --filter @diffy/server db:deploy        # สร้างตาราง
pnpm build && pnpm test

# โหมดพัฒนา (แต่ละคำสั่งเตรียมของที่ต้องใช้ให้เอง: build shared/core, generate Prisma client และ client ของ Orval)
pnpm api:dev                                 # API ที่ http://127.0.0.1:4000 (เอกสารที่ /api/docs) รีสตาร์ตเองเมื่อแก้โค้ด
pnpm web:dev                                 # เว็บที่ http://localhost:3000
pnpm dev                                     # สองตัวข้างบนพร้อมกัน
# พอร์ต: ตอนพัฒนา เว็บ 3000 / API 4000 ตอนใช้งานจริง process เดียวที่ PORT (ค่าเริ่มต้น 3000)

# หรือรัน server ที่ build แล้ว
pnpm --filter @diffy/server start:prod
```

ทดสอบ `core` จากสคริปต์ (ใช้ repo ทดลองของตัวเอง):

```bash
export GITHUB_TOKEN=...   LLM_API_KEY=...
cd packages/core
pnpm review-pr owner/repo#1 --print-diff
pnpm review-pr owner/repo#1 --dry-run --provider=google --model=<id>
pnpm review-pr owner/repo#1 --print-review --provider=... --model=...
pnpm review-pr owner/repo#1 --post --provider=... --model=...     # โพสต์จริง
```

สร้าง `openapi.json` ใหม่หลังแก้ DTO: `pnpm --filter @diffy/server gen:openapi`

หมายเหตุ: ใน `.env` ต้องเขียนเป็น `ชื่อ=ค่า` เท่านั้น บรรทัดที่เป็นแค่ค่าเปล่า ๆ จะถูกละเว้น และอย่าวาง token หรือคีย์ลงในแชตหรือ commit

---

## 11. v2 (ไว้ทีหลัง)

- รีวิวแบบ incremental (เฉพาะ `lastReviewedSha..head`) และไม่ซ้ำ finding เดิม พร้อมจัดการคอมเมนต์ที่ล้าสมัย
- GitHub App และ webhook (รีวิวทันที ไม่ต้องใช้ token ส่วนตัว)
- ระบบล็อกอินหน้าเว็บ (ปลอดภัยพอจะเปิดนอก localhost)
- คิวถาวรบน Postgres เอง (เช่น `pg-boss` หรือ `SELECT ... FOR UPDATE SKIP LOCKED`) รองรับ retry/backoff และหลาย worker โดยไม่ต้องเพิ่ม Redis
- ตั้งค่าต่อ repo (`.diffy.yml`): ข้ามพาธ, กฎ/คำสั่งเพิ่มเติม, เกณฑ์ความรุนแรงขั้นต่ำ
- บริบทเพิ่ม (ไฟล์เต็ม ไฟล์ที่เกี่ยวข้อง)
- ตอบคอมเมนต์ (`@diffy explain`) และปุ่ม "apply fix"
- เชื่อม GitHub ด้วยปุ่ม "Connect with GitHub" แทนการวาง token: OAuth App แบบ Device Flow (ไม่มี client secret ใช้บน localhost ได้ แต่สิทธิ์กว้างกว่า fine-grained token และต้องมีผู้ลงทะเบียน `client_id`) หรือ GitHub App ผ่าน manifest flow (สิทธิ์ละเอียด และเปิดทางไป webhook) ยังไม่ตัดสินใจ
- Docker image, ติดตามค่าใช้จ่าย/งบต่อเดือน, หลายโปรไฟล์ LLM, GitLab/Bitbucket, ปุ่มถูกใจ/ไม่ถูกใจต่อ finding
