import { permanentRedirect } from "next/navigation";

// The Spanish site moved to the home page (launch in Chile); old /es links keep working.
export default function OldEs() {
  permanentRedirect("/");
}
