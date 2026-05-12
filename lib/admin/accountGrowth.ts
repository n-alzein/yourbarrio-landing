export function getCustomerBusinessAccountTotal({
  customers,
  businesses,
}: {
  customers: number;
  businesses: number;
}) {
  return customers + businesses;
}
