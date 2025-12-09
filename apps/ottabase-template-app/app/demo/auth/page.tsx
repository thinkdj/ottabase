import { auth } from "@/app/auth";
import AuthDemoClient from "./AuthDemoClient";

export const metadata = {
  title: "Auth Demo - Ottabase",
  description: "Authentication demo with Auth.js and Cloudflare D1",
};

export default async function AuthDemoPage() {
  const session = await auth();

  return <AuthDemoClient session={session} />;
}
