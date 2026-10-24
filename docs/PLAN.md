# Diffy: แผนและความคืบหน้า

อัปเดตล่าสุด: 2026-10-24 (หลังทำ F4)
เอกสารนี้สรุปว่า Diffy คืออะไร ออกแบบอย่างไร ตอนนี้ทำถึงไหน อะไรยืนยันแล้ว อะไรยังไม่ได้ยืนยัน และเหลืออะไรต้องทำ

---

## 1. Diffy คืออะไร

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
| F | หน้าเว็บ (Next.js) F1–F7 | **F1–F4 เสร็จ**, เหลือ F5–F7 |
| G | รวมเป็น process เดียวและเอกสาร G1–G2 | ยังไม่เริ่ม |

จำนวน test ที่ผ่าน ณ วันที่เขียน: `shared` 8, `core` 74, `server` 227, `web` 13

**ขั้นถัดไปคือ F5** (หน้า `/reviews`) ฝั่ง API ของ v1 ครบแล้ว ดูหัวข้อ 9

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
│  │     └─ module/             health, settings, repos, reviews
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
ReviewQueueService   คิวใน memory เก็บแค่ id รันทีละรีวิว
   ▼
RunReviewService     claim (queued→running) → โหลด token/LLM → ดึง PR
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
  - ส่วนที่ไม่ใช่ทั้งสองอย่าง (คิว และตัวรัน) อยู่ใน `worker/` ของโมดูล reviews
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
- ~~**E5 poller**~~ **เสร็จแล้ว**: `PollerService` poll ทันทีตอนเริ่ม แล้วทุก `POLL_INTERVAL_SECONDS` วนทุก repo ที่ `removedAt = null AND enabled = true` ดึง PR ที่เปิดอยู่ ข้าม draft และบอท สร้างแถว `queued` ให้ commit ที่ยังไม่มีรีวิว (ซ้ำถูกกันด้วย unique constraint) และบันทึก `lastPolledAt`/`lastError` ต่อ repo repo ที่พังไม่ทำให้ repo อื่นหยุด ทดสอบกับ GitHub จริง: repo ปกติ, repo ที่ไม่มีอยู่ (บันทึก error), repo ที่หยุด/ลบ (ไม่ถูกแตะ) และรอบที่สองไม่สร้างรีวิวซ้ำ
- ~~**E6 poll ทันที และ baseline**~~ **เสร็จแล้ว**: `POST /reviews/poll` (ส่ง `repositoryId` ใน body; วางใน `ReviewsController` เพราะ reviews พึ่ง repos อยู่แล้ว ถ้าวางใน repos จะเป็นวงกลม) และเมื่อเพิ่ม repo (รวมถึงฟื้น repo ที่เคยลบ) จะอ่าน PR ที่เปิดอยู่แล้วจด head commit เป็น baseline ก่อนบันทึก ถ้าอ่านไม่ได้จะ **ไม่เพิ่ม repo** (ไม่งั้นจะรีวิวทุก PR พร้อมกัน) ต้องทำตอนเพิ่ม ไม่ใช่ตอน poll รอบแรก เพราะผู้ใช้ที่เพิ่ม repo แล้วเปิด PR ทดสอบทันทีจะถูกข้ามเงียบ ๆ ทดสอบกับ GitHub จริง: เพิ่ม repo ที่มี PR #1 เปิดอยู่ → poll แล้วไม่มีรีวิว; เมื่อ PR มี commit ใหม่ (จำลอง) → ถูกรีวิว 1 ครั้ง
- ~~**E7 สถานะ**~~ **เสร็จแล้ว**: `GET /reviews/status` เป็นสถานะสดในหน่วยความจำของ process นี้ จึงมีความหมายเมื่อรัน instance เดียว

### Phase F: เว็บ (Next.js `output: 'export'`, Tailwind, shadcn/ui, Orval + React Query)
- ~~F1 โครงเว็บ~~ **เสร็จแล้ว**: Next.js 16 `output: 'export'` + `trailingSlash` (ได้ `settings/index.html` ซึ่ง static server ธรรมดาเสิร์ฟได้), Tailwind 4, shadcn/ui (สไตล์ `radix-nova`, มี `button` `card` `badge`), เมนูหลัก (ไฮไลต์หน้าปัจจุบัน), ธีมมืด/สว่างตามระบบ และหน้าเปล่า 5 หน้าบอกว่าจะแสดงอะไร (`/`, `/settings`, `/repos`, `/reviews`, `/reviews/view?id=`) ตรวจแล้ว: build ได้ 7 หน้า ขนาดรวม ~1 MB ไม่มีการเรียก URL ภายนอก และในเบราว์เซอร์จริงอ่าน `?id=` ได้ เมนูไฮไลต์ถูก
  - `shadcn` รุ่นนี้ใช้แพ็กเกจ `cn` (ของ shadcn เอง) แทน `clsx` + `tailwind-merge` ตรวจแล้วว่าเจ้าของและ repo ตรงกับ shadcn
- ~~F2 ต่อ Orval~~ **เสร็จแล้ว**: `orval.config.ts` อ่าน `apps/server/openapi.json` สร้าง client + React Query hook 16 ตัว (`useGetStatus`, `useListReviews`, `useAddRepo`, ...) ไว้ที่ `apps/web/src/api/generated/` (**ไม่ commit** สร้างตอน `prebuild` และด้วย `pnpm gen:api` ที่ root)
  - `src/api/fetcher.ts` เป็นทางผ่านเดียวของทุกคำขอ: โยน `ApiError` (พร้อมข้อความที่แสดงให้ผู้ใช้ได้ เช่น "Could not reach the Diffy server. Is it running?" และรวม error ของ Zod validation) เมื่อเครือข่ายล้มหรือ HTTP ไม่ใช่ 2xx ทำให้ hook เข้าสถานะ error จริง `.env.development` ตั้ง `NEXT_PUBLIC_API_URL` ให้ `next dev`; build จริงเว้นว่างเพื่อเรียก API origin เดียวกัน
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
- F5 `/reviews`: ตารางประวัติ (เวลา, repo, PR, commit, สถานะ, จำนวน finding ตามความรุนแรง), ตัวกรอง repo/สถานะ, ปุ่ม "โหลดเพิ่ม" (cursor)
- F6 `/reviews/view?id=`: รายละเอียด PR/commit/โมเดล/token, สรุป, findings จัดกลุ่มตามความรุนแรง พร้อมปุ่มคัดลอก fix prompt, error และปุ่มลองใหม่ถ้า `failed`
- F7 `/` แดชบอร์ด: เช็กลิสต์การตั้งค่า (ประกอบจาก `GET /settings` และ `GET /repos`) + สถานะสดของคิวและ poller + 10 รีวิวล่าสุด; ข้อมูลเก่าตอน error ควรจางหรือซ่อน
- ตัดสินแล้ว: **ไม่ commit client ที่ Orval สร้าง** commit เฉพาะ `openapi.json` ผู้ใช้ที่ clone มา build ได้เลยเพราะ `prebuild` สร้างให้ และ diff ของ PR ไม่ถูกกลบด้วยโค้ดที่สร้างอัตโนมัติ

### Phase G: ส่งมอบ
- **G1 process เดียว**: `ServeStaticModule` เสิร์ฟ `apps/web/out` ที่ `/` (ยกเว้น `/api`) และสคริปต์ root `pnpm start` = build → `prisma migrate deploy` → start (ตอนนี้ **ยังไม่มี** `pnpm start`)
- **G2 เอกสารและทดสอบ clone ใหม่**: README พร้อมขั้นตอน Supabase cloud และ local ทดสอบทั้งสองแบบ รวมการตั้งค่า pooler

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
- Docker image, ติดตามค่าใช้จ่าย/งบต่อเดือน, หลายโปรไฟล์ LLM, GitLab/Bitbucket, ปุ่มถูกใจ/ไม่ถูกใจต่อ finding
