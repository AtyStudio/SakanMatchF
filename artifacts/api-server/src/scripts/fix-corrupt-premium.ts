import { db, usersTable, premiumSubscriptionsTable } from "@workspace/db";
import { eq, and, notInArray, inArray } from "drizzle-orm";

async function fixCorruptPremiumState() {
  console.log("Starting corrupt premium state correction...");

  const activeSubRows = await db
    .select({ userId: premiumSubscriptionsTable.userId })
    .from(premiumSubscriptionsTable)
    .where(eq(premiumSubscriptionsTable.status, "active"));

  const activeUserIds = activeSubRows.map((row) => row.userId);

  console.log(`Found ${activeUserIds.length} user(s) with active subscriptions.`);

  let corruptUsers;
  if (activeUserIds.length === 0) {
    corruptUsers = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.isPremium, true));
  } else {
    corruptUsers = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.isPremium, true),
          notInArray(usersTable.id, activeUserIds),
        ),
      );
  }

  console.log(
    `Found ${corruptUsers.length} user(s) incorrectly marked as premium: ${corruptUsers.map((u) => `${u.id} (${u.email})`).join(", ") || "none"}`,
  );

  if (corruptUsers.length === 0) {
    console.log("No corrupt premium state found. Database is clean.");
    return;
  }

  const corruptUserIds = corruptUsers.map((u) => u.id);

  await db
    .update(usersTable)
    .set({
      isPremium: false,
      subscriptionStatus: null,
      premiumActivatedAt: null,
      premiumSource: null,
      paypalSubscriptionId: null,
    })
    .where(inArray(usersTable.id, corruptUserIds));

  console.log(
    `Corrected ${corruptUsers.length} user(s): reset isPremium=false, subscriptionStatus=null, premiumActivatedAt=null, premiumSource=null, paypalSubscriptionId=null.`,
  );
  console.log("Done.");
}

fixCorruptPremiumState()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error during correction:", err);
    process.exit(1);
  });
