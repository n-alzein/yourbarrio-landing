export const metadata = {
  other: {
    "yb-shell": "app",
  },
};

export default function AuthedLayout({ children }) {
  return <>{children}</>;
}
