import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from '@prisma/client/runtime/library';

export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id);
    const body = await req.json();

    // Get current transaction
    const current = await prisma.consolidatedBankAccount.findUnique({
      where: { id },
      select: {
        paymentUuid: true,
        accountCurrencyAmount: true,
        accountCurrencyUuid: true,
        counteragentUuid: true,
      },
    });

    if (!current) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    const {
      payment_uuid,
      project_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
    } = body;

    const updateData: any = {};

    // Rule 1: If payment_uuid is being set/changed
    if (payment_uuid !== undefined) {
      if (payment_uuid === null) {
        // Clearing payment - allow manual fields
        updateData.paymentUuid = null;
        if (project_uuid !== undefined) updateData.projectUuid = project_uuid;
        if (financial_code_uuid !== undefined) updateData.financialCodeUuid = financial_code_uuid;
        if (nominal_currency_uuid !== undefined) updateData.nominalCurrencyUuid = nominal_currency_uuid;
      } else {
        // Setting payment - cascade from payment record
        const payment = await prisma.payment.findUnique({
          where: { paymentId: payment_uuid },
          select: {
            projectUuid: true,
            financialCodeUuid: true,
            currencyUuid: true,
          },
        });

        if (!payment) {
          return NextResponse.json(
            { error: "Payment not found" },
            { status: 404 }
          );
        }

        // Cascade values from payment
        updateData.paymentUuid = payment_uuid;
        updateData.projectUuid = payment.projectUuid;
        updateData.financialCodeUuid = payment.financialCodeUuid;
        updateData.nominalCurrencyUuid = payment.currencyUuid;
      }
    }
    // Rule 2: If payment_uuid is NOT being changed and current is null
    else if (current.paymentUuid === null) {
      // Allow manual editing when no payment
      if (project_uuid !== undefined) updateData.projectUuid = project_uuid;
      if (financial_code_uuid !== undefined) updateData.financialCodeUuid = financial_code_uuid;
      if (nominal_currency_uuid !== undefined) updateData.nominalCurrencyUuid = nominal_currency_uuid;
    }
    // Rule 3: If payment exists, ignore manual field changes (they're read-only)

    // Recalculate nominal_amount if nominal_currency changes
    if (updateData.nominalCurrencyUuid && updateData.nominalCurrencyUuid !== current.accountCurrencyUuid) {
      // Get the NBG exchange rate for the transaction date
      const transaction = await prisma.consolidatedBankAccount.findUnique({
        where: { id },
        select: { date: true },
      });

      if (transaction) {
        const rate = await prisma.nBGExchangeRate.findFirst({
          where: { date: transaction.date },
        });

        if (rate) {
          const accountAmount = Number(current.accountCurrencyAmount);
          let exchangeRate = 1;

          // Determine the exchange rate based on nominal currency
          if (updateData.nominalCurrencyUuid) {
            const nominalCurrency = await prisma.currency.findUnique({
              where: { uuid: updateData.nominalCurrencyUuid },
              select: { code: true },
            });

            if (nominalCurrency) {
              if (nominalCurrency.code === 'USD' && rate.usdRate) {
                exchangeRate = Number(rate.usdRate);
              } else if (nominalCurrency.code === 'EUR' && rate.eurRate) {
                exchangeRate = Number(rate.eurRate);
              }
            }
          }

          // Recalculate nominal amount
          updateData.nominalAmount = new Decimal(accountAmount / exchangeRate);
        }
      }
    }

    // Update the record
    const updated = await prisma.consolidatedBankAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Transaction updated successfully",
      id: Number(updated.id),
    });
  } catch (error: any) {
    console.error("[PATCH /api/bank-transactions/[id]] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}
