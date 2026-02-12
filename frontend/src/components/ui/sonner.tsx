import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-border/60 group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:shadow-lg group-[.toaster]:ring-1 group-[.toaster]:ring-black/5 group-[.toaster]:backdrop-blur dark:group-[.toaster]:ring-white/10",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:leading-5",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:rounded-lg group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:rounded-lg group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:hover:bg-muted/60",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
