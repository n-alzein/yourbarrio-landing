import ModalProviderClient from "./ModalProviderClient";

export default function ModalMount({ children }) {
  return <ModalProviderClient>{children}</ModalProviderClient>;
}
