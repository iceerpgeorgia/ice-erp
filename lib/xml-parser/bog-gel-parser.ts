// lib/xml-parser/bog-gel-parser.ts
import { parseStringPromise } from 'xml2js';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface BOGDetailRecord {
  DocKey: string;
  EntriesId: string;
  DocRecDate: string;
  DocValueDate: string;
  EntryCrAmt: string;
  EntryDbAmt: string;
  DocSenderInn?: string;
  DocBenefInn?: string;
  DocSenderAcctNo?: string;
  DocBenefAcctNo?: string;
  DocCorAcct?: string;
  DocNomination?: string;
  DocInformation?: string;
  DocProdGroup?: string;
  CcyRate?: string;
}

interface ParsedXML {
  ROWDATA: {
    DETAIL: Array<{
      $: BOGDetailRecord;
    }>;
  };
}

export class BOGGELParser {
  /**
   * Parse BOG GEL XML file and return structured data
   */
  static async parseXML(xmlContent: string): Promise<BOGDetailRecord[]> {
    try {
      const result: ParsedXML = await parseStringPromise(xmlContent, {
        explicitArray: true,
        mergeAttrs: true,
        explicitRoot: true,
      });

      if (!result.ROWDATA?.DETAIL || !Array.isArray(result.ROWDATA.DETAIL)) {
        throw new Error('Invalid XML structure: ROWDATA.DETAIL not found');
      }

      return result.ROWDATA.DETAIL.map(detail => detail.$);
    } catch (error: any) {
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }

  /**
   * Identify bank account from XML data
   * Returns account UUID or null if not found
   */
  static async identifyAccount(records: BOGDetailRecord[]): Promise<string | null> {
    if (records.length === 0) {
      throw new Error('No records in XML file');
    }

    // Extract account number from first record
    // BOG format: Account is in DocCorAcct field
    const firstRecord = records[0];
    const accountNumber = firstRecord.DocCorAcct;

    if (!accountNumber) {
      throw new Error('Could not identify account number from XML');
    }

    // Clean account number (remove spaces, take first 22 characters for IBAN)
    const cleanAccountNumber = accountNumber.replace(/\s/g, '').substring(0, 22);

    // Query database for matching account
    const account = await prisma.bankAccount.findFirst({
      where: {
        accountNumber: cleanAccountNumber,
      },
    });

    return account?.uuid || null;
  }

  /**
   * Parse BOG date format (YYYY-MM-DD HH:MM:SS or YYYYMMDD) to dd.mm.yyyy
   */
  static parseDate(dateStr: string): string | null {
    if (!dateStr) return null;

    try {
      // Handle YYYYMMDD format
      if (/^\d{8}$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${day}.${month}.${year}`;
      }

      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const [datePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('-');
        return `${day}.${month}.${year}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate UUID for a raw record based on DocKey + EntriesId
   */
  static generateRecordUUID(docKey: string, entriesId: string): string {
    // Simple UUID generation - in production, you might want a proper UUID v5
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256')
      .update(`${docKey}_${entriesId}`)
      .digest('hex');
    
    // Format as UUID
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  /**
   * Calculate nominal amount using exchange rate
   */
  static calculateNominalAmount(
    accountAmount: number,
    currencyCode: string,
    targetCurrencyUuid: string,
    transactionDate: string,
    exchangeRates: Map<string, number>
  ): number {
    // If already in target currency, return as-is
    if (currencyCode === 'GEL' && targetCurrencyUuid === 'gel-uuid') {
      return accountAmount;
    }

    // Look up exchange rate for date
    const rateKey = `${currencyCode}_${transactionDate}`;
    const rate = exchangeRates.get(rateKey);

    if (!rate) {
      return accountAmount; // Fallback to account amount
    }

    return accountAmount * rate;
  }

  /**
   * Extract INN (tax ID) based on transaction direction
   */
  static extractINN(record: BOGDetailRecord): string | null {
    const debit = parseFloat(record.EntryDbAmt || '0');
    
    // If debit > 0: outgoing payment, use beneficiary INN
    // If debit = 0: incoming payment, use sender INN
    if (debit > 0) {
      return record.DocBenefInn || null;
    } else {
      return record.DocSenderInn || null;
    }
  }

  /**
   * Extract counteragent account number
   */
  static extractCounteragentAccount(record: BOGDetailRecord): string | null {
    const debit = parseFloat(record.EntryDbAmt || '0');
    
    // Try primary field first
    if (record.DocCorAcct) {
      return record.DocCorAcct;
    }

    // Fallback to direction-based fields
    if (debit > 0) {
      return record.DocBenefAcctNo || null;
    } else {
      return record.DocSenderAcctNo || null;
    }
  }

  /**
   * Extract payment ID from DocInformation field
   */
  static extractPaymentID(docInformation: string | undefined): string | null {
    if (!docInformation) return null;

    // Try multiple patterns
    const patterns = [
      /პირადი\s+ნომერი[:：]\s*(\d+)/i,
      /ID[:：]\s*(\d+)/i,
      /№\s*(\d+)/i,
      /(\d{6,})/,  // Fallback: any 6+ digit number
    ];

    for (const pattern of patterns) {
      const match = docInformation.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}
