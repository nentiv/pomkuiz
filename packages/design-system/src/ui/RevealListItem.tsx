import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { DESIGN_SETTINGS } from "../design-settings.ts";
import { classNames } from "./class-names.ts";

interface RevealListItemProps {
  index?: number;
  class?: string;
  children: ComponentChildren;
}

function RevealListItem({ index = 0, class: className, children }: RevealListItemProps) {
  const element = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = element.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: DESIGN_SETTINGS.revealRootMargin },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <li
      ref={element}
      class={classNames("reveal", visible && "is-visible", className)}
      style={{ "--reveal-index": String(index) }}
    >
      {children}
    </li>
  );
}

export { RevealListItem };
