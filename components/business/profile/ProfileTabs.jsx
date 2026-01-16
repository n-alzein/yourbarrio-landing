"use client";

export function ProfileTabsNav({ tabs, activeTab, onChange, tone }) {
  return (
    <div className={`rounded-2xl border ${tone.cardBorder} ${tone.cardSurface} p-4`}>
      <div className="flex flex-col gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
                isActive
                  ? tone.tabActive
                  : tone.tabInactive
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileTabsContent({ tone, children }) {
  return (
    <div className={`rounded-2xl border ${tone.cardBorder} ${tone.cardSurface} p-4 md:p-6`}>
      {children}
    </div>
  );
}

export default function ProfileTabs({ tabs, activeTab, onChange, tone, children }) {
  return (
    <div className={`rounded-2xl border ${tone.cardBorder} ${tone.cardSurface} p-4 md:p-6`}
    >
      <div className="flex flex-wrap gap-2 md:gap-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                isActive
                  ? tone.tabActive
                  : tone.tabInactive
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
