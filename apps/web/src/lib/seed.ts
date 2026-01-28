import { auth } from "./auth";

export async function AdminSeed() {
  try {
    await auth.api.signUpEmail({
      body: {
        firstName: "Amgalanbayar",
        lastName: "Amgalanbaatar",
        email: "admin@timezone.com",
        password: "12345678",
        name: "Amgalanbayar",
      },
    });
    console.log("sucess");
  } catch (e) {
    console.log("failed", e);
  }
}

AdminSeed();
