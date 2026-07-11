import { ExternalLink, Lightbulb, Heart } from "lucide-react";

const FEEDBACK_FORM_URL = "https://forms.gle/4vzppQhixzzQNYJE8";
const CONTRA_PROFILE_URL = "https://contra.com/harshitpratapshahi";

export function Footer({ className = "" }: { className?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`border-t border-border bg-background/80 backdrop-blur-sm mt-auto ${className}`}>
      <div className="max-w-full mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        {/* Left: Trademark + Attribution */}
        <p className="flex items-center gap-1.5">
          <span>&copy; {year}</span>
          <a
            href={CONTRA_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground transition-colors group"
          >
            Harshit Pratap Shahi
            <ExternalLink className="w-3 h-3 opacity-0 -ml-0.5 group-hover:opacity-60 transition-opacity" />
          </a>
          <span className="hidden sm:inline">— Forsee with</span>
          <span className="hidden sm:inline font-semibold text-foreground/60">ObserveAI</span>
          <Heart className="w-3 h-3 text-destructive/60 ml-0.5" />
        </p>

        {/* Right: Feedback link */}
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <Lightbulb className="w-3.5 h-3.5 text-warning group-hover:text-warning/80 transition-colors" />
          <span>Feedback &amp; ideas</span>
          <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>
    </footer>
  );
}