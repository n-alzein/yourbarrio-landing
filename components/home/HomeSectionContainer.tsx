import type { ReactNode } from "react";

type HomeSectionContainerProps = {
  children: ReactNode;
  className?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function HomeSectionContainer({
  children,
  className,
}: HomeSectionContainerProps) {
  return (
    <div className={cx("mx-auto w-full max-w-6xl px-6 md:px-8 xl:max-w-[88rem]", className)}>
      {children}
    </div>
  );
}
