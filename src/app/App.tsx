import { useRoute } from "./router";
import { Toaster } from "../ui/ui";
import { Styleguide } from "../screens/Styleguide";
import { PreVerif } from "../candidat/PreVerif";

export function App() {
  const { parts } = useRoute();
  const [p0, p1] = parts;
  let ecran: React.ReactNode;
  if (p0 === "candidat") ecran = <PreVerif token={p1 ?? "demo"} />;
  else ecran = <Styleguide />; // les écrans arrivent à l'étape c
  return <>{ecran}<Toaster /></>;
}
