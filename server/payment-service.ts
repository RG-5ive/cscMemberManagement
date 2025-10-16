import { db } from "./db";
import { membershipPricingRules, Workshop, User } from "@shared/schema";
import { eq } from "drizzle-orm";

interface TaxCalculation {
  taxRate: number;
  taxType: "GST" | "HST" | "GST_PST" | "PST" | "None";
  taxAmount: number;
}

interface PricingBreakdown {
  baseCost: number; // in cents
  membershipDiscount: number; // percentage (0-100)
  membershipDiscountAmount: number; // in cents
  globalDiscount: number; // percentage (0-100)
  globalDiscountAmount: number; // in cents
  subtotal: number; // in cents
  taxRate: number; // percentage
  taxType: "GST" | "HST" | "GST_PST" | "PST" | "None";
  taxAmount: number; // in cents
  total: number; // in cents
}

export class PaymentService {
  /**
   * Calculate tax based on province
   * Tax rates as of 2024 for Canadian provinces/territories
   */
  static calculateTax(subtotalInCents: number, province: string | null): TaxCalculation {
    const provinceUpper = province?.toUpperCase() || "";
    
    // HST provinces (combined federal + provincial)
    const hstProvinces: { [key: string]: number } = {
      "ON": 13, // Ontario
      "ONTARIO": 13,
      "NB": 15, // New Brunswick
      "NEW BRUNSWICK": 15,
      "NS": 15, // Nova Scotia
      "NOVA SCOTIA": 15,
      "PE": 15, // Prince Edward Island
      "PEI": 15,
      "PRINCE EDWARD ISLAND": 15,
      "NL": 15, // Newfoundland and Labrador
      "NEWFOUNDLAND": 15,
      "NEWFOUNDLAND AND LABRADOR": 15,
    };

    // GST + PST provinces (separate taxes)
    const gstPstProvinces: { [key: string]: number } = {
      "BC": 12, // British Columbia (5% GST + 7% PST)
      "BRITISH COLUMBIA": 12,
      "SK": 11, // Saskatchewan (5% GST + 6% PST)
      "SASKATCHEWAN": 11,
      "MB": 12, // Manitoba (5% GST + 7% PST)
      "MANITOBA": 12,
      "QC": 14.975, // Quebec (5% GST + 9.975% QST)
      "QUEBEC": 14.975,
    };

    // GST only (5%)
    const gstOnlyProvinces = [
      "AB", "ALBERTA",
      "NT", "NORTHWEST TERRITORIES",
      "NU", "NUNAVUT",
      "YT", "YUKON"
    ];

    let taxRate = 0;
    let taxType: "GST" | "HST" | "GST_PST" | "PST" | "None" = "None";

    if (hstProvinces[provinceUpper]) {
      taxRate = hstProvinces[provinceUpper];
      taxType = "HST";
    } else if (gstPstProvinces[provinceUpper]) {
      taxRate = gstPstProvinces[provinceUpper];
      taxType = "GST_PST";
    } else if (gstOnlyProvinces.includes(provinceUpper)) {
      taxRate = 5;
      taxType = "GST";
    } else {
      // Default to GST if province not recognized
      taxRate = 5;
      taxType = "GST";
    }

    const taxAmount = Math.round((subtotalInCents * taxRate) / 100);

    return {
      taxRate,
      taxType,
      taxAmount,
    };
  }

  /**
   * Calculate the final price for a workshop registration
   */
  static async calculateWorkshopPrice(
    workshop: Workshop,
    user: User,
    memberProvince?: string | null
  ): Promise<PricingBreakdown> {
    if (!workshop.isPaid || !workshop.baseCost) {
      // Free workshop
      return {
        baseCost: 0,
        membershipDiscount: 0,
        membershipDiscountAmount: 0,
        globalDiscount: 0,
        globalDiscountAmount: 0,
        subtotal: 0,
        taxRate: 0,
        taxType: "None",
        taxAmount: 0,
        total: 0,
      };
    }

    const baseCost = workshop.baseCost; // Already in cents

    // Get membership pricing rule
    let membershipDiscount = 100; // Default to 100% (full price)
    if (user.memberLevel) {
      const [rule] = await db
        .select()
        .from(membershipPricingRules)
        .where(eq(membershipPricingRules.membershipLevel, user.memberLevel));
      
      if (rule) {
        membershipDiscount = rule.percentagePaid;
      }
    }

    // Calculate membership discount amount
    const priceAfterMembershipDiscount = Math.round((baseCost * membershipDiscount) / 100);
    const membershipDiscountAmount = baseCost - priceAfterMembershipDiscount;

    // Apply global discount (if any)
    const globalDiscount = workshop.globalDiscountPercentage || 0;
    const globalDiscountAmount = Math.round((priceAfterMembershipDiscount * globalDiscount) / 100);
    
    const subtotal = priceAfterMembershipDiscount - globalDiscountAmount;

    // Calculate tax
    const taxCalc = this.calculateTax(subtotal, memberProvince || user.location || null);

    const total = subtotal + taxCalc.taxAmount;

    return {
      baseCost,
      membershipDiscount,
      membershipDiscountAmount,
      globalDiscount,
      globalDiscountAmount,
      subtotal,
      taxRate: taxCalc.taxRate,
      taxType: taxCalc.taxType,
      taxAmount: taxCalc.taxAmount,
      total,
    };
  }

  /**
   * Generate a unique invoice number
   */
  static generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    
    return `INV-${year}${month}${day}-${timestamp}`;
  }

  /**
   * Format cents to dollars for display
   */
  static formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Format dollars to cents for storage
   */
  static dollarsToCents(dollars: number): number {
    return Math.round(dollars * 100);
  }
}
