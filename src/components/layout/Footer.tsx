import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4">
        <img
          src="/aragroup-logo.png"
          alt="ARA Group"
          className="h-10 rounded"
        />
        <Separator className="max-w-md" />
        <img
          src="/ara-group-brands.png"
          alt="euromobilia | nouvell | altea design | paneltec | vertice | core"
          className="h-6 opacity-70"
        />
        <p className="text-xs text-muted-foreground">
          © 2026 ARA Group Costa Rica. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
