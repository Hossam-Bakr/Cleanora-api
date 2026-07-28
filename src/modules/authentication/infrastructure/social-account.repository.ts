import { getPrismaClient } from "#integrations/database/index";

export class SocialAccountRepository {
  findGoogle(subject: string) {
    return getPrismaClient().socialAccount.findUnique({
      where: {
        provider_providerSubject: {
          provider: "GOOGLE",
          providerSubject: subject,
        },
      },
    });
  }

  findGoogleByUserId(userId: string) {
    return getPrismaClient().socialAccount.findUnique({
      where: {
        userId_provider_accountCategory: {
          userId,
          provider: "GOOGLE",
          accountCategory: "INDIVIDUAL",
        },
      },
    });
  }

  updateGoogleProfile(
    subject: string,
    profile: { displayName?: string; avatarUrl?: string },
  ) {
    return getPrismaClient().socialAccount.update({
      where: {
        provider_providerSubject: {
          provider: "GOOGLE",
          providerSubject: subject,
        },
      },
      data: {
        ...(profile.displayName === undefined
          ? {}
          : { providerDisplayName: profile.displayName }),
        ...(profile.avatarUrl === undefined
          ? {}
          : { providerAvatarUrl: profile.avatarUrl }),
        lastAuthenticatedAt: new Date(),
      },
    });
  }

  link(userId: string, subject: string, email?: string) {
    return getPrismaClient().socialAccount.create({
      data: {
        userId,
        provider: "GOOGLE",
        accountCategory: "INDIVIDUAL",
        providerSubject: subject,
        providerEmailNormalized: email ?? null,
        providerEmailVerifiedAt: email === undefined ? null : new Date(),
      },
    });
  }
  unlink(userId: string) {
    return getPrismaClient().socialAccount.deleteMany({
      where: { userId, provider: "GOOGLE", accountCategory: "INDIVIDUAL" },
    });
  }
}
