const customerMigration =
  "r1_p04_customer_profiles_preferences_text_addresses";
const cloudinaryMigration =
  "r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage";

describe("R1-P04 migration hygiene", () => {
  it("orders the Cloudinary repair migration after the customer tables migration", () => {
    expect(customerMigration < cloudinaryMigration).toBe(true);
  });
});
