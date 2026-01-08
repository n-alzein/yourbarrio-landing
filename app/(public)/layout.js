import NavGate from "@/components/navbars/NavGate";
import PublicNavbar from "@/components/navbars/PublicNavbar";

export default function PublicLayout({ children }) {
  return (
    <>
      <NavGate>
        <PublicNavbar />
      </NavGate>
      {children}
    </>
  );
}
