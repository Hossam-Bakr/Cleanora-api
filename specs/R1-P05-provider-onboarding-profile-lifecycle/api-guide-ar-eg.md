# دليل APIs مرحلة R1-P05 بالعامية المصرية

الدليل ده مرجع سريع لصاحب المشروع والـFrontend علشان نعرف كل API في مرحلة **Provider Onboarding, Profile & Lifecycle** بتعمل إيه. القائمة مبنية على عقد R1-P05 المكتمل: **35 مسار و41 عملية**، وكل المسارات تحت `/api/v1`.

## قبل ما تبدأ

- أغلب الـAPIs محتاجة `Bearer accessToken` لمستخدم مسجّل دخول، والصلاحية بتتحدد من علاقة المستخدم بالـProvider.
- `{providerId}` هو رقم مقدم الخدمة، و`{userId}` و`{invitationId}` و`{galleryItemId}` بيتبدلوا بالقيم الحقيقية.
- `expectedVersion` هو آخر `version` رجّعه السيرفر؛ بنبعته مع أي تعديل علشان يمنع تعديل بيانات قديمة فوق تعديل أحدث.
- بيانات التواصل خاصة ومش بتظهر للعميل، وR1-P05 مافيهاش API عامة للبحث عن مقدمي الخدمة.
- الطلب بيتبني على خطوات: إنشاء Draft، ثم البروفايل، بيانات التواصل، الميديا، وبعد كده الإرسال لمراجعة الـStaff Admin.

---

## 1. إنشاء الطلب والبروفايل وبيانات التواصل

### `POST /api/v1/providers`

الـAPI دي بتبدأ طلب التسجيل كمقدم خدمة، وبتستقبل `providerKind` فقط: `INDIVIDUAL_TEAM` أو `REGISTERED_COMPANY`.  
السيرفر بيعمل Provider Draft ويرجع `providerId` و`version`؛ باقي بيانات الفورم بتتحفظ بعد كده من APIs منفصلة.

### `GET /api/v1/providers`

الـAPI دي بترجع كل الـProviders اللي المستخدم الحالي مسموح له يدخل عليهم، سواء صاحب الطلب أو `OWNER` أو `ADMIN`.  
الـFrontend يستخدمها في شاشة "مقدمو الخدمة بتوعي"، والنتيجة بتدعم `cursor` و`limit` للـpagination.

### `GET /api/v1/providers/{providerId}`

الـAPI دي بترجع التفاصيل الخاصة الكاملة للـProvider: حالة الطلب، البروفايل، الميديا، الاكتمال، الجاهزية، وآخر قرار مراجعة.  
بتستخدم غالبًا عند فتح Dashboard مقدم الخدمة، ومش بترجع بيانات أسرار التخزين أو كلمات السر أو توكنات الدعوات.

### `PATCH /api/v1/providers/{providerId}/kind`

الـAPI دي بتغير نوع مقدم الخدمة بين `INDIVIDUAL_TEAM` و`REGISTERED_COMPANY` وهو لسه Draft وقبل أول إرسال للمراجعة.  
مسموحة لصاحب الطلب فقط، وبتستقبل `providerKind` الجديد مع `expectedVersion`.

### `GET /api/v1/providers/{providerId}/profile`

الـAPI دي بتجيب بيانات الملف التعريفي القابلة للتعديل زي الاسم والوصف والدولة.  
الـFrontend يستخدمها علشان يملأ فورم البروفايل الحالي، وهي ما بترجعش بيانات التواصل الخاصة.

### `PUT /api/v1/providers/{providerId}/profile`

الـAPI دي بتحفظ فورم الملف التعريفي كاملًا، زي الاسم العربي والإنجليزي والوصف والدولة، مع `expectedVersion`.  
هي Full Replacement، يعني الفرونت يبعت الحالة الكاملة للفورم، وتعديلها يفضل متاح بعد الموافقة حسب صلاحية المستخدم.

### `GET /api/v1/providers/{providerId}/contacts`

الـAPI دي بتجيب بيانات التواصل التشغيلية الخاصة للـProvider، زي الإيميل والموبايل وWhatsApp والموقع.  
مسموحة للمستخدمين المصرح لهم والـStaff Admin فقط، والبيانات دي ممنوع تظهر في الـPreview الخاص بالعملاء.

### `PUT /api/v1/providers/{providerId}/contacts`

الـAPI دي بتحفظ فورم بيانات التواصل الخاصة كاملًا، وفيه الإيميل والموبايل وقنوات التواصل الاختيارية.  
الـFrontend لازم يبعت كل القنوات الحالية مع `expectedVersion`؛ لأنها Full Replacement مش إضافة جزئية.

### `POST /api/v1/providers/{providerId}/application/submit`

الـAPI دي بتبعت الطلب المكتمل لمراجعة الـStaff Admin وتحول حالته إلى `PENDING_REVIEW`.  
بتستقبل `expectedVersion`، ولو فيه بيانات ناقصة بترجع كل أسباب النقص مع بعض علشان الفرونت يوضحها للمستخدم.

---

## 2. الصور والفيديوهات

### `GET /api/v1/providers/{providerId}/media`

الـAPI دي بترجع اللوجو والغلاف وصور وفيديوهات المعرض، مع حالة معالجة كل ملف وترتيبه وروابط العرض المؤقتة.  
الـFrontend يستخدمها في شاشة إدارة الميديا، والروابط بتكون آمنة ومش بتكشف مفاتيح التخزين الداخلية.

### `PUT /api/v1/providers/{providerId}/media/logo`

الـAPI دي بترفع لوجو جديد أو تستبدل اللوجو الحالي باستخدام `multipart/form-data`.  
الطلب بيبعت `file` و`expectedVersion`، والسيرفر بيتحقق من نوع الصورة وحجمها وبيجهزها بالمقاس المطلوب.

### `DELETE /api/v1/providers/{providerId}/media/logo`

الـAPI دي بتمسح اللوجو الحالي من ملف مقدم الخدمة، وبتستقبل `expectedVersion`.  
بعد المسح السيرفر بيعيد حساب نسبة الاكتمال والجاهزية فورًا، فممكن الطلب يرجع ناقص لحد ما يترفع لوجو جديد.

### `PUT /api/v1/providers/{providerId}/media/cover`

الـAPI دي بترفع صورة غلاف جديدة أو تستبدل صورة الغلاف الموجودة باستخدام `multipart/form-data`.  
الطلب بيحتوي على `file` و`expectedVersion`، والسيرفر بيتعامل مع التخزين والمعالجة وتحديث نسخة الـProvider.

### `DELETE /api/v1/providers/{providerId}/media/cover`

الـAPI دي بتشيل صورة الغلاف الحالية، من غير ما تمسح حساب مقدم الخدمة أو باقي المعرض.  
لازم يتبعت `expectedVersion`، وبعدها نسبة الاكتمال والجاهزية بتتحسب من جديد.

### `POST /api/v1/providers/{providerId}/media/gallery-images`

الـAPI دي بتضيف صورة جديدة لمعرض مقدم الخدمة باستخدام `file` و`expectedVersion` في `form-data`.  
الحد الأقصى للمعرض 12 صورة، والسيرفر بيرفض الملف غير المناسب أو الزيادة عن الحد المسموح.

### `POST /api/v1/providers/{providerId}/media/gallery-videos`

الـAPI دي بتضيف فيديو جديد للمعرض باستخدام `multipart/form-data` وبتبدأ معالجته وتجهيز بياناته المصغرة.  
الحد الأقصى فيديوهين وحجم الفيديو 40MB، والـFrontend يتابع حالة المعالجة من API الميديا.

### `PUT /api/v1/providers/{providerId}/media/gallery-order`

الـAPI دي بتغير ترتيب صور وفيديوهات المعرض حسب الترتيب اللي المستخدم عمله بالسحب والإفلات.  
لازم `orderedGalleryItemIds` تحتوي كل عناصر المعرض مرة واحدة بالضبط، ومعاها `expectedVersion`.

### `DELETE /api/v1/providers/{providerId}/media/gallery/{galleryItemId}`

الـAPI دي بتمسح صورة أو فيديو محدد من المعرض باستخدام `galleryItemId`.  
بتستقبل `expectedVersion`، وبعد المسح السيرفر بيحدّث ترتيب المعرض والاكتمال والجاهزية.

---

## 3. الاكتمال والجاهزية وشاشات مقدم الخدمة

### `GET /api/v1/providers/{providerId}/completion`

الـAPI دي بتحسب نسبة اكتمال ملف مقدم الخدمة وبتوضح كل شرط اتحقق أو لسه ناقص.  
الـFrontend يستخدمها في Progress Bar وقائمة الخطوات الناقصة، والحساب بيتغير حسب نوع مقدم الخدمة.

### `GET /api/v1/providers/{providerId}/readiness`

الـAPI دي بترجع بوابات الجاهزية زي موافقة الطلب والمستندات والتحويل والعمال والخدمات والتغطية والتشغيل.  
كل Gate بتوضح حالتها والسبب والمرحلة المسؤولة عنها؛ وR1-P05 لا تجعل مقدم الخدمة ظاهرًا للعامة بنفسها.

### `GET /api/v1/providers/{providerId}/history`

الـAPI دي بترجع تاريخ تغيّر حالة طلب مقدم الخدمة وحالته التشغيلية بترتيب زمني.  
الـFrontend يستخدمها في Timeline، والنتيجة بتدعم `cursor` و`limit` لو السجل كبير.

### `GET /api/v1/providers/{providerId}/dashboard`

الـAPI دي بتجمع أهم معلومات الصفحة الرئيسية لمقدم الخدمة في Response واحدة مناسبة للـDashboard.  
بتوضح الحالة الحالية ونسبة الاكتمال والجاهزية والخطوة المطلوبة، علشان الفرونت يعرف يوجّه المستخدم بسرعة.

### `GET /api/v1/providers/{providerId}/settings`

الـAPI دي بترجع كروت الإعدادات المتاحة وحالة كل جزء وصلاحية المستخدم في عرضه أو تعديله.  
هي للعرض والتوجيه للصفحات الصحيحة فقط؛ مافيش في R1-P05 API عامة اسمها "تعديل كل الإعدادات".

### `GET /api/v1/providers/{providerId}/preview`

الـAPI دي بتعرض Preview آمن لشكل بروفايل مقدم الخدمة اللي ممكن يظهر للعميل مستقبلًا.  
بتحتوي الاسم والوصف والدولة والميديا فقط، ومن غير إيميل أو موبايل أو أعضاء أو أسباب مراجعة.

---

## 4. أعضاء مقدم الخدمة ودعوات الـAdmin

### `GET /api/v1/providers/{providerId}/members`

الـAPI دي بترجع أعضاء الـProvider من نوع `OWNER` و`ADMIN` مع الحالة والبيانات الآمنة المطلوبة للإدارة.  
مسموحة للـOWNER فقط، ومش بتكشف بيانات تواصل الحسابات بشكل غير ضروري.

### `DELETE /api/v1/providers/{providerId}/members/{userId}`

الـAPI دي بتعطّل عضوية `ADMIN` محدد في الـProvider، لكنها ما بتمسحش حساب المستخدم نفسه.  
الـOWNER فقط يقدر يستخدمها مع `expectedVersion`، وما يقدرش يعطّل نفسه أو عضوية OWNER.

### `GET /api/v1/providers/{providerId}/admin-invitations`

الـAPI دي بتجيب دعوات الـProvider Admin اللي عملها الـOWNER وحالة كل دعوة زي delivered أو revoked أو expired.  
بتدعم `cursor` و`limit` وفلترة `status`، وبتعرض الإيميل هنا لأنها شاشة خاصة بالـOWNER.

### `POST /api/v1/providers/{providerId}/admin-invitations`

الـAPI دي بتعمل دعوة Admin جديدة على إيميل معين بعد ما طلب مقدم الخدمة يكون `APPROVED`.  
الـOWNER يبعت `email` و`expectedVersion`؛ السيرفر يرسل الدعوة لكن ما بيرجعش التوكن الخام في الـResponse.

### `POST /api/v1/providers/{providerId}/admin-invitations/{invitationId}/resend`

الـAPI دي بتعيد إرسال دعوة Admin فشل توصيلها أو محتاجة إرسال جديد.  
بتستقبل `expectedVersion`، وبتلغي التوكن القديم وتعمل توكن وصلاحية جديدين لمدة 72 ساعة.

### `POST /api/v1/providers/{providerId}/admin-invitations/{invitationId}/revoke`

الـAPI دي بتلغي دعوة Admin قبل ما الشخص يقبلها، وبتمنع استخدام التوكن بعدها.  
مسموحة للـOWNER مع `expectedVersion`، لكنها ما بتعطّليش عضو قبِل الدعوة بالفعل.

---

## 5. رحلة الشخص اللي استلم دعوة Admin

### `POST /api/v1/provider-admin-invitations/inspect`

الـAPI دي بتفحص توكن الدعوة قبل التسجيل وبتعرض معلومات آمنة زي اسم الـProvider والإيميل المخفي وتاريخ الانتهاء.  
ما بتديش أي صلاحية، وأي توكن باطل أو منتهي أو ملغي بيرجع Error آمن من غير كشف تفاصيل حساسة.

### `POST /api/v1/provider-admin-invitations/onboarding/start`

الـAPI دي بتبدأ إنشاء حساب جديد للشخص المدعو لو الإيميل مش مسجل عندنا، وبتستقبل `token` و`phone` و`password`.  
الإيميل بيتثبت تلقائيًا من الدعوة، والسيرفر يبعت له تحدي تحقق بالإيميل من غير ما ينشئ Customer Profile.

### `POST /api/v1/provider-admin-invitations/onboarding/verify-email`

الـAPI دي بتتحقق من كود الإيميل للحساب الجديد باستخدام `token` و`challengeId` و`code`.  
بعد النجاح بتدي Session محدودة جدًا لإكمال قبول الدعوة فقط، ولسه المستخدم ما بقاش Provider Admin.

### `POST /api/v1/provider-admin-invitations/accept`

الـAPI دي بتقبل الدعوة للمستخدم المسجل دخول بشرط إن إيميله المتحقق يطابق إيميل الدعوة.  
النجاح بيستهلك الدعوة مرة واحدة، ويعمل أو يفعّل عضوية `ADMIN` ويمنح صلاحية `provider_admin` بأمان.

---

## 6. مراجعة وإدارة الطلبات بواسطة Staff Admin

### `GET /api/v1/staff/providers/applications`

الـAPI دي بتجيب Queue طلبات مقدمي الخدمة للـStaff Admin مع فلاتر الحالة والنوع وتاريخ الإرسال.  
النتيجة ما فيهاش بيانات التواصل الخاصة، وبتدعم `cursor` و`limit` علشان شاشة المراجعات.

### `GET /api/v1/staff/providers/applications/{providerId}`

الـAPI دي بتجيب ملف المراجعة الكامل لطلب محدد: بيانات مقدم الطلب والبروفايل والميديا والتواصل والتاريخ والجاهزية.  
مسموحة للـStaff Admin فقط، ومصممة لشاشة اتخاذ القرار من غير كشف مفاتيح تخزين أو توكنات دعوات.

### `POST /api/v1/staff/providers/applications/{providerId}/approve`

الـAPI دي بتوافق على الطلب الموجود في `PENDING_REVIEW` باستخدام `expectedVersion`.  
النجاح بيعمل عضوية `OWNER` والصلاحيات المطلوبة ويسجل التاريخ والـAudit، لكن الحالة التشغيلية تبدأ `INACTIVE` مش `LIVE`.

### `POST /api/v1/staff/providers/applications/{providerId}/request-changes`

الـAPI دي بترجع الطلب لصاحب الطلب علشان يصلح حاجات محددة بدل ما يتم رفضه نهائيًا.  
الـStaff Admin لازم يبعت `reason` واضح مع `expectedVersion`، والحالة تتحول إلى `CHANGES_REQUESTED`.

### `POST /api/v1/staff/providers/applications/{providerId}/reject`

الـAPI دي بترفض الطلب نهائيًا، وبتحتاج `reason` واضح و`expectedVersion`.  
الرفض ما بيعملش عضوية OWNER أو صلاحيات Provider، وصاحب الطلب ما يقدرش يعيد فتح نفس الطلب في R1-P05.

### `POST /api/v1/staff/providers/{providerId}/suspend`

الـAPI دي بتوقف Provider موافَق عليه تشغيليًا وبتمنعه من التشغيل أو الظهور العام.  
الـStaff Admin لازم يبعت `reason` و`expectedVersion`، لكن إدارة الملف وإصلاح المشاكل تفضل متاحة للمصرح لهم.

### `POST /api/v1/staff/providers/{providerId}/reinstate`

الـAPI دي بترجع Provider الموقوف إلى الحالة التشغيلية `INACTIVE` بعد مراجعة سبب الإيقاف.  
بتحتاج `reason` و`expectedVersion`، وما بتحولوش مباشرة إلى `LIVE` لأن التشغيل الفعلي تابع لمراحل لاحقة.

---

## الفلو المختصر اللي تقوله للـFrontend

1. المستخدم يعمل `POST /providers` ويختار نوع مقدم الخدمة، فيطلع له Draft و`providerId`.
2. الفرونت يحفظ كل خطوة منفصلة: Profile ثم Contacts ثم Media، ويتابع Completion وReadiness.
3. لما الشروط تكتمل، الفرونت يعمل Submit؛ والـStaff Admin يراجع الطلب ويوافق أو يطلب تعديلات أو يرفض.
4. بعد الموافقة يتعمل OWNER تلقائيًا، ويقدر يدير البروفايل ويدعو Provider Admins، بينما التشغيل العام يفضل مرتبط بالمراحل التالية.

> **ملحوظة:** الـSwagger هو المرجع التقني النهائي للـrequest/response schemas. الدليل ده معمول علشان يشرح الغرض والـFrontend flow بسرعة، مش علشان يستبدل عقد OpenAPI.
