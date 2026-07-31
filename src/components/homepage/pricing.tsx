"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import Link from "next/link";

const plans = [
  {
    name: "Starter",
    description: "For small teams getting started",
    price: "$0",
    period: "/month",
    cta: "Start free",
    featured: false,
    href: "/login",
    features: [
      "5 active workflows",
      "100 runs / month",
      "Community support",
      "1 team member",
    ],
  },
  {
    name: "Pro",
    description: "For growing teams that need more power",
    price: "$49",
    period: "/month",
    cta: "Start trial",
    featured: true,
    href: "/login",
    features: [
      "Unlimited workflows",
      "10,000 runs / month",
      "Priority support",
      "Up to 10 team members",
      "Advanced observability",
    ],
  },
  {
    name: "Enterprise",
    description: "For organizations with advanced needs",
    price: "Custom",
    period: "",
    cta: "Contact sales",
    featured: false,
    href: "/contact",
    features: [
      "Unlimited everything",
      "SSO / SAML",
      "Dedicated success manager",
      "SLA guarantee",
      "Custom integrations",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight gradient-text sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free and upgrade as you grow. No hidden fees.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border p-8 shadow-3d-sm transition-all duration-300",
                plan.featured
                  ? "border-primary ring-2 ring-primary/20 bg-card hover:shadow-primary-glow hover:-translate-y-0.5"
                  : "dashboard-card hover:shadow-3d-lg hover:-translate-y-0.5"
              )}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      "bg-gradient-to-r from-primary to-purple-600 text-primary-foreground",
                      "shadow-3d-sm"
                    )}
                  >
                    Most popular
                  </Badge>
                </div>
              )}
              <div className="text-center">
                <h3 className={cn(
                  "text-lg font-semibold text-foreground",
                  plan.featured && "gradient-text"
                )}>
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span
                    className={cn(
                      "text-4xl font-bold tracking-tight",
                      plan.featured ? "gradient-text" : "text-foreground"
                    )}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <Link href={plan.href}>
                  <Button
                    className={cn(
                      "mt-6 w-full h-10 rounded-xl font-medium transition-all duration-200",
                      plan.featured
                        ? "btn-primary-gradient shadow-primary-glow hover:-translate-y-0.5 active:translate-y-0"
                        : "border-border/60 bg-card/60 text-muted-foreground hover:bg-primary/8 hover:border-primary/30 hover:text-primary hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
                    )}
                    variant={plan.featured ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
              <Separator className="my-6" />
              <ul className="space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 text-primary"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
