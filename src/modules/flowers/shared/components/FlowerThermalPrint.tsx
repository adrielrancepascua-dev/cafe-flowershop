import type { ReactNode } from 'react';
import type { FlowerStaffExpense } from '../types/flower-expense';
import type { FlowerOrder } from '../types/flower-order';
import type { FlowerPrintableInventoryStockReport } from '../types/flower-inventory';
import type { FlowerPrintableSalesReport } from '../types/flower-report';
import {
  THERMAL_BRAND_NAME,
  formatThermalBulletLine,
  formatThermalClaimMode,
  formatThermalDateLine,
  formatThermalItemLine,
  formatThermalDateKey,
  formatThermalOrderRef,
  formatThermalTimeLine,
} from '../utils/flower-thermal-format';
import { ORDER_STATUS_LABELS, PRICE_FORMATTER } from '../utils/flower-format';
import { formatFlowerPaymentModeLabel } from '../utils/flower-payment';

type FlowerThermalPrintRootProps = {
  id?: string;
  children: ReactNode;
};

export function FlowerThermalPrintRoot({ id, children }: FlowerThermalPrintRootProps) {
  return (
    <article id={id} className="flower-thermal-print-root">
      <div className="flower-thermal-print">{children}</div>
    </article>
  );
}

export function FlowerThermalDivider() {
  return <div className="flower-thermal-divider" aria-hidden="true" />;
}

export function FlowerThermalSectionTitle({ children }: { children: ReactNode }) {
  return <p className="flower-thermal-section-title">{children}</p>;
}

export function FlowerThermalOrderSlip({ order }: { order: FlowerOrder }) {
  const wrapLines = (order.wrapper_color ?? '')
    .split(/[,;]+/)
    .map((part) => formatThermalBulletLine(part))
    .filter(Boolean);

  const items = order.items ?? [];

  return (
    <section className="flower-thermal-slip">
      <p className="flower-thermal-brand">{THERMAL_BRAND_NAME.toUpperCase()}</p>
      <p className="flower-thermal-order-ref">{formatThermalOrderRef(order.id)}</p>
      <p className="flower-thermal-fulfillment">{formatThermalClaimMode(order.claim_mode)}</p>
      <p className="flower-thermal-date">{formatThermalDateLine(order.scheduled_for)}</p>
      <p className="flower-thermal-time">{formatThermalTimeLine(order.scheduled_for)}</p>
      <p className="flower-thermal-branch">{order.branch_name.toUpperCase()}</p>

      <FlowerThermalDivider />

      <FlowerThermalSectionTitle>RECEIVER</FlowerThermalSectionTitle>
      <p className="flower-thermal-line">{order.receiver.toUpperCase()}</p>

      {order.customer_social.trim() ? (
        <>
          <FlowerThermalSectionTitle>CUSTOMER</FlowerThermalSectionTitle>
          <p className="flower-thermal-line">{order.customer_social.trim().toUpperCase()}</p>
        </>
      ) : null}

      <FlowerThermalSectionTitle>STATUS</FlowerThermalSectionTitle>
      <p className="flower-thermal-line">
        {(ORDER_STATUS_LABELS[order.status] ?? order.status).toUpperCase()}
      </p>

      <FlowerThermalSectionTitle>PAYMENT</FlowerThermalSectionTitle>
      <p className="flower-thermal-line">TOTAL: {PRICE_FORMATTER.format(order.total_amount)}</p>
      <p className="flower-thermal-line">DOWN: {PRICE_FORMATTER.format(order.downpayment)}</p>
      <p className="flower-thermal-line">BALANCE: {PRICE_FORMATTER.format(order.balance)}</p>
      <p className="flower-thermal-line">
        DP VIA: {formatFlowerPaymentModeLabel(order.payment_mode).toUpperCase()}
      </p>
      {order.balance_paid && order.balance_payment_mode ? (
        <p className="flower-thermal-line">
          BAL VIA: {formatFlowerPaymentModeLabel(order.balance_payment_mode).toUpperCase()}
        </p>
      ) : null}
      {order.payment_reference.trim() ? (
        <p className="flower-thermal-line">REF: {order.payment_reference.trim().toUpperCase()}</p>
      ) : null}

      <FlowerThermalSectionTitle>ORDER</FlowerThermalSectionTitle>
      {items.length > 0 ? (
        items.map((item) => (
          <p key={`${order.id}-${item.product_id}-${item.item_name}`} className="flower-thermal-line">
            {formatThermalItemLine(item.quantity, item.item_name)}
          </p>
        ))
      ) : (
        <p className="flower-thermal-line">NO FLOWERS LISTED</p>
      )}

      {wrapLines.length > 0 ? (
        <>
          <FlowerThermalSectionTitle>WRAP COLOR</FlowerThermalSectionTitle>
          {wrapLines.map((line) => (
            <p key={`${order.id}-${line}`} className="flower-thermal-line">
              {line}
            </p>
          ))}
        </>
      ) : null}

      {order.greeting_card.trim() ? (
        <>
          <FlowerThermalSectionTitle>GREETING CARD</FlowerThermalSectionTitle>
          <p className="flower-thermal-line flower-thermal-wrap">
            {order.greeting_card.trim().toUpperCase()}
          </p>
        </>
      ) : null}

      {order.special_instructions.trim() ? (
        <>
          <FlowerThermalSectionTitle>SPECIAL INSTRUCTIONS</FlowerThermalSectionTitle>
          <p className="flower-thermal-line flower-thermal-wrap">
            {order.special_instructions.trim().toUpperCase()}
          </p>
        </>
      ) : null}

      {order.notes.trim() ? (
        <>
          <FlowerThermalSectionTitle>NOTES</FlowerThermalSectionTitle>
          <p className="flower-thermal-line flower-thermal-wrap">{order.notes.trim().toUpperCase()}</p>
        </>
      ) : null}
    </section>
  );
}

export function FlowerThermalDailyOrdersDocument({
  id = 'flower-printable-daily-orders',
  orders,
}: {
  id?: string;
  dayLabel: string;
  orders: FlowerOrder[];
}) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <FlowerThermalPrintRoot id={id}>
      {orders.map((order) => (
        <FlowerThermalOrderSlip key={order.id} order={order} />
      ))}
    </FlowerThermalPrintRoot>
  );
}

export type FlowerThermalExpenseSection = {
  branch_id: string;
  branch_name: string;
  expenses: FlowerStaffExpense[];
};

export function FlowerThermalExpensesDocument({
  sections,
  generatedAt,
}: {
  sections: FlowerThermalExpenseSection[];
  generatedAt?: string;
}) {
  const nonEmptySections = sections.filter((section) => section.expenses.length > 0);
  if (nonEmptySections.length === 0) {
    return null;
  }

  const grandTotal = nonEmptySections.reduce(
    (sum, section) => sum + section.expenses.reduce((sectionSum, expense) => sectionSum + expense.amount, 0),
    0,
  );
  const entryCount = nonEmptySections.reduce((sum, section) => sum + section.expenses.length, 0);

  return (
    <FlowerThermalPrintRoot id="flower-printable-expenses">
      {nonEmptySections.map((section) => {
        const sectionTotal = section.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const sortedExpenses = [...section.expenses].sort(
          (left, right) =>
            left.expense_date.localeCompare(right.expense_date) ||
            left.created_at.localeCompare(right.created_at),
        );

        return (
          <section key={section.branch_id} className="flower-thermal-slip">
            <p className="flower-thermal-brand">{THERMAL_BRAND_NAME.toUpperCase()}</p>
            <FlowerThermalSectionTitle>STAFF EXPENSES</FlowerThermalSectionTitle>
            <p className="flower-thermal-line">{section.branch_name.toUpperCase()}</p>
            <p className="flower-thermal-line">{sortedExpenses.length} ENTRIES</p>

            <FlowerThermalDivider />

            {sortedExpenses.map((expense) => (
              <div key={expense.id} className="flower-thermal-block">
                <p className="flower-thermal-line flower-thermal-bold">{expense.expense_date}</p>
                <p className="flower-thermal-line">{expense.description.toUpperCase()}</p>
                <p className="flower-thermal-line">{expense.staff_name.toUpperCase()}</p>
                <p className="flower-thermal-line">{PRICE_FORMATTER.format(expense.amount)}</p>
              </div>
            ))}

            <FlowerThermalDivider />
            <p className="flower-thermal-line flower-thermal-bold">
              BRANCH TOTAL: {PRICE_FORMATTER.format(sectionTotal)}
            </p>
          </section>
        );
      })}

      {nonEmptySections.length > 1 ? (
        <section className="flower-thermal-slip">
          <FlowerThermalSectionTitle>ALL BRANCHES</FlowerThermalSectionTitle>
          <p className="flower-thermal-line">{entryCount} ENTRIES</p>
          <p className="flower-thermal-line flower-thermal-bold">
            GRAND TOTAL: {PRICE_FORMATTER.format(grandTotal)}
          </p>
          {generatedAt ? <p className="flower-thermal-line">PRINTED {generatedAt}</p> : null}
        </section>
      ) : generatedAt ? (
        <section className="flower-thermal-slip">
          <p className="flower-thermal-line">PRINTED {generatedAt}</p>
        </section>
      ) : null}
    </FlowerThermalPrintRoot>
  );
}

export function FlowerThermalInventoryStockDocument({
  report,
}: {
  report: FlowerPrintableInventoryStockReport;
}) {
  return (
    <FlowerThermalPrintRoot id="flower-printable-inventory-stock">
      {report.sections.map((section) => (
        <section key={section.branch_id} className="flower-thermal-slip">
          <p className="flower-thermal-brand">{THERMAL_BRAND_NAME.toUpperCase()}</p>
          <FlowerThermalSectionTitle>INVENTORY STOCK</FlowerThermalSectionTitle>
          <p className="flower-thermal-line">{section.branch_name.toUpperCase()}</p>

          <FlowerThermalDivider />

          {section.rows.map((row) => (
            <p key={`${section.branch_id}-${row.product_name}`} className="flower-thermal-stock-line">
              <span>{row.product_name.toUpperCase()}</span>
              <span>{row.on_hand}</span>
            </p>
          ))}

          <FlowerThermalDivider />
          <p className="flower-thermal-line flower-thermal-bold">
            TOTAL UNITS: {section.total_units}
          </p>
        </section>
      ))}
    </FlowerThermalPrintRoot>
  );
}

export function FlowerThermalSalesReportDocument({
  report,
  showProfitDetails = true,
}: {
  report: FlowerPrintableSalesReport;
  showProfitDetails?: boolean;
}) {
  return (
    <FlowerThermalPrintRoot id="flower-printable-sales-report">
      <section className="flower-thermal-slip">
        <p className="flower-thermal-brand">{THERMAL_BRAND_NAME.toUpperCase()}</p>
        <FlowerThermalSectionTitle>SALES REPORT</FlowerThermalSectionTitle>
        <p className="flower-thermal-line">{report.period_label.toUpperCase()}</p>
        <p className="flower-thermal-line">
          {report.from_date} – {report.to_date}
        </p>

        <FlowerThermalDivider />

        {report.branches.map((branch) => (
          <div key={branch.branch_id} className="flower-thermal-block">
            <p className="flower-thermal-line flower-thermal-bold">{branch.branch_name.toUpperCase()}</p>
            <p className="flower-thermal-line">ORDERS: {branch.order_count}</p>
            <p className="flower-thermal-line">SALES: {PRICE_FORMATTER.format(branch.sales_total)}</p>
            <p className="flower-thermal-line">
              STAFF EXP: {PRICE_FORMATTER.format(branch.staff_expenses)}
            </p>
            {showProfitDetails ? (
              <>
                <p className="flower-thermal-line">
                  SUPPLIER: {PRICE_FORMATTER.format(branch.supplier_costs)}
                </p>
                <p className="flower-thermal-line flower-thermal-bold">
                  NET: {PRICE_FORMATTER.format(branch.net_income)}
                </p>
              </>
            ) : null}
          </div>
        ))}

        <FlowerThermalDivider />

        <p className="flower-thermal-line flower-thermal-bold">ALL BRANCHES</p>
        <p className="flower-thermal-line">ORDERS: {report.totals.order_count}</p>
        <p className="flower-thermal-line">SALES: {PRICE_FORMATTER.format(report.totals.sales_total)}</p>
        <p className="flower-thermal-line">
          STAFF EXP: {PRICE_FORMATTER.format(report.totals.staff_expenses)}
        </p>
        {showProfitDetails ? (
          <>
            <p className="flower-thermal-line">
              SUPPLIER: {PRICE_FORMATTER.format(report.totals.supplier_costs)}
            </p>
            <p className="flower-thermal-line flower-thermal-bold">
              NET: {PRICE_FORMATTER.format(report.totals.net_income)}
            </p>
          </>
        ) : null}
      </section>

      {report.branches.flatMap((branch) =>
        branch.orders.map((order) => (
          <section key={`${branch.branch_id}-${order.order_id}`} className="flower-thermal-slip">
            <p className="flower-thermal-order-ref">{formatThermalOrderRef(order.order_id)}</p>
            <p className="flower-thermal-line">{branch.branch_name.toUpperCase()}</p>
            <p className="flower-thermal-date">{formatThermalDateKey(order.pickup_date)}</p>
            <p className="flower-thermal-line">{order.receiver.toUpperCase()}</p>
            <p className="flower-thermal-line">
              {(ORDER_STATUS_LABELS[order.status] ?? order.status).toUpperCase()}
            </p>
            <p className="flower-thermal-line flower-thermal-bold">
              {PRICE_FORMATTER.format(order.total_amount)}
            </p>
          </section>
        )),
      )}
    </FlowerThermalPrintRoot>
  );
}
