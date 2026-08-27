# دليل APIs العربي — R1-P07 Worker, Team & Crew Management

هذا الملف هو مرجع التنفيذ للفرونت إند لكل عمليات HTTP الخاصة بالمرحلة السابعة. يغطي **20 مسارًا و25 عملية**، ويشرح وظيفة كل API، أهميته، الـinput والـoutput، الصلاحيات، ومكان استخدامه في لوحات الـUX الموجودة في هذا المجلد.

المصدر القانوني للسلوك هو `specs/R1-P07-worker-team-crew-management/spec.md`، والمصدر القانوني لأشكال الطلبات والاستجابات هو `specs/R1-P07-worker-team-crew-management/contracts/provider-workforce-api.openapi.yaml`. القيم الموجودة في الأمثلة توضيحية وليست بيانات حقيقية.

## قواعد مشتركة قبل استخدام أي API

- الـBase URL المحلي هو `http://localhost:8000/api/v1`.
- كل العمليات الخاصة تتطلب `Authorization: Bearer <ACCESS_TOKEN>`. عمليات الدعوة العامة الثلاث: `inspect` و`onboarding/start` و`onboarding/verify-email` لا تحتاج Bearer token.
- يفضّل إرسال `Accept: application/json` و`x-request-id` بصيغة UUID في كل طلب.
- كل body بصيغة JSON يحتاج `Content-Type: application/json`، باستثناء رفع الصورة الذي يستخدم `multipart/form-data`.
- كل Command يستخدم `expectedVersion` موجبًا و`idempotencyKey` جديدًا بصيغة UUID. إعادة نفس المعنى بنفس المفتاح تعيد النتيجة السابقة، لكن إعادة المفتاح نفسه بمعنى مختلف ترجع conflict.
- `expectedVersion` لا يعني الشيء نفسه في كل مكان: في إنشاء Worker أو Team هو `workforceVersion` القادم من API الجاهزية؛ في تعديل الملف هو `profileVersion`؛ وفي أوامر Worker أو Team هو نسخة الهدف المعروضة في آخر GET.
- بعد إنشاء Worker أو Team يجب إعادة طلب `GET /api/v1/providers/{providerId}/workforce-readiness` للحصول على `workforceVersion` الجديدة قبل إنشاء aggregate آخر.
- القوائم تستخدم `cursor` اختياريًا و`limit` من 1 إلى 100، والقيمة الافتراضية 25.
- أرقام الهاتف التشغيلية لا تظهر في القوائم أو الفرق أو السجل. تظهر فقط في Worker detail المصرح به، أو Worker self، أو نطاق المشرف الأساسي المسموح.
- لا تحفظ أو تسجل `invitationProof` أو password أو OTP أو access/refresh tokens أو recent-auth proof.

شكل الخطأ الموحد:

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_VALIDATION_FAILED",
    "statusCode": 400,
    "message": "Request validation failed",
    "details": {
      "issues": []
    }
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

أهم الأكواد التي يجب أن يتعامل معها الفرونت: `REQUEST_VALIDATION_FAILED`، `AUTHENTICATION_REQUIRED`، `WORKFORCE_PERMISSION_DENIED`، `WORKFORCE_RESOURCE_NOT_FOUND`، `WORKFORCE_STATE_CONFLICT`، `WORKFORCE_FINAL_CLEANER_CONFLICT`، `WORKFORCE_REAUTHENTICATION_REQUIRED`، `WORKER_INVITATION_INVALID`، `WORKER_AVATAR_INVALID`، و`WORKFORCE_DEPENDENCY_NOT_READY`. لا تعرض تفاصيل داخلية أو تستنتج من الخطأ وجود Worker تابع لمقدم خدمة آخر.

---

## 1) GET /api/v1/providers/{providerId}/workers

**الوظيفة:** إرجاع قائمة Workers الخاصة بمقدم الخدمة في صورة summaries آمنة وقابلة للتقسيم إلى صفحات.

**أهميته:** هو مصدر شاشة قائمة العاملين والانتقال إلى Worker detail، ولا يعرض الهاتف التشغيلي. العقد الحالي يدعم `cursor` و`limit` فقط ولا يعرّف بحثًا أو فلاتر خادمية.

**الصلاحية:** Provider Owner أو Provider Admin النشط لنفس `providerId`.

**مثال للـinput:**

```http
GET /api/v1/providers/prv_01/workers?limit=25&cursor=wrk_00
Authorization: Bearer <ACCESS_TOKEN>
Accept: application/json
```

لا يوجد JSON body.

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "workerId": "wrk_01",
        "providerId": "prv_01",
        "fullLegalName": "أحمد محمد",
        "gender": "male",
        "workerType": "CLEANING_STAFF",
        "displayTitle": "عامل نظافة",
        "operationalStatus": "ACTIVE",
        "supervisorCapable": false,
        "currentTeamId": "team_01",
        "workerVersion": 3,
        "profileVersion": 2
      }
    ],
    "nextCursor": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** `workerVersion` يستخدم في lifecycle/access/Admin commands، و`profileVersion` يستخدم في PUT الملف والصورة. `currentTeamId` قد يكون `null`. الحالات التشغيلية هي `DRAFT | ACTIVE | INACTIVE | REMOVED`.

**بنستخدمه فين:** اللوحات 01 و02 و14، وصفحات قائمة العاملين واختيار Worker للعرض أو الإدارة.

---

## 2) POST /api/v1/providers/{providerId}/workers

**الوظيفة:** إنشاء Worker Profile جديد في حالة `DRAFT` من دون إنشاء حساب دخول أو إرسال دعوة تلقائيًا.

**أهميته:** هو أول خطوة في سيناريو إضافة عامل، ويُبقي الملف التشغيلي منفصلًا عن الهوية والدعوة وصلاحية Admin.

**الصلاحية:** Provider Owner أو Provider Admin. إصدار الدعوة لاحقًا Owner-only.

**مثال للـinput:**

```http
POST /api/v1/providers/prv_01/workers
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

```json
{
  "fullLegalName": "أحمد محمد",
  "gender": "male",
  "operationalPhoneE164": "+201012345678",
  "workerType": "CLEANING_STAFF",
  "displayTitle": "عامل نظافة",
  "supervisorCapable": false,
  "skillTags": ["تنظيف عميق", "واجهات زجاجية"],
  "expectedVersion": 7,
  "idempotencyKey": "00000000-0000-4000-8000-000000000101"
}
```

**مثال للـoutput — 201:**

```json
{
  "success": true,
  "data": {
    "viewScope": "PROVIDER_MANAGEMENT",
    "worker": {
      "workerId": "wrk_01",
      "providerId": "prv_01",
      "fullLegalName": "أحمد محمد",
      "gender": "male",
      "workerType": "CLEANING_STAFF",
      "displayTitle": "عامل نظافة",
      "operationalStatus": "DRAFT",
      "supervisorCapable": false,
      "currentTeamId": null,
      "workerVersion": 1,
      "profileVersion": 1
    },
    "operationalPhoneE164": "+201012345678",
    "skills": ["تنظيف عميق", "واجهات زجاجية"],
    "loginAccessStatus": null,
    "avatar": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** `expectedVersion` هنا هو `workforceVersion` من API رقم 19، وليس Worker version. الحقول `displayTitle` و`supervisorCapable` و`skillTags` اختيارية عند الإنشاء وتتحول إلى `null` و`false` و`[]`. القيم المقبولة لـ`workerType` هي `CLEANING_STAFF | ESCORT | OTHER`، وللجنس `male | female`. الهاتف يجب أن يكون E.164. المهارات تُطبّع ويُرفض التكرار بعد التطبيع.

**بنستخدمه فين:** اللوحات 02 و03 و16؛ نموذج إنشاء Worker وخطوة البداية في Owner/Admin flow.

---

## 3) GET /api/v1/providers/{providerId}/workers/{workerId}

**الوظيفة:** جلب Worker detail خاص ومحدد حسب دور المستدعي.

**أهميته:** يوفر البيانات الكاملة المصرح بها لشاشة التفاصيل، ويطبق privacy scope بدل إرجاع نفس DTO لكل الأدوار.

**الصلاحية:** Owner/Admin يحصل على `PROVIDER_MANAGEMENT`. المشرف الأساسي يمكنه قراءة عضو حالي في فريقه فقط ويحصل على `PRIMARY_SUPERVISOR`. الطلب خارج النطاق يفشل بأمان.

**مثال للـinput:**

```http
GET /api/v1/providers/prv_01/workers/wrk_01
Authorization: Bearer <ACCESS_TOKEN>
Accept: application/json
```

**مثال للـoutput — 200 للمالك/المدير:**

```json
{
  "success": true,
  "data": {
    "viewScope": "PROVIDER_MANAGEMENT",
    "worker": {
      "workerId": "wrk_01",
      "providerId": "prv_01",
      "fullLegalName": "أحمد محمد",
      "gender": "male",
      "workerType": "CLEANING_STAFF",
      "displayTitle": "عامل نظافة",
      "operationalStatus": "ACTIVE",
      "supervisorCapable": true,
      "currentTeamId": "team_01",
      "workerVersion": 3,
      "profileVersion": 2
    },
    "operationalPhoneE164": "+201012345678",
    "skills": ["تنظيف عميق"],
    "loginAccessStatus": "ACTIVE",
    "avatar": {
      "url": "https://media.example.invalid/private/signed-avatar",
      "expiresAt": "2026-08-27T12:30:00.000Z"
    }
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** `avatar.url` رابط خاص قصير العمر ولا يحتوي الرد على storage key. نسخة المشرف لا تعرض skills أو access/Admin controls، وتعرض فقط البيانات اللازمة لفريقه و`cleans` و`membershipVersion`.

**بنستخدمه فين:** اللوحات 04 و05 و07 و11 و14؛ Worker detail وaccess/lifecycle panels وSupervisor member detail.

---

## 4) PUT /api/v1/providers/{providerId}/workers/{workerId}

**الوظيفة:** استبدال Worker Profile كاملًا مع optimistic concurrency.

**أهميته:** يمنع partial form ambiguity ويحافظ على تناسق النوع والمهارات وSupervisor capability.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput:**

```json
{
  "fullLegalName": "أحمد محمد علي",
  "gender": "male",
  "operationalPhoneE164": "+201012345679",
  "workerType": "CLEANING_STAFF",
  "displayTitle": "قائد فريق نظافة",
  "supervisorCapable": true,
  "skillTags": ["تنظيف عميق", "إشراف"],
  "expectedVersion": 2,
  "idempotencyKey": "00000000-0000-4000-8000-000000000102"
}
```

`expectedVersion` هو `profileVersion` القادم من آخر GET.

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "viewScope": "PROVIDER_MANAGEMENT",
    "worker": {
      "workerId": "wrk_01",
      "providerId": "prv_01",
      "fullLegalName": "أحمد محمد علي",
      "gender": "male",
      "workerType": "CLEANING_STAFF",
      "displayTitle": "قائد فريق نظافة",
      "operationalStatus": "ACTIVE",
      "supervisorCapable": true,
      "currentTeamId": "team_01",
      "workerVersion": 4,
      "profileVersion": 3
    },
    "operationalPhoneE164": "+201012345679",
    "skills": ["تنظيف عميق", "إشراف"],
    "loginAccessStatus": "ACTIVE",
    "avatar": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** لأن هذا PUT كامل، `supervisorCapable` و`skillTags` مطلوبان حتى لو كانا `false` و`[]`. التحويل من `CLEANING_STAFF` إلى `ESCORT` يُرفض إذا كانت العضوية الحالية ما زالت `cleans=true`. فقدان Supervisor capability قد يمسح primary-Supervisor assignment المرتبط.

**بنستخدمه فين:** اللوحتان 03 و04؛ Edit Worker form.

---

## 5) POST /api/v1/providers/{providerId}/workers/{workerId}/avatar

**الوظيفة:** رفع أو استبدال الصورة الخاصة للـWorker.

**أهميته:** يدير الصورة كوسائط خاصة ويمنع تخزين أو عرض رابط عام أو storage key.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput — multipart/form-data:**

```text
file               = <avatar.png>          (file)
expectedVersion    = 3                     (text)
idempotencyKey     = 00000000-0000-4000-8000-000000000103
```

الأنواع المدعومة: JPEG وPNG وWebP، والحد الأقصى 5 MiB. `expectedVersion` هو profile version الحالي.

**مثال للـoutput — 202:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "WORKER_AVATAR_ASSOCIATED",
    "targetId": "wrk_01",
    "version": 4,
    "impacts": [
      {
        "targetType": "AVATAR",
        "targetId": "wrk_01",
        "outcomeCode": "WORKER_AVATAR_ASSOCIATED",
        "version": 4
      }
    ]
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** 202 يعني أن association قُبلت مع دورة media processing/cleanup الآمنة. تعامل مع 413 كحجم زائد و415 كنوع غير مدعوم. لا تبنِ UI على storage provider details.

**بنستخدمه فين:** اللوحتان 03 و04؛ حقل الصورة داخل create/edit وWorker detail.

---

## 6) DELETE /api/v1/providers/{providerId}/workers/{workerId}/avatar

**الوظيفة:** إزالة association الحالية للصورة الخاصة مع الاحتفاظ بإجراءات cleanup الآمنة.

**أهميته:** يتيح حذف الصورة من الملف من دون hard-delete غير منضبط أو كشف مكان التخزين.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput:**

```json
{
  "expectedVersion": 4,
  "idempotencyKey": "00000000-0000-4000-8000-000000000104"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "WORKER_AVATAR_REMOVED",
    "targetId": "wrk_01",
    "version": 5,
    "impacts": [
      {
        "targetType": "AVATAR",
        "targetId": "wrk_01",
        "outcomeCode": "WORKER_AVATAR_REMOVED",
        "version": 5
      }
    ]
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** `expectedVersion` هو profile version. عند 409 يجب إعادة تحميل Worker detail وعدم تكرار الطلب بنسخة قديمة.

**بنستخدمه فين:** اللوحتان 03 و04؛ زر إزالة الصورة.

---

## 7) POST /api/v1/providers/{providerId}/workers/{workerId}/lifecycle-commands

**الوظيفة:** تنفيذ `ACTIVATE` أو`DEACTIVATE` أو`REACTIVATE` أو`REMOVE` على دورة حياة Worker.

**أهميته:** يجمع قواعد الانتقال والأسباب والتأكيدات وآثار الفريق والجاهزية في command atomic واحدة.

**الصلاحية:** Owner/Admin للتفعيل والتعطيل وإعادة التفعيل. `REMOVE` للـOwner فقط ويحتاج recent authentication.

**مثال للـinput — تعطيل:**

```json
{
  "action": "DEACTIVATE",
  "reasonCode": "TEMPORARILY_UNAVAILABLE",
  "confirmTeamImpact": false,
  "confirmReadinessImpact": false,
  "expectedVersion": 3,
  "idempotencyKey": "00000000-0000-4000-8000-000000000105"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "WORKER_DEACTIVATED",
    "targetId": "wrk_01",
    "version": 4,
    "impacts": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** أسباب DEACTIVATE: `TEMPORARILY_UNAVAILABLE | SCHEDULE_OR_LEAVE | PERFORMANCE_OR_POLICY | PROVIDER_OPERATIONAL_CHANGE | OTHER`. أسباب REMOVE: `ENGAGEMENT_ENDED | PERFORMANCE_OR_POLICY | DUPLICATE_OR_INCORRECT_RECORD | OTHER`. كل REMOVE يحتاج `note` بطول 10 أحرف على الأقل و`recentAuthenticationProof`. سبب `OTHER` يحتاج note كذلك. إذا كان العامل آخر منظف صالح أو آخر عامل يحقق `workersReady` يرجع impact conflict يحتوي النسخ المطلوبة؛ يعرض الفرونت شاشة مراجعة ثم يعيد الطلب بالقيم `expectedTeamVersion` و`expectedMembershipVersion` والتأكيدات الصحيحة. `REMOVED` نهائية، وإعادة التوظيف تنشئ engagement جديدة.

**بنستخدمه فين:** اللوحات 07 و10 و14 و16؛ Worker lifecycle وimpact review.

---

## 8) POST /api/v1/providers/{providerId}/workers/{workerId}/login-access-commands

**الوظيفة:** إصدار أو إعادة إرسال دعوة، reset access، أو revoke access للـWorker.

**أهميته:** يفصل login access عن Worker operational status وعن Admin membership.

**الصلاحية:** exact Provider Owner فقط، مع recent authentication لا يتجاوز 10 دقائق.

**مثال للـinput — أول دعوة:**

```json
{
  "action": "ISSUE_INVITATION",
  "email": "worker@example.com",
  "locale": "AR",
  "expectedVersion": 3,
  "expectedAccessVersion": null,
  "recentAuthenticationProof": "<RECENT_AUTH_PROOF>",
  "idempotencyKey": "00000000-0000-4000-8000-000000000106"
}
```

**مثال للـoutput — 201:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "WORKER_INVITATION_ISSUED",
    "targetId": "wrk_01",
    "version": 1,
    "impacts": [
      {
        "targetType": "LOGIN_ACCESS",
        "targetId": "wrk_01",
        "outcomeCode": "WORKER_LOGIN_ACCESS_INVITED",
        "version": 1
      }
    ]
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** `ISSUE_INVITATION` و`RESEND_INVITATION` و`RESET_ACCESS` تحتاج email و`AR|EN`. أول إصدار يستخدم `expectedAccessVersion: null`، وما بعده يستخدم النسخة الحالية. `REVOKE_ACCESS` يحتاج أحد الأسباب `SECURITY_CONCERN | ACCESS_NO_LONGER_REQUIRED | ENGAGEMENT_ENDED | OTHER`، وOTHER يحتاج note. الدعوة صالحة 72 ساعة، وإعادة الإرسال تجعل الروابط السابقة superseded.

**بنستخدمه فين:** اللوحتان 05 و16؛ Owner access panel.

---

## 9) POST /api/v1/providers/{providerId}/workers/{workerId}/admin-membership-commands

**الوظيفة:** منح أو إلغاء Provider Admin membership للشخص المرتبط بالـWorker.

**أهميته:** يحافظ على فصل صلاحية Admin عن Worker profile والحالة التشغيلية.

**الصلاحية:** exact Provider Owner فقط، مع recent authentication.

**مثال للـinput — منح Admin:**

```json
{
  "action": "GRANT",
  "reasonCode": "OPERATIONAL_RESPONSIBILITY",
  "expectedVersion": 3,
  "expectedMembershipVersion": null,
  "recentAuthenticationProof": "<RECENT_AUTH_PROOF>",
  "idempotencyKey": "00000000-0000-4000-8000-000000000107"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "PROVIDER_ADMIN_GRANTED",
    "targetId": "membership_admin_01",
    "version": 1,
    "impacts": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** GRANT يقبل `OPERATIONAL_RESPONSIBILITY | COVERAGE_OR_BACKUP | OTHER`. REVOKE يقبل `RESPONSIBILITY_ENDED | SECURITY_CONCERN | ENGAGEMENT_ENDED | OTHER`. OTHER يحتاج note. `expectedMembershipVersion` يكون `null` عند إنشاء membership غير موجودة، والنسخة الدقيقة عند تغيير membership موجودة. منح Admin لا يغير Worker lifecycle أو workerType.

**بنستخدمه فين:** اللوحتان 05 و16؛ Owner-only Admin controls.

---

## 10) GET /api/v1/providers/{providerId}/workers/{workerId}/history

**الوظيفة:** إرجاع السجل غير القابل للتعديل لأحداث Worker وملفه ووصوله وعلاقاته الآمنة.

**أهميته:** يوفر audit-friendly timeline للواجهة من دون هاتف كامل أو proof أو credentials.

**الصلاحية:** Provider Owner أو Provider Admin لنفس Provider.

**مثال للـinput:**

```http
GET /api/v1/providers/prv_01/workers/wrk_01/history?limit=25
Authorization: Bearer <ACCESS_TOKEN>
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "historyId": "hist_01",
        "targetType": "WORKER",
        "targetId": "wrk_01",
        "targetVersion": 4,
        "eventCode": "WORKER_DEACTIVATED",
        "actorUserId": "usr_owner_01",
        "reasonCode": "TEMPORARILY_UNAVAILABLE",
        "note": null,
        "safeBefore": {"status": "ACTIVE", "version": 3},
        "safeAfter": {"status": "INACTIVE", "version": 4},
        "createdAt": "2026-08-27T10:00:00.000Z"
      }
    ],
    "nextCursor": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** اعرض `eventCode` بترجمة UI مع الاحتفاظ بالكود الأصلي. لا تفترض أن `safeBefore` و`safeAfter` يحتويان حقولًا ثابتة لكل event.

**بنستخدمه فين:** اللوحتان 07 و15؛ Worker history timeline.

---

## 11) GET /api/v1/providers/{providerId}/teams

**الوظيفة:** إرجاع قائمة Teams الخاصة بمقدم الخدمة مع العدد الحالي للأعضاء والمنظفين الصالحين.

**أهميته:** يغذي Teams list والـoverview من دون كشف هواتف الأعضاء.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput:**

```http
GET /api/v1/providers/prv_01/teams?limit=25
Authorization: Bearer <ACCESS_TOKEN>
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "teamId": "team_01",
        "providerId": "prv_01",
        "name": "فريق النظافة 1",
        "status": "ACTIVE",
        "primarySupervisorWorkerId": "wrk_02",
        "currentMemberCount": 4,
        "validCleanerCount": 3,
        "version": 6
      }
    ],
    "nextCursor": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** حالات Team هي `DRAFT | ACTIVE | INACTIVE | ARCHIVED`. `validCleanerCount` لا يحسب Escort ولا العضوية ذات `cleans=false` ولا العامل غير النشط.

**بنستخدمه فين:** اللوحتان 01 و08؛ Teams list وworkforce overview.

---

## 12) POST /api/v1/providers/{providerId}/teams

**الوظيفة:** إنشاء Team جديدة في حالة `DRAFT`، باسم أو من دون اسم.

**أهميته:** يسمح ببدء بناء الفريق قبل اكتمال العضوية؛ فريق DRAFT يمكن أن يكون فارغًا.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput:**

```json
{
  "name": "فريق النظافة 1",
  "expectedVersion": 8,
  "idempotencyKey": "00000000-0000-4000-8000-000000000108"
}
```

`expectedVersion` هو `workforceVersion` من API رقم 19. إذا لم يُرسل `name` يُستخدم `null`.

**مثال للـoutput — 201:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "TEAM_DRAFT_CREATED",
    "targetId": "team_01",
    "version": 1,
    "impacts": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** الاسم يُطبّع، ويجب أن يكون فريدًا بين الفرق غير المؤرشفة لنفس Provider بعد تجاهل اختلاف الحالة والمسافات. استخدم `targetId` لفتح Team detail ثم أعد طلب الجاهزية للحصول على workforce version الجديدة.

**بنستخدمه فين:** اللوحتان 08 و16؛ Create Team flow.

---

## 13) GET /api/v1/providers/{providerId}/teams/{teamId}

**الوظيفة:** إرجاع Team detail وأعضائها الحاليين.

**أهميته:** المصدر الأساسي لشاشة إدارة العضوية و`cleans` والمشرف الأساسي وتكوين الطاقم.

**الصلاحية:** Owner/Admin، أو primary Supervisor للفريق المحدد فقط.

**مثال للـinput:**

```http
GET /api/v1/providers/prv_01/teams/team_01
Authorization: Bearer <ACCESS_TOKEN>
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "team": {
      "teamId": "team_01",
      "providerId": "prv_01",
      "name": "فريق النظافة 1",
      "status": "ACTIVE",
      "primarySupervisorWorkerId": "wrk_02",
      "currentMemberCount": 2,
      "validCleanerCount": 1,
      "version": 6
    },
    "members": [
      {
        "membershipId": "mem_01",
        "workerId": "wrk_01",
        "fullLegalName": "أحمد محمد",
        "gender": "male",
        "workerType": "CLEANING_STAFF",
        "cleans": true,
        "workerStatus": "ACTIVE",
        "membershipVersion": 2
      }
    ]
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** الهاتف غير موجود في members. إذا احتاج المشرف هاتف عضو حالي مصرح به يستخدم API رقم 3. استخدم Team `version` و`membershipVersion` ونسخة Worker من Worker detail عند تنفيذ commands.

**بنستخدمه فين:** اللوحات 09 و10 و11 و13 و17؛ Team detail وSupervisor view.

---

## 14) PUT /api/v1/providers/{providerId}/teams/{teamId}

**الوظيفة:** استبدال اسم Team الحالي باسم جديد normalized وفريد.

**أهميته:** يمنع الأسماء المتكررة بعد التطبيع ويوفر optimistic concurrency.

**الصلاحية:** Provider Owner أو Provider Admin. المشرف الأساسي لا يغير الاسم.

**مثال للـinput:**

```json
{
  "name": "فريق النظافة الرئيسي",
  "expectedVersion": 6,
  "idempotencyKey": "00000000-0000-4000-8000-000000000109"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "TEAM_NAME_REPLACED",
    "targetId": "team_01",
    "version": 7,
    "impacts": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** `expectedVersion` هو Team version. الفريق `ARCHIVED` لا يقبل تعديلًا. بعد النجاح يمكن تحديث النسخة محليًا من `data.version` أو إعادة GET.

**بنستخدمه فين:** اللوحتان 09 و13؛ Edit Team name.

---

## 15) POST /api/v1/providers/{providerId}/teams/{teamId}/lifecycle-commands

**الوظيفة:** تنفيذ `ACTIVATE | DEACTIVATE | REACTIVATE | ARCHIVE` على Team.

**أهميته:** يطبق matrix الانتقالات وشروط التفعيل والأرشفة التاريخية في command واحدة.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput — تفعيل:**

```json
{
  "action": "ACTIVATE",
  "expectedVersion": 3,
  "idempotencyKey": "00000000-0000-4000-8000-000000000110"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "TEAM_ACTIVATED",
    "targetId": "team_01",
    "version": 4,
    "impacts": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** التفعيل يحتاج اسمًا صالحًا وعضوًا حاليًا واحدًا على الأقل يكون Worker `ACTIVE` من نوع `CLEANING_STAFF` وعضويته `cleans=true`. الأرشفة مسموحة من `INACTIVE` فقط، تنهي كل العضويات الحالية، تمسح primary Supervisor عند وجوده، وتكون نهائية. إيقاف Team لا يوقف Workers.

**بنستخدمه فين:** اللوحات 10 و13 و16؛ Team lifecycle وarchive preview.

---

## 16) POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands

**الوظيفة:** إضافة عضو، تغيير `cleans`، نقل عضو، أو إزالة عضو من Team.

**أهميته:** يحافظ على تاريخ العضويات وعلى قاعدة Team واحدة حالية لكل Worker، ويطبق final-cleaner atomicity.

**الصلاحية:** Owner/Admin لكل الأفعال. primary Supervisor يستطيع `UPDATE_CLEANS` فقط لعضوية حالية في فريقه ولا يستطيع تأكيد إزالة آخر منظف.

**مثال للـinput — إضافة عضو:**

```json
{
  "action": "ADD",
  "workerId": "wrk_01",
  "cleans": true,
  "expectedVersion": 3,
  "expectedWorkerVersion": 2,
  "idempotencyKey": "00000000-0000-4000-8000-000000000111"
}
```

**مثال للـoutput — 201 عند ADD:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "TEAM_MEMBERSHIP_ADDED",
    "targetId": "mem_01",
    "version": 1,
    "impacts": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:**

- `ADD`: يحتاج `workerId`, `cleans`, Team `expectedVersion`, و`expectedWorkerVersion`.
- `UPDATE_CLEANS`: يضيف `membershipId`, `expectedMembershipVersion`, `confirmLastCleanerImpact`.
- `REMOVE`: يحتاج `membershipId`, `expectedMembershipVersion`, وimpact confirmation عند اللزوم.
- `MOVE`: يحتاج أيضًا `targetTeamId`, `expectedTargetTeamVersion`, وقيمة `cleans` في الفريق الجديد.
- Worker من نوع `ESCORT` يجب أن تكون عضويته دائمًا `cleans=false`.
- إذا كانت العملية ستزيل آخر منظف صالح من Team نشط، يحصل Owner/Admin أولًا على conflict آمن لعرض المراجعة ثم يعيد الأمر بالتأكيد والنسخ المحدثة. العملية المقبولة تحدّث العضوية والفريق والتاريخ atomically.

**بنستخدمه فين:** اللوحات 09 و10 و11 و16 و17؛ إدارة أعضاء Team وfinal-cleaner flow.

---

## 17) POST /api/v1/providers/{providerId}/teams/{teamId}/supervisor-commands

**الوظيفة:** تعيين أو مسح primary Supervisor للفريق.

**أهميته:** يحافظ على مشرف أساسي واحد فقط ويصالح Supervisor role مع جميع التعيينات الحالية.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput — تعيين:**

```json
{
  "action": "ASSIGN",
  "workerId": "wrk_02",
  "expectedVersion": 4,
  "expectedWorkerVersion": 3,
  "expectedMembershipVersion": 2,
  "idempotencyKey": "00000000-0000-4000-8000-000000000112"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "PRIMARY_SUPERVISOR_ASSIGNED",
    "targetId": "team_01",
    "version": 5,
    "impacts": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** المرشح يجب أن يكون Worker نشطًا، عضوًا حاليًا في Team، و`supervisorCapable=true`. أمر `CLEAR` يحتاج فقط `action`, Team `expectedVersion`, و`idempotencyKey`. فقدان الصلاحية أو الخروج من الفريق يمسح التعيين تلقائيًا، لكنه لا يجعل Team inactive إذا بقي منظف صالح.

**بنستخدمه فين:** اللوحتان 09 و16؛ Team Supervisor control.

---

## 18) GET /api/v1/providers/{providerId}/teams/{teamId}/history

**الوظيفة:** إرجاع التاريخ الآمن وغير القابل للتعديل للفريق وعضوياته والمشرف الأساسي.

**أهميته:** يشرح للمالك/المدير ماذا تغيّر ومتى ومن نفّذه، مع الحفاظ على الخصوصية.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput:**

```http
GET /api/v1/providers/prv_01/teams/team_01/history?limit=25
Authorization: Bearer <ACCESS_TOKEN>
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "historyId": "hist_team_01",
        "targetType": "TEAM_MEMBERSHIP",
        "targetId": "mem_01",
        "targetVersion": 2,
        "eventCode": "TEAM_MEMBERSHIP_CLEANS_UPDATED",
        "actorUserId": "usr_admin_01",
        "reasonCode": null,
        "note": null,
        "safeBefore": {"status": "CURRENT", "version": 1, "teamId": "team_01", "cleans": true},
        "safeAfter": {"status": "CURRENT", "version": 2, "teamId": "team_01", "cleans": false},
        "createdAt": "2026-08-27T10:30:00.000Z"
      }
    ],
    "nextCursor": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** السجل لا يعرض هواتف أو invitation data أو credentials. يمكن أن يحتوي على أحداث Team وTEAM_MEMBERSHIP وPRIMARY_SUPERVISOR في نفس timeline.

**بنستخدمه فين:** اللوحات 10 و13 و15؛ Team history وimpact evidence.

---

## 19) GET /api/v1/providers/{providerId}/workforce-readiness

**الوظيفة:** إرجاع `workersReady` المشتقة وعدد العمال المؤهلين وأسباب عدم الجاهزية، مع نسخة CAS الحالية للقوى العاملة.

**أهميته:** يغذي readiness dashboard، ويحمي آخر Worker مؤهل، ويوفر `workforceVersion` اللازمة لإنشاء Worker أو Team.

**الصلاحية:** Provider Owner أو Provider Admin.

**مثال للـinput:**

```http
GET /api/v1/providers/prv_01/workforce-readiness
Authorization: Bearer <ACCESS_TOKEN>
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "providerId": "prv_01",
    "workforceVersion": 8,
    "workersReady": true,
    "qualifyingWorkerCount": 1,
    "blockerCodes": []
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** العامل المؤهل يجب أن يكون `ACTIVE`, من نوع `CLEANING_STAFF`, ملفه مكتمل، مرتبطًا بحساب Authentication نشط، يملك Worker role، وlogin access نشطًا. Team membership ليست شرطًا. أكواد المنع: `NO_ACTIVE_CLEANING_WORKER | PROFILE_INCOMPLETE | WORKER_ACCOUNT_OR_ROLE_INACTIVE | WORKER_LOGIN_ACCESS_INACTIVE`. لا تحاول كتابة `workersReady`؛ هي حقيقة مشتقة.

**بنستخدمه فين:** اللوحات 01 و07 و08 و10 و14 و16؛ dashboard، impact review، والحصول على نسخة الإنشاء.

---

## 20) GET /api/v1/workers/me

**الوظيفة:** إرجاع السياق الخاص بالـWorker الحالي فقط.

**أهميته:** يوفر self-service آمنًا من دون منح صلاحيات إدارة Provider.

**الصلاحية:** Worker بهوية مرتبطة وaccess صالح.

**مثال للـinput:**

```http
GET /api/v1/workers/me
Authorization: Bearer <ACCESS_TOKEN>
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "viewScope": "SELF",
    "worker": {
      "workerId": "wrk_01",
      "providerId": "prv_01",
      "fullLegalName": "أحمد محمد",
      "gender": "male",
      "workerType": "CLEANING_STAFF",
      "displayTitle": "عامل نظافة",
      "operationalStatus": "ACTIVE",
      "supervisorCapable": false,
      "currentTeamId": "team_01",
      "workerVersion": 3,
      "profileVersion": 2
    },
    "operationalPhoneE164": "+201012345678",
    "skills": ["تنظيف عميق"],
    "loginAccessStatus": "ACTIVE",
    "avatar": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** الشاشة read-only للبيانات المدارة بواسطة Provider. Worker لا يستطيع تعديل الاسم أو الهاتف أو النوع أو المهارات أو الفريق أو الصلاحيات من هذا المسار.

**بنستخدمه فين:** اللوحتان 12 و17؛ Worker self-service.

---

## 21) POST /api/v1/workers/me/leave

**الوظيفة:** تسجيل مغادرة Worker الحالية لمقدم الخدمة بإرادته.

**أهميته:** ينهي engagement والعضوية الحالية والوصول الخاص بالـProvider مع الحفاظ على الهوية المشتركة والتاريخ.

**الصلاحية:** Worker الحالي نفسه فقط.

**مثال للـinput:**

```json
{
  "expectedVersion": 3,
  "expectedTeamVersion": 6,
  "expectedMembershipVersion": 2,
  "confirmTeamImpact": true,
  "confirmReadinessImpact": true,
  "idempotencyKey": "00000000-0000-4000-8000-000000000113"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "outcomeCode": "WORKER_DEPARTED",
    "targetId": "wrk_01",
    "version": 4,
    "impacts": [
      {
        "targetType": "TEAM_MEMBERSHIP",
        "targetId": "mem_01",
        "outcomeCode": "TEAM_MEMBERSHIP_ENDED",
        "version": 3
      }
    ]
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** نسخ Team وmembership تُرسل فقط عند وجود عضوية/impact ذي صلة. إذا كانت المغادرة تؤثر على آخر منظف أو آخر عامل جاهزية، يجب عرض impact review ثم إعادة الطلب بالتأكيد. العملية لا تحذف حساب Authentication ولا أدواره الأخرى.

**بنستخدمه فين:** اللوحتان 12 و17؛ Leave Provider flow.

---

## 22) POST /api/v1/worker-invitations/inspect

**الوظيفة:** فحص أحدث دعوة صالحة وإرجاع بيانات آمنة ومقنعة قبل تسجيل الدخول.

**أهميته:** يحدد Provider وWorker واللغة والنسخ المطلوبة من دون كشف هل البريد مرتبط مسبقًا بحساب.

**الصلاحية:** Public؛ لا يحتاج Bearer token.

**مثال للـinput:**

```json
{
  "invitationProof": "<INVITATION_PROOF>"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "providerId": "prv_01",
    "workerId": "wrk_01",
    "invitationVersion": 2,
    "expectedVersion": 2,
    "locale": "AR",
    "maskedEmail": "a***@example.com",
    "expiresAt": "2026-08-30T10:00:00.000Z",
    "onboardingMode": "AUTHENTICATE_OR_CREATE",
    "expectedWorkerVersion": 3,
    "expectedAccessVersion": 2
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** لا تعرض proof في UI أو logs. `AUTHENTICATE_OR_CREATE` لا يكشف وجود هوية؛ الواجهة تعرض خيار تسجيل الدخول لحساب موجود أو بدء إنشاء حساب جديد. الدعوة المنتهية أو الملغاة أو superseded ترجع خطأ آمنًا بلا state جزئي.

**بنستخدمه فين:** اللوحتان 06 و17؛ أول خطوة في invitation wizard.

---

## 23) POST /api/v1/worker-invitations/onboarding/start

**الوظيفة:** بدء onboarding لحساب جديد على البريد الثابت في الدعوة وإرسال challenge للتحقق.

**أهميته:** يربط إنشاء الهوية بالدعوة من دون السماح بتغيير البريد أو الهاتف العالمي للحساب.

**الصلاحية:** Public؛ لا يحتاج Bearer token.

**مثال للـinput:**

```json
{
  "invitationProof": "<INVITATION_PROOF>",
  "password": "<NEW_ACCOUNT_PASSWORD>",
  "expectedVersion": 2,
  "idempotencyKey": "00000000-0000-4000-8000-000000000114"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "challengeId": "challenge_01",
    "maskedDestination": "a***@example.com",
    "expiresAt": "2026-08-27T11:15:00.000Z"
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** `expectedVersion` يأتي من inspect. لا تخزن password ولا ترسلها إلى analytics. الشخص الذي لديه حساب موجود لا يحتاج إنشاء حساب جديد؛ يسجل الدخول بالطريقة العادية ثم يكمل accept.

**بنستخدمه فين:** اللوحتان 06 و17؛ خطوة إنشاء الحساب في invitation wizard.

---

## 24) POST /api/v1/worker-invitations/onboarding/verify-email

**الوظيفة:** التحقق من كود البريد وإرجاع جلسة محدودة الغرض لإكمال قبول الدعوة.

**أهميته:** يثبت البريد للحساب الجديد ويمنع استخدام الجلسة المؤقتة في أعمال أخرى غير قبول الدعوة وتنظيف الجلسة.

**الصلاحية:** Public؛ لا يحتاج Bearer token قبل التحقق.

**مثال للـinput:**

```json
{
  "invitationProof": "<INVITATION_PROOF>",
  "challengeId": "challenge_01",
  "code": "<OTP_CODE>",
  "expectedVersion": 2,
  "idempotencyKey": "00000000-0000-4000-8000-000000000115"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "userId": "usr_worker_01",
    "emailNormalized": "worker@example.com",
    "capability": "WORKER_INVITATION_ONBOARDING",
    "allowedActions": ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"],
    "accessToken": "<ONBOARDING_ACCESS_TOKEN>",
    "accessExpiresAt": "2026-08-27T11:30:00.000Z",
    "refreshToken": "<ONBOARDING_REFRESH_TOKEN>",
    "refreshExpiresAt": "2026-08-28T11:00:00.000Z"
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** هذه الاستجابة حساسة ويجب أن تستخدم `Cache-Control: no-store, private`. لا تسجل tokens أو OTP. استخدم access token الناتج في Authorization لعملية accept فقط، ثم اتبع session cleanup المعتاد.

**بنستخدمه فين:** اللوحتان 06 و17؛ خطوة تأكيد البريد.

---

## 25) POST /api/v1/worker-invitations/accept

**الوظيفة:** قبول أحدث دعوة صالحة وربط الهوية بالـWorker engagement وتفعيل Worker role وlogin access، مع مراجعة الهاتف التشغيلي.

**أهميته:** هو commit point للانضمام؛ إما أن تتم الهوية والدور والوصول والقبول معًا، أو لا يتغير شيء.

**الصلاحية:** Bearer token لهوية صحيحة: جلسة onboarding محدودة أو جلسة المستخدم الموجود الذي سجّل الدخول.

**مثال للـinput:**

```http
POST /api/v1/worker-invitations/accept
Authorization: Bearer <ONBOARDING_OR_USER_ACCESS_TOKEN>
Content-Type: application/json
```

```json
{
  "invitationProof": "<INVITATION_PROOF>",
  "expectedVersion": 2,
  "expectedWorkerVersion": 3,
  "expectedAccessVersion": 2,
  "operationalPhoneE164": "+201012345678",
  "idempotencyKey": "00000000-0000-4000-8000-000000000116"
}
```

**مثال للـoutput — 200:**

```json
{
  "success": true,
  "data": {
    "viewScope": "SELF",
    "worker": {
      "workerId": "wrk_01",
      "providerId": "prv_01",
      "fullLegalName": "أحمد محمد",
      "gender": "male",
      "workerType": "CLEANING_STAFF",
      "displayTitle": "عامل نظافة",
      "operationalStatus": "DRAFT",
      "supervisorCapable": false,
      "currentTeamId": null,
      "workerVersion": 4,
      "profileVersion": 2
    },
    "operationalPhoneE164": "+201012345678",
    "skills": ["تنظيف عميق"],
    "loginAccessStatus": "ACTIVE",
    "avatar": null
  },
  "requestId": "00000000-0000-4000-8000-000000000007"
}
```

**الشرح:** النسخ الثلاث تأتي من آخر inspect. الهاتف هنا هاتف تشغيل يديره Provider ولا يغيّر هاتف Authentication. قبول الدعوة لا يمنح Provider Admin ولا يلغي Customer role أو أدوارًا أخرى. بعد القبول يمكن الانتقال إلى Worker self-service. الدعوة القديمة أو stale versions ترجع conflict من دون partial identity/role/access state.

**بنستخدمه فين:** اللوحتان 06 و17؛ الخطوة النهائية في invitation acceptance.

---

## خريطة سريعة من صفحات الويب إلى APIs

| صفحة/تدفق | APIs الأساسية |
|---|---|
| Workforce overview | 1، 11، 19 |
| Workers list/create | 1، 2، 19 |
| Worker detail/edit/avatar | 3، 4، 5، 6 |
| Worker access/Admin | 3، 8، 9 |
| Worker lifecycle/impact | 3، 7، 10، 19 |
| Teams list/create | 11، 12، 19 |
| Team detail/membership/Supervisor | 13، 14، 16، 17 |
| Team lifecycle/history | 13، 15، 18 |
| Worker self/leave | 20، 21 |
| Invitation wizard | 22، 23، 24، 25 |

## ملاحظات تنفيذية أخيرة للفرونت

- لا تخلط بين Worker operational status وlogin access status وinvitation status وProvider Admin membership؛ كل واحدة حقيقة مستقلة.
- لا تضع email في Worker create/edit form؛ البريد يدخل فقط في Owner invitation flow.
- لا تعرض زر remove Worker أو access/Admin controls للـAdmin أو Supervisor أو Worker.
- لا تستخدم browser confirm للأثر النهائي؛ اعرض شاشة مراجعة توضح Team/readiness impact والنسخ التي سيعاد إرسالها.
- بعد أي 409 أعد جلب الهدف والنسخ بدل زيادة الرقم محليًا.
- بعد success command استخدم `data.version` للهدف، وأعد جلب التفاصيل عند الحاجة إلى أكثر من aggregate أو عند وجود `impacts`.
- فشل إرسال الإشعار لا يلغي business command المقبولة؛ لا ترجع UI إلى الحالة السابقة بسبب حالة delivery منفصلة.
