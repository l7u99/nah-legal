# منصة دقيقة قانونية | نهج القانوني

مشروع واجهة Vite + Supabase، مهيأ للنشر على GitHub Pages مع خدمات خلفية عبر Supabase Edge Functions.

## مهم قبل النشر
- GitHub Pages لا يشغّل قاعدة بيانات أو خادمًا. يلزم مشروع Supabase.
- لا توجد بيانات دخول افتراضية. لا تنشئ كلمة مرور داخل الكود.
- لا تضعي `service_role` key في GitHub أو في متغير يبدأ بـ `VITE_`.
- المفتاح العام `anon/publishable` فقط هو المسموح في واجهة المتصفح مع RLS.
- ملف الهجرة الحالي يهيئ الجداول وسياسات RLS الأساسية. يلزم استكمال محرر الأسئلة/الأرشيف/تصدير Excel واختبارات الأمان قبل اعتبار النظام إنتاجيًا بالكامل.

## تشغيل الواجهة
1. أنشئي مشروعًا في Supabase.
2. من Project Settings انسخي Project URL وPublishable/anon key.
3. انسخي `.env.example` إلى `.env.local` واملئي القيم.
4. شغلي:
   ```bash
   npm install
   npm run dev
   ```
5. للبناء:
   ```bash
   npm run build
   ```

## قاعدة البيانات
شغلي `supabase/migrations/001_schema.sql` من SQL Editor في Supabase.

## نشر الوظائف الخلفية
ثبتي Supabase CLI وسجلي الدخول ثم:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set PHONE_HASH_PEPPER="ضع-قيمة-عشوائية-طويلة-خاصة"
supabase functions deploy submit-participation
supabase functions deploy admin-login
```
يتم توفير `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` تلقائيًا في بيئة Edge Functions من Supabase. لا تضعيهما في ملفات الواجهة.

## إنشاء أول مدير بأمان
1. أنشئي مستخدمًا في Supabase Dashboard > Authentication > Users باستخدام بريد تملكينه وكلمة مرور قوية.
2. انسخي UUID للمستخدم.
3. أنشئي سجل المدير من SQL Editor، مع اختيار اسم مستخدم خاص:
   ```sql
   insert into public.admin_users(user_id, username, role, active)
   values ('UUID-من-لوحة-Supabase', 'lolo-admin', 'owner', true);
   ```
4. سجلي الدخول في الموقع باسم المستخدم الذي اخترتيه وكلمة المرور التي أنشأتيها في لوحة Supabase.
5. لا ترسلي كلمة المرور لأحد ولا تضعيها في المستودع.

## نشر GitHub Pages
يفضل ضبط Vite `base` حسب اسم المستودع، ثم تفعيل GitHub Actions لنشر مجلد `dist`. أضيفي متغيرات `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` في إعدادات GitHub Actions/Repository Variables أو Secrets.

## الحالة الحالية والحدود
- صفحة المشارك تستدعي قاعدة البيانات وتحمّل مجموعة منشورة.
- إرسال الإجابات يتم عبر Edge Function ويُعاد احتساب الدرجة على الخادم.
- منع التكرار مبدئيًا: رقم جوال واحد لكل مجموعة أسبوعية.
- صفحة الإدارة محمية بتحقق من وجود سجل مدير نشط، وتستخدم Supabase Auth.
- واجهة الإدارة الحالية تعرض سجل المشاركات بصيغة JSON؛ محرر الأسئلة المتكامل، إدارة الأدوار التفصيلية، سجل التدقيق، الأرشيف والنسخ التاريخية، تصدير Excel، وجدولة النشر تحتاج استكمالًا واختبارًا قبل الإنتاج.
- تعيد وظيفة الاعتماد تفاصيل الإجابة والتفسير والمصدر للمشارك بعد نجاح الاعتماد فقط.
- لا تُستخدم بيانات المشاركين الحقيقية حتى إكمال مراجعة سياسات الخصوصية، إعدادات RLS، الاختبارات، والنسخ الاحتياطي.

## ملاحظة قانونية
راجعي نصوص الأسئلة والإجابات والمراجع الرسمية قبل النشر. لا تعتبر بيانات الأسئلة seeded أو مراجعة قانونيًا بمجرد وجودها في قاعدة البيانات.
