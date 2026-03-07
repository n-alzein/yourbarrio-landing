export function getBusinessDisplayName({ business, profile, user }) {
  const clean = (value) => String(value || "").trim();

  const businessName = clean(business?.business_name);
  if (businessName) return businessName;

  const profileBusinessName = clean(profile?.business_name);
  if (profileBusinessName) return profileBusinessName;

  const fullName = clean(profile?.full_name);
  if (fullName) return fullName;

  const email = clean(user?.email);
  if (!email) return "Business";
  return email;
}
