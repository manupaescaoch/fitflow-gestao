import { Toaster as Sonner } from "sonner";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [offset, setOffset] = useState<number | undefined>(undefined);
  useEffect(() => {
    const compute = () => {
      const isMobile = window.matchMedia("(max-width: 767.98px)").matches;
      // Em mobile, levantar o toast acima da bottom-nav (56px) + safe-area
      if (isMobile) {
        const css = getComputedStyle(document.documentElement);
        const safe = parseInt(css.getPropertyValue("--safe-bottom")) || 0;
        setOffset(56 + safe + 16);
      } else {
        setOffset(16);
      }
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      offset={offset}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
