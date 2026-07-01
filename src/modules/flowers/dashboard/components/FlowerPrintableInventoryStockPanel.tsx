import { useEffect, useState } from 'react';
import { getFlowerPrintableInventoryStockReport } from '../../../../services/flowers/inventory/flowers-inventory-print.service';
import type { FlowerPrintableInventoryStockReport } from '../../shared/types/flower-inventory';
import { FlowerThermalInventoryStockDocument } from '../../shared/components/FlowerThermalPrint';

type FlowerInventoryStockPrintProps = {
  branchId: string;
  branchLabel: string;
  disabled?: boolean;
  controlsOnly?: boolean;
};

export default function FlowerInventoryStockPrint({
  branchId,
  branchLabel,
  disabled = false,
}: FlowerInventoryStockPrintProps) {
  const [report, setReport] = useState<FlowerPrintableInventoryStockReport | null>(null);

  useEffect(() => {
    if (disabled) {
      setReport(null);
      return;
    }

    void getFlowerPrintableInventoryStockReport({
      branchId,
      layout: 'by_branch',
      branchLabel,
    })
      .then(setReport)
      .catch(() => {
        setReport(null);
      });
  }, [branchId, branchLabel, disabled]);

  return report ? <FlowerThermalInventoryStockDocument report={report} /> : null;
}
