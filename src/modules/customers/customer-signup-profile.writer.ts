export type CustomerSignupProfileInput =
  | { readonly category: "INDIVIDUAL"; readonly fullName: string }
  | {
      readonly category: "COMPANY";
      readonly companyName: string;
      readonly representativeFullName: string;
    }
  | {
      readonly category: "ENGINEER";
      readonly fullName: string;
      readonly professionalTitle: string;
    };

export interface CustomerSignupProfileWriter {
  create(userId: string, input: CustomerSignupProfileInput): Promise<void>;
  remove(userId: string, category: CustomerSignupProfileInput["category"]): Promise<void>;
}

export type CustomerSignupProfileWriterFactory = (
  transaction: unknown,
) => CustomerSignupProfileWriter;
