import { PrismaClient, Role, SourceType, TaskType, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@transitionos.local" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@transitionos.local",
      role: Role.ADMIN,
      department: "IT"
    }
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@transitionos.local" },
    update: {},
    create: {
      name: "Manager User",
      email: "manager@transitionos.local",
      role: Role.MANAGER,
      department: "Engineering"
    }
  });

  await prisma.user.upsert({
    where: { email: "employee@transitionos.local" },
    update: {},
    create: {
      name: "Employee User",
      email: "employee@transitionos.local",
      role: Role.EMPLOYEE,
      department: "Engineering"
    }
  });

  await prisma.user.upsert({
    where: { email: "successor@transitionos.local" },
    update: {},
    create: {
      name: "Successor User",
      email: "successor@transitionos.local",
      role: Role.SUCCESSOR,
      department: "Engineering"
    }
  });

  await prisma.user.upsert({
    where: { email: "mentor@transitionos.local" },
    update: {},
    create: {
      name: "Mentor User",
      email: "mentor@transitionos.local",
      role: Role.MENTOR,
      department: "Engineering"
    }
  });

  await prisma.sourceConnection.upsert({
    where: { id: "seed-github-repo" },
    update: {},
    create: {
      id: "seed-github-repo",
      type: SourceType.GITHUB_REPO,
      createdBy: admin.id,
      enabled: true,
      configJson: { owner: "demo-org", repo: "transitionos", token: "" }
    }
  });

  await prisma.sourceConnection.upsert({
    where: { id: "seed-github-issue" },
    update: {},
    create: {
      id: "seed-github-issue",
      type: SourceType.GITHUB_ISSUE,
      createdBy: admin.id,
      enabled: true,
      configJson: { owner: "demo-org", repo: "transitionos", token: "" }
    }
  });

  await prisma.sourceConnection.upsert({
    where: { id: "seed-notion-page" },
    update: {},
    create: {
      id: "seed-notion-page",
      type: SourceType.NOTION_PAGE,
      createdBy: admin.id,
      enabled: true,
      configJson: { databaseId: "demo-db", token: "" }
    }
  });

  await prisma.sourceConnection.upsert({
    where: { id: "seed-slack-message" },
    update: {},
    create: {
      id: "seed-slack-message",
      type: SourceType.SLACK_MESSAGE,
      createdBy: admin.id,
      enabled: true,
      configJson: { token: "", channels: ["C0123456789"] }
    }
  });

  await prisma.sourceConnection.upsert({
    where: { id: "seed-jira-issue" },
    update: {},
    create: {
      id: "seed-jira-issue",
      type: SourceType.JIRA_ISSUE,
      createdBy: admin.id,
      enabled: true,
      configJson: {
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "",
        jql: "project = DEMO ORDER BY updated DESC"
      }
    }
  });

  const existing = await prisma.transitionTask.findFirst();
  if (!existing) {
    await prisma.transitionTask.create({
      data: {
        type: TaskType.BOTH,
        ownerUserId: manager.id,
        targetRole: "Backend Engineer",
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dateTo: new Date(),
        status: TaskStatus.DRAFT
      }
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
