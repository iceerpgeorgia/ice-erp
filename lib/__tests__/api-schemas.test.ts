import {
  createBrandSchema,
  updateBrandSchema,
  createBankSchema,
  createCurrencySchema,
  createCountrySchema,
  createEntityTypeSchema,
  createDimensionSchema,
  createInventoryGroupSchema,
  createInventorySchema,
  createFinancialCodeSchema,
  createExchangeRateSchema,
  createPaymentSchema,
  createLedgerEntrySchema,
  createAdjustmentSchema,
  createJobSchema,
  updateProjectSchema,
  createSalaryAccrualSchema,
  createBatchSchema,
  createUserSchema,
  updateUserSchema,
  formatZodErrors,
} from "@/lib/api-schemas";

describe("createBrandSchema", () => {
  it("validates a correct payload", () => {
    const result = createBrandSchema.safeParse({ name: "Acme" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Acme");
      expect(result.data.counteragentUuids).toEqual([]);
    }
  });

  it("rejects empty name", () => {
    const result = createBrandSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createBrandSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("updateBrandSchema", () => {
  it("validates with numeric id", () => {
    const result = updateBrandSchema.safeParse({ id: 1, name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("coerces string id to number", () => {
    const result = updateBrandSchema.safeParse({ id: "42", name: "Updated" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(42);
  });

  it("rejects zero id", () => {
    const result = updateBrandSchema.safeParse({ id: 0, name: "Test" });
    expect(result.success).toBe(false);
  });
});

describe("createBankSchema", () => {
  it("validates a correct payload", () => {
    const result = createBankSchema.safeParse({ bankName: "BOG" });
    expect(result.success).toBe(true);
  });

  it("rejects empty bankName", () => {
    const result = createBankSchema.safeParse({ bankName: "" });
    expect(result.success).toBe(false);
  });
});

describe("createCurrencySchema", () => {
  it("validates a full payload", () => {
    const result = createCurrencySchema.safeParse({
      code: "GEL",
      name_en: "Georgian Lari",
      name_ka: "ქართული ლარი",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_active).toBe(true);
  });
});

describe("createCountrySchema", () => {
  it("validates a correct payload", () => {
    const result = createCountrySchema.safeParse({
      name_en: "Georgia",
      name_ka: "საქართველო",
      iso2: "GE",
      iso3: "GEO",
      country: "Georgia",
    });
    expect(result.success).toBe(true);
  });

  it("rejects wrong iso2 length", () => {
    const result = createCountrySchema.safeParse({
      name_en: "Georgia",
      name_ka: "საქართველო",
      iso2: "G",
      iso3: "GEO",
      country: "Georgia",
    });
    expect(result.success).toBe(false);
  });
});

describe("createEntityTypeSchema", () => {
  it("validates a correct payload", () => {
    const result = createEntityTypeSchema.safeParse({
      name_en: "LLC",
      name_ka: "შპს",
    });
    expect(result.success).toBe(true);
  });
});

describe("createDimensionSchema", () => {
  it("validates a correct payload", () => {
    const result = createDimensionSchema.safeParse({ dimension: "KG" });
    expect(result.success).toBe(true);
  });
});

describe("createInventoryGroupSchema", () => {
  it("validates with optional fields", () => {
    const result = createInventoryGroupSchema.safeParse({ name: "Materials" });
    expect(result.success).toBe(true);
  });
});

describe("createInventorySchema", () => {
  it("validates with only required name", () => {
    const result = createInventorySchema.safeParse({ name: "Cement" });
    expect(result.success).toBe(true);
  });
});

describe("createFinancialCodeSchema", () => {
  it("validates a correct payload", () => {
    const result = createFinancialCodeSchema.safeParse({
      code: "4110",
      name_en: "Revenue",
      name_ka: "შემოსავალი",
    });
    expect(result.success).toBe(true);
  });
});

describe("createExchangeRateSchema", () => {
  it("validates with date string", () => {
    const result = createExchangeRateSchema.safeParse({
      date: "2025-01-15",
      usd: 2.73,
      eur: 2.85,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.date).toBeInstanceOf(Date);
  });

  it("rejects invalid date", () => {
    const result = createExchangeRateSchema.safeParse({ date: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

describe("createPaymentSchema", () => {
  it("accepts an empty payload (all fields optional)", () => {
    expect(createPaymentSchema.safeParse({}).success).toBe(true);
  });

  it("rejects malformed UUIDs", () => {
    const result = createPaymentSchema.safeParse({ projectUuid: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("createLedgerEntrySchema", () => {
  it("requires payment_uuid and amount", () => {
    expect(createLedgerEntrySchema.safeParse({}).success).toBe(false);
    expect(
      createLedgerEntrySchema.safeParse({
        payment_uuid: "123e4567-e89b-12d3-a456-426614174000",
        amount: 100,
      }).success,
    ).toBe(true);
  });
});

describe("createAdjustmentSchema", () => {
  it("requires amount", () => {
    expect(createAdjustmentSchema.safeParse({}).success).toBe(false);
    expect(createAdjustmentSchema.safeParse({ amount: -50 }).success).toBe(true);
  });
});

describe("createJobSchema", () => {
  it("requires jobName", () => {
    expect(createJobSchema.safeParse({}).success).toBe(false);
    expect(createJobSchema.safeParse({ jobName: "Build" }).success).toBe(true);
  });
});

describe("updateProjectSchema", () => {
  it("accepts a partial update", () => {
    expect(updateProjectSchema.safeParse({ projectName: "Renamed" }).success).toBe(true);
  });
});

describe("createSalaryAccrualSchema", () => {
  it("validates YYYY-MM month format", () => {
    expect(
      createSalaryAccrualSchema.safeParse({
        counteragent_uuid: "123e4567-e89b-12d3-a456-426614174000",
        month: "2026-04",
      }).success,
    ).toBe(true);
    expect(
      createSalaryAccrualSchema.safeParse({
        counteragent_uuid: "123e4567-e89b-12d3-a456-426614174000",
        month: "april",
      }).success,
    ).toBe(false);
  });
});

describe("createBatchSchema", () => {
  it("rejects fewer than 2 partitions", () => {
    const result = createBatchSchema.safeParse({
      bankAccountUuid: "123e4567-e89b-12d3-a456-426614174000",
      rawRecordUuid: "123e4567-e89b-12d3-a456-426614174000",
      partitions: [{ amount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts 2+ partitions", () => {
    const result = createBatchSchema.safeParse({
      bankAccountUuid: "123e4567-e89b-12d3-a456-426614174000",
      rawRecordUuid: "123e4567-e89b-12d3-a456-426614174000",
      partitions: [{ amount: 60 }, { amount: 40 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("createUserSchema", () => {
  it("requires a valid email", () => {
    expect(createUserSchema.safeParse({ email: "not-email" }).success).toBe(false);
    expect(createUserSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });

  it("defaults role to 'user'", () => {
    const result = createUserSchema.safeParse({ email: "a@b.co" });
    if (result.success) expect(result.data.role).toBe("user");
  });

  it("rejects unknown roles", () => {
    expect(createUserSchema.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts an empty patch", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });
});

describe("formatZodErrors", () => {
  it("formats Zod errors into a flat record", () => {
    const result = createBrandSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toHaveProperty("name");
      expect(typeof formatted.name).toBe("string");
    }
  });
});
