import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ProfileEditor } from "@/components/chat/profile-editor";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = {
    id: session.user.id,
    name: (session.user.name as string | undefined) || "",
    email: (session.user.email as string | undefined) || "",
    image: (session.user.image as string | undefined) || "",
    phone: (session.user.phone as string | undefined) || "",
    role: session.user.role,
    accountType: session.user.accountType,
    teamRole: session.user.teamRole,
    planName: session.user.planName ?? "free",
  };

  return <ProfileEditor user={user} />;
}
