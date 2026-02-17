/*
Quiz Mocking
- يولّد أسئلة (MCQ + صح/خطأ) بناءً على اسم الملف المحفوظ في sessionStorage
- الهدف: تجربة اختبار كاملة بدون API
*/

export type QuizQuestion = {
  id: string;
  type: "mcq" | "tf";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  skill: "الفهم" | "التطبيق";
};

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function seededRand(seed: number) {
  // Mulberry32
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateQuizMock(fileName: string, count = 8): QuizQuestion[] {
  const seed = hashString(fileName || "default");
  const rng = seededRand(seed);

  const subjectHints = [
    "منطق علمي",
    "تعريفات أساسية",
    "تطبيق عملي",
    "تحليل جدول",
    "مفهوم رياضي",
    "كود برمجي",
  ];

  const baseMcq: Omit<QuizQuestion, "id">[] = [
    {
      type: "mcq",
      skill: "الفهم",
      question: "ما الهدف الأساسي من تنظيم المحاضرة إلى عناوين ونقاط؟",
      options: [
        "زيادة حجم المحتوى فقط",
        "تسهيل الاستيعاب والمراجعة السريعة",
        "إخفاء التفاصيل المهمة",
        "منع الطالب من التلخيص",
      ],
      correctIndex: 1,
      explanation:
        "التقسيم لعناوين ونقاط يقلل الحمل المعرفي ويجعل المراجعة أسرع وأكثر وضوحاً.",
    },
    {
      type: "mcq",
      skill: "التطبيق",
      question: "أي خطوة تُعتبر الأفضل قبل حل الأسئلة التدريبية؟",
      options: [
        "تجاهل التعاريف",
        "قراءة العناوين ثم مراجعة الملخص",
        "حل الأسئلة بدون قراءة",
        "الاكتفاء بقراءة أول صفحة",
      ],
      correctIndex: 1,
      explanation:
        "المرور على العناوين والملخص يعطي خريطة ذهنية تساعدك في حل الأسئلة بثقة.",
    },
    {
      type: "mcq",
      skill: "الفهم",
      question: "في جدول الملخص، ماذا تمثل (المخرجات) عادةً؟",
      options: [
        "البيانات المدخلة للنظام",
        "نتيجة المعالجة أو ما يتم إنتاجه",
        "اسم المادة فقط",
        "عدد الصفحات",
      ],
      correctIndex: 1,
      explanation:
        "المخرجات هي النتيجة النهائية بعد معالجة المدخلات وفق القواعد/الخوارزمية.",
    },
    {
      type: "mcq",
      skill: "التطبيق",
      question: "أي اختيار يوضح أفضل استخدام للـProgress Bar أثناء الاختبار؟",
      options: [
        "تشتت الطالب بمعلومات كثيرة",
        "يعطي إحساس بالتقدم ويقلل القلق",
        "يزيد زمن التحميل",
        "يمنع عرض الإجابات",
      ],
      correctIndex: 1,
      explanation:
        "شريط التقدم يقدم تغذية راجعة عن المسار ويزيد الالتزام حتى نهاية الاختبار.",
    },
  ];

  const baseTf: Omit<QuizQuestion, "id">[] = [
    {
      type: "tf",
      skill: "الفهم",
      question: "عرض الجداول داخل الشرح يساعد على تلخيص العلاقات بين العناصر.",
      options: ["صح", "خطأ"],
      correctIndex: 0,
      explanation:
        "الجداول ممتازة لعرض المقارنات والعلاقات بشكل سريع وواضح.",
    },
    {
      type: "tf",
      skill: "التطبيق",
      question: "الأفضل في التعلم هو حفظ الإجابات دون فهم سبب صحتها.",
      options: ["صح", "خطأ"],
      correctIndex: 1,
      explanation:
        "الفهم + التفسير هو ما يثبت المعلومة ويجعلها قابلة للتطبيق في مسائل جديدة.",
    },
  ];

  // توليد أسئلة “مُنكّهة” باسم الملف
  const flavored = Array.from({ length: 6 }).map(() => {
    const hint = pick(rng, subjectHints);
    const isMcq = rng() > 0.35;
    if (isMcq) {
      const correct = Math.floor(rng() * 4);
      const opt = [
        `خيار مرتبط بـ ${hint}`,
        `خيار غير دقيق حول ${hint}`,
        `خيار عام لا يشرح ${hint}`,
        `الخيار الأدق المتوافق مع ${fileName}`,
      ];
      // اجعل “الأدق” غالباً صحيحاً لكن بشكل غير ثابت
      const correctIndex = rng() > 0.5 ? 3 : correct;
      return {
        type: "mcq" as const,
        skill: rng() > 0.5 ? ("الفهم" as const) : ("التطبيق" as const),
        question: `بالاعتماد على ملف: ${fileName} — أي اختيار يعبّر عن ${hint} بشكل أفضل؟`,
        options: opt,
        correctIndex,
        explanation:
          `لأننا نبحث عن اختيار يقدّم معنى قابل للتطبيق ويتسق مع سياق "${fileName}"، فالاختيار الصحيح هو الأكثر تحديداً والأقرب للمفهوم.`,
      };
    }

    const correctIndex = rng() > 0.5 ? 0 : 1;
    return {
      type: "tf" as const,
      skill: rng() > 0.5 ? ("الفهم" as const) : ("التطبيق" as const),
      question: `صح/خطأ: اسم الملف "${fileName}" وحده لا يكفي لبناء شرح دقيق.`,

      options: ["صح", "خطأ"],
      correctIndex,
      explanation:
        "اسم الملف يساعد كمؤشر مبدئي، لكن الشرح الدقيق يعتمد على محتوى الملف نفسه (أو آخر نتيجة تحليل محفوظة).", 
    };
  });

  const pool: Omit<QuizQuestion, "id">[] = [...baseMcq, ...baseTf, ...flavored];

  // اسحب عدد الأسئلة المطلوب بدون تكرار قدر الإمكان
  const out: QuizQuestion[] = [];
  const used = new Set<number>();
  while (out.length < count && used.size < pool.length) {
    const idx = Math.floor(rng() * pool.length);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push({
      id: `q_${seed}_${out.length}_${idx}`,
      ...pool[idx],
    });
  }

  // لو لسه ناقص، كمّل بتكرار بسيط
  while (out.length < count) {
    const idx = Math.floor(rng() * pool.length);
    out.push({
      id: `q_${seed}_${out.length}_${idx}_r`,
      ...pool[idx],
    });
  }

  return out;
}
