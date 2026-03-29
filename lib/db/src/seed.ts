import bcrypt from "bcryptjs";
import { db, pool } from "./index.js";
import {
  usersTable,
  userProfilesTable,
  userPreferencesTable,
  listingsTable,
  requestsTable,
  messagesTable,
} from "./schema/index.js";
import { like, inArray } from "drizzle-orm";

const DEMO_DOMAIN = "@demo.sakanmatch.com";
const DEMO_PASSWORD = "Demo@1234!";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

const usersData = [
  { email: "youssef.benali@demo.sakanmatch.com", name: "Youssef Benali", role: "seeker" as const, isPremium: false },
  { email: "fatima.zahra@demo.sakanmatch.com", name: "Fatima Zahra El Alami", role: "seeker" as const, isPremium: false },
  { email: "salma.idrissi@demo.sakanmatch.com", name: "Salma Idrissi", role: "seeker" as const, isPremium: false },
  { email: "omar.benjelloun@demo.sakanmatch.com", name: "Omar Benjelloun", role: "seeker" as const, isPremium: true },
  { email: "nadia.tazi@demo.sakanmatch.com", name: "Nadia Tazi", role: "seeker" as const, isPremium: false },
  { email: "karim.filali@demo.sakanmatch.com", name: "Karim Filali", role: "seeker" as const, isPremium: false },
  { email: "rachid.moussaoui@demo.sakanmatch.com", name: "Rachid Moussaoui", role: "owner" as const, isPremium: true },
  { email: "zineb.bousfiha@demo.sakanmatch.com", name: "Zineb Bousfiha", role: "owner" as const, isPremium: true },
  { email: "hassan.lahlou@demo.sakanmatch.com", name: "Hassan Lahlou", role: "owner" as const, isPremium: false },
  { email: "meriem.aouadi@demo.sakanmatch.com", name: "Meriem Aouadi", role: "owner" as const, isPremium: true },
  { email: "loubna.ouali@demo.sakanmatch.com", name: "Loubna Ouali", role: "owner" as const, isPremium: true },
  { email: "tariq.bensouda@demo.sakanmatch.com", name: "Tariq Bensouda", role: "owner" as const, isPremium: false },
];

const profilesData = [
  { fullName: "Youssef Benali", age: 24, gender: "male" as const, occupation: "Ingénieur logiciel", cleanlinessLevel: "clean" as const, sleepSchedule: "early_bird" as const, noiseTolerance: "quiet" as const, guestPreference: "rarely" as const, petPreference: "no_pets" as const, bio: "Je suis un ingénieur logiciel calme et ordonné, cherchant un appartement tranquille à Casablanca pour travailler de chez moi.", moveInDate: "2026-04-15" },
  { fullName: "Fatima Zahra El Alami", age: 27, gender: "female" as const, occupation: "Médecin résidente", cleanlinessLevel: "very_clean" as const, sleepSchedule: "early_bird" as const, noiseTolerance: "quiet" as const, guestPreference: "rarely" as const, petPreference: "no_preference" as const, bio: "Médecin résidente, j'ai des horaires chargés. Je cherche un endroit propre et calme pour me ressourcer après mes longues journées.", moveInDate: "2026-05-01" },
  { fullName: "Salma Idrissi", age: 22, gender: "female" as const, occupation: "Étudiante en droit", cleanlinessLevel: "clean" as const, sleepSchedule: "night_owl" as const, noiseTolerance: "moderate" as const, guestPreference: "sometimes" as const, petPreference: "no_pets" as const, bio: "Étudiante sérieuse en master de droit. Je suis sociable mais je respecte toujours les espaces communs.", moveInDate: "2026-09-01" },
  { fullName: "Omar Benjelloun", age: 32, gender: "male" as const, occupation: "Consultant financier", cleanlinessLevel: "very_clean" as const, sleepSchedule: "early_bird" as const, noiseTolerance: "quiet" as const, guestPreference: "rarely" as const, petPreference: "no_pets" as const, bio: "Consultant en finance, je voyage beaucoup. Je cherche un chez-moi confortable et discret à Casablanca.", moveInDate: "2026-04-01" },
  { fullName: "Nadia Tazi", age: 25, gender: "female" as const, occupation: "Graphiste freelance", cleanlinessLevel: "relaxed" as const, sleepSchedule: "night_owl" as const, noiseTolerance: "loud" as const, guestPreference: "often" as const, petPreference: "love_pets" as const, bio: "Graphiste créative et sociable. Mon appart est souvent animé, j'adore recevoir des amis et j'ai une petite chienne, Luna.", moveInDate: "2026-05-15" },
  { fullName: "Karim Filali", age: 28, gender: "male" as const, occupation: "Développeur web", cleanlinessLevel: "moderate" as const, sleepSchedule: "flexible" as const, noiseTolerance: "moderate" as const, guestPreference: "sometimes" as const, petPreference: "no_preference" as const, bio: "Dev web passionné par le code et la musique. Je cherche un coloc sympa avec une bonne connexion internet.", moveInDate: "2026-06-01" },
  { fullName: "Rachid Moussaoui", age: 45, gender: "male" as const, occupation: "Propriétaire immobilier", cleanlinessLevel: "very_clean" as const, sleepSchedule: "early_bird" as const, noiseTolerance: "quiet" as const, guestPreference: "rarely" as const, petPreference: "no_pets" as const, bio: "Propriétaire expérimenté avec plusieurs biens à Casablanca. Je cherche des locataires sérieux et respectueux.", moveInDate: null },
  { fullName: "Zineb Bousfiha", age: 38, gender: "female" as const, occupation: "Responsable RH", cleanlinessLevel: "very_clean" as const, sleepSchedule: "early_bird" as const, noiseTolerance: "quiet" as const, guestPreference: "sometimes" as const, petPreference: "no_preference" as const, bio: "Propriétaire d'appartements bien situés à Rabat et Marrakech. Je valorise la confiance et la transparence.", moveInDate: null },
  { fullName: "Hassan Lahlou", age: 52, gender: "male" as const, occupation: "Commerçant", cleanlinessLevel: "moderate" as const, sleepSchedule: "early_bird" as const, noiseTolerance: "moderate" as const, guestPreference: "sometimes" as const, petPreference: "no_preference" as const, bio: "Commerçant avec un appartement à louer au cœur de Fès medina. Ambiance authentique garantie.", moveInDate: null },
  { fullName: "Meriem Aouadi", age: 34, gender: "female" as const, occupation: "Consultante en marketing", cleanlinessLevel: "clean" as const, sleepSchedule: "flexible" as const, noiseTolerance: "moderate" as const, guestPreference: "sometimes" as const, petPreference: "no_preference" as const, bio: "Propriétaire de studios modernes à Tanger et Casablanca. Je suis disponible et réactive pour mes locataires.", moveInDate: null },
  { fullName: "Loubna Ouali", age: 29, gender: "female" as const, occupation: "Avocate", cleanlinessLevel: "very_clean" as const, sleepSchedule: "flexible" as const, noiseTolerance: "quiet" as const, guestPreference: "sometimes" as const, petPreference: "no_preference" as const, bio: "Avocate propriétaire de deux appartements premium à Casablanca. Je recherche des profils fiables.", moveInDate: null },
  { fullName: "Tariq Bensouda", age: 41, gender: "male" as const, occupation: "Ingénieur civil", cleanlinessLevel: "clean" as const, sleepSchedule: "early_bird" as const, noiseTolerance: "quiet" as const, guestPreference: "rarely" as const, petPreference: "no_pets" as const, bio: "Je possède un appartement spacieux à Agadir avec vue sur mer. Idéal pour un professionnel ou un couple.", moveInDate: null },
];

const preferencesData = [
  { city: "Casablanca", budgetMin: "2000", budgetMax: "4000", lifestyle: "quiet" as const, smoking: "no" as const, genderPref: "any" as const },
  { city: "Casablanca", budgetMin: "2500", budgetMax: "4500", lifestyle: "quiet" as const, smoking: "no" as const, genderPref: "female" as const },
  { city: "Rabat", budgetMin: "1500", budgetMax: "3000", lifestyle: "any" as const, smoking: "no" as const, genderPref: "female" as const },
  { city: "Casablanca", budgetMin: "4000", budgetMax: "8000", lifestyle: "quiet" as const, smoking: "no" as const, genderPref: "any" as const },
  { city: "Marrakech", budgetMin: "1800", budgetMax: "3500", lifestyle: "social" as const, smoking: "any" as const, genderPref: "any" as const },
  { city: "Tanger", budgetMin: "2000", budgetMax: "4000", lifestyle: "any" as const, smoking: "no" as const, genderPref: "any" as const },
  { city: "Casablanca", budgetMin: "1500", budgetMax: "6000", lifestyle: "any" as const, smoking: "any" as const, genderPref: "any" as const },
  { city: "Rabat", budgetMin: "2000", budgetMax: "7000", lifestyle: "any" as const, smoking: "no" as const, genderPref: "any" as const },
  { city: "Fès", budgetMin: "1000", budgetMax: "4000", lifestyle: "any" as const, smoking: "any" as const, genderPref: "any" as const },
  { city: "Casablanca", budgetMin: "2500", budgetMax: "8000", lifestyle: "any" as const, smoking: "no" as const, genderPref: "any" as const },
  { city: "Casablanca", budgetMin: "3000", budgetMax: "9000", lifestyle: "quiet" as const, smoking: "no" as const, genderPref: "any" as const },
  { city: "Agadir", budgetMin: "2000", budgetMax: "5000", lifestyle: "quiet" as const, smoking: "no" as const, genderPref: "any" as const },
];

const listingsData = [
  { ownerIndex: 6, title: "Appartement lumineux quartier Maarif", description: "Bel appartement de 80m² au 3ème étage avec balcon, cuisine équipée et parking. Quartier calme et bien desservi à Casablanca.", price: "4500", city: "Casablanca" },
  { ownerIndex: 7, title: "Appartement élégant Hassan, Rabat", description: "Appartement de 95m² avec 2 chambres, salon spacieux et terrasse privative. Vue sur les jardins. Quartier ambassades.", price: "5800", city: "Rabat" },
  { ownerIndex: 8, title: "Appartement Fès Médina", description: "Riad traditionnel rénové en appartement moderne au cœur de la médina. Décoration authentique, patio intérieur.", price: "2200", city: "Fès" },
  { ownerIndex: 9, title: "Studio haut standing Casablanca Centre", description: "Studio de luxe 45m² avec finitions haut de gamme, sécurité 24h/24 et salle de sport dans la résidence.", price: "6500", city: "Casablanca" },
  { ownerIndex: 9, title: "Appartement moderne Tanger Détroit", description: "Appartement de 70m² avec vue sur le détroit de Gibraltar. Entièrement meublé, cuisine équipée.", price: "4200", city: "Tanger" },
  { ownerIndex: 10, title: "Appartement premium Anfa, Casablanca", description: "Appartement d'exception de 120m² dans la résidence premium Anfa. Piscine, gardiennage et finitions de luxe.", price: "8500", city: "Casablanca" },
  { ownerIndex: 11, title: "Appartement vue mer Agadir", description: "Bel appartement de 85m² avec vue panoramique sur la mer et la plage d'Agadir. Balcon spacieux, parking sécurisé.", price: "4800", city: "Agadir" },
  { ownerIndex: 7, title: "Studio Gueliz, Marrakech", description: "Studio récemment rénové de 40m² au cœur de Gueliz. Accès facile aux restaurants, boutiques et administration.", price: "2800", city: "Marrakech" },
];

async function seed() {
  console.log("Starting seed...");

  console.log("Clearing existing demo data...");
  const existingDemoUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(like(usersTable.email, `%${DEMO_DOMAIN}`));

  if (existingDemoUsers.length > 0) {
    const demoUserIds = existingDemoUsers.map((u) => u.id);
    await db.delete(messagesTable).where(
      inArray(messagesTable.senderId, demoUserIds)
    );
    await db.delete(requestsTable).where(
      inArray(requestsTable.seekerId, demoUserIds)
    );
    const existingListings = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(inArray(listingsTable.ownerId, demoUserIds));
    if (existingListings.length > 0) {
      const listingIds = existingListings.map((l) => l.id);
      await db.delete(requestsTable).where(inArray(requestsTable.listingId, listingIds));
      await db.delete(messagesTable).where(inArray(messagesTable.listingId, listingIds));
      await db.delete(listingsTable).where(inArray(listingsTable.id, listingIds));
    }
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.userId, demoUserIds));
    await db.delete(userPreferencesTable).where(inArray(userPreferencesTable.userId, demoUserIds));
    await db.delete(usersTable).where(inArray(usersTable.id, demoUserIds));
  }

  console.log("Inserting users...");
  const hashedPassword = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  const insertedUsers = await db.insert(usersTable).values(
    usersData.map((u) => ({
      email: u.email,
      name: u.name,
      password: hashedPassword,
      role: u.role,
      isPremium: u.isPremium,
      premiumActivatedAt: u.isPremium ? now : null,
      premiumSource: u.isPremium ? "demo" : null,
    }))
  ).returning();

  console.log(`Inserted ${insertedUsers.length} users.`);

  console.log("Inserting profiles...");
  await db.insert(userProfilesTable).values(
    insertedUsers.map((user, i) => ({
      userId: user.id,
      fullName: profilesData[i].fullName,
      age: profilesData[i].age,
      gender: profilesData[i].gender,
      occupation: profilesData[i].occupation,
      cleanlinessLevel: profilesData[i].cleanlinessLevel,
      sleepSchedule: profilesData[i].sleepSchedule,
      noiseTolerance: profilesData[i].noiseTolerance,
      guestPreference: profilesData[i].guestPreference,
      petPreference: profilesData[i].petPreference,
      bio: profilesData[i].bio,
      moveInDate: profilesData[i].moveInDate ?? null,
      avatarUrl: null,
    }))
  );

  console.log("Inserting preferences...");
  await db.insert(userPreferencesTable).values(
    insertedUsers.map((user, i) => ({
      userId: user.id,
      city: preferencesData[i].city,
      budgetMin: preferencesData[i].budgetMin,
      budgetMax: preferencesData[i].budgetMax,
      lifestyle: preferencesData[i].lifestyle,
      smoking: preferencesData[i].smoking,
      genderPref: preferencesData[i].genderPref,
    }))
  );

  console.log("Inserting listings...");
  const insertedListings = await db.insert(listingsTable).values(
    listingsData.map((l) => ({
      title: l.title,
      description: l.description,
      price: l.price,
      city: l.city,
      images: [],
      ownerId: insertedUsers[l.ownerIndex].id,
    }))
  ).returning();

  console.log(`Inserted ${insertedListings.length} listings.`);
  console.log("Seed complete!");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
