import type { ReactNode } from 'react';
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

type FlowerThermalPrintRootProps = {
  id?: string;
  children: ReactNode;
};

export function FlowerThermalPrintRoot({ id, children }: FlowerThermalPrintRootProps) {
  return (
    <article id={id} className="flower-thermal-print-root hidden print:block">
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
  const wrapLines = order.wrapper_color
    .split(/[,;]+/)
    .map((part) => formatThermalBulletLine(part))
    .filter(Boolean);

  return (
    <section className="flower-thermal-slip">
      <p className="flower-thermal-order-ref">{formatThermalOrderRef(order.id)}</p>
      <p className="flower-thermal-fulfillment">{formatThermalClaimMode(order.claim_mode)}</p>
      <p className="flower-thermal-date">{formatThermalDateLine(order.scheduled_for)}</p>
      <p className="flower-thermal-time">{formatThermalTimeLine(order.scheduled_for)}</p>
      <p className="flower-thermal-branch">{order.branch_name.toUpperCase()}</p>

      <FlowerThermalDivider />

      <FlowerThermalSectionTitle>ORDER</FlowerThermalSectionTitle>
      {order.items.map((item) => (
        <p key={`${order.id}-${item.product_id}-${item.item_name}`} className="flower-thermal-line">
          {formatThermalItemLine(item.quantity, item.item_name)}
        </p>
      ))}

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
          <p className="flower-thermal-line">{formatThermalBulletLine(order.greeting_card)}</p>
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
  dayLabel,
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
      <section className="flower-thermal-slip flower-thermal-slip-intro">
        <p className="flower-thermal-brand">{THERMAL_BRAND_NAME.toUpperCase()}</p>
        <FlowerThermalSectionTitle>DAILY ORDERS</FlowerThermalSectionTitle>
        <p className="flower-thermal-line">{dayLabel.toUpperCase()}</p>
        <p className="flower-thermal-line">
          {orders.length} ORDER{orders.length === 1 ? '' : 'S'}
        </p>
      </section>

      {orders.map((order) => (
        <FlowerThermalOrderSlip key={order.id} order={order} />
      ))}
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
}: {
  report: FlowerPrintableSalesReport;
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
            <p className="flower-thermal-line">
              SUPPLIER: {PRICE_FORMATTER.format(branch.supplier_costs)}
            </p>
            <p className="flower-thermal-line flower-thermal-bold">
              NET: {PRICE_FORMATTER.format(branch.net_income)}
            </p>
          </div>
        ))}

        <FlowerThermalDivider />

        <p className="flower-thermal-line flower-thermal-bold">ALL BRANCHES</p>
        <p className="flower-thermal-line">ORDERS: {report.totals.order_count}</p>
        <p className="flower-thermal-line">SALES: {PRICE_FORMATTER.format(report.totals.sales_total)}</p>
        <p className="flower-thermal-line">
          STAFF EXP: {PRICE_FORMATTER.format(report.totals.staff_expenses)}
        </p>
        <p className="flower-thermal-line">
          SUPPLIER: {PRICE_FORMATTER.format(report.totals.supplier_costs)}
        </p>
        <p className="flower-thermal-line flower-thermal-bold">
          NET: {PRICE_FORMATTER.format(report.totals.net_income)}
        </p>
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
