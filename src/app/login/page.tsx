import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true }
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card space-y-2">
        <h1 className="page-title">Switch Demo Account</h1>
        <p className="page-subtitle">
          TransitionOS 使用 Demo RBAC。選擇角色即可快速體驗不同權限下的完整流程。
        </p>
      </div>
      <LoginForm users={users} />
    </div>
  );
}
