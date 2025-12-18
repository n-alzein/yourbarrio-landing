import PublicNavbar from "@/components/navbars/PublicNavbar";

export default function PublicLayout({ children }) {
  return (
    <>
      <PublicNavbar />
      {children}
    </>
  );
}
