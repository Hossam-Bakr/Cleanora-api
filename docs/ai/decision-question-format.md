# Decision Question Format

Use this contract whenever Cleanora's human owner must choose or approve a
material product, UX, security, scope, or operational decision. Ask in the
owner's language.

## Required format

1. Ask one clear, numbered question.
2. Provide two to four real, mutually exclusive numbered options. Do not add
   filler choices merely to increase the count.
3. Place the recommendation after all options using the localized equivalent
   of `أنا أقترح الاختيار رقم (N)`, followed by concise UX, Product, or Security
   reasoning that explains the trade-off.
4. Accept the option number; `recommended`; `المقترح`; an equivalent clear
   acceptance such as `yes` or `نعم`; or a short alternative answer when the
   question genuinely permits one.
5. In a workflow authorized to write, persist each accepted answer immediately,
   reconcile conflicting wording, and run the workflow's required validation
   before asking the next question.

Use this shape:

```text
1. <السؤال الواضح>؟

1. <الخيار الأول>
2. <الخيار الثاني>
3. <الخيار الثالث عند الحاجة>
4. <الخيار الرابع عند الحاجة>

أنا أقترح الاختيار رقم (N) للأسباب التالية:
- <سبب UX أو Product أو Security واضح>
- <أثر أو trade-off مهم>

يمكن الرد برقم الاختيار، أو "recommended"، أو "المقترح"، أو بإجابة بديلة قصيرة إذا كانت مناسبة.
```

Do not turn a simple factual or informational question into artificial multiple
choice. If the requester needs to supply a name, identifier, or other short
fact rather than choose a policy, ask for that value directly and constrain the
expected answer when useful.

## Spec Kit rules

- A formal `speckit-clarify` session asks exactly one targeted question at a
  time and asks no more than five questions in that session. Never reveal its
  future question queue unless the owner explicitly requests a batch preview
  outside the formal clarification loop.
- `speckit-specify` may retain no more than three `[NEEDS CLARIFICATION]`
  markers. Resolve them sequentially using this format, persisting and
  validating each accepted answer before presenting the next one.
- Recommendations never appear before the available options, and material
  decisions never use lettered option labels or option tables.
