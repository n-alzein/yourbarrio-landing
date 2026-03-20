import BusinessMarketingHeader from "@/components/headers/BusinessMarketingHeader";

export default function BusinessAuthMarketingLayout({ children }) {
  return (
    <>
      <BusinessMarketingHeader />
      <div className="h-16" aria-hidden="true" />
      <div className="min-h-screen bg-white px-6 pb-24 pt-12 text-slate-900">
        <div className="mx-auto flex w-full max-w-6xl justify-center">
          {children}
        </div>
      </div>
    </>
  );
}
