import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { getTranslations } from "next-intl/server";

export async function LandingFaq() {
  const t = await getTranslations("Landing");

  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];

  return (
    <section id="faq" className="scroll-mt-20 bg-muted/40">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {t("faq.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {t("faq.title")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("faq.subtitle")}</p>
        </div>

        <Accordion className="mt-10">
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`}>
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
