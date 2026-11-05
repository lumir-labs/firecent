import { Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

import { getTranslations } from "next-intl/server";

export async function LandingTestimonials() {
  const t = await getTranslations("Landing");

  const items = [
    { quote: t("testimonials.q1"), name: t("testimonials.n1"), role: t("testimonials.r1"), initials: "VR" },
    { quote: t("testimonials.q2"), name: t("testimonials.n2"), role: t("testimonials.r2"), initials: "DF" },
    { quote: t("testimonials.q3"), name: t("testimonials.n3"), role: t("testimonials.r3"), initials: "CD" },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {t("testimonials.eyebrow")}
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          {t("testimonials.title")}
        </h2>
        <p className="mt-4 text-muted-foreground">
          {t("testimonials.subtitle")}
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Card key={item.name} className="flex flex-col">
            <CardHeader>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm leading-relaxed text-pretty">
                “{item.quote}”
              </p>
            </CardContent>
            <CardFooter className="gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                  {item.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
