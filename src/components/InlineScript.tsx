// A script that runs once while the HTML is parsed. On the client it is rendered
// as text/plain so React doesn't warn about (or try to run) a <script> tag.
export function InlineScript({ html }: { html: string }) {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}

// Runs in <head> before first paint: a saved choice wins, otherwise follow the
// system setting (and keep following it until the user picks one).
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){d.dataset.theme=localStorage.getItem("theme")||(m.matches?"dark":"light")}a();m.addEventListener("change",a)}catch(e){}})()`;
